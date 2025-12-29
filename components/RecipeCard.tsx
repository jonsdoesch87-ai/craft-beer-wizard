"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, Printer, Beaker, ShoppingCart, CheckCircle2, ArrowRight, Droplets, Thermometer } from "lucide-react";
import { useState } from "react";

export interface Recipe {
  name: string;
  description?: string;
  specs?: {
    pre_boil_gravity?: string;
    original_gravity?: string;
    final_gravity?: string;
    og?: string;
    fg?: string;
    abv?: string;
    ibu?: string;
    srm?: string;
    mash_water?: string;
    sparge_water?: string;
    mash_water_volume?: string;
    sparge_water_volume?: string;
    mashThickness?: string;
    brewhouseEfficiency?: string;
  };
  // Legacy support
  originalGravity?: string;
  finalGravity?: string;
  abv?: string;
  ibu?: string;
  srm?: string;
  ingredients?: {
    malts: Array<{
      name: string;
      amount: string;
      amount_grams?: number;
      percentage: string;
      explanation?: string;
    }>;
    hops: Array<{
      name: string;
      amount: string;
      amount_grams?: number;
      time: string;
      boil_time?: number;
      alpha: string | number;
      alpha_acid_base?: number;
      explanation?: string;
    }>;
    yeast: {
      name: string;
      amount: string;
      explanation?: string;
    };
    water: { amount: string };
  };
  // New schema top-level
  malts?: Array<{
    name: string;
    amount: string;
    amount_grams?: number;
    percentage: string;
    explanation?: string;
  }>;
  hops?: Array<{
    name: string;
    amount: string;
    amount_grams?: number;
    time: string;
    boil_time?: number;
    alpha: string | number;
    alpha_acid_base?: number;
    explanation?: string;
  }>;
  yeast?: {
    name: string;
    amount: string;
    explanation?: string;
  };
  mash_schedule?: Array<{
    step: string;
    temp: string;
    time: string;
    description?: string;
  }>;
  mash_steps?: Array<{
    step: string;
    temp: string;
    time: string;
    description?: string;
  }>;
  boil_instructions?: string[];
  fermentation_instructions?: string[];
  instructions?: string[];
  shopping_list?: Array<{
    item: string;
    category: "malt" | "hop" | "yeast" | "other";
    affiliate_link: string;
  }>;
  estimatedTime: string;
  notes: string;
}

interface RecipeCardProps {
  recipe: Recipe | null;
  units: "metric" | "imperial";
}

