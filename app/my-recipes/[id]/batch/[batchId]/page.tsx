"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getRecipe, getBatch, RecipeData, BatchData, updateBatch } from "@/lib/db";
import { ActiveBatchDashboard } from "@/components/ActiveBatchDashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, Beaker } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
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
import { Star, Droplets, Calculator } from "lucide-react";

export default function BatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [recipe, setRecipe] = useState<(RecipeData & { id: string }) | null>(null);
  const [batch, setBatch] = useState<(BatchData & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBottlingWizard, setShowBottlingWizard] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [targetCO2, setTargetCO2] = useState("5.0");
  const [beerTemp, setBeerTemp] = useState("20");
  const [bottlingVolume, setBottlingVolume] = useState("");
  const [finalFG, setFinalFG] = useState("");
  const [carbonationType, setCarbonationType] = useState<
    "sugar" | "dextrose" | "speise" | "drops" | "spunding"
  >("sugar");
  const [carbonationMethod, setCarbonationMethod] = useState<"priming" | "spunding" | "forced">(
    "priming"
  );
  const [rating, setRating] = useState(0);
  const [reviewNotes, setReviewNotes] = useState("");
  const recipeId = params.id as string;
  const batchId = params.batchId as string;

  useEffect(() => {
    if (user && !authLoading && recipeId && batchId) {
      loadData();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [user, authLoading, recipeId, batchId]);

  const loadData = async () => {
    if (!user || !recipeId || !batchId) return;
    try {
      setLoading(true);
      const [recipeData, batchData] = await Promise.all([
        getRecipe(user.uid, recipeId),
        getBatch(user.uid, recipeId, batchId),
      ]);

      if (!recipeData) {
        toast.error("Recipe not found");
        router.push("/my-recipes");
        return;
      }

      if (!batchData) {
        toast.error("Batch not found");
        router.push(`/my-recipes/${recipeId}`);
        return;
      }

      setRecipe(recipeData);
      setBatch(batchData);

      if (batchData.brewLog?.measuredVolume) {
        setBottlingVolume(batchData.brewLog.measuredVolume.toString());
      }
      if (batchData.brewLog?.measuredFG) {
        setFinalFG(batchData.brewLog.measuredFG.toString());
      }

      // If batch is in "brewing" status, redirect to brew session page
      if (batchData.status === "brewing") {
        router.push(`/brew/${recipeId}`);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
      router.push(`/my-recipes/${recipeId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchUpdate = async () => {
    // Reload batch to get updated data
    if (!user || !recipeId || !batchId) return;
    try {
      const batchData = await getBatch(user.uid, recipeId, batchId);
      if (batchData) {
        setBatch(batchData);
      }
    } catch (error) {
      console.error("Error reloading batch:", error);
    }
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
              <p className="text-muted-foreground mb-6">Please login to view batch details</p>
              <Link href="/">
                <Button className="bg-[#FFBF00] text-black hover:bg-[#FFBF00]/90">Go to Home</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!recipe || !batch) {
    return (
      <div className="min-h-screen bg-background px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Card>
            <CardContent className="pt-6">
              <Beaker className="h-16 w-16 text-muted-foreground opacity-50 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Batch not found</h2>
              <p className="text-muted-foreground mb-6">
                The batch you're looking for doesn't exist or has been deleted.
              </p>
              <Link href={`/my-recipes/${recipeId}`}>
                <Button variant="outline">Back to Recipe</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header with Back Button */}
        <div className="mb-6">
          <Link href={`/my-recipes/${recipeId}`}>
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Recipe
            </Button>
          </Link>
        </div>

        {/* Active Batch Dashboard - Full Screen Focus */}
        <ActiveBatchDashboard
          batch={batch}
          recipe={recipe}
          recipeId={recipeId}
          onBatchUpdate={handleBatchUpdate}
          onBottlingClick={() => setShowBottlingWizard(true)}
        />

        {/* Bottling Wizard Dialog */}
        <Dialog open={showBottlingWizard} onOpenChange={setShowBottlingWizard}>
          <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2 text-[#FFBF00]">
                <Calculator className="h-6 w-6" />
                Bottling Helper
              </DialogTitle>
              <DialogDescription>
                Calculate the exact amount of sugar or speise needed for carbonation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Final Gravity Input - Required for completion */}
              <div className="space-y-2">
                <Label>Final Gravity (SG) - Required</Label>
                <Input
                  type="text"
                  placeholder="e.g. 1.012"
                  value={finalFG}
                  onChange={(e) => setFinalFG(e.target.value)}
                  className="bg-zinc-800 border-zinc-700"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the final gravity before bottling
                </p>
              </div>

              <div className="space-y-2">
                <Label>Target CO2 (g/L)</Label>
                <div className="px-2">
                  <Slider
                    value={[parseFloat(targetCO2) || 5.0]}
                    onValueChange={(vals) => setTargetCO2(vals[0].toString())}
                    min={3.0}
                    max={7.0}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>3.0</span>
                    <span className="font-semibold text-[#FFBF00]">{targetCO2} g/L</span>
                    <span>7.0</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Young Beer Temperature (°C)</Label>
                  <Input
                    type="number"
                    value={beerTemp}
                    onChange={(e) => setBeerTemp(e.target.value)}
                    placeholder="e.g. 20"
                    className="bg-zinc-800 border-zinc-700"
                  />
                  <p className="text-xs text-muted-foreground">
                    Important for residual CO2 calculation
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Bottling Volume (L)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={bottlingVolume}
                    onChange={(e) => setBottlingVolume(e.target.value)}
                    placeholder="e.g. 20"
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
                    <SelectItem value="spunding" disabled>
                      Spunding (Pressure Fermentation) - Beta
                    </SelectItem>
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
                      <SelectItem value="speise">Speise (Gyle)</SelectItem>
                      <SelectItem value="drops">Carbonation Drops</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Calculation Result */}
              {carbonationMethod === "priming" &&
                batch &&
                (() => {
                  const targetCO2Value = parseFloat(targetCO2) || 2.4;
                  const tempValue = parseFloat(beerTemp) || 20;
                  const volumeValue =
                    parseFloat(bottlingVolume) || batch.brewLog?.measuredVolume || 20;
                  const restCO2 =
                    3.0378 - 0.05007 * tempValue + 0.00026555 * tempValue * tempValue;
                  const neededCO2 = targetCO2Value - restCO2;

                  let result: {
                    sugar?: number;
                    dextrose?: number;
                    speise?: number;
                    drops?: number;
                  } = {};

                  if (carbonationType === "speise") {
                    const measuredOGValue = batch.brewLog?.measuredOG || 1.050;
                    const extractPlato = (measuredOGValue - 1) * 250;
                    const speiseNeeded = (neededCO2 * volumeValue) / (extractPlato * 0.5);
                    result.speise = speiseNeeded;
                    // Also calculate sugar equivalent for display
                    result.sugar = neededCO2 * volumeValue * 4;
                  } else if (carbonationType === "dextrose") {
                    const sugarNeeded = (neededCO2 * volumeValue * 4) / 1.15;
                    result.dextrose = sugarNeeded;
                  } else if (carbonationType === "drops") {
                    const bottles = (volumeValue * 1000) / 330;
                    result.drops = Math.ceil(bottles);
                  } else {
                    const sugarNeeded = neededCO2 * volumeValue * 4;
                    result.sugar = sugarNeeded;
                    // Also calculate speise equivalent if we have OG
                    if (batch.brewLog?.measuredOG) {
                      const measuredOGValue = batch.brewLog.measuredOG;
                      const extractPlato = (measuredOGValue - 1) * 250;
                      result.speise = (neededCO2 * volumeValue) / (extractPlato * 0.5);
                    }
                  }

                  return (
                    <div className="p-6 bg-[#FFBF00]/10 border border-[#FFBF00] rounded-lg">
                      <h3 className="text-lg font-bold mb-3 text-[#FFBF00]">Result:</h3>
                      {result.sugar && (
                        <p className="text-2xl font-bold text-center">
                          Add <span className="text-[#FFBF00]">{result.sugar.toFixed(0)}g</span> sugar
                        </p>
                      )}
                      {result.dextrose && (
                        <p className="text-2xl font-bold text-center">
                          Add <span className="text-[#FFBF00]">{result.dextrose.toFixed(0)}g</span>{" "}
                          dextrose
                        </p>
                      )}
                      {result.speise && (
                        <p className="text-2xl font-bold text-center">
                          Add <span className="text-[#FFBF00]">{result.speise.toFixed(2)}L</span> speise
                        </p>
                      )}
                      {result.drops && (
                        <p className="text-2xl font-bold text-center">
                          Use <span className="text-[#FFBF00]">{result.drops}</span> carbonation drops
                          (1 per 330ml bottle).
                        </p>
                      )}
                      {carbonationType === "sugar" && result.sugar && result.speise && (
                        <p className="text-lg text-center mt-2 text-muted-foreground">
                          OR {result.speise.toFixed(2)}L Speise
                        </p>
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
                  if (!user || !batch) return;
                  
                  // Validate final gravity
                  if (!finalFG) {
                    toast.error("Please enter the final gravity (FG) before completing bottling.");
                    return;
                  }
                  
                  const finalFGValue = parseFloat(finalFG.replace(/[^\d.]/g, ""));
                  if (isNaN(finalFGValue) || finalFGValue <= 0) {
                    toast.error("Please enter a valid final gravity value.");
                    return;
                  }

                  try {
                    const targetCO2Value = parseFloat(targetCO2) || 5.0;
                    const volumeValue =
                      parseFloat(bottlingVolume) || batch.brewLog?.measuredVolume || 20;
                    const tempValue = parseFloat(beerTemp) || 20;
                    const restCO2 =
                      3.0378 - 0.05007 * tempValue + 0.00026555 * tempValue * tempValue;
                    const neededCO2 = targetCO2Value - restCO2;

                    let carbonationAmount = 0;
                    if (carbonationType === "speise") {
                      const measuredOGValue = batch.brewLog?.measuredOG || 1.050;
                      const extractPlato = (measuredOGValue - 1) * 250;
                      carbonationAmount = (neededCO2 * volumeValue) / (extractPlato * 0.5);
                    } else if (carbonationType === "dextrose") {
                      carbonationAmount = (neededCO2 * volumeValue * 4) / 1.15;
                    } else if (carbonationType === "drops") {
                      carbonationAmount = Math.ceil((volumeValue * 1000) / 330);
                    } else {
                      carbonationAmount = neededCO2 * volumeValue * 4;
                    }

                    await updateBatch(user.uid, recipeId, batch.id, {
                      status: "conditioning",
                      carbonationMethod: carbonationMethod,
                      brewLog: {
                        ...batch.brewLog,
                        measuredFG: finalFGValue, // Save final gravity
                        measuredVolume: volumeValue, // Update volume if changed
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
                Bottling Complete & Finish Batch
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
                  if (!user || !batch) return;
                  try {
                    await updateBatch(user.uid, recipeId, batch.id, {
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
                    // Redirect back to recipe page after completion
                    router.push(`/my-recipes/${recipeId}`);
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

