/**
 * Washek Fitness subscription feature gates.
 *
 * Plans:
 * free
 * progress
 * performance
 * elite
 */

export const PLAN_HIERARCHY = [
  'free',
  'progress',
  'performance',
  'elite',
];

export function hasPlan(userPlan, requiredPlan) {
  const userIdx = PLAN_HIERARCHY.indexOf(
    userPlan || 'free'
  );

  const reqIdx = PLAN_HIERARCHY.indexOf(
    requiredPlan
  );

  return userIdx >= reqIdx;
}

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
  const requiredPlan = FEATURE_PLANS[feature];

  if (!requiredPlan) {
    return false;
  }

  return hasPlan(userPlan, requiredPlan);
}
