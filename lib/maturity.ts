/**
 * Maturity calculation utilities for beer batches
 */

export interface MaturityInfo {
  daysMin: number;
  daysMax: number;
  readyDate: Date;
  expiryDate: Date;
  daysSinceBottling: number;
  daysUntilReady: number;
  daysUntilExpiry: number;
  status: "maturing" | "optimal" | "overaged";
  statusColor: "yellow" | "green" | "red";
}

/**
 * Calculate maturity days based on beer style (fallback if recipe doesn't have conditioning_days)
 * Returns {min, max} days needed for optimal drinking
 */
export function getMaturityDaysFallback(beerStyle: string | undefined): { min: number; max: number } {
  if (!beerStyle) return { min: 28, max: 90 }; // Default 4 weeks min, 3 months max
  
  const styleLower = beerStyle.toLowerCase();
  
  // Quick-maturing styles (2-3 weeks min, 2-3 months max)
  if (styleLower.match(/(pale ale|ipa|wheat|wit|hefeweizen|kölsch|cream ale|blonde)/)) {
    return { min: 14, max: 60 };
  }
  
  // Standard styles (3-4 weeks min, 3-4 months max)
  if (styleLower.match(/(amber|brown|porter|stout|esb|bitter)/)) {
    return { min: 21, max: 90 };
  }
  
  // Longer-maturing styles (4-6 weeks min, 4-6 months max)
  if (styleLower.match(/(lager|pilsner|bock|doppelbock|marzen|oktoberfest)/)) {
    return { min: 28, max: 120 };
  }
  
  // High ABV / Complex styles (8-12 weeks min, 6-12 months max)
  if (styleLower.match(/(barleywine|imperial|double|triple|quad|belgian strong|old ale)/)) {
    return { min: 70, max: 180 };
  }
  
  // Sour / Wild (3-6 months min, 12+ months max)
  if (styleLower.match(/(sour|wild|lambic|gueuze|berliner weisse)/)) {
    return { min: 90, max: 365 };
  }
  
  // Default: 4 weeks min, 3 months max
  return { min: 28, max: 90 };
}

/**
 * Calculate maturity status for a batch using recipe conditioning days
 */
export function calculateMaturity(
  bottledDate: Date | undefined,
  conditioningDaysMin?: number,
  conditioningDaysMax?: number,
  beerStyle?: string
): MaturityInfo | null {
  if (!bottledDate) return null;
  
  // Use recipe values if available, otherwise fallback to style-based calculation
  const { min, max } = conditioningDaysMin !== undefined && conditioningDaysMax !== undefined
    ? { min: conditioningDaysMin, max: conditioningDaysMax }
    : getMaturityDaysFallback(beerStyle);
  
  const readyDate = new Date(bottledDate);
  readyDate.setDate(readyDate.getDate() + min);
  
  const expiryDate = new Date(bottledDate);
  expiryDate.setDate(expiryDate.getDate() + max);
  
  const now = new Date();
  const daysSinceBottling = Math.floor((now.getTime() - bottledDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysUntilReady = min - daysSinceBottling;
  const daysUntilExpiry = max - daysSinceBottling;
  
  let status: "maturing" | "optimal" | "overaged";
  let statusColor: "yellow" | "green" | "red";
  
  if (daysSinceBottling < min) {
    // Still maturing - before min days
    status = "maturing";
    statusColor = "yellow";
  } else if (daysSinceBottling <= max) {
    // Optimal window - between min and max
    status = "optimal";
    statusColor = "green";
  } else {
    // Overaged - past max days
    status = "overaged";
    statusColor = "red";
  }
  
  return {
    daysMin: min,
    daysMax: max,
    readyDate,
    expiryDate,
    daysSinceBottling,
    daysUntilReady,
    daysUntilExpiry,
    status,
    statusColor,
  };
}

