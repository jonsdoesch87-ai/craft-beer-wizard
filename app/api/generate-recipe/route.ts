import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { calculateWaterAdditions, type WaterProfile } from "@/lib/water-math";

// Vercel/Next.js Konfiguration: Längere Laufzeit für komplexe Berechnungen
export const maxDuration = 60; 

export interface SourceWaterProfile {
  mode: "location" | "basic" | "expert";
  location?: string;      // Für Mode A (location)
  hardness?: number;      // Für Mode B (basic) in °dH
  ph?: number;            // Für Mode B & C
  // Für Mode C (expert) - Optional in A/B:
  ca?: number;
  mg?: number;
  na?: number;
  cl?: number;
  so4?: number;
  hco3?: number;
}

export interface RecipeRequest {
  expertise: "beginner" | "intermediate" | "expert";
  equipment: "pot" | "all-in-one" | "professional";
  beerStyle: string;
  flavorProfile: string;
  units: "metric" | "imperial";
  tempUnit: "C" | "F";
  batchSize: number;
  targetABV?: number | "auto";
  targetIBU?: number | "auto";
  targetEBC?: number | "auto";
  
  // New: User's Tap Water Profile (Smart Input)
  sourceWaterProfile?: SourceWaterProfile;

  // Add-on Flags
  useWhirlpool?: boolean;
  useFruit?: boolean;
  useIrishMoss?: boolean; // Process Aid
  useAscorbicAcid?: boolean; // Anti-Oxidant
  useLactose?: boolean; // Non-fermentable sugar
  useDryHop?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const formData: RecipeRequest = await request.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: "OpenAI API key is missing" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey: apiKey.trim() });

    console.log(`🧪 Brewing Wizard V3 calculating for: ${formData.beerStyle}`);

    // Generate recipe with Chemistry Engine
    const generatedRecipe = await generateRecipeWithAI(formData, openai);

    // --- WATER CHEMISTRY MATH ENGINE (Post-Processing) ---
    // Ersetze AI-Schätzungen durch präzise Berechnungen (nur Expert Mode mit vollständigen Werten)
    if (
      formData.expertise === "expert" &&
      formData.sourceWaterProfile &&
      formData.sourceWaterProfile.mode === "expert" &&
      generatedRecipe.waterProfile
    ) {
      // Konvertiere sourceWaterProfile zu WaterProfile (nur Expert Mode hat vollständige Werte)
      const sourceProfile: Partial<WaterProfile> = {
        ca: formData.sourceWaterProfile.ca ?? 0,
        mg: formData.sourceWaterProfile.mg ?? 0,
        na: formData.sourceWaterProfile.na ?? 0,
        cl: formData.sourceWaterProfile.cl ?? 0,
        so4: formData.sourceWaterProfile.so4 ?? 0,
        hco3: formData.sourceWaterProfile.hco3 ?? 0,
      };

      const targetProfile: Partial<WaterProfile> = {
        ca: generatedRecipe.waterProfile.ca ?? 0,
        mg: generatedRecipe.waterProfile.mg ?? 0,
        na: generatedRecipe.waterProfile.na ?? 0,
        cl: generatedRecipe.waterProfile.cl ?? 0,
        so4: generatedRecipe.waterProfile.so4 ?? 0,
        hco3: generatedRecipe.waterProfile.hco3 ?? 0,
      };

      // Konvertiere Batch-Größe zu Litern (falls imperial)
      const batchSizeLiters =
        formData.units === "metric"
          ? formData.batchSize
          : formData.batchSize * 3.78541; // 1 Gallon = 3.78541 Liter

      // Nutze die Mathe-Engine
      const mathAdditions = calculateWaterAdditions(
        sourceProfile,
        targetProfile,
        batchSizeLiters
      );

      // Initialisiere extras falls nicht vorhanden
      if (!generatedRecipe.extras) {
        generatedRecipe.extras = [];
      }

      // Entferne alte "water_agent" Einträge der AI, wir trauen nur der Mathe
      generatedRecipe.extras = generatedRecipe.extras.filter(
        (e: any) => e.type !== "water_agent"
      );

      // Füge die korrekten berechneten Zusätze hinzu
      generatedRecipe.extras.push(...mathAdditions);
    }

    // --- PHYSICS & SAFETY ENGINE (Post-Processing) ---
    if (generatedRecipe.mash_schedule && Array.isArray(generatedRecipe.mash_schedule)) {
      // 1. Force Mash In
      const hasMashIn = generatedRecipe.mash_schedule.some((s: any) => 
        s.step?.toLowerCase().match(/(mash in|einmaischen|strike)/)
      );
      if (!hasMashIn) {
         generatedRecipe.mash_schedule.unshift({
          step: "Mash In",
          temp: `Target Mash Temp + ${formData.equipment === "pot" ? "3-5" : "2-3"}°${formData.tempUnit}`,
          time: "15 min",
          description: "Heat strike water and mix grains thoroughly."
        });
      }

      // 2. Force Mash Out (Stop Enzymes)
      const hasMashOut = generatedRecipe.mash_schedule.some((s: any) => 
        s.step?.toLowerCase().match(/(mash out|abmaischen)/)
      );
      if (!hasMashOut) {
        generatedRecipe.mash_schedule.push({
          step: "Mash Out",
          temp: formData.tempUnit === "C" ? "78°C" : "172°F",
          time: "10 min",
          description: "Heat to 78°C to stop enzymatic activity and improve lauter fluidity."
        });
      }
    }

    // Save to Firebase
    try {
      const { db } = await import("@/lib/firebase");
      const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");
      
      await addDoc(collection(db, "recipes"), {
        ...formData,
        recipe: generatedRecipe,
        createdAt: serverTimestamp(),
        engineVersion: "v3.0_chemistry", 
      });
    } catch (firebaseError) {
      console.warn("DB Save failed (non-critical):", firebaseError);
    }

    return NextResponse.json(
      { success: true, recipe: generatedRecipe },
      { status: 200 }
    );

  } catch (error: any) {
    console.error("WIZARD ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Recipe generation failed", error: error.message },
      { status: 500 }
    );
  }
}