export function RecipeCard({ recipe, units }: RecipeCardProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [alphaAcids, setAlphaAcids] = useState<Record<number, number>>({});
  const [activeTab, setActiveTab] = useState("prep");

  const handleSave = () => {
    setIsSaved(!isSaved);
    console.log("Recipe saved to profile");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCheckboxChange = (index: number) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(index)) {
      newChecked.delete(index);
    } else {
      newChecked.add(index);
    }
    setCheckedItems(newChecked);
  };

  const handleAlphaAcidChange = (index: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setAlphaAcids((prev) => ({ ...prev, [index]: numValue }));
  };

  const getSpec = (key: keyof NonNullable<Recipe["specs"]>): string => {
    if (recipe?.specs?.[key]) return recipe.specs[key]!;
    // Legacy support
    switch (key) {
      case "og":
      case "original_gravity":
        return recipe?.originalGravity || recipe?.specs?.og || "1.050";
      case "fg":
      case "final_gravity":
        return recipe?.finalGravity || recipe?.specs?.fg || "1.010";
      case "abv":
        return recipe?.abv || recipe?.specs?.abv || "5.2%";
      case "ibu":
        return recipe?.ibu || recipe?.specs?.ibu || "45";
      case "srm":
        return recipe?.srm || recipe?.specs?.srm || "8";
      case "mash_water":
      case "mash_water_volume":
        return recipe?.specs?.mash_water || recipe?.specs?.mash_water_volume || "";
      case "sparge_water":
      case "sparge_water_volume":
        return recipe?.specs?.sparge_water || recipe?.specs?.sparge_water_volume || "";
      default:
        return "";
    }
  };

  // Beer Color Estimator (Simple mapping based on SRM string or style)
  const getBeerColor = () => {
    const srm = parseFloat(getSpec("srm")) || 5;
    if (srm < 4) return "#F8F5D4"; // Pale Straw
    if (srm < 7) return "#F3F993"; // Gold
    if (srm < 12) return "#E58623"; // Amber
    if (srm < 20) return "#A65B20"; // Copper/Brown
    if (srm < 30) return "#5D341A"; // Dark Brown
    return "#360904"; // Black
  };

  const calculateAdjustedAmount = (
    originalAmount: number,
    originalAlpha: number,
    userInputAlpha: number
  ): number => {
    if (!userInputAlpha || userInputAlpha <= 0) return originalAmount;
    if (!originalAlpha || originalAlpha <= 0) return originalAmount;
    if (!originalAmount || originalAmount <= 0) return 0;
    const adjustedAmount = (originalAmount * originalAlpha) / userInputAlpha;
    return Math.round(adjustedAmount * 10) / 10;
  };

  if (!recipe) {
    return (
      <Card className="print:hidden">
        <CardContent className="flex min-h-[400px] flex-col items-center justify-center p-12 text-center">
          <Beaker className="mb-4 h-16 w-16 text-muted-foreground opacity-50" />
          <h3 className="mb-2 text-xl font-semibold text-muted-foreground">
            Your masterpiece will appear here...
          </h3>
          <p className="text-sm text-muted-foreground">
            Complete the wizard to generate your custom beer recipe
          </p>
        </CardContent>
      </Card>
    );
  }

  // Unified Hop Accessor
  const allHops = recipe.hops || recipe.ingredients?.hops || [];
  
  // Hop Helper Function
  const getAdjustedHopAmount = (hop: any, index: number) => {
    const alphaValue = typeof hop.alpha === "string" ? parseFloat(hop.alpha) : (hop.alpha || 0);
    const originalAlpha = hop.alpha_acid_base ?? alphaValue;
    const originalAmount = hop.amount_grams ?? 0;
    const userInputAlpha = alphaAcids[index] ?? originalAlpha;
    
    if (Math.abs(userInputAlpha - originalAlpha) < 0.01) return originalAmount;
    return calculateAdjustedAmount(originalAmount, originalAlpha, userInputAlpha);
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <Card className="print:border-0 print:shadow-none bg-gradient-to-r from-background to-zinc-900/50">
        <CardHeader className="relative">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                 {/* Beer Color Circle */}
                <div 
                  className="h-8 w-8 rounded-full border border-white/10 shadow-sm" 
                  style={{ backgroundColor: getBeerColor() }} 
                  title="Estimated Beer Color"
                />
                <CardTitle className="text-3xl font-bold text-[#FFBF00] sm:text-4xl">
                  {recipe.name}
                </CardTitle>
              </div>
              <CardDescription className="text-base italic max-w-2xl">
                {recipe.description || "A carefully crafted recipe tailored to your preferences."}
              </CardDescription>
            </div>
            <div className="ml-4 flex gap-2 print:hidden">
              <Button variant="outline" size="icon" onClick={handleSave} className={isSaved ? "border-primary bg-primary/10" : ""}>
                <Heart className={`h-5 w-5 ${isSaved ? "fill-primary text-primary" : ""}`} />
              </Button>
              <Button variant="outline" size="icon" onClick={handlePrint}>
                <Printer className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Specs Badges */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary" className="bg-[#FFBF00]/10 text-[#FFBF00] hover:bg-[#FFBF00]/20 border-0 px-3 py-1">
              ABV: {getSpec("abv")}
            </Badge>
            <Badge variant="secondary" className="bg-[#4CBB17]/10 text-[#4CBB17] hover:bg-[#4CBB17]/20 border-0 px-3 py-1">
              IBU: {getSpec("ibu")}
            </Badge>
            <Badge variant="outline" className="border-zinc-700">
              OG: {getSpec("original_gravity") || recipe.specs?.og || "1.050"}
            </Badge>
            <Badge variant="outline" className="border-zinc-700">
              FG: {getSpec("final_gravity") || recipe.specs?.fg || "1.010"}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="print:hidden">
        <TabsList className="mb-6 bg-zinc-900/50 p-1 border border-zinc-800">
          <TabsTrigger value="prep" className="data-[state=active]:bg-[#FFBF00] data-[state=active]:text-black">Prep & Shopping</TabsTrigger>
          <TabsTrigger value="brewing" className="data-[state=active]:bg-[#FFBF00] data-[state=active]:text-black">Brewing Dashboard</TabsTrigger>
        </TabsList>

        {/* Tab 1: Prep & Shopping */}
        <TabsContent value="prep" className="space-y-6">
          {recipe.shopping_list && recipe.shopping_list.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-[#FFBF00]" />
                  Brew Day Shopping List
                </CardTitle>
                <CardDescription>Check off items as you shop</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recipe.shopping_list.map((item, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                        checkedItems.has(index) ? "border-[#4CBB17]/50 bg-[#4CBB17]/5" : "border-zinc-800 bg-zinc-900/20"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`shopping-${index}`}
                          checked={checkedItems.has(index)}
                          onCheckedChange={() => handleCheckboxChange(index)}
                        />
                        <Label
                          htmlFor={`shopping-${index}`}
                          className={`cursor-pointer text-sm ${checkedItems.has(index) ? "line-through text-muted-foreground" : ""}`}
                        >
                          {item.item}
                        </Label>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 text-[#FFBF00] hover:text-[#FFBF00]/80" onClick={() => window.open(item.affiliate_link, "_blank")}>
                        Buy
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Hop Correction */}
          {allHops.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Hop Quantity Correction</CardTitle>
                <CardDescription>Enter purchased alpha acid % to adjust amounts automatically.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {allHops.map((hop, index) => {
                  if ((hop.boil_time ?? 0) === 0 && !hop.time?.toLowerCase().includes("whirlpool")) return null; // Skip pure dry hops if possible, but keep whirlpool for correction
                  
                  const alphaValue = typeof hop.alpha === "string" ? parseFloat(hop.alpha) : (hop.alpha || 0);
                  const originalAlpha = hop.alpha_acid_base ?? alphaValue;
                  const originalAmount = hop.amount_grams ?? 0;
                  const userInputAlpha = alphaAcids[index] ?? originalAlpha;
                  const adjustedAmount = calculateAdjustedAmount(originalAmount, originalAlpha, userInputAlpha);
                  const hasChanged = Math.abs(userInputAlpha - originalAlpha) > 0.01;

                  return (
                    <div key={index} className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 sm:flex-row sm:items-center">
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{hop.name}</div>
                        <div className="text-xs text-muted-foreground">Schedule: {hop.time}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-zinc-950 rounded-md border border-zinc-800 p-1">
                          <Input
                            type="number"
                            value={userInputAlpha || ""}
                            onChange={(e) => handleAlphaAcidChange(index, e.target.value)}
                            className="h-8 w-16 border-0 bg-transparent text-right p-1"
                            placeholder={originalAlpha.toString()}
                          />
                          <span className="text-xs text-muted-foreground pr-2">% AA</span>
                        </div>
                        <div className="min-w-[80px] text-right">
                           <div className={`text-base font-bold ${hasChanged ? "text-[#FFBF00]" : "text-zinc-400"}`}>
                            {adjustedAmount.toFixed(1)}g
                           </div>
                           {hasChanged && <div className="text-xs text-muted-foreground line-through">{originalAmount.toFixed(1)}g</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <Button onClick={() => setActiveTab("brewing")} size="lg" className="w-full h-14 text-lg font-bold bg-[#FFBF00] text-black hover:bg-[#FFBF00]/90">
            Start Brew Day <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </TabsContent>

        {/* Tab 2: Brewing Dashboard */}
        <TabsContent value="brewing" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-1">
            
            {/* Left Column: Ingredients */}
            <Card className="print:border-0 print:shadow-none h-fit">
              <CardHeader className="pb-3 border-b border-zinc-800">
                <CardTitle className="text-base font-semibold">Bill of Materials</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Malts */}
                <div className="p-4">
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Malts & Grains</h4>
                  <div className="rounded-md border border-zinc-800 overflow-hidden">
                    {(recipe.malts || recipe.ingredients?.malts || []).map((malt, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 text-sm odd:bg-zinc-900/50 even:bg-transparent">
                        <span className="font-medium">{malt.name}</span>
                        <span className="text-zinc-400">{malt.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hops */}
                <div className="px-4 pb-4">
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Hops & Additions</h4>
                  <div className="rounded-md border border-zinc-800 overflow-hidden">
                    {allHops.map((hop, idx) => {
                       const adjustedAmount = getAdjustedHopAmount(hop, idx);
                       const hasChanged = Math.abs((alphaAcids[idx] ?? hop.alpha_acid_base ?? 0) - (hop.alpha_acid_base ?? 0)) > 0.01;
                       
                       return (
                        <div key={idx} className="flex items-center justify-between p-2 text-sm odd:bg-zinc-900/50 even:bg-transparent">
                          <div>
                            <span className="font-medium">{hop.name}</span>
                            <span className="ml-2 text-xs text-zinc-500">
                              {typeof hop.alpha === 'string' ? hop.alpha.replace('%', '') : hop.alpha}% AA
                            </span>
                          </div>
                          <span className={hasChanged ? "font-bold text-[#FFBF00]" : "text-zinc-400"}>
                            {hasChanged ? adjustedAmount.toFixed(1) + "g" : hop.amount}
                          </span>
                        </div>
                       );
                    })}
                  </div>
                </div>

                {/* Yeast & Water Details */}
                <div className="bg-zinc-900/30 p-4 border-t border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Yeast</span>
                        <span className="text-sm text-[#FFBF00]">{(recipe.yeast || recipe.ingredients?.yeast)?.name}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                         <div className="flex flex-col items-center justify-center rounded bg-background p-2 border border-zinc-800 text-center">
                            <Droplets className="h-4 w-4 text-blue-400 mb-1" />
                            <div className="text-[10px] uppercase text-muted-foreground">Mash Water</div>
                            <div className="text-sm font-bold">{getSpec("mash_water") || "N/A"}</div>
                         </div>
                         <div className="flex flex-col items-center justify-center rounded bg-background p-2 border border-zinc-800 text-center">
                            <Droplets className="h-4 w-4 text-blue-400 mb-1 opacity-50" />
                            <div className="text-[10px] uppercase text-muted-foreground">Sparge Water</div>
                            <div className="text-sm font-bold">{getSpec("sparge_water") || "N/A"}</div>
                         </div>
                    </div>
                </div>
              </CardContent>
            </Card>

            {/* Right Column: Process */}
            <div className="space-y-4">
              {/* Mash Schedule */}
              <Card>
                <CardHeader className="pb-3 border-b border-zinc-800">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-red-400" /> Mash Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-zinc-800">
                    {(recipe.mash_schedule || recipe.mash_steps || []).map((step, idx) => (
                       <div key={idx} className="flex items-center justify-between p-3 text-sm">
                          <span className="font-medium">{step.step}</span>
                          <span className="font-bold text-[#FFBF00]">{step.temp} / {step.time}</span>
                       </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Boil Schedule */}
              <Card>
                <CardHeader className="pb-3 border-b border-zinc-800">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> Boil Schedule (60 min)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                   <div className="divide-y divide-zinc-800">
                      {/* Boil Hops */}
                      {allHops
                        .filter(h => (h.boil_time ?? 0) > 0)
                        .map((hop, idx) => {
                          const originalIndex = allHops.indexOf(hop);
                          const adjustedAmount = getAdjustedHopAmount(hop, originalIndex);
                          return (
                            <div key={idx} className="flex items-center justify-between p-3 text-sm">
                                <div className="flex items-center gap-3">
                                   <Badge variant="outline" className="w-16 justify-center bg-zinc-900 text-white border-zinc-700">{hop.boil_time} min</Badge>
                                   <span className="font-medium">{hop.name}</span>
                                </div>
                                <span className="font-bold">{adjustedAmount.toFixed(1)}g</span>
                            </div>
                          );
                      })}
                      {/* Whirlpool Hops */}
                      {allHops
                        .filter(h => (h.boil_time ?? 0) === 0 && (h.time?.toLowerCase().includes("whirlpool") || h.time?.toLowerCase().includes("flameout")))
                        .map((hop, idx) => {
                           const originalIndex = allHops.indexOf(hop);
                           const adjustedAmount = getAdjustedHopAmount(hop, originalIndex);
                           return (
                             <div key={idx} className="flex items-center justify-between p-3 text-sm bg-blue-500/5">
                                 <div className="flex items-center gap-3">
                                    <Badge className="w-16 justify-center bg-blue-600 hover:bg-blue-600 text-white border-0">WP 80°C</Badge>
                                    <span className="font-medium">{hop.name}</span>
                                 </div>
                                 <span className="font-bold">{adjustedAmount.toFixed(1)}g</span>
                             </div>
                           );
                        })
                      }
                   </div>
                   {recipe.specs?.pre_boil_gravity && (
                       <div className="p-3 bg-zinc-900/50 text-xs text-center border-t border-zinc-800">
                          Target Pre-Boil Gravity: <span className="font-mono text-[#FFBF00]">{recipe.specs.pre_boil_gravity}</span>
                       </div>
                   )}
                </CardContent>
              </Card>

              {/* Fermentation & Dry Hop */}
              <Card>
                <CardHeader className="pb-3 border-b border-zinc-800">
                  <CardTitle className="text-base font-semibold">Fermentation</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                    {/* Temp Schedule */}
                    <div className="space-y-1">
                        <div className="text-xs font-bold uppercase text-muted-foreground">Temperature Profile</div>
                        {recipe.fermentation_instructions?.slice(0, 3).map((instr, i) => (
                            <div key={i} className="text-sm border-l-2 border-zinc-700 pl-3 py-1 text-zinc-300">
                                {formatStepWithBold(instr)}
                            </div>
                        ))}
                    </div>

                    {/* Dry Hops */}
                    {allHops.filter(h => h.time?.toLowerCase().includes("dry")).length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-zinc-800">
                            <div className="text-xs font-bold uppercase text-[#4CBB17]">Dry Hop Schedule</div>
                            {allHops
                                .filter(h => h.time?.toLowerCase().includes("dry"))
                                .map((hop, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-zinc-900/50 p-2 rounded border border-zinc-800">
                                    <div className="text-sm">
                                        <span className="font-semibold">{hop.name}</span>
                                        <span className="text-xs text-muted-foreground block">{hop.time}</span>
                                    </div>
                                    <div className="font-bold text-sm">{getAdjustedHopAmount(hop, allHops.indexOf(hop)).toFixed(1)}g</div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
              </Card>

            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper to bold numbers/temps in text strings
function formatStepWithBold(text: string) {
  // Simple regex to wrap temps and days in bold
  const parts = text.split(/(\d+(?:-\d+)?°[CF]|\d+\s*days|\d+\s*min)/g);
  return (
    <span>
      {parts.map((part, i) =>
        part.match(/(\d+(?:-\d+)?°[CF]|\d+\s*days|\d+\s*min)/) ? (
          <span key={i} className="font-bold text-white">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </span>
  );
}