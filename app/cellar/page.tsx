"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserRecipes, getBatches, updateBatch, BatchData, RecipeData } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Frown, Wine, Star, Archive } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { calculateMaturity, MaturityInfo } from "@/lib/maturity";
import { Timestamp } from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function CellarPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [completedBatches, setCompletedBatches] = useState<
    Array<{
      batch: BatchData & { id: string };
      recipe: RecipeData & { id: string };
      maturity: MaturityInfo | null;
    }>
  >([]);
  const [ratingBatch, setRatingBatch] = useState<(BatchData & { id: string }) | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewNotes, setReviewNotes] = useState("");

  useEffect(() => {
    if (user && !authLoading) {
      loadCellar();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [user, authLoading]);

  const loadCellar = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      const recipes = await getUserRecipes(user.uid);
      const allBatches: Array<{
        batch: BatchData & { id: string };
        recipe: RecipeData & { id: string };
        maturity: MaturityInfo | null;
      }> = [];

      for (const recipe of recipes) {
        const batches = await getBatches(user.uid, recipe.id);
        for (const batch of batches) {
          if (batch.status === "completed" && !batch.isArchived && batch.bottledDate) {
            const bottledDate = batch.bottledDate instanceof Timestamp
              ? batch.bottledDate.toDate()
              : new Date(batch.bottledDate);
            
            // Try to extract beer style from recipe name or use recipe name as fallback
            const beerStyle = batch.recipeSnapshot?.beerStyle || 
                             recipe.name.match(/(IPA|Stout|Porter|Pilsner|Lager|Wheat|Ale|Belgian|Sour|Barleywine)/i)?.[0] ||
                             recipe.name;
            // Use recipe conditioning days if available, otherwise fallback to style-based calculation
            const maturity = calculateMaturity(
              bottledDate, 
              recipe.conditioning_days_min,
              recipe.conditioning_days_max,
              beerStyle
            );
            
            allBatches.push({ batch, recipe, maturity });
          }
        }
      }

      // Sort by bottled date (newest first)
      allBatches.sort((a, b) => {
        const dateA = a.batch.bottledDate instanceof Timestamp
          ? a.batch.bottledDate.toDate()
          : new Date(a.batch.bottledDate || 0);
        const dateB = b.batch.bottledDate instanceof Timestamp
          ? b.batch.bottledDate.toDate()
          : new Date(b.batch.bottledDate || 0);
        return dateB.getTime() - dateA.getTime();
      });

      setCompletedBatches(allBatches);
    } catch (error) {
      console.error("Error loading cellar:", error);
      toast.error("Failed to load cellar");
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveBatch = async (batch: BatchData & { id: string }, recipeId: string) => {
    setRatingBatch(batch);
    setRating(0);
    setReviewNotes("");
  };

  const handleSubmitRating = async () => {
    if (!user || !ratingBatch) return;

    // Find the recipe ID for this batch
    const batchInfo = completedBatches.find((b) => b.batch.id === ratingBatch.id);
    if (!batchInfo) {
      toast.error("Recipe not found for batch");
      return;
    }

    try {
      await updateBatch(user.uid, batchInfo.recipe.id, ratingBatch.id, {
        isArchived: true,
        rating: rating > 0 ? rating : undefined,
        reviewNotes: reviewNotes || undefined,
      });
      
      toast.success("Batch archived and rated!");
      setRatingBatch(null);
      await loadCellar();
    } catch (error) {
      console.error("Error archiving batch:", error);
      toast.error("Failed to archive batch");
    }
  };

  const formatDate = (date: Date | Timestamp | undefined): string => {
    if (!date) return "N/A";
    const d = date instanceof Timestamp ? date.toDate() : date;
    return d.toLocaleDateString("de-DE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (maturity: MaturityInfo | null) => {
    if (!maturity) {
      return <Badge variant="outline">Unknown</Badge>;
    }

    const colors = {
      yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      green: "bg-green-500/20 text-green-400 border-green-500/30",
      red: "bg-red-500/20 text-red-400 border-red-500/30",
    };

    const labels = {
      maturing: `Reifend (${maturity.daysUntilReady} Tage)`,
      optimal: "Trinkreif",
      overaged: "Überlagert",
    };

    return (
      <Badge className={colors[maturity.statusColor]} variant="outline">
        {labels[maturity.status]}
      </Badge>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="h-10 w-10 animate-spin text-[#FFBF00]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-zinc-950 text-white gap-4 p-4 text-center">
        <Frown className="h-16 w-16 text-zinc-700" />
        <h1 className="text-2xl font-bold text-red-500">Please log in</h1>
        <Link href="/login">
          <Button variant="outline">Go to Login</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-[#FFBF00] flex items-center gap-3">
              <Wine className="h-10 w-10" />
              The Cellar
            </h1>
            <p className="text-zinc-400 mt-2">Your bottled batches and maturity status</p>
          </div>
        </div>

        {completedBatches.length === 0 ? (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-12 text-center">
              <Wine className="h-16 w-16 text-zinc-700 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-zinc-300 mb-2">Your cellar is empty</h2>
              <p className="text-zinc-500 mb-4">Complete a batch to see it here</p>
              <Link href="/my-recipes">
                <Button variant="outline">View My Recipes</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedBatches.map(({ batch, recipe, maturity }) => (
              <Card key={batch.id} className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl text-[#FFBF00] mb-1">{recipe.name}</CardTitle>
                      <p className="text-sm text-zinc-400">Batch #{batch.batchNumber}</p>
                    </div>
                    {getStatusBadge(maturity)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Bottled:</span>
                    <span className="text-white">
                      {formatDate(batch.bottledDate instanceof Timestamp ? batch.bottledDate.toDate() : batch.bottledDate)}
                    </span>
                  </div>
                  
                  {maturity && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-400">Ready:</span>
                        <span className="text-white">{formatDate(maturity.readyDate)}</span>
                      </div>
                      {maturity.status === "optimal" && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-400">Best before:</span>
                          <span className="text-white">{formatDate(maturity.expiryDate)}</span>
                        </div>
                      )}
                      {maturity.status === "maturing" && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-400">Days until ready:</span>
                          <span className="text-[#FFBF00] font-semibold">{maturity.daysUntilReady}</span>
                        </div>
                      )}
                      {maturity.status === "overaged" && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-400">Overaged by:</span>
                          <span className="text-red-400 font-semibold">{Math.abs(maturity.daysUntilExpiry)} days</span>
                        </div>
                      )}
                    </>
                  )}

                  {batch.bottledVolume && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400">Volume:</span>
                      <span className="text-white">{batch.bottledVolume.toFixed(1)} L</span>
                    </div>
                  )}

                  {batch.bottleCount && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400">Bottles:</span>
                      <span className="text-white">{batch.bottleCount}</span>
                    </div>
                  )}

                  {batch.rating && (
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < batch.rating! ? "text-[#FFBF00] fill-[#FFBF00]" : "text-zinc-600"}`}
                        />
                      ))}
                    </div>
                  )}

                  <Button
                    onClick={() => handleArchiveBatch(batch, recipe.id)}
                    variant="outline"
                    className="w-full mt-4 border-zinc-700 hover:bg-zinc-800 hover:border-zinc-600"
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Batch leer
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Rating Modal */}
        <Dialog open={!!ratingBatch} onOpenChange={(open) => !open && setRatingBatch(null)}>
          <DialogContent className="bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2 text-[#FFBF00]">
                <Star className="h-6 w-6" />
                How did it turn out?
              </DialogTitle>
              <DialogDescription>Rate your batch and add tasting notes before archiving.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Rating</Label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="focus:outline-none"
                    >
                      <Star
                        className={`h-8 w-8 transition-colors ${
                          star <= rating
                            ? "text-[#FFBF00] fill-[#FFBF00]"
                            : "text-zinc-600 hover:text-zinc-400"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tasting Notes</Label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Describe the taste, aroma, appearance..."
                  className="bg-zinc-800 border-zinc-700 min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRatingBatch(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmitRating}
                className="bg-[#FFBF00] text-black hover:bg-[#E5AC00]"
              >
                Archive & Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

