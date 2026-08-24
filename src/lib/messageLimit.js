import { supabaseApi } from '@/lib/supabaseApi';

const PLAN_LIMITS = {
  free: 100,
  progress: 300,
  performance: 800,
  elite: 2000,
};

export function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getPlanLimit(plan = 'free') {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

export function computeStats(user, plan = 'free') {
  const limit = getPlanLimit(plan);
  const monthKey = getCurrentMonthKey();
  const count = user?.kael_msg_month === monthKey
    ? Number(user?.kael_msg_count || 0)
    : 0;

  return {
    used: count,
    limit,
    remaining: Math.max(0, limit - count),
    monthKey,
  };
}

export async function incrementMessageCount(plan = 'free') {
  const monthKey = getCurrentMonthKey();
  const user = await supabaseApi.auth.me();
  const count = user?.kael_msg_month === monthKey
    ? Number(user?.kael_msg_count || 0) + 1
    : 1;

  const updated = await supabaseApi.auth.updateMe({
    kael_msg_count: count,
    kael_msg_month: monthKey,
  });

  const limit = getPlanLimit(plan);

  return {
    used: count,
    limit,
    remaining: Math.max(0, limit - count),
    monthKey,
    user: updated,
  };
}

export function canSendMessage(stats) {
  return !!stats && stats.remaining > 0;
}
