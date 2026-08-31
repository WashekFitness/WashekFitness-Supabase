/**
 * Washek Fitness subscription feature gates.
 *
 * Plans:
 * free < progress < performance < elite
 */

export const PLAN_HIERARCHY = [
  'free',
  'progress',
  'performance',
  'elite'
];


export const AI_MESSAGE_LIMITS = {
  free:
    25,

  progress:
    300,

  performance:
    800,

  elite:
    2000
};


export function hasPlan(
  userPlan,
  requiredPlan
) {
  const userIndex =
    PLAN_HIERARCHY.indexOf(
      userPlan ||
      'free'
    );

  const requiredIndex =
    PLAN_HIERARCHY.indexOf(
      requiredPlan
    );

  return (
    userIndex >=
      0 &&

    requiredIndex >=
      0 &&

    userIndex >=
      requiredIndex
  );
}


export const FEATURE_PLANS = {

  /*
   * Progress+
   */
  snap_food:
    'progress',

  scan_barcode:
    'progress',

  progress_photos:
    'progress',

  live_workout_adjustments:
    'progress',

  advanced_macro_tracking:
    'progress',


  /*
   * Performance+
   */
  ai_body_analysis:
    'performance',

  workout_analytics:
    'performance',

  nutrition_insights:
    'performance',


  /*
   * Elite
   */
  progress_graph:
    'elite',

  elite_realtime_adjustments:
    'elite',

  kael_elite_tips:
    'elite',

  deep_recovery_insights:
    'elite',


  /*
   * Free
   */
  live_workout:
    'free'
};


export function canAccess(
  userPlan,
  feature
) {
  const requiredPlan =
    FEATURE_PLANS[
      feature
    ];

  if (!requiredPlan) {
    return false;
  }

  return hasPlan(
    userPlan,
    requiredPlan
  );
}


export function getPlanAiLimit(
  plan
) {
  return (
    AI_MESSAGE_LIMITS[
      plan ||
      'free'
    ] ??
    AI_MESSAGE_LIMITS.free
  );
}
