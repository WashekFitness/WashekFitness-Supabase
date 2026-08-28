/**
 * Washek Fitness subscription feature gates.
 *
 * Plans:
 * free
 * progress
 * performance
 * elite
 *
 * IMPORTANT:
 * Basic Live Workout tracking is FREE.
 *
 * Elite unlocks the AI-powered real-time
 * workout adjustment/coaching functionality,
 * not the tracker itself.
 */

export const PLAN_HIERARCHY = [
  'free',
  'progress',
  'performance',
  'elite',
];

export function hasPlan(
  userPlan,
  requiredPlan
) {
  const userIdx =
    PLAN_HIERARCHY.indexOf(
      userPlan || 'free'
    );

  const reqIdx =
    PLAN_HIERARCHY.indexOf(
      requiredPlan
    );

  /*
   * Unknown plans must never accidentally
   * receive paid access.
   */
  if (reqIdx === -1) {
    return false;
  }

  /*
   * A known user plan is allowed to satisfy
   * the requested tier.
   */
  if (userIdx === -1) {
    return false;
  }

  return userIdx >= reqIdx;
}

/**
 * Feature → minimum subscription tier.
 *
 * Anything not listed here should not be
 * assumed to be a paid feature.
 */
export const FEATURE_PLANS = {
  /*
   * ---------------------------------------------------------
   * FREE
   * ---------------------------------------------------------
   */

  /*
   * Basic food/nutrition features remain gated
   * according to the paid plan definitions.
   */

  /*
   * LIVE WORKOUT TRACKING IS FREE.
   *
   * This covers:
   * - opening the live workout
   * - viewing the workout
   * - starting the workout
   * - recording sets
   * - recording reps
   * - recording holds
   * - rest timer
   * - skipping exercises
   * - completing the workout
   * - post-workout check-ins
   */
  live_workout: 'free',

  /*
   * ---------------------------------------------------------
   * PROGRESS
   * ---------------------------------------------------------
   */

  snap_food: 'progress',

  scan_barcode: 'progress',

  progress_photos: 'progress',

  /*
   * ---------------------------------------------------------
   * PERFORMANCE
   * ---------------------------------------------------------
   */

  ai_body_analysis: 'performance',

  /*
   * ---------------------------------------------------------
   * ELITE
   * ---------------------------------------------------------
   */

  /*
   * Real-time AI coaching/adjustment during
   * a live workout.
   */
  live_workout_adjustments: 'elite',

  /*
   * AI-driven changes to upcoming workouts.
   */
  dynamic_program_adjustments: 'elite',

  /*
   * Advanced progress analytics.
   */
  progress_graph: 'elite',

  /*
   * Elite-specific Kael coaching/tips.
   */
  kael_elite_tips: 'elite',
};

export function canAccess(
  userPlan,
  feature
) {
  const requiredPlan =
    FEATURE_PLANS[feature];

  /*
   * Unknown features are denied rather than
   * accidentally being treated as free.
   */
  if (!requiredPlan) {
    return false;
  }

  return hasPlan(
    userPlan,
    requiredPlan
  );
}
