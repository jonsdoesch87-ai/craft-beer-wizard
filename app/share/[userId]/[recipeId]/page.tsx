"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getSharedRecipe, RecipeData, saveRecipe, LimitReachedError } from "@/lib/db";
import { RecipeCard } from "@/components/RecipeCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Frown, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function SharedRecipePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const userId = params.userId as string;
  const recipeId = params.recipeId as string;
  
  const [recipe, setRecipe] = useState<(RecipeData & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCloning, setIsCloning] = useState(false);
  const [isCloned, setIsCloned] = useState(false);

  useEffect(() => {
    const fetchSharedRecipe = async () => {
      if (!userId || !recipeId) return;
      
      try {
        const recipeData = await getSharedRecipe(userId, recipeId);
        if (recipeData) {
          setRecipe(recipeData);
        } else {
          setError("Recipe not found or is private.");
        }
      } catch (err) {
        console.error(err);
        setError("Error loading recipe. It might be private or deleted.");
      } finally {
        setLoading(false);
      }
    };

    fetchSharedRecipe();
  }, [userId, recipeId]);

  const handleCopyToMyRecipes = async () => {
    if (!user || !recipe) {
      toast.error("Please login to copy recipes");
      router.push("/login");
      return;
    }

    setIsCloning(true);
    try {
      // Create a copy of the recipe with "Clone" suffix
      const clonedRecipe: Omit<RecipeData, "status" | "createdAt"> = {
        name: `${recipe.name} (Clone)`,
        description: recipe.description,
        specs: recipe.specs,
        ingredients: recipe.ingredients,
        malts: recipe.malts,
        hops: recipe.hops,
        yeast: recipe.yeast,
        extras: recipe.extras,
        mash_schedule: recipe.mash_schedule,
        mash_steps: recipe.mash_steps,
        boil_instructions: recipe.boil_instructions,
        fermentation_instructions: recipe.fermentation_instructions,
        fermentationSchedule: recipe.fermentationSchedule,
        shopping_list: recipe.shopping_list,
        estimatedTime: recipe.estimatedTime,
        notes: recipe.notes,
        waterProfile: recipe.waterProfile,
        predictedFG: recipe.predictedFG,
        // Mark as private (user's own copy)
        isPublic: false,
        // Track original author and recipe
        originalAuthorId: userId,
        originalPublicRecipeId: recipeId,
      };

      await saveRecipe(user.uid, clonedRecipe);
      setIsCloned(true);
      toast.success("Recipe copied to your library! 🎉");
      
      // Redirect to user's recipes after a short delay
      setTimeout(() => {
        router.push("/my-recipes");
      }, 1500);
    } catch (error) {
      if (error instanceof LimitReachedError) {
        toast.error("Recipe limit reached. Upgrade to Pro for unlimited recipes!");
      } else {
        console.error("Error copying recipe:", error);
        toast.error("Failed to copy recipe");
      }
    } finally {
      setIsCloning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="h-10 w-10 animate-spin text-[#FFBF00]" />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-zinc-950 text-white gap-4 p-4 text-center">
        <Frown className="h-16 w-16 text-zinc-700" />
        <h1 className="text-2xl font-bold text-red-500">Recipe not found</h1>
        <p className="text-zinc-400">{error || "This recipe is private or has been deleted."}</p>
        <Link href="/">
          <Button variant="outline" className="mt-4">Back to Home</Button>
        </Link>
      </div>
    );
  }

  // Convert RecipeData to Recipe interface for RecipeCard
  const recipeForCard = {
    ...recipe,
    originalGravity: recipe.specs?.og || recipe.specs?.original_gravity,
    finalGravity: recipe.specs?.fg || recipe.specs?.final_gravity,
    abv: recipe.specs?.abv,
    ibu: recipe.specs?.ibu,
    srm: recipe.specs?.srm,
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" className="text-zinc-400 hover:text-white pl-0 mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          
          {/* Action Card */}
          {user && (
            <Card className="bg-zinc-900 border-zinc-800 mb-6">
              <CardHeader>
                <CardTitle className="text-lg text-[#FFBF00]">Shared Recipe</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-zinc-400 mb-4">
                  This recipe has been shared with you. Copy it to your library to save it and start brewing!
                </p>
                <Button
                  onClick={handleCopyToMyRecipes}
                  disabled={isCloning || isCloned}
                  className="bg-[#FFBF00] text-black hover:bg-[#E5AC00]"
                >
                  {isCloning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Copying...
                    </>
                  ) : isCloned ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy to My Recipes
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
          
          {!user && (
            <Card className="bg-zinc-900 border-zinc-800 mb-6">
              <CardContent className="pt-6">
                <p className="text-zinc-400 text-center">
                  <Link href="/login" className="text-[#FFBF00] hover:underline">
                    Login
                  </Link>{" "}
                  to copy this recipe to your library
                </p>
              </CardContent>
            </Card>
          )}
        </div>
        
        {/* Recipe Card - Read Only */}
        <RecipeCard recipe={recipeForCard as any} units="metric" />
        
        <div className="text-center pt-8 pb-4 text-zinc-500 text-sm">
          Powered by Craft Beer Wizard 🧙‍♂️
        </div>
      </div>
    </div>
  );
}

