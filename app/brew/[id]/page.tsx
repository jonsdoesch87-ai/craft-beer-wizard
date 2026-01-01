"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getRecipe, RecipeData, getActiveBatch } from "@/lib/db";
import { BrewSession } from "@/components/BrewSession";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, Beaker } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function BrewDayPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [recipe, setRecipe] = useState<(RecipeData & { id: string }) | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const recipeId = params.id as string;

  useEffect(() => {
    if (user && !authLoading && recipeId) {
      loadRecipe();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [user, authLoading, recipeId]);

  const loadRecipe = async () => {
    if (!user || !recipeId) return;
    try {
      setLoading(true);
      const [recipeData, activeBatch] = await Promise.all([
        getRecipe(user.uid, recipeId),
        getActiveBatch(user.uid, recipeId)
      ]);
      
      if (recipeData) {
        setRecipe(recipeData);
      } else {
        toast.error("Recipe not found");
        router.push("/my-recipes");
        return;
      }
      
      if (activeBatch) {
        setBatchId(activeBatch.id);
      } else {
        toast.error("No active batch found for this recipe");
        router.push(`/my-recipes/${recipeId}`);
      }
    } catch (error) {
      console.error("Error loading recipe:", error);
      toast.error("Failed to load recipe");
      router.push("/my-recipes");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#FFBF00]" />
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
              <p className="text-muted-foreground mb-6">Please login to access Brew Day Mode</p>
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href={`/my-recipes/${recipeId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Recipe
            </Button>
          </Link>
        </div>
        {batchId && (
          <BrewSession 
            recipe={{ ...recipe, id: recipeId }} 
            batchId={batchId}
            userId={user.uid}
          />
        )}
      </div>
    </div>
  );
}

