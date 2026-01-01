"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { RecipeCard } from "@/components/RecipeCard";
import { ArrowLeft, ArrowRight, Check, Loader2, Info, Beaker, Settings2, ShoppingBasket, Timer, Rocket, Droplets } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { saveRecipe, LimitReachedError } from "@/lib/db";
import { toast } from "sonner";

// --- Types & Interfaces ---
type Expertise = "beginner" | "intermediate" | "expert" | "";
type Equipment = "pot" | "all-in-one" | "professional" | "";

interface SourceWaterProfile {
  mode: "location" | "basic" | "expert";
  location?: string;
  hardness?: number;  // in °dH
  ph?: number;
  ca?: number;
  mg?: number;
  na?: number;
  cl?: number;
  so4?: number;
  hco3?: number;
}

interface WizardData {
  expertise: Expertise;
  equipment: Equipment;
  beerStyle: string;
  flavorProfile: string;
  units: "metric" | "imperial";
  tempUnit: "C" | "F";
  batchSize: number;
  targetABV?: number | "auto";
  targetIBU?: number | "auto";
  targetEBC?: number | "auto";
  ingredientsInStock?: string;
  useWhirlpool: boolean;
  useFruit: boolean;
  useIrishMoss: boolean;
  useAscorbicAcid: boolean;
  useLactose: boolean;
  useDryHop: boolean;
  useSpices: boolean;
  useWood: boolean;
  sourceWaterProfile?: SourceWaterProfile;
}

const BEER_STYLES = [
  "IPA (India Pale Ale)",
  "Stout",
  "Porter",
  "Pilsner",
  "Lager",
  "Wheat Beer",
  "Pale Ale",
  "Amber Ale",
  "Brown Ale",
  "Belgian Ale",
  "Sour Beer",
  "Barleywine",
];

interface GeneratedRecipe {
  name: string;
  description?: string;
  specs?: any;
  originalGravity?: string;
  finalGravity?: string;
  abv?: string;
  ibu?: string;
  srm?: string;
  ingredients?: any;
  malts?: any;
  hops?: any;
  yeast?: any;
  mash_steps?: any;
  mash_schedule?: any;
  boil_instructions?: string[];
  fermentation_instructions?: string[];
  shopping_list?: any;
  estimatedTime: string;
  notes: string;
}

