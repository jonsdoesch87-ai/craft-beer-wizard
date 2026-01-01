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
  useSpices?: boolean; // Spices, herbs, coffee, etc.
  useWood?: boolean; // Wood chips or cubes
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

    // Apply comprehensive sanitization to ensure physical brewing rules
    const sanitizedRecipe = sanitizeRecipe(generatedRecipe, formData);
    
    // Use sanitized recipe for response
    const finalRecipe = sanitizedRecipe;

    // Save to Firebase
    try {
      const { db } = await import("@/lib/firebase");
      const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");
      
      await addDoc(collection(db, "recipes"), {
        ...formData,
        recipe: finalRecipe,
        createdAt: serverTimestamp(),
        engineVersion: "v3.0_chemistry", 
      });
    } catch (firebaseError) {
      console.warn("DB Save failed (non-critical):", firebaseError);
    }

    return NextResponse.json(
      { success: true, recipe: finalRecipe },
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

/**
 * Sanitizes and normalizes a recipe to ensure data integrity
 */
function sanitizeRecipe(recipe: any, formData: RecipeRequest): any {
  const sanitized = { ...recipe };

  // --- MASH SCHEDULE SANITIZATION ---
  if (sanitized.mash_schedule && Array.isArray(sanitized.mash_schedule)) {
    // Filter out any existing Mash In/Out steps
    sanitized.mash_schedule = sanitized.mash_schedule.filter((step: any) => {
      const stepName = (step.step || "").toLowerCase();
      return !stepName.match(/(mash in|einmaischen|mash out|abmaischen|strike)/);
    });

    // Find the first saccharification rest temperature for Mash In calculation
    let firstSaccTemp = 68; // Default fallback
    for (const step of sanitized.mash_schedule) {
      const tempStr = (step.temp || "").toString();
      const tempMatch = tempStr.match(/(\d+)/);
      if (tempMatch) {
        const temp = parseInt(tempMatch[1], 10);
        if (temp >= 60 && temp <= 75) {
          firstSaccTemp = temp;
          break;
        }
      }
    }

    // Add standardized Mash In at index 0
    const mashInTemp = formData.tempUnit === "C" 
      ? `${firstSaccTemp + 3}°C`
      : `${Math.round((firstSaccTemp + 3) * 9/5 + 32)}°F`;
    
    sanitized.mash_schedule.unshift({
      step: "Mash In (Einmaischen)",
      temp: mashInTemp,
      time: "15 min",
      description: "Heat strike water and mix in grains thoroughly."
    });

    // Add standardized Mash Out at the end (ALWAYS 78°C, regardless of unit preference)
    // Mash Out temperature is a physical constant and must always be 78°C
    sanitized.mash_schedule.push({
      step: "Mash Out (Abmaischen)",
      temp: "78°C", // Always 78°C - this is a physical constant for stopping enzymatic activity
      time: "10 min",
      description: "Heat to 78°C to stop enzymatic activity and reduce wort viscosity for easier lautering."
    });
  }

  // --- INGREDIENT INTEGRITY: Clean hops array ---
  if (sanitized.hops && Array.isArray(sanitized.hops)) {
    // Ensure extras array exists
    if (!sanitized.extras) {
      sanitized.extras = [];
    }

    const validHops: any[] = [];
    const invalidHops: any[] = [];

    for (const hop of sanitized.hops) {
      const hopName = (hop.name || "").toLowerCase();
      const hasAlpha = hop.alpha && typeof hop.alpha === "number" && hop.alpha > 0;
      const isFruitOrAdditive = hopName.match(/(puree|fruit|lactose|sugar|honey|syrup|extract|essence)/);

      if (!hasAlpha || isFruitOrAdditive) {
        // Move to extras
        invalidHops.push(hop);
      } else {
        validHops.push(hop);
      }
    }

    // Convert invalid hops to extras format
    for (const invalidHop of invalidHops) {
      sanitized.extras.push({
        name: invalidHop.name,
        amount: invalidHop.amount || "0 g",
        unit: "g",
        type: invalidHop.name.toLowerCase().match(/fruit|puree/) ? "fruit" : "other",
        use: invalidHop.time?.includes("Dry") ? "Dry Hop" : "Boil",
        time: invalidHop.time || "0 min",
        description: invalidHop.explanation || `Moved from hops array (no alpha acid or invalid ingredient)`
      });
    }

    sanitized.hops = validHops;

    // --- FIRST WORT HOPPING (FWH) ---
    // In expert mode or high IBU recipes, move 60-min hop addition to First Wort
    if (formData.expertise === "expert" || sanitized.specs?.ibu) {
      const ibu = parseInt(sanitized.specs?.ibu?.toString().replace(/[^0-9]/g, "") || "0");
      if (ibu >= 50) {
        // Find 60-min hop additions and convert to First Wort
        for (const hop of sanitized.hops) {
          if (hop.boil_time === 60 || hop.time?.includes("60")) {
            hop.time = "First Wort";
            hop.boil_time = 0; // FWH is technically 0 min boil time
            if (!hop.explanation) {
              hop.explanation = "First Wort Hopping for smoother bitterness";
            }
          }
        }
      }
    }
  }

  // --- EQUIPMENT-BASED VOLUME CALCULATION ---
  if (sanitized.malts && Array.isArray(sanitized.malts)) {
    // Calculate total grain weight in kg
    let totalGrainKg = 0;
    for (const malt of sanitized.malts) {
      const amountStr = (malt.amount || "").toString();
      // Extract number and unit
      const match = amountStr.match(/([\d.]+)\s*(kg|g|lb|oz)/i);
      if (match) {
        let amount = parseFloat(match[1]);
        const unit = match[2].toLowerCase();
        // Convert to kg
        if (unit === "g") amount = amount / 1000;
        else if (unit === "lb") amount = amount * 0.453592;
        else if (unit === "oz") amount = amount * 0.0283495;
        totalGrainKg += amount;
      }
    }

    // Convert batch size to liters
    const batchSizeLiters = formData.units === "metric" 
      ? formData.batchSize 
      : formData.batchSize * 3.78541;

    // Equipment-specific calculations
    let mashWaterL = 0;
    let spargeWaterL = 0;
    let absorptionRate = 0.7; // Default L/kg

    if (formData.equipment === "pot") {
      // BIAB: Full volume mash, no sparge
      absorptionRate = 0.6; // BIAB has less absorption
      mashWaterL = batchSizeLiters + (totalGrainKg * absorptionRate) + 2; // +2L for evaporation/boil-off estimate
      spargeWaterL = 0;
      // Ensure specs reflect BIAB
      if (!sanitized.specs) sanitized.specs = {};
      sanitized.specs.mash_water = `${Math.round(mashWaterL)} L`;
      sanitized.specs.sparge_water = "0 L";
    } else if (formData.equipment === "all-in-one") {
      // All-in-One: Typical split ~70% mash, 30% sparge
      absorptionRate = 0.8;
      const totalWaterNeeded = batchSizeLiters + (totalGrainKg * absorptionRate) + 2;
      mashWaterL = Math.round(totalWaterNeeded * 0.7);
      spargeWaterL = Math.round(totalWaterNeeded * 0.3);
      if (!sanitized.specs) sanitized.specs = {};
      sanitized.specs.mash_water = `${mashWaterL} L`;
      sanitized.specs.sparge_water = `${spargeWaterL} L`;
    } else if (formData.equipment === "professional") {
      // Professional: More efficient, ~60% mash, 40% sparge
      absorptionRate = 0.5;
      const totalWaterNeeded = batchSizeLiters + (totalGrainKg * absorptionRate) + 1.5;
      mashWaterL = Math.round(totalWaterNeeded * 0.6);
      spargeWaterL = Math.round(totalWaterNeeded * 0.4);
      if (!sanitized.specs) sanitized.specs = {};
      sanitized.specs.mash_water = `${mashWaterL} L`;
      sanitized.specs.sparge_water = `${spargeWaterL} L`;
    }
  }

  // --- CARBONATION CALCULATION ---
  if (!sanitized.specs) sanitized.specs = {};
  if (!sanitized.specs.carbonation) {
    const styleLower = (formData.beerStyle || "").toLowerCase();
    let targetCO2 = 5.0; // Default g/L
    
    // Style-based carbonation levels
    if (styleLower.match(/(wheat|hefeweizen|wit|weizen|weissbier)/)) {
      targetCO2 = 5.5; // Higher carbonation for wheat beers
    } else if (styleLower.match(/(lager|pilsner|helles)/)) {
      targetCO2 = 5.0; // Standard for lagers
    } else if (styleLower.match(/(stout|porter|ale|ipa|pale ale)/)) {
      targetCO2 = 4.0; // Lower for ales
    } else if (styleLower.match(/(belgian|saison|tripel|quad)/)) {
      targetCO2 = 5.5; // Higher for Belgian styles
    } else if (styleLower.match(/(barleywine|imperial|strong)/)) {
      targetCO2 = 3.5; // Lower for strong beers
    } else if (styleLower.match(/(sour|gose|berliner|wild)/)) {
      targetCO2 = 5.5; // Higher for sour styles
    }
    
    sanitized.specs.carbonation = `${targetCO2.toFixed(1)} g/L`;
  }

  return sanitized;
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

  // 4. Add-on Logic - "The Brewer is Boss" (Respect User Choices)
  let addonRules = "";
  
  // Flavor Profile Additions (Creative)
  if (formData.useLactose) {
    addonRules += "- Add 'Lactose' to extras (type: 'sugar', use: 'Boil').\n";
  }
  if (formData.useFruit) {
    addonRules += "- Add appropriate fruit (puree, peel, or juice) to extras (type: 'other' or 'spice', use: 'Boil' or 'Secondary').\n";
  }
  if (formData.useSpices) {
    addonRules += "- Add spices/herbs/coffee as appropriate to extras (type: 'spice' or 'herb', use: 'Boil' or 'Secondary').\n";
  }
  if (formData.useWood) {
    addonRules += "- Add wood chips or cubes to extras (type: 'other', use: 'Secondary').\n";
  }
  
  // Process Techniques (STRICT: Only if user checked)
  if (formData.useIrishMoss) {
    addonRules += "- Add 'Irish Moss' or 'Whirlfloc' to extras (type: 'process_aid', use: 'Boil').\n";
  }
  if (formData.useAscorbicAcid) {
    addonRules += "- Add 'Ascorbic Acid' to extras (type: 'water_agent', use: 'Bottling').\n";
  }
  
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

--- USER CHOICE RESPECT (CRITICAL: "The Brewer is Boss") ---
**NEVER override user choices. The user knows what they want.**

1. **Dry Hopping:**
   - IF user checked Dry Hopping: You MUST include a dry hop step in the fermentation schedule.
   - IF user did NOT check Dry Hopping: You MUST NOT include dry hops, even if the style implies it (e.g., for an IPA). The user might want a 'Classic IPA' without dry hop.

2. **Whirlpool / Hop Stand:**
   - IF user checked Whirlpool: Plan for a specific Whirlpool/Hop Stand step at ~80°C after boil (understand that 'Whirlpool' in homebrewing often implies a 'Hop Stand' at 80°C).
   - IF user did NOT check Whirlpool: Do not add a specific Whirlpool/Hop Stand step. Put aroma hops at '5 min' or 'Flameout' instead.

3. **Irish Moss / Clarification:**
   - IF user checked Irish Moss: Add 'Irish Moss' or 'Whirlfloc' to extras (type: 'process_aid', use: 'Boil').
   - IF user did NOT check Irish Moss: Do not add Irish Moss to the ingredients, even if style might benefit from clarity.

4. **Water Chemistry:**
   - IF user is in Expert Mode AND provided sourceWaterProfile: Calculate and add water agents to extras.
   - IF user did NOT enable Water Chemistry OR is not in Expert Mode: Do not generate water agent additions (unless style absolutely requires minimal adjustment - but prefer not to).

5. **Flavor Additions (Spices, Fruit, Wood, Lactose):**
   - Only add these IF the user explicitly checked them. Do not add them "because the style typically uses them" if the user did not check the box.

4. **Water Chemistry (Expert Mode):**
   - If source water is provided, use the estimation logic based on the mode:
     * **Expert Mode (exact ppm values)**: Use provided values exactly.
     * **Basic Mode (Hardness + pH)**: Estimate from hardness using conversion formulas (1 °dH = 17.8 ppm CaCO3, 3:1 to 4:1 Ca:Mg ratio, HCO3 ≈ 80-90% of total hardness).
     * **Location Mode**: Estimate from known regional water profiles (use your knowledge base of brewing water chemistry by location).
   - After estimation, calculate the exact additions (in grams/ml) to hit style targets.
   - Adjust Mash pH to 5.3-5.5 using Lactic Acid or Acidulated Malt if needed.

--- CONDITIONING DAYS CALCULATION (REQUIRED) ---
You MUST calculate "conditioning_days_min" and "conditioning_days_max" based on the beer style and original gravity (og):

Rules:
1. **Light/Quick Styles** (Pale Ale, IPA, Wheat, Kölsch): min=14, max=60-90
2. **Standard Styles** (Amber, Brown, Porter, Stout): min=21, max=90-120
3. **Lager Styles** (Pilsner, Lager, Bock): min=28, max=120-180
4. **High ABV/Strong** (Barleywine, Imperial, Belgian Strong): min=60-90, max=180-365
5. **Sour/Wild** (Lambic, Gose, Berliner Weisse): min=90, max=365+

Consider og: Higher og (>1.080) = longer conditioning. Lower og (<1.045) = shorter conditioning.

--- MASH SCHEDULE RULES (CRITICAL) ---
MASH: Focus ONLY on saccharification rests (e.g., "Saccharification Rest", "Beta Amylase Rest", "Protein Rest"). 
Do NOT generate "Mash In" or "Mash Out" steps in the mash_schedule array, as they are added programmatically.
The mash_schedule array should contain ONLY the actual enzyme rest steps between mashing in and mashing out.

--- INGREDIENT SEPARATION RULES (CRITICAL) ---
INGREDIENTS: Ensure ONLY actual hops (with alpha acid > 0) are in the hops array.
Any fruit, puree, lactose, sugar, honey, syrup, extracts, essences, or other additives MUST be placed in the extras array with appropriate type and use fields.
The hops array is strictly for hop varieties that contribute bitterness, flavor, or aroma through alpha acids.
If an ingredient does not have a measurable alpha acid content, it does NOT belong in the hops array.

--- OUTPUT FORMAT (JSON ONLY) ---
{
  "name": "String",
  "description": "String",
  "specs": {
    "og": "1.xxx", "fg": "1.xxx", "abv": "x.x%", "ibu": "xx", "srm": "xx",
    "mash_water": "xx L", "sparge_water": "xx L"
  },
  "conditioning_days_min": Number,
  "conditioning_days_max": Number,
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

  // Add explicit rules for Dry Hop and Whirlpool to userPrompt
  let techniqueRules = "";
  if (formData.useDryHop) {
    techniqueRules += "REQUIRED: Include a dry hop step in the fermentation schedule.\n";
  } else {
    techniqueRules += "IMPORTANT: Do NOT include dry hops in this recipe, even if the style typically uses them.\n";
  }
  if (formData.useWhirlpool) {
    techniqueRules += "REQUIRED: Include a Whirlpool/Hop Stand step at ~80°C after boil for hop aroma.\n";
  } else {
    techniqueRules += "IMPORTANT: Do NOT create a Whirlpool step. Put aroma hops at '5 min' or 'Flameout' instead.\n";
  }
  if (!formData.useIrishMoss) {
    techniqueRules += "IMPORTANT: Do NOT add Irish Moss or any clarification agents.\n";
  }

  const userPrompt = `
Generate a ${formData.expertise} recipe for: ${formData.beerStyle}
Flavor: ${formData.flavorProfile}
Batch: ${formData.batchSize} ${batchSizeUnit}
Efficiency: ${efficiency}

${waterInstruction}
${adjunctInstruction}
${addonRules}

${techniqueRules}

Constraints:
1. Return strictly valid JSON.
2. Check for "Stuck Sparge" risk (Wheat/Oats) and add Rice Hulls if needed.
3. If Expert, be precise with Water Agents.
4. RESPECT all user choices above. Do not add techniques or ingredients that were not explicitly requested.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // Using GPT-4o model for recipe generation
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
