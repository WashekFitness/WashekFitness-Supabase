/**
 * Washek Fitness subscription / feature access.
 *
 * Plan hierarchy:
 *
 * free
 *   ↓
 * progress
 *   ↓
 * performance
 *   ↓
 * elite
 *
 * Keep feature gating centralized here.
 * Components should use canAccess() or hasPlan()
 * rather than creating their own plan rules.
 */

export const PLAN_HIERARCHY = [
  'free',
  'progress',
  'performance',
  'elite',
];


/* ============================================================
   PLAN HELPERS
   ============================================================ */

export function normalizePlan(
  plan
) {
  const normalized =
    String(
      plan || 'free'
    )
      .toLowerCase()
      .trim();

  return PLAN_HIERARCHY.includes(
    normalized
  )
    ? normalized
    : 'free';
}


export function getPlanLabel(
  plan
) {
  const normalized =
    normalizePlan(
      plan
    );

  const labels = {
    free: 'Free',
    progress: 'Progress',
    performance: 'Performance',
    elite: 'Elite',
  };

  return (
    labels[
      normalized
    ] ||
    'Free'
  );
}


/**
 * Returns true when the user's plan is equal to or above
 * the required plan.
 */
export function hasPlan(
  userPlan,
  requiredPlan
) {
  const user =
    normalizePlan(
      userPlan
    );

  const required =
    normalizePlan(
      requiredPlan
    );

  const userIndex =
    PLAN_HIERARCHY.indexOf(
      user
    );

  const requiredIndex =
    PLAN_HIERARCHY.indexOf(
      required
    );

  return (
    userIndex >=
    requiredIndex
  );
}


/* ============================================================
   FEATURE GATES
   ============================================================ */

/**
 * Every paid promise in the application should have a
 * corresponding feature key here.
 *
 * IMPORTANT:
 *
 * Do not rename an existing feature key casually.
 * Several existing components already use these names.
 */
export const FEATURE_PLANS = {

  /* ----------------------------------------------------------
     FREE
     ---------------------------------------------------------- */

  /**
   * Basic workout tracking.
   *
   * The Live Workout Tracker itself is free.
   */
  live_workout:
    'free',


  /**
   * Existing LiveWorkout.jsx feature key.
   *
   * Elite-only.
   *
   * This alias is intentionally preserved because the current
   * LiveWorkout page asks for this exact feature name.
   */
  live_workout_adjustments:
    'elite',


  /* ----------------------------------------------------------
     PROGRESS
     ---------------------------------------------------------- */

  /**
   * Food photograph scanning.
   */
  snap_food:
    'progress',


  /**
   * Package / nutrition-label scanning.
   */
  scan_barcode:
    'progress',


  /**
   * Save and compare progress photos.
   */
  progress_photos:
    'progress',


  /**
   * Manual workout customization.
   */
  custom_workout_adjustments:
    'progress',


  /**
   * Macro tracking and target comparison.
   */
  advanced_macro_tracking:
    'progress',


  /* ----------------------------------------------------------
     PERFORMANCE
     ---------------------------------------------------------- */

  /**
   * AI body-fat estimate from progress photos.
   */
  ai_body_analysis:
    'performance',


  /**
   * Detailed workout analytics.
   */
  workout_analytics:
    'performance',


  /**
   * AI nutrition insights and suggestions.
   */
  nutrition_insights:
    'performance',


  /* ----------------------------------------------------------
     ELITE
     ---------------------------------------------------------- */

  /**
   * Adaptive workout adjustment based on workout performance
   * and post-workout feedback.
   *
   * This is also exposed under the older
   * live_workout_adjustments key above for compatibility.
   */
  elite_realtime_adjustments:
    'elite',


  /**
   * Video-based calisthenics movement analysis.
   */
  form_analysis:
    'elite',


  /**
   * Advanced personalized Kael coaching tips.
   */
  kael_elite_tips:
    'elite',


  /**
   * Deep recovery, fatigue and deload guidance.
   */
  deep_recovery_insights:
    'elite',


  /**
   * Advanced progress graphing / comparison.
   */
  progress_graph:
    'elite',
};


/* ============================================================
   FEATURE ACCESS
   ============================================================ */

export function canAccess(
  userPlan,
  feature
) {
  const requiredPlan =
    FEATURE_PLANS[
      feature
    ];

  /*
   * Unknown feature keys should fail closed.
   *
   * This is safer than accidentally exposing a premium
   * feature because of a typo.
   */
  if (
    !requiredPlan
  ) {
    return false;
  }

  return hasPlan(
    userPlan,
    requiredPlan
  );
}


/* ============================================================
   AI LIMITS
   ============================================================ */

/**
 * Monthly Kael message allowances.
 *
 * These match the promises shown in PricingSection.jsx.
 */
export const AI_MESSAGE_LIMITS = {
  free: 100,
  progress: 300,
  performance: 800,
  elite: 2000,
};


/**
 * Return the monthly Kael message allowance.
 */
export function getPlanAiLimit(
  plan
) {
  const normalized =
    normalizePlan(
      plan
    );

  return (
    AI_MESSAGE_LIMITS[
      normalized
    ] ??
    AI_MESSAGE_LIMITS.free
  );
}


/* ============================================================
   PLAN CAPABILITY HELPERS
   ============================================================ */

/**
 * Convenience helper for components that need to know
 * whether the user has any paid plan.
 */
export function isPaidPlan(
  plan
) {
  return hasPlan(
    plan,
    'progress'
  );
}


/**
 * Convenience helper for Performance+.
 */
export function isPerformancePlan(
  plan
) {
  return hasPlan(
    plan,
    'performance'
  );
}


/**
 * Convenience helper for Elite.
 */
export function isElitePlan(
  plan
) {
  return hasPlan(
    plan,
    'elite'
  );
}
