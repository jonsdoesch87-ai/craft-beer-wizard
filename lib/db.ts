import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

export interface BrewLog {
  measuredMashTemp?: number;
  measuredPreBoilGravity?: number;
  measuredOG?: number;
  measuredVolume?: number;
  measuredFG?: number;
  bottlingDate?: Timestamp;
  carbonationType?: "sugar" | "dextrose" | "speise" | "drops" | "spunding";
  carbonationAmount?: number;
  fermentationReadings?: { date: Timestamp; sg: number; plato: number }[];
}

export interface FermentationScheduleStep {
  day: number;
  type: "temp" | "dryhop" | "additive" | "reading" | "other";
  description: string;
  value?: string; // e.g., temperature, amount
  completed?: boolean;
  completedAt?: Timestamp;
}

export interface Measurement {
  date: Timestamp;
  gravity: number; // SG value
  temp?: number; // Temperature in °C
  source: "manual" | "device";
  note?: string; // User notes for this measurement
}

export interface Extra {
  name: string;
  amount: number;
  unit: string; // e.g., 'kg', 'g', 'items', 'L'
  use: "Mash" | "Boil" | "Fermentation" | "Secondary";
  time: string; // e.g., "10 min", "Day 5", "Secondary"
  description?: string;
}

export interface BatchData {
  batchNumber: number;
  status: "brewing" | "fermenting" | "conditioning" | "completed";
  startedAt: Timestamp;
  completedAt?: Timestamp;
  // Snapshot of recipe at batch start (in case recipe changes later)
  recipeSnapshot?: {
    targetOG?: number;
    targetFG?: number;
    targetABV?: number;
    targetIBU?: number;
  };
  // Brew day data
  brewLog?: BrewLog;
  // Checklist states
  prepChecklist?: Array<{ id: string; label: string; checked: boolean }>;
  coolChecklist?: Array<{ id: string; label: string; checked: boolean }>;
  // Timer states (for persistence)
  mashTimerState?: {
    timeLeft: number;
    totalTime: number;
    isRunning: boolean;
  };
  boilTimerState?: {
    timeLeft: number;
    totalTime: number;
    isRunning: boolean;
  };
  // Hop additions tracking
  hopAdditions?: string[];
  // Fermentation tracking
  fermentationSchedule?: Array<{
    day: number;
    action: string;
    completed: boolean;
  }>;
  fermentationHistory?: Array<{
    day: number;
    type: string;
    completedAt: Timestamp;
  }>;
  measurements?: Measurement[];
  carbonationMethod?: "priming" | "spunding" | "forced"; // Default: "priming"
  // Notes and rating
  notes?: string;
  rating?: number;
  reviewNotes?: string;
}

export interface RecipeData {
  name: string;
  description?: string;
  specs?: any;
  ingredients?: any;
  malts?: any;
  hops?: any;
  yeast?: any;
  mash_schedule?: any;
  boil_instructions?: string[];
  fermentation_instructions?: string[]; // Legacy: Keep for backward compatibility
  fermentationSchedule?: FermentationScheduleStep[]; // New structured schedule
  shopping_list?: any;
  estimatedTime?: string;
  notes?: string;
  predictedFG?: number; // Theoretical final gravity from yeast/recipe
  status: "planned" | "brewing" | "fermenting" | "conditioning" | "completed";
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  rating?: number;
  reviewNotes?: string;
  brewLog?: BrewLog; // Deprecated: Use batches instead
  parentRecipeId?: string; // For versioning: points to original recipe
}

export interface UserProfile {
  isPro: boolean;
  createdAt: Timestamp;
}

export async function createUserProfile(userId: string) {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    // Only create if doesn't exist
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        isPro: false,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Error creating user profile:", error);
    throw error;
  }
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return userSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    throw error;
  }
}

// Helper function to remove undefined values from objects (Firestore doesn't allow undefined)
function removeUndefined(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined).filter(item => item !== undefined);
  }
  
  if (typeof obj === "object" && obj.constructor === Object) {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
        cleaned[key] = removeUndefined(obj[key]);
      }
    }
    return cleaned;
  }
  
  return obj;
}

// Custom Error Class for Recipe Limit
export class LimitReachedError extends Error {
  constructor(message: string = "LIMIT_REACHED") {
    super(message);
    this.name = "LimitReachedError";
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LimitReachedError);
    }
  }
}

export async function saveRecipe(userId: string, recipeData: Omit<RecipeData, "status" | "createdAt">) {
  try {
    // Check user profile and recipe count
    const userProfile = await getUserProfile(userId);
    const isPro = userProfile?.isPro ?? false;

    // Count existing recipes
    const recipesRef = collection(db, "users", userId, "recipes");
    const recipesSnapshot = await getDocs(recipesRef);
    const recipeCount = recipesSnapshot.size;

    // Check limit: Free users can only save 100 recipes (temporarily increased)
    if (recipeCount >= 100 && !isPro) {
      throw new LimitReachedError("LIMIT_REACHED");
    }

    // Remove all undefined values before saving to Firestore
    const cleanedData = removeUndefined(recipeData);

    const recipeWithMeta = {
      ...cleanedData,
      status: "planned" as const,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "users", userId, "recipes"), recipeWithMeta);
    return docRef.id;
  } catch (error) {
    console.error("Error saving recipe:", error);
    throw error;
  }
}

