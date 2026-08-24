/**
 * Subscription plan feature gates.
 * Source of truth for what each plan unlocks.
 * Plans: 'free' | 'progress' | 'performance' | 'elite'
 */

export const PLAN_HIERARCHY = ['free', 'progress', 'performance', 'elite'];

/** Returns true if the user's plan is >= the required plan */
export function hasPlan(userPlan, requiredPlan) {
  const userIdx = PLAN_HIERARCHY.indexOf(userPlan || 'free');
  const reqIdx = PLAN_HIERARCHY.indexOf(requiredPlan);
  return userIdx >= reqIdx;
}

/**
 * Feature gates — what plan is required to access each feature:
 *   snap_food:        progress+
 *   scan_barcode:     progress+
 *   progress_photos:  progress+   (save & compare)
 *   ai_body_analysis: performance+
 *   progress_graph:   elite
 *   live_workout:     elite
 */
export const FEATURE_PLANS = {
  snap_food: 'progress',
  scan_barcode: 'progress',
  progress_photos: 'progress',
  ai_body_analysis: 'performance',
  progress_graph: 'elite',
  live_workout: 'elite',
  kael_elite_tips: 'elite',
};

export function canAccess(userPlan, feature) {
  return hasPlan(userPlan, FEATURE_PLANS[feature]);
}