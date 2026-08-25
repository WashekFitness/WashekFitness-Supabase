```jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseApi } from '@/lib/supabaseApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ChevronLeft,
  CheckCircle2,
  Circle,
  Timer,
  Dumbbell,
  SkipForward,
  Plus,
  Minus,
  Sparkles,
  Zap,
  Crown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppSettings } from '@/lib/AppSettingsContext';
import { toast } from 'sonner';

// ─── Timer ─────────────────────────────────────────────

function useTimer() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } else {
      clearInterval(ref.current);
    }

    return () => clearInterval(ref.current);
  }, [running]);

  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return {
    seconds,
    running,
    setRunning,
    fmt,
  };
}

// ─── Rest Timer ─────────────────────────────────────────

function RestTimer({ seconds: restSecs, onDone }) {
  const [left, setLeft] = useState(restSecs);
  const onDoneRef = useRef(onDone);

  onDoneRef.current = onDone;

  useEffect(() => {
    if (restSecs <= 0) {
      onDoneRef.current();
      return;
    }

    const start = Date.now();
    const initial = restSecs;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const remaining = Math.max(0, initial - elapsed);

      setLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onDoneRef.current();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [restSecs]);

  return (
    <Card className="p-6 text-center">
      <Timer className="w-10 h-10 mx-auto mb-3 text-primary" />

      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
        Rest
      </p>

      <p className="font-heading text-5xl font-bold tabular-nums mt-2">
        {String(Math.floor(left / 60)).padStart(2, '0')}:
        {String(left % 60).padStart(2, '0')}
      </p>

      <Button
        variant="outline"
        className="mt-5"
        onClick={onDone}
      >
        <SkipForward className="w-4 h-4 mr-2" />
        Skip Rest
      </Button>
    </Card>
  );
}

// ─── Movement Input ────────────────────────────────────

function MovementInput({
  label,
  unit,
  value,
  onChange,
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>

      <div className="relative mt-1">
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          className="h-10 pr-12"
        />

        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Baseline Section ──────────────────────────────────

const CALISTHENICS_MOVEMENTS = [
  { key: 'pull_up', label: 'Pull Up', unit: 'reps' },
  { key: 'push_up', label: 'Push Up', unit: 'reps' },
  { key: 'dip', label: 'Dip', unit: 'reps' },
  { key: 'muscle_up', label: 'Muscle Up', unit: 'reps' },
  { key: 'handstand_push_up', label: 'Handstand Push Up', unit: 'reps' },
  { key: 'pistol_squat', label: 'Pistol Squat', unit: 'reps' },
];

const WEIGHT_MOVEMENTS = [
  { key: 'bench_press', label: 'Bench Press' },
  { key: 'squat', label: 'Squat' },
  { key: 'deadlift', label: 'Deadlift' },
  { key: 'overhead_press', label: 'Overhead Press' },
  { key: 'barbell_row', label: 'Barbell Row' },
];

const WEIGHTED_CALI_MOVEMENTS = [
  { key: 'weighted_pull_up', label: 'Weighted Pull Up' },
  { key: 'weighted_dip', label: 'Weighted Dip' },
  { key: 'weighted_push_up', label: 'Weighted Push Up' },
];

const ALL_BASELINE_MOVEMENTS = [
  ...CALISTHENICS_MOVEMENTS,
  ...WEIGHT_MOVEMENTS.map((m) => ({ ...m, unit: 'lb' })),
  ...WEIGHTED_CALI_MOVEMENTS.map((m) => ({ ...m, unit: 'lb' })),
];

// ─── Baseline ──────────────────────────────────────────

function BaselineSection() {
  const { settings } = useAppSettings();

  const [values, setValues] = useState({});
  const [customEntries, setCustomEntries] = useState([]);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomVal, setNewCustomVal] = useState('');
  const [saving, setSaving] = useState(false);

  const [user, setUser] = useState(null);
  const [baselines, setBaselines] = useState([]);

  useEffect(() => {
    let mounted = true;

    supabaseApi.auth
      .me()
      .then((u) => {
        if (mounted) setUser(u);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user?.email) return;

    supabaseApi.entities.MovementBaseline
      .filter(
        {
          created_by: user.email,
        },
        '-recorded_date',
        1
      )
      .then((rows) => {
        setBaselines(rows || []);

        const row = rows?.[0];

        if (!row) return;

        const next = {};

        ALL_BASELINE_MOVEMENTS.forEach((movement) => {
          if (row[movement.key] !== undefined && row[movement.key] !== null) {
            next[movement.key] = row[movement.key];
          }
        });

        setValues(next);
        setCustomEntries(row.custom_entries || []);
      })
      .catch(() => {});
  }, [user?.email]);

  const showCalisthenics =
    !settings?.training_type ||
    settings.training_type === 'calisthenics' ||
    settings.training_type === 'weighted_calisthenics' ||
    settings.training_type === 'hybrid';

  const showWeights =
    !settings?.training_type ||
    settings.training_type === 'weights' ||
    settings.training_type === 'hybrid';

  const showWeightedCali =
    !settings?.training_type ||
    settings.training_type === 'weighted_calisthenics' ||
    settings.training_type === 'hybrid';

  const weightUnit = settings?.weight_unit || 'lb';

  const saveBaseline = async () => {
    if (!user?.email) return;

    setSaving(true);

    try {
      const today = new Date().toISOString().split('T')[0];

      const data = {
        recorded_date: today,
        custom_entries: customEntries,
      };

      ALL_BASELINE_MOVEMENTS.forEach((m) => {
        if (values[m.key]) {
          data[m.key] = parseFloat(values[m.key]);
        }
      });

      if (baselines[0]?.recorded_date === today) {
        await supabaseApi.entities.MovementBaseline.update(
          baselines[0].id,
          data
        );
      } else {
        await supabaseApi.entities.MovementBaseline.create(data);
      }

      toast.success(
        'Baseline saved! Kael will use it to program smarter.'
      );

      setBaselines((prev) => [
        {
          ...(prev[0] || {}),
          ...data,
          recorded_date: today,
        },
      ]);
    } catch (err) {
      console.error(err);
      toast.error('Could not save your baseline.');
    } finally {
      setSaving(false);
    }
  };

  const addCustom = () => {
    if (!newCustomName.trim()) return;

    setCustomEntries((prev) => [
      ...prev,
      {
        name: newCustomName.trim(),
        value: newCustomVal.trim(),
      },
    ]);

    setNewCustomName('');
    setNewCustomVal('');
  };

  return (
    <div className="space-y-4 pb-4">
      <div className="bg-muted/40 rounded-2xl p-4 border border-border">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Log your current maxes here. This doesn't affect your live workout.
          It's just so Kael knows where you're at and can program smarter.
        </p>
      </div>

      {showCalisthenics && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Calisthenics Maxes
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {CALISTHENICS_MOVEMENTS.map(
              ({ key, label, unit }) => (
                <MovementInput
                  key={key}
                  label={label}
                  unit={unit}
                  value={values[key]}
                  onChange={(v) =>
                    setValues((prev) => ({
                      ...prev,
                      [key]: v,
                    }))
                  }
                />
              )
            )}
          </div>
        </div>
      )}

      {showWeights && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Weight PRs (1RM)
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {WEIGHT_MOVEMENTS.map(({ key, label }) => (
              <MovementInput
                key={key}
                label={label}
                unit={weightUnit}
                value={values[key]}
                onChange={(v) =>
                  setValues((prev) => ({
                    ...prev,
                    [key]: v,
                  }))
                }
              />
            ))}
          </div>
        </div>
      )}

      {showWeightedCali && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Weighted Calisthenics PRs (Max Added Weight)
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {WEIGHTED_CALI_MOVEMENTS.map(({ key, label }) => (
              <MovementInput
                key={key}
                label={label}
                unit={weightUnit}
                value={values[key]}
                onChange={(v) =>
                  setValues((prev) => ({
                    ...prev,
                    [key]: v,
                  }))
                }
              />
            ))}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <p className="text-sm font-semibold">Custom Movement</p>

        <div className="flex gap-2">
          <Input
            placeholder="e.g. Typewriter Pull Up"
            value={newCustomName}
            onChange={(e) => setNewCustomName(e.target.value)}
            className="h-9 text-sm flex-1"
          />

          <Input
            placeholder="e.g. 3 reps"
            value={newCustomVal}
            onChange={(e) => setNewCustomVal(e.target.value)}
            className="h-9 text-sm w-28"
          />

          <Button
            size="sm"
            variant="outline"
            onClick={addCustom}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {customEntries.map((c, i) => (
          <div
            key={i}
            className="flex items-center justify-between text-sm"
          >
            <span>{c.name}</span>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">
                {c.value}
              </span>

              <button
                onClick={() =>
                  setCustomEntries((prev) =>
                    prev.filter((_, j) => j !== i)
                  )
                }
                className="text-destructive hover:text-destructive/80"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Button
        className="w-full h-12 font-heading font-semibold"
        onClick={saveBaseline}
        disabled={saving}
      >
        {saving ? 'Saving...' : 'Save My Baseline'}
      </Button>
    </div>
  );
}

// ─── Post Workout Checkin ──────────────────────────────

function PostWorkoutCheckin({
  log,
  onSave,
  isElite,
  program,
  onProgramUpdated,
}) {
  const [checkin, setCheckin] = useState('');
  const [aiNote, setAiNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!checkin.trim()) return;

    setLoading(true);

    try {
      const exerciseSummary = (
        log?.exercises_completed || []
      )
        .map(
          (e) =>
            `${e.name}: ${e.sets_completed} sets, ${e.reps_achieved} reps`
        )
        .join('\n');

      /**
       * ELITE ONLY:
       *
       * Real-time/adaptive program adjustments belong here.
       * The tracker itself is NOT gated.
       */
      if (isElite && program) {
        const currentWeek = program.current_week || 1;

        const nextMicrocycle =
          program.microcycles?.find(
            (m) => m.week_number === currentWeek + 1
          ) || null;

        const trainingType =
          program?.training_type || 'calisthenics';

        const typeLabel =
          {
            calisthenics: 'calisthenics',
            weighted_calisthenics: 'weighted calisthenics',
            weights: 'weight training',
            hybrid: 'hybrid training',
          }[trainingType] || 'fitness';

        const elitePrompt = `
