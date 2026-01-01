"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSharedRecipe, RecipeData, saveRecipe, LimitReachedError } from "@/lib/db";
import { RecipeCard } from "@/components/RecipeCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Frown, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function SharedRecipePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const ownerId = params.userId as string;
  const recipeId = params.recipeId as string;
  
  const [recipe, setRecipe] = useState<(RecipeData & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!ownerId || !recipeId) return;
      
      try {
        const data = await getSharedRecipe(ownerId, recipeId);
        if (data) {
          setRecipe(data);
        } else {
          setError("Recipe not found or is private.");
        }
      } catch (e) {
        console.error(e);
        setError("Error loading recipe.");
      } finally {
        setLoading(false);
      }
    };
    
    load();
  }, [ownerId, recipeId]);

  const handleClone = async () => {
    if (!user || !recipe) return;
    
    setCloning(true);
    try {
      // Copy recipe to viewer's account
      // Remove 'id' and 'isPublic' for a clean start
      const { id, isPublic, ...recipeData } = recipe;
      await saveRecipe(user.uid, {
        ...recipeData,
        name: `${recipeData.name} (Copy)`,
        description: recipeData.description 
          ? `Imported from shared link. Original: ${recipeData.description}`
          : "Imported from shared link."
      });
      toast.success("Recipe saved to your library! 🎉");
      // Redirect to user's recipes after a short delay
      setTimeout(() => {
        router.push("/my-recipes");
      }, 1500);
    } catch (error) {
      if (error instanceof LimitReachedError) {
        toast.error("Recipe limit reached. Upgrade to Pro for unlimited recipes!");
      } else {
        console.error("Error copying recipe:", error);
        toast.error("Failed to save recipe");
      }
    } finally {
      setCloning(false);
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
      <div className="container max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" className="text-zinc-400 hover:text-white pl-0 mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          
          {/* Action Card */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-[#FFBF00]">Shared Recipe View</CardTitle>
              <p className="text-sm text-muted-foreground">You are viewing a read-only version.</p>
            </CardHeader>
            <CardContent>
              {user ? (
                <Button
                  onClick={handleClone}
                  disabled={cloning}
                  className="bg-[#FFBF00] text-black hover:bg-[#E5AC00]"
                >
                  {cloning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Save to My Recipes
                    </>
                  )}
                </Button>
              ) : (
                <Link href="/login">
                  <Button variant="outline">Login to Save</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Recipe Card - Read Only */}
        <RecipeCard recipe={recipeForCard as any} units="metric" recipeId={recipeId} userId={ownerId} />
        
        <div className="text-center pt-8 pb-4 text-zinc-500 text-sm">
          Powered by Craft Beer Wizard 🧙‍♂️
        </div>
      </div>
    </div>
  );
}

