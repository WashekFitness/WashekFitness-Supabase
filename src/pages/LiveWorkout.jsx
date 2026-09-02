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
  RotateCcw,
  Lock,
  MessageSquare,
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
      ref.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      clearInterval(ref.current);
    }

    return () => clearInterval(ref.current);
  }, [running]);

  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return { seconds, running, setRunning, fmt };
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
  }, []);

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
  return tt === 'weighted_calisthenics' || tt === 'hybrid';
}

function MovementInput({ label, unit, value, onChange }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3">
      <p className="text-xs text-muted-foreground mb-1">
        {label}
      </p>

      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
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

  const today = new Date().toISOString().split('T')[0];

  const [values, setValues] = useState({});
  const [customEntries, setCustomEntries] = useState([]);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomVal, setNewCustomVal] = useState('');
  const [saving, setSaving] = useState(false);

  const showCalisthenics = baselineHasCalisthenics(trainingType);
  const showWeights = baselineHasWeights(trainingType);
  const showWeightedCali = baselineHasWeightedCali(trainingType);

  const weightUnit =
    settings?.unit === 'metric' ? 'kg' : 'lbs';

  const { data: baselines = [] } = useQuery({
    queryKey: ['baselines'],
    queryFn: () =>
      supabaseApi.entities.MovementBaseline.list(
        '-recorded_date',
        1
      ),
  });

  useEffect(() => {
    if (baselines[0]) {
      const b = baselines[0];
      const v = {};

      ALL_BASELINE_MOVEMENTS.forEach(m => {
        if (b[m.key] != null) {
          v[m.key] = b[m.key];
        }
      });

      setValues(v);

      if (b.custom_entries) {
        setCustomEntries(
          Array.isArray(b.custom_entries)
            ? b.custom_entries
            : []
        );
      }
    }
  }, [baselines]);

  const updateValue = (key, value) => {
    setValues(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const addCustom = () => {
    const name = newCustomName.trim();

    if (!name || !newCustomVal) {
      return;
    }

    setCustomEntries(prev => [
      ...prev,
      {
        name,
        value: Number(newCustomVal),
      },
    ]);

    setNewCustomName('');
    setNewCustomVal('');
  };

  const removeCustom = index => {
    setCustomEntries(prev =>
      prev.filter((_, i) => i !== index)
    );
  };

  const saveBaseline = async () => {
    setSaving(true);

    try {
      const payload = {
        recorded_date: today,
        training_type: trainingType,
        custom_entries: customEntries,
      };

      ALL_BASELINE_MOVEMENTS.forEach(m => {
        if (values[m.key] !== undefined && values[m.key] !== '') {
          payload[m.key] = Number(values[m.key]);
        }
      });

      const existing = baselines[0];

      if (existing?.id) {
        await supabaseApi.entities.MovementBaseline.update(
          existing.id,
          payload
        );
      } else {
        await supabaseApi.entities.MovementBaseline.create(
          payload
        );
      }

      await queryClient.invalidateQueries({
        queryKey: ['baselines'],
      });

      toast.success('Movement baseline saved.');
    } catch (error) {
      console.error(
        'Failed to save movement baseline:',
        error
      );

      toast.error(
        error?.message ||
          'Could not save movement baseline.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4 md:p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="font-heading font-bold text-lg">
            Movement Baseline
          </h2>

          <p className="text-sm text-muted-foreground mt-1">
            Record your current numbers so Kael can use them
            when evaluating progression.
          </p>
        </div>

        <Badge variant="outline">
          Baseline
        </Badge>
      </div>

      {showCalisthenics && (
        <div className="mb-6">
          <h3 className="font-semibold text-sm mb-3">
            Calisthenics
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {CALISTHENICS_MOVEMENTS.map(m => (
              <MovementInput
                key={m.key}
                label={m.label}
                unit={m.unit}
                value={values[m.key]}
                onChange={value =>
                  updateValue(m.key, value)
                }
              />
            ))}
          </div>
        </div>
      )}

      {showWeights && (
        <div className="mb-6">
          <h3 className="font-semibold text-sm mb-3">
            Weight Training
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {WEIGHT_MOVEMENTS.map(m => (
              <MovementInput
                key={m.key}
                label={m.label}
                unit={weightUnit}
                value={values[m.key]}
                onChange={value =>
                  updateValue(m.key, value)
                }
              />
            ))}
          </div>
        </div>
      )}

      {showWeightedCali && (
        <div className="mb-6">
          <h3 className="font-semibold text-sm mb-3">
            Weighted Calisthenics
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {WEIGHTED_CALI_MOVEMENTS.map(m => (
              <MovementInput
                key={m.key}
                label={m.label}
                unit={weightUnit}
                value={values[m.key]}
                onChange={value =>
                  updateValue(m.key, value)
                }
              />
            ))}
          </div>
        </div>
      )}

      <div className="mb-6">
        <h3 className="font-semibold text-sm mb-3">
          Custom Movements
        </h3>

        {customEntries.length > 0 && (
          <div className="space-y-2 mb-3">
            {customEntries.map((entry, index) => (
              <div
                key={`${entry.name}-${index}`}
                className="flex items-center justify-between gap-3 border border-border rounded-xl p-3"
              >
                <div>
                  <p className="font-medium text-sm">
                    {entry.name}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {entry.value}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    removeCustom(index)
                  }
                >
                  <Minus className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-[1fr_120px_auto] gap-2">
          <Input
            value={newCustomName}
            onChange={e =>
              setNewCustomName(e.target.value)
            }
            placeholder="Movement"
          />

          <Input
            type="number"
            value={newCustomVal}
            onChange={e =>
              setNewCustomVal(e.target.value)
            }
            placeholder="Value"
          />

          <Button
            type="button"
            variant="outline"
            onClick={addCustom}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Button
        onClick={saveBaseline}
        disabled={saving}
        className="w-full"
      >
        {saving
          ? 'Saving...'
          : 'Save Movement Baseline'}
      </Button>
    </Card>
  );
}

// ─── Exercise Card ──────────────────────────────────────
function ExerciseCard({
  exercise,
  index,
  completedSets,
  currentSet,
  onCompleteSet,
  onUndoSet,
  onRequestAdjustment,
  canAdjust,
  adjusted,
}) {
  const completed =
    completedSets?.length || 0;

  const totalSets =
    Math.max(
      1,
      Number(exercise?.sets) || 1
    );

  const isComplete =
    completed >= totalSets;

  return (
    <Card className="overflow-hidden">
      <div className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary">
                {index + 1}
              </Badge>

              {adjusted && (
                <Badge className="gap-1">
                  <Sparkles className="w-3 h-3" />
                  Adjusted
                </Badge>
              )}
            </div>

            <h3 className="font-heading font-bold text-lg truncate">
              {exercise?.name || 'Exercise'}
            </h3>

            <p className="text-sm text-muted-foreground mt-1">
              {exercise?.sets || 1} sets ×{' '}
              {exercise?.reps || '—'}
            </p>
          </div>

          <Dumbbell className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        </div>

        {exercise?.notes && (
          <div className="mt-4 rounded-xl bg-muted/50 p-3">
            <p className="text-sm">
              {exercise.notes}
            </p>
          </div>
        )}

        {exercise?.activation_cue && (
          <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
              Activation Cue
            </p>

            <p className="text-sm">
              {exercise.activation_cue}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 mt-5">
          {Array.from({
            length: totalSets,
          }).map((_, setNumber) => {
            const done =
              setNumber <
              completed;

            const active =
              setNumber ===
              currentSet &&
              !done;

            return (
              <button
                key={setNumber}
                type="button"
                onClick={() =>
                  done
                    ? onUndoSet(setNumber)
                    : onCompleteSet(setNumber)
                }
                className={cn(
                  'flex-1 h-12 rounded-xl border flex items-center justify-center transition',
                  done &&
                    'bg-primary text-primary-foreground border-primary',
                  active &&
                    !done &&
                    'border-primary text-primary',
                  !done &&
                    !active &&
                    'border-border text-muted-foreground'
                )}
              >
                {done ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <span className="font-semibold text-sm">
                    Set {setNumber + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            className="flex-1"
            onClick={() =>
              onCompleteSet(currentSet)
            }
            disabled={
              isComplete ||
              currentSet >= totalSets
            }
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Complete Set
          </Button>

          <Button
            variant="outline"
            onClick={() =>
              onUndoSet(
                Math.max(
                  0,
                  completed - 1
                )
              )
            }
            disabled={completed === 0}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        <div className="mt-4">
          {canAdjust ? (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={onRequestAdjustment}
            >
              <Sparkles className="w-4 h-4" />
              Adjust With Kael
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full gap-2"
              disabled
            >
              <Lock className="w-4 h-4" />
              Elite Adjustment
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Live Adjustment Panel ─────────────────────────────
function LiveAdjustmentPanel({
  exercise,
  exerciseIndex,
  setIndex,
  totalSets,
  completedCount,
  repsAchieved,
  seconds,
  trainingType,
  feedback,
  setFeedback,
  loading,
  setLoading,
  lastAdjustment,
  setLastAdjustment,
  applyAdjustment,
  disabled,
}) {
  const requestAdjustment = async () => {
    if (!exercise || loading || disabled) return;

    setLoading(true);
    setLastAdjustment('');

    try {
      const typeLabel = {
        calisthenics: 'calisthenics',
        weighted_calisthenics: 'weighted calisthenics',
        weights: 'weight training',
        hybrid: 'hybrid training',
      }[trainingType] || 'fitness';

      const prompt = `You are Kael, an elite ${typeLabel} coach providing REAL-TIME coaching during an active workout.

The athlete is currently performing:
${JSON.stringify(exercise, null, 2)}

CURRENT POSITION:
- Exercise number: ${exerciseIndex + 1}
- Current set: ${setIndex + 1} of ${totalSets}
- Sets already completed for this exercise: ${completedCount}
- Actual reps recorded so far: ${repsAchieved || 'not entered'}
- Workout time elapsed: ${Math.floor(seconds / 60)} minutes
- Athlete feedback: "${feedback.trim() || 'No written feedback. Assess the current programmed exercise and provide the most appropriate next-step adjustment.'}"

Your job is to make an immediate, practical adjustment to THIS exercise for the sets the athlete has not completed yet.

RULES:
1. Do not change completed sets.
2. Preserve the movement's purpose unless the athlete's feedback indicates that a substitution is necessary.
3. If the exercise feels too easy and performance is strong, increase the challenge appropriately through reps, sets, load, tempo, or a harder variation.
4. If the exercise feels too hard, fatigue is accumulating, technique is breaking down, or the athlete reports pain/tightness, reduce the training demand or substitute a safer appropriate variation.
5. Do not encourage training through significant pain.
6. Do not diagnose injuries or medical conditions.
7. Keep the adjustment realistic for the athlete's training type.
8. If the athlete reports concerning symptoms, prioritize stopping the movement and seeking appropriate medical evaluation.
9. Do not make dramatic changes without a reason.
10. The adjusted sets must be at least the number of sets already completed so the tracker remains consistent.
11. Give a concise explanation of exactly what changed and why.
12. Preserve the activation cue whenever possible, but improve it if the current cue is not useful.

Return ONLY JSON:
{
  "adjusted_exercise": {
    "name": "string",
    "sets": number,
    "reps": "string",
    "rest_seconds": number,
    "notes": "string",
    "activation_cue": "string"
  },
  "adjustment_summary": "short explanation",
  "safety_note": "short safety note or empty string"
}`;

      const result = await supabaseApi.ai.invoke({
        type: 'live_workout_adjustment',
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            adjusted_exercise: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                sets: { type: 'number' },
                reps: { type: 'string' },
                rest_seconds: { type: 'number' },
                notes: { type: 'string' },
                activation_cue: { type: 'string' },
              },
              required: [
                'name',
                'sets',
                'reps',
                'rest_seconds',
                'notes',
                'activation_cue',
              ],
            },
            adjustment_summary: {
              type: 'string',
            },
            safety_note: {
              type: 'string',
            },
          },
          required: [
            'adjusted_exercise',
            'adjustment_summary',
            'safety_note',
          ],
        },
      });

      if (!result?.adjusted_exercise) {
        throw new Error(
          'Kael did not return a valid adjustment.'
        );
      }

      const adjusted = {
        ...exercise,
        ...result.adjusted_exercise,
        sets: Math.max(
          completedCount,
          Number(result.adjusted_exercise.sets) ||
            totalSets
        ),
      };

      applyAdjustment(adjusted);

      const summary =
        result.adjustment_summary ||
        'Kael adjusted the exercise based on your current performance.';

      const safety =
        result.safety_note;

      setLastAdjustment(
        safety
          ? `${summary} ${safety}`
          : summary
      );
    } catch (error) {
      console.error(
        'Live workout adjustment failed:',
        error
      );

      toast.error(
        error?.message ||
          'Could not adjust this exercise.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />

            <h3 className="font-semibold">
              Live Kael Adjustment
            </h3>
          </div>

          <p className="text-xs text-muted-foreground mt-1">
            Elite can adapt the current exercise while you
            train.
          </p>
        </div>

        {!disabled && (
          <Badge>
            Elite
          </Badge>
        )}
      </div>

      <Textarea
        value={feedback}
        onChange={e =>
          setFeedback(e.target.value)
        }
        placeholder="How does this set feel? Too easy, too hard, fatigue, technique issue, pain, etc."
        className="min-h-[90px]"
        disabled={loading || disabled}
      />

      <Button
        className="w-full mt-3"
        onClick={requestAdjustment}
        disabled={
          loading ||
          disabled ||
          !exercise
        }
      >
        <Zap className="w-4 h-4 mr-2" />

        {loading
          ? 'Kael is adjusting...'
          : 'Adjust This Exercise'}
      </Button>

      {lastAdjustment && (
        <div className="mt-4 rounded-xl bg-primary/5 border border-primary/20 p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
            Kael
          </p>

          <p className="text-sm">
            {lastAdjustment}
          </p>
        </div>
      )}
    </Card>
  );
}

// ─── Workout Check-In ──────────────────────────────────
function WorkoutCheckIn({
  log,
  exerciseSummary,
  program,
  onSave,
}) {
  const [checkin, setCheckin] = useState('');
  const [aiNote, setAiNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const currentWeek =
    program?.current_week || 1;

  const nextMicrocycle =
    program?.microcycles?.find(
      m =>
        m.week_number ===
        currentWeek + 1
    );

  const submit = async () => {
    if (!checkin.trim() || loading) {
      return;
    }

    setLoading(true);

    try {
      const elitePrompt = `You are Kael, the athlete's coach.

The athlete just finished this workout and provided feedback.

ATHLETE CHECK-IN:
"${checkin}"

EXERCISES COMPLETED TODAY:
${exerciseSummary}

CURRENT WEEK:
${currentWeek}

NEXT WEEK'S PROGRAM TO ADJUST:
${
  nextMicrocycle
    ? JSON.stringify(
        nextMicrocycle.days?.find(
          d => d.day_name === log?.day_name
        ) ||
          nextMicrocycle.days?.[0],
        null,
        2
      )
    : 'No next week programmed yet.'
}

Based on the athlete's feedback AND their actual reps/sets completed today:

1. Give a 1-2 sentence direct human response.
2. If performance was strong, recommend specific progressions for next week.
3. If performance was poor, fatigue was high, or pain was reported, reduce training stress appropriately.
4. Return the adjusted exercises array for next week's same day.
5. Preserve activation cues and useful coaching notes.
6. Do not diagnose injuries or medical conditions.

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
      "notes": "...",
      "activation_cue": "..."
    }
  ]
}`;

      const result = await supabaseApi.ai.invoke({
        type: 'live_workout_adjustment',
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
                  activation_cue: {
                    type: 'string',
                  },
                },
                required: [
                  'name',
                  'sets',
                  'reps',
                  'rest_seconds',
                  'notes',
                  'activation_cue',
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

      setAiNote(
        result?.coach_response ||
          ''
      );

      /*
       * Save the athlete's feedback and Kael's response.
       *
       * If a next-week program exists, apply the returned
       * adjusted exercises to the matching day.
       */
      if (
        result?.adjusted_exercises?.length &&
        nextMicrocycle
      ) {
        const updatedMicrocycles =
          program.microcycles.map(
            microcycle => {
              if (
                microcycle.week_number !==
                currentWeek + 1
              ) {
                return microcycle;
              }

              return {
                ...microcycle,
                days:
                  microcycle.days?.map(
                    d => {
                      if (
                        d.day_name !==
                        log?.day_name
                      ) {
                        return d;
                      }

                      return {
                        ...d,
                        exercises:
                          result.adjusted_exercises,
                      };
                    }
                  ),
              };
            }
          );

        await supabaseApi.entities.Program.update(
          program.id,
          {
            microcycles:
              updatedMicrocycles,
          }
        );

        if (onSave) {
          await onSave(
            checkin,
            result.coach_response,
            updatedMicrocycles
          );
        }
      } else if (onSave) {
        await onSave(
          checkin,
          result?.coach_response || '',
          null
        );
      }

      setLoading(false);
      setDone(true);
    } catch (error) {
      console.error(
        'Post-workout check-in failed:',
        error
      );

      toast.error(
        error?.message ||
          'Could not get Kael’s response.'
      );

      setLoading(false);
    }
  };

  if (done) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <CheckCircle2 className="w-5 h-5 text-primary" />

          <h3 className="font-heading font-bold">
            Workout Complete
          </h3>
        </div>

        {aiNote && (
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-sm">
              {aiNote}
            </p>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare className="w-5 h-5 text-primary" />

        <h3 className="font-heading font-bold">
          Post-Workout Check-In
        </h3>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Tell Kael how the workout felt and get a concise
        coaching response.
      </p>

      <Textarea
        value={checkin}
        onChange={e =>
          setCheckin(e.target.value)
        }
        placeholder="How did the workout feel?"
        className="min-h-[110px]"
        disabled={loading}
      />

      <Button
        className="w-full mt-3"
        onClick={submit}
        disabled={
          loading ||
          !checkin.trim()
        }
      >
        <Sparkles className="w-4 h-4 mr-2" />

        {loading
          ? 'Kael is reviewing...'
          : 'Ask Kael'}
      </Button>
    </Card>
  );
}

// ─── Main Live Workout ─────────────────────────────────
export default function LiveWorkout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    settings,
  } = useAppSettings();

  const {
    seconds,
    running,
    setRunning,
    fmt,
  } = useTimer();

  const [dayIndex, setDayIndex] =
    useState(0);

  const [exIndex, setExIndex] =
    useState(0);

  const [setIndex, setSetIndex] =
    useState(0);

  const [resting, setResting] =
    useState(false);

  const [liveExercises, setLiveExercises] =
    useState([]);

  const [
    completedSets,
    setCompletedSets,
  ] = useState({});

  const [
    repsAchieved,
    setRepsAchieved,
  ] = useState('');

  const [
    feedback,
    setFeedback,
  ] = useState('');

  const [
    loadingAdjustment,
    setLoadingAdjustment,
  ] = useState(false);

  const [
    lastAdjustment,
    setLastAdjustment,
  ] = useState('');

  const [
    adjustedExerciseIndexes,
    setAdjustedExerciseIndexes,
  ] = useState({});

  const {
    data: user,
    isLoading: userLoading,
  } = useQuery({
    queryKey: ['current-user'],
    queryFn: () =>
      supabaseApi.auth.me(),
  });

  const {
    data: program,
    isLoading: programLoading,
  } = useQuery({
    queryKey: ['active-program'],
    queryFn: async () => {
      const programs =
        await supabaseApi.entities.Program.list(
          '-created_date',
          20
        );

      return (
        programs?.find(
          p =>
            p.status ===
              'active' ||
            p.is_active === true
        ) ||
        programs?.[0] ||
        null
      );
    },
  });

  const {
    data: workoutLogs = [],
  } = useQuery({
    queryKey: ['workout-logs'],
    queryFn: () =>
      supabaseApi.entities.WorkoutLog.list(
        '-created_date',
        100
      ),
  });

  const trainingType =
    program?.training_type ||
    user?.training_type ||
    'calisthenics';

  const currentWeekNum =
    program?.current_week || 1;

  const microcycle =
    program?.microcycles?.find(
      m => m.week_number === currentWeekNum
    ) ||
    program?.microcycles?.[0];

  const days = microcycle?.days || [];

  const day = days[dayIndex];

  /*
   * Whenever the selected workout day changes,
   * create a fresh local copy of its exercises.
   *
   * This means Elite can modify the current workout
   * without corrupting the saved program just by
   * pressing the adjustment button.
   */
  useEffect(() => {
    if (!day?.exercises) {
      setLiveExercises([]);
      return;
    }

    setLiveExercises(
      day.exercises.map(ex => ({
        ...ex,
      }))
    );

    setExIndex(0);
    setSetIndex(0);
    setResting(false);
    setAdjustedExerciseIndexes({});
  }, [
    currentWeekNum,
    dayIndex,
    program?.id,
  ]);

  const exercises =
    liveExercises.length > 0
      ? liveExercises
      : day?.exercises || [];

  const exercise = exercises[exIndex];

  const totalSets =
    Math.max(
      1,
      Number(exercise?.sets) || 1
    );

  const restSecs =
    Number(exercise?.rest_seconds) || 60;

  const canAdjust = canAccess(
    user?.subscription_plan,
    'live_workout_adjustments'
  );

  const applyLiveAdjustment = adjusted => {
    setLiveExercises(prev =>
      prev.map((ex, index) =>
        index === exIndex
          ? {
              ...adjusted,
            }
          : ex
      )
    );

    setAdjustedExerciseIndexes(prev => ({
      ...prev,
      [exIndex]: true,
    }));

    /*
     * If Kael changed the number of sets, make sure
     * the current set index is still valid.
     */
    const newSetCount = Math.max(
      1,
      Number(adjusted.sets) || totalSets
    );

    if (setIndex >= newSetCount) {
      setSetIndex(
        Math.max(
          0,
          newSetCount - 1
        )
      );
    }
  };

  const currentCompleted =
    completedSets[exIndex] || [];

  const completedCount =
    currentCompleted.length;

  const currentSet =
    Math.min(
      setIndex,
      Math.max(
        0,
        totalSets - 1
      )
    );

  const completeSet = setNumber => {
    if (
      !exercise ||
      currentCompleted.includes(
        setNumber
      )
    ) {
      return;
    }

    setCompletedSets(prev => ({
      ...prev,
      [exIndex]: [
        ...(prev[exIndex] || []),
        setNumber,
      ].sort(
        (a, b) => a - b
      ),
    }));

    if (
      setNumber <
      totalSets - 1
    ) {
      setSetIndex(
        setNumber + 1
      );

      setResting(true);
    } else {
      setSetIndex(
        totalSets
      );
    }
  };

  const undoSet = setNumber => {
    setCompletedSets(prev => ({
      ...prev,
      [exIndex]: (
        prev[exIndex] || []
      ).filter(
        s => s !== setNumber
      ),
    }));

    setSetIndex(
      Math.min(
        setNumber,
        Math.max(
          0,
          totalSets - 1
        )
      )
    );
  };

  const nextExercise = () => {
    if (
      exIndex <
      exercises.length - 1
    ) {
      setExIndex(
        exIndex + 1
      );

      setSetIndex(0);
      setResting(false);
      setRepsAchieved('');
      setFeedback('');
      setLastAdjustment('');
    } else {
      setRunning(false);
    }
  };

  const previousExercise = () => {
    if (exIndex > 0) {
      setExIndex(
        exIndex - 1
      );

      setSetIndex(0);
      setResting(false);
      setRepsAchieved('');
      setFeedback('');
      setLastAdjustment('');
    }
  };

  const exerciseSummary =
    exercises
      .map(
        (ex, index) => {
          const setsDone =
            (
              completedSets[index] ||
              []
            ).length;

          return `${index + 1}. ${
            ex.name
          } — ${
            setsDone
          }/${
            ex.sets || 1
          } sets completed`;
        }
      )
      .join('\n');

  const saveWorkoutLog = async (
    checkin,
    aiResponse,
    updatedMicrocycles
  ) => {
    const existing =
      workoutLogs.find(
        log =>
          log.program_id ===
            program?.id &&
          log.day_name ===
            day?.day_name &&
          log.week_number ===
            currentWeekNum
      );

    const payload = {
      program_id:
        program?.id,
      week_number:
        currentWeekNum,
      day_name:
        day?.day_name,
      training_type:
        trainingType,
      duration_seconds:
        seconds,
      completed_exercises:
        exercises.map(
          (ex, index) => ({
            ...ex,
            completed_sets:
              (
                completedSets[
                  index
                ] || []
              ).length,
          })
        ),
      checkin,
      ai_response:
        aiResponse,
      updated_microcycles:
        updatedMicrocycles,
      completed_at:
        new Date().toISOString(),
    };

    if (existing?.id) {
      await supabaseApi.entities.WorkoutLog.update(
        existing.id,
        payload
      );
    } else {
      await supabaseApi.entities.WorkoutLog.create(
        payload
      );
    }

    await queryClient.invalidateQueries({
      queryKey: ['workout-logs'],
    });
  };

  const finishWorkout = async () => {
    setRunning(false);

    try {
      const existing =
        workoutLogs.find(
          log =>
            log.program_id ===
              program?.id &&
            log.day_name ===
              day?.day_name &&
            log.week_number ===
              currentWeekNum
        );

      const payload = {
        program_id:
          program?.id,
        week_number:
          currentWeekNum,
        day_name:
          day?.day_name,
        training_type:
          trainingType,
        duration_seconds:
          seconds,
        completed_exercises:
          exercises.map(
            (ex, index) => ({
              ...ex,
              completed_sets:
                (
                  completedSets[
                    index
                  ] || []
                ).length,
            })
          ),
        completed_at:
          new Date().toISOString(),
      };

      if (existing?.id) {
        await supabaseApi.entities.WorkoutLog.update(
          existing.id,
          payload
        );
      } else {
        await supabaseApi.entities.WorkoutLog.create(
          payload
        );
      }

      await queryClient.invalidateQueries({
        queryKey: ['workout-logs'],
      });

      toast.success(
        'Workout saved.'
      );
    } catch (error) {
      console.error(
        'Failed to save workout:',
        error
      );

      toast.error(
        error?.message ||
          'Could not save workout.'
      );
    }
  };

  if (
    userLoading ||
    programLoading
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">
          Loading workout...
        </p>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <Dumbbell className="w-10 h-10 text-muted-foreground mb-4" />

        <h1 className="font-heading font-bold text-xl">
          No active program
        </h1>

        <p className="text-muted-foreground text-sm mt-2 text-center max-w-md">
          Create a program before starting a live workout.
        </p>

        <Button
          className="mt-5"
          onClick={() =>
            navigate('/program')
          }
        >
          Go to Program
        </Button>
      </div>
    );
  }

  if (!day) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <Dumbbell className="w-10 h-10 text-muted-foreground mb-4" />

        <h1 className="font-heading font-bold text-xl">
          No workout found
        </h1>

        <p className="text-muted-foreground text-sm mt-2 text-center max-w-md">
          There is no workout programmed for this day.
        </p>

        <Button
          className="mt-5"
          onClick={() =>
            navigate('/program')
          }
        >
          Back to Program
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-5 md:py-8">
        <div className="flex items-center justify-between gap-3 mb-5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              navigate(-1)
            }
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          <div className="text-center min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Week {currentWeekNum}
            </p>

            <h1 className="font-heading font-bold text-lg truncate">
              {day.day_name ||
                `Workout ${dayIndex + 1}`}
            </h1>
          </div>

          <div className="w-10" />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <Card className="p-3 text-center">
            <Timer className="w-4 h-4 mx-auto text-muted-foreground mb-1" />

            <p className="font-heading font-bold text-lg">
              {fmt(seconds)}
            </p>

            <p className="text-[11px] text-muted-foreground">
              Time
            </p>
          </Card>

          <Card className="p-3 text-center">
            <Dumbbell className="w-4 h-4 mx-auto text-muted-foreground mb-1" />

            <p className="font-heading font-bold text-lg">
              {exIndex + 1}/
              {exercises.length}
            </p>

            <p className="text-[11px] text-muted-foreground">
              Exercise
            </p>
          </Card>

          <Card className="p-3 text-center">
            <CheckCircle2 className="w-4 h-4 mx-auto text-muted-foreground mb-1" />

            <p className="font-heading font-bold text-lg">
              {exercises.reduce(
                (sum, _, index) =>
                  sum +
                  (
                    completedSets[
                      index
                    ] || []
                  ).length,
                0
              )}
            </p>

            <p className="text-[11px] text-muted-foreground">
              Sets
            </p>
          </Card>
        </div>

        <div className="flex items-center justify-center gap-2 mb-5">
          <Button
            variant={
              running
                ? 'default'
                : 'outline'
            }
            onClick={() =>
              setRunning(
                !running
              )
            }
          >
            <Timer className="w-4 h-4 mr-2" />

            {running
              ? 'Pause'
              : 'Start Timer'}
          </Button>

          {running && (
            <Button
              variant="outline"
              onClick={() =>
                setRunning(false)
              }
            >
              Pause
            </Button>
          )}
        </div>

        {days.length > 1 && (
          <div className="mb-5">
            <Tabs
              value={String(
                dayIndex
              )}
              onValueChange={value => {
                setDayIndex(
                  Number(value)
                );
              }}
            >
              <TabsList className="w-full overflow-x-auto justify-start">
                {days.map(
                  (d, index) => (
                    <TabsTrigger
                      key={`${d.day_name}-${index}`}
                      value={String(
                        index
                      )}
                    >
                      {d.day_name ||
                        `Day ${
                          index + 1
                        }`}
                    </TabsTrigger>
                  )
                )}
              </TabsList>
            </Tabs>
          </div>
        )}

        {resting ? (
          <Card className="mb-5">
            <RestTimer
              seconds={
                restSecs
              }
              onDone={() =>
                setResting(false)
              }
            />
          </Card>
        ) : (
          <div className="space-y-4">
            <ExerciseCard
              exercise={exercise}
              index={exIndex}
              completedSets={
                currentCompleted
              }
              currentSet={
                currentSet
              }
              onCompleteSet={
                completeSet
              }
              onUndoSet={
                undoSet
              }
              onRequestAdjustment={() => {
                if (
                  !canAdjust
                ) {
                  toast.error(
                    'Live workout adjustments are an Elite feature.'
                  );

                  return;
                }

                /*
                 * The actual server-side function ALSO checks
                 * the subscription. This frontend check is only
                 * for UX and cannot be trusted as security.
                 */
              }}
              canAdjust={
                canAdjust
              }
              adjusted={
                !!adjustedExerciseIndexes[
                  exIndex
                ]
              }
            />

            {canAdjust && (
              <LiveAdjustmentPanel
                exercise={
                  exercise
                }
                exerciseIndex={
                  exIndex
                }
                setIndex={
                  currentSet
                }
                totalSets={
                  totalSets
                }
                completedCount={
                  completedCount
                }
                repsAchieved={
                  repsAchieved
                }
                seconds={
                  seconds
                }
                trainingType={
                  trainingType
                }
                feedback={
                  feedback
                }
                setFeedback={
                  setFeedback
                }
                loading={
                  loadingAdjustment
                }
                setLoading={
                  setLoadingAdjustment
                }
                lastAdjustment={
                  lastAdjustment
                }
                setLastAdjustment={
                  setLastAdjustment
                }
                applyAdjustment={
                  applyLiveAdjustment
                }
                disabled={
                  !canAdjust
                }
              />
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={
                  previousExercise
                }
                disabled={
                  exIndex === 0
                }
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              {exIndex <
              exercises.length - 1 ? (
                <Button
                  className="flex-1"
                  onClick={
                    nextExercise
                  }
                >
                  Next
                  <SkipForward className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  className="flex-1"
                  onClick={
                    finishWorkout
                  }
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Finish Workout
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="mt-6">
          <WorkoutCheckIn
            log={{
              day_name:
                day.day_name,
            }}
            exerciseSummary={
              exerciseSummary
            }
            program={program}
            onSave={
              saveWorkoutLog
            }
          />
        </div>

        <div className="mt-6">
          <MovementBaseline
            trainingType={
              trainingType
            }
          />
        </div>
      </div>
    </div>
  );
}
