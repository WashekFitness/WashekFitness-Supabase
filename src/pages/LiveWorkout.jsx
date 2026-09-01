import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseApi } from '@/lib/supabaseApi';
import { canAccess } from '@/lib/subscription';
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
  Lock,
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
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(
      s % 60
    ).padStart(2, '0')}`;

  return {
    seconds,
    running,
    setRunning,
    fmt,
  };
}

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
      const remaining = initial - elapsed;

      if (remaining <= 0) {
        clearInterval(interval);
        setLeft(0);
        onDoneRef.current();
      } else {
        setLeft(remaining);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [restSecs]);

  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
        Rest
      </p>

      <p className="font-heading text-6xl font-bold text-primary">
        {left}s
      </p>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onDoneRef.current()}
      >
        Skip Rest
      </Button>
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
  {
    key: 'handstand_hold_seconds',
    label: 'Handstand Hold',
    unit: 'seconds',
  },
  {
    key: 'l_sit_hold_seconds',
    label: 'L-Sit Hold',
    unit: 'seconds',
  },
  {
    key: 'front_lever_hold_seconds',
    label: 'Front Lever Hold',
    unit: 'seconds',
  },
  {
    key: 'back_lever_hold_seconds',
    label: 'Back Lever Hold',
    unit: 'seconds',
  },
  {
    key: 'planche_hold_seconds',
    label: 'Planche Hold',
    unit: 'seconds',
  },
  {
    key: 'human_flag_hold_seconds',
    label: 'Human Flag Hold',
    unit: 'seconds',
  },
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

const ALL_BASELINE_MOVEMENTS = [
  ...CALISTHENICS_MOVEMENTS,
  ...WEIGHT_MOVEMENTS,
  ...WEIGHTED_CALI_MOVEMENTS,
];

function baselineHasCalisthenics(tt) {
  if (!tt) return true;

  return (
    tt === 'calisthenics' ||
    tt === 'weighted_calisthenics' ||
    tt === 'hybrid'
  );
}

function baselineHasWeights(tt) {
  return tt === 'weights' || tt === 'hybrid';
}

function baselineHasWeightedCali(tt) {
  return (
    tt === 'weighted_calisthenics' ||
    tt === 'hybrid'
  );
}

function MovementInput({
  label,
  unit,
  value,
  onChange,
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3">
      <p className="text-xs text-muted-foreground mb-1">
        {label}
      </p>

      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="h-9 text-sm"
        />

        {unit && (
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function MovementBaseline({ trainingType }) {
  const queryClient = useQueryClient();
  const { settings } = useAppSettings();

  const today = new Date()
    .toISOString()
    .split('T')[0];

  const [values, setValues] = useState({});
  const [customEntries, setCustomEntries] = useState([]);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomVal, setNewCustomVal] = useState('');
  const [saving, setSaving] = useState(false);

  const showCalisthenics =
    baselineHasCalisthenics(trainingType);

  const showWeights =
    baselineHasWeights(trainingType);

  const showWeightedCali =
    baselineHasWeightedCali(trainingType);

  const weightUnit =
    settings?.unit === 'metric'
      ? 'kg'
      : 'lbs';

  const { data: baselines = [] } =
    useQuery({
      queryKey: ['baselines'],
      queryFn: () =>
        supabaseApi.entities.MovementBaseline.list(
          '-recorded_date',
          1
        ),
    });

  useEffect(() => {
    if (!baselines[0]) return;

    const b = baselines[0];
    const v = {};

    ALL_BASELINE_MOVEMENTS.forEach(
      (movement) => {
        if (b[movement.key] != null) {
          v[movement.key] =
            b[movement.key];
        }
      }
    );

    setValues(v);

    if (Array.isArray(b.custom_entries)) {
      setCustomEntries(
        b.custom_entries
      );
    }
  }, [baselines]);

  const saveBaseline = async () => {
    setSaving(true);

    try {
      const data = {
        recorded_date: today,
        custom_entries: customEntries,
      };

      ALL_BASELINE_MOVEMENTS.forEach(
        (movement) => {
          if (
            values[movement.key] !==
            undefined &&
            values[movement.key] !== ''
          ) {
            data[movement.key] =
              parseFloat(
                values[movement.key]
              );
          }
        }
      );

      if (
        baselines[0]?.recorded_date ===
        today
      ) {
        await supabaseApi.entities.MovementBaseline.update(
          baselines[0].id,
          data
        );
      } else {
        await supabaseApi.entities.MovementBaseline.create(
          data
        );
      }

      queryClient.invalidateQueries({
        queryKey: ['baselines'],
      });

      toast.success(
        'Baseline saved! Kael will use this to adjust your workouts.'
      );
    } catch (error) {
      console.error(
        '[LiveWorkout] Failed to save baseline:',
        error
      );

      toast.error(
        error?.message ||
          'Unable to save your baseline.'
      );
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
          Log your current maxes here. This{' '}
          <strong>
            doesn't affect your live workout
          </strong>{' '}
          — it's just so Kael knows where you're at
          and can program smarter.
        </p>
      </div>

      {showCalisthenics && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Calisthenics Maxes
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {CALISTHENICS_MOVEMENTS.map(
              ({
                key,
                label,
                unit,
              }) => (
                <MovementInput
                  key={key}
                  label={label}
                  unit={unit}
                  value={values[key]}
                  onChange={(value) =>
                    setValues((prev) => ({
                      ...prev,
                      [key]: value,
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
            {WEIGHT_MOVEMENTS.map(
              ({ key, label }) => (
                <MovementInput
                  key={key}
                  label={label}
                  unit={weightUnit}
                  value={values[key]}
                  onChange={(value) =>
                    setValues((prev) => ({
                      ...prev,
                      [key]: value,
                    }))
                  }
                />
              )
            )}
          </div>
        </div>
      )}

      {showWeightedCali && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Weighted Calisthenics PRs
            (Max Added Weight)
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {WEIGHTED_CALI_MOVEMENTS.map(
              ({ key, label }) => (
                <MovementInput
                  key={key}
                  label={label}
                  unit={weightUnit}
                  value={values[key]}
                  onChange={(value) =>
                    setValues((prev) => ({
                      ...prev,
                      [key]: value,
                    }))
                  }
                />
              )
            )}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <p className="text-sm font-semibold">
          Custom Movement
        </p>

        <div className="flex gap-2">
          <Input
            placeholder="e.g. Typewriter Pull Up"
            value={newCustomName}
            onChange={(e) =>
              setNewCustomName(
                e.target.value
              )
            }
            className="h-9 text-sm flex-1"
          />

          <Input
            placeholder="e.g. 3 reps"
            value={newCustomVal}
            onChange={(e) =>
              setNewCustomVal(
                e.target.value
              )
            }
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

        {customEntries.map(
          (entry, index) => (
            <div
              key={`${entry.name}-${index}`}
              className="flex items-center justify-between text-sm"
            >
              <span>
                {entry.name}
              </span>

              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {entry.value}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setCustomEntries(
                      (prev) =>
                        prev.filter(
                          (_, j) =>
                            j !== index
                        )
                    )
                  }
                  className="text-destructive hover:text-destructive/80"
                  aria-label={`Remove ${entry.name}`}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        )}
      </div>

      <Button
        className="w-full h-12 font-heading font-semibold"
        onClick={saveBaseline}
        disabled={saving}
      >
        {saving
          ? 'Saving...'
          : 'Save My Baseline'}
      </Button>
    </div>
  );
}

// ─── Post Workout Checkin ──────────────────────────────
function PostWorkoutCheckin({
  log,
  onSave,
  canAdjust,
  program,
  onProgramUpdated,
}) {
  const [checkin, setCheckin] =
    useState('');

  const [aiNote, setAiNote] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [done, setDone] =
    useState(false);

  const submit = async () => {
    if (!checkin.trim() || loading) {
      return;
    }

    setLoading(true);

    try {
      const exerciseSummary = (
        log?.exercises_completed || []
      )
        .map(
          (exercise) =>
            `${exercise.name}: ${exercise.sets_completed} sets, ${exercise.reps_achieved} reps`
        )
        .join('\n');

      /*
       * ELITE ONLY:
       *
       * Elite gets the actual dynamic adjustment capability.
       * This is the only branch allowed to modify the program.
       */
      if (canAdjust && program) {
        const currentWeek =
          Number(program.current_week) ||
          1;

        const nextMicrocycle =
          program.microcycles?.find(
            (microcycle) =>
              Number(
                microcycle.week_number
              ) ===
              currentWeek + 1
          ) || null;

        const trainingType =
          program?.training_type ||
          'calisthenics';

        const typeLabel = {
          calisthenics:
            'calisthenics',
          weighted_calisthenics:
            'weighted calisthenics',
          weights:
            'weight training',
          hybrid:
            'hybrid training',
        }[trainingType];

        const targetDay =
          nextMicrocycle?.days?.find(
            (candidate) =>
              candidate.day_name ===
              log?.day_name
          ) ||
          nextMicrocycle?.days?.[0] ||
          null;

        const elitePrompt = `You are Kael, an elite ${typeLabel} coach. An athlete just finished a workout and gave you feedback.

