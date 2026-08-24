import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabaseApi } from '@/lib/supabaseApi';
import { Sparkles, ChevronDown, ChevronUp, Lock, CheckCircle2 } from 'lucide-react';
import { useAppSettings } from '@/lib/AppSettingsContext';

// Monday of the current week as YYYY-MM-DD
function getWeekStart() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

export default function WeeklyUpdate({ logs, nutrition, photos, user, program }) {
  const { settings } = useAppSettings();
  const [open, setOpen] = useState(false);
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alreadyGenerated, setAlreadyGenerated] = useState(false);

  const weekStartStr = getWeekStart();
  const weekLogs = logs.filter(l => l.date >= weekStartStr);
  const weekNutrition = nutrition.filter(n => n.date >= weekStartStr);
  const recentPhotos = photos.slice(0, 3);

  const totalCalories = weekNutrition.reduce((s, e) => s + (e.calories || 0), 0);
  const daysWithNutrition = [...new Set(weekNutrition.map(n => n.date))].length;

  // Cache key is per-week — once generated it's locked for the week
  const cacheKey = `weekly_insight_${weekStartStr}_${user?.id || 'u'}`;

  useEffect(() => {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setInsight(parsed);
        setAlreadyGenerated(true);
      } catch {}
    }
  }, [cacheKey]);

  const hasEnoughData = weekLogs.length >= 1;

  const generate = async () => {
    if (alreadyGenerated) return; // locked — once per week
    setLoading(true);

    const lang = settings.language || 'English';
    const unit = settings.unit || 'imperial';

    // Collect all post-workout checkins from this week
    const checkins = weekLogs
      .map(l => l.post_workout_checkin)
      .filter(Boolean)
      .join('\n---\n') || 'No check-ins logged this week.';

    const exerciseSummary = weekLogs
      .flatMap(l => (l.exercises_completed || []).map(e =>
        `${e.name}: ${e.sets_completed}×${e.reps_achieved}`
      ))
      .join(', ') || 'No exercises logged';

    const painMentions = weekLogs
      .map(l => l.post_workout_checkin)
      .filter(Boolean)
      .filter(c => /pain|hurt|sore|tight|ache|injury|strain/i.test(c))
      .join(' | ');

    const photoBf = recentPhotos.filter(p => p.body_fat_estimate).map(p => p.body_fat_estimate).join(', ');

    // Next week's microcycle for adjustment
    const currentWeek = program?.current_week || 1;
    const nextMicro = program?.microcycles?.find(m => m.week_number === currentWeek + 1);

    const trainingType = user?.training_type || 'calisthenics';
    const typeLabel = {
      calisthenics: 'calisthenics',
      weighted_calisthenics: 'weighted calisthenics',
      weights: 'weight training',
      hybrid: 'hybrid training (calisthenics + weights)',
    }[trainingType];

    const prompt = `You are Kael, a straight-talking, knowledgeable ${typeLabel} coach. Give a weekly check-in summary for this athlete. Respond ENTIRELY in ${lang}.

ATHLETE: ${user?.full_name?.split(' ')[0] || 'Athlete'}, ${user?.fitness_level || 'intermediate'} level.
TRAINING TYPE: ${typeLabel}
GOALS: ${user?.fitness_goals?.join(', ') || user?.weight_goals?.join(', ') || user?.primary_goal || 'general fitness'}
WEEK: ${weekStartStr} | ${weekLogs.length} workouts completed
EXERCISES THIS WEEK: ${exerciseSummary}
POST-WORKOUT CHECK-INS (athlete's own words):
${checkins}
PAIN/DISCOMFORT MENTIONED: ${painMentions || 'none'}
NUTRITION: ${daysWithNutrition} days tracked, ~${Math.round(totalCalories / Math.max(daysWithNutrition, 1))} cal/day avg
BODY COMPOSITION: ${photoBf || 'no data'}
PROGRAM: ${program?.program_name || 'custom'}, Week ${currentWeek}
MEASUREMENT SYSTEM: ${unit === 'metric' ? 'metric (kg, cm)' : 'imperial (lbs, ft)'}

Provide a concise, human weekly check-in. Cover:
1. What they did well (specific, reference their actual exercises or check-ins)
2. What to watch out for or improve (be honest, reference pain/struggles they mentioned)
3. A concrete recommendation for next week
4. One short genuine motivational line

Then, if there is a NEXT WEEK PROGRAM below, return an adjusted version of it:
- If they struggled with something: reduce volume/reps by 10-20% on those movements
- If they mentioned pain in a movement: REMOVE that movement or replace with a safer variation
- If they performed well: increase reps/sets slightly or use a harder progression
- Keep the structure the same (same day names), only modify exercises where needed

NEXT WEEK PROGRAM TO ADJUST: ${nextMicro ? JSON.stringify(nextMicro) : 'none'}`;

    const result = await supabaseApi.ai.invoke({
      type: 'weekly_update',
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          win: { type: 'string' },
          improve: { type: 'string' },
          next_recommendation: { type: 'string' },
          motivation: { type: 'string' },
          adjusted_microcycle: { type: 'object' }
        }
      }
    });

    // Update next week's program if we got adjustments
    if (result.adjusted_microcycle && nextMicro && program) {
      const updatedMicrocycles = program.microcycles.map(mc =>
        mc.week_number === currentWeek + 1 ? result.adjusted_microcycle : mc
      );
      await supabaseApi.entities.WorkoutProgram.update(program.id, { microcycles: updatedMicrocycles });
    }

    // Strip adjusted_microcycle from what we cache/show
    const { adjusted_microcycle, ...displayResult } = result;
    localStorage.setItem(cacheKey, JSON.stringify(displayResult));
    setInsight(displayResult);
    setAlreadyGenerated(true);
    setLoading(false);
  };

  return (
    <Card className="p-4 border-primary/20 bg-primary/5">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-heading font-bold text-sm">Weekly Check-in from Kael</p>
            <p className="text-xs text-muted-foreground">
              {alreadyGenerated ? 'This week\'s update is ready' : `${weekLogs.length} workout${weekLogs.length !== 1 ? 's' : ''} logged · tap to view`}
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          {!insight && !loading && (
            <>
              {!hasEnoughData ? (
                <p className="text-xs text-muted-foreground text-center py-3">
                  Complete at least 1 workout this week to unlock your check-in.
                </p>
              ) : (
                <Button size="sm" className="w-full" onClick={generate}>
                  <Sparkles className="w-4 h-4 mr-2" /> Get This Week's Check-in
                </Button>
              )}
            </>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Kael is reviewing your week...
            </div>
          )}

          {insight && (
            <div className="space-y-3">
              {/* Lock indicator */}
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/50 rounded-lg px-2 py-1.5 w-fit">
                <CheckCircle2 className="w-3 h-3 text-accent" />
                Generated for this week · resets Monday
              </div>

              <div className="p-3 rounded-xl bg-accent/10 border border-accent/20">
                <p className="text-xs font-bold text-accent uppercase tracking-wider mb-1">What you crushed 🔥</p>
                <p className="text-sm">{insight.win}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 border border-border">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Keep an eye on</p>
                <p className="text-sm">{insight.improve}</p>
              </div>
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Next week</p>
                <p className="text-sm">{insight.next_recommendation}</p>
              </div>
              <p className="text-sm italic text-muted-foreground border-l-2 border-primary/40 pl-3">{insight.motivation}</p>

              {/* Next week program updated notice */}
              {program?.microcycles?.find(m => m.week_number === (program?.current_week || 1) + 1) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                  <Sparkles className="w-3 h-3 text-primary flex-shrink-0" />
                  Next week's workout has been adjusted based on your feedback.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}