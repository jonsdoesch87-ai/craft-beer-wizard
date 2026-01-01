"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getRecipe, updateRecipe, RecipeData } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Loader2, Plus, Trash2, Frown } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function EditRecipePage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const recipeId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recipe, setRecipe] = useState<RecipeData | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [specs, setSpecs] = useState<any>({});
  const [malts, setMalts] = useState<any[]>([]);
  const [hops, setHops] = useState<any[]>([]);
  const [yeast, setYeast] = useState<any>(null);
  const [extras, setExtras] = useState<any[]>([]);
  const [mashSchedule, setMashSchedule] = useState<any[]>([]);
  const [boilInstructions, setBoilInstructions] = useState<string[]>([]);
  const [fermentationInstructions, setFermentationInstructions] = useState<string[]>([]);

  useEffect(() => {
    const loadRecipe = async () => {
      if (!user?.uid || !recipeId) return;

      try {
        const recipeData = await getRecipe(user.uid, recipeId);
        if (recipeData) {
          setRecipe(recipeData);
          setName(recipeData.name || "");
          setDescription(recipeData.description || "");
          setSpecs(recipeData.specs || {});
          setMalts(recipeData.malts || recipeData.ingredients?.malts || []);
          setHops(recipeData.hops || recipeData.ingredients?.hops || []);
          setYeast(recipeData.yeast || recipeData.ingredients?.yeast || null);
          setExtras(recipeData.extras || []);
          setMashSchedule(recipeData.mash_schedule || recipeData.mash_steps || []);
          setBoilInstructions(recipeData.boil_instructions || []);
          setFermentationInstructions(recipeData.fermentation_instructions || []);
        } else {
          toast.error("Recipe not found");
          router.push("/my-recipes");
        }
      } catch (error) {
        console.error("Error loading recipe:", error);
        toast.error("Failed to load recipe");
        router.push("/my-recipes");
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && user) {
      loadRecipe();
    }
  }, [user, authLoading, recipeId, router]);

  const handleSave = async () => {
    if (!user?.uid || !recipeId) return;

    setSaving(true);
    try {
      const updates: Partial<RecipeData> = {
        name,
        description,
        specs,
        malts,
        hops,
        yeast,
        extras,
        mash_schedule: mashSchedule,
        boil_instructions: boilInstructions,
        fermentation_instructions: fermentationInstructions,
      };

      await updateRecipe(user.uid, recipeId, updates);
      toast.success("Recipe updated successfully! 🎉");
      router.push(`/my-recipes/${recipeId}`);
    } catch (error) {
      console.error("Error saving recipe:", error);
      toast.error("Failed to save recipe");
    } finally {
      setSaving(false);
    }
  };

  // Helper functions for arrays
  const addMalt = () => {
    setMalts([...malts, { name: "", amount: "", percentage: "", amount_grams: 0 }]);
  };

  const removeMalt = (index: number) => {
    setMalts(malts.filter((_, i) => i !== index));
  };

  const updateMalt = (index: number, field: string, value: any) => {
    const updated = [...malts];
    updated[index] = { ...updated[index], [field]: value };
    setMalts(updated);
  };

  const addHop = () => {
    setHops([...hops, { name: "", amount: "", time: "", boil_time: 0, alpha: 5.0, amount_grams: 0 }]);
  };

  const removeHop = (index: number) => {
    setHops(hops.filter((_, i) => i !== index));
  };

  const updateHop = (index: number, field: string, value: any) => {
    const updated = [...hops];
    updated[index] = { ...updated[index], [field]: value };
    setHops(updated);
  };

  const addExtra = () => {
    setExtras([...extras, { name: "", amount: 0, unit: "g", use: "Boil", time: "", type: "other" }]);
  };

  const removeExtra = (index: number) => {
    setExtras(extras.filter((_, i) => i !== index));
  };

  const updateExtra = (index: number, field: string, value: any) => {
    const updated = [...extras];
    updated[index] = { ...updated[index], [field]: value };
    setExtras(updated);
  };

  const addMashStep = () => {
    setMashSchedule([...mashSchedule, { step: "", temp: "", time: "", description: "" }]);
  };

  const removeMashStep = (index: number) => {
    setMashSchedule(mashSchedule.filter((_, i) => i !== index));
  };

  const updateMashStep = (index: number, field: string, value: any) => {
    const updated = [...mashSchedule];
    updated[index] = { ...updated[index], [field]: value };
    setMashSchedule(updated);
  };

  const addBoilInstruction = () => {
    setBoilInstructions([...boilInstructions, ""]);
  };

  const removeBoilInstruction = (index: number) => {
    setBoilInstructions(boilInstructions.filter((_, i) => i !== index));
  };

  const updateBoilInstruction = (index: number, value: string) => {
    const updated = [...boilInstructions];
    updated[index] = value;
    setBoilInstructions(updated);
  };

  const addFermentationInstruction = () => {
    setFermentationInstructions([...fermentationInstructions, ""]);
  };

  const removeFermentationInstruction = (index: number) => {
    setFermentationInstructions(fermentationInstructions.filter((_, i) => i !== index));
  };

  const updateFermentationInstruction = (index: number, value: string) => {
    const updated = [...fermentationInstructions];
    updated[index] = value;
    setFermentationInstructions(updated);
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="h-10 w-10 animate-spin text-[#FFBF00]" />
      </div>
    );
  }

  if (!user || !recipe) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-zinc-950 text-white gap-4 p-4 text-center">
        <Frown className="h-16 w-16 text-zinc-700" />
        <h1 className="text-2xl font-bold text-red-500">Recipe not found</h1>
        <Link href="/my-recipes">
          <Button variant="outline" className="mt-4">Back to My Recipes</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href={`/my-recipes/${recipeId}`}>
            <Button variant="ghost" className="text-zinc-400 hover:text-white pl-0">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Recipe
            </Button>
          </Link>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#FFBF00] text-black hover:bg-[#E5AC00]"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Save Changes
              </>
            )}
          </Button>
        </div>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-[#FFBF00]">Edit Recipe</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-5 mb-6">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="specs">Specs</TabsTrigger>
                <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
                <TabsTrigger value="mash">Mash</TabsTrigger>
                <TabsTrigger value="process">Process</TabsTrigger>
              </TabsList>

              {/* Basic Info Tab */}
              <TabsContent value="basic" className="space-y-4">
                <div>
                  <Label>Recipe Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Recipe Name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Recipe description..."
                    className="mt-1 min-h-[100px]"
                  />
                </div>
              </TabsContent>

              {/* Specs Tab */}
              <TabsContent value="specs" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Original Gravity (OG)</Label>
                    <Input
                      value={specs.original_gravity || specs.og || ""}
                      onChange={(e) => setSpecs({ ...specs, original_gravity: e.target.value, og: e.target.value })}
                      placeholder="1.050"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Final Gravity (FG)</Label>
                    <Input
                      value={specs.final_gravity || specs.fg || ""}
                      onChange={(e) => setSpecs({ ...specs, final_gravity: e.target.value, fg: e.target.value })}
                      placeholder="1.010"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>ABV (%)</Label>
                    <Input
                      value={specs.abv || ""}
                      onChange={(e) => setSpecs({ ...specs, abv: e.target.value })}
                      placeholder="5.0"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>IBU</Label>
                    <Input
                      value={specs.ibu || ""}
                      onChange={(e) => setSpecs({ ...specs, ibu: e.target.value })}
                      placeholder="30"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>SRM / EBC</Label>
                    <Input
                      value={specs.srm || ""}
                      onChange={(e) => setSpecs({ ...specs, srm: e.target.value })}
                      placeholder="8"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Mash Water</Label>
                    <Input
                      value={specs.mash_water || specs.mash_water_volume || ""}
                      onChange={(e) => setSpecs({ ...specs, mash_water: e.target.value, mash_water_volume: e.target.value })}
                      placeholder="20L"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Sparge Water</Label>
                    <Input
                      value={specs.sparge_water || specs.sparge_water_volume || ""}
                      onChange={(e) => setSpecs({ ...specs, sparge_water: e.target.value, sparge_water_volume: e.target.value })}
                      placeholder="10L"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Brewhouse Efficiency (%)</Label>
                    <Input
                      value={specs.brewhouseEfficiency || ""}
                      onChange={(e) => setSpecs({ ...specs, brewhouseEfficiency: e.target.value })}
                      placeholder="75"
                      className="mt-1"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Ingredients Tab */}
              <TabsContent value="ingredients" className="space-y-6">
                {/* Malts */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <Label className="text-lg font-semibold">Malts</Label>
                    <Button onClick={addMalt} size="sm" variant="outline">
                      <Plus className="mr-2 h-4 w-4" /> Add Malt
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {malts.map((malt, index) => (
                      <Card key={index} className="bg-zinc-800 border-zinc-700">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <span className="font-semibold text-[#FFBF00]">Malt #{index + 1}</span>
                            <Button
                              onClick={() => removeMalt(index)}
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>Name</Label>
                              <Input
                                value={malt.name || ""}
                                onChange={(e) => updateMalt(index, "name", e.target.value)}
                                placeholder="Pilsner Malt"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>Amount</Label>
                              <Input
                                value={malt.amount || ""}
                                onChange={(e) => updateMalt(index, "amount", e.target.value)}
                                placeholder="5kg"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>Percentage (%)</Label>
                              <Input
                                value={malt.percentage || ""}
                                onChange={(e) => updateMalt(index, "percentage", e.target.value)}
                                placeholder="80"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>Amount (grams)</Label>
                              <Input
                                type="number"
                                value={malt.amount_grams || ""}
                                onChange={(e) => updateMalt(index, "amount_grams", parseFloat(e.target.value) || 0)}
                                placeholder="5000"
                                className="mt-1"
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Hops */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <Label className="text-lg font-semibold">Hops</Label>
                    <Button onClick={addHop} size="sm" variant="outline">
                      <Plus className="mr-2 h-4 w-4" /> Add Hop
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {hops.map((hop, index) => (
                      <Card key={index} className="bg-zinc-800 border-zinc-700">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <span className="font-semibold text-[#FFBF00]">Hop #{index + 1}</span>
                            <Button
                              onClick={() => removeHop(index)}
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>Name</Label>
                              <Input
                                value={hop.name || ""}
                                onChange={(e) => updateHop(index, "name", e.target.value)}
                                placeholder="Cascade"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>Amount</Label>
                              <Input
                                value={hop.amount || ""}
                                onChange={(e) => updateHop(index, "amount", e.target.value)}
                                placeholder="50g"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>Time</Label>
                              <Input
                                value={hop.time || ""}
                                onChange={(e) => updateHop(index, "time", e.target.value)}
                                placeholder="60 min"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>Boil Time (minutes)</Label>
                              <Input
                                type="number"
                                value={hop.boil_time || ""}
                                onChange={(e) => updateHop(index, "boil_time", parseInt(e.target.value) || 0)}
                                placeholder="60"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>Alpha Acid (%)</Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={hop.alpha || ""}
                                onChange={(e) => updateHop(index, "alpha", parseFloat(e.target.value) || 0)}
                                placeholder="5.5"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>Amount (grams)</Label>
                              <Input
                                type="number"
                                value={hop.amount_grams || ""}
                                onChange={(e) => updateHop(index, "amount_grams", parseFloat(e.target.value) || 0)}
                                placeholder="50"
                                className="mt-1"
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Yeast */}
                <div>
                  <Label className="text-lg font-semibold mb-4 block">Yeast</Label>
                  <Card className="bg-zinc-800 border-zinc-700">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Name</Label>
                          <Input
                            value={yeast?.name || ""}
                            onChange={(e) => setYeast({ ...yeast, name: e.target.value })}
                            placeholder="Safale US-05"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>Amount</Label>
                          <Input
                            value={yeast?.amount || ""}
                            onChange={(e) => setYeast({ ...yeast, amount: e.target.value })}
                            placeholder="11.5g"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Extras */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <Label className="text-lg font-semibold">Extras & Additives</Label>
                    <Button onClick={addExtra} size="sm" variant="outline">
                      <Plus className="mr-2 h-4 w-4" /> Add Extra
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {extras.map((extra, index) => (
                      <Card key={index} className="bg-zinc-800 border-zinc-700">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <span className="font-semibold text-[#FFBF00]">Extra #{index + 1}</span>
                            <Button
                              onClick={() => removeExtra(index)}
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>Name</Label>
                              <Input
                                value={extra.name || ""}
                                onChange={(e) => updateExtra(index, "name", e.target.value)}
                                placeholder="Irish Moss"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>Amount</Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={extra.amount || ""}
                                onChange={(e) => updateExtra(index, "amount", parseFloat(e.target.value) || 0)}
                                placeholder="5"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>Unit</Label>
                              <Input
                                value={extra.unit || ""}
                                onChange={(e) => updateExtra(index, "unit", e.target.value)}
                                placeholder="g"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>Use</Label>
                              <Input
                                value={extra.use || ""}
                                onChange={(e) => updateExtra(index, "use", e.target.value)}
                                placeholder="Boil"
                                className="mt-1"
                              />
                            </div>
                            <div className="col-span-2">
                              <Label>Time</Label>
                              <Input
                                value={extra.time || ""}
                                onChange={(e) => updateExtra(index, "time", e.target.value)}
                                placeholder="15 min"
                                className="mt-1"
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Mash Schedule Tab */}
              <TabsContent value="mash" className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-lg font-semibold">Mash Schedule</Label>
                  <Button onClick={addMashStep} size="sm" variant="outline">
                    <Plus className="mr-2 h-4 w-4" /> Add Step
                  </Button>
                </div>
                <div className="space-y-3">
                  {mashSchedule.map((step, index) => (
                    <Card key={index} className="bg-zinc-800 border-zinc-700">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <span className="font-semibold text-[#FFBF00]">Step #{index + 1}</span>
                          <Button
                            onClick={() => removeMashStep(index)}
                            size="sm"
                            variant="ghost"
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Step Name</Label>
                            <Input
                              value={step.step || ""}
                              onChange={(e) => updateMashStep(index, "step", e.target.value)}
                              placeholder="Mash In"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label>Temperature</Label>
                            <Input
                              value={step.temp || ""}
                              onChange={(e) => updateMashStep(index, "temp", e.target.value)}
                              placeholder="68°C"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label>Time</Label>
                            <Input
                              value={step.time || ""}
                              onChange={(e) => updateMashStep(index, "time", e.target.value)}
                              placeholder="60 min"
                              className="mt-1"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label>Description</Label>
                            <Textarea
                              value={step.description || ""}
                              onChange={(e) => updateMashStep(index, "description", e.target.value)}
                              placeholder="Description..."
                              className="mt-1"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* Process Instructions Tab */}
              <TabsContent value="process" className="space-y-6">
                {/* Boil Instructions */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <Label className="text-lg font-semibold">Boil Instructions</Label>
                    <Button onClick={addBoilInstruction} size="sm" variant="outline">
                      <Plus className="mr-2 h-4 w-4" /> Add Instruction
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {boilInstructions.map((instruction, index) => (
                      <div key={index} className="flex gap-2">
                        <Textarea
                          value={instruction}
                          onChange={(e) => updateBoilInstruction(index, e.target.value)}
                          placeholder="Boil instruction..."
                          className="flex-1"
                        />
                        <Button
                          onClick={() => removeBoilInstruction(index)}
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fermentation Instructions */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <Label className="text-lg font-semibold">Fermentation Instructions</Label>
                    <Button onClick={addFermentationInstruction} size="sm" variant="outline">
                      <Plus className="mr-2 h-4 w-4" /> Add Instruction
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {fermentationInstructions.map((instruction, index) => (
                      <div key={index} className="flex gap-2">
                        <Textarea
                          value={instruction}
                          onChange={(e) => updateFermentationInstruction(index, e.target.value)}
                          placeholder="Fermentation instruction..."
                          className="flex-1"
                        />
                        <Button
                          onClick={() => removeFermentationInstruction(index)}
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


