/**
 * Subscription plan feature gates.
 *
 * Plans:
 *   free
 *   progress
 *   performance
 *   elite
 *
 * IMPORTANT:
 * Live Workout is FREE for everyone.
 * Only real-time/dynamic workout-program adjustments are Elite.
 */

export const PLAN_HIERARCHY = [
  'free',
  'progress',
  'performance',
  'elite',
];

/**
 * Returns true if the user's plan is at or above the required plan.
 */
export function hasPlan(userPlan, requiredPlan) {
  const userIdx = PLAN_HIERARCHY.indexOf(userPlan || 'free');
  const reqIdx = PLAN_HIERARCHY.indexOf(requiredPlan);

  // Unknown required features fail closed.
  if (reqIdx === -1) return false;

  return userIdx >= reqIdx;
}

/**
 * Feature gates.
 *
 * live_workout:
 *   FREE — the complete live workout tracker.
 *
 * live_workout_adjustments:
 *   ELITE — real-time/dynamic program changes based on performance.
 */
export const FEATURE_PLANS = {
  snap_food: 'progress',
  scan_barcode: 'progress',
  progress_photos: 'progress',

  ai_body_analysis: 'performance',

  progress_graph: 'elite',

  // FREE FOR EVERYONE
  live_workout: 'free',

  // ELITE ONLY
  live_workout_adjustments: 'elite',

  kael_elite_tips: 'elite',
};

/**
 * Check whether a user can access a feature.
 */
export function canAccess(userPlan, feature) {
  if (!feature || !Object.prototype.hasOwnProperty.call(FEATURE_PLANS, feature)) {
    return false;
  }

  return hasPlan(userPlan || 'free', FEATURE_PLANS[feature]);
}
