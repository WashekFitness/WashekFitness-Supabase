/**
 * Washek Fitness subscription entitlements.
 *
 * free < progress < performance < elite
 */

export const PLAN_HIERARCHY = [
  'free',
  'progress',
  'performance',
  'elite',
];

export const AI_MESSAGE_LIMITS = {
  free: 25,
  progress: 300,
  performance: 800,
  elite: 2000,
};

export function hasPlan(userPlan, requiredPlan) {
  const userIdx = PLAN_HIERARCHY.indexOf(userPlan || 'free');
  const reqIdx = PLAN_HIERARCHY.indexOf(requiredPlan);

  if (userIdx < 0 || reqIdx < 0) return false;

  return userIdx >= reqIdx;
}

export const FEATURE_PLANS = {
  snap_food: 'progress',
  scan_barcode: 'progress',
  progress_photos: 'progress',

  ai_body_analysis: 'performance',

  // Progress promise:
  // "Full custom workout adjustments"
  live_workout_adjustments: 'progress',

  // Elite-only enhanced path:
  elite_realtime_adjustments: 'elite',

  // Free for everybody.
  live_workout: 'free',

  kael_elite_tips: 'elite',

  workout_analytics: 'performance',
  nutrition_insights: 'performance',

  deep_recovery_insights: 'elite',
};

export function canAccess(userPlan, feature) {
  const requiredPlan = FEATURE_PLANS[feature];

  if (!requiredPlan) return false;

  return hasPlan(userPlan, requiredPlan);
}

export function getPlanAiLimit(plan) {
  return (
    AI_MESSAGE_LIMITS[plan || 'free'] ??
    AI_MESSAGE_LIMITS.free
  );
}
