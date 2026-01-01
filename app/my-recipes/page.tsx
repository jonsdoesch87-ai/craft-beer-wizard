"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getUserRecipes, updateRecipeRating, deleteRecipe, RecipeData } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Trash2, Calendar, Beaker, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

function MyRecipesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, refreshUserProfile } = useAuth();
  const [recipes, setRecipes] = useState<(RecipeData & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (user && !authLoading) {
      loadRecipes();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [user, authLoading]);

  // Handle successful checkout redirect
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (sessionId && user) {
      // Refresh user profile to check if upgrade was successful
      refreshUserProfile().then(() => {
        toast.success("Welcome to Craft Beer Wizard Pro! 🎉");
        // Remove session_id from URL
        router.replace("/my-recipes");
      });
    }
    const canceled = searchParams.get("canceled");
    if (canceled === "true") {
      toast.info("Checkout canceled");
      router.replace("/my-recipes");
    }
  }, [searchParams, user, refreshUserProfile, router]);

  const loadRecipes = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const userRecipes = await getUserRecipes(user.uid);
      setRecipes(userRecipes);
    } catch (error) {
      console.error("Error loading recipes:", error);
      toast.error("Failed to load recipes");
    } finally {
      setLoading(false);
    }
  };

  const handleRateRecipe = async () => {
    if (!user || !selectedRecipe || rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    try {
      await updateRecipeRating(user.uid, selectedRecipe, rating, reviewNotes);
      toast.success("Rating saved!");
      setIsDialogOpen(false);
      setRating(0);
      setReviewNotes("");
      setSelectedRecipe(null);
      loadRecipes();
    } catch (error) {
      console.error("Error updating rating:", error);
      toast.error("Failed to save rating");
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    if (!user) return;
    if (!confirm("Are you sure you want to delete this recipe?")) return;

    try {
      await deleteRecipe(user.uid, recipeId);
      toast.success("Recipe deleted");
      loadRecipes();
    } catch (error) {
      console.error("Error deleting recipe:", error);
      toast.error("Failed to delete recipe");
    }
  };

  const openRatingDialog = (recipeId: string, currentRating?: number, currentNotes?: string) => {
    setSelectedRecipe(recipeId);
    setRating(currentRating || 0);
    setReviewNotes(currentNotes || "");
    setIsDialogOpen(true);
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
            <CardHeader>
              <CardTitle>Login Required</CardTitle>
              <CardDescription>Please login to view your recipes</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/">
                <Button className="bg-[#FFBF00] text-black hover:bg-[#FFBF00]/90">
                  Go to Home
                </Button>
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#FFBF00] mb-2">My Recipes</h1>
          <p className="text-muted-foreground">Manage and rate your saved beer recipes</p>
        </div>

        {recipes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Beaker className="h-16 w-16 text-muted-foreground opacity-50 mb-4" />
              <h3 className="text-xl font-semibold text-muted-foreground mb-2">
                No recipes yet
              </h3>
              <p className="text-muted-foreground mb-6">
                Start creating recipes to see them here
              </p>
              <Link href="/wizard">
                <Button className="bg-[#FFBF00] text-black hover:bg-[#FFBF00]/90">
                  Create Recipe
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {recipes.map((recipe) => (
              <Card key={recipe.id} className="flex flex-col hover:border-primary/50 transition-colors cursor-pointer">
                <Link href={`/my-recipes/${recipe.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{recipe.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {recipe.description || "No description"}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteRecipe(recipe.id);
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                </Link>
                <CardContent className="flex-1 flex flex-col">
                  <div className="space-y-2 mb-4">
                    {recipe.specs?.abv && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">ABV: </span>
                        <span className="font-semibold">{recipe.specs.abv}</span>
                      </div>
                    )}
                    {recipe.specs?.ibu && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">IBU: </span>
                        <span className="font-semibold">{recipe.specs.ibu}</span>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {recipe.createdAt && recipe.createdAt.toDate
                        ? new Date(recipe.createdAt.toDate()).toLocaleDateString()
                        : "Unknown date"}
                    </div>
                    <div className="text-xs">
                      <span
                        className={`px-2 py-1 rounded ${
                          recipe.status === "completed"
                            ? "bg-[#4CBB17]/20 text-[#4CBB17]"
                            : "bg-[#FFBF00]/20 text-[#FFBF00]"
                        }`}
                      >
                        {recipe.status === "completed" ? "Completed" : "Planned"}
                      </span>
                    </div>
                  </div>

                  {recipe.rating && (
                    <div className="mb-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                      <div className="flex items-center gap-1 mb-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              star <= recipe.rating!
                                ? "fill-[#FFBF00] text-[#FFBF00]"
                                : "text-zinc-600"
                            }`}
                          />
                        ))}
                      </div>
                      {recipe.reviewNotes && (
                        <p className="text-xs text-muted-foreground italic">
                          "{recipe.reviewNotes}"
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-auto pt-4 border-t border-zinc-800">
                    <Dialog open={isDialogOpen && selectedRecipe === recipe.id} onOpenChange={setIsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => openRatingDialog(recipe.id, recipe.rating, recipe.reviewNotes)}
                        >
                          <Star className="mr-2 h-4 w-4" />
                          {recipe.rating ? "Update Rating" : "Rate & Review"}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Rate & Review: {recipe.name}</DialogTitle>
                          <DialogDescription>
                            Share your experience with this recipe
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div>
                            <Label>Rating</Label>
                            <div className="flex items-center gap-2 mt-2">
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
                                        ? "fill-[#FFBF00] text-[#FFBF00]"
                                        : "text-zinc-600 hover:text-zinc-400"
                                    }`}
                                  />
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="review-notes">Tasting Notes (Optional)</Label>
                            <Textarea
                              id="review-notes"
                              placeholder="E.g., 'Super Bier, aber braucht mehr Reifezeit'"
                              className="mt-2 min-h-[100px]"
                              value={reviewNotes}
                              onChange={(e) => setReviewNotes(e.target.value)}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsDialogOpen(false);
                              setRating(0);
                              setReviewNotes("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleRateRecipe}
                            className="bg-[#FFBF00] text-black hover:bg-[#FFBF00]/90"
                            disabled={rating === 0}
                          >
                            Save Rating
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyRecipesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#FFBF00]" />
      </div>
    }>
      <MyRecipesContent />
    </Suspense>
  );
}

