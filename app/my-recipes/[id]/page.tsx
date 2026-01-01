"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getRecipe,
  deleteRecipe,
  RecipeData,
  getBatches,
  BatchData,
  startNewBatch,
  createRecipeVersion,
  deleteBatch,
  updateBatch,
} from "@/lib/db";
import { RecipeCard } from "@/components/RecipeCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Trash2,
  Loader2,
  Beaker,
  Edit,
  Copy,
  History,
  Plus,
  Settings,
  X,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Star, Droplets, Calculator, FlaskConical } from "lucide-react";

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [recipe, setRecipe] = useState<(RecipeData & { id: string }) | null>(null);
  const [batches, setBatches] = useState<(BatchData & { id: string })[]>([]);
  const [activeBatch, setActiveBatch] = useState<(BatchData & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStartingBatch, setIsStartingBatch] = useState(false);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const [isDeletingBatch, setIsDeletingBatch] = useState<string | null>(null);
  const [showRecipeSettings, setShowRecipeSettings] = useState(false);
  const [showBottlingWizard, setShowBottlingWizard] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [targetCO2, setTargetCO2] = useState("2.4");
  const [beerTemp, setBeerTemp] = useState("20");
  const [bottlingVolume, setBottlingVolume] = useState("");
  const [carbonationType, setCarbonationType] = useState<
    "sugar" | "dextrose" | "speise" | "drops" | "spunding"
  >("sugar");
  const [carbonationMethod, setCarbonationMethod] = useState<"priming" | "spunding" | "forced">(
    "priming"
  );
  const [rating, setRating] = useState(0);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isExpertMode, setIsExpertMode] = useState<boolean>(false);
  const recipeId = params.id as string;

  // Load all data on mount
  useEffect(() => {
    if (!user) {
      console.log("[PAGE] Kein User eingeloggt.");
      return;
    }
    
    if (!authLoading && recipeId) {
      console.log(`[PAGE LOAD] Starte Laden für Rezept-ID: ${recipeId}`);
      console.log(`[PAGE LOAD] Nutze User-ID (für Pfad): ${user.uid}`);
      loadAllData();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [user, authLoading, recipeId]);

  const loadAllData = async () => {
    if (!user || !recipeId) {
      console.log(`[PAGE LOAD ALL DATA] Abgebrochen: user=${!!user}, recipeId=${recipeId}`);
      return;
    }
    
    console.log(`[PAGE LOAD ALL DATA] Starte loadAllData mit:`);
    console.log(`- user.uid: ${user.uid}`);
    console.log(`- recipeId: ${recipeId}`);
    
    try {
      setLoading(true);
      setLoadingBatches(true);

      // Load recipe and batches in parallel
      console.log(`[PAGE LOAD ALL DATA] Rufe getRecipe auf mit: user.uid=${user.uid}, recipeId=${recipeId}`);
      const [recipeData, batchesData] = await Promise.all([
        getRecipe(user.uid, recipeId),
        getBatches(user.uid, recipeId),
      ]);

      console.log(`[PAGE LOAD ALL DATA] getRecipe Ergebnis:`, recipeData ? "GEFUNDEN" : "NICHT GEFUNDEN");
      if (recipeData) {
        console.log(`[PAGE LOAD ALL DATA] Rezept erfolgreich geladen. ID: ${recipeData.id}, Name: ${recipeData.name}`);
        setRecipe(recipeData);
      } else {
        console.error(`[PAGE LOAD ALL DATA] Rezept nicht gefunden für: users/${user.uid}/recipes/${recipeId}`);
        toast.error("Recipe not found");
        router.push("/my-recipes");
        return;
      }

      setBatches(batchesData);

      // AUTO-DETECT ACTIVE BATCH: Find batch with status 'brewing' or 'fermenting' or 'conditioning'
      const active = batchesData.find(
        (b) => b.status === "brewing" || b.status === "fermenting" || b.status === "conditioning"
      );

      if (active) {
        setActiveBatch(active);
        if (active.brewLog?.measuredVolume) {
          setBottlingVolume(active.brewLog.measuredVolume.toString());
        }

        // If batch is in "brewing" status, redirect to brew session page
        if (active.status === "brewing") {
          router.push(`/brew/${recipeId}`);
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
      router.push("/my-recipes");
    } finally {
      setLoading(false);
      setLoadingBatches(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !recipeId) return;

    const confirmed = confirm("Really delete? This action cannot be undone.");
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteRecipe(user.uid, recipeId);
      toast.success("Recipe deleted");
      router.push("/my-recipes");
    } catch (error) {
      console.error("Error deleting recipe:", error);
      toast.error("Failed to delete recipe");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStartBrewSession = async () => {
    if (!user || !recipeId) return;
    setIsStartingBatch(true);
    try {
      const batchId = await startNewBatch(user.uid, recipeId);
      toast.success("New batch started!");
      // Navigate to brew session (brewing phase)
      router.push(`/brew/${recipeId}`);
    } catch (error) {
      console.error("Error starting batch:", error);
      toast.error("Failed to start batch");
    } finally {
      setIsStartingBatch(false);
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!user || !recipeId) return;

    const confirmed = confirm("Really delete this batch? This action cannot be undone.");
    if (!confirmed) return;

    setIsDeletingBatch(batchId);
    try {
      await deleteBatch(user.uid, recipeId, batchId);
      toast.success("Batch deleted");
      await loadAllData(); // Reload all data
    } catch (error) {
      console.error("Error deleting batch:", error);
      toast.error("Failed to delete batch");
    } finally {
      setIsDeletingBatch(null);
    }
  };

  const handleCreateVersion = async () => {
    if (!user || !recipeId) return;
    setIsCreatingVersion(true);
    try {
      const newRecipeId = await createRecipeVersion(user.uid, recipeId);
      toast.success("New version created!");
      router.push(`/my-recipes/${newRecipeId}`);
    } catch (error) {
      console.error("Error creating version:", error);
      toast.error("Failed to create version");
    } finally {
      setIsCreatingVersion(false);
    }
  };

  const handleViewBatch = (batch: BatchData & { id: string }) => {
    // Navigate to dedicated batch detail page
    router.push(`/my-recipes/${recipeId}/batch/${batch.id}`);
  };

  const handleBatchUpdate = async () => {
    // Reload batches to get updated data
    if (!user || !recipeId) return;
    try {
      const batchesData = await getBatches(user.uid, recipeId);
      setBatches(batchesData);
      // Update activeBatch if it still exists
      const updated = batchesData.find((b) => b.id === activeBatch?.id);
      if (updated) {
        setActiveBatch(updated);
      }
    } catch (error) {
      console.error("Error reloading batches:", error);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
    return "N/A";
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      brewing: "bg-yellow-600",
      fermenting: "bg-blue-600",
      conditioning: "bg-purple-600",
      completed: "bg-green-600",
    };
    return <Badge className={colors[status] || "bg-gray-600"}>{status}</Badge>;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#FFBF00]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold mb-4">Login Required</h2>
              <p className="text-muted-foreground mb-6">Please login to view recipe details</p>
              <Link href="/">
                <Button className="bg-[#FFBF00] text-black hover:bg-[#FFBF00]/90">Go to Home</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="min-h-screen bg-background px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Card>
            <CardContent className="pt-6">
              <Beaker className="h-16 w-16 text-muted-foreground opacity-50 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Recipe not found</h2>
              <p className="text-muted-foreground mb-6">
                The recipe you're looking for doesn't exist or has been deleted.
              </p>
              <Link href="/my-recipes">
                <Button variant="outline">Back to Recipes</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Convert RecipeData to Recipe format for RecipeCard
  const recipeForCard = {
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
    estimatedTime: recipe.estimatedTime || "",
    notes: recipe.notes || "",
  };

  // Get next batch number
  const nextBatchNumber = batches.length + 1;

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header with Back Button, Expert Mode, and Settings */}
        <div className="mb-6 flex items-center justify-between">
          <Link href="/my-recipes">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Recipes
            </Button>
          </Link>
          <div className="flex items-center gap-3 mb-4">
            {/* Expert Mode Toggle */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-zinc-700 bg-zinc-900/50">
              <FlaskConical className="h-4 w-4 text-[#FFBF00]" />
              <Label htmlFor="expert-mode-detail" className="text-sm cursor-pointer">
                Expert Mode
              </Label>
              <Switch
                id="expert-mode-detail"
                checked={isExpertMode}
                onCheckedChange={setIsExpertMode}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRecipeSettings(!showRecipeSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Recipe Settings (Collapsible) */}
        {showRecipeSettings && (
          <Card className="mb-6 border-red-500/20 bg-red-950/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-1">Recipe Settings</h3>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete this recipe. This action cannot be undone.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isDeleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Delete Recipe
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CONDITIONAL RENDERING: Show link to batch detail page if active batch exists */}
        {activeBatch && (
          <Card className="mb-6 bg-gradient-to-r from-[#FFBF00]/20 to-[#FFBF00]/10 border-[#FFBF00]/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-1 text-[#FFBF00] flex items-center gap-2">
                    <Beaker className="h-5 w-5" />
                    Active Batch #{activeBatch.batchNumber} - {activeBatch.status}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    View fermentation dashboard and track progress
                  </p>
                </div>
                <Link href={`/my-recipes/${recipeId}/batch/${activeBatch.id}`}>
                  <Button className="bg-[#FFBF00] text-black hover:bg-[#FFBF00]/90">
                    View Batch Dashboard
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recipe Card (Static - Target Values) - Show below active batch or if no active batch */}
        <div className="mb-6">
          <RecipeCard recipe={recipeForCard} units="metric" recipeId={recipeId} userId={user?.uid} />
        </div>

        {/* Action Buttons - Only show if NO active batch */}
        {!activeBatch && (
          <div className="grid gap-4 md:grid-cols-2 mb-8">
            {/* Edit / Create Version */}
            <Card className="border-[#FFBF00]/30 bg-gradient-to-r from-[#FFBF00]/10 to-[#FFBF00]/5">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold mb-1 text-[#FFBF00] flex items-center gap-2">
                      <Edit className="h-5 w-5" />
                      Edit Recipe
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Create a new version to modify this recipe without losing the original.
                    </p>
                  </div>
                  <Button
                    onClick={handleCreateVersion}
                    disabled={isCreatingVersion}
                    variant="outline"
                    className="border-[#FFBF00] text-[#FFBF00] hover:bg-[#FFBF00] hover:text-black"
                  >
                    {isCreatingVersion ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Copy className="mr-2 h-4 w-4" />
                    )}
                    Create Version
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Start Brew Session */}
            <Card className="border-[#4CBB17]/30 bg-gradient-to-r from-[#4CBB17]/10 to-[#4CBB17]/5">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold mb-1 text-[#4CBB17] flex items-center gap-2">
                      <Beaker className="h-5 w-5" />
                      Start New Batch
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Start a new batch (#{nextBatchNumber}) and begin brewing.
                    </p>
                  </div>
                  <Link href={`/brew/${recipeId}`}>
                    <Button
                      onClick={handleStartBrewSession}
                      disabled={isStartingBatch}
                      className="bg-[#4CBB17] text-white hover:bg-[#4CBB17]/90"
                    >
                      {isStartingBatch ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      Start Batch #{nextBatchNumber}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Brewing History */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2 text-[#FFBF00]">
              <History className="h-6 w-6" />
              Brewing History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingBatches ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[#FFBF00] mx-auto" />
              </div>
            ) : batches.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No batches yet. Start your first brew session!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-700">
                      <th className="text-left p-3 text-sm font-semibold">Batch #</th>
                      <th className="text-left p-3 text-sm font-semibold">Started</th>
                      <th className="text-left p-3 text-sm font-semibold">Status</th>
                      <th className="text-left p-3 text-sm font-semibold">Measured OG</th>
                      <th className="text-left p-3 text-sm font-semibold">Measured FG</th>
                      <th className="text-left p-3 text-sm font-semibold">Rating</th>
                      <th className="text-left p-3 text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((batch) => (
                      <tr key={batch.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                        <td className="p-3 font-semibold">#{batch.batchNumber}</td>
                        <td className="p-3">{formatDate(batch.startedAt)}</td>
                        <td className="p-3">{getStatusBadge(batch.status)}</td>
                        <td className="p-3">
                          {batch.brewLog?.measuredOG ? batch.brewLog.measuredOG.toFixed(3) : "—"}
                        </td>
                        <td className="p-3">
                          {batch.brewLog?.measuredFG ? batch.brewLog.measuredFG.toFixed(3) : "—"}
                        </td>
                        <td className="p-3">
                          {batch.rating ? (
                            <div className="flex items-center gap-1">
                              <span className="text-yellow-500">★</span>
                              <span>{batch.rating}/5</span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewBatch(batch)}
                            >
                              View
                            </Button>
                            {batch.status !== "completed" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteBatch(batch.id)}
                                disabled={isDeletingBatch === batch.id}
                                className="text-red-400 hover:text-red-300"
                              >
                                {isDeletingBatch === batch.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <X className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottling Wizard Dialog */}
        <Dialog open={showBottlingWizard} onOpenChange={setShowBottlingWizard}>
          <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2 text-[#FFBF00]">
                <Calculator className="h-6 w-6" />
                Bottling Calculator
              </DialogTitle>
              <DialogDescription>
                Calculate the exact amount of sugar or speise needed for carbonation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Target CO2 (vol)</Label>
                <div className="px-2">
                  <Slider
                    value={[parseFloat(targetCO2) || 2.4]}
                    onValueChange={(vals) => setTargetCO2(vals[0].toString())}
                    min={3.0}
                    max={7.0}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>3.0</span>
                    <span className="font-semibold text-[#FFBF00]">{targetCO2} vol</span>
                    <span>7.0</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Beer Temperature (°C)</Label>
                  <Input
                    type="number"
                    value={beerTemp}
                    onChange={(e) => setBeerTemp(e.target.value)}
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bottling Volume (L)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={bottlingVolume}
                    onChange={(e) => setBottlingVolume(e.target.value)}
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Carbonation Method</Label>
                <Select
                  value={carbonationMethod}
                  onValueChange={(v: any) => setCarbonationMethod(v)}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="priming">Priming (Sugar Addition)</SelectItem>
                    {isExpertMode && (
                      <SelectItem value="spunding">
                        Spunding (Pressure Fermentation) - Expert
                      </SelectItem>
                    )}
                    <SelectItem value="forced">Forced Carbonation (KEG)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {carbonationMethod === "priming" && (
                <div className="space-y-2">
                  <Label>Sugar Type</Label>
                  <Select value={carbonationType} onValueChange={(v: any) => setCarbonationType(v)}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sugar">Household Sugar (Sucrose)</SelectItem>
                      <SelectItem value="dextrose">Dextrose (Glucose)</SelectItem>
                      <SelectItem value="drops">Carbonation Drops</SelectItem>
                      <SelectItem value="speise" disabled>Speise (Gyle) - Experimental</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Calculation Result */}
              {carbonationMethod === "priming" &&
                activeBatch &&
                (() => {
                  // Helper: Calculate residual CO2 based on temperature (in g/L)
                  // Vereinfachte Näherung für Hobbybrauer
                  const getResidualCO2 = (tempC: number): number => {
                    return 1.57 * Math.pow(0.97, tempC);
                  };

                  // Calculate sugar needed for carbonation
                  const calculateSugar = (
                    volumeL: number,
                    tempC: number,
                    targetCO2gL: number
                  ): number => {
                    const residualCO2 = getResidualCO2(tempC);
                    const neededCO2 = Math.max(0, targetCO2gL - residualCO2);
                    // 1g Haushaltszucker (Saccharose) erzeugt ca. 0.495g CO2
                    const sugarNeededGrams = (neededCO2 * volumeL) / 0.495;
                    return Math.round(sugarNeededGrams * 10) / 10; // Auf 1 Dezimalstelle runden
                  };

                  const targetCO2Value = parseFloat(targetCO2) || 2.4;
                  const tempValue = parseFloat(beerTemp) || 20;
                  // CRITICAL: Use bottlingVolume from input field (user can modify)
                  const volumeValue = parseFloat(bottlingVolume) || 20;

                  let result: {
                    sugar?: number;
                    dextrose?: number;
                    drops?: number;
                  } = {};

                  // Calculate dosing rate (per liter, independent of total volume)
                  let dosingRate: number | null = null;

                  if (carbonationType === "dextrose") {
                    // Dextrose (Glucose) erzeugt etwas weniger CO2, Faktor 0.5 statt 0.495
                    const residualCO2 = getResidualCO2(tempValue);
                    const neededCO2 = Math.max(0, targetCO2Value - residualCO2);
                    const dextroseNeeded = (neededCO2 * volumeValue) / 0.5;
                    result.dextrose = Math.round(dextroseNeeded * 10) / 10;
                    // Calculate dosing rate: per liter
                    dosingRate = (neededCO2 * 1) / 0.5; // For 1 liter
                    dosingRate = Math.round(dosingRate * 10) / 10;
                  } else if (carbonationType === "drops") {
                    const bottles = (volumeValue * 1000) / 330;
                    result.drops = Math.ceil(bottles);
                  } else {
                    // Default: Household Sugar (Sucrose)
                    result.sugar = calculateSugar(volumeValue, tempValue, targetCO2Value);
                    // Calculate dosing rate: per liter (calculate for 1L directly for precision)
                    const residualCO2 = getResidualCO2(tempValue);
                    const neededCO2 = Math.max(0, targetCO2Value - residualCO2);
                    dosingRate = (neededCO2 * 1) / 0.495; // For 1 liter
                    dosingRate = Math.round(dosingRate * 10) / 10;
                  }

                  return (
                    <div className="bg-[#FFBF00]/10 p-6 rounded-lg border border-[#FFBF00]">
                      <h3 className="text-[#FFBF00] font-bold uppercase text-xs tracking-wider mb-4 text-center">Ergebnis</h3>
                      {result.sugar && (
                        <div className="space-y-3">
                          {/* Hauptwert: Total für den Batch */}
                          <div className="text-3xl font-bold text-white text-center">
                            {result.sugar.toFixed(1)}g <span className="text-sm font-normal text-muted-foreground">Total</span>
                          </div>
                          {/* Dosierrate */}
                          <div className="flex justify-center items-center gap-2 text-sm">
                            <span className="text-zinc-400">Dosierrate:</span>
                            <span className="font-mono font-bold text-[#FFBF00] bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700">
                              {dosingRate?.toFixed(1)} g/L
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-2 text-center">
                            In kochendem Wasser auflösen und im Abfülleimer vorlegen.
                          </p>
                        </div>
                      )}
                      {result.dextrose && (
                        <div className="space-y-3">
                          {/* Hauptwert: Total für den Batch */}
                          <div className="text-3xl font-bold text-white text-center">
                            {result.dextrose.toFixed(1)}g <span className="text-sm font-normal text-muted-foreground">Total</span>
                          </div>
                          {/* Dosierrate */}
                          <div className="flex justify-center items-center gap-2 text-sm">
                            <span className="text-zinc-400">Dosierrate:</span>
                            <span className="font-mono font-bold text-[#FFBF00] bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700">
                              {dosingRate?.toFixed(1)} g/L
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-2 text-center">
                            In kochendem Wasser auflösen und im Abfülleimer vorlegen.
                          </p>
                        </div>
                      )}
                      {result.drops && (
                        <div className="space-y-3">
                          <div className="text-3xl font-bold text-white text-center">
                            <span className="text-[#FFBF00]">{result.drops}</span> <span className="text-sm font-normal text-muted-foreground">Drops</span>
                          </div>
                          <p className="text-sm text-zinc-400 text-center">
                            (1 per 330ml bottle)
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBottlingWizard(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!user || !activeBatch) return;
                  try {
                    // Helper: Calculate residual CO2 based on temperature (in g/L)
                    const getResidualCO2 = (tempC: number): number => {
                      return 1.57 * Math.pow(0.97, tempC);
                    };

                    // Calculate sugar needed for carbonation
                    const calculateSugar = (
                      volumeL: number,
                      tempC: number,
                      targetCO2gL: number
                    ): number => {
                      const residualCO2 = getResidualCO2(tempC);
                      const neededCO2 = Math.max(0, targetCO2gL - residualCO2);
                      const sugarNeededGrams = (neededCO2 * volumeL) / 0.495;
                      return Math.round(sugarNeededGrams * 10) / 10;
                    };

                    const targetCO2Value = parseFloat(targetCO2) || 2.4;
                    const tempValue = parseFloat(beerTemp) || 20;
                    // CRITICAL: Use bottlingVolume from input field
                    const volumeValue = parseFloat(bottlingVolume) || 20;

                    let carbonationAmount = 0;
                    if (carbonationType === "dextrose") {
                      const residualCO2 = getResidualCO2(tempValue);
                      const neededCO2 = Math.max(0, targetCO2Value - residualCO2);
                      carbonationAmount = (neededCO2 * volumeValue) / 0.5;
                      carbonationAmount = Math.round(carbonationAmount * 10) / 10;
                    } else if (carbonationType === "drops") {
                      carbonationAmount = Math.ceil((volumeValue * 1000) / 330);
                    } else {
                      // Default: Household Sugar (Sucrose)
                      carbonationAmount = calculateSugar(volumeValue, tempValue, targetCO2Value);
                    }

                    await updateBatch(user.uid, recipeId, activeBatch.id, {
                      status: "conditioning",
                      carbonationMethod: carbonationMethod,
                      brewLog: {
                        ...activeBatch.brewLog,
                        carbonationType:
                          carbonationMethod === "priming"
                            ? carbonationType !== "spunding"
                              ? carbonationType
                              : "sugar"
                            : undefined,
                        carbonationAmount:
                          carbonationMethod === "priming" ? carbonationAmount : undefined,
                        bottlingDate: new Date() as any,
                      },
                    });
                    toast.success("Bottling completed! Batch moved to conditioning.");
                    setShowBottlingWizard(false);
                    setShowRatingModal(true);
                    await handleBatchUpdate();
                  } catch (error) {
                    toast.error("Error saving");
                  }
                }}
                className="bg-[#4CBB17] text-white hover:bg-[#4CBB17]/90"
              >
                Bottling Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rating Modal */}
        <Dialog open={showRatingModal} onOpenChange={setShowRatingModal}>
          <DialogContent className="bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2 text-[#FFBF00]">
                <Star className="h-6 w-6" />
                How did it turn out?
              </DialogTitle>
              <DialogDescription>Rate your batch and add tasting notes.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Rating</Label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className={`text-3xl ${
                        star <= rating ? "text-yellow-500" : "text-gray-500"
                      } hover:text-yellow-400 transition-colors`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="ml-2 text-sm text-muted-foreground">
                    {rating > 0 ? `${rating}/5` : "No rating"}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tasting Notes</Label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Describe the aroma, flavor, mouthfeel, and overall impression..."
                  className="bg-zinc-800 border-zinc-700 min-h-[120px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRatingModal(false)}>
                Skip
              </Button>
              <Button
                onClick={async () => {
                  if (!user || !activeBatch) return;
                  try {
                    await updateBatch(user.uid, recipeId, activeBatch.id, {
                      status: "completed",
                      rating: rating > 0 ? rating : undefined,
                      reviewNotes: reviewNotes || undefined,
                      completedAt: new Date() as any,
                    });
                    toast.success("Review saved! Batch completed.");
                    setShowRatingModal(false);
                    setRating(0);
                    setReviewNotes("");
                    await handleBatchUpdate();
                  } catch (error) {
                    toast.error("Error saving review");
                  }
                }}
                className="bg-[#FFBF00] text-black hover:bg-[#FFBF00]/90"
              >
                Save Review
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
