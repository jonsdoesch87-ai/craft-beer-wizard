"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, Printer, Beaker, ShoppingCart, CheckCircle2, ArrowRight, Droplets, Thermometer, Save, Crown, FlaskConical, Globe, Share2, Link as LinkIcon, Mail, MessageCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { saveRecipe, LimitReachedError, publishRecipe, unpublishRecipe, getPublicRecipes, startNewBatch, updateRecipe, getRecipe, setRecipeVisibility } from "@/lib/db";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatBeerColor } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    extras?: Array<{
      name: string;
      amount: number;
      unit: string;
      use: "Mash" | "Boil" | "Fermentation" | "Secondary";
      time: string;
      description?: string;
    }>;
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
  extras?: Array<{
    name: string;
    amount: number;
    unit: string;
    type?: "water_agent" | "process_aid" | "spice" | "herb" | "nutrient" | "enzyme" | "other";
    use: "Mash" | "Boil" | "Fermentation" | "Secondary" | "Bottling";
    time: string;
    description?: string;
  }>;
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
  estimatedTime?: string;
  notes?: string;
  waterProfile?: {
    description?: string;
    ca: number;
    mg: number;
    na: number;
    cl: number;
    so4: number;
    hco3: number;
  };
}

interface RecipeCardProps {
  recipe: Recipe | null;
  units: "metric" | "imperial";
  recipeId?: string; // Optional: Recipe ID from user's library
  userId?: string; // Optional: User ID who owns this recipe
}