export default function WizardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<GeneratedRecipe | null>(null);
  const [savedRecipeId, setSavedRecipeId] = useState<string | null>(null);
  const [isSavingForBrew, setIsSavingForBrew] = useState(false);

  const [formData, setFormData] = useState<WizardData>({
    expertise: "",
    equipment: "",
    beerStyle: "",
    flavorProfile: "",
    units: "metric",
    tempUnit: "C",
    batchSize: 20,
    targetABV: "auto",
    targetIBU: "auto",
    targetEBC: "auto",
    ingredientsInStock: "",
    useWhirlpool: false,
    useFruit: false,
    useIrishMoss: false,
    useAscorbicAcid: false,
    useLactose: false,
    useDryHop: false,
    useSpices: false,
    useWood: false,
  });

  // Source Water Profile State (Smart Input with Tabs)
  const [waterInputMode, setWaterInputMode] = useState<"location" | "basic" | "expert">("location");
  const [sourceWaterProfile, setSourceWaterProfile] = useState<SourceWaterProfile>({
    mode: "location",
    location: "",
    hardness: undefined,
    ph: 7.0,
  });

  const updateData = (field: keyof WizardData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Validierung für 3 Schritte
  const canProceed = () => {
    switch (currentStep) {
      case 1: // Setup
        return formData.expertise !== "" && formData.equipment !== "";
      case 2: // The Big Form
        return formData.beerStyle !== "" && formData.flavorProfile.trim() !== "" && formData.batchSize > 0;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (canProceed() && currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!canProceed()) {
      alert("Please fill in all required fields.");
      return;
    }

    setIsLoading(true);
    setCurrentStep(3);

    try {
      // Prepare sourceWaterProfile payload - only include relevant fields based on mode
      let waterProfilePayload: SourceWaterProfile | undefined = undefined;
      if (formData.expertise === "expert") {
        if (waterInputMode === "location" && sourceWaterProfile.location?.trim()) {
          waterProfilePayload = {
            mode: "location",
            location: sourceWaterProfile.location.trim(),
          };
        } else if (waterInputMode === "basic" && sourceWaterProfile.hardness !== undefined) {
          waterProfilePayload = {
            mode: "basic",
            hardness: sourceWaterProfile.hardness,
            ph: sourceWaterProfile.ph,
          };
        } else if (waterInputMode === "expert") {
          waterProfilePayload = {
            mode: "expert",
            ca: sourceWaterProfile.ca,
            mg: sourceWaterProfile.mg,
            na: sourceWaterProfile.na,
            cl: sourceWaterProfile.cl,
            so4: sourceWaterProfile.so4,
            hco3: sourceWaterProfile.hco3,
            ph: sourceWaterProfile.ph,
          };
        }
      }

      const payload = {
        ...formData,
        sourceWaterProfile: waterProfilePayload,
      };

      const response = await fetch("/api/generate-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success && result.recipe) {
        setGeneratedRecipe(result.recipe);
      } else {
        alert(`Failed: ${result.message}`);
        setCurrentStep(2);
      }
    } catch (error) {
      console.error(error);
      alert("Error generating recipe.");
      setCurrentStep(2);
    } finally {
      setIsLoading(false);
    }
  };

  const StepIndicator = () => (
    <div className="mb-8 flex items-center justify-center gap-2">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
              step === currentStep
                ? "border-primary bg-transparent text-primary"
                : step < currentStep
                  ? "border-[#4CBB17] bg-[#4CBB17] text-white"
                  : "border-muted bg-transparent text-muted-foreground"
            }`}
          >
            {step < currentStep ? (
              <Check className="h-5 w-5" />
            ) : (
              <span className="text-sm font-semibold">{step}</span>
            )}
          </div>
          {step < 3 && (
            <div
              className={`h-1 w-12 transition-colors ${
                step < currentStep ? "bg-[#4CBB17]" : "bg-muted"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        <Card className="mb-8 shadow-lg border-zinc-800">
          <CardHeader>
            <CardTitle className="text-2xl sm:text-3xl text-[#FFBF00]">The Brew Wizard</CardTitle>
            <CardDescription>Create your custom recipe in 3 simple steps</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <StepIndicator />

            {/* --- STEP 1: SETUP --- */}
            {currentStep === 1 && (
              <div className="space-y-6 max-w-lg mx-auto">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold">Let's set up your profile</h2>
                  <p className="text-muted-foreground text-sm">This helps us tailor the difficulty and efficiency.</p>
                </div>

                <div>
                  <Label className="mb-2 block text-base">Expertise Level</Label>
                  <Select
                    value={formData.expertise}
                    onValueChange={(v) => updateData("expertise", v as Expertise)}
                  >
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Select Level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="expert">Expert</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.expertise === "beginner" && (
                    <p className="mt-2 text-xs text-muted-foreground flex gap-1">
                      <Info className="h-3 w-3" /> Easy steps, dry yeast, safe results.
                    </p>
                  )}
                  {formData.expertise === "expert" && (
                    <p className="mt-2 text-xs text-[#FFBF00] flex gap-1">
                      <Info className="h-3 w-3" /> Full control over water, yeast & process.
                    </p>
                  )}
                </div>

                <div>
                  <Label className="mb-2 block text-base">Equipment Profile</Label>
                  <Select
                    value={formData.equipment}
                    onValueChange={(v) => updateData("equipment", v as Equipment)}
                  >
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Select Equipment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pot">Pot / BIAB</SelectItem>
                      <SelectItem value="all-in-one">All-in-One System</SelectItem>
                      <SelectItem value="professional">Professional Setup</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.equipment === "pot" && (
                    <p className="mt-2 text-xs text-muted-foreground flex gap-1">
                      <Info className="h-3 w-3" /> Adjusted for 65% efficiency.
                    </p>
                  )}
                </div>

                {/* Units Selection */}
                <div className="space-y-4 pt-4 border-t border-zinc-800">
                  <div className="space-y-2">
                    <Label className="text-base">Weight & Volume Units</Label>
                    <div className="flex items-center justify-center gap-3">
                      <Label htmlFor="unit-switch" className="text-sm cursor-pointer">
                        Metric
                      </Label>
                      <Switch
                        id="unit-switch"
                        checked={formData.units === "imperial"}
                        onCheckedChange={(c) => {
                          updateData("units", c ? "imperial" : "metric");
                          // Auto-set tempUnit to F when imperial is selected
                          if (c) {
                            updateData("tempUnit", "F");
                          }
                        }}
                      />
                      <Label htmlFor="unit-switch" className="text-sm cursor-pointer">
                        Imperial
                      </Label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base">Temperature Units</Label>
                    <div className="flex items-center justify-center gap-3">
                      <Label htmlFor="temp-switch" className="text-sm cursor-pointer">
                        Celsius (°C)
                      </Label>
                      <Switch
                        id="temp-switch"
                        checked={formData.tempUnit === "F"}
                        onCheckedChange={(c) => updateData("tempUnit", c ? "F" : "C")}
                      />
                      <Label htmlFor="temp-switch" className="text-sm cursor-pointer">
                        Fahrenheit (°F)
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- STEP 2: THE RECIPE --- */}
            {currentStep === 2 && (
              <div className="space-y-8">
                {/* Section A: Core Style */}
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-lg font-semibold text-primary">
                      <Beaker className="h-5 w-5" /> <span>Core Definition</span>
                    </div>
                    <div>
                      <Label className="mb-1.5 block">Beer Style</Label>
                      <Select
                        value={formData.beerStyle}
                        onValueChange={(v) => updateData("beerStyle", v)}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select Style" />
                        </SelectTrigger>
                        <SelectContent>
                          {BEER_STYLES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-1.5 block">Batch Size ({formData.units === "metric" ? "L" : "gal"})</Label>
                      <div className="flex gap-4">
                        <Input
                          type="number"
                          value={formData.batchSize}
                          onChange={(e) => updateData("batchSize", parseFloat(e.target.value) || 0)}
                          className="h-11"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-lg font-semibold text-primary">
                      <Settings2 className="h-5 w-5" /> <span>Target Profile</span>
                    </div>
                    <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                      <div className="flex justify-between mb-2">
                        <Label className="text-xs">Target ABV</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Auto</span>
                          <Switch
                            checked={formData.targetABV === "auto"}
                            onCheckedChange={(c) => updateData("targetABV", c ? "auto" : 5.0)}
                            className="scale-75"
                          />
                        </div>
                      </div>
                      {formData.targetABV !== "auto" && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <Slider
                              min={4}
                              max={20}
                              step={0.1}
                              value={[Number(formData.targetABV)]}
                              onValueChange={(v) => updateData("targetABV", v[0])}
                              className="flex-1 py-2"
                            />
                            <Input
                              type="number"
                              min={4}
                              max={20}
                              step={0.1}
                              value={formData.targetABV}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val >= 4 && val <= 20) {
                                  updateData("targetABV", val);
                                }
                              }}
                              className="w-20 h-8 text-sm"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                      <div className="flex justify-between mb-2">
                        <Label className="text-xs">Target Bitterness (IBU)</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Auto</span>
                          <Switch
                            checked={formData.targetIBU === "auto"}
                            onCheckedChange={(c) => updateData("targetIBU", c ? "auto" : 40)}
                            className="scale-75"
                          />
                        </div>
                      </div>
                      {formData.targetIBU !== "auto" && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <Slider
                              min={10}
                              max={150}
                              step={5}
                              value={[Number(formData.targetIBU)]}
                              onValueChange={(v) => updateData("targetIBU", v[0])}
                              className="flex-1 py-2"
                            />
                            <Input
                              type="number"
                              min={10}
                              max={150}
                              step={5}
                              value={formData.targetIBU}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val >= 10 && val <= 150) {
                                  updateData("targetIBU", val);
                                }
                              }}
                              className="w-20 h-8 text-sm"
                            />
                            <span className="text-xs text-muted-foreground">IBU</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                      <div className="flex justify-between mb-2">
                        <Label className="text-xs">Target Color (EBC)</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Auto</span>
                          <Switch
                            checked={formData.targetEBC === "auto"}
                            onCheckedChange={(c) => updateData("targetEBC", c ? "auto" : 15)}
                            className="scale-75"
                          />
                        </div>
                      </div>
                      {formData.targetEBC !== "auto" && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <Slider
                              min={4}
                              max={150}
                              step={1}
                              value={[Number(formData.targetEBC)]}
                              onValueChange={(v) => updateData("targetEBC", v[0])}
                              className="flex-1 py-2"
                            />
                            <Input
                              type="number"
                              min={4}
                              max={150}
                              step={1}
                              value={formData.targetEBC}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val >= 4 && val <= 150) {
                                  updateData("targetEBC", val);
                                }
                              }}
                              className="w-20 h-8 text-sm"
                            />
                            <span className="text-xs text-muted-foreground">EBC</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="h-px bg-zinc-800 my-6" />

                {/* Section B: Flavor & Stock */}
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <Label className="mb-2 block font-medium">Flavor Profile & Description</Label>
                    <Textarea
                      placeholder={
                        formData.expertise === "beginner"
                          ? "E.g. fruity, not too bitter..."
                          : "E.g. Hazy, juicy, lots of Citra..."
                      }
                      className="min-h-[120px]"
                      value={formData.flavorProfile}
                      onChange={(e) => updateData("flavorProfile", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block font-medium flex items-center gap-2">
                      <ShoppingBasket className="h-4 w-4" /> Ingredients in Stock (Optional)
                    </Label>
                    <Textarea
                      placeholder="I have 50g Citra left, prefer Maris Otter malt..."
                      className="min-h-[120px]"
                      value={formData.ingredientsInStock || ""}
                      onChange={(e) => updateData("ingredientsInStock", e.target.value)}
                    />
                  </div>
                </div>

                {/* Section C: Water Chemistry (Expert Only) */}
                {formData.expertise === "expert" && (
                  <>
                    <div className="h-px bg-zinc-800 my-6" />
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Droplets className="h-5 w-5 text-blue-400" />
                        <Label className="font-semibold text-blue-400">
                          Source Water Profile (mg/L)
                        </Label>
                      </div>
                      <Tabs 
                        value={waterInputMode} 
                        onValueChange={(value) => {
                          const mode = value as "location" | "basic" | "expert";
                          setWaterInputMode(mode);
                          setSourceWaterProfile({
                            ...sourceWaterProfile,
                            mode: mode,
                          });
                        }}
                        className="w-full"
                      >
                        <TabsList className="grid w-full grid-cols-3 mb-4">
                          <TabsTrigger value="location" className="text-xs sm:text-sm">
                            📍 Simple (Location)
                          </TabsTrigger>
                          <TabsTrigger value="basic" className="text-xs sm:text-sm">
                            🧪 Test Strip (Basic)
                          </TabsTrigger>
                          <TabsTrigger value="expert" className="text-xs sm:text-sm">
                            🔬 Expert (Report)
                          </TabsTrigger>
                        </TabsList>

                        {/* Tab 1: Simple / Location */}
                        <TabsContent value="location" className="space-y-3 mt-4">
                          <p className="text-sm text-muted-foreground">
                            Don't know your values? Tell us where you are, and our AI will estimate the profile.
                          </p>
                          <div>
                            <Label className="text-sm mb-2 block">Location / Water Type</Label>
                            <Input
                              type="text"
                              placeholder="e.g. Munich, Germany or 'Hard Tap Water'"
                              value={sourceWaterProfile.location || ""}
                              onChange={(e) =>
                                setSourceWaterProfile({
                                  ...sourceWaterProfile,
                                  mode: "location",
                                  location: e.target.value,
                                })
                              }
                              className="h-10"
                            />
                          </div>
                        </TabsContent>

                        {/* Tab 2: Test Strip / Basic */}
                        <TabsContent value="basic" className="space-y-3 mt-4">
                          <p className="text-sm text-muted-foreground">
                            Enter values from a standard aquarium or pool test strip.
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm mb-2 block">Total Hardness (°dH)</Label>
                              <Input
                                type="number"
                                step="0.1"
                                placeholder="e.g. 12"
                                value={sourceWaterProfile.hardness || ""}
                                onChange={(e) =>
                                  setSourceWaterProfile({
                                    ...sourceWaterProfile,
                                    mode: "basic",
                                    hardness: parseFloat(e.target.value) || undefined,
                                  })
                                }
                                className="h-10"
                              />
                            </div>
                            <div>
                              <Label className="text-sm mb-2 block">pH Value</Label>
                              <Input
                                type="number"
                                step="0.1"
                                min="5"
                                max="9"
                                placeholder="7.0"
                                value={sourceWaterProfile.ph || ""}
                                onChange={(e) =>
                                  setSourceWaterProfile({
                                    ...sourceWaterProfile,
                                    mode: "basic",
                                    ph: parseFloat(e.target.value) || undefined,
                                  })
                                }
                                className="h-10"
                              />
                            </div>
                          </div>
                        </TabsContent>

                        {/* Tab 3: Expert / Lab Report */}
                        <TabsContent value="expert" className="space-y-3 mt-4">
                          <p className="text-sm text-muted-foreground">
                            Enter the exact report from your water supplier.
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <Label className="text-xs mb-1 block">Calcium (Ca)</Label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  step="0.1"
                                  placeholder="0"
                                  value={sourceWaterProfile.ca || ""}
                                  onChange={(e) =>
                                    setSourceWaterProfile({
                                      ...sourceWaterProfile,
                                      mode: "expert",
                                      ca: parseFloat(e.target.value) || undefined,
                                    })
                                  }
                                  className="h-9 text-sm pr-12"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                                  mg/L
                                </span>
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs mb-1 block">Magnesium (Mg)</Label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  step="0.1"
                                  placeholder="0"
                                  value={sourceWaterProfile.mg || ""}
                                  onChange={(e) =>
                                    setSourceWaterProfile({
                                      ...sourceWaterProfile,
                                      mode: "expert",
                                      mg: parseFloat(e.target.value) || undefined,
                                    })
                                  }
                                  className="h-9 text-sm pr-12"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                                  mg/L
                                </span>
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs mb-1 block">Sodium (Na)</Label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  step="0.1"
                                  placeholder="0"
                                  value={sourceWaterProfile.na || ""}
                                  onChange={(e) =>
                                    setSourceWaterProfile({
                                      ...sourceWaterProfile,
                                      mode: "expert",
                                      na: parseFloat(e.target.value) || undefined,
                                    })
                                  }
                                  className="h-9 text-sm pr-12"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                                  mg/L
                                </span>
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs mb-1 block">Chloride (Cl)</Label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  step="0.1"
                                  placeholder="0"
                                  value={sourceWaterProfile.cl || ""}
                                  onChange={(e) =>
                                    setSourceWaterProfile({
                                      ...sourceWaterProfile,
                                      mode: "expert",
                                      cl: parseFloat(e.target.value) || undefined,
                                    })
                                  }
                                  className="h-9 text-sm pr-12"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                                  mg/L
                                </span>
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs mb-1 block">Sulfate (SO₄)</Label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  step="0.1"
                                  placeholder="0"
                                  value={sourceWaterProfile.so4 || ""}
                                  onChange={(e) =>
                                    setSourceWaterProfile({
                                      ...sourceWaterProfile,
                                      mode: "expert",
                                      so4: parseFloat(e.target.value) || undefined,
                                    })
                                  }
                                  className="h-9 text-sm pr-12"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                                  mg/L
                                </span>
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs mb-1 block">Bicarbonate (HCO₃)</Label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  step="0.1"
                                  placeholder="0"
                                  value={sourceWaterProfile.hco3 || ""}
                                  onChange={(e) =>
                                    setSourceWaterProfile({
                                      ...sourceWaterProfile,
                                      mode: "expert",
                                      hco3: parseFloat(e.target.value) || undefined,
                                    })
                                  }
                                  className="h-9 text-sm pr-12"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                                  mg/L
                                </span>
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs mb-1 block">pH (Optional)</Label>
                              <Input
                                type="number"
                                step="0.1"
                                min="5"
                                max="9"
                                placeholder="7.0"
                                value={sourceWaterProfile.ph || ""}
                                onChange={(e) =>
                                  setSourceWaterProfile({
                                    ...sourceWaterProfile,
                                    mode: "expert",
                                    ph: parseFloat(e.target.value) || undefined,
                                  })
                                }
                                className="h-9 text-sm"
                              />
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  </>
                )}

                {/* Section D: Advanced Add-ons (Only if not beginner) */}
                {formData.expertise !== "beginner" && (
                  <>
                    <div className="h-px bg-zinc-800 my-6" />
                    <div className="space-y-6">
                      {/* Bereich A: Flavor Profile */}
                      <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
                        <Label className="block mb-4 font-semibold text-purple-400">
                          Flavor Profile (Creative)
                        </Label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="lactose"
                              checked={formData.useLactose}
                              onCheckedChange={(c) => updateData("useLactose", !!c)}
                            />
                            <Label htmlFor="lactose" className="font-normal cursor-pointer text-sm" title="Milk Sugar for sweetness">
                              Lactose
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="fruit"
                              checked={formData.useFruit}
                              onCheckedChange={(c) => updateData("useFruit", !!c)}
                            />
                            <Label htmlFor="fruit" className="font-normal cursor-pointer text-sm" title="Puree, Peel or Juice">
                              Fruit
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="spices"
                              checked={formData.useSpices}
                              onCheckedChange={(c) => updateData("useSpices", !!c)}
                            />
                            <Label htmlFor="spices" className="font-normal cursor-pointer text-sm" title="Herbs, Coffee, Cinnamon...">
                              Spices
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="wood"
                              checked={formData.useWood}
                              onCheckedChange={(c) => updateData("useWood", !!c)}
                            />
                            <Label htmlFor="wood" className="font-normal cursor-pointer text-sm" title="Chips or Cubes">
                              Wood/Oak
                            </Label>
                          </div>
                        </div>
                      </div>

                      {/* Bereich B: Brewing Techniques */}
                      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                        <Label className="block mb-4 font-semibold text-blue-400">
                          Brewing Techniques (Process)
                        </Label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="whirlpool"
                              checked={formData.useWhirlpool}
                              onCheckedChange={(c) => updateData("useWhirlpool", !!c)}
                            />
                            <Label htmlFor="whirlpool" className="font-normal cursor-pointer text-sm" title="Adds hops at ~80°C for aroma without bitterness. Recommended for NEIPA/IPA.">
                              Whirlpool / Hop Stand
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="dryhop"
                              checked={formData.useDryHop}
                              onCheckedChange={(c) => updateData("useDryHop", !!c)}
                            />
                            <Label htmlFor="dryhop" className="font-normal cursor-pointer text-sm" title="Adding hops during fermentation.">
                              Dry Hopping
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="irishmoss"
                              checked={formData.useIrishMoss}
                              onCheckedChange={(c) => updateData("useIrishMoss", !!c)}
                            />
                            <Label htmlFor="irishmoss" className="font-normal cursor-pointer text-sm" title="Add fining agents to boil for clearer beer.">
                              Clarification (Irish Moss)
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="waterchem"
                              checked={formData.expertise === "expert" && !!formData.sourceWaterProfile}
                              disabled={true}
                              title={formData.expertise !== "expert" ? "Available in Expert Mode only" : "Calculate exact salt additions."}
                            />
                            <Label htmlFor="waterchem" className="font-normal cursor-pointer text-sm text-muted-foreground" title={formData.expertise !== "expert" ? "Available in Expert Mode only" : "Calculate exact salt additions."}>
                              Water Chemistry
                            </Label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* --- STEP 3: RESULT / LOADING --- */}
            {currentStep === 3 && (
              <div className="min-h-[400px] flex flex-col items-center justify-center">
                {isLoading ? (
                  <div className="text-center space-y-4 animate-in fade-in duration-500">
                    <Loader2 className="h-12 w-12 animate-spin text-[#FFBF00] mx-auto" />
                    <div>
                      <h3 className="text-2xl font-bold text-primary">Brewing your recipe...</h3>
                      <p className="text-muted-foreground mt-2">
                        Calculating water chemistry, adjusting hop bitterness <br />
                        and selecting the perfect yeast.
                      </p>
                    </div>
                  </div>
                ) : generatedRecipe ? (
                  <div className="w-full animate-in slide-in-from-bottom-4 duration-500">
                    <RecipeCard recipe={generatedRecipe} units={formData.units} />
                  </div>
                ) : null}
              </div>
            )}

            {/* --- NAVIGATION BUTTONS --- */}
            <div className="mt-8 flex gap-4 pt-4 border-t border-zinc-800">
              {currentStep === 1 && (
                <Button
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="w-full h-14 text-lg bg-[#FFBF00] text-black hover:bg-[#FFBF00]/90"
                >
                  Get Started <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              )}

              {currentStep === 2 && (
                <>
                  <Button onClick={prevStep} variant="outline" className="h-14 px-8 border-zinc-700">
                    Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!canProceed() || isLoading}
                    className="flex-1 h-14 text-lg font-bold bg-[#FFBF00] text-black hover:bg-[#FFBF00]/90"
                  >
                    Create Recipe Now <Beaker className="ml-2 h-5 w-5" />
                  </Button>
                </>
              )}

              {currentStep === 3 && generatedRecipe && !isLoading && (
                <div className="w-full space-y-4">
                  {/* Brew Session Button */}
                  {savedRecipeId ? (
                    <Link href={`/brew/${savedRecipeId}`} className="block w-full">
                      <Button
                        size="lg"
                        className="w-full bg-[#FFBF00] text-black hover:bg-[#FFBF00]/90 text-xl px-8 py-8 h-auto font-bold shadow-lg hover:shadow-xl transition-all"
                      >
                        <Rocket className="mr-3 h-6 w-6" />
                        🚀 Start Brew Session
                      </Button>
                    </Link>
                  ) : user ? (
                    <Button
                      size="lg"
                      onClick={async () => {
                        if (!user || !generatedRecipe) return;
                        setIsSavingForBrew(true);
                        try {
                          const recipeId = await saveRecipe(user.uid, {
                            name: generatedRecipe.name,
                            description: generatedRecipe.description,
                            specs: generatedRecipe.specs,
                            ingredients: generatedRecipe.ingredients,
                            malts: generatedRecipe.malts,
                            hops: generatedRecipe.hops,
                            yeast: generatedRecipe.yeast,
                            mash_schedule: generatedRecipe.mash_schedule,
                            boil_instructions: generatedRecipe.boil_instructions,
                            fermentation_instructions: generatedRecipe.fermentation_instructions,
                            shopping_list: generatedRecipe.shopping_list,
                            estimatedTime: generatedRecipe.estimatedTime,
                            notes: generatedRecipe.notes,
                          });
                          setSavedRecipeId(recipeId);
                          toast.success("Recipe saved! Redirecting to Brew Day Mode...");
                          setTimeout(() => {
                            router.push(`/brew/${recipeId}`);
                          }, 1000);
                        } catch (error: any) {
                          console.error("Error saving recipe:", error);
                          if (error instanceof LimitReachedError || error?.message === "LIMIT_REACHED" || error?.name === "LimitReachedError") {
                            toast.error("Recipe limit reached (3 recipes). Upgrade to Pro for unlimited recipes!", {
                              action: {
                                label: "Upgrade",
                                onClick: async () => {
                                  if (!user) return;
                                  try {
                                    const response = await fetch("/api/checkout", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ userId: user.uid }),
                                    });
                                    const data = await response.json();
                                    if (data.url) {
                                      window.location.href = data.url;
                                    }
                                  } catch (err) {
                                    console.error("Checkout error:", err);
                                  }
                                },
                              },
                            });
                          } else {
                            toast.error("Failed to save recipe");
                          }
                        } finally {
                          setIsSavingForBrew(false);
                        }
                      }}
                      disabled={isSavingForBrew}
                      className="w-full bg-[#FFBF00] text-black hover:bg-[#FFBF00]/90 text-xl px-8 py-8 h-auto font-bold shadow-lg hover:shadow-xl transition-all"
                    >
                      {isSavingForBrew ? (
                        <>
                          <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Rocket className="mr-3 h-6 w-6" />
                          🚀 Start Brew Session
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      onClick={() => {
                        toast.info("Please login to start a brew session");
                        router.push("/");
                      }}
                      variant="outline"
                      className="w-full border-zinc-700 text-lg py-6"
                    >
                      <Timer className="mr-2 h-5 w-5" />
                      Login to Start Brew Session
                    </Button>
                  )}
                  
                  <Button
                    onClick={() => setCurrentStep(2)}
                    variant="outline"
                    className="w-full border-zinc-700"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Edit & Regenerate
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