async function generateRecipeWithAI(formData: RecipeRequest, openai: OpenAI) {
  const batchSizeUnit = formData.units === "metric" ? "liters" : "gallons";
  const styleLower = formData.beerStyle.toLowerCase();

  // --- DYNAMIC CONTEXT CONSTRUCTION ---
  
  // 1. Water Chemistry Context (Smart Input - 3 Modes)
  let waterInstruction = "";
  if (formData.expertise === "expert") {
    if (formData.sourceWaterProfile) {
      const waterMode = formData.sourceWaterProfile.mode || "expert";
      
      if (waterMode === "expert") {
        waterInstruction = `
WATER CHEMISTRY CALCULATION (CRITICAL - EXPERT MODE):
The user provided Expert Mode Source Water with exact ppm values: ${JSON.stringify(formData.sourceWaterProfile)}.
Target Profile for ${formData.beerStyle}: Determine the ideal profile (e.g., NEIPA = High Cl, West Coast = High SO4).
CALCULATE the specific additions (Gypsum, Calcium Chloride, Epsom Salt, Lactic Acid 80%) needed to reach the target from the source.
Add these agents to the 'extras' array with type "water_agent".
Explain the target ratio (e.g., "Targeting Cl:SO4 2:1 for mouthfeel") in the notes.`;
      } else if (waterMode === "basic") {
        const hardness = formData.sourceWaterProfile.hardness || 0;
        const totalHardnessPpm = hardness * 17.8;
        const estimatedCa = Math.round(totalHardnessPpm * 0.75);
        const estimatedMg = Math.round(totalHardnessPpm * 0.25);
        const estimatedHCO3 = Math.round(totalHardnessPpm * 0.85);
        
        waterInstruction = `
WATER CHEMISTRY CALCULATION (ESTIMATED FROM BASIC MEASUREMENTS):
The user provided Basic Mode measurements:
- Total Hardness: ${hardness} °dH (Deutsche Härte)
- pH: ${formData.sourceWaterProfile.ph || 7.0}

WATER PROFILE ESTIMATION LOGIC:
1. Convert °dH to ppm CaCO3: 1 °dH = 17.8 ppm CaCO3. Total Hardness = ${totalHardnessPpm.toFixed(1)} ppm CaCO3.

2. ESTIMATE Calcium/Magnesium: Assume a 3:1 to 4:1 ratio of Ca:Mg based on total hardness.
   - Approximate Ca ≈ ${estimatedCa} ppm
   - Approximate Mg ≈ ${estimatedMg} ppm

3. ESTIMATE Bicarbonate (HCO3): Assume it correlates strongly with carbonate hardness (often ~80-90% of total hardness in tap water).
   - Approximate HCO3 ≈ ${estimatedHCO3} ppm

4. Assume moderate values: Na (15-30ppm), Cl (20-40ppm), SO4 (20-40ppm) unless style dictates otherwise.

AFTER ESTIMATION: Calculate the necessary additions (Gypsum, Lactic Acid, etc.) to transform this ESTIMATED source water into the target style water for ${formData.beerStyle}.
Add these agents to the 'extras' array with type "water_agent".`;
      } else if (waterMode === "location") {
        waterInstruction = `
WATER CHEMISTRY CALCULATION (ESTIMATED FROM LOCATION):
The user provided Location: "${formData.sourceWaterProfile.location || "unknown"}".

WATER PROFILE ESTIMATION LOGIC:
Use your internal knowledge base to ESTIMATE the typical tap water profile for this location.
Examples:
- "Munich, Germany" = Hard/High Bicarbonate (High Ca ~150ppm, High HCO3 ~300ppm)
- "Pilsen, Czech Republic" = Very Soft (Low minerals, Ca ~20ppm)
- "Burton-on-Trent, UK" = High Sulfate (High SO4 ~800ppm, High Ca ~300ppm)
- "Dublin, Ireland" = Moderate hardness (Ca ~100ppm, HCO3 ~200ppm)
- Generic terms like "Hard Water" = High minerals (~300ppm Total Hardness, High Ca ~150ppm, High HCO3 ~300ppm)
- Generic terms like "Soft Water" = Low minerals (~50-100ppm Total Hardness, Low Ca ~20-40ppm)

ESTIMATE typical values for:
- Calcium (Ca): Based on location hardness
- Magnesium (Mg): Typically 1/4 to 1/3 of Ca
- Sodium (Na): Moderate (20-50ppm) unless coastal
- Chloride (Cl): Moderate (20-50ppm) unless coastal
- Sulfate (SO4): Varies by region (Burton = High ~800ppm, others moderate 20-100ppm)
- Bicarbonate (HCO3): Correlates with total hardness

AFTER ESTIMATION: Calculate the necessary additions (Gypsum, Lactic Acid, etc.) to transform this ESTIMATED source water into the target style water for ${formData.beerStyle}.
Add these agents to the 'extras' array with type "water_agent".
Include a note explaining: "Estimated from ${formData.sourceWaterProfile.location}. Actual values may vary."`;
      }
    } else {
      waterInstruction = `WATER PROFILE: Suggest an ideal target water profile (Ca, Mg, Na, Cl, SO4, HCO3) for this style in the 'waterProfile' object.`;
    }
  }

  // 2. Adjuncts & Styles Context
  const needsRiceOrCorn = styleLower.match(/(cold ipa|mexican|japanese|cream ale|pre-prohibition)/);
  const needsSugar = styleLower.match(/(tripel|quad|strong|double ipa|belgian|saison)/);
  
  let adjunctInstruction = "";
  if (needsRiceOrCorn) {
    adjunctInstruction = `STYLE REQUIREMENT: Use ADJUNCTS (Flaked Rice/Corn) for 10-30% of bill.`;
  } else if (needsSugar) {
    adjunctInstruction = `STYLE REQUIREMENT: Use Dextrose or Candi Sugar to dry out the beer/boost ABV.`;
  }

  // 3. Efficiency & Equipment
  let efficiency = "75%";
  if (formData.equipment === "pot") efficiency = "65% (BIAB)";
  else if (formData.equipment === "professional") efficiency = "85%";

  // 4. Add-on Logic
  let addonRules = "";
  if (formData.useIrishMoss) addonRules += "- Add 'Irish Moss' or 'Whirlfloc' to extras (type: 'process_aid', use: 'Boil').\n";
  if (formData.useLactose) addonRules += "- Add 'Lactose' to extras (type: 'sugar', use: 'Boil').\n";
  if (formData.useAscorbicAcid) addonRules += "- Add 'Ascorbic Acid' to extras (type: 'water_agent', use: 'Bottling').\n";
  
  // --- SYSTEM PROMPT ---
  const systemPrompt = `You are the "Craft Beer Wizard", a Master Brewer and Water Chemist.

YOUR MISSION: Create a chemically precise, brewable recipe.

--- INGREDIENT ENGINE (STRICT) ---
1. **Malts & Fermentables:**
   - Use 'malts' array for grains, flakes, sugars.
   - Use specific names (e.g., "Weyermann Barke Pilsner").

2. **Extras & Additives (Categorized):**
   - Use 'extras' array. MANDATORY field 'type':
     - "water_agent": Gypsum, CaCl, Lactic Acid, Baking Soda.
     - "process_aid": Irish Moss, Rice Hulls, Yeast Nutrient, Gelatin.
     - "spice": Coriander, Orange Peel, Salt.
     - "herb": Spruce tips, Heather.
     - "other": Anything else.

3. **Physics & Safety Rules:**
   - **Stuck Sparge Prevention:** IF 'malts' contains >20% Wheat, Rye, or Oats combined, YOU MUST ADD "Rice Hulls" to 'extras' (type: "process_aid", use: "Mash", amount: ~5% of grain bill).
   - **Nutrients:** If ABV > 8% or High Adjuncts, add "Yeast Nutrient" (type: "process_aid").

4. **Water Chemistry (Expert Mode):**
   - If source water is provided, use the estimation logic based on the mode:
     * **Expert Mode (exact ppm values)**: Use provided values exactly.
     * **Basic Mode (Hardness + pH)**: Estimate from hardness using conversion formulas (1 °dH = 17.8 ppm CaCO3, 3:1 to 4:1 Ca:Mg ratio, HCO3 ≈ 80-90% of total hardness).
     * **Location Mode**: Estimate from known regional water profiles (use your knowledge base of brewing water chemistry by location).
   - After estimation, calculate the exact additions (in grams/ml) to hit style targets.
   - Adjust Mash pH to 5.3-5.5 using Lactic Acid or Acidulated Malt if needed.

--- OUTPUT FORMAT (JSON ONLY) ---
{
  "name": "String",
  "description": "String",
  "specs": {
    "og": "1.xxx", "fg": "1.xxx", "abv": "x.x%", "ibu": "xx", "srm": "xx",
    "mash_water": "xx L", "sparge_water": "xx L"
  },
  "malts": [ { "name": "String", "amount": "String", "amount_grams": Number, "percentage": "String", "explanation": "String" } ],
  "hops": [ { "name": "String", "amount": "String", "amount_grams": Number, "time": "String", "boil_time": Number, "alpha": Number, "explanation": "String" } ],
  "yeast": { "name": "String", "amount": "String", "explanation": "String" },
  "extras": [ 
    { 
      "name": "Gypsum (CaSO4)", 
      "amount": 4, 
      "unit": "g", 
      "type": "water_agent", 
      "use": "Mash", 
      "time": "0 min",
      "description": "Adjusts Sulfate for crispness" 
    } 
  ],
  "mash_schedule": [ { "step": "String", "temp": "String", "time": "String", "description": "String" } ],
  "waterProfile": { "ca": 0, "mg": 0, "na": 0, "cl": 0, "so4": 0, "hco3": 0, "ph": 5.4, "description": "Target Profile" },
  "fermentation_instructions": [ "String" ],
  "fermentationSchedule": [ { "day": 0, "type": "temp", "description": "String", "value": "String" } ],
  "shopping_list": [ { "item": "String", "category": "malt/hop/yeast/additive" } ],
  "notes": "String"
}`;

  const userPrompt = `
Generate a ${formData.expertise} recipe for: ${formData.beerStyle}
Flavor: ${formData.flavorProfile}
Batch: ${formData.batchSize} ${batchSizeUnit}
Efficiency: ${efficiency}

${waterInstruction}
${adjunctInstruction}
${addonRules}

Constraints:
1. Return strictly valid JSON.
2. Check for "Stuck Sparge" risk (Wheat/Oats) and add Rice Hulls if needed.
3. If Expert, be precise with Water Agents.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 3500,
    });

    const content = completion.choices[0]?.message?.content || "{}";
    const jsonString = content.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
    return JSON.parse(jsonString);

  } catch (error) {
    console.error("AI Generation Failed:", error);
    throw error;
  }
}