export async function getUserRecipes(userId: string): Promise<(RecipeData & { id: string })[]> {
  try {
    const recipesRef = collection(db, "users", userId, "recipes");
    const q = query(recipesRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as RecipeData),
    }));
  } catch (error) {
    console.error("Error fetching recipes:", error);
    throw error;
  }
}

export async function getRecipe(userId: string, recipeId: string): Promise<(RecipeData & { id: string }) | null> {
  try {
    const recipeRef = doc(db, "users", userId, "recipes", recipeId);
    const recipeSnap = await getDoc(recipeRef);

    if (recipeSnap.exists()) {
      return {
        id: recipeSnap.id,
        ...(recipeSnap.data() as RecipeData),
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching recipe:", error);
    throw error;
  }
}

export async function updateRecipeRating(
  userId: string,
  recipeId: string,
  rating: number,
  notes: string
) {
  try {
    const recipeRef = doc(db, "users", userId, "recipes", recipeId);
    await updateDoc(recipeRef, {
      rating,
      reviewNotes: notes,
      status: "completed",
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating recipe rating:", error);
    throw error;
  }
}

export async function updateRecipe(
  userId: string,
  recipeId: string,
  updates: Partial<RecipeData>
) {
  try {
    const recipeRef = doc(db, "users", userId, "recipes", recipeId);
    const cleanedUpdates = removeUndefined(updates);
    await updateDoc(recipeRef, {
      ...cleanedUpdates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating recipe:", error);
    throw error;
  }
}

export async function deleteRecipe(userId: string, recipeId: string) {
  try {
    const recipeRef = doc(db, "users", userId, "recipes", recipeId);
    await deleteDoc(recipeRef);
  } catch (error) {
    console.error("Error deleting recipe:", error);
    throw error;
  }
}

// ========== BATCH FUNCTIONS ==========

/**
 * Start a new batch for a recipe
 * Creates a new document in users/{userId}/recipes/{recipeId}/batches
 */
export async function startNewBatch(
  userId: string,
  recipeId: string
): Promise<string> {
  try {
    // Get recipe to snapshot target values
    const recipe = await getRecipe(userId, recipeId);
    if (!recipe) {
      throw new Error("Recipe not found");
    }

    // Count existing batches to get next batch number
    const batchesRef = collection(db, "users", userId, "recipes", recipeId, "batches");
    const batchesSnapshot = await getDocs(batchesRef);
    const batchNumber = batchesSnapshot.size + 1;

    // Create batch document
    const batchData: Omit<BatchData, "startedAt"> = {
      batchNumber,
      status: "brewing",
      recipeSnapshot: {
        targetOG: recipe.specs?.og || recipe.specs?.original_gravity,
        targetFG: recipe.specs?.fg || recipe.specs?.final_gravity,
        targetABV: recipe.specs?.abv,
        targetIBU: recipe.specs?.ibu,
      },
    };

    const cleanedData = removeUndefined(batchData);
    const batchRef = await addDoc(batchesRef, {
      ...cleanedData,
      startedAt: serverTimestamp(),
    });

    return batchRef.id;
  } catch (error) {
    console.error("Error starting new batch:", error);
    throw error;
  }
}

/**
 * Update a batch document
 */
export async function updateBatch(
  userId: string,
  recipeId: string,
  batchId: string,
  updates: Partial<BatchData>
) {
  try {
    const batchRef = doc(db, "users", userId, "recipes", recipeId, "batches", batchId);
    const cleanedUpdates = removeUndefined(updates);
    await updateDoc(batchRef, cleanedUpdates);
  } catch (error) {
    console.error("Error updating batch:", error);
    throw error;
  }
}

/**
 * Get a specific batch
 */
export async function getBatch(
  userId: string,
  recipeId: string,
  batchId: string
): Promise<(BatchData & { id: string }) | null> {
  try {
    const batchRef = doc(db, "users", userId, "recipes", recipeId, "batches", batchId);
    const batchSnap = await getDoc(batchRef);

    if (batchSnap.exists()) {
      return {
        id: batchSnap.id,
        ...(batchSnap.data() as BatchData),
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching batch:", error);
    throw error;
  }
}

/**
 * Get all batches for a recipe
 */
export async function getBatches(
  userId: string,
  recipeId: string
): Promise<(BatchData & { id: string })[]> {
  try {
    const batchesRef = collection(db, "users", userId, "recipes", recipeId, "batches");
    const q = query(batchesRef, orderBy("startedAt", "desc"));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as BatchData),
    }));
  } catch (error) {
    console.error("Error fetching batches:", error);
    throw error;
  }
}

/**
 * Get the active batch (status: 'brewing' or 'fermenting')
 * Uses client-side filtering to avoid Firestore index requirements
 */
export async function getActiveBatch(
  userId: string,
  recipeId: string
): Promise<(BatchData & { id: string }) | null> {
  try {
    // Get all batches and filter client-side to avoid index requirements
    const allBatches = await getBatches(userId, recipeId);
    
    // Find active batches (brewing, fermenting, or conditioning)
    const activeBatches = allBatches.filter(
      (b) => b.status === "brewing" || b.status === "fermenting" || b.status === "conditioning"
    );
    
    // Sort by startedAt (most recent first) and return the first one
    activeBatches.sort((a, b) => {
      const aTime = a.startedAt?.toDate ? a.startedAt.toDate().getTime() : (a.startedAt as any)?.seconds * 1000 || 0;
      const bTime = b.startedAt?.toDate ? b.startedAt.toDate().getTime() : (b.startedAt as any)?.seconds * 1000 || 0;
      return bTime - aTime; // Descending (newest first)
    });
    
    return activeBatches[0] || null;
  } catch (error) {
    console.error("Error fetching active batch:", error);
    return null;
  }
}

/**
 * Create a new version of a recipe
 * Copies the recipe and appends version number to name
 */
export async function createRecipeVersion(
  userId: string,
  originalRecipeId: string
): Promise<string> {
  try {
    // Get original recipe
    const original = await getRecipe(userId, originalRecipeId);
    if (!original) {
      throw new Error("Original recipe not found");
    }

    // Count existing versions (recipes with same base name or parentRecipeId)
    const recipesRef = collection(db, "users", userId, "recipes");
    const allRecipes = await getUserRecipes(userId);
    
    // Find version number by counting recipes with similar names
    const baseName = original.name.replace(/\s*\(v\d+\)$/i, "").trim();
    const versionedRecipes = allRecipes.filter((r) =>
      r.name.startsWith(baseName) || (r as any).parentRecipeId === originalRecipeId
    );
    const versionNumber = versionedRecipes.length + 1;

    // Create new recipe document
    const newRecipeData: Omit<RecipeData, "status" | "createdAt"> = {
      name: versionNumber === 1 ? original.name : `${baseName} (v${versionNumber})`,
      description: original.description,
      specs: original.specs,
      ingredients: original.ingredients,
      malts: original.malts,
      hops: original.hops,
      yeast: original.yeast,
      mash_schedule: original.mash_schedule,
      boil_instructions: original.boil_instructions,
      fermentation_instructions: original.fermentation_instructions,
      shopping_list: original.shopping_list,
      estimatedTime: original.estimatedTime,
      notes: original.notes,
    };

    const cleanedData = removeUndefined(newRecipeData);
    const newRecipeRef = await addDoc(recipesRef, {
      ...cleanedData,
      status: "planned" as const,
      createdAt: serverTimestamp(),
      parentRecipeId: originalRecipeId, // Track parent for versioning
    });

    return newRecipeRef.id;
  } catch (error) {
    console.error("Error creating recipe version:", error);
    throw error;
  }
}

/**
 * Get all active batches across all recipes for a user
 * Returns batches with status: 'brewing', 'fermenting', or 'conditioning'
 */
export async function getAllActiveBatches(
  userId: string
): Promise<Array<BatchData & { id: string; recipeId: string; recipeName: string }>> {
  try {
    const allActiveBatches: Array<BatchData & { id: string; recipeId: string; recipeName: string }> = [];
    
    // Get all recipes for the user
    const recipes = await getUserRecipes(userId);
    
    // For each recipe, get active batches
    for (const recipe of recipes) {
      const batches = await getBatches(userId, recipe.id);
      const activeBatches = batches.filter(
        (b) => b.status === "brewing" || b.status === "fermenting" || b.status === "conditioning"
      );
      
      for (const batch of activeBatches) {
        allActiveBatches.push({
          ...batch,
          recipeId: recipe.id,
          recipeName: recipe.name,
        });
      }
    }
    
    // Sort by startedAt (most recent first)
    allActiveBatches.sort((a, b) => {
      const aTime = a.startedAt?.toDate?.()?.getTime() || 0;
      const bTime = b.startedAt?.toDate?.()?.getTime() || 0;
      return bTime - aTime;
    });
    
    return allActiveBatches;
  } catch (error) {
    console.error("Error fetching all active batches:", error);
    throw error;
  }
}

/**
 * Delete a batch
 */
export async function deleteBatch(
  userId: string,
  recipeId: string,
  batchId: string
) {
  try {
    const batchRef = doc(db, "users", userId, "recipes", recipeId, "batches", batchId);
    await deleteDoc(batchRef);
  } catch (error) {
    console.error("Error deleting batch:", error);
    throw error;
  }
}

