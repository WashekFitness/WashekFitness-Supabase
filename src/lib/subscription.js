```javascript
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
 * The Live Workout Tracker is FREE.
 * Elite only unlocks real-time AI workout adjustments
 * and other explicitly Elite features.
 */

export const PLAN_HIERARCHY = [
  'free',
  'progress',
  'performance',
  'elite',
];

/**
 * Returns true if the user's plan is >= the required plan.
 */
export function hasPlan(userPlan, requiredPlan) {
  const userIdx = PLAN_HIERARCHY.indexOf(userPlan || 'free');
  const reqIdx = PLAN_HIERARCHY.indexOf(requiredPlan);

  return userIdx >= reqIdx;
}

/**
 * Feature gates.
 *
 * The Live Workout Tracker itself is intentionally NOT here
 * because it is available to every user, including Free.
 *
 * Elite-only functionality should have its own gate.
 */
export const FEATURE_PLANS = {
  snap_food: 'progress',
  scan_barcode: 'progress',
  progress_photos: 'progress',
  ai_body_analysis: 'performance',
  progress_graph: 'elite',

  // Elite-only AI functionality:
  live_workout_adjustments: 'elite',

  kael_elite_tips: 'elite',
};

/**
 * Returns true if the user's plan can access a feature.
 *
 * Unknown features default to false so a new feature cannot
 * accidentally become available without an explicit entitlement.
 */
export function canAccess(userPlan, feature) {
  const requiredPlan = FEATURE_PLANS[feature];

  if (!requiredPlan) {
    return false;
  }

  return hasPlan(userPlan, requiredPlan);
}
```
