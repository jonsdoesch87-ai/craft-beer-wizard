// Chemische Konstanten für Brausalze (Effekt von 1g auf 10 Liter)
// Quelle: Standard Brewing Water Formulas
const SALT_EFFECTS = {
  gypsum: { name: "Gypsum (CaSO4)", ca: 23.3, so4: 55.8, cl: 0, mg: 0, na: 0, hco3: 0 },
  cacl2: { name: "Calcium Chloride (CaCl2)", ca: 27.2, cl: 48.2, so4: 0, mg: 0, na: 0, hco3: 0 },
  epsom: { name: "Epsom Salt (MgSO4)", mg: 9.9, so4: 39.0, ca: 0, cl: 0, na: 0, hco3: 0 },
  salt: { name: "Table Salt (NaCl)", na: 39.3, cl: 60.7, ca: 0, mg: 0, so4: 0, hco3: 0 },
  baking_soda: { name: "Baking Soda (NaHCO3)", na: 27.4, hco3: 72.8, ca: 0, mg: 0, so4: 0, cl: 0 },
};

export interface WaterProfile {
  ca: number;
  mg: number;
  na: number;
  cl: number;
  so4: number;
  hco3: number;
}

export interface Addition {
  name: string;
  amount: number; // in grams or ml
  unit: string;
  type: "water_agent";
  use: "Mash";
  description: string;
}

/**
 * Berechnet die benötigten Wasserzusätze, um von einem Quellwasser-Profil zu einem Ziel-Profil zu gelangen.
 * 
 * @param source - Quellwasser-Profil (kann unvollständig sein, fehlende Werte werden als 0 angenommen)
 * @param target - Zielwasser-Profil
 * @param batchSizeLiters - Batch-Größe in Litern
 * @returns Array von Wasserzusätzen
 */
export function calculateWaterAdditions(
  source: Partial<WaterProfile>,
  target: Partial<WaterProfile>,
  batchSizeLiters: number
): Addition[] {
  const additions: Addition[] = [];
  const volumeFactor = batchSizeLiters / 10; // Formeln basieren auf 10L

  // Normalisiere fehlende Werte zu 0
  const sourceProfile: WaterProfile = {
    ca: source.ca ?? 0,
    mg: source.mg ?? 0,
    na: source.na ?? 0,
    cl: source.cl ?? 0,
    so4: source.so4 ?? 0,
    hco3: source.hco3 ?? 0,
  };

  const targetProfile: WaterProfile = {
    ca: target.ca ?? 0,
    mg: target.mg ?? 0,
    na: target.na ?? 0,
    cl: target.cl ?? 0,
    so4: target.so4 ?? 0,
    hco3: target.hco3 ?? 0,
  };

  // 1. Calculate Deltas (Was fehlt?)
  // Wir priorisieren Sulfat und Chlorid für den Geschmack, Calcium kommt meist automatisch mit.
  let neededSO4 = Math.max(0, targetProfile.so4 - sourceProfile.so4);
  let neededCl = Math.max(0, targetProfile.cl - sourceProfile.cl);
  let neededMg = Math.max(0, targetProfile.mg - sourceProfile.mg);
  let neededCa = Math.max(0, targetProfile.ca - sourceProfile.ca);

  // 2. Add Gypsum (CaSO4) for Sulfate
  // 1g/10L bringt 55.8 ppm SO4 und 23.3 ppm Ca
  if (neededSO4 > 0) {
    const gramsGypsum10L = neededSO4 / SALT_EFFECTS.gypsum.so4;
    const totalGypsum = gramsGypsum10L * volumeFactor;
    if (totalGypsum > 0.5) {
      additions.push({
        name: "Gypsum (CaSO4)",
        amount: parseFloat(totalGypsum.toFixed(1)),
        unit: "g",
        type: "water_agent",
        use: "Mash",
        description: `Raises Sulfate by ~${neededSO4.toFixed(0)}ppm for bitterness/crispness.`,
      });
      // Update Source State (Virtual) - Gypsum bringt auch Ca
      neededSO4 = 0; // Erledigt
      neededCa = Math.max(0, neededCa - (gramsGypsum10L * SALT_EFFECTS.gypsum.ca));
    }
  }

  // 3. Add Calcium Chloride (CaCl2) for Chloride
  // 1g/10L bringt 48.2 ppm Cl und 27.2 ppm Ca
  if (neededCl > 0) {
    const gramsCaCl10L = neededCl / SALT_EFFECTS.cacl2.cl;
    const totalCaCl = gramsCaCl10L * volumeFactor;
    if (totalCaCl > 0.5) {
      additions.push({
        name: "Calcium Chloride (CaCl2)",
        amount: parseFloat(totalCaCl.toFixed(1)),
        unit: "g",
        type: "water_agent",
        use: "Mash",
        description: `Raises Chloride by ~${neededCl.toFixed(0)}ppm for maltiness.`,
      });
      // Update Source State (Virtual) - CaCl2 bringt auch Ca
      neededCa = Math.max(0, neededCa - (gramsCaCl10L * SALT_EFFECTS.cacl2.ca));
    }
  }

  // 4. Add Epsom Salt (MgSO4) for Magnesium (falls noch nötig)
  // 1g/10L bringt 9.9 ppm Mg und 39.0 ppm SO4
  if (neededMg > 0) {
    const gramsEpsom10L = neededMg / SALT_EFFECTS.epsom.mg;
    const totalEpsom = gramsEpsom10L * volumeFactor;
    if (totalEpsom > 0.5) {
      additions.push({
        name: "Epsom Salt (MgSO4)",
        amount: parseFloat(totalEpsom.toFixed(1)),
        unit: "g",
        type: "water_agent",
        use: "Mash",
        description: `Raises Magnesium by ~${neededMg.toFixed(0)}ppm.`,
      });
    }
  }

  // 5. Acidification (Simple Lactic Acid Estimation)
  // Faustformel: Falls Bicarbonat (HCO3) im Quellwasser hoch ist (>60) und wir niedrigeres Ziel haben.
  // 1ml 80% Lactic Acid neutralisiert ca. 300mg HCO3 in 10L (grobe Näherung).
  if (sourceProfile.hco3 > 60 && targetProfile.hco3 < sourceProfile.hco3) {
    const hco3Reduction = sourceProfile.hco3 - targetProfile.hco3;
    // Sehr grobe Näherung: 1ml/10L neutralisiert ~300mg HCO3 = ~300ppm bei 1L, also ~30ppm bei 10L
    // Sicherere Formel: ~0.002ml pro ppm HCO3 Reduktion pro Liter
    const acidAmount = hco3Reduction * 0.002 * batchSizeLiters;
    if (acidAmount > 0.5) {
      additions.push({
        name: "Lactic Acid 80%",
        amount: parseFloat(acidAmount.toFixed(1)),
        unit: "ml",
        type: "water_agent",
        use: "Mash",
        description: `Reduces alkalinity by ~${hco3Reduction.toFixed(0)}ppm (pH adjustment).`,
      });
    }
  }

  return additions;
}


