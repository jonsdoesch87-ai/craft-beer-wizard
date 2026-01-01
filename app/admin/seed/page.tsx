"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { saveRecipe, publishRecipe } from "@/lib/db";
import { toast } from "sonner";
import { useState } from "react";
import type { RecipeData } from "@/lib/db";

// Demo-Rezepte mit vollständigen V3 Engine Features
const RECIPES_TO_SEED: Omit<RecipeData, "status" | "createdAt">[] = [
  // Rezept A: Neon Haze NEIPA
  {
    name: "Neon Haze NEIPA",
    description: "The Juice Bomb - A hazy, tropical explosion with extreme chloride water profile and massive dry hop additions. This is the modern NEIPA done right.",
    specs: {
      original_gravity: "1.068",
      final_gravity: "1.012",
      abv: "7.4%",
      ibu: "45",
      srm: "4",
      mash_water: "18L",
      sparge_water: "12L",
      brewhouseEfficiency: "75%",
    },
    malts: [
      { name: "Pilsner Malt", amount: "3.5 kg", percentage: "50%", amount_grams: 3500 },
      { name: "Flaked Oats", amount: "1.4 kg", percentage: "20%", amount_grams: 1400 },
      { name: "Flaked Wheat", amount: "1.05 kg", percentage: "15%", amount_grams: 1050 },
      { name: "CaraPils", amount: "0.7 kg", percentage: "10%", amount_grams: 700 },
      { name: "Honey Malt", amount: "0.35 kg", percentage: "5%", amount_grams: 350 },
    ],
    hops: [
      { name: "Citra", amount: "50 g", time: "Whirlpool 20 min", boil_time: 0, alpha: "12.5%", amount_grams: 50 },
      { name: "Mosaic", amount: "50 g", time: "Whirlpool 20 min", boil_time: 0, alpha: "12.0%", amount_grams: 50 },
      { name: "Citra", amount: "100 g", time: "Dry Hop Day 3", boil_time: 0, alpha: "12.5%", amount_grams: 100 },
      { name: "Mosaic", amount: "100 g", time: "Dry Hop Day 3", boil_time: 0, alpha: "12.0%", amount_grams: 100 },
      { name: "Galaxy", amount: "50 g", time: "Dry Hop Day 7", boil_time: 0, alpha: "14.0%", amount_grams: 50 },
    ],
    yeast: {
      name: "London Ale III (WLP066)",
      amount: "1 package",
      explanation: "Classic NEIPA yeast for fruity esters and haze stability",
    },
    extras: [
      {
        name: "Calcium Chloride (CaCl2)",
        amount: 8,
        unit: "g",
        type: "water_agent",
        use: "Mash",
        time: "Mash",
        description: "Raises Chloride by ~150ppm for extreme mouthfeel and maltiness (Cl:SO4 ratio 3:1)",
      },
      {
        name: "Gypsum (CaSO4)",
        amount: 2,
        unit: "g",
        type: "water_agent",
        use: "Mash",
        time: "Mash",
        description: "Adds minimal sulfate for balance (target Cl:SO4 3:1)",
      },
      {
        name: "Rice Hulls",
        amount: 500,
        unit: "g",
        type: "process_aid",
        use: "Mash",
        time: "Mash",
        description: "Prevents stuck sparge with 35% adjuncts (Oats + Wheat)",
      },
      {
        name: "Ascorbic Acid",
        amount: 0.5,
        unit: "g",
        type: "water_agent",
        use: "Bottling",
        time: "Bottling",
        description: "Anti-oxidant to preserve hop aroma and prevent oxidation",
      },
    ],
    mash_schedule: [
      {
        step: "Mash In",
        temp: "68°C",
        time: "15 min",
        description: "Heat strike water to 72°C and mix in grains thoroughly.",
      },
      {
        step: "Beta Amylase Rest",
        temp: "63°C",
        time: "30 min",
        description: "Lower temperature for fermentability and dryness.",
      },
      {
        step: "Alpha Amylase Rest",
        temp: "68°C",
        time: "45 min",
        description: "Raise temperature for body and mouthfeel.",
      },
      {
        step: "Mash Out",
        temp: "78°C",
        time: "10 min",
        description: "Stop enzymatic activity and improve lauter fluidity.",
      },
    ],
    boil_instructions: [
      "Bring wort to a rolling boil (100°C).",
      "No bittering hops - all bitterness from whirlpool.",
      "Boil for 60 minutes to drive off DMS.",
      "Chill to 70°C for whirlpool hop addition.",
    ],
    fermentation_instructions: [
      "Pitch yeast at 18°C and let rise to 20°C.",
      "Ferment at 20°C for 7 days.",
      "Add first dry hop charge on day 3 (during active fermentation).",
      "Add second dry hop charge on day 7 (after fermentation slows).",
      "Cold crash to 4°C for 3 days before packaging.",
      "Package with minimal oxygen exposure.",
    ],
    waterProfile: {
      ca: 120,
      mg: 10,
      na: 20,
      cl: 200,
      so4: 65,
      hco3: 0,
      description: "Extreme Chloride Profile - Cl:SO4 3:1 for maximum mouthfeel",
    },
    estimatedTime: "4-5 hours",
    notes: "This NEIPA uses an extreme chloride water profile (Cl:SO4 3:1) to maximize mouthfeel and maltiness. The massive dry hop additions during active fermentation (biotransformation) create intense tropical fruit flavors. Rice hulls are essential due to the high percentage of flaked adjuncts. Keep oxygen exposure to an absolute minimum throughout the process.",
  },

  // Rezept B: Crisp Boi Pilsner
  {
    name: "Crisp Boi Pilsner",
    description: "The Classic - A traditional German-style Pilsner with soft water profile, step mash, and noble hops. Clean, crisp, and refreshing.",
    specs: {
      original_gravity: "1.048",
      final_gravity: "1.008",
      abv: "5.2%",
      ibu: "35",
      srm: "3",
      mash_water: "16L",
      sparge_water: "14L",
      brewhouseEfficiency: "78%",
    },
    malts: [
      { name: "Pilsner Malt", amount: "4.2 kg", percentage: "100%", amount_grams: 4200 },
    ],
    hops: [
      { name: "Hallertauer Mittelfrüh", amount: "30 g", time: "60 min", boil_time: 60, alpha: "4.5%", amount_grams: 30 },
      { name: "Hallertauer Mittelfrüh", amount: "20 g", time: "30 min", boil_time: 30, alpha: "4.5%", amount_grams: 20 },
      { name: "Saaz", amount: "25 g", time: "15 min", boil_time: 15, alpha: "3.5%", amount_grams: 25 },
      { name: "Saaz", amount: "25 g", time: "0 min", boil_time: 0, alpha: "3.5%", amount_grams: 25 },
    ],
    yeast: {
      name: "German Lager Yeast (WLP830)",
      amount: "1 package",
      explanation: "Classic lager yeast for clean, crisp profile",
    },
    extras: [
      {
        name: "Lactic Acid 80%",
        amount: 2.5,
        unit: "ml",
        type: "water_agent",
        use: "Mash",
        time: "Mash",
        description: "Reduces alkalinity to achieve soft water profile (target pH 5.2-5.4)",
      },
      {
        name: "Irish Moss",
        amount: 1,
        unit: "g",
        type: "process_aid",
        use: "Boil",
        time: "15 min",
        description: "Clarifying agent for brilliant clarity",
      },
    ],
    mash_schedule: [
      {
        step: "Mash In",
        temp: "50°C",
        time: "15 min",
        description: "Heat strike water to 55°C and mix in grains thoroughly.",
      },
      {
        step: "Protein Rest",
        temp: "52°C",
        time: "20 min",
        description: "Break down proteins for better head retention and clarity.",
      },
      {
        step: "Beta Amylase Rest",
        temp: "63°C",
        time: "30 min",
        description: "Lower temperature for fermentability and dryness.",
      },
      {
        step: "Alpha Amylase Rest",
        temp: "72°C",
        time: "30 min",
        description: "Raise temperature for body and conversion.",
      },
      {
        step: "Mash Out",
        temp: "78°C",
        time: "10 min",
        description: "Stop enzymatic activity and improve lauter fluidity.",
      },
    ],
    boil_instructions: [
      "Bring wort to a rolling boil (100°C).",
      "Add bittering hops at 60 minutes.",
      "Add flavor hops at 30 minutes.",
      "Add aroma hops at 15 minutes (with Irish Moss).",
      "Add aroma hops at flameout.",
      "Boil for 60 minutes total.",
    ],
    fermentation_instructions: [
      "Pitch yeast at 10°C.",
      "Ferment at 10-12°C for 2 weeks.",
      "Diacetyl rest at 18°C for 2 days.",
      "Lager at 2°C for 4-6 weeks.",
      "Package and carbonate to 2.5 volumes CO2.",
    ],
    waterProfile: {
      ca: 20,
      mg: 5,
      na: 10,
      cl: 30,
      so4: 25,
      hco3: 0,
      description: "Soft Water Profile - Low minerals for crisp, clean character",
    },
    estimatedTime: "6-7 hours",
    notes: "Traditional German Pilsner requires soft water and a step mash schedule. The protein rest helps achieve brilliant clarity, while the low mineral content allows the noble hop character to shine. Proper lagering is essential for the clean, crisp finish.",
  },

  // Rezept C: Midnight Oil Stout
  {
    name: "Midnight Oil Stout",
    description: "The Dark One - A rich, roasty Imperial Stout with chocolate and coffee notes. Chloride-heavy water profile enhances maltiness and body.",
    specs: {
      original_gravity: "1.092",
      final_gravity: "1.022",
      abv: "9.2%",
      ibu: "65",
      srm: "45",
      mash_water: "22L",
      sparge_water: "18L",
      brewhouseEfficiency: "72%",
    },
    malts: [
      { name: "Maris Otter", amount: "5.5 kg", percentage: "65%", amount_grams: 5500 },
      { name: "Roasted Barley", amount: "0.6 kg", percentage: "7%", amount_grams: 600 },
      { name: "Chocolate Malt", amount: "0.5 kg", percentage: "6%", amount_grams: 500 },
      { name: "Crystal 120L", amount: "0.4 kg", percentage: "5%", amount_grams: 400 },
      { name: "Flaked Barley", amount: "0.4 kg", percentage: "5%", amount_grams: 400 },
      { name: "Black Patent", amount: "0.3 kg", percentage: "4%", amount_grams: 300 },
      { name: "Munich Malt", amount: "0.7 kg", percentage: "8%", amount_grams: 700 },
    ],
    hops: [
      { name: "Magnum", amount: "40 g", time: "60 min", boil_time: 60, alpha: "12.0%", amount_grams: 40 },
      { name: "Fuggles", amount: "30 g", time: "30 min", boil_time: 30, alpha: "4.5%", amount_grams: 30 },
      { name: "East Kent Goldings", amount: "25 g", time: "15 min", boil_time: 15, alpha: "5.0%", amount_grams: 25 },
    ],
    yeast: {
      name: "English Ale Yeast (WLP002)",
      amount: "1 package",
      explanation: "English yeast for fruity esters and malt-forward character",
    },
    extras: [
      {
        name: "Calcium Chloride (CaCl2)",
        amount: 6,
        unit: "g",
        type: "water_agent",
        use: "Mash",
        time: "Mash",
        description: "Raises Chloride by ~110ppm for enhanced maltiness and body",
      },
      {
        name: "Baking Soda (NaHCO3)",
        amount: 3,
        unit: "g",
        type: "water_agent",
        use: "Mash",
        time: "Mash",
        description: "Raises pH to counteract acidity from dark malts (target pH 5.4-5.6)",
      },
      {
        name: "Yeast Nutrient",
        amount: 5,
        unit: "g",
        type: "nutrient",
        use: "Boil",
        time: "10 min",
        description: "Essential for high-gravity fermentation (9.2% ABV)",
      },
    ],
    mash_schedule: [
      {
        step: "Mash In",
        temp: "68°C",
        time: "15 min",
        description: "Heat strike water to 73°C and mix in grains thoroughly.",
      },
      {
        step: "Saccharification Rest",
        temp: "68°C",
        time: "60 min",
        description: "Main conversion rest for body and residual sweetness.",
      },
      {
        step: "Mash Out",
        temp: "78°C",
        time: "10 min",
        description: "Stop enzymatic activity and improve lauter fluidity.",
      },
    ],
    boil_instructions: [
      "Bring wort to a rolling boil (100°C).",
      "Add bittering hops at 60 minutes.",
      "Add flavor hops at 30 minutes.",
      "Add aroma hops at 15 minutes.",
      "Add yeast nutrient at 10 minutes.",
      "Boil for 60 minutes total.",
    ],
    fermentation_instructions: [
      "Pitch yeast at 18°C.",
      "Ferment at 18-20°C for 2 weeks.",
      "Allow temperature to rise to 22°C for final attenuation.",
      "Condition at cellar temperature (12-15°C) for 4-6 weeks.",
      "Age for best results - this beer improves with time.",
    ],
    waterProfile: {
      ca: 100,
      mg: 15,
      na: 50,
      cl: 150,
      so4: 50,
      hco3: 100,
      description: "Chloride-Heavy Profile - Cl:SO4 3:1 for maltiness, elevated HCO3 for dark malt pH balance",
    },
    estimatedTime: "5-6 hours",
    notes: "This Imperial Stout benefits from a chloride-heavy water profile to enhance the rich, malty character. Baking soda helps counteract the acidity from the dark roasted malts. The high ABV requires yeast nutrient for healthy fermentation. This beer ages beautifully - consider cellaring for 3-6 months.",
  },

  // Rezept D: Santa's Little Helper
  {
    name: "Santa's Little Helper",
    description: "Winter Warmer - A spiced holiday ale with high alcohol, warming spices, and lactose for sweetness. Perfect for cold winter nights.",
    specs: {
      original_gravity: "1.078",
      final_gravity: "1.018",
      abv: "7.9%",
      ibu: "28",
      srm: "18",
      mash_water: "20L",
      sparge_water: "15L",
      brewhouseEfficiency: "75%",
    },
    malts: [
      { name: "Maris Otter", amount: "4.5 kg", percentage: "70%", amount_grams: 4500 },
      { name: "Crystal 60L", amount: "0.6 kg", percentage: "9%", amount_grams: 600 },
      { name: "Special B", amount: "0.3 kg", percentage: "5%", amount_grams: 300 },
      { name: "Chocolate Malt", amount: "0.2 kg", percentage: "3%", amount_grams: 200 },
      { name: "Munich Malt", amount: "0.8 kg", percentage: "13%", amount_grams: 800 },
    ],
    hops: [
      { name: "Fuggles", amount: "25 g", time: "60 min", boil_time: 60, alpha: "4.5%", amount_grams: 25 },
      { name: "East Kent Goldings", amount: "20 g", time: "15 min", boil_time: 15, alpha: "5.0%", amount_grams: 20 },
    ],
    yeast: {
      name: "English Ale Yeast (WLP002)",
      amount: "1 package",
      explanation: "English yeast for fruity esters that complement the spices",
    },
    extras: [
      {
        name: "Cinnamon Stick",
        amount: 2,
        unit: "pieces",
        type: "spice",
        use: "Boil",
        time: "5 min",
        description: "Adds warming cinnamon flavor - add at end of boil",
      },
      {
        name: "Orange Peel",
        amount: 15,
        unit: "g",
        type: "spice",
        use: "Boil",
        time: "5 min",
        description: "Dried orange peel for citrus aroma",
      },
      {
        name: "Star Anise",
        amount: 2,
        unit: "pieces",
        type: "spice",
        use: "Boil",
        time: "5 min",
        description: "Licorice-like spice for complexity",
      },
      {
        name: "Lactose",
        amount: 300,
        unit: "g",
        type: "other",
        use: "Boil",
        time: "10 min",
        description: "Non-fermentable sugar adds sweetness and body (target FG 1.018)",
      },
    ],
    mash_schedule: [
      {
        step: "Mash In",
        temp: "68°C",
        time: "15 min",
        description: "Heat strike water to 73°C and mix in grains thoroughly.",
      },
      {
        step: "Saccharification Rest",
        temp: "68°C",
        time: "60 min",
        description: "Main conversion rest for body and residual sweetness.",
      },
      {
        step: "Mash Out",
        temp: "78°C",
        time: "10 min",
        description: "Stop enzymatic activity and improve lauter fluidity.",
      },
    ],
    boil_instructions: [
      "Bring wort to a rolling boil (100°C).",
      "Add bittering hops at 60 minutes.",
      "Add flavor hops at 15 minutes.",
      "Add lactose at 10 minutes.",
      "Add spices (cinnamon, orange peel, star anise) at 5 minutes.",
      "Boil for 60 minutes total.",
    ],
    fermentation_instructions: [
      "Pitch yeast at 18°C.",
      "Ferment at 18-20°C for 2 weeks.",
      "Allow temperature to rise to 22°C for final attenuation.",
      "Condition at cellar temperature (12-15°C) for 2-3 weeks.",
      "Serve slightly warmer (12-14°C) to enhance spice character.",
    ],
    waterProfile: {
      ca: 80,
      mg: 12,
      na: 30,
      cl: 100,
      so4: 40,
      hco3: 50,
      description: "Balanced Profile - Moderate minerals to support malt and spice character",
    },
    estimatedTime: "4-5 hours",
    notes: "This winter warmer combines warming spices with lactose for a sweet, full-bodied holiday ale. The spices should be added at the end of the boil to preserve their delicate aromas. Lactose provides non-fermentable sweetness, resulting in a higher final gravity. Perfect for sharing during the holiday season!",
  },
];

