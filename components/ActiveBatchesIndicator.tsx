"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getAllActiveBatches, BatchData } from "@/lib/db";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Beaker, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface ActiveBatchWithRecipe extends BatchData {
  id: string;
  recipeId: string;
  recipeName: string;
}

export function ActiveBatchesIndicator() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeBatches, setActiveBatches] = useState<ActiveBatchWithRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadActiveBatches = async () => {
      try {
        setLoading(true);
        const batches = await getAllActiveBatches(user.uid);
        setActiveBatches(batches);
      } catch (error) {
        console.error("Error loading active batches:", error);
      } finally {
        setLoading(false);
      }
    };

    loadActiveBatches();
    // Refresh every 30 seconds
    const interval = setInterval(loadActiveBatches, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const getDaysInFermenter = (startedAt: any) => {
    if (!startedAt) return 0;
    const startDate = startedAt.toDate ? startedAt.toDate() : new Date(startedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - startDate.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "brewing":
        return "bg-yellow-600";
      case "fermenting":
        return "bg-blue-600";
      case "conditioning":
        return "bg-purple-600";
      default:
        return "bg-gray-600";
    }
  };

  if (!user || loading) {
    return null;
  }

  if (activeBatches.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative bg-[#FFBF00]/10 hover:bg-[#FFBF00]/20 border border-[#FFBF00]/30"
        >
          <Beaker className="h-4 w-4 mr-2 text-[#FFBF00]" />
          <span className="hidden sm:inline text-[#FFBF00] font-semibold">
            Active Brews
          </span>
          <Badge
            className={`ml-2 ${getStatusColor(activeBatches[0]?.status || "")} animate-pulse`}
          >
            {activeBatches.length}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 bg-zinc-900 border-zinc-800" align="end">
        <div className="space-y-2">
          <h3 className="font-semibold text-[#FFBF00] mb-3">Active Batches</h3>
          {activeBatches.map((batch) => {
            const days = getDaysInFermenter(batch.startedAt);
            // Determine navigation target based on batch status
            // "brewing" batches go to brew session, "fermenting"/"conditioning" go to fermentation dashboard
            const targetUrl = batch.status === "brewing" 
              ? `/brew/${batch.recipeId}` 
              : `/my-recipes/${batch.recipeId}`;
            
            return (
              <div
                key={batch.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Navigate based on batch status
                  if (batch.status === "brewing") {
                    // Brewing batches go to brew session page
                    router.push(`/brew/${batch.recipeId}`);
                  } else {
                    // Fermenting/conditioning batches go to dedicated batch detail page
                    router.push(`/my-recipes/${batch.recipeId}/batch/${batch.id}`);
                  }
                }}
                className="p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{batch.recipeName}</span>
                  <Badge className={getStatusColor(batch.status)}>
                    {batch.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Batch #{batch.batchNumber}</span>
                  <span>•</span>
                  <span>Day {days}</span>
                </div>
              </div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