POST-WORKOUT FEEDBACK:
"${checkin}"

EXERCISES COMPLETED TODAY:
${exerciseSummary}

CURRENT WEEK:
${currentWeek}

NEXT WEEK'S PROGRAM TO ADJUST:
${
  targetDay
    ? JSON.stringify(
        targetDay,
        null,
        2
      )
    : 'No next week programmed yet.'
}

Based on the athlete's feedback AND their actual reps/sets completed today:

1. Give a 1-2 sentence direct human response.
2. If performance was strong, recommend specific progression.
3. If performance was poor or they felt pain/fatigue, recommend an appropriate reduction.
4. Return the adjusted exercises array for the next week's same day.
5. Do not invent exercises that conflict with the athlete's training type.
6. Preserve useful notes and rest periods unless there is a reason to change them.
7. Never claim a change was made unless the adjusted_exercises array contains it.

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
}`;

        const result =
          await supabaseApi.ai.invoke({
            type: 'live_workout',
            prompt: elitePrompt,
            response_json_schema: {
              type: 'object',
              properties: {
                coach_response: {
                  type: 'string',
                },
                adjustments_summary: {
                  type: 'string',
                },
                adjusted_exercises: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: {
                        type: 'string',
                      },
                      sets: {
                        type: 'number',
                      },
                      reps: {
                        type: 'string',
                      },
                      rest_seconds: {
                        type: 'number',
                      },
                      notes: {
                        type: 'string',
                      },
                    },
                    required: [
                      'name',
                      'sets',
                      'reps',
                      'rest_seconds',
                      'notes',
                    ],
                  },
                },
              },
              required: [
                'coach_response',
                'adjustments_summary',
                'adjusted_exercises',
              ],
            },
          });

        const adjustedExercises =
          Array.isArray(
            result?.adjusted_exercises
          )
            ? result.adjusted_exercises
            : [];

        const note =
          `${result?.coach_response || 'Workout feedback received.'}\n\n` +
          `📋 Next workout adjusted: ${
            result?.adjustments_summary ||
            'No specific adjustment was necessary.'
          }`;

        setAiNote(note);

        await onSave(
          checkin,
          note
        );

        /*
         * Only Elite can write dynamic workout
         * changes back into the program.
         */
        if (
          nextMicrocycle &&
          targetDay &&
          adjustedExercises.length > 0 &&
          onProgramUpdated
        ) {
          const updatedMicrocycles =
            (
              program.microcycles ||
              []
            ).map((microcycle) => {
              if (
                Number(
                  microcycle.week_number
                ) !==
                currentWeek + 1
              ) {
                return microcycle;
              }

              const updatedDays = (
                microcycle.days ||
                []
              ).map((candidate) => {
                if (
                  candidate.day_name ===
                  targetDay.day_name
                ) {
                  return {
                    ...candidate,
                    exercises:
                      adjustedExercises,
                  };
                }

                return candidate;
              });

              return {
                ...microcycle,
                days: updatedDays,
              };
            });

          await supabaseApi.entities.WorkoutProgram.update(
            program.id,
            {
              microcycles:
                updatedMicrocycles,
            }
          );

          onProgramUpdated();
        }
      } else {
        /*
         * FREE:
         *
         * Basic workout tracking remains free.
         * A free user can save feedback, but this branch
         * NEVER requests or applies an AI workout adjustment.
         */
        const feedbackNote =
          'Workout feedback saved. Elite members get real-time workout adjustments from Kael.';

        setAiNote(feedbackNote);

        await onSave(
          checkin,
          feedbackNote
        );
      }

      setDone(true);
    } catch (error) {
      console.error(
        '[LiveWorkout] Post-workout check-in failed:',
        error
      );

      toast.error(
        error?.message ||
          'Unable to save your workout feedback.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <Card className="p-4 border-accent/30 bg-accent/5">
        <p className="text-xs font-bold text-accent uppercase tracking-wider mb-2">
          {canAdjust
            ? 'Kael adjusted your workout'
            : 'Workout feedback saved'}
        </p>

        <p className="text-sm whitespace-pre-line">
          {aiNote}
        </p>

        {!canAdjust && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-muted/50 border border-border p-3">
            <Lock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />

            <p className="text-xs text-muted-foreground">
              Elite members get real-time workout
              adjustments based on performance and
              post-workout feedback.
            </p>
          </div>
        )}
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

        {canAdjust && (
          <Badge className="ml-auto bg-chart-4/15 text-chart-4 border-0 text-[10px]">
            Elite
          </Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {canAdjust
          ? 'Tell Kael how it went. Your feedback and actual performance can be used to adjust your next workout.'
          : 'Save how the workout felt so you have a record of your training. Elite members get real-time workout adjustments from Kael.'}
      </p>

      <Textarea
        value={checkin}
        onChange={(e) =>
          setCheckin(e.target.value)
        }
        placeholder='e.g. "Pull-ups felt strong today. The last set was tough but I had another rep in me."'
        className="min-h-[100px] text-sm resize-none"
      />

      <Button
        className="w-full h-11 font-heading font-semibold"
        onClick={submit}
        disabled={
          !checkin.trim() ||
          loading
        }
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            {canAdjust
              ? "Getting Kael's take..."
              : 'Saving feedback...'}
          </span>
        ) : canAdjust ? (
          'Send to Kael'
        ) : (
          'Save Feedback'
        )}
      </Button>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────
export default function LiveWorkout() {
  const navigate = useNavigate();
  const queryClient =
    useQueryClient();

  const {
    seconds,
    running,
    setRunning,
    fmt,
  } = useTimer();

  const [user, setUser] =
    useState(null);

  const [dayIndex, setDayIndex] =
    useState(0);

  const [exIndex, setExIndex] =
    useState(0);

  const [setIndex, setSetIndex] =
    useState(0);

  const [resting, setResting] =
    useState(false);

  const [
    completedSets,
    setCompletedSets,
  ] = useState({});

  const [
    repsAchieved,
    setRepsAchieved,
  ] = useState({});

  const [started, setStarted] =
    useState(false);

  const [
    workoutDone,
    setWorkoutDone,
  ] = useState(false);

  const [savedLog, setSavedLog] =
    useState(null);

  useEffect(() => {
    supabaseApi.auth
      .me()
      .then(setUser)
      .catch((error) => {
        console.error(
          '[LiveWorkout] Failed to load user:',
          error
        );
      });
  }, []);

  // iOS back gesture: when workout is done, back navigates to program page
  useEffect(() => {
    if (!workoutDone) return;

    window.history.pushState(
      { workoutDone },
      ''
    );

    const handler = () =>
      navigate('/program');

    window.addEventListener(
      'popstate',
      handler
    );

    return () =>
      window.removeEventListener(
        'popstate',
        handler
      );
  }, [workoutDone, navigate]);

  const {
    data: programs = [],
  } = useQuery({
    queryKey: ['programs'],
    queryFn: () =>
      supabaseApi.entities.WorkoutProgram.filter(
        { status: 'active' },
        '-created_date',
        1
      ),
  });

  const logMutation =
    useMutation({
      mutationFn: (data) =>
        supabaseApi.entities.WorkoutLog.create(
          data
        ),

      onMutate: async (data) => {
        await queryClient.cancelQueries({
          queryKey: ['logs'],
        });

        const previous =
          queryClient.getQueryData([
            'logs',
          ]);

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

        return {
          previous,
        };
      },

      onError: (
        _error,
        _data,
        context
      ) => {
        if (context?.previous) {
          queryClient.setQueryData(
            ['logs'],
            context.previous
          );
        }
      },

      onSuccess: (log) => {
        queryClient.invalidateQueries({
          queryKey: ['logs'],
        });

        setSavedLog(log);
      },
    });

  const updateLogMutation =
    useMutation({
      mutationFn: ({
        id,
        data,
      }) =>
        supabaseApi.entities.WorkoutLog.update(
          id,
          data
        ),

      onMutate: async ({
        id,
        data,
      }) => {
        await queryClient.cancelQueries({
          queryKey: ['logs'],
        });

        const previous =
          queryClient.getQueryData([
            'logs',
          ]);

        queryClient.setQueryData(
          ['logs'],
          (old) =>
            (old || []).map(
              (log) =>
                log.id === id
                  ? {
                      ...log,
                      ...data,
                    }
                  : log
            )
        );

        return {
          previous,
        };
      },

      onError: (
        _error,
        _variables,
        context
      ) => {
        if (context?.previous) {
          queryClient.setQueryData(
            ['logs'],
            context.previous
          );
        }
      },

      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['logs'],
        });
      },
    });

  const program =
    programs[0];

  const currentWeekNum =
    Number(program?.current_week) ||
    1;

  const microcycle =
    program?.microcycles?.find(
      (microcycleItem) =>
        Number(
          microcycleItem.week_number
        ) === currentWeekNum
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
    Number(exercise?.sets) || 1;

  const restSecs =
    Number(
      exercise?.rest_seconds
    ) || 60;

  /*
   * IMPORTANT:
   *
   * The tracker itself is intentionally NOT gated.
   * Every subscription plan can:
   * - start workouts
   * - track sets
   * - track reps
   * - use the timer
   * - save workout logs
   * - view My Maxes
   *
   * Only the dynamic adjustment feature is gated.
   */
  const canAdjust = canAccess(
    user?.subscription_plan,
    'live_workout_adjustments'
  );

  const markSet = () => {
    const key = `${exIndex}-${setIndex}`;

    setCompletedSets(
      (previous) => ({
        ...previous,
        [key]: true,
      })
    );

    if (
      setIndex + 1 <
      totalSets
    ) {
      setResting(true);
      return;
    }

    if (
      exIndex + 1 <
      exercises.length
    ) {
      setExIndex(
        (index) => index + 1
      );

      setSetIndex(0);

      toast.success(
        'Next exercise! 🔥'
      );

      return;
    }

    finishWorkout();
  };

  const afterRest = () => {
    setResting(false);

    setSetIndex(
      (index) => index + 1
    );
  };

  const finishWorkout = () => {
    if (workoutDone) return;

    setRunning(false);
    setWorkoutDone(true);

    const exercisesCompleted =
      exercises.map(
        (exerciseItem, exerciseItemIndex) => ({
          name: exerciseItem.name,

          sets_completed:
            Array.from({
              length:
                Number(
                  exerciseItem.sets
                ) || 1,
            }).filter(
              (_, setItemIndex) =>
                completedSets[
                  `${exerciseItemIndex}-${setItemIndex}`
                ]
            ).length,

          reps_achieved:
            repsAchieved[
              exerciseItemIndex
            ] ||
            exerciseItem.reps,

          notes: '',
        })
      );

    logMutation.mutate({
      program_id:
        program?.id,

      date: new Date()
        .toISOString()
        .split('T')[0],

      week_number:
        currentWeekNum,

      day_name:
        day?.day_name,

      exercises_completed:
        exercisesCompleted,

      duration_minutes:
        Math.round(
          seconds / 60
        ),
    });

    toast.success(
      'Workout done! Amazing work. 💪'
    );
  };

  if (
    !program ||
    days.length === 0
  ) {
    return (
      <div className="px-5 pt-12 pb-24 text-center">
        <Dumbbell className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />

        <p className="text-muted-foreground text-sm">
          No active program. Complete onboarding first.
        </p>

        <Button
          className="mt-4"
          onClick={() =>
            navigate(
              '/onboarding'
            )
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

        {/* ── WORKOUT TAB ── */}
        <TabsContent
          value="workout"
          className="flex-1 px-5 py-4 space-y-4 overflow-y-auto safe-bottom"
        >
          {/* Day selector */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((currentDay, index) => (
              <button
                type="button"
                key={index}
                onClick={() => {
                  if (!started) {
                    setDayIndex(index);
                    setExIndex(0);
                    setSetIndex(0);
                    setResting(false);
                  }
                }}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all flex-shrink-0',
                  index === dayIndex
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card border-border text-muted-foreground'
                )}
              >
                {currentDay.day_name}
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
                  canAdjust={canAdjust}
                  program={program}
                  onProgramUpdated={() =>
                    queryClient.invalidateQueries(
                      {
                        queryKey: [
                          'programs',
                        ],
                      }
                    )
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
          {!started &&
            !workoutDone && (
              <Card className="p-6 text-center">
                <Dumbbell className="w-10 h-10 mx-auto mb-3 text-primary" />

                <h2 className="font-heading font-bold text-lg mb-1">
                  {day?.day_name}
                </h2>

                <p className="text-sm text-muted-foreground mb-1">
                  {day?.workout_type}
                </p>

                <p className="text-xs text-muted-foreground mb-2">
                  {exercises.length}{' '}
                  exercises
                </p>

                {exercises
                  .slice(0, 3)
                  .map(
                    (
                      exerciseItem,
                      index
                    ) => (
                      <p
                        key={index}
                        className="text-xs text-muted-foreground"
                      >
                        {exerciseItem.name}{' '}
                        —{' '}
                        {
                          exerciseItem.sets
                        }
                        ×
                        {
                          exerciseItem.reps
                        }
                      </p>
                    )
                  )}

                {exercises.length >
                  3 && (
                  <p className="text-xs text-muted-foreground">
                    +
                    {exercises.length -
                      3}{' '}
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
            exercise &&
            !resting && (
              <Card className="p-5 border-2 border-primary/30">
                <div className="flex items-center justify-between mb-1">
                  <Badge className="bg-primary/15 text-primary border-0 text-xs">
                    Exercise{' '}
                    {exIndex + 1} of{' '}
                    {exercises.length}
                  </Badge>

                  <Badge className="bg-muted text-muted-foreground border-0 text-xs">
                    Set{' '}
                    {setIndex + 1} of{' '}
                    {totalSets}
                  </Badge>
                </div>

                <h2 className="font-heading font-bold text-xl mt-2 mb-1">
                  {exercise.name}
                </h2>

                <p className="text-sm text-muted-foreground mb-1">
                  Target:{' '}
                  {exercise.reps}{' '}
                  reps ·{' '}
                  {restSecs}s rest
                </p>

                {exercise.notes && (
                  <p className="text-xs text-muted-foreground italic mb-3">
                    "{exercise.notes}"
                  </p>
                )}

                {exercise.activation_cue && (
                  <div className="flex items-start gap-2 mb-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                    <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />

                    <div>
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">
                        Activation Cue
                      </p>

                      <p className="text-xs text-foreground leading-relaxed">
                        {
                          exercise.activation_cue
                        }
                      </p>
                    </div>
                  </div>
                )}

                {/* Actual reps input */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    Actual reps:
                  </span>

                  <Input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    placeholder={
                      exercise.reps
                    }
                    className="h-9 text-sm w-24"
                    value={
                      repsAchieved[
                        exIndex
                      ] || ''
                    }
                    onChange={(e) =>
                      setRepsAchieved(
                        (previous) => ({
                          ...previous,
                          [exIndex]:
                            e.target.value,
                        })
                      )
                    }
                  />
                </div>

                <div className="flex gap-2 mb-5">
                  {Array.from({
                    length: totalSets,
                  }).map(
                    (_, setItemIndex) => {
                      const key = `${exIndex}-${setItemIndex}`;

                      const done =
                        !!completedSets[
                          key
                        ];

                      const current =
                        setItemIndex ===
                        setIndex;

                      return (
                        <div
                          key={
                            setItemIndex
                          }
                          className={cn(
                            'w-9 h-9 rounded-xl flex items-center justify-center border-2 text-xs font-bold transition-all',
                            done
                              ? 'bg-accent border-accent text-accent-foreground'
                              : current
                              ? 'border-primary text-primary'
                              : 'border-border text-muted-foreground'
                          )}
                        >
                          {done ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            setItemIndex +
                            1
                          )}
                        </div>
                      );
                    }
                  )}
                </div>

                <Button
                  className="w-full h-12 font-heading font-semibold text-base"
                  onClick={markSet}
                >
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Complete Set{' '}
                  {setIndex + 1}
                </Button>
              </Card>
            )}

          {/* Rest timer */}
          {started &&
            !workoutDone &&
            resting && (
              <Card className="p-5">
                <RestTimer
                  seconds={restSecs}
                  onDone={afterRest}
                />
              </Card>
            )}

          {/* Exercise list */}
          {started &&
            !workoutDone && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  All Exercises
                </p>

                {exercises.map(
                  (
                    exerciseItem,
                    index
                  ) => {
                    const allDone =
                      Array.from({
                        length:
                          Number(
                            exerciseItem.sets
                          ) || 1,
                      }).every(
                        (_, setItemIndex) =>
                          completedSets[
                            `${index}-${setItemIndex}`
                          ]
                      );

                    return (
                      <div
                        key={index}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-xl border transition-all',
                          index ===
                            exIndex
                            ? 'border-primary bg-primary/5'
                            : allDone
                            ? 'border-accent/30 bg-accent/5'
                            : 'border-border bg-card'
                        )}
                      >
                        {allDone ? (
                          <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                        ) : index ===
                          exIndex ? (
                          <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 animate-pulse ml-1" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        )}

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {
                              exerciseItem.name
                            }
                          </p>

                          <p className="text-xs text-muted-foreground">
                            {
                              exerciseItem.sets
                            }
                            ×
                            {
                              exerciseItem.reps
                            }
                          </p>

                          {exerciseItem.activation_cue && (
                            <p className="text-[10px] text-primary/70 truncate mt-0.5">
                              {
                                exerciseItem.activation_cue
                              }
                            </p>
                          )}
                        </div>

                        {index ===
                          exIndex &&
                          !allDone && (
                            <SkipForward
                              className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground"
                              onClick={() => {
                                setExIndex(
                                  index +
                                    1 <
                                    exercises.length
                                    ? index +
                                      1
                                    : index
                                );

                                setSetIndex(
                                  0
                                );

                                setResting(
                                  false
                                );
                              }}
                            />
                          )}
                      </div>
                    );
                  }
                )}

                <Button
                  variant="outline"
                  className="w-full mt-2"
                  onClick={finishWorkout}
                >
                  Finish Workout Early
                </Button>
              </div>
            )}
        </TabsContent>

        {/* ── BASELINE TAB ── */}
        <TabsContent
          value="baseline"
          className="flex-1 px-5 py-4 overflow-y-auto safe-bottom"
        >
          <h2 className="font-heading font-bold text-lg mb-1">
            My Current Maxes
          </h2>

          <MovementBaseline
            trainingType={
              program?.training_type
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
