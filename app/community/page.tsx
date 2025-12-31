"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, Download, User, Beaker, Loader2 } from "lucide-react";
import { getPublicRecipes, cloneRecipe } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import Link from "next/link";
import { formatBeerColor } from "@/lib/utils";

interface PublicRecipe {
  id: string;
  name: string;
  description?: string;
  specs?: {
    abv?: string;
    ibu?: string;
    srm?: string;
    og?: string;
  };
  authorName?: string;
  originalAuthorId?: string;
  likes?: number;
  publishedAt?: any;
}

export default function CommunityPage() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<PublicRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloningIds, setCloningIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      setLoading(true);
      const publicRecipes = await getPublicRecipes(50);
      setRecipes(publicRecipes);
    } catch (error) {
      console.error("Error loading public recipes:", error);
      toast.error("Failed to load community recipes");
    } finally {
      setLoading(false);
    }
  };

  const handleCloneRecipe = async (recipe: PublicRecipe) => {
    if (!user) {
      toast.error("Please log in to add recipes to your library");
      return;
    }

    try {
      setCloningIds((prev) => new Set(prev).add(recipe.id));
      await cloneRecipe(user.uid, recipe);
      toast.success(`"${recipe.name}" added to your library!`);
    } catch (error: any) {
      console.error("Error cloning recipe:", error);
      if (error instanceof Error && error.message.includes("LIMIT_REACHED")) {
        toast.error("Recipe limit reached. Please upgrade to Pro.");
      } else {
        toast.error("Failed to add recipe to library");
      }
    } finally {
      setCloningIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(recipe.id);
        return newSet;
      });
    }
  };

  const getBeerColor = (srm?: string): string => {
    if (!srm) return "#F8F5D4";
    const srmValue = parseFloat(srm) || 5;
    if (srmValue < 4) return "#F8F5D4"; // Pale Straw
    if (srmValue < 7) return "#F3F993"; // Gold
    if (srmValue < 12) return "#E58623"; // Amber
    if (srmValue < 20) return "#A65B20"; // Copper/Brown
    if (srmValue < 30) return "#5D341A"; // Dark Brown
    return "#360904"; // Black
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Globe className="h-8 w-8 text-[#FFBF00]" />
            <h1 className="text-3xl sm:text-4xl font-bold text-[#FFBF00]">
              Community Taps 🍻
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Discover what others are brewing
          </p>
        </div>

        {/* Recipes Grid */}
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="border-zinc-800">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-32 w-full mb-4" />
                  <div className="flex gap-2 mb-4">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : recipes.length === 0 ? (
          <Card className="border-zinc-800">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Beaker className="h-16 w-16 text-muted-foreground opacity-50 mb-4" />
              <h3 className="text-xl font-semibold text-muted-foreground mb-2">
                No recipes yet
              </h3>
              <p className="text-muted-foreground text-center mb-4">
                Be the first to share your recipe with the community!
              </p>
              <Link href="/wizard">
                <Button className="bg-[#FFBF00] text-black hover:bg-[#E5AC00]">
                  Create Recipe
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {recipes.map((recipe) => (
              <Card key={recipe.id} className="border-zinc-800 hover:border-zinc-700 transition-colors">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg line-clamp-2 mb-2">
                    {recipe.name}
                  </CardTitle>
                  {recipe.description && (
                    <CardDescription className="line-clamp-2 text-sm">
                      {recipe.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Specs Badges */}
                  <div className="flex gap-2 flex-wrap">
                    {recipe.specs?.abv && (
                      <Badge variant="secondary" className="bg-[#FFBF00]/10 text-[#FFBF00] border-0 text-xs">
                        {recipe.specs.abv}
                      </Badge>
                    )}
                    {recipe.specs?.ibu && (
                      <Badge variant="secondary" className="bg-[#4CBB17]/10 text-[#4CBB17] border-0 text-xs">
                        {recipe.specs.ibu} IBU
                      </Badge>
                    )}
                    {recipe.specs?.srm && (
                      <Badge variant="outline" className="border-zinc-700 text-xs bg-zinc-800 text-zinc-300 hover:bg-zinc-700 flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full border border-white/10"
                          style={{ backgroundColor: getBeerColor(recipe.specs.srm) }}
                        />
                        {formatBeerColor(recipe.specs.srm, "metric")}
                      </Badge>
                    )}
                  </div>

                  {/* Author */}
                  {recipe.authorName && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>{recipe.authorName}</span>
                    </div>
                  )}

                  {/* Clone Button */}
                  <Button
                    onClick={() => handleCloneRecipe(recipe)}
                    disabled={!user || cloningIds.has(recipe.id)}
                    className="w-full bg-[#FFBF00] text-black hover:bg-[#E5AC00]"
                    size="sm"
                  >
                    {cloningIds.has(recipe.id) ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Add to my Library
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

