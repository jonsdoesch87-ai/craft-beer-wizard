import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Vercel/Next.js Konfiguration: Erlaubt längere Laufzeiten (wichtig für GPT-4o!)
export const maxDuration = 60; 

export interface RecipeRequest {
  expertise: "beginner" | "intermediate" | "expert";
  equipment: "pot" | "all-in-one" | "professional";
  beerStyle: string;
  flavorProfile: string;
  units: "metric" | "imperial";
  batchSize: number;
  targetABV?: number | "auto";
  targetIBU?: number | "auto";
  targetEBC?: number | "auto";
  ingredientsInStock?: string;
  // Advanced Add-on Flags
  useWhirlpool?: boolean;
  useFruit?: boolean;
  useIrishMoss?: boolean;
  useAscorbicAcid?: boolean;
  useLactose?: boolean;
  useDryHop?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const formData: RecipeRequest = await request.json();

    // Validate API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("OPENAI_API_KEY is not set in environment variables");
      return NextResponse.json(
        { success: false, message: "OpenAI API key is not configured" },
        { status: 500 }
      );
    }

    // Debug: Check if API key is present (without logging the actual key)
    const apiKeyLength = apiKey.trim().length;
    const apiKeyPrefix = apiKey.trim().substring(0, 7);
    console.log(`OpenAI API Key found: Length=${apiKeyLength}, Prefix=${apiKeyPrefix}...`);

    // Initialize OpenAI client INSIDE the function to ensure env vars are loaded
    const openai = new OpenAI({
      apiKey: apiKey.trim(), // Remove any whitespace
    });

    // Log received data
    console.log("Generating recipe for:", {
      style: formData.beerStyle,
      model: "gpt-4o",
    });

    // Generate recipe with OpenAI
    const generatedRecipe = await generateRecipeWithAI(formData, openai);

    // Save to Firebase Firestore
    try {
      const { db } = await import("@/lib/firebase");
      const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");

      const recipeData = {
        ...formData,
        recipe: generatedRecipe,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "recipes"), recipeData);
      console.log("Recipe saved to Firestore with ID:", docRef.id);
    } catch (firebaseError) {
      console.error("Error saving to Firebase (non-critical):", firebaseError);
      // We continue even if Firebase fails, so the user still gets their recipe
    }

    // Return generated recipe
    return NextResponse.json(
      {
        success: true,
        message: "Recipe generated successfully!",
        recipe: generatedRecipe,
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error("CRITICAL ERROR in generate-recipe:", error);

    // WICHTIG: Echte Fehlermeldung zurückgeben statt Fake-Rezept
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return NextResponse.json(
      {
        success: false,
        message: "Failed to generate recipe. Please check logs.",
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

async function generateRecipeWithAI(formData: RecipeRequest, openai: OpenAI) {
  const batchSizeUnit = formData.units === "metric" ? "liters" : "gallons";
  
  // Equipment Description Helper
  const equipmentDescription =
    formData.equipment === "pot"
      ? "basic pot setup"
      : formData.equipment === "all-in-one"
        ? "all-in-one brewing system"
        : "professional brewing setup";

  // ABV/IBU/EBC Text Helper
  const targetABVText =
    formData.targetABV === "auto" || !formData.targetABV
      ? "Auto (style-appropriate)"
      : `${formData.targetABV}%`;
  
  const targetIBUText =
    formData.targetIBU === "auto" || !formData.targetIBU
      ? "Auto (style-appropriate)"
      : `${formData.targetIBU} IBU`;
  
  const targetEBCText =
    formData.targetEBC === "auto" || !formData.targetEBC
      ? "Auto (style-appropriate)"
      : `${formData.targetEBC} EBC`;
  
  const ingredientsText = formData.ingredientsInStock
    ? `\nIngredients in Stock / Preferences: ${formData.ingredientsInStock}`
    : "";

  // Equipment Logic: Efficiency and Notes
  let efficiency: string;
  let efficiencyNote: string;
  let mashMethodRule: string;
  
  if (formData.equipment === "pot") {
    efficiency = "65%";
    efficiencyNote = "Calculated for BIAB/Pot method (65%). High grain bill to compensate for lower efficiency.";
    mashMethodRule = "MASH METHOD: Use Full Volume Mash (BIAB - no sparging needed). All water goes into the mash. Set sparge_water to '0 L' or 'N/A'.";
  } else if (formData.equipment === "all-in-one") {
    efficiency = "80%";
    efficiencyNote = "Calculated for High-Efficiency System (80%). Standard grain bill.";
    mashMethodRule = "MASH METHOD: Calculate separate mash_water and sparge_water volumes. All-in-One systems require proper sparging calculations.";
  } else {
    efficiency = "85%";
    efficiencyNote = "Calculated for Professional Setup (85%). Optimized grain bill.";
    mashMethodRule = "MASH METHOD: Use traditional mash and sparge separation.";
  }
  
  const efficiencyRule = `BREWHOUSE EFFICIENCY: Set to ${efficiency}. Calculate all grain amounts based on this efficiency. ${efficiencyNote}`;

  // Expertise Logic: Complexity and Techniques
  let complexityRule = "";
  let mashScheduleRule = "";
  let yeastRule = "";
  let hopTechniqueRule = "";
  
  if (formData.expertise === "beginner") {
    complexityRule = "COMPLEXITY LEVEL: Beginner-friendly recipe. Keep it simple and straightforward.";
    mashScheduleRule = "MASH SCHEDULE: You MUST use Single Infusion Mash (only ONE temperature rest, typically 65-68°C / 149-154°F for 60 minutes). NO multi-step mashing. NO protein rest, NO mash out step. Keep it to a single temperature rest only.";
    yeastRule = "YEAST: You MUST use Dry Yeast only (e.g., Safale US-05, Safale S-04, Saflager W-34/70, Lallemand Verdant IPA). NO liquid yeast, NO yeast starters required.";
    const batchSizeL = formData.units === "metric" ? formData.batchSize : formData.batchSize * 3.78541;
    const maxHopsPerLiter = 8;
    const totalHopsGrams = batchSizeL * maxHopsPerLiter;
    const isNEIPA = formData.beerStyle.toLowerCase().includes("neipa") || 
                    formData.beerStyle.toLowerCase().includes("hazy") ||
                    formData.flavorProfile.toLowerCase().includes("juicy") ||
                    formData.flavorProfile.toLowerCase().includes("tropical");
    
    if (!isNEIPA) {
      hopTechniqueRule = `HOPPING: Keep total hop additions moderate (max ${totalHopsGrams.toFixed(0)}g for ${formData.batchSize} ${batchSizeUnit}). Focus on simple boil additions (60min, 15min, 5min). Avoid complex techniques like First Wort Hopping (FWH) or extended Whirlpool. Dry hopping is optional and should be minimal if included.`;
    } else {
      hopTechniqueRule = "HOPPING: For NEIPA/Hazy styles, you may use larger hop amounts and Whirlpool/Dry Hop additions, but keep the technique simple (no FWH).";
    }
  } else if (formData.expertise === "expert") {
    complexityRule = "COMPLEXITY LEVEL: Advanced, competition-worthy recipe. Use sophisticated techniques.";
    mashScheduleRule = "MASH SCHEDULE: You MUST use Multi-step Mashing with at least 2-3 temperature rests (e.g., Protein Rest at 50°C, Saccharification Rest at 65-68°C, Mash Out at 76°C). Include detailed temperature steps with specific times. This is REQUIRED for expert level.";
    yeastRule = "YEAST: You may use Liquid Yeast (Wyeast, White Labs) and MUST include instructions for creating a yeast starter. Specify starter size (e.g., '1L starter for 20L batch'). Advanced fermentation techniques are encouraged.";
    hopTechniqueRule = "HOPPING: Use advanced techniques: First Wort Hopping (FWH) when appropriate, Hop Stand/Whirlpool at specific temperatures (e.g., 'Cool to 80°C and add hops, steep for 20 minutes'), multiple dry hop additions with specific timing. Be creative and precise.";
  } else {
    // Intermediate
    complexityRule = "COMPLEXITY LEVEL: Intermediate recipe with some advanced techniques.";
    mashScheduleRule = "MASH SCHEDULE: You may use a simple 2-step mash (Saccharification + Mash Out) or single infusion, depending on beer style.";
    yeastRule = "YEAST: Prefer Dry Yeast, but Liquid Yeast is acceptable. Starter is optional but recommended.";
    hopTechniqueRule = "HOPPING: Use standard techniques with optional Whirlpool additions. Dry hopping is encouraged for hoppy styles.";
  }

  // Advanced Add-on Rules (BEFORE style instructions)
  let addonRules = "";
  
  if (formData.useIrishMoss) {
    addonRules += "- INGREDIENT MANDATORY: You MUST add 'Irish Moss' (5g) to the boil (time: '10 min'). This helps with protein coagulation and clarity.\n";
  }
  
  if (formData.useLactose) {
    const lactoseAmount = formData.batchSize <= 20 ? "250g" : "500g";
    addonRules += `- INGREDIENT MANDATORY: You MUST add 'Lactose' (${lactoseAmount}) to the boil (time: '10 min'). Explain it adds body/sweetness and is unfermentable.\n`;
  }
  
  if (formData.useAscorbicAcid) {
    addonRules += "- INGREDIENT MANDATORY: Add 'Ascorbic Acid' (Vitamin C) to 'other' ingredients or notes. Use at packaging (0.5-1g per 20L) to prevent oxidation.\n";
  }
  
  if (formData.useWhirlpool) {
    addonRules += "- HOPPING: You MUST include a specific Whirlpool hop addition at 80°C (cool wort to 80°C, add hops, steep for 20-30 minutes).\n";
  }
  
  if (formData.useDryHop) {
    addonRules += "- HOPPING: You MUST include a Dry Hop addition (add hops after primary fermentation, typically Day 3-5, for 3-7 days).\n";
  }

  // Fruit Logic (Global - applies to all styles if useFruit flag is set)
  const fruitMatch = formData.beerStyle.match(/(Strawberry|Raspberry|Mango|Cherry|Peach|Apricot|Passion\s?fruit|Guava|Blueberry|Blackberry|Pineapple|Lime|Lemon|Orange|Grapefruit)/i) 
                    || formData.flavorProfile.match(/(Strawberry|Raspberry|Mango|Cherry|Peach|Apricot|Passion\s?fruit|Guava|Blueberry|Blackberry|Pineapple|Lime|Lemon|Orange|Grapefruit)/i);
  
  let globalFruitInstruction = "";
  if (formData.useFruit && !fruitMatch) {
    // useFruit flag is true but no fruit name found - instruct AI to choose appropriate fruit
    globalFruitInstruction = `
FRUIT MANDATORY: The user wants fruit in this recipe (useFruit flag is true).
You MUST choose a fruit matching the style (e.g., Raspberry for Stout, Mango for IPA, Cherry for Sour) and add it to the 'hops' list with:
- name: "{ChosenFruit} Puree" (choose appropriate fruit for ${formData.beerStyle})
- amount: "${(formData.batchSize * 0.075).toFixed(1)} kg" (or appropriate amount for ${formData.batchSize} ${batchSizeUnit})
- time: "Secondary Fermentation"
- boil_time: 0
- alpha: 0
- alpha_acid_base: 0
- explanation: "Add after primary fermentation subsides (Day 5-7) to preserve fresh fruit character. Pasteurize puree at 70°C for 10 min or use aseptic puree."
Also add "{ChosenFruit} Puree" to the shopping_list as a separate item (category: "other").`;
  }

  // Style-Specific Instructions (Comprehensive Logic) - BEFORE prompt construction
  const styleLower = formData.beerStyle.toLowerCase();
  const flavorLower = formData.flavorProfile.toLowerCase();
  
  let styleInstructions = "";
  
  // SOUR BEER (Critical - with Fruit Detection)
  if (styleLower.includes("sour") || styleLower.includes("gose") || styleLower.includes("berliner") || styleLower.includes("lambic")) {
    let fruitInstruction = "";
    if (fruitMatch || formData.useFruit) {
      let fruitName = "";
      if (fruitMatch) {
        fruitName = fruitMatch[1]; // e.g. "Strawberry"
      } else if (formData.useFruit) {
        // No fruit name found, but useFruit flag is true - instruct AI to choose appropriate fruit
        fruitName = "fruit"; // Placeholder, will be replaced in instruction
        fruitInstruction = `
FRUIT MANDATORY: The user wants fruit in this recipe (useFruit flag is true).
You MUST choose a fruit matching the style (e.g., Raspberry for Stout, Mango for IPA, Cherry for Sour) and add it to the 'hops' list with:
- name: "{ChosenFruit} Puree" (choose appropriate fruit for ${formData.beerStyle})
- amount: "${(formData.batchSize * 0.075).toFixed(1)} kg" (or appropriate amount for ${formData.batchSize} ${batchSizeUnit})
- time: "Secondary Fermentation"
- boil_time: 0
- alpha: 0
- alpha_acid_base: 0
- explanation: "Add after primary fermentation subsides (Day 5-7) to preserve fresh fruit character. Pasteurize puree at 70°C for 10 min or use aseptic puree."
Also add "{ChosenFruit} Puree" to the shopping_list as a separate item (category: "other").`;
      }
      
      if (fruitMatch && !fruitInstruction) {
        // Original logic for when fruit name is found
        const fruitAmount = `${(formData.batchSize * 0.075).toFixed(1)} kg`; // ~7.5% of batch size
        fruitInstruction = `
FRUIT MANDATORY: The user wants a ${fruitName} sour.
You MUST add the fruit to the 'hops' list (hack for visibility) with:
- name: "${fruitName} Puree"
- amount: "${fruitAmount}" (or appropriate amount for ${formData.batchSize} ${batchSizeUnit})
- time: "Secondary Fermentation"
- boil_time: 0
- alpha: 0
- alpha_acid_base: 0
- explanation: "Add after primary fermentation subsides (Day 5-7) to preserve fresh fruit character. Pasteurize puree at 70°C for 10 min or use aseptic puree."
Also add "${fruitName} Puree" to the shopping_list as a separate item (category: "other").`;
      }
    }
    
    // Determine souring method (prefer Philly Sour for beginners, Kettle Sour for experts)
    const usePhillySour = formData.expertise === "beginner" || formData.expertise === "intermediate";
    const sourMethod = usePhillySour ? "Philly Sour" : "Kettle Sour";
    
    const phillyMethod = `SOUR METHOD:
1. Use "Lallemand Philly Sour" yeast (produces lactic acid + alcohol).
2. Add simple sugar (Dextrose/Corn Sugar) ~5-10% to boil to fuel acid production.
3. Low mash temp (65°C) for high fermentability.`;
    
    const kettleMethod = "KETTLE SOUR PROCESS (Complex): MASH steps must include: 1) Mash at 65-67°C, 2) Lauter and collect wort, 3) Short boil (10-15 min) to pasteurize, 4) Cool wort to 40-45°C, 5) Add Lactobacillus culture (GoodBelly, Omega Yeast OYL-605, or Lallemand WildBrew Sour Pitch), 6) HOLD at 40-45°C for 24-48 hours (SOURING PHASE - monitor pH, target 3.2-3.5), 7) Boil with hops (60 min) to kill Lactobacillus, 8) Cool and ferment with clean ale yeast. This is a 2-day process.";
    
    const phillyYeast = "Lallemand Philly Sour (single strain, produces lactic acid)";
    const kettleYeast = "Clean ale yeast (Safale US-05, Wyeast 1007) AFTER kettle souring is complete";
    
    // Build fermentation instructions string
    let phillyFermentSteps = '"Pitch Philly Sour at 22°C", "Ferment for 10-14 days at 22-24°C"';
    if (fruitMatch) {
      phillyFermentSteps += `, "Add ${fruitMatch[1]} Puree on Day 5-7", "Wait for fruit sugars to ferment out (3-5 days) before packaging"`;
    } else {
      phillyFermentSteps += ', "Monitor pH until target 3.2-3.5 is reached"';
    }
    const phillyFerment = `fermentation_instructions MUST include: [${phillyFermentSteps}]. Philly Sour produces acid during primary fermentation.`;
    const kettleFerment = "After kettle souring and final boil: 18-20°C for 7-10 days with clean ale yeast.";
    
    styleInstructions = `STYLE: Sour Beer (${sourMethod} Method)
METHOD: ${sourMethod === "Philly Sour" ? phillyMethod : kettleMethod}
${fruitInstruction}

MALT: Pilsner or Wheat base. Low SRM (pale, SRM < 4).
HOPS: Minimal or NO hops during souring phase (hops inhibit Lactobacillus). If using Kettle Sour, add hops ONLY after souring is complete, during the final boil. Very low IBU (5-15).
YEAST: ${sourMethod === "Philly Sour" ? phillyYeast : kettleYeast}
FERMENTATION: ${sourMethod === "Philly Sour" ? phillyFerment : kettleFerment}
pH TARGET: 3.2-3.5 for tartness.`;
  }
  // STOUT / PORTER
  else if (styleLower.includes("stout") || styleLower.includes("porter")) {
    styleInstructions = `STYLE: Stout / Porter
MALT BILL: You MUST include roasted malts: Roasted Barley (for Stout), Chocolate Malt, Black Patent, or Carafa Special III. Total roasted malts: 5-15% of grain bill. Base malt: Maris Otter or Pale Ale malt.
MASH TEMP: Medium-high mash temperature (68-69°C / 154-156°F) for full body and mouthfeel. This creates more unfermentable sugars.
WATER: Chloride-dominant water profile (Chloride:Sulfate ratio 2:1 or higher) to enhance malt sweetness and body.
HOPS: Lower bitterness (30-50 IBU). Focus on balance with malt, not hop-forward. English hops preferred (Fuggles, East Kent Goldings).
YEAST: English or Irish strains (Wyeast 1084 Irish Ale, White Labs WLP004 Irish Ale, Safale S-04). These add subtle esters that complement roasted flavors.
FERMENTATION: 18-20°C for clean fermentation.`;
  }
  // LAGER / PILSNER
  else if (styleLower.includes("pilsner") || styleLower.includes("lager") || styleLower.includes("helles") || styleLower.includes("dunkel") || styleLower.includes("bock")) {
    styleInstructions = `STYLE: Pilsner / Lager
MALT: Pilsner or Lager malt base. For Dunkel: Munich and Carafa Special. For Bock: Munich and Vienna malts.
HOPS: German/Czech noble hops MANDATORY (Saaz, Hallertau, Tettnang, Perle, Spalt). NO American hops.
MASH: Multi-step mash REQUIRED: Protein Rest (50°C for 15min), Saccharification (65°C for 60min), Mash Out (76°C for 10min).
YEAST: Lager yeast MANDATORY (Wyeast 2124 Bohemian Lager, White Labs WLP830 German Lager, Saflager W-34/70).
FERMENTATION: Cold fermentation MANDATORY (10-12°C / 50-54°F) for 7-10 days. Diacetyl rest at 16-18°C for 2-3 days. Extended lagering instructions MANDATORY (4-8 weeks at 1-3°C / 34-37°F). This is CRITICAL for lager character.
WATER: Soft water profile (low mineral content) typical of Pilsen/Czech region.`;
  }
  // WHEAT BEER (Weissbier)
  else if (styleLower.includes("wheat") || styleLower.includes("weissbier") || styleLower.includes("hefeweizen") || styleLower.includes("wit")) {
    styleInstructions = `STYLE: Wheat Beer / Weissbier
MALT: >50% Wheat Malt MANDATORY. Pilsner or Pale malt for the remainder.
MASH: Consider Ferulic Acid Rest at 43°C (110°F) for 15min (optional but recommended for traditional German style) + Saccharification at 67°C (153°F) for 60min. Ferulic acid rest enhances clove phenols.
HOPS: Low bitterness (10-20 IBU). Noble hops preferred (Hallertau, Tettnang, Saaz).
YEAST: German Wheat yeast MANDATORY (Wyeast 3068 Weihenstephaner, White Labs WLP300 Hefeweizen, Lallemand Munich Classic, Safbrew WB-06). These produce banana (isoamyl acetate) and clove (4-vinyl guaiacol) esters.
FERMENTATION: 18-20°C. Higher temps (20-22°C) increase banana esters, lower temps (16-18°C) increase clove phenols.`;
  }
  // BARLEYWINE
  else if (styleLower.includes("barleywine") || styleLower.includes("barley wine")) {
    styleInstructions = `STYLE: Barleywine
MALT: Huge Grain Bill MANDATORY (Target ABV >9%, OG 1.090-1.120+). Base malt + Crystal malts (10-15%) for complexity. May include small amounts of specialty malts.
BOIL TIME: Long boil MANDATORY (90-120 minutes) for Maillard reactions, color development, and DMS removal. This creates caramelization and complexity.
HOPS: High bitterness (50-100+ IBU) to balance high gravity. English or American hops depending on style.
YEAST: High-gravity yeast (Wyeast 1084 Irish Ale, White Labs WLP099 Super High Gravity, or English Ale strains). High alcohol tolerance required.
FERMENTATION: Start at 18-20°C, allow to rise to 22-24°C. Extended maturation instructions MANDATORY (6-12 months aging recommended). High alcohol tolerance required.
AGING: Must include detailed aging/maturation instructions in notes (e.g., "Age for 6-12 months in bottle or keg at cellar temperature 12-15°C").`;
  }
  // BELGIAN ALE
  else if (styleLower.includes("belgian") || styleLower.includes("saison") || styleLower.includes("tripel") || styleLower.includes("dubbel") || styleLower.includes("quad")) {
    styleInstructions = `STYLE: Belgian Ale
INGREDIENTS: Candi Sugar often used (5-20% of fermentables for high ABV styles like Tripel/Quad). Dark Candi Sugar for Dubbel/Quad. Add to boil.
YEAST: Abbey/Trappist yeast MANDATORY (Wyeast 3787 Trappist High Gravity, White Labs WLP500 Trappist, Safbrew T-58). These produce spicy, phenolic, and fruity esters.
FERMENTATION: Allow free temperature rise up to 24-26°C for ester production. Temperature ramping encouraged (start 18°C, allow to rise naturally to 24-26°C). This is CRITICAL for Belgian character.
HOPS: Noble hops (Saaz, Hallertau) or Styrian Goldings. Low to moderate bitterness.
MALT: Pilsner base malt.`;
  }
  // IPA Styles
  else if (styleLower.includes("ipa") || styleLower.includes("pale ale")) {
    if (styleLower.includes("neipa") || styleLower.includes("hazy") || flavorLower.includes("juicy") || flavorLower.includes("tropical")) {
      styleInstructions = `STYLE: NEIPA/Hazy IPA
MALT: You MUST use Oats (Flaked/Malted) and Wheat (at least 15-20% combined). NO Crystal/Caramel malts (keep color pale, SRM < 4).
HOPS: Minimal bittering (60min, <30 IBU). HUGE Whirlpool additions (below 80°C, 100-200g total) and HUGE Dry Hop additions (100-200g, split into 2 additions if possible).
YEAST: Use specific Hazy strains (Lallemand Verdant IPA, Wyeast 1318 London III, Omega Cosmic Punch, White Labs WLP066 London Fog). NO clean American yeasts like US-05.
WATER: High Chloride-to-Sulfate ratio (2:1 or 3:1). Mention this in notes.
FERMENTATION: Start at 19°C, allow to rise to 21-22°C for ester production.`;
    } else if (styleLower.includes("west coast")) {
      styleInstructions = `STYLE: West Coast IPA
MALT: Pale base (Pilsner or 2-Row), minimal Crystal allowed (max 5%).
HOPS: High bitterness (60min, 40-70 IBU). Strong late boil additions (15min, 5min, flameout). Dry hop optional but recommended.
YEAST: Clean American (Safale US-05, White Labs WLP001, Wyeast 1056).
WATER: High Sulfate-to-Chloride ratio (2:1 or higher) for crisp bitterness.`;
    } else {
      styleInstructions = `STYLE: IPA / Pale Ale
MALT: Pale base with optional Crystal malts (5-10% max for color/body).
HOPS: Moderate to high bitterness. Dry Hop AND Whirlpool additions are MANDATORY for IPAs.
YEAST: Clean American (US-05, WLP001) or Hazy strains if specified.
FERMENTATION: Temperature control critical (18-20°C for clean, 19-22°C for hazy).`;
    }
  }
  // Pale Ale / Amber Ale / Brown Ale
  else if (styleLower.includes("pale ale") || styleLower.includes("amber") || styleLower.includes("brown ale")) {
    styleInstructions = `STYLE: Pale Ale / Amber Ale / Brown Ale
MALT: Balanced profile. Crystal/Caramel malts allowed (5-15% depending on style). Amber uses more Crystal (10-15%), Brown uses Chocolate/Roasted malts (2-5%).
HOPS: Moderate bitterness (25-45 IBU). Balanced hop additions.
YEAST: Clean American or English strains depending on style.
FERMENTATION: 18-20°C for clean profile.`;
  }
  // Default fallback
  else {
    styleInstructions = `STYLE: ${formData.beerStyle}
Follow style-appropriate guidelines. Use specific malts, hops, and yeast for this style.
Maintain balance between malt, hops, and fermentation character.`;
  }

  // Dynamic Prompt Construction
  const prompt = `You are a Certified Cicerone and Master Brewer. Create a detailed, professional beer recipe.

Beer Style: ${formData.beerStyle}
Expertise Level: ${formData.expertise}
Equipment: ${equipmentDescription}
Batch Size: ${formData.batchSize} ${batchSizeUnit}
Flavor Profile: ${formData.flavorProfile}
Target ABV: ${targetABVText}
Target IBU: ${targetIBUText}
Target Color: ${targetEBCText}${ingredientsText}

CRITICAL: You must provide a complete recipe in JSON format.

EQUIPMENT CONSTRAINTS (STRICT - You MUST follow these):
${efficiencyRule}
${mashMethodRule}

EXPERTISE CONSTRAINTS (STRICT - You MUST follow these):
${complexityRule}
${mashScheduleRule}
${yeastRule}
${hopTechniqueRule}

STYLE SPECIFIC RULES (You MUST follow these constraints for ${formData.beerStyle}):

${styleInstructions}

${globalFruitInstruction && !styleLower.includes("sour") && !styleLower.includes("gose") && !styleLower.includes("berliner") && !styleLower.includes("lambic") ? globalFruitInstruction : ""}

${addonRules ? `LOGIC RULES APPLIED (User-selected Add-ons - MANDATORY):
${addonRules}` : ""}

${formData.targetEBC !== "auto" && formData.targetEBC ? `COLOR TARGET (MANDATORY): The user specified a target color of ${formData.targetEBC} EBC. You MUST adjust the malt bill (roasted malts, crystal malts, or specialty malts) to hit this exact color target. Calculate the SRM/EBC contribution of each malt and ensure the final recipe achieves ${formData.targetEBC} EBC.` : ""}

JSON STRUCTURE (Strictly enforce this):
{
  "name": "String",
  "description": "String",
  "specs": {
    "og": "1.xxx", "fg": "1.xxx", "abv": "x.x%", "ibu": "xx", 
    "mash_water": "xx L", "sparge_water": "xx L",
    "pre_boil_gravity": "1.xxx"
  },
  "malts": [
    { "name": "Specific Brand & Malt", "amount": "x kg", "amount_grams": 1000, "percentage": "x%", "explanation": "Why?" }
  ],
  "hops": [
    { 
      "name": "Specific Variety", "amount": "x g", "amount_grams": 10,
      "time": "String (e.g. '60 min', 'Whirlpool', 'Dry Hop')", 
      "boil_time": Number (minutes, 0 for WP/DryHop),
      "alpha": Number, "alpha_acid_base": Number,
      "explanation": "Why?" 
    }
  ],
  "yeast": { "name": "Specific Strain", "amount": "x", "explanation": "Why?" },
  "mash_schedule": [ { "step": "Name", "temp": "67°C", "time": "60 min" } ],
  "instructions": [ "Step 1...", "Step 2..." ],
  "shopping_list": [ { "item": "Name", "category": "malt", "affiliate_link": "url" } ],
  "estimatedTime": "String",
  "notes": "String (MUST start with efficiency note, then style tips)",
  "fermentation_instructions": [ "MANDATORY: Specific temp and duration steps" ]
}
`;

  // OpenAI Call with better error handling
  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-4o", // Changed to strict GPT-4o
      messages: [
        {
          role: "system",
          content: `You are an Award-Winning Master Brewer specialized in advanced Craft Beer recipes.
Your goal is to create complex, competition-worthy recipes that are chemically correct and style-appropriate.

CRITICAL RULES (UNNEGOTIABLE):

1. FERMENTATION STEPS ARE MANDATORY: For EVERY single recipe, you MUST return a populated 'fermentation_instructions' array with specific temperatures and durations. NEVER leave this empty. Include:
   - Pitching temperature
   - Primary fermentation temperature and duration
   - Diacetyl rest (if applicable)
   - Cold crash or conditioning instructions
   - Lagering instructions (for lagers)
   Example: ["Pitch yeast at 18°C", "Ferment at 18-20°C for 7-10 days", "Cold crash to 2°C for 2 days"]

2. NOTES FIELD: You MUST start the 'notes' field with: '${efficiencyNote}'. Then add style-specific tips, water chemistry notes, and brewing advice.

3. MASH: Use multi-step mashing unless style or expertise level forbids it (see user constraints).

4. HOPS: Use Whirlpool & Dry Hop for IPAs. 'time' field is a STRING (e.g., "60 min", "Whirlpool", "Dry Hop - Day 3").

5. NO GENERIC NAMES: Use "Weyermann Barke Pilsner", "Citra", "Wyeast 1318 London III". NEVER use "Base Malt", "Bittering Hop", etc.

6. EXPLANATIONS: Explain every ingredient choice (malts, hops, yeast) - WHY it's used.

7. GRAIN BILL EXPLANATION: In the 'notes' field, explain why the grain bill is sized as it is (e.g., "Higher grain bill compensates for 65% BIAB efficiency" or "Standard grain bill for 80% efficiency system").

8. FORMAT: JSON ONLY. No markdown blocks.`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.6, // Slightly higher for creativity within constraints
      max_tokens: 3500,
    });
  } catch (openaiError: any) {
    console.error("OpenAI API Error:", {
      code: openaiError?.code,
      type: openaiError?.type,
      message: openaiError?.message,
      status: openaiError?.status,
    });
    
    // Provide more specific error messages
    if (openaiError?.code === "invalid_api_key") {
      throw new Error("OpenAI API key is invalid. Please check your .env.local file and ensure the key starts with 'sk-' and has no extra spaces.");
    }
    if (openaiError?.status === 429) {
      throw new Error("OpenAI API rate limit exceeded. Please try again in a moment.");
    }
    if (openaiError?.status === 401) {
      throw new Error("OpenAI API authentication failed. Please check your API key.");
    }
    
    throw new Error(`OpenAI API error: ${openaiError?.message || "Unknown error"}`);
  }

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  // Parse JSON response (remove markdown code blocks if present)
  // This regex is more robust to handle ```json at start or end
  const jsonString = content.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
  
  try {
    const recipe = JSON.parse(jsonString);
    return recipe;
  } catch (parseError) {
    console.error("JSON Parse Error. Content received:", content);
    throw new Error("AI generated invalid JSON. Please try again.");
  }
}