You are Kael, an elite ${typeLabel} coach.

An athlete just finished a workout and gave you feedback.

POST-WORKOUT FEEDBACK:
"${checkin}"

EXERCISES COMPLETED TODAY:
${exerciseSummary}

CURRENT WEEK:
${currentWeek}

NEXT WEEK'S PROGRAM:
${
  nextMicrocycle
    ? JSON.stringify(
        nextMicrocycle.days?.find(
          (d) => d.day_name === log?.day_name
        ) ||
          nextMicrocycle.days?.[0],
        null,
        2
      )
    : 'No next week programmed yet.'
}

Based on the athlete's feedback and their actual performance:

1. Give a 1-2 sentence direct human response.
2. If performance was strong, recommend specific progressions.
3. If performance was poor, painful, or fatigued, recommend appropriate deloads.
4. Return the adjusted exercises for next week's same day.

Respond in JSON:
{
  "coach_response": "...",
  "adjustments_summary": "...",
  "adjusted_exercises": [
    {
      "name": "...",
      "sets": 0,
      "reps": "...",
      "rest_seconds": 0,
      "notes": "..."
    }
  ]
}
`;

        const result = await supabaseApi.ai.invoke({
          type: 'live_workout',
          prompt: elitePrompt,
          response_json_schema: {
            type: 'object',
            properties: {
              coach_response: { type: 'string' },
              adjustments_summary: { type: 'string' },
              adjusted_exercises: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    sets: { type: 'number' },
                    reps: { type: 'string' },
                    rest_seconds: { type: 'number' },
                    notes: { type: 'string' },
                  },
                },
              },
            },
          },
        });

        const note = `${result.coach_response}\n\n📋 Next workout adjusted: ${result.adjustments_summary}`;

        setAiNote(note);

        await onSave(checkin, note);

        if (
          nextMicrocycle &&
          result.adjusted_exercises?.length > 0 &&
          onProgramUpdated
        ) {
          const updatedMicrocycles =
            program.microcycles.map((mc) => {
              if (mc.week_number !== currentWeek + 1) {
                return mc;
              }

              const updatedDays = mc.days.map((d) => {
                if (d.day_name === log?.day_name) {
                  return {
                    ...d,
                    exercises: result.adjusted_exercises,
                  };
                }

                return d;
              });

              return {
                ...mc,
                days: updatedDays,
              };
            });

          await supabaseApi.entities.WorkoutProgram.update(
            program.id,
            {
              microcycles: updatedMicrocycles,
            }
          );

          onProgramUpdated();
        }
      } else {
        /**
         * FREE / NON-ELITE:
         *
         * Free users can still complete workouts and receive
         * the normal post-workout coaching response.
         *
         * What Free users DO NOT receive is automatic
         * program modification.
         */
        const trainingType =
          program?.training_type || 'calisthenics';

        const typeLabel =
          {
            calisthenics: 'calisthenics',
            weighted_calisthenics: 'weighted calisthenics',
            weights: 'weight training',
            hybrid: 'hybrid training',
          }[trainingType] || 'fitness';

        const prompt = `
