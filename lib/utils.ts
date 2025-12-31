import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formatiert Bierfarbe basierend auf Einheiten (SRM für Imperial, EBC für Metric)
 * @param srmString - SRM-Wert als String oder Number
 * @param units - "metric" für EBC, "imperial" für SRM
 * @returns Formatierter String (z.B. "6 EBC" oder "3 SRM")
 */
export function formatBeerColor(srmString: string | number, units: "metric" | "imperial" = "metric"): string {
  const srm = Number(srmString);
  if (isNaN(srm)) return "N/A";
  
  if (units === "imperial") {
    return `${Math.round(srm)} SRM`;
  } else {
    // EBC Calculation: EBC = SRM * 1.97
    const ebc = Math.round(srm * 1.97);
    return `${ebc} EBC`;
  }
}