export default function SeedPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if (!user) {
      toast.error("Please login to seed the database");
      return;
    }

    setLoading(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const recipe of RECIPES_TO_SEED) {
        try {
          // 1. Save to My Recipes
          const recipeId = await saveRecipe(user.uid, recipe);
          
          // 2. Publish to Community
          const authorName = user.displayName || "Demo Brewer";
          await publishRecipe(user.uid, recipeId, authorName);
          
          successCount++;
          console.log(`✅ Seeded: ${recipe.name}`);
        } catch (error) {
          console.error(`❌ Failed to seed ${recipe.name}:`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Database seeded! ${successCount} recipes published to Community Hub.`);
      }
      if (errorCount > 0) {
        toast.warning(`${errorCount} recipes failed to seed. Check console for details.`);
      }
    } catch (error) {
      console.error("Seeding error:", error);
      toast.error("Seeding failed. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white p-4">
      <div className="text-center space-y-6 max-w-md">
        <h1 className="text-4xl font-bold text-[#FFBF00]">Database Seeder</h1>
        <p className="text-zinc-400">
          Inject high-quality demo data into the community hub.
        </p>
        <p className="text-sm text-zinc-500">
          This will create 4 professional recipes with V3 Engine features:
          <br />
          • Neon Haze NEIPA (Extreme Chloride Profile)
          <br />
          • Crisp Boi Pilsner (Soft Water, Step Mash)
          <br />
          • Midnight Oil Stout (Chloride-Heavy, High ABV)
          <br />
          • Santa's Little Helper (Winter Warmer with Spices)
        </p>
        <Button
          size="lg"
          onClick={handleSeed}
          disabled={loading || !user}
          className="bg-green-600 hover:bg-green-500 text-white font-bold py-6 px-8 text-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "🌱 Planting..." : "🌱 Plant Seeds Now"}
        </Button>
        {!user && (
          <p className="text-sm text-red-400">Please login to seed the database</p>
        )}
      </div>
    </div>
  );
}