You are Kael, a real-talk ${typeLabel} coach.

Based on this post-workout check-in, give a SHORT
2-3 sentence human response.

Do not modify the user's program.

Check-in:
"${checkin}"

Workout:
${log?.day_name || 'unknown'}

EXERCISES:
${exerciseSummary}

Respond with:
1. One empathetic/direct sentence.
2. One specific coaching observation for the athlete's next session.

Do not return program modification JSON.
`;

        const result = await supabaseApi.ai.invoke({
          type: 'live_workout',
          prompt,
        });

        setAiNote(result);

        await onSave(checkin, result);
      }

      setLoading(false);
      setDone(true);
    } catch (error) {
      console.error('Post-workout check-in failed:', error);

      toast.error(
        'Could not get Kael’s post-workout response. Your workout was still saved.'
      );

      setLoading(false);
    }
  };

  if (done) {
    return (
      <Card className="p-4 border-accent/30 bg-accent/5">
        <p className="text-xs font-bold text-accent uppercase tracking-wider mb-2">
          Kael heard you
        </p>

        <p className="text-sm">
          {aiNote}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <p className="font-heading font-bold text-sm">
          Post-Workout Check-in
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        How did it go? Any pain, anything that felt too easy or too hard,
        energy levels — just tell Kael in your own words.
      </p>

      <Textarea
        value={checkin}
        onChange={(e) => setCheckin(e.target.value)}
        placeholder='e.g. "Shoulder felt a bit tight on the dips. Pull-ups felt strong today, could probably do more reps."'
        className="min-h-[100px] text-sm resize-none"
      />

      <Button
        className="w-full h-11 font-heading font-semibold"
        onClick={submit}
        disabled={!checkin.trim() || loading}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            Getting Kael's take...
          </span>
        ) : (
          'Send to Kael'
        )}
      </Button>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────

export default function LiveWorkout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    seconds,
    running,
    setRunning,
    fmt,
  } = useTimer();

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

  useEffect(() => {
    supabaseApi.auth.me()
      .then(setUser)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!workoutDone) return;

    window.history.pushState({ workoutDone }, '');

    const handler = () => navigate('/program');

    window.addEventListener('popstate', handler);

    return () =>
      window.removeEventListener('popstate', handler);
  }, [workoutDone, navigate]);

  const {
    data: programs = [],
    isLoading: programsLoading,
  } = useQuery({
    queryKey: ['programs'],
    queryFn: () =>
      supabaseApi.entities.WorkoutProgram.filter(
        {
          status: 'active',
        },
        '-created_date',
        1
      ),
  });

  const logMutation = useMutation({
    mutationFn: (data) =>
      supabaseApi.entities.WorkoutLog.create(data),

    onMutate: async (data) => {
      await queryClient.cancelQueries({
        queryKey: ['logs'],
      });

      const prev =
        queryClient.getQueryData(['logs']);

      const optimistic = {
        id: `_opt_${Date.now()}`,
        ...data,
      };

      queryClient.setQueryData(
        ['logs'],
        (old) => [
          ...(old || []),
          optimistic,
        ]
      );

      return { prev };
    },

    onError: (_err, _data, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(
          ['logs'],
          ctx.prev
        );
      }

      toast.error(
        'Workout could not be saved. Please try again.'
      );
    },

    onSuccess: (log) => {
      queryClient.invalidateQueries({
        queryKey: ['logs'],
      });

      setSavedLog(log);
    },
  });

  const updateLogMutation = useMutation({
    mutationFn: ({ id, data }) =>
      supabaseApi.entities.WorkoutLog.update(
        id,
        data
      ),

    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({
        queryKey: ['logs'],
      });

      const prev =
        queryClient.getQueryData(['logs']);

      queryClient.setQueryData(
        ['logs'],
        (old) =>
          (old || []).map((l) =>
            l.id === id
              ? {
                  ...l,
                  ...data,
                }
              : l
          )
      );

      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(
          ['logs'],
          ctx.prev
        );
      }
    },

    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['logs'],
      }),
  });

  const program = programs[0];

  const currentWeekNum =
    program?.current_week || 1;

  const microcycle =
    program?.microcycles?.find(
      (m) => m.week_number === currentWeekNum
    ) ||
    program?.microcycles?.[0];

  const days =
    microcycle?.days || [];

  const day =
    days[dayIndex];

  const exercises =
    day?.exercises || [];

  const exercise =
    exercises[exIndex];

  const totalSets =
    exercise?.sets || 1;

  const restSecs =
    exercise?.rest_seconds || 60;

  /**
   * IMPORTANT:
   *
   * The tracker is FREE.
   *
   * We do NOT use canAccess() here.
   * We do NOT return an Elite upgrade screen.
   *
   * Elite status is only used for AI-based program
   * adjustments after the workout.
   */
  const isElite =
    user?.subscription_plan === 'elite';

  const markSet = () => {
    const key = `${exIndex}-${setIndex}`;

    setCompletedSets((prev) => ({
      ...prev,
      [key]: true,
    }));

    if (setIndex + 1 < totalSets) {
      setResting(true);
    } else {
      if (exIndex + 1 < exercises.length) {
        setExIndex((i) => i + 1);
        setSetIndex(0);

        toast.success(
          'Next exercise! 🔥'
        );
      } else {
        finishWorkout();
      }
    }
  };

  const afterRest = () => {
    setResting(false);
    setSetIndex((s) => s + 1);
  };

  const finishWorkout = () => {
    setRunning(false);
    setWorkoutDone(true);

    const exercisesCompleted =
      exercises.map((ex, ei) => ({
        name: ex.name,

        sets_completed:
          Array.from({
            length: ex.sets || 1,
          }).filter(
            (_, si) =>
              completedSets[
                `${ei}-${si}`
              ]
          ).length,

        reps_achieved:
          repsAchieved[ei] ||
          ex.reps,

        notes: '',
      }));

    logMutation.mutate({
      program_id: program?.id,
      date: new Date()
        .toISOString()
        .split('T')[0],
      week_number: currentWeekNum,
      day_name: day?.day_name,
      exercises_completed:
        exercisesCompleted,
      duration_minutes:
        Math.round(seconds / 60),
    });

    toast.success(
      'Workout done! Amazing work. 💪'
    );
  };

  if (programsLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!program || days.length === 0) {
    return (
      <div className="px-5 pt-12 pb-24 text-center">
        <Dumbbell className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />

        <p className="text-muted-foreground text-sm">
          No active program. Complete onboarding first.
        </p>

        <Button
          className="mt-4"
          onClick={() =>
            navigate('/onboarding')
          }
        >
          Get Started
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="px-5 safe-top pb-3 border-b border-border bg-card/50 backdrop-blur-sm flex-shrink-0 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            navigate('/program')
          }
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <div className="flex-1">
          <h1 className="font-heading font-bold text-xl">
            Live Workout
          </h1>

          <p className="text-xs text-muted-foreground">
            Week {currentWeekNum} ·{' '}
            {program.program_name}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-full">
          <Timer className="w-3.5 h-3.5 text-primary" />

          <span className="font-heading font-bold text-sm tabular-nums">
            {fmt(seconds)}
          </span>
        </div>
      </div>

      <Tabs
        defaultValue="workout"
        className="flex-1 flex flex-col"
      >
        <TabsList className="mx-5 mt-3 bg-muted/50 flex-shrink-0">
          <TabsTrigger
            value="workout"
            className="flex-1 font-heading"
          >
            Workout
          </TabsTrigger>

          <TabsTrigger
            value="baseline"
            className="flex-1 font-heading"
          >
            My Maxes
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="workout"
          className="flex-1 px-5 py-4 space-y-4 overflow-y-auto safe-bottom"
        >
          {/* Day selector */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((d, i) => (
              <button
                key={i}
                onClick={() => {
                  if (!started) {
                    setDayIndex(i);
                    setExIndex(0);
                    setSetIndex(0);
                    setResting(false);
                  }
                }}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all flex-shrink-0',

                  i === dayIndex
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card border-border text-muted-foreground'
                )}
              >
                {d.day_name}
              </button>
            ))}
          </div>

          {/* Workout done */}
          {workoutDone && (
            <div className="space-y-4">
              <Card className="p-4 text-center border-accent/30 bg-accent/5">
                <p className="font-heading font-bold text-lg">
                  Workout Complete! 🎉
                </p>

                <p className="text-sm text-muted-foreground mt-1">
                  {fmt(seconds)} ·{' '}
                  {exercises.length}{' '}
                  exercises
                </p>
              </Card>

              {savedLog && (
                <PostWorkoutCheckin
                  log={savedLog}
                  isElite={isElite}
                  program={program}
                  onProgramUpdated={() =>
                    queryClient.invalidateQueries({
                      queryKey: ['programs'],
                    })
                  }
                  onSave={async (
                    checkin,
                    aiNote
                  ) => {
                    await updateLogMutation.mutateAsync(
                      {
                        id: savedLog.id,
                        data: {
                          post_workout_checkin:
                            checkin,
                          ai_adjustment_notes:
                            aiNote,
                        },
                      }
                    );
                  }}
                />
              )}
            </div>
          )}

          {/* Start card */}
          {!started && !workoutDone && (
            <Card className="p-6 text-center">
              <Dumbbell className="w-10 h-10 mx-auto mb-3 text-primary" />

              <h2 className="font-heading font-bold text-lg mb-1">
                {day?.day_name}
              </h2>

              <p className="text-sm text-muted-foreground mb-1">
                {day?.workout_type}
              </p>

              <p className="text-xs text-muted-foreground mb-2">
                {exercises.length} exercises
              </p>

              {exercises
                .slice(0, 3)
                .map((ex, i) => (
                  <p
                    key={i}
                    className="text-xs text-muted-foreground"
                  >
                    {ex.name} — {ex.sets}×
                    {ex.reps}
                  </p>
                ))}

              {exercises.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{exercises.length - 3}{' '}
                  more
                </p>
              )}

              <Button
                className="w-full h-12 font-heading font-semibold mt-5"
                onClick={() => {
                  setStarted(true);
                  setRunning(true);
                }}
              >
                Start Workout
              </Button>
            </Card>
          )}

          {/* Active workout */}
          {started &&
            !workoutDone &&
            !resting &&
            exercise && (
              <Card className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Exercise {exIndex + 1} of{' '}
                      {exercises.length}
                    </p>

                    <h2 className="font-heading font-bold text-xl mt-1">
                      {exercise.name}
                    </h2>

                    <p className="text-sm text-muted-foreground mt-1">
                      {exercise.sets} sets ×{' '}
                      {exercise.reps}
                    </p>
                  </div>

                  <Badge variant="outline">
                    Set {setIndex + 1}/
                    {totalSets}
                  </Badge>
                </div>

                {exercise.notes && (
                  <div className="mt-4 p-3 rounded-xl bg-muted/40">
                    <p className="text-xs text-muted-foreground">
                      {exercise.notes}
                    </p>
                  </div>
                )}

                <div className="mt-5 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Reps achieved
                    </label>

                    <Input
                      type="number"
                      min="0"
                      value={
                        repsAchieved[exIndex] ||
                        ''
                      }
                      onChange={(e) =>
                        setRepsAchieved(
                          (prev) => ({
                            ...prev,
                            [exIndex]:
                              e.target.value,
                          })
                        )
                      }
                      placeholder={
                        String(exercise.reps)
                      }
                      className="mt-1 h-11"
                    />
                  </div>

                  <Button
                    className="w-full h-12 font-heading font-semibold"
                    onClick={markSet}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Complete Set
                  </Button>
                </div>

                <div className="mt-5">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Sets
                  </p>

                  <div className="flex gap-2">
                    {Array.from({
                      length: totalSets,
                    }).map((_, i) => {
                      const complete =
                        completedSets[
                          `${exIndex}-${i}`
                        ];

                      return (
                        <div
                          key={i}
                          className={cn(
                            'w-9 h-9 rounded-full flex items-center justify-center border',

                            complete
                              ? 'bg-accent/15 border-accent text-accent'
                              : i === setIndex
                              ? 'bg-primary/10 border-primary text-primary'
                              : 'bg-muted border-border text-muted-foreground'
                          )}
                        >
                          {complete ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            )}

          {/* Rest timer */}
          {started &&
            !workoutDone &&
            resting && (
              <RestTimer
                seconds={restSecs}
                onDone={afterRest}
              />
            )}
        </TabsContent>

        <TabsContent
          value="baseline"
          className="flex-1 px-5 py-4 overflow-y-auto safe-bottom"
        >
          <BaselineSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```
