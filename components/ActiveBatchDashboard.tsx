"use client";

import { useState, useMemo } from "react";
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
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

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
    recipe.fermentationSchedule.length > 0 &&
    recipe.fermentationSchedule.every((step) =>
      batch.fermentationHistory?.some((h) => h.day === step.day && h.type === step.type)
    );
  
  // If there's no fermentation schedule, allow bottling (standard fermentation)
  const canBottle = !recipe?.fermentationSchedule || recipe.fermentationSchedule.length === 0 || allStepsCompleted;

  // Ermittle die Einheit basierend auf den Daten
  const measurements = batch.measurements || [];
  const gravityUnit =
    measurements.length > 0 && measurements.some((m) => Number(m.gravity) > 1.2)
      ? "Plato"
      : "SG";

  // Formatierer basierend auf Einheit
  const formatGravity = (val: number) => {
    if (gravityUnit === "Plato") return `${val.toFixed(1)}°P`;
    return val.toFixed(3);
  };

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
                {/* Gravity Over Time Chart */}
                <div className="p-4 bg-zinc-800/50 rounded-lg">
                  <h4 className="text-sm font-semibold mb-3">
                    {gravityUnit === "Plato" ? "Plato" : "Specific Gravity"} Trend
                  </h4>
                  {/* Chart Container - WICHTIG: h-[300px] erzwingt die Höhe */}
                  <div className="w-full h-[300px] mt-4 p-2 bg-zinc-900/30 rounded-lg border border-zinc-800">
                    {batch.measurements.length > 1 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={useMemo(() => {
                            // Sortiere Daten chronologisch (älteste zuerst)
                            const sorted = [...batch.measurements!].sort((a, b) => {
                        const dateA = a.date?.toDate
                          ? a.date.toDate().getTime()
                          : (a.date as any)?.seconds * 1000 || 0;
                        const dateB = b.date?.toDate
                          ? b.date.toDate().getTime()
                          : (b.date as any)?.seconds * 1000 || 0;
                        return dateA - dateB;
                            });
                            // Formatiere für Chart - nutze 'temperature' für die rechte Y-Achse
                            return sorted.map((m) => ({
                              date: m.date?.toDate
                                ? m.date.toDate()
                                : (m.date as any)?.seconds
                                ? new Date((m.date as any).seconds * 1000)
                                : new Date(),
                              gravity: m.gravity,
                              temperature: m.temp || null,
                            }));
                          }, [batch.measurements])}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorGravity" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#FFBF00" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#FFBF00" stopOpacity={0} />
                            </linearGradient>
                          </defs>

                          <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />

                          <XAxis
                            dataKey="date"
                            stroke="#666"
                            tick={{ fontSize: 12, fill: "#71717a" }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => {
                              if (!val) return "";
                              const d = val instanceof Date ? val : new Date(val);
                              return `${d.getDate()}.${d.getMonth() + 1}.`;
                            }}
                          />

                          {/* LEFT AXIS: GRAVITY */}
                          <YAxis
                            yAxisId="gravity"
                            stroke="#FFBF00"
                            domain={["auto", "auto"]}
                            tick={{ fontSize: 12, fill: "#FFBF00" }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) =>
                              gravityUnit === "Plato" ? val.toFixed(1) : val.toFixed(3)
                            }
                            label={{
                              value: gravityUnit,
                              angle: -90,
                              position: "insideLeft",
                              fill: "#FFBF00",
                              fontSize: 10,
                            }}
                          />

                          {/* RIGHT AXIS: TEMPERATURE */}
                          <YAxis
                            yAxisId="temp"
                            orientation="right"
                            stroke="#3b82f6"
                            domain={["auto", "auto"]}
                            tick={{ fontSize: 12, fill: "#3b82f6" }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => val.toFixed(1) + "°"}
                          />

                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#18181b",
                              borderColor: "#3f3f46",
                              borderRadius: "8px",
                              color: "#fff",
                            }}
                            labelStyle={{ color: "#a1a1aa", marginBottom: "0.5rem" }}
                            labelFormatter={(label) => {
                              const d = new Date(
                                (label as any)?.seconds
                                  ? (label as any).seconds * 1000
                                  : label instanceof Date
                                  ? label
                                  : new Date(label)
                              );
                        return (
                                d.toLocaleDateString() +
                                " " +
                                d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                              );
                            }}
                            formatter={(value: any, name?: string) => {
                              if (name === "gravity" || name === "Gravity") {
                                return [formatGravity(value), gravityUnit];
                              }
                              if (name === "temperature" || name === "Temperature") {
                                return [`${value.toFixed(1)}°C`, "Temp"];
                              }
                              return [value, name || ""];
                            }}
                          />

                          <Legend verticalAlign="top" height={36} />

                          {/* Gravity Area (Left Axis) */}
                          <Area
                            yAxisId="gravity"
                            type="monotone"
                            dataKey="gravity"
                            name={gravityUnit}
                            stroke="#FFBF00"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorGravity)"
                            activeDot={{ r: 6, strokeWidth: 0, fill: "#fff" }}
                          />

                          {/* Temperature Line (Right Axis) */}
                          {batch.measurements!.some(
                            (m) => m.temp !== undefined && m.temp !== null
                          ) && (
                            <Area
                              yAxisId="temp"
                              type="monotone"
                              dataKey="temperature"
                              name="Temperature"
                              stroke="#3b82f6"
                              strokeWidth={2}
                              fill="none"
                              dot={{ r: 3, fill: "#3b82f6" }}
                              activeDot={{ r: 5 }}
                            />
                          )}
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        Not enough data points to plot graph (need at least 2).
                          </div>
                    )}
                  </div>
                </div>

                {/* Measurements Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-700">
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">{gravityUnit}</th>
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
                            <td className="p-2 font-mono">{formatGravity(Number(m.gravity))}</td>
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
          canBottle && (
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

