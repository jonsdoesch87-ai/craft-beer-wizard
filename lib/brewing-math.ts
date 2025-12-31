import { Measurement } from "./db";

/**
 * Predict bottling date based on gravity measurements
 * Uses linear extrapolation from the last 2 measurement points
 * 
 * @param measurements Array of gravity measurements (sorted by date, oldest first)
 * @param targetGravity Target final gravity (e.g., predictedFG from recipe)
 * @returns Estimated days until bottling, or null if prediction not possible
 */
export function predictBottlingDate(
  measurements: Measurement[],
  targetGravity: number
): number | null {
  // Need at least 2 measurements for prediction
  if (!measurements || measurements.length < 2) {
    return null;
  }

  // Sort by date (oldest first) if not already sorted
  const sorted = [...measurements].sort((a, b) => {
    const dateA = a.date?.toDate ? a.date.toDate().getTime() : (a.date as any)?.seconds * 1000 || 0;
    const dateB = b.date?.toDate ? b.date.toDate().getTime() : (b.date as any)?.seconds * 1000 || 0;
    return dateA - dateB;
  });

  // Get last 2 measurements
  const last = sorted[sorted.length - 1];
  const secondLast = sorted[sorted.length - 2];

  const lastDate = last.date?.toDate ? last.date.toDate() : new Date((last.date as any)?.seconds * 1000);
  const secondLastDate = secondLast.date?.toDate ? secondLast.date.toDate() : new Date((secondLast.date as any)?.seconds * 1000);

  // Calculate time difference in days
  const timeDiffMs = lastDate.getTime() - secondLastDate.getTime();
  const timeDiffDays = timeDiffMs / (1000 * 60 * 60 * 24);

  // Calculate gravity drop per day
  const gravityDrop = secondLast.gravity - last.gravity;
  const dailyDrop = gravityDrop / timeDiffDays;

  // Safety check: if gravity is not dropping or dropping too slowly, return null
  if (dailyDrop <= 0 || dailyDrop < 0.001) {
    return null; // Fermentation might be stuck or complete
  }

  // Calculate remaining gravity to drop
  const remainingGravity = last.gravity - targetGravity;

  // If already at or below target, return 0
  if (remainingGravity <= 0) {
    return 0;
  }

  // Extrapolate: days needed = remaining gravity / daily drop
  const daysLeft = remainingGravity / dailyDrop;

  return Math.ceil(daysLeft);
}

/**
 * Calculate estimated bottling date (as Date object)
 */
export function getEstimatedBottlingDate(
  measurements: Measurement[],
  targetGravity: number
): Date | null {
  const daysLeft = predictBottlingDate(measurements, targetGravity);
  if (daysLeft === null) {
    return null;
  }

  // Get the most recent measurement date
  const sorted = [...measurements].sort((a, b) => {
    const dateA = a.date?.toDate ? a.date.toDate().getTime() : (a.date as any)?.seconds * 1000 || 0;
    const dateB = b.date?.toDate ? b.date.toDate().getTime() : (b.date as any)?.seconds * 1000 || 0;
    return dateB - dateA; // Newest first
  });

  const lastDate = (sorted[0].date as any)?.toDate ? (sorted[0].date as any).toDate() : new Date((sorted[0].date as any)?.seconds * 1000);
  const estimatedDate = new Date(lastDate);
  estimatedDate.setDate(estimatedDate.getDate() + daysLeft);

  return estimatedDate;
}

