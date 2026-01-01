"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getRecipe, getBatch, RecipeData, BatchData } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Download, Share2, Calendar, Beaker, TrendingUp, Clock, Package, Droplets, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Timestamp } from "firebase/firestore";
import { Badge } from "@/components/ui/badge";

export default function BrewReportPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const batchId = params.batchId as string;
  const recipeId = searchParams.get("recipeId") as string;

  const [recipe, setRecipe] = useState<(RecipeData & { id: string }) | null>(null);
  const [batch, setBatch] = useState<(BatchData & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !recipeId || !batchId) return;

      try {
        const [recipeData, batchData] = await Promise.all([
          getRecipe(user.uid, recipeId),
          getBatch(user.uid, recipeId, batchId),
        ]);

        if (!recipeData || !batchData) {
          toast.error("Batch or recipe not found");
          router.push("/my-recipes");
          return;
        }

        setRecipe(recipeData);
        setBatch(batchData);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Error loading brew report");
        router.push("/my-recipes");
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && user) {
      fetchData();
    }
  }, [user, recipeId, batchId, authLoading, router]);

  // Helper: Calculate ABV from OG and FG
  const calculateABV = (og: number, fg: number): number => {
    return parseFloat(((og - fg) * 131.25).toFixed(1));
  };

  // Helper: Format date
  const formatDate = (timestamp: Timestamp | Date | undefined): string => {
    if (!timestamp) return "N/A";
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
    return date.toLocaleDateString("de-DE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Helper: Calculate fermentation duration
  const getFermentationDuration = (): string => {
    if (!batch?.startedAt || !batch?.completedAt) return "N/A";
    const start = batch.startedAt instanceof Timestamp ? batch.startedAt.toDate() : batch.startedAt;
    const end = batch.completedAt instanceof Timestamp ? batch.completedAt.toDate() : batch.completedAt;
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return `${diffDays} days`;
  };

  // Helper: Format gravity value
  const formatGravity = (value: number | undefined): string => {
    if (!value) return "N/A";
    return value.toFixed(3);
  };

  // Helper: Get target OG from recipe
  const getTargetOG = (): number | null => {
    if (batch?.recipeSnapshot?.targetOG) return batch.recipeSnapshot.targetOG;
    if (recipe?.specs?.og) {
      const ogStr = recipe.specs.og.toString().replace(/[^\d.]/g, "");
      const og = parseFloat(ogStr);
      return isNaN(og) ? null : og;
    }
    if (recipe?.specs?.original_gravity) {
      const ogStr = recipe.specs.original_gravity.toString().replace(/[^\d.]/g, "");
      const og = parseFloat(ogStr);
      return isNaN(og) ? null : og;
    }
    return null;
  };

  // Helper: Get target FG from recipe
  const getTargetFG = (): number | null => {
    if (batch?.recipeSnapshot?.targetFG) return batch.recipeSnapshot.targetFG;
    if (recipe?.specs?.fg) {
      const fgStr = recipe.specs.fg.toString().replace(/[^\d.]/g, "");
      const fg = parseFloat(fgStr);
      return isNaN(fg) ? null : fg;
    }
    if (recipe?.specs?.final_gravity) {
      const fgStr = recipe.specs.final_gravity.toString().replace(/[^\d.]/g, "");
      const fg = parseFloat(fgStr);
      return isNaN(fg) ? null : fg;
    }
    return null;
  };

  // Helper: Calculate actual ABV
  const getActualABV = (): number | null => {
    const og = batch?.brewLog?.measuredOG;
    const fg = batch?.brewLog?.measuredFG;
    if (!og || !fg) return null;
    return calculateABV(og, fg);
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="h-10 w-10 animate-spin text-[#FFBF00]" />
      </div>
    );
  }

  if (!recipe || !batch) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-zinc-950 text-white gap-4 p-4 text-center">
        <h1 className="text-2xl font-bold text-red-500">Report not found</h1>
        <Link href="/my-recipes">
          <Button variant="outline">Back to My Recipes</Button>
        </Link>
      </div>
    );
  }

  const targetOG = getTargetOG();
  const targetFG = getTargetFG();
  const actualABV = getActualABV();

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/my-recipes">
            <Button variant="ghost" className="text-zinc-400 hover:text-white pl-0 mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to My Recipes
            </Button>
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-4xl font-bold text-[#FFBF00] mb-2">{recipe.name}</h1>
              <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Brew Date: {formatDate(batch.startedAt)}</span>
                </div>
                {batch.completedAt && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Bottled: {formatDate(batch.completedAt)}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  // TODO: Implement PDF download
                  toast.info("PDF download coming soon!");
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const url = window.location.href;
                    await navigator.clipboard.writeText(url);
                    toast.success("Report link copied to clipboard!");
                  } catch (error) {
                    toast.error("Failed to copy link");
                  }
                }}
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
            </div>
          </div>
        </div>

        {/* Vital Stats: Soll vs. Ist */}
        <Card className="bg-zinc-900 border-zinc-800 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#FFBF00]">
              <TrendingUp className="h-5 w-5" />
              Vital Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Original Gravity */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase">Original Gravity (OG)</h3>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Target:</span>
                    <span className="font-mono">{targetOG ? formatGravity(targetOG) : "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Actual:</span>
                    <span className={`font-mono font-bold ${batch.brewLog?.measuredOG ? "text-[#FFBF00]" : "text-zinc-600"}`}>
                      {batch.brewLog?.measuredOG ? formatGravity(batch.brewLog.measuredOG) : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Final Gravity */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase">Final Gravity (FG)</h3>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Target:</span>
                    <span className="font-mono">{targetFG ? formatGravity(targetFG) : "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Actual:</span>
                    <span className={`font-mono font-bold ${batch.brewLog?.measuredFG ? "text-[#FFBF00]" : "text-zinc-600"}`}>
                      {batch.brewLog?.measuredFG ? formatGravity(batch.brewLog.measuredFG) : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* ABV */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase">Alcohol (ABV)</h3>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Target:</span>
                    <span className="font-mono">
                      {batch?.recipeSnapshot?.targetABV 
                        ? `${batch.recipeSnapshot.targetABV.toFixed(1)}%`
                        : recipe?.specs?.abv || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Actual:</span>
                    <span className={`font-mono font-bold text-lg ${actualABV ? "text-[#FFBF00]" : "text-zinc-600"}`}>
                      {actualABV ? `${actualABV.toFixed(1)}%` : "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card className="bg-zinc-900 border-zinc-800 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#FFBF00]">
              <Clock className="h-5 w-5" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Fermentation Duration</span>
                <span className="font-bold text-[#FFBF00]">{getFermentationDuration()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Batch Number</span>
                <Badge variant="secondary" className="bg-[#FFBF00]/20 text-[#FFBF00]">
                  #{batch.batchNumber}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bill of Materials */}
        <Card className="bg-zinc-900 border-zinc-800 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#FFBF00]">
              <Package className="h-5 w-5" />
              Bill of Materials
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Malts */}
              {(recipe.malts || recipe.ingredients?.malts || []).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase mb-3">Malts</h3>
                  <div className="space-y-2">
                    {(recipe.malts || recipe.ingredients?.malts || []).map((malt: any, i: number) => (
                      <div key={i} className="flex justify-between items-center py-2 border-b border-zinc-800">
                        <span>{malt.name}</span>
                        <span className="font-mono text-[#FFBF00]">{malt.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hops */}
              {(recipe.hops || recipe.ingredients?.hops || []).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase mb-3">Hops</h3>
                  <div className="space-y-2">
                    {(recipe.hops || recipe.ingredients?.hops || []).map((hop: any, i: number) => (
                      <div key={i} className="flex justify-between items-center py-2 border-b border-zinc-800">
                        <span>{hop.name} <span className="text-zinc-500 text-sm">({hop.time})</span></span>
                        <span className="font-mono text-[#FFBF00]">{hop.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extras */}
              {recipe.extras && recipe.extras.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase mb-3">Additives & Extras</h3>
                  <div className="space-y-2">
                    {recipe.extras.map((extra: any, i: number) => (
                      <div key={i} className="flex justify-between items-center py-2 border-b border-zinc-800">
                        <span>{extra.name} <span className="text-zinc-500 text-sm">({extra.use})</span></span>
                        <span className="font-mono text-[#FFBF00]">{extra.amount} {extra.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Yeast */}
              {recipe.yeast && (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase mb-3">Yeast</h3>
                  <div className="flex justify-between items-center py-2">
                    <span>{recipe.yeast.name}</span>
                    <span className="font-mono text-[#FFBF00]">{recipe.yeast.amount}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bottling Info */}
        {batch.brewLog?.bottlingDate && (
          <Card className="bg-zinc-900 border-zinc-800 mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#FFBF00]">
                <Droplets className="h-5 w-5" />
                Bottling Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-zinc-400">Final Volume</span>
                  <p className="text-xl font-bold text-[#FFBF00]">
                    {batch.brewLog?.measuredVolume?.toFixed(1) || "N/A"} L
                  </p>
                </div>
                {batch.brewLog?.carbonationAmount && (
                  <div>
                    <span className="text-sm text-zinc-400">Priming Sugar</span>
                    <p className="text-xl font-bold text-[#FFBF00]">
                      {batch.brewLog.carbonationAmount.toFixed(1)}g
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {batch.brewLog.carbonationType || "sugar"}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-sm text-zinc-400">Method</span>
                  <p className="text-lg font-semibold">
                    {batch.carbonationMethod || "priming"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Comments / Notes */}
        {(batch.notes || batch.reviewNotes) && (
          <Card className="bg-zinc-900 border-zinc-800 mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#FFBF00]">
                <MessageSquare className="h-5 w-5" />
                Notes & Comments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {batch.notes && (
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-400 uppercase mb-2">Brewing Notes</h3>
                    <p className="text-zinc-300 whitespace-pre-wrap">{batch.notes}</p>
                  </div>
                )}
                {batch.reviewNotes && (
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-400 uppercase mb-2">Tasting Notes</h3>
                    <p className="text-zinc-300 whitespace-pre-wrap">{batch.reviewNotes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rating */}
        {batch.rating && batch.rating > 0 && (
          <Card className="bg-zinc-900 border-zinc-800 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <span className="text-zinc-400">Rating:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={`text-2xl ${star <= batch.rating! ? "text-[#FFBF00]" : "text-zinc-700"}`}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer Actions */}
        <div className="flex justify-center gap-4 pb-8">
          <Link href="/my-recipes">
            <Button variant="outline" size="lg">
              Back to My Cellar
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

