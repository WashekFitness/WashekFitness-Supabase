import { supabaseApi } from '@/lib/supabaseApi';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Trophy, Flame, Clock, TrendingUp, Lock } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { canAccess } from '@/lib/subscription';

export default function Progress() {
  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => supabaseApi.auth.me(),
  });
  const plan = user?.subscription_plan || 'free';
  const hasWorkoutAnalytics = canAccess(plan, 'workout_analytics');

  const { data: logs = [] } = useQuery({
    queryKey: ['logs'],
    queryFn: () => supabaseApi.entities.WorkoutLog.list('-date', 60),
  });

  const { data: nutrition = [] } = useQuery({
    queryKey: ['nutrition-all'],
    queryFn: () => supabaseApi.entities.NutritionEntry.list('-date', 200),
  });

  const weeklyData = (() => {
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - (i * 7 + start.getDay()));
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
      const count = logs.filter(l => l.date >= startStr && l.date < endStr).length;
      weeks.push({ week: `W${8 - i}`, workouts: count });
    }
    return weeks;
  })();

  const calorieData = (() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayEntries = nutrition.filter(n => n.date === dateStr);
      const cals = dayEntries.reduce((sum, e) => sum + (e.calories || 0), 0);
      days.push({ day: d.toLocaleDateString('en', { weekday: 'short' }), calories: cals });
    }
    return days;
  })();

  const totalWorkouts = logs.length;
  const totalMinutes = logs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0);
  const streak = (() => {
    let count = 0;
    const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
    const today = new Date().toISOString().split('T')[0];
    let checkDate = today;
    for (const log of sorted) {
      if (log.date === checkDate || log.date === getPrevDate(checkDate)) {
        count++;
        checkDate = log.date;
      } else break;
    }
    return count;
  })();

  function getPrevDate(dateStr) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }

  const stats = [
    { label: 'Total Workouts', value: totalWorkouts, icon: Trophy, color: 'text-primary' },
    { label: 'Current Streak', value: `${streak} days`, icon: Flame, color: 'text-accent' },
    { label: 'Total Time', value: `${totalMinutes} min`, icon: Clock, color: 'text-chart-4' },
  ];

  return (
    <div className="px-5 pb-4">
      <PageHeader title="Progress" subtitle="Your journey at a glance" />
      <div className="mb-5" />

      <div className="grid grid-cols-3 gap-3 mb-6">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="p-3 text-center">
            <Icon className={`w-5 h-5 ${color} mx-auto mb-1`} />
            <p className="font-heading font-bold text-lg">{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <p className="font-heading font-bold text-sm">Weekly Workouts</p>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={weeklyData}>
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
            <Bar dataKey="workouts" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-4 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-4 h-4 text-accent" />
          <p className="font-heading font-bold text-sm">Daily Calories (7 days)</p>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={calorieData}>
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
            <Bar dataKey="calories" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <p className="font-heading font-bold text-sm">Workout Analytics</p>
        </div>
        {hasWorkoutAnalytics ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3"><p className="text-[10px] text-muted-foreground">Avg. workouts / week</p><p className="font-heading font-bold text-xl">{(totalWorkouts / 8).toFixed(1)}</p></div>
            <div className="rounded-lg border p-3"><p className="text-[10px] text-muted-foreground">Avg. session time</p><p className="font-heading font-bold text-xl">{totalWorkouts ? Math.round(totalMinutes / totalWorkouts) : 0} min</p></div>
            <div className="rounded-lg border p-3"><p className="text-[10px] text-muted-foreground">8-week total</p><p className="font-heading font-bold text-xl">{totalWorkouts}</p></div>
            <div className="rounded-lg border p-3"><p className="text-[10px] text-muted-foreground">Best week</p><p className="font-heading font-bold text-xl">{Math.max(...weeklyData.map(w => w.workouts), 0)} workouts</p></div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-center">
            <Lock className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
            <p className="font-heading font-bold text-sm">Performance Analytics</p>
            <p className="text-xs text-muted-foreground mt-1">Upgrade to Performance to unlock deeper workout analytics.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