export function RecipeCard({ recipe, units, recipeId, userId }: RecipeCardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isStartingBatch, setIsStartingBatch] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [alphaAcids, setAlphaAcids] = useState<Record<number, number>>({});
  const [activeTab, setActiveTab] = useState("prep");
  const [billOfMaterialsChecked, setBillOfMaterialsChecked] = useState<Set<number>>(new Set());
  const [isExpertMode, setIsExpertMode] = useState<boolean>(false);
  const [isPublic, setIsPublic] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const [showPremiumDialog, setShowPremiumDialog] = useState(false);

  // Check if recipe is public
  useEffect(() => {
    if (recipeId && userId && user?.uid === userId) {
      checkIfPublic();
    }
  }, [recipeId, userId, user]);

  const checkIfPublic = async () => {
    if (!userId || !recipeId) return;
    try {
      const recipeData = await getRecipe(userId, recipeId);
      if (recipeData && recipeData.isPublic === true) {
        setIsPublic(true);
      }
    } catch (error) {
      console.error("Error checking publication status:", error);
    }
  };

  const handleTogglePublic = async (checked: boolean) => {
    if (!user || !recipeId || !userId || user.uid !== userId) {
      toast.error("You can only share your own recipes");
      return;
    }

    if (!recipe) {
      toast.error("No recipe to share");
      return;
    }

    setIsPublishing(true);
    try {
      await setRecipeVisibility(userId, recipeId, checked);
      setIsPublic(checked);
      if (checked) {
        toast.success("Recipe is now publicly shareable! 🌍");
      } else {
        toast.success("Recipe is now private 🔒");
      }
    } catch (error) {
      console.error("Error toggling publication:", error);
      toast.error("Failed to update publication status");
    } finally {
      setIsPublishing(false);
    }
  };

  // Handler for Share button - sets recipe to public and copies link
  const handleShare = async () => {
    if (!user || !recipeId || !userId || user.uid !== userId) {
      toast.error("You can only share your own recipes");
      return;
    }

    if (!recipe) {
      toast.error("No recipe to share");
      return;
    }

    try {
      // 1. Set recipe to public
      await setRecipeVisibility(userId, recipeId, true);
      setIsPublic(true);
      
      // 2. Generate share URL with both IDs
      const shareUrl = `${window.location.origin}/view/${userId}/${recipeId}`;
      
      // 3. Try native share first
      if (navigator.share) {
        try {
          await navigator.share({
            title: recipe.name,
            text: `Check out this beer recipe: ${recipe.name}`,
            url: shareUrl,
          });
          return;
        } catch (err: any) {
          if (err.name !== "AbortError") {
            console.log("Share failed:", err);
          }
        }
      }
      
      // 4. Fallback: Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Public link copied to clipboard! 🌍");
    } catch (error) {
      console.error("Error sharing recipe:", error);
      toast.error("Could not share recipe");
    }
  };

  // Check if this recipe belongs to the current user
  const isOwnRecipe = user && userId && user.uid === userId && recipeId;

  const handleSave = async () => {
    if (!user) {
      toast.error("Please login to save recipes");
      return;
    }

    if (!recipe) {
      toast.error("No recipe to save");
      return;
    }

    setIsSaving(true);
    try {
      await saveRecipe(user.uid, {
        name: recipe.name,
        description: recipe.description,
        specs: recipe.specs,
        ingredients: recipe.ingredients,
        malts: recipe.malts,
        hops: recipe.hops,
        yeast: recipe.yeast,
        mash_schedule: recipe.mash_schedule,
        boil_instructions: recipe.boil_instructions,
        fermentation_instructions: recipe.fermentation_instructions,
        shopping_list: recipe.shopping_list,
        estimatedTime: recipe.estimatedTime,
        notes: recipe.notes,
      });
      toast.success("Recipe saved to your library!");
    } catch (error: any) {
      console.error("Error saving recipe:", error);
      if (error instanceof LimitReachedError || error?.message === "LIMIT_REACHED" || error?.name === "LimitReachedError") {
        setShowPremiumDialog(true);
      } else {
        toast.error("Failed to save recipe");
      }
    } finally {
      setIsSaving(false);
    }
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

  // Helper function to convert SG to Plato
  const toPlato = (sg: string | number | undefined): string => {
    if (!sg) return "";
    const sgValue = typeof sg === "string" ? parseFloat(sg) : sg;
    if (isNaN(sgValue) || sgValue <= 0) return "";
    const plato = ((sgValue - 1) * 250).toFixed(1);
    return `${plato}°P`;
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
          {/* Wrapper: Mobile = Column, Desktop = Row */}
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            {/* Left Side: Title & Info */}
            <div className="flex-1 min-w-0">
              <div className="mb-2">
                <CardTitle className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#FFBF00] break-words leading-tight">
                  {recipe.name}
                </CardTitle>
              </div>
              <CardDescription className="text-sm sm:text-base italic max-w-2xl">
                {recipe.description || "A carefully crafted recipe tailored to your preferences."}
              </CardDescription>
            </div>
            
            {/* Right Side: Actions */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end print:hidden">
              {/* Expert Mode Toggle */}
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-zinc-700 bg-zinc-900/50 flex-grow sm:flex-grow-0 justify-center">
                <FlaskConical className="h-4 w-4 text-[#FFBF00]" />
                <Label htmlFor="expert-mode" className="text-xs sm:text-sm cursor-pointer whitespace-nowrap">
                  Expert
                </Label>
                <Switch
                  id="expert-mode"
                  checked={isExpertMode}
                  onCheckedChange={setIsExpertMode}
                  className="scale-75 sm:scale-100"
                />
              </div>
              
              {/* Public Toggle (only for own recipes) */}
              {isOwnRecipe && (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-blue-500/30 bg-blue-500/10 flex-grow sm:flex-grow-0 justify-center">
                  <Globe className="h-4 w-4 text-blue-400" />
                  <Label htmlFor="public-toggle" className="text-xs sm:text-sm cursor-pointer text-blue-400 whitespace-nowrap">
                    Public
                  </Label>
                  <Switch
                    id="public-toggle"
                    checked={isPublic}
                    onCheckedChange={handleTogglePublic}
                    disabled={isPublishing}
                    className="scale-75 sm:scale-100 data-[state=checked]:bg-blue-500"
                  />
                </div>
              )}

              {/* Action Buttons (Save, Print, Share) */}
              <div className="flex items-center gap-2 ml-auto sm:ml-0">
                {user ? (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="border-primary hover:bg-primary/10"
                    title="Save to Library"
                  >
                    <Save className={`h-5 w-5 ${isSaving ? "animate-pulse" : ""}`} />
                  </Button>
                ) : (
                  <Link href="/wizard">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-primary hover:bg-primary/10"
                      title="Login to Save"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      <span className="hidden sm:inline">Login to Save</span>
                      <span className="sm:hidden">Login</span>
                    </Button>
                  </Link>
                )}
                <Button variant="outline" size="icon" onClick={handlePrint}>
                  <Printer className="h-5 w-5" />
                </Button>
                
                {/* Share Button - Direct action */}
                {isOwnRecipe && (
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={handleShare}
                    title="Share Public Link"
                    disabled={isPublishing}
                  >
                    <Share2 className="h-5 w-5" />
                  </Button>
                )}
                
                {/* Share Dropdown Menu (for additional options) */}
                {isOwnRecipe && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        title="Share Options"
                        disabled={isPublishing}
                      >
                        <LinkIcon className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={async () => {
                        if (!recipe) return;
                        
                        // Build share URL: /view/[userId]/[recipeId]
                        let shareUrl: string;
                        if (isPublic && userId && recipeId) {
                          shareUrl = `${window.location.origin}/view/${userId}/${recipeId}`;
                        } else {
                          // Fallback: Private Link (only if not public)
                          shareUrl = window.location.href;
                          toast.info("Make recipe public first to share it!");
                        }
                        
                        // Try native share first
                        if (navigator.share) {
                          try {
                            await navigator.share({
                              title: recipe.name,
                              text: `Check out this beer recipe: ${recipe.name}`,
                              url: shareUrl,
                            });
                            return;
                          } catch (err: any) {
                            if (err.name !== "AbortError") {
                              console.log("Share failed:", err);
                            }
                          }
                        }
                        // Fallback to WhatsApp
                        const text = `Check out this brew: ${recipe.name} - ${shareUrl}`;
                        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                      }}
                    >
                      <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        if (!recipe) return;
                        
                        // Build share URL: /view/[userId]/[recipeId]
                        let shareUrl: string;
                        if (isPublic && userId && recipeId) {
                          shareUrl = `${window.location.origin}/view/${userId}/${recipeId}`;
                        } else {
                          // Fallback: Private Link
                          shareUrl = window.location.href;
                          toast.info("Make recipe public first to share it!");
                        }
                        
                        const subject = `Beer Recipe: ${recipe.name}`;
                        const body = `Check out this recipe:\n\n${shareUrl}`;
                        window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
                      }}
                    >
                      <Mail className="mr-2 h-4 w-4" /> Email
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={async () => {
                        // Build share URL: /view/[userId]/[recipeId]
                        let shareUrl: string;
                        if (isPublic && userId && recipeId) {
                          shareUrl = `${window.location.origin}/view/${userId}/${recipeId}`;
                        } else {
                          // Fallback: Private Link
                          shareUrl = window.location.href;
                        }
                        
                        try {
                          await navigator.clipboard.writeText(shareUrl);
                          if (isPublic && userId && recipeId) {
                            toast.success("Public link copied! Ready to share 🌍");
                          } else {
                            toast.info("Make recipe public first to share it!");
                          }
                        } catch (err) {
                          console.error("Failed to copy:", err);
                          toast.error("Failed to copy link");
                        }
                      }}
                    >
                      <LinkIcon className="mr-2 h-4 w-4" /> Copy Link
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
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
            {getSpec("srm") && (
              <Badge variant="outline" className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 flex items-center gap-2 px-3 py-1">
                <div
                  className="h-3 w-3 rounded-full border border-white/10"
                  style={{ backgroundColor: getBeerColor() }}
                />
                {formatBeerColor(getSpec("srm"), units)}
              </Badge>
            )}
            <Badge variant="outline" className="border-zinc-700">
              OG: {(() => {
                const og = getSpec("original_gravity") || recipe.specs?.og || "1.050";
                const plato = toPlato(og);
                return plato ? `${og} (${plato})` : og;
              })()}
            </Badge>
            <Badge variant="outline" className="border-zinc-700">
              FG: {(() => {
                const fg = getSpec("final_gravity") || recipe.specs?.fg || "1.010";
                const plato = toPlato(fg);
                return plato ? `${fg} (${plato})` : fg;
              })()}
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
                          <span className="text-xs text-muted-foreground pr-2">% α</span>
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

          <Button 
            onClick={async () => {
              if (!user || !recipeId || !userId || user.uid !== userId) {
                toast.error("Please login to start a batch");
                return;
              }
              setIsStartingBatch(true);
              try {
                const batchId = await startNewBatch(user.uid, recipeId);
                toast.success("New batch started! Redirecting to brew session...");
                router.push(`/brew/${recipeId}`);
              } catch (error) {
                console.error("Error starting batch:", error);
                toast.error("Failed to start batch");
              } finally {
                setIsStartingBatch(false);
              }
            }}
            disabled={isStartingBatch || !user || !recipeId || !userId || user.uid !== userId}
            size="lg" 
            className="w-full h-14 text-lg font-bold bg-[#FFBF00] text-black hover:bg-[#FFBF00]/90 disabled:opacity-50"
          >
            {isStartingBatch ? (
              <>Starting Batch...</>
            ) : (
              <>Start Brew Day <ArrowRight className="ml-2 h-5 w-5" /></>
            )}
          </Button>
        </TabsContent>

        {/* Tab 2: Brewing Dashboard */}
        <TabsContent value="brewing" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-1">
            
            {/* Left Column: Ingredients */}
            <Card className="print:border-0 print:shadow-none h-fit">
              <CardHeader className="pb-3 border-b border-zinc-800">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Bill of Materials</CardTitle>
                  {(() => {
                    const allMalts = recipe?.malts || recipe?.ingredients?.malts || [];
                    return allMalts.length > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const allMalts = recipe?.malts || recipe?.ingredients?.malts || [];
                          const allChecked = allMalts.every((_, idx) => billOfMaterialsChecked.has(idx));
                          if (allChecked) {
                            setBillOfMaterialsChecked(new Set());
                          } else {
                            setBillOfMaterialsChecked(new Set(allMalts.map((_, idx) => idx)));
                          }
                        }}
                        className="text-sm"
                      >
                        {(() => {
                          const allMalts = recipe?.malts || recipe?.ingredients?.malts || [];
                          return allMalts.every((_, idx) => billOfMaterialsChecked.has(idx))
                            ? "Uncheck All"
                            : "Check All";
                        })()}
                      </Button>
                    ) : null;
                  })()}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Malts */}
                <div className="p-4">
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Malts & Grains</h4>
                  <div className="rounded-md border border-zinc-800 overflow-hidden">
                    {(recipe?.malts || recipe?.ingredients?.malts || []).map((malt, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-2 text-sm odd:bg-zinc-900/50 even:bg-transparent cursor-pointer hover:bg-zinc-800/50 transition-colors"
                        onClick={() => {
                          const newChecked = new Set(billOfMaterialsChecked);
                          if (newChecked.has(idx)) {
                            newChecked.delete(idx);
                          } else {
                            newChecked.add(idx);
                          }
                          setBillOfMaterialsChecked(newChecked);
                        }}
                      >
                        <Checkbox
                          checked={billOfMaterialsChecked.has(idx)}
                          onCheckedChange={(checked) => {
                            const newChecked = new Set(billOfMaterialsChecked);
                            if (checked) {
                              newChecked.add(idx);
                            } else {
                              newChecked.delete(idx);
                            }
                            setBillOfMaterialsChecked(newChecked);
                          }}
                          className="h-6 w-6 cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className={`font-medium flex-1 ${billOfMaterialsChecked.has(idx) ? "line-through text-muted-foreground" : ""}`}>
                          {malt.name}
                        </span>
                        <span className={`text-zinc-400 ${billOfMaterialsChecked.has(idx) ? "line-through text-muted-foreground" : ""}`}>
                          {malt.amount}
                        </span>
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
                              {typeof hop.alpha === 'string' ? hop.alpha.replace('%', '') : hop.alpha}% α
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

                {/* Additives & Extras */}
                {(() => {
                  const allExtras = recipe.extras || recipe.ingredients?.extras || [];
                  if (allExtras.length === 0) return null;

                  // Group extras by type
                  const waterAgents = allExtras.filter((e: any) => e.type === "water_agent" || (!e.type && e.use === "Mash" && (e.name?.toLowerCase().includes("gypsum") || e.name?.toLowerCase().includes("calcium") || e.name?.toLowerCase().includes("lactic"))));
                  const processAids = allExtras.filter((e: any) => e.type === "process_aid" || (!e.type && (e.name?.toLowerCase().includes("irish moss") || e.name?.toLowerCase().includes("rice hull") || e.name?.toLowerCase().includes("whirlfloc") || e.name?.toLowerCase().includes("yeast nutrient"))));
                  const otherExtras = allExtras.filter((e: any) => !waterAgents.includes(e) && !processAids.includes(e));

                  return (
                    <div className="px-4 pb-4">
                      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Additives & Extras</h4>
                      <div className="rounded-md border border-zinc-800 overflow-hidden space-y-1">
                        {/* Water Agents */}
                        {waterAgents.map((extra: any, idx: number) => (
                          <div key={`water-${idx}`} className="flex items-center justify-between p-2 text-sm odd:bg-blue-500/5 even:bg-blue-500/10 border-l-2 border-blue-500/30">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs bg-blue-500/20 text-blue-300 border-blue-500/50">
                                Water
                              </Badge>
                              <span className="font-medium">{extra.name}</span>
                            </div>
                            <span className="text-zinc-300 font-medium">
                              {extra.amount} {extra.unit || "g"}
                            </span>
                          </div>
                        ))}

                        {/* Process Aids */}
                        {processAids.map((extra: any, idx: number) => (
                          <div key={`process-${idx}`} className="flex items-center justify-between p-2 text-sm odd:bg-zinc-900/50 even:bg-transparent">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs bg-zinc-800 text-zinc-300 border-zinc-700">
                                Process
                              </Badge>
                              <span className="font-medium">{extra.name}</span>
                            </div>
                            <span className="text-zinc-300 font-medium">
                              {extra.amount} {extra.unit || "g"}
                            </span>
                          </div>
                        ))}

                        {/* Other Extras (Spices, Herbs, etc.) */}
                        {otherExtras.map((extra: any, idx: number) => (
                          <div key={`other-${idx}`} className="flex items-center justify-between p-2 text-sm odd:bg-purple-500/5 even:bg-purple-500/10 border-l-2 border-purple-500/30">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs bg-purple-500/20 text-purple-300 border-purple-500/50">
                                {extra.type || "Other"}
                              </Badge>
                              <span className="font-medium">{extra.name}</span>
                            </div>
                            <span className="text-zinc-300 font-medium">
                              {extra.amount} {extra.unit || "g"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

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
                    
                    {/* Target Water Profile - Only show in Expert Mode */}
                    {isExpertMode && recipe.waterProfile && (
                      <div className="mt-4 space-y-3">
                        <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Droplets className="h-4 w-4 text-blue-400" />
                            <div className="text-xs font-bold uppercase text-blue-400">Target Water Profile</div>
                          </div>
                        {recipe.waterProfile.description && (
                            <div className="text-sm font-medium text-[#FFBF00] mb-3">{recipe.waterProfile.description}</div>
                          )}
                          {/* Responsive grid: 2 cols on mobile, 3 on tablet, 6 on desktop */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                            <div className="bg-zinc-900/50 p-2 rounded border border-zinc-800">
                              <div className="text-muted-foreground mb-0.5">Ca</div>
                              <div className="font-mono font-bold text-[#FFBF00]">{recipe.waterProfile.ca || 0} ppm</div>
                          </div>
                            <div className="bg-zinc-900/50 p-2 rounded border border-zinc-800">
                              <div className="text-muted-foreground mb-0.5">Mg</div>
                              <div className="font-mono font-bold text-[#FFBF00]">{recipe.waterProfile.mg || 0} ppm</div>
                          </div>
                            <div className="bg-zinc-900/50 p-2 rounded border border-zinc-800">
                              <div className="text-muted-foreground mb-0.5">Na</div>
                              <div className="font-mono font-bold text-[#FFBF00]">{recipe.waterProfile.na || 0} ppm</div>
                          </div>
                            <div className="bg-zinc-900/50 p-2 rounded border border-zinc-800">
                              <div className="text-muted-foreground mb-0.5">Cl</div>
                              <div className="font-mono font-bold text-[#FFBF00]">{recipe.waterProfile.cl || 0} ppm</div>
                          </div>
                            <div className="bg-zinc-900/50 p-2 rounded border border-zinc-800">
                              <div className="text-muted-foreground mb-0.5">SO₄</div>
                              <div className="font-mono font-bold text-[#FFBF00]">{recipe.waterProfile.so4 || 0} ppm</div>
                          </div>
                            <div className="bg-zinc-900/50 p-2 rounded border border-zinc-800">
                              <div className="text-muted-foreground mb-0.5">HCO₃</div>
                              <div className="font-mono font-bold text-[#FFBF00]">{recipe.waterProfile.hco3 || 0} ppm</div>
                          </div>
                        </div>
                        {recipe.waterProfile.cl > 0 && recipe.waterProfile.so4 > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Cl:SO₄ Ratio: {(recipe.waterProfile.cl / recipe.waterProfile.so4).toFixed(2)}:1
                            {recipe.waterProfile.cl > recipe.waterProfile.so4 * 1.5 && (
                              <span className="ml-2 text-[#FFBF00]">(Chloride-dominant)</span>
                            )}
                            {recipe.waterProfile.so4 > recipe.waterProfile.cl * 1.5 && (
                              <span className="ml-2 text-[#FFBF00]">(Sulfate-dominant)</span>
                            )}
                          </div>
                        )}
                      </div>

                        {/* Water Adjustments (extras with type="water_agent") */}
                        {(() => {
                          const allExtras = recipe.extras || recipe.ingredients?.extras || [];
                          const waterAgents = allExtras.filter((e: any) => e.type === "water_agent");
                          if (waterAgents.length > 0) {
                            return (
                              <div className="mt-3 p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
                                <div className="text-xs font-bold uppercase text-blue-400 mb-2">Water Adjustments</div>
                                <div className="space-y-1.5">
                                  {waterAgents.map((agent: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between text-sm bg-zinc-900/30 p-2 rounded border border-zinc-800">
                                      <div className="flex-1">
                                        <span className="font-medium">{agent.name}</span>
                                        {agent.description && (
                                          <div className="text-xs text-muted-foreground mt-0.5">{agent.description}</div>
                                        )}
                                      </div>
                                      <div className="text-right ml-2">
                                        <span className="font-bold text-[#FFBF00]">{agent.amount} {agent.unit || "g"}</span>
                                        {agent.use && (
                                          <div className="text-xs text-muted-foreground">{agent.use}</div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}

                    {/* Extras / Additives - Categorized (exclude water_agent, already shown above) */}
                    {(() => {
                      const allExtras = recipe.extras || recipe.ingredients?.extras || [];
                      const nonWaterExtras = allExtras.filter((e: any) => e.type !== "water_agent");
                      if (nonWaterExtras.length === 0) return null;

                      // Categorize extras
                      const processAids = nonWaterExtras.filter((e: any) => e.type === "process_aid" || (!e.type && (e.name?.toLowerCase().includes("irish moss") || e.name?.toLowerCase().includes("rice hull") || e.name?.toLowerCase().includes("yeast nutrient") || e.name?.toLowerCase().includes("whirlfloc"))));
                      const otherExtras = nonWaterExtras.filter((e: any) => !processAids.includes(e));

                      return (
                        <div className="mt-4 space-y-3">
                          {/* Process Aids */}
                          {processAids.length > 0 && (
                            <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 p-3">
                              <div className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1">
                                <FlaskConical className="h-3 w-3" /> Process Aids
                              </div>
                              <div className="space-y-1.5">
                                {processAids.map((extra: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between text-sm bg-zinc-900/30 p-2 rounded border border-zinc-800">
                                    <div className="flex-1">
                                      <span className="font-medium">{extra.name}</span>
                                      {extra.description && (
                                        <div className="text-xs text-muted-foreground mt-0.5">{extra.description}</div>
                                      )}
                                    </div>
                                    <div className="text-right ml-2">
                                      <span className="font-bold text-[#FFBF00]">{extra.amount} {extra.unit || "g"}</span>
                                      {extra.use && extra.time && (
                                        <div className="text-xs text-muted-foreground">{extra.use} @ {extra.time}</div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Other Extras (Spices, Herbs, etc.) */}
                          {otherExtras.length > 0 && (
                            <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 p-3">
                              <div className="text-xs font-bold uppercase text-muted-foreground mb-2">Other Additives</div>
                              <div className="space-y-1.5">
                                {otherExtras.map((extra: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between text-sm bg-zinc-900/30 p-2 rounded border border-zinc-800">
                                    <div className="flex-1">
                                      <span className="font-medium">{extra.name}</span>
                                      {extra.description && (
                                        <div className="text-xs text-muted-foreground mt-0.5">{extra.description}</div>
                                      )}
                                    </div>
                                    <div className="text-right ml-2">
                                      <span className="font-bold text-[#FFBF00]">{extra.amount} {extra.unit || "g"}</span>
                                      {extra.use && extra.time && (
                                        <div className="text-xs text-muted-foreground">{extra.use} @ {extra.time}</div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
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
                    
                    {/* Mash Extras */}
                    {(() => {
                      const allExtras = recipe.extras || recipe.ingredients?.extras || [];
                      const mashExtras = allExtras.filter((e: any) => e.use === "Mash" || (!e.use && e.type === "water_agent"));
                      if (mashExtras.length === 0) return null;
                      
                      return (
                        <div className="p-3 bg-blue-500/10 border-l-4 border-blue-500/50">
                          <div className="text-xs font-bold uppercase text-blue-400 mb-2">Add to Mash</div>
                          <div className="space-y-1">
                            {mashExtras.map((extra: any, idx: number) => (
                              <div key={`mash-extra-${idx}`} className="text-sm text-blue-300">
                                <span className="font-medium">{extra.amount} {extra.unit || "g"}</span> {extra.name}
                                {extra.description && (
                                  <span className="text-xs text-blue-400/70 ml-2">({extra.description})</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
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
                      {/* Boil Hops & Extras (merged and sorted by time) */}
                      {(() => {
                        const allExtras = recipe.extras || recipe.ingredients?.extras || [];
                        const boilExtras = allExtras.filter((e: any) => e.use === "Boil");
                        
                        // Parse time for extras (e.g., "10 min" -> 10)
                        const parseTime = (timeStr: string): number => {
                          if (!timeStr) return 0;
                          const match = timeStr.match(/(\d+)/);
                          return match ? parseInt(match[1], 10) : 0;
                        };

                        // Create combined array with hops and extras
                        const boilItems: Array<{
                          type: 'hop' | 'extra';
                          time: number;
                          name: string;
                          amount: string;
                          data: any;
                        }> = [];

                        // Add boil hops
                        allHops
                          .filter(h => (h.boil_time ?? 0) > 0)
                          .forEach((hop) => {
                            const originalIndex = allHops.indexOf(hop);
                            const adjustedAmount = getAdjustedHopAmount(hop, originalIndex);
                            boilItems.push({
                              type: 'hop',
                              time: hop.boil_time || 0,
                              name: hop.name,
                              amount: `${adjustedAmount.toFixed(1)}g`,
                              data: hop,
                            });
                          });

                        // Add boil extras
                        boilExtras.forEach((extra: any) => {
                          const time = parseTime(extra.time || "0 min");
                          boilItems.push({
                            type: 'extra',
                            time: time,
                            name: extra.name,
                            amount: `${extra.amount} ${extra.unit || "g"}`,
                            data: extra,
                          });
                        });

                        // Sort by time (descending - highest time first)
                        boilItems.sort((a, b) => b.time - a.time);

                        return boilItems.map((item, idx) => {
                          if (item.type === 'hop') {
                            return (
                              <div key={`hop-${idx}`} className="flex items-center justify-between p-3 text-sm">
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className="w-16 justify-center bg-zinc-900 text-white border-zinc-700">
                                    {item.time} min
                                  </Badge>
                                  <span className="font-medium">{item.name}</span>
                                </div>
                                <span className="font-bold">{item.amount}</span>
                              </div>
                            );
                          } else {
                            // Extra item
                            const extraType = item.data.type || "other";
                            const bgColor = extraType === "water_agent" 
                              ? "bg-blue-500/10 border-blue-500/30" 
                              : extraType === "process_aid"
                              ? "bg-zinc-900/50"
                              : "bg-purple-500/10 border-purple-500/30";
                            
                            return (
                              <div key={`extra-${idx}`} className={`flex items-center justify-between p-3 text-sm ${bgColor} border-l-4 ${extraType === "water_agent" ? "border-blue-500/50" : extraType === "process_aid" ? "border-zinc-700" : "border-purple-500/50"}`}>
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className="w-16 justify-center bg-zinc-900 text-white border-zinc-700">
                                    {item.time} min
                                  </Badge>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{item.name}</span>
                                    {item.data.type && (
                                      <Badge variant="outline" className="text-xs bg-zinc-800 text-zinc-400 border-zinc-700">
                                        {item.data.type}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <span className="font-bold">{item.amount}</span>
                              </div>
                            );
                          }
                        });
                      })()}
                      
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
                   {(recipe.specs?.pre_boil_gravity || recipe.specs?.original_gravity) && (
                       <div className="p-3 bg-zinc-900/50 text-xs text-center border-t border-zinc-800 space-y-1">
                          {recipe.specs?.pre_boil_gravity && (
                            <div>
                              Target Pre-Boil Gravity: <span className="font-mono text-[#FFBF00]">
                                {(() => {
                                  const pbg = recipe.specs.pre_boil_gravity;
                                  const plato = toPlato(pbg);
                                  return plato ? `${pbg} (${plato})` : pbg;
                                })()}
                              </span>
                            </div>
                          )}
                          {recipe.specs?.original_gravity && (
                            <div>
                              Target Original Gravity (OG): <span className="font-mono text-[#FFBF00]">
                                {(() => {
                                  const og = recipe.specs.original_gravity;
                                  const plato = toPlato(og);
                                  return plato ? `${og} (${plato})` : og;
                                })()}
                              </span>
                            </div>
                          )}
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
                    
                    {/* Carbonation */}
                    {(recipe as any).carbonation && (
                      <div className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                        <div className="text-xs font-bold uppercase text-muted-foreground mb-1">Carbonation</div>
                        <div className="text-sm text-[#FFBF00] font-mono">
                          {(recipe as any).carbonation.display || 
                           `${(recipe as any).carbonation.vol_co2 || 2.4} vol (${(recipe as any).carbonation.sugar_g_per_l || 6}g sugar/L)`}
                        </div>
                      </div>
                    )}
                    
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

      {/* Premium Upgrade Dialog */}
      <Dialog open={showPremiumDialog} onOpenChange={setShowPremiumDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#FFBF00]">
              <Crown className="h-5 w-5" />
              Hobby-Brauer Limit erreicht!
            </DialogTitle>
            <DialogDescription>
              Du hast bereits 3 Rezepte gespeichert. Upgrade auf Pro für unbegrenzte Rezepte!
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-lg bg-zinc-900/50 border border-zinc-800 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#4CBB17]" />
                <span className="text-sm">Unbegrenzte Rezepte</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#4CBB17]" />
                <span className="text-sm">Erweiterte Features</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#4CBB17]" />
                <span className="text-sm">Prioritärer Support</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPremiumDialog(false)}
            >
              Maybe Later
            </Button>
            <Button
              onClick={() => {
                console.log("Redirect to Stripe");
                setShowPremiumDialog(false);
                toast.info("Premium upgrade coming soon!");
              }}
              className="bg-[#FFBF00] text-black hover:bg-[#FFBF00]/90"
            >
              <Crown className="mr-2 h-4 w-4" />
              Unlock Pro (Unlimited)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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