import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseApi } from '@/lib/supabaseApi';
import { buildWeekPrompt } from '@/lib/trainingTypes';
import { canAccess } from '@/lib/subscription';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ChevronLeft, CheckCircle2, Circle, Timer, Dumbbell, SkipForward, Plus, Minus, Sparkles, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppSettings } from '@/lib/AppSettingsContext';
import { toast } from 'sonner';

const WEEK_GENERATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    microcycle: {
      type: 'object',
      additionalProperties: false,
      properties: {
        week_number: { type: 'number' },
        mesocycle_index: { type: 'number' },
        week_type: { type: 'string' },
        days: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              day_name: { type: 'string' },
              workout_type: { type: 'string' },
              exercises: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    name: { type: 'string' },
                    sets: { type: 'number' },
                    reps: { type: 'string' },
                    rest_seconds: { type: 'number' },
                    notes: { type: 'string' },
                    activation_cue: { type: 'string' },
                  },
                  required: ['name', 'sets', 'reps', 'rest_seconds', 'notes', 'activation_cue'],
                },
              },
            },
            required: ['day_name', 'workout_type', 'exercises'],
          },
        },
      },
      required: ['week_number', 'mesocycle_index', 'week_type', 'days'],
    },
  },
  required: ['microcycle'],
};

function profileToPromptData(profile) {
  const metric = profile?.unit === 'metric';
  return {
    gender: profile?.gender || '',
    level: profile?.fitness_level || 'intermediate',
    age: profile?.age || '',
    weightLbs: metric && profile?.weight_lbs != null
      ? Number(profile.weight_lbs) * 0.453592
      : profile?.weight_lbs || '',
    heightFt: metric ? profile?.height_cm || '' : profile?.height_inches ? Math.floor(Number(profile.height_inches) / 12) : '',
    heightIn: metric ? '' : profile?.height_inches ? Number(profile.height_inches) % 12 : '',
    unit: profile?.unit || 'imperial',
    currentSkills: profile?.current_skills || '',
    goalDescription: profile?.primary_goal || '',
    timeframe: profile?.goal_timeframe || '',
    equipment: profile?.available_equipment || '',
    requirements: profile?.training_requirements || '',
    fitnessGoals: Array.isArray(profile?.fitness_goals) ? profile.fitness_goals : [],
    weightGoals: Array.isArray(profile?.weight_goals) ? profile.weight_goals : [],
  };
}

// ─── Timer ─────────────────────────────────────────────
function useTimer() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (running) ref.current = setInterval(() => setSeconds(s => s + 1), 1000);
    else clearInterval(ref.current);
    return () => clearInterval(ref.current);
  }, [running]);
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return { seconds, running, setRunning, fmt };
}

function RestTimer({ seconds: restSecs, onDone }) {
  const [left, setLeft] = useState(restSecs);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (restSecs <= 0) { onDoneRef.current(); return; }
    const start = Date.now();
    const initial = restSecs;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const remaining = initial - elapsed;
      if (remaining <= 0) {
        clearInterval(interval);
        setLeft(0);
        onDoneRef.current();
      } else {
        setLeft(remaining);
      }
    }, 250); // poll at 250ms for accuracy, display updates smoothly
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Rest</p>
      <p className="font-heading text-6xl font-bold text-primary">{left}s</p>
      <Button variant="outline" size="sm" onClick={onDoneRef.current}>Skip Rest</Button>
    </div>
  );
}

// ─── Movement Baseline ─────────────────────────────────
const CALISTHENICS_MOVEMENTS = [
  { key: 'push_ups', label: 'Push Ups', unit: 'reps' },
  { key: 'pull_ups', label: 'Pull Ups', unit: 'reps' },
  { key: 'dips', label: 'Dips', unit: 'reps' },
  { key: 'squats', label: 'Squats', unit: 'reps' },
  { key: 'pistol_squats', label: 'Pistol Squats', unit: 'reps' },
  { key: 'muscle_ups', label: 'Muscle Ups', unit: 'reps' },
  { key: 'dragon_flags', label: 'Dragon Flags', unit: 'reps' },
  { key: 'toes_to_bar', label: 'Toes to Bar', unit: 'reps' },
  { key: 'ring_dips', label: 'Ring Dips', unit: 'reps' },
  { key: 'ring_push_ups', label: 'Ring Push Ups', unit: 'reps' },
  { key: 'handstand_hold_seconds', label: 'Handstand Hold', unit: 'seconds' },
  { key: 'l_sit_hold_seconds', label: 'L-Sit Hold', unit: 'seconds' },
  { key: 'front_lever_hold_seconds', label: 'Front Lever Hold', unit: 'seconds' },
  { key: 'back_lever_hold_seconds', label: 'Back Lever Hold', unit: 'seconds' },
  { key: 'planche_hold_seconds', label: 'Planche Hold', unit: 'seconds' },
  { key: 'human_flag_hold_seconds', label: 'Human Flag Hold', unit: 'seconds' },
];

const WEIGHT_MOVEMENTS = [
  { key: 'bench_press_1rm', label: 'Bench Press' },
  { key: 'back_squat_1rm', label: 'Back Squat' },
  { key: 'deadlift_1rm', label: 'Deadlift' },
  { key: 'overhead_press_1rm', label: 'Overhead Press' },
  { key: 'barbell_row_1rm', label: 'Barbell Row' },
  { key: 'front_squat_1rm', label: 'Front Squat' },
  { key: 'romanian_deadlift_1rm', label: 'Romanian Deadlift' },
  { key: 'push_press_1rm', label: 'Push Press' },
  { key: 'power_clean_1rm', label: 'Power Clean' },
  { key: 'hip_thrust_1rm', label: 'Hip Thrust' },
];

const WEIGHTED_CALI_MOVEMENTS = [
  { key: 'weighted_pull_up_lbs', label: 'Weighted Pull-Up' },
  { key: 'weighted_dip_lbs', label: 'Weighted Dip' },
  { key: 'weighted_push_up_lbs', label: 'Weighted Push-Up' },
  { key: 'weighted_squat_lbs', label: 'Weighted Squat' },
];

const ALL_BASELINE_MOVEMENTS = [...CALISTHENICS_MOVEMENTS, ...WEIGHT_MOVEMENTS, ...WEIGHTED_CALI_MOVEMENTS];

function baselineHasCalisthenics(tt) {
  if (!tt) return true;
  return tt === 'calisthenics' || tt === 'weighted_calisthenics' || tt === 'hybrid';
}
function baselineHasWeights(tt) {
  return tt === 'weights' || tt === 'hybrid';
}
function baselineHasWeightedCali(tt) {
  return tt === 'weighted_calisthenics' || tt === 'hybrid';
}

function MovementInput({ label, unit, value, onChange }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="0"
          className="h-9 text-sm"
        />
        {unit && <span className="text-xs text-muted-foreground flex-shrink-0">{unit}</span>}
      </div>
    </div>
  );
}

function MovementBaseline({ trainingType }) {
  const queryClient = useQueryClient();
  const { settings } = useAppSettings();
  const today = new Date().toISOString().split('T')[0];
  const [values, setValues] = useState({});
  const [customEntries, setCustomEntries] = useState([]);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomVal, setNewCustomVal] = useState('');
  const [saving, setSaving] = useState(false);

  const showCalisthenics = baselineHasCalisthenics(trainingType);
  const showWeights = baselineHasWeights(trainingType);
  const showWeightedCali = baselineHasWeightedCali(trainingType);
  const weightUnit = settings?.unit === 'metric' ? 'kg' : 'lbs';

  const { data: baselines = [] } = useQuery({
    queryKey: ['baselines'],
    queryFn: () => supabaseApi.entities.MovementBaseline.list('-recorded_date', 1),
  });

  useEffect(() => {
    if (baselines[0]) {
      const b = baselines[0];
      const v = {};
      ALL_BASELINE_MOVEMENTS.forEach(m => { if (b[m.key] != null) v[m.key] = b[m.key]; });
      setValues(v);
      if (b.custom_entries) setCustomEntries(b.custom_entries);
    }
  }, [baselines]);

  const saveBaseline = async () => {
    setSaving(true);
    const data = { recorded_date: today, custom_entries: customEntries };
    ALL_BASELINE_MOVEMENTS.forEach(m => { if (values[m.key]) data[m.key] = parseFloat(values[m.key]); });
    if (baselines[0]?.recorded_date === today) {
      await supabaseApi.entities.MovementBaseline.update(baselines[0].id, data);
    } else {
      await supabaseApi.entities.MovementBaseline.create(data);
    }
    queryClient.invalidateQueries({ queryKey: ['baselines'] });
    toast.success('Baseline saved! Kael will use this to adjust your workouts.');
    setSaving(false);
  };

  const addCustom = () => {
    if (!newCustomName.trim()) return;
    setCustomEntries(prev => [...prev, { name: newCustomName.trim(), value: newCustomVal.trim() }]);
    setNewCustomName('');
    setNewCustomVal('');
  };

  return (
    <div className="space-y-4 pb-4">
      <div className="bg-muted/40 rounded-2xl p-4 border border-border">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Log your current maxes here. This <strong>doesn't affect your live workout</strong> — it's just so Kael knows where you're at and can program smarter.
        </p>
      </div>

      {showCalisthenics && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Calisthenics Maxes</h3>
          <div className="grid grid-cols-2 gap-3">
            {CALISTHENICS_MOVEMENTS.map(({ key, label, unit }) => (
              <MovementInput
                key={key}
                label={label}
                unit={unit}
                value={values[key]}
                onChange={v => setValues(prev => ({ ...prev, [key]: v }))}
              />
            ))}
          </div>
        </div>
      )}

      {showWeights && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Weight PRs (1RM)</h3>
          <div className="grid grid-cols-2 gap-3">
            {WEIGHT_MOVEMENTS.map(({ key, label }) => (
              <MovementInput
                key={key}
                label={label}
                unit={weightUnit}
                value={values[key]}
                onChange={v => setValues(prev => ({ ...prev, [key]: v }))}
              />
            ))}
          </div>
        </div>
      )}

      {showWeightedCali && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Weighted Calisthenics PRs (Max Added Weight)</h3>
          <div className="grid grid-cols-2 gap-3">
            {WEIGHTED_CALI_MOVEMENTS.map(({ key, label }) => (
              <MovementInput
                key={key}
                label={label}
                unit={weightUnit}
                value={values[key]}
                onChange={v => setValues(prev => ({ ...prev, [key]: v }))}
              />
            ))}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <p className="text-sm font-semibold">Custom Movement</p>
        <div className="flex gap-2">
          <Input placeholder="e.g. Typewriter Pull Up" value={newCustomName} onChange={e => setNewCustomName(e.target.value)} className="h-9 text-sm flex-1" />
          <Input placeholder="e.g. 3 reps" value={newCustomVal} onChange={e => setNewCustomVal(e.target.value)} className="h-9 text-sm w-28" />
          <Button size="sm" variant="outline" onClick={addCustom}><Plus className="w-4 h-4" /></Button>
        </div>
        {customEntries.map((c, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span>{c.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{c.value}</span>
              <button onClick={() => setCustomEntries(prev => prev.filter((_, j) => j !== i))} className="text-destructive hover:text-destructive/80">
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Button className="w-full h-12 font-heading font-semibold" onClick={saveBaseline} disabled={saving}>
        {saving ? 'Saving...' : 'Save My Baseline'}
      </Button>
    </div>
  );
}

// ─── Post Workout Checkin ──────────────────────────────
function PostWorkoutCheckin({ log, onSave, isElite, program, onProgramUpdated }) {
  const [checkin, setCheckin] = useState('');
  const [aiNote, setAiNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!checkin.trim()) return;
    setLoading(true);

    const exerciseSummary = (log?.exercises_completed || [])
      .map(e => `${e.name}: ${e.sets_completed} sets, ${e.reps_achieved} reps`)
      .join('\n');

    if (isElite && program) {
      // Elite: parse adjustments and apply them to the next workout in the program
      const currentWeek = program.current_week || 1;
      const nextMicrocycle = program.microcycles?.find(m => m.week_number === currentWeek + 1) || null;

      const trainingType = program?.training_type || 'calisthenics';
      const typeLabel = { calisthenics: 'calisthenics', weighted_calisthenics: 'weighted calisthenics', weights: 'weight training', hybrid: 'hybrid training' }[trainingType];

      const elitePrompt = `You are Kael, an elite ${typeLabel} coach. An athlete just finished a workout and gave you feedback. 

POST-WORKOUT FEEDBACK: "${checkin}"

EXERCISES COMPLETED TODAY:
${exerciseSummary}

CURRENT WEEK: ${currentWeek}
NEXT WEEK'S PROGRAM (to adjust): ${nextMicrocycle ? JSON.stringify(nextMicrocycle.days?.find(d => d.day_name === log?.day_name) || nextMicrocycle.days?.[0], null, 2) : 'No next week programmed yet.'}

Based on the athlete's feedback AND their actual reps/sets completed today:
1. Give a 1-2 sentence direct human response (empathetic, coach-like, no fluff).
2. If performance was strong (hit all reps or exceeded), recommend specific progressions for next week (increase reps/sets/harder variation, or add weight if weights/weighted calisthenics/hybrid).
3. If performance was poor or they felt pain/fatigue, recommend specific deloads (reduce volume, easier variation, more rest, reduce weight if applicable).
4. Return the adjusted exercises array for next week's same day, with exact changes applied.

Respond in JSON:
{
  "coach_response": "...",
  "adjustments_summary": "...",
  "adjusted_exercises": [{ "name": "...", "sets": 0, "reps": "...", "rest_seconds": 0, "notes": "..." }]
}`;

      const result = await supabaseApi.ai.invoke({
        type: 'live_workout',
        prompt: elitePrompt,
        response_json_schema: {
          type: "object",
          properties: {
            coach_response: { type: "string" },
            adjustments_summary: { type: "string" },
            adjusted_exercises: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  sets: { type: "number" },
                  reps: { type: "string" },
                  rest_seconds: { type: "number" },
                  notes: { type: "string" }
                }
              }
            }
          }
        }
      });

      const note = `${result.coach_response}\n\n📋 Next workout adjusted: ${result.adjustments_summary}`;
      setAiNote(note);
      await onSave(checkin, note);

      // Apply adjustments to the program if we have next week
      if (nextMicrocycle && result.adjusted_exercises?.length > 0 && onProgramUpdated) {
        const updatedMicrocycles = program.microcycles.map(mc => {
          if (mc.week_number !== currentWeek + 1) return mc;
          const updatedDays = mc.days.map(d => {
            if (d.day_name === log?.day_name) {
              return { ...d, exercises: result.adjusted_exercises };
            }
            return d;
          });
          return { ...mc, days: updatedDays };
        });
        await supabaseApi.entities.WorkoutProgram.update(program.id, { microcycles: updatedMicrocycles });
        if (onProgramUpdated) onProgramUpdated();
      }
    } else {
      // Free/non-Elite: basic response only
      const trainingType = program?.training_type || 'calisthenics';
      const typeLabel = { calisthenics: 'calisthenics', weighted_calisthenics: 'weighted calisthenics', weights: 'weight training', hybrid: 'hybrid training' }[trainingType];

      const prompt = `You are Kael, a real-talk ${typeLabel} coach. Based on this post-workout check-in, give a SHORT (2-3 sentence) human response and a concrete note on how to adjust the next workout. Sound like a person, not a bot. 

Check-in: "${checkin}"
Workout: ${log?.day_name || 'unknown'}
${exerciseSummary}

Respond with: 1 empathetic/direct sentence, then 1 specific adjustment for next time.`;

      const result = await supabaseApi.ai.invoke({ type: 'live_workout', prompt });
      setAiNote(result);
      await onSave(checkin, result);
    }

    setLoading(false);
    setDone(true);
  };

  if (done) {
    return (
      <Card className="p-4 border-accent/30 bg-accent/5">
        <p className="text-xs font-bold text-accent uppercase tracking-wider mb-2">Kael heard you</p>
        <p className="text-sm">{aiNote}</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <p className="font-heading font-bold text-sm">Post-Workout Check-in</p>
      </div>
      <p className="text-xs text-muted-foreground">
        How did it go? Any pain, anything that felt too easy or too hard, energy levels — just tell Kael in your own words.
      </p>
      <Textarea
        value={checkin}
        onChange={e => setCheckin(e.target.value)}
        placeholder='e.g. "Shoulder felt a bit tight on the dips. Pull-ups felt strong today, could probably do more reps. Pretty gassed by the end."'
        className="min-h-[100px] text-sm resize-none"
      />
      <Button className="w-full h-11 font-heading font-semibold" onClick={submit} disabled={!checkin.trim() || loading}>
        {loading ? (
          <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Getting Kael's take...</span>
        ) : 'Send to Kael'}
      </Button>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────
export default function LiveWorkout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { seconds, running, setRunning, fmt } = useTimer();

  const [user, setUser] = useState(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [exIndex, setExIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(0);
  const [resting, setResting] = useState(false);
  const [completedSets, setCompletedSets] = useState({});
  const [repsAchieved, setRepsAchieved] = useState({});
  const [started, setStarted] = useState(false);
  const [workoutDone, setWorkoutDone] = useState(false);
  const [savedLog, setSavedLog] = useState(null);
  const weekGenerationRef = useRef(null);

  useEffect(() => { supabaseApi.auth.me().then(setUser); }, []);

  // iOS back gesture: when workout is done, back navigates to program page
  useEffect(() => {
    if (!workoutDone) return;
    window.history.pushState({ workoutDone }, '');
    const handler = () => navigate('/program');
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [workoutDone, navigate]);

  const { data: programs = [] } = useQuery({
    queryKey: ['programs'],
    queryFn: () => supabaseApi.entities.WorkoutProgram.filter({ status: 'active' }, '-created_date', 1),
  });

  const maybeGenerateNextWeek = async (completedLog) => {
    const activeProgram = program;
    if (!activeProgram || !completedLog) return;

    const currentWeek = Number(completedLog.week_number || activeProgram.current_week || 1);
    const durationWeeks = Number(activeProgram.duration_weeks || 12);
    if (currentWeek >= durationWeeks) {
      return;
    }

    const currentMicrocycle = activeProgram.microcycles?.find(m => Number(m.week_number) === currentWeek);
    const scheduledDays = (currentMicrocycle?.days || []).filter(day => Array.isArray(day?.exercises) && day.exercises.length > 0);
    if (!scheduledDays.length) return;

    // Generate only when the athlete has finished every scheduled workout in
    // the current week. Duplicate log events cannot start two generations.
    const weekLogs = await supabaseApi.entities.WorkoutLog.filter(
      { program_id: activeProgram.id, week_number: currentWeek },
      '-date',
      100,
    );
    const completedDayNames = new Set(
      weekLogs.map(log => log.day_name).filter(Boolean),
    );
    const allDaysComplete = scheduledDays.every(day => completedDayNames.has(day.day_name));
    if (!allDaysComplete) return;

    const nextWeek = currentWeek + 1;
    if (weekGenerationRef.current === `${activeProgram.id}:${nextWeek}`) return;
    weekGenerationRef.current = `${activeProgram.id}:${nextWeek}`;

    try {
      const existingNext = activeProgram.microcycles?.find(m => Number(m.week_number) === nextWeek);
      if (existingNext) {
        await supabaseApi.entities.WorkoutProgram.update(activeProgram.id, { current_week: nextWeek });
        await queryClient.invalidateQueries({ queryKey: ['programs'] });
        toast.success(`Week ${nextWeek} is ready! 🔥`);
        return;
      }

      toast.success(`Week ${currentWeek} complete! Building Week ${nextWeek} from your real results…`);

      const athlete = await supabaseApi.auth.me();
      const promptData = profileToPromptData(athlete);
      const previousWeek = currentMicrocycle;

      const parsed = await supabaseApi.ai.invoke({
        type: 'microcycle',
        prompt: buildWeekPrompt(
          activeProgram.training_type || athlete.training_type || 'calisthenics',
          promptData,
          nextWeek,
          previousWeek,
          weekLogs,
        ),
        schema: WEEK_GENERATION_SCHEMA,
      });

      const generatedWeek = parsed?.microcycle;
      if (!generatedWeek || !Array.isArray(generatedWeek.days) || generatedWeek.days.length === 0) {
        throw new Error(`Week ${nextWeek} was not returned by the AI.`);
      }

      const nextMicrocycle = {
        ...generatedWeek,
        week_number: nextWeek,
        mesocycle_index: Math.min(2, Math.floor((nextWeek - 1) / 4)),
      };

      const existingWeeks = Array.isArray(activeProgram.microcycles) ? activeProgram.microcycles : [];
      const withoutNext = existingWeeks.filter(m => Number(m.week_number) !== nextWeek);
      const updatedMicrocycles = [...withoutNext, nextMicrocycle].sort(
        (a, b) => Number(a.week_number) - Number(b.week_number),
      );

      await supabaseApi.entities.WorkoutProgram.update(activeProgram.id, {
        microcycles: updatedMicrocycles,
        current_week: nextWeek,
      });

      await queryClient.invalidateQueries({ queryKey: ['programs'] });
      toast.success(`Week ${nextWeek} is ready — your next progression is built from this week's performance! 💪`);
    } catch (error) {
      console.error('[LIVE WORKOUT] NEXT WEEK GENERATION FAILED', error);
      // Keep the athlete on the completed week if generation fails. This makes
      // the failure retryable instead of putting them on a missing week.
      weekGenerationRef.current = null;
      toast.error(error?.message || `We couldn't build Week ${nextWeek} yet. We'll retry when you finish the week again.`);
    }
  };

  const logMutation = useMutation({
    mutationFn: (data) => supabaseApi.entities.WorkoutLog.create(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['logs'] });
      const prev = queryClient.getQueryData(['logs']);
      const optimistic = { id: `_opt_${Date.now()}`, ...data };
      queryClient.setQueryData(['logs'], old => [...(old || []), optimistic]);
      return { prev };
    },
    onError: (_err, _data, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['logs'], ctx.prev);
    },
    onSuccess: async (log) => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      setSavedLog(log);
      await maybeGenerateNextWeek(log);
    },
  });

  const updateLogMutation = useMutation({
    mutationFn: ({ id, data }) => supabaseApi.entities.WorkoutLog.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['logs'] });
      const prev = queryClient.getQueryData(['logs']);
      queryClient.setQueryData(['logs'], old => (old || []).map(l => l.id === id ? { ...l, ...data } : l));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['logs'], ctx.prev);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['logs'] }),
  });

  const program = programs[0];
  const currentWeekNum = program?.current_week || 1;
  const microcycle = program?.microcycles?.find(m => m.week_number === currentWeekNum) || program?.microcycles?.[0];
  const days = microcycle?.days || [];
  const day = days[dayIndex];
  const exercises = day?.exercises || [];
  const exercise = exercises[exIndex];
  const totalSets = exercise?.sets || 1;
  const restSecs = exercise?.rest_seconds || 60;

  const markSet = () => {
    const key = `${exIndex}-${setIndex}`;
    setCompletedSets(prev => ({ ...prev, [key]: true }));

    if (setIndex + 1 < totalSets) {
      setResting(true);
    } else {
      if (exIndex + 1 < exercises.length) {
        setExIndex(i => i + 1);
        setSetIndex(0);
        toast.success('Next exercise! 🔥');
      } else {
        finishWorkout();
      }
    }
  };

  const afterRest = () => { setResting(false); setSetIndex(s => s + 1); };

  const finishWorkout = () => {
    setRunning(false);
    setWorkoutDone(true);
    const exercisesCompleted = exercises.map((ex, ei) => ({
      name: ex.name,
      sets_completed: Array.from({ length: ex.sets || 1 }).filter((_, si) => completedSets[`${ei}-${si}`]).length,
      reps_achieved: repsAchieved[ei] || ex.reps,
      notes: '',
    }));
    logMutation.mutate({
      program_id: program?.id,
      date: new Date().toISOString().split('T')[0],
      week_number: currentWeekNum,
      day_name: day?.day_name,
      exercises_completed: exercisesCompleted,
      duration_minutes: Math.round(seconds / 60),
    });
    toast.success('Workout done! Amazing work. 💪');
  };

  const isElite = canAccess(user?.subscription_plan, 'live_workout');

  if (user && !isElite) {
    return (
      <div className="px-5 pt-12 pb-24 text-center flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="w-16 h-16 rounded-2xl bg-chart-4/10 flex items-center justify-center">
          <Dumbbell className="w-8 h-8 text-chart-4" />
        </div>
        <h2 className="font-heading font-bold text-xl">Live Workout Tracker</h2>
        <p className="text-muted-foreground text-sm max-w-xs">Real-time workout tracking is an <span className="font-semibold text-chart-4">Elite</span> feature. Upgrade to unlock guided live sessions, rest timers, and dynamic program adjustments.</p>
        <Button variant="outline" onClick={() => navigate('/profile')}>View Plans</Button>
      </div>
    );
  }

  if (!program || days.length === 0) {
    return (
      <div className="px-5 pt-12 pb-24 text-center">
        <Dumbbell className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground text-sm">No active program. Complete onboarding first.</p>
        <Button className="mt-4" onClick={() => navigate('/onboarding')}>Get Started</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="px-5 safe-top pb-3 border-b border-border bg-card/50 backdrop-blur-sm flex-shrink-0 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/program')}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-heading font-bold text-xl">Live Workout</h1>
          <p className="text-xs text-muted-foreground">Week {currentWeekNum} · {program.program_name}</p>
        </div>
        <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-full">
          <Timer className="w-3.5 h-3.5 text-primary" />
          <span className="font-heading font-bold text-sm tabular-nums">{fmt(seconds)}</span>
        </div>
      </div>

      <Tabs defaultValue="workout" className="flex-1 flex flex-col">
        <TabsList className="mx-5 mt-3 bg-muted/50 flex-shrink-0">
          <TabsTrigger value="workout" className="flex-1 font-heading">Workout</TabsTrigger>
          <TabsTrigger value="baseline" className="flex-1 font-heading">My Maxes</TabsTrigger>
        </TabsList>

        {/* ── WORKOUT TAB ── */}
        <TabsContent value="workout" className="flex-1 px-5 py-4 space-y-4 overflow-y-auto safe-bottom">
          {/* Day selector */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((d, i) => (
              <button key={i}
                onClick={() => { if (!started) { setDayIndex(i); setExIndex(0); setSetIndex(0); setResting(false); } }}
                className={cn('px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all flex-shrink-0',
                  i === dayIndex ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'
                )}>
                {d.day_name}
              </button>
            ))}
          </div>

          {/* Workout done — show checkin */}
          {workoutDone && (
            <div className="space-y-4">
              <Card className="p-4 text-center border-accent/30 bg-accent/5">
                <p className="font-heading font-bold text-lg">Workout Complete! 🎉</p>
                <p className="text-sm text-muted-foreground mt-1">{fmt(seconds)} · {exercises.length} exercises</p>
              </Card>
              {savedLog && (
                <PostWorkoutCheckin
                  log={savedLog}
                  isElite={user?.subscription_plan === 'elite'}
                  program={program}
                  onProgramUpdated={() => queryClient.invalidateQueries({ queryKey: ['programs'] })}
                  onSave={async (checkin, aiNote) => {
                    await updateLogMutation.mutateAsync({ id: savedLog.id, data: { post_workout_checkin: checkin, ai_adjustment_notes: aiNote } });
                  }}
                />
              )}
            </div>
          )}

          {/* Start card */}
          {!started && !workoutDone && (
            <Card className="p-6 text-center">
              <Dumbbell className="w-10 h-10 mx-auto mb-3 text-primary" />
              <h2 className="font-heading font-bold text-lg mb-1">{day?.day_name}</h2>
              <p className="text-sm text-muted-foreground mb-1">{day?.workout_type}</p>
              <p className="text-xs text-muted-foreground mb-2">{exercises.length} exercises</p>
              {exercises.slice(0, 3).map((ex, i) => (
                <p key={i} className="text-xs text-muted-foreground">{ex.name} — {ex.sets}×{ex.reps}</p>
              ))}
              {exercises.length > 3 && <p className="text-xs text-muted-foreground">+{exercises.length - 3} more</p>}
              <Button className="w-full h-12 font-heading font-semibold mt-5" onClick={() => { setStarted(true); setRunning(true); }}>
                Start Workout
              </Button>
            </Card>
          )}

          {/* Active workout */}
          {started && !workoutDone && exercise && !resting && (
            <Card className="p-5 border-2 border-primary/30">
              <div className="flex items-center justify-between mb-1">
                <Badge className="bg-primary/15 text-primary border-0 text-xs">Exercise {exIndex + 1} of {exercises.length}</Badge>
                <Badge className="bg-muted text-muted-foreground border-0 text-xs">Set {setIndex + 1} of {totalSets}</Badge>
              </div>
              <h2 className="font-heading font-bold text-xl mt-2 mb-1">{exercise.name}</h2>
              <p className="text-sm text-muted-foreground mb-1">Target: {exercise.reps} reps · {restSecs}s rest</p>
              {exercise.notes && <p className="text-xs text-muted-foreground italic mb-3">"{exercise.notes}"</p>}
              {exercise.activation_cue && (
                <div className="flex items-start gap-2 mb-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                  <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">Activation Cue</p>
                    <p className="text-xs text-foreground leading-relaxed">{exercise.activation_cue}</p>
                  </div>
                </div>
              )}

              {/* Actual reps input */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs text-muted-foreground flex-shrink-0">Actual reps:</span>
                <Input
                  type="number"
                  placeholder={exercise.reps}
                  className="h-9 text-sm w-24"
                  value={repsAchieved[exIndex] || ''}
                  onChange={e => setRepsAchieved(prev => ({ ...prev, [exIndex]: e.target.value }))}
                />
              </div>

              <div className="flex gap-2 mb-5">
                {Array.from({ length: totalSets }).map((_, si) => {
                  const key = `${exIndex}-${si}`;
                  const done = !!completedSets[key];
                  const current = si === setIndex;
                  return (
                    <div key={si} className={cn('w-9 h-9 rounded-xl flex items-center justify-center border-2 text-xs font-bold transition-all',
                      done ? 'bg-accent border-accent text-accent-foreground' : current ? 'border-primary text-primary' : 'border-border text-muted-foreground'
                    )}>
                      {done ? <CheckCircle2 className="w-4 h-4" /> : si + 1}
                    </div>
                  );
                })}
              </div>

              <Button className="w-full h-12 font-heading font-semibold text-base" onClick={markSet}>
                <CheckCircle2 className="w-5 h-5 mr-2" /> Complete Set {setIndex + 1}
              </Button>
            </Card>
          )}

          {started && !workoutDone && resting && (
            <Card className="p-5"><RestTimer seconds={restSecs} onDone={afterRest} /></Card>
          )}

          {/* Exercise list */}
          {started && !workoutDone && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">All Exercises</p>
              {exercises.map((ex, i) => {
                const allDone = Array.from({ length: ex.sets || 1 }).every((_, si) => completedSets[`${i}-${si}`]);
                return (
                  <div key={i} className={cn('flex items-center gap-3 p-3 rounded-xl border transition-all',
                    i === exIndex ? 'border-primary bg-primary/5' : allDone ? 'border-accent/30 bg-accent/5' : 'border-border bg-card'
                  )}>
                    {allDone ? <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                      : i === exIndex ? <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 animate-pulse ml-1" />
                        : <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{ex.name}</p>
                      <p className="text-xs text-muted-foreground">{ex.sets}×{ex.reps}</p>
                      {ex.activation_cue && (
                        <p className="text-[10px] text-primary/70 truncate mt-0.5">{ex.activation_cue}</p>
                      )}
                    </div>
                    {i === exIndex && !allDone && (
                      <SkipForward className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => { setExIndex(i + 1 < exercises.length ? i + 1 : i); setSetIndex(0); setResting(false); }} />
                    )}
                  </div>
                );
              })}

              <Button variant="outline" className="w-full mt-2" onClick={finishWorkout}>
                Finish Workout Early
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ── BASELINE TAB ── */}
        <TabsContent value="baseline" className="flex-1 px-5 py-4 overflow-y-auto safe-bottom">
          <h2 className="font-heading font-bold text-lg mb-1">My Current Maxes</h2>
          <MovementBaseline trainingType={program?.training_type} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
