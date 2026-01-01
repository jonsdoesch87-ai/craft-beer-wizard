/**
 * BeerXML Export Utility
 * Converts recipe data to BeerXML v1.0 format (compatible with Grainfather, Brewfather, etc.)
 */

import { Recipe } from "@/components/RecipeCard";

/**
 * Escape XML special characters
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Convert volume string to liters (BeerXML standard)
 * Handles: "20L", "20 L", "5.3 gal", "5.3gal", etc.
 */
function parseVolumeToLiters(volumeStr: string | undefined, units: "metric" | "imperial" = "metric"): number {
  if (!volumeStr) return 20; // Default 20L
  
  const cleaned = volumeStr.trim().toLowerCase();
  const match = cleaned.match(/([\d.]+)\s*(l|liter|liters|gal|gallon|gallons)/);
  
  if (!match) {
    // Try to parse as pure number
    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      return units === "imperial" ? num * 3.78541 : num; // Convert gallons to liters
    }
    return 20; // Default fallback
  }
  
  const value = parseFloat(match[1]);
  const unit = match[2];
  
  if (unit.startsWith("gal")) {
    return value * 3.78541; // Convert gallons to liters
  }
  return value; // Already in liters
}

/**
 * Convert weight string to kilograms (BeerXML standard)
 * Handles: "5kg", "5000g", "11 lbs", etc.
 */
function parseWeightToKilograms(weightStr: string | number | undefined): number {
  if (typeof weightStr === "number") {
    // Assume it's already in grams, convert to kg
    return weightStr / 1000;
  }
  
  if (!weightStr) return 0;
  
  const cleaned = String(weightStr).trim().toLowerCase();
  const match = cleaned.match(/([\d.]+)\s*(kg|kilogram|kilograms|g|gram|grams|lb|lbs|pound|pounds|oz|ounce|ounces)/);
  
  if (!match) {
    // Try to parse as pure number (assume grams)
    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      return num / 1000; // Assume grams, convert to kg
    }
    return 0;
  }
  
  const value = parseFloat(match[1]);
  const unit = match[2];
  
  if (unit.startsWith("kg")) {
    return value;
  } else if (unit.startsWith("g")) {
    return value / 1000;
  } else if (unit.startsWith("lb") || unit.startsWith("pound")) {
    return value * 0.453592; // Convert pounds to kg
  } else if (unit.startsWith("oz")) {
    return value * 0.0283495; // Convert ounces to kg
  }
  
  return value / 1000; // Default: assume grams
}

/**
 * Parse temperature string to absolute Celsius temperature
 * Handles: "68°C", "68 C", "154°F", "154 F", etc.
 * IMPORTANT: Returns absolute temperature, NOT a difference value.
 * If the string contains "+" or "-" as a prefix, it's treated as a difference and returns 0 (invalid).
 */
function parseTempToCelsius(tempStr: string | undefined): number | null {
  if (!tempStr) return null;
  
  const cleaned = tempStr.trim();
  
  // Check if it's a difference value (starts with + or -)
  // These should not be used as absolute temperatures
  if (cleaned.startsWith("+") || cleaned.startsWith("-")) {
    // This is a difference value, not an absolute temperature
    // Return null to indicate it needs to be calculated from a base temp
    return null;
  }
  
  // Check for "Target Mash Temp + 3°C" or similar patterns
  if (cleaned.toLowerCase().includes("target") || cleaned.toLowerCase().includes("+")) {
    // This is a relative temperature, not absolute
    return null;
  }
  
  const match = cleaned.match(/([\d.]+)\s*[°]?\s*(c|f|celsius|fahrenheit)/i);
  
  if (!match) {
    // Try to parse as pure number (assume Celsius)
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num > 0 && num < 200) {
      // Reasonable temperature range (0-200°C)
      return num;
    }
    return null;
  }
  
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  
  if (unit.startsWith("f")) {
    const celsius = (value - 32) * 5 / 9;
    // Validate reasonable range
    if (celsius > 0 && celsius < 200) {
      return celsius;
    }
    return null;
  }
  
  // Validate reasonable range for Celsius
  if (value > 0 && value < 200) {
    return value;
  }
  return null;
}

/**
 * Parse time string to minutes
 * Handles: "60 min", "1 hour", "90", etc.
 */
function parseTimeToMinutes(timeStr: string | undefined): number {
  if (!timeStr) return 0;
  
  const cleaned = timeStr.trim().toLowerCase();
  const match = cleaned.match(/([\d.]+)\s*(min|minute|minutes|h|hour|hours)/);
  
  if (!match) {
    // Try to parse as pure number (assume minutes)
    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      return num;
    }
    return 0;
  }
  
  const value = parseFloat(match[1]);
  const unit = match[2];
  
  if (unit.startsWith("h")) {
    return value * 60; // Convert hours to minutes
  }
  return value; // Already minutes
}

/**
 * Parse gravity string to specific gravity
 * Handles: "1.050", "1.050 SG", "12.5°P", "12.5 P", etc.
 */
function parseGravityToSG(gravityStr: string | undefined): number {
  if (!gravityStr) return 1.050; // Default
  
  const cleaned = gravityStr.trim();
  
  // Check for Plato/Brix format
  const platoMatch = cleaned.match(/([\d.]+)\s*[°]?\s*(p|plato|brix|bx)/i);
  if (platoMatch) {
    const plato = parseFloat(platoMatch[1]);
    // Convert Plato to SG: SG = 1 + (Plato / (258.6 - (Plato / 258.2) * 227.1))
    return 1 + (plato / (258.6 - (plato / 258.2) * 227.1));
  }
  
  // Check for SG format
  const sgMatch = cleaned.match(/(1\.\d{3})/);
  if (sgMatch) {
    return parseFloat(sgMatch[1]);
  }
  
  // Try to parse as number (assume SG if > 1, Plato if < 20)
  const num = parseFloat(cleaned);
  if (!isNaN(num)) {
    if (num > 1 && num < 2) {
      return num; // Already SG
    } else if (num < 30) {
      // Assume Plato
      return 1 + (num / (258.6 - (num / 258.2) * 227.1));
    }
  }
  
  return 1.050; // Default fallback
}

/**
 * Export recipe to BeerXML format
 */
export function exportToBeerXML(recipe: Recipe, units: "metric" | "imperial" = "metric"): string {
  const recipeName = escapeXml(recipe.name || "Untitled Recipe");
  const recipeDescription = escapeXml(recipe.description || "");
  
  // Parse batch size (default 20L)
  // IMPORTANT: BeerXML requires volumes in liters
  const batchSize = parseVolumeToLiters(recipe.specs?.mash_water_volume || recipe.specs?.mash_water || "20", units);
  
  // Validate batch size is in liters (BeerXML requirement)
  if (batchSize <= 0 || batchSize > 10000) {
    throw new Error(`Invalid batch size: ${batchSize}L. Must be between 0 and 10000 liters.`);
  }
  
  // Parse OG and FG
  const og = parseGravityToSG(recipe.specs?.original_gravity || recipe.specs?.og || recipe.originalGravity || "1.050");
  const fg = parseGravityToSG(recipe.specs?.final_gravity || recipe.specs?.fg || recipe.finalGravity || "1.010");
  
  // Parse ABV
  const abv = parseFloat(recipe.specs?.abv || recipe.abv || "5.0") || 5.0;
  
  // Parse IBU
  const ibu = parseFloat(recipe.specs?.ibu || recipe.ibu || "30") || 30;
  
  // Parse SRM
  const srm = parseFloat(recipe.specs?.srm || recipe.srm || "8") || 8;
  
  // Get malts
  const malts = recipe.malts || recipe.ingredients?.malts || [];
  
  // Get hops
  const hops = recipe.hops || recipe.ingredients?.hops || [];
  
  // Get yeast
  const yeast = recipe.yeast || recipe.ingredients?.yeast;
  
  // Get mash schedule
  const mashSchedule = recipe.mash_schedule || recipe.mash_steps || [];
  
  // Build XML
  let xml = `<?xml version="1.0" encoding="ISO-8859-1"?>\n`;
  xml += `<RECIPES>\n`;
  xml += `  <RECIPE>\n`;
  xml += `    <NAME>${recipeName}</NAME>\n`;
  xml += `    <VERSION>1</VERSION>\n`;
  xml += `    <TYPE>All Grain</TYPE>\n`;
  xml += `    <BREWER>${escapeXml("Craft Beer Wizard")}</BREWER>\n`;
  xml += `    <ASST_BREWER></ASST_BREWER>\n`;
  // IMPORTANT: BeerXML requires volumes in liters
  xml += `    <BATCH_SIZE>${batchSize.toFixed(2)}</BATCH_SIZE>\n`;
  // BOIL_SIZE should be slightly larger than batch size (accounting for boil-off)
  xml += `    <BOIL_SIZE>${(batchSize * 1.1).toFixed(2)}</BOIL_SIZE>\n`;
  xml += `    <BOIL_TIME>60</BOIL_TIME>\n`;
  xml += `    <EFFICIENCY>75.0</EFFICIENCY>\n`;
  
  // Style (if available)
  xml += `    <STYLE>\n`;
  xml += `      <NAME>${recipeName}</NAME>\n`;
  xml += `      <CATEGORY>Ale</CATEGORY>\n`;
  xml += `      <CATEGORY_NUMBER>1</CATEGORY_NUMBER>\n`;
  xml += `      <STYLE_LETTER>A</STYLE_LETTER>\n`;
  xml += `      <STYLE_GUIDE>BJCP 2021</STYLE_GUIDE>\n`;
  xml += `      <TYPE>Ale</TYPE>\n`;
  xml += `      <OG_MIN>${(og - 0.010).toFixed(3)}</OG_MIN>\n`;
  xml += `      <OG_MAX>${(og + 0.010).toFixed(3)}</OG_MAX>\n`;
  xml += `      <FG_MIN>${(fg - 0.005).toFixed(3)}</FG_MIN>\n`;
  xml += `      <FG_MAX>${(fg + 0.005).toFixed(3)}</FG_MAX>\n`;
  xml += `      <IBU_MIN>${Math.max(0, ibu - 10).toFixed(1)}</IBU_MIN>\n`;
  xml += `      <IBU_MAX>${(ibu + 10).toFixed(1)}</IBU_MAX>\n`;
  xml += `      <COLOR_MIN>${Math.max(0, srm - 2).toFixed(1)}</COLOR_MIN>\n`;
  xml += `      <COLOR_MAX>${(srm + 2).toFixed(1)}</COLOR_MAX>\n`;
  xml += `      <ABV_MIN>${Math.max(0, abv - 1).toFixed(1)}</ABV_MIN>\n`;
  xml += `      <ABV_MAX>${(abv + 1).toFixed(1)}</ABV_MAX>\n`;
  xml += `      <CARB_MIN>2.0</CARB_MIN>\n`;
  xml += `      <CARB_MAX>2.6</CARB_MAX>\n`;
  xml += `    </STYLE>\n`;
  
  // Fermentables (Malts)
  xml += `    <FERMENTABLES>\n`;
  malts.forEach((malt) => {
    const amountKg = parseWeightToKilograms(malt.amount_grams || malt.amount);
    const name = escapeXml(malt.name || "Unknown Malt");
    xml += `      <FERMENTABLE>\n`;
    xml += `        <NAME>${name}</NAME>\n`;
    xml += `        <VERSION>1</VERSION>\n`;
    xml += `        <TYPE>Grain</TYPE>\n`;
    xml += `        <AMOUNT>${amountKg.toFixed(4)}</AMOUNT>\n`;
    xml += `        <YIELD>78.0</YIELD>\n`;
    xml += `        <COLOR>3.0</COLOR>\n`;
    xml += `        <ADD_AFTER_BOIL>N</ADD_AFTER_BOIL>\n`;
    xml += `        <ORIGIN></ORIGIN>\n`;
    xml += `        <SUPPLIER></SUPPLIER>\n`;
    xml += `        <NOTES></NOTES>\n`;
    xml += `        <COARSE_FINE_DIFF>0.0</COARSE_FINE_DIFF>\n`;
    xml += `        <MOISTURE>4.0</MOISTURE>\n`;
    xml += `        <DIASTATIC_POWER>0.0</DIASTATIC_POWER>\n`;
    xml += `        <PROTEIN>0.0</PROTEIN>\n`;
    xml += `        <MAX_IN_BATCH>100.0</MAX_IN_BATCH>\n`;
    xml += `        <RECOMMEND_MASH>Y</RECOMMEND_MASH>\n`;
    xml += `        <IBU_GAL_PER_LB>0.0</IBU_GAL_PER_LB>\n`;
    xml += `      </FERMENTABLE>\n`;
  });
  xml += `    </FERMENTABLES>\n`;
  
  // Hops
  xml += `    <HOPS>\n`;
  hops.forEach((hop) => {
    const amountKg = parseWeightToKilograms(hop.amount_grams || hop.amount);
    // Validate: Ensure weight is in kg (BeerXML requirement)
    if (amountKg <= 0 || amountKg > 100) {
      console.warn(`Invalid hop weight: ${amountKg} kg. Skipping hop: ${hop.name}`);
      return; // Skip invalid entries
    }
    const name = escapeXml(hop.name || "Unknown Hop");
    const alpha = typeof hop.alpha === "number" ? hop.alpha : parseFloat(String(hop.alpha || "5.0")) || 5.0;
    const time = hop.boil_time || parseTimeToMinutes(hop.time);
    const use = time > 0 ? "Boil" : (hop.time?.toLowerCase().includes("dry") ? "Dry Hop" : "Aroma");
    
    xml += `      <HOP>\n`;
    xml += `        <NAME>${name}</NAME>\n`;
    xml += `        <VERSION>1</VERSION>\n`;
    xml += `        <ALPHA>${alpha.toFixed(1)}</ALPHA>\n`;
    xml += `        <AMOUNT>${amountKg.toFixed(4)}</AMOUNT>\n`;
    xml += `        <USE>${use}</USE>\n`;
    xml += `        <TIME>${time}</TIME>\n`;
    xml += `        <NOTES>${escapeXml(hop.explanation || hop.time || "")}</NOTES>\n`;
    xml += `        <TYPE>Pellet</TYPE>\n`;
    xml += `        <FORM>Pellet</FORM>\n`;
    xml += `        <BETA>0.0</BETA>\n`;
    xml += `        <HSI>0.0</HSI>\n`;
    xml += `        <ORIGIN></ORIGIN>\n`;
    xml += `        <SUBSTITUTES></SUBSTITUTES>\n`;
    xml += `        <HUMULENE>0.0</HUMULENE>\n`;
    xml += `        <CARYOPHYLLENE>0.0</CARYOPHYLLENE>\n`;
    xml += `        <COHUMULONE>0.0</COHUMULONE>\n`;
    xml += `        <MYRCENE>0.0</MYRCENE>\n`;
    xml += `      </HOP>\n`;
  });
  xml += `    </HOPS>\n`;
  
  // Yeast
  if (yeast) {
    xml += `    <YEASTS>\n`;
    xml += `      <YEAST>\n`;
    xml += `        <NAME>${escapeXml(yeast.name || "Unknown Yeast")}</NAME>\n`;
    xml += `        <VERSION>1</VERSION>\n`;
    xml += `        <TYPE>Ale</TYPE>\n`;
    xml += `        <FORM>Liquid</FORM>\n`;
    xml += `        <AMOUNT>0.0</AMOUNT>\n`;
    xml += `        <AMOUNT_IS_WEIGHT>N</AMOUNT_IS_WEIGHT>\n`;
    xml += `        <LABORATORY></LABORATORY>\n`;
    xml += `        <PRODUCT_ID></PRODUCT_ID>\n`;
    xml += `        <MIN_TEMPERATURE>18.0</MIN_TEMPERATURE>\n`;
    xml += `        <MAX_TEMPERATURE>22.0</MAX_TEMPERATURE>\n`;
    xml += `        <FLOCCULATION>Medium</FLOCCULATION>\n`;
    xml += `        <ATTENUATION>75.0</ATTENUATION>\n`;
    xml += `        <NOTES>${escapeXml(yeast.explanation || "")}</NOTES>\n`;
    xml += `        <BEST_FOR></BEST_FOR>\n`;
    xml += `        <MAX_REUSE>0</MAX_REUSE>\n`;
    xml += `      </YEAST>\n`;
    xml += `    </YEASTS>\n`;
  }
  
  // Mash Schedule
  if (mashSchedule.length > 0) {
    xml += `    <MASH>\n`;
    xml += `      <NAME>Temperature Mash</NAME>\n`;
    xml += `      <VERSION>1</VERSION>\n`;
    xml += `      <GRAIN_TEMP>20.0</GRAIN_TEMP>\n`;
    xml += `      <MASH_STEPS>\n`;
    
    // First pass: Find the first Saccharification step (main mash rest) to calculate Mash In strike temp
    let firstSaccharificationTemp: number | null = null;
    mashSchedule.forEach((step) => {
      const stepName = (step.step || "").toLowerCase();
      // Look for main mash steps (not Mash In/Out)
      if (!stepName.includes("mash in") && !stepName.includes("einmaischen") && 
          !stepName.includes("mash out") && !stepName.includes("abmaischen")) {
        const temp = parseTempToCelsius(step.temp);
        if (temp !== null && firstSaccharificationTemp === null) {
          firstSaccharificationTemp = temp;
        }
      }
    });
    
    // If no saccharification step found, try to find any valid temperature
    if (firstSaccharificationTemp === null) {
      mashSchedule.forEach((step) => {
        const temp = parseTempToCelsius(step.temp);
        if (temp !== null && firstSaccharificationTemp === null) {
          firstSaccharificationTemp = temp;
        }
      });
    }
    
    // Default to 68°C if no temperature found
    const baseTemp = firstSaccharificationTemp ?? 68.0;
    
    // Process mash steps
    mashSchedule.forEach((step) => {
      const stepName = (step.step || "").toLowerCase();
      const stepNameEscaped = escapeXml(step.step || "Mash Step");
      const time = parseTimeToMinutes(step.time);
      
      let stepTemp: number;
      const parsedTemp = parseTempToCelsius(step.temp);
      
      // Handle "Mash In" step: Add 3°C to first saccharification temp
      if (stepName.includes("mash in") || stepName.includes("einmaischen")) {
        if (parsedTemp !== null) {
          // If absolute temp is provided, use it
          stepTemp = parsedTemp;
        } else {
          // Calculate strike temp: first saccharification + 3°C
          stepTemp = baseTemp + 3.0;
        }
      } else {
        // For all other steps, use absolute temperature
        if (parsedTemp !== null) {
          stepTemp = parsedTemp;
        } else {
          // Fallback: if temp string contains "+" or relative reference, use first saccharification temp
          // This handles cases like "Target Mash Temp + 3°C"
          stepTemp = baseTemp;
        }
      }
      
      // Validate temperature is in reasonable range
      if (stepTemp < 0 || stepTemp > 200) {
        stepTemp = baseTemp; // Fallback to safe value
      }
      
      xml += `        <MASH_STEP>\n`;
      xml += `          <NAME>${stepNameEscaped}</NAME>\n`;
      xml += `          <VERSION>1</VERSION>\n`;
      xml += `          <TYPE>Infusion</TYPE>\n`;
      xml += `          <AMOUNT>0.0</AMOUNT>\n`;
      xml += `          <STEP_TEMP>${stepTemp.toFixed(1)}</STEP_TEMP>\n`;
      xml += `          <STEP_TIME>${time}</STEP_TIME>\n`;
      xml += `          <RAMP_TIME>2</RAMP_TIME>\n`;
      xml += `          <END_TEMP>${stepTemp.toFixed(1)}</END_TEMP>\n`;
      xml += `          <DESCRIPTION>${escapeXml(step.description || "")}</DESCRIPTION>\n`;
      xml += `        </MASH_STEP>\n`;
    });
    
    xml += `      </MASH_STEPS>\n`;
    xml += `      <NOTES>${escapeXml(recipeDescription)}</NOTES>\n`;
    xml += `      <TUN_TEMP>20.0</TUN_TEMP>\n`;
    xml += `      <SPARGE_TEMP>75.6</SPARGE_TEMP>\n`;
    xml += `      <PH>5.4</PH>\n`;
    xml += `      <TUN_WEIGHT>0.0</TUN_WEIGHT>\n`;
    xml += `      <TUN_SPECIFIC_HEAT>0.0</TUN_SPECIFIC_HEAT>\n`;
    xml += `      <EQUIP_ADJUST>false</EQUIP_ADJUST>\n`;
    xml += `    </MASH>\n`;
  }
  
  // Notes
  xml += `    <NOTES>${escapeXml(recipeDescription)}</NOTES>\n`;
  xml += `    <TASTE_NOTES></TASTE_NOTES>\n`;
  xml += `    <TASTE_RATING>0</TASTE_RATING>\n`;
  xml += `    <OG>${og.toFixed(3)}</OG>\n`;
  xml += `    <FG>${fg.toFixed(3)}</FG>\n`;
  xml += `    <FERMENTATION_STAGES>1</FERMENTATION_STAGES>\n`;
  xml += `    <PRIMARY_AGE>7</PRIMARY_AGE>\n`;
  xml += `    <PRIMARY_TEMP>20.0</PRIMARY_TEMP>\n`;
  xml += `    <SECONDARY_AGE>14</SECONDARY_AGE>\n`;
  xml += `    <SECONDARY_TEMP>20.0</SECONDARY_TEMP>\n`;
  xml += `    <TERTIARY_AGE>0</TERTIARY_AGE>\n`;
  xml += `    <TERTIARY_TEMP>0.0</TERTIARY_TEMP>\n`;
  xml += `    <AGE>21</AGE>\n`;
  xml += `    <AGE_TEMP>20.0</AGE_TEMP>\n`;
  xml += `    <CARBONATION>2.4</CARBONATION>\n`;
  xml += `    <FORCED_CARBONATION>false</FORCED_CARBONATION>\n`;
  xml += `    <PRIMING_SUGAR_NAME></PRIMING_SUGAR_NAME>\n`;
  xml += `    <CARBONATION_TEMP>20.0</CARBONATION_TEMP>\n`;
  xml += `    <PRIMING_SUGAR_EQUIV>0.0</PRIMING_SUGAR_EQUIV>\n`;
  xml += `    <KEG_PRIMING_FACTOR>0.5</KEG_PRIMING_FACTOR>\n`;
  xml += `  </RECIPE>\n`;
  xml += `</RECIPES>\n`;
  
  return xml;
}

