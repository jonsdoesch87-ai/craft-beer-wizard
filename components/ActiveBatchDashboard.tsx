"use client";

import { useState } from "react";
import { BatchData, RecipeData, updateBatch, FermentationScheduleStep } from "@/lib/db";
import { getEstimatedBottlingDate } from "@/lib/brewing-math";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Beaker, Calendar, CheckCircle2, Droplets, Star } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

interface ActiveBatchDashboardProps {
  batch: BatchData & { id: string };
  recipe: RecipeData & { id: string };
  recipeId: string;
  onBatchUpdate: () => void;
  onBottlingClick: () => void;
}

export function ActiveBatchDashboard({
  batch,
  recipe,
  recipeId,
  onBatchUpdate,
  onBottlingClick,
}: ActiveBatchDashboardProps) {
  const { user } = useAuth();
  const [currentGravity, setCurrentGravity] = useState("");
  const [currentTemp, setCurrentTemp] = useState("");

  const daysInFermenter = batch.startedAt
    ? (() => {
        const startDate = batch.startedAt.toDate
          ? batch.startedAt.toDate()
          : (batch.startedAt as any).seconds
          ? new Date((batch.startedAt as any).seconds * 1000)
          : new Date();
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - startDate.getTime());
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
      })()
    : 0;

  const handleLogMeasurement = async () => {
    if (!user || !batch || !currentGravity) return;
    const gravityValue = parseFloat(currentGravity.replace(/[^\d.]/g, ""));
    if (!isNaN(gravityValue)) {
      try {
        const measurements = batch.measurements || [];
        await updateBatch(user.uid, recipeId, batch.id, {
          measurements: [
            ...measurements,
            {
              date: new Date() as any,
              gravity: gravityValue,
              temp: currentTemp ? parseFloat(currentTemp) : undefined,
              source: "manual" as const,
            },
          ],
        });
        toast.success("Measurement saved!");
        setCurrentGravity("");
        setCurrentTemp("");
        onBatchUpdate();
      } catch (error) {
        toast.error("Error saving");
      }
    }
  };

  const handleStepComplete = async (step: FermentationScheduleStep) => {
    if (!user || !batch || batch.status === "completed") return;
    try {
      const history = batch.fermentationHistory || [];
      await updateBatch(user.uid, recipeId, batch.id, {
        fermentationHistory: [
          ...history,
          {
            day: step.day,
            type: step.type,
            completedAt: new Date() as any,
          },
        ],
      });
      onBatchUpdate();
      toast.success("Step completed!");
    } catch (error) {
      toast.error("Error saving");
    }
  };

  const allStepsCompleted =
    recipe?.fermentationSchedule &&
    recipe.fermentationSchedule.every((step) =>
      batch.fermentationHistory?.some((h) => h.day === step.day && h.type === step.type)
    );

  return (
    <Card className="mb-6 bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2 text-[#FFBF00]">
          <Beaker className="h-6 w-6" />
          {batch.status === "completed" ? "Batch History" : "Active Batch"} #{batch.batchNumber} - {batch.status}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Days in Fermenter */}
        <div className="p-4 bg-zinc-800/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-5 w-5 text-[#FFBF00]" />
            <span className="font-semibold">Days in Fermenter:</span>
          </div>
          <p className="text-2xl font-bold text-[#FFBF00]">{daysInFermenter}</p>
        </div>

        {/* Layout: Timeline Left, Measurements Right */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Fermentation Schedule Timeline (Left) */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold mb-3">Fermentation Schedule</h3>
            {recipe?.fermentationSchedule && recipe.fermentationSchedule.length > 0 ? (
              recipe.fermentationSchedule.map((step: FermentationScheduleStep, idx: number) => {
                const isPast = daysInFermenter > step.day;
                const isCurrent = daysInFermenter === step.day;
                const isFuture = daysInFermenter < step.day;
                const isCompleted = batch.fermentationHistory?.some(
                  (h) => h.day === step.day && h.type === step.type
                );

                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border flex items-center gap-3 ${
                      isCompleted
                        ? "bg-[#4CBB17]/10 border-[#4CBB17]"
                        : isCurrent
                        ? "bg-[#FFBF00]/20 border-[#FFBF00]"
                        : isPast
                        ? "bg-zinc-800/50 border-zinc-700 opacity-60"
                        : "bg-zinc-800/30 border-zinc-700 opacity-40"
                    }`}
                  >
                    <Checkbox
                      checked={isCompleted || false}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          handleStepComplete(step);
                        }
                      }}
                      disabled={isCompleted || isFuture || batch.status === "completed"}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="w-16 justify-center">
                          Day {step.day}
                        </Badge>
                        <span
                          className={`font-medium ${
                            isCompleted ? "line-through text-muted-foreground opacity-60" : ""
                          }`}
                        >
                          {step.description}
                        </span>
                        {step.value && (
                          <span
                            className={`text-sm ${
                              isCompleted ? "line-through text-muted-foreground opacity-60" : "text-muted-foreground"
                            }`}
                          >
                            ({step.value})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            step.type === "dryhop"
                              ? "border-blue-500 text-blue-400"
                              : step.type === "temp"
                              ? "border-orange-500 text-orange-400"
                              : step.type === "reading"
                              ? "border-green-500 text-green-400"
                              : "border-gray-500 text-gray-400"
                          }`}
                        >
                          {step.type}
                        </Badge>
                        {isCompleted && batch.fermentationHistory && (
                          <span className="text-xs text-muted-foreground">
                            {(() => {
                              const historyEntry = batch.fermentationHistory.find(
                                (h) => h.day === step.day && h.type === step.type
                              );
                              if (historyEntry?.completedAt) {
                                const completedDate = historyEntry.completedAt.toDate
                                  ? historyEntry.completedAt.toDate()
                                  : new Date((historyEntry.completedAt as any).seconds * 1000);
                                return completedDate.toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                });
                              }
                              return "";
                            })()}
                          </span>
                        )}
                      </div>
                    </div>
                    {isCompleted && <CheckCircle2 className="h-5 w-5 text-[#4CBB17]" />}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">
                No scheduled actions (standard fermentation)
              </p>
            )}
          </div>

          {/* Fermentation Log & Measurements (Right) */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-3">Fermentation Log</h3>

            {/* Prediction Display */}
            {batch.measurements &&
              batch.measurements.length >= 2 &&
              recipe?.predictedFG && (
                <div className="p-4 bg-blue-950/20 border border-blue-500/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-5 w-5 text-blue-400" />
                    <span className="font-semibold text-blue-400">Estimated Bottling Date:</span>
                  </div>
                  <p className="text-xl font-bold text-blue-400">
                    {(() => {
                      const estimatedDate = getEstimatedBottlingDate(
                        batch.measurements || [],
                        recipe.predictedFG
                      );
                      if (estimatedDate) {
                        return estimatedDate.toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        });
                      }
                      return "Not available";
                    })()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on linear extrapolation from last 2 measurements
                  </p>
                </div>
              )}

            {/* Measurement Input - Only show for active (non-completed) batches */}
            {batch.status !== "completed" && (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Current Gravity (SG/Plato)</Label>
                    <Input
                      type="text"
                      placeholder="e.g. 1.012 or 3.0"
                      value={currentGravity}
                      onChange={(e) => setCurrentGravity(e.target.value)}
                      className="bg-zinc-900 border-zinc-700"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleLogMeasurement();
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Current Temperature (°C)</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 20"
                      value={currentTemp}
                      onChange={(e) => setCurrentTemp(e.target.value)}
                      className="bg-zinc-900 border-zinc-700"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleLogMeasurement}
                  className="w-full bg-[#FFBF00] text-black hover:bg-[#FFBF00]/90"
                >
                  Log Measurement
                </Button>
              </>
            )}

            {/* Measurements Chart & Table */}
            {batch.measurements && batch.measurements.length > 0 && (
              <div className="mt-6 space-y-4">
                {/* Simple Chart */}
                <div className="p-4 bg-zinc-800/50 rounded-lg">
                  <h4 className="text-sm font-semibold mb-3">Gravity Over Time</h4>
                  <div className="h-48 flex items-end justify-between gap-1">
                    {batch.measurements
                      .sort((a, b) => {
                        const dateA = a.date?.toDate
                          ? a.date.toDate().getTime()
                          : (a.date as any)?.seconds * 1000 || 0;
                        const dateB = b.date?.toDate
                          ? b.date.toDate().getTime()
                          : (b.date as any)?.seconds * 1000 || 0;
                        return dateA - dateB;
                      })
                      .map((m, idx) => {
                        const maxGravity = Math.max(...batch.measurements!.map((mm) => mm.gravity));
                        const minGravity = Math.min(...batch.measurements!.map((mm) => mm.gravity));
                        const range = maxGravity - minGravity || 0.01;
                        const height = ((m.gravity - minGravity) / range) * 100;
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center">
                            <div
                              className="w-full bg-[#FFBF00] rounded-t transition-all hover:bg-[#FFBF00]/80"
                              style={{ height: `${height}%` }}
                              title={`${m.gravity.toFixed(3)} - ${m.date?.toDate ? m.date.toDate().toLocaleDateString() : ""}`}
                            />
                            <span className="text-xs text-muted-foreground mt-1 rotate-45 origin-left">
                              {idx + 1}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Measurements Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-700">
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Gravity</th>
                        <th className="text-left p-2">Temp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batch.measurements
                        .sort((a, b) => {
                          const dateA = a.date?.toDate
                            ? a.date.toDate().getTime()
                            : (a.date as any)?.seconds * 1000 || 0;
                          const dateB = b.date?.toDate
                            ? b.date.toDate().getTime()
                            : (b.date as any)?.seconds * 1000 || 0;
                          return dateB - dateA; // Newest first
                        })
                        .map((m, idx) => (
                          <tr key={idx} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                            <td className="p-2">
                              {m.date?.toDate ? m.date.toDate().toLocaleDateString() : "N/A"}
                            </td>
                            <td className="p-2 font-mono">{m.gravity.toFixed(3)}</td>
                            <td className="p-2">{m.temp ? `${m.temp}°C` : "—"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Ready to Bottle Button - Only show for active (non-completed) batches */}
        {batch.status !== "completed" &&
          allStepsCompleted && (
            <Button
              onClick={onBottlingClick}
              className="w-full bg-[#4CBB17] text-white hover:bg-[#4CBB17]/90 text-lg py-6"
              size="lg"
            >
              <Droplets className="mr-2 h-5 w-5" />
              Start Bottling Calculator
            </Button>
          )}

        {/* Show rating/review for completed batches */}
        {batch.status === "completed" && (
          <div className="p-4 bg-green-950/20 border border-green-500/30 rounded-lg">
            <h4 className="font-semibold text-green-400 mb-2 flex items-center gap-2">
              <Star className="h-5 w-5" />
              Batch Review
            </h4>
            {batch.rating && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-yellow-500 text-xl">★</span>
                <span className="font-semibold">{batch.rating}/5</span>
              </div>
            )}
            {batch.reviewNotes && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {batch.reviewNotes}
              </p>
            )}
            {!batch.rating && !batch.reviewNotes && (
              <p className="text-sm text-muted-foreground">No review available for this batch.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

