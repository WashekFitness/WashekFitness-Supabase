import { supabaseApi } from '@/lib/supabaseApi';

const PLAN_LIMITS = {
  free: 100,
  progress: 300,
  performance: 800,
  elite: 2000,
};


/*
 * Returns a YYYY-MM-DD date using the user's LOCAL timezone.
 *
 * Do NOT use toISOString() here.
 *
 * Example:
 *   11:30 PM in California = that California date
 *   1:30 AM in India       = that India date
 *
 * The browser's local timezone is used automatically.
 */
export function getLocalDateKey(
  date = new Date()
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    );

  return `${year}-${month}-${day}`;
}


/*
 * Returns the previous LOCAL calendar date.
 *
 * This avoids subtracting 24 hours from a timestamp, which can
 * be wrong around daylight-saving transitions.
 */
export function getPreviousLocalDateKey(
  date = new Date()
) {
  const previous =
    new Date(date);

  previous.setDate(
    previous.getDate() - 1
  );

  return getLocalDateKey(
    previous
  );
}


/*
 * Returns the current LOCAL calendar month.
 *
 * This was already local in the previous implementation,
 * but keeping it centralized makes the behavior explicit.
 */
export function getCurrentMonthKey(
  date = new Date()
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    );

  return `${year}-${month}`;
}


export function getPlanLimit(
  plan = 'free'
) {
  return (
    PLAN_LIMITS[plan] ??
    PLAN_LIMITS.free
  );
}


/*
 * Monthly Kael usage is tied to the user's LOCAL calendar month.
 *
 * When the local month changes, usage automatically starts at 0.
 */
export function computeStats(
  user,
  plan = 'free'
) {
  const limit =
    getPlanLimit(
      plan
    );

  const monthKey =
    getCurrentMonthKey();

  const count =
    user?.kael_msg_month ===
    monthKey
      ? Number(
          user?.kael_msg_count ||
            0
        )
      : 0;

  return {
    used:
      count,

    limit,

    remaining:
      Math.max(
        0,
        limit - count
      ),

    monthKey,
  };
}


/*
 * Increment Kael usage using the LOCAL calendar month.
 *
 * A new local month starts the count back at 1.
 */
export async function incrementMessageCount(
  plan = 'free'
) {
  const monthKey =
    getCurrentMonthKey();

  const user =
    await supabaseApi.auth.me();

  const count =
    user?.kael_msg_month ===
    monthKey
      ? Number(
          user?.kael_msg_count ||
            0
        ) + 1
      : 1;

  const updated =
    await supabaseApi.auth.updateMe(
      {
        kael_msg_count:
          count,

        kael_msg_month:
          monthKey,
      }
    );

  const limit =
    getPlanLimit(
      plan
    );

  return {
    used:
      count,

    limit,

    remaining:
      Math.max(
        0,
        limit - count
      ),

    monthKey,

    user:
      updated,
  };
}


export function canSendMessage(
  stats
) {
  return (
    !!stats &&
    stats.remaining > 0
  );
}
