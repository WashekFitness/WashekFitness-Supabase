import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Zap,
  Layers,
  TrendingDown,
  Target,
  Eye,
  Dumbbell,
  Clock,
  Play,
  CheckCircle2,
  CalendarDays,
} from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';


// ============================================================
// WEEK TYPE CONFIG
// ============================================================

const weekTypeConfig = {
  foundation: {
    label: 'Foundation',
    color: 'bg-accent/15 text-accent border-accent/20',
    icon: Target,
  },

  accumulation: {
    label: 'Accumulation',
    color: 'bg-primary/15 text-primary border-primary/20',
    icon: Layers,
  },

  intensification: {
    label: 'Intensification',
    color: 'bg-chart-4/15 text-chart-4 border-chart-4/20',
    icon: Zap,
  },

  peak: {
    label: 'Peak',
    color: 'bg-chart-3/15 text-chart-3 border-chart-3/20',
    icon: Zap,
  },

  taper: {
    label: 'Taper',
    color: 'bg-chart-3/15 text-chart-3 border-chart-3/20',
    icon: TrendingDown,
  },

  deload: {
    label: 'Deload',
    color: 'bg-muted text-muted-foreground border-border',
    icon: TrendingDown,
  },

  progression: {
    label: 'Progression',
    color: 'bg-primary/15 text-primary border-primary/20',
    icon: TrendingDown,
  },

  baseline: {
    label: 'Baseline',
    color: 'bg-accent/15 text-accent border-accent/20',
    icon: Target,
  },
};


// ============================================================
// HELPERS
// ============================================================

function normalizeWeekNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}


function getWeekTypeConfig(weekType) {
  if (!weekType) return null;

  const key = String(weekType).toLowerCase().trim();

  return (
    weekTypeConfig[key] || {
      label: weekType,
      color: 'bg-muted text-muted-foreground border-border',
      icon: Target,
    }
  );
}


function WorkoutTypeTag({ workoutType }) {
  const lower = String(workoutType || '').toLowerCase();

  let color = 'bg-muted/60 text-muted-foreground';

  if (
    lower.includes('intensity') ||
    lower.includes('neural') ||
    lower.includes('strength')
  ) {
    color = 'bg-chart-4/10 text-chart-4';
  } else if (
    lower.includes('volume') ||
    lower.includes('hypertrophy')
  ) {
    color = 'bg-primary/10 text-primary';
  } else if (
    lower.includes('skill') ||
    lower.includes('recovery') ||
    lower.includes('active') ||
    lower.includes('deload')
  ) {
    color = 'bg-accent/10 text-accent';
  }

  return (
    <span
      className={cn(
        'text-[10px] font-semibold px-2 py-0.5 rounded-full',
        color
      )}
    >
      {workoutType}
    </span>
  );
}


function formatRest(seconds) {
  const value = Number(seconds);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  if (value >= 60) {
    const minutes = Math.floor(value / 60);
    const remaining = value % 60;

    if (remaining === 0) {
      return `${minutes} min rest`;
    }

    return `${minutes}:${String(remaining).padStart(2, '0')} rest`;
  }

  return `${value}s rest`;
}


function getWorkoutDuration(exercises = []) {
  if (!Array.isArray(exercises) || exercises.length === 0) {
    return 0;
  }

  /*
   * This is intentionally an estimate.

   * We don't know the athlete's actual set duration,
   * so use the number of exercises rather than pretending
   * we know an exact workout duration.
   */
  return Math.max(
    15,
    Math.round(exercises.length * 6)
  );
}


// ============================================================
// EXERCISE PREVIEW
// ============================================================

function ExercisePreview({ exercise, index }) {
  if (!exercise) return null;

  const sets = Number(exercise.sets) || 1;
  const reps = exercise.reps || '—';
  const rest = formatRest(exercise.rest_seconds);

  return (
    <div className="rounded-xl bg-muted/30 border border-border/60 p-3">
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <span className="text-[11px] font-bold">
            {index + 1}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm leading-tight">
            {exercise.name || 'Exercise'}
          </p>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground">
              {sets} × {reps}
            </span>

            {rest && (
              <>
                <span className="text-muted-foreground/40">
                  •
                </span>

                <span className="text-xs text-muted-foreground">
                  {rest}
                </span>
              </>
            )}
          </div>

          {exercise.notes && (
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
              {exercise.notes}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}


// ============================================================
// WORKOUT CARD
// ============================================================

function WorkoutCard({
  day,
  index,
  selectedWeek,
  currentWeek,
  onOpen,
}) {
  const exercises = Array.isArray(day?.exercises)
    ? day.exercises
    : [];

  const isRestDay = exercises.length === 0;

  const isCurrentWeek =
    Number(selectedWeek) === Number(currentWeek);

  const duration = getWorkoutDuration(exercises);

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all',
        !isRestDay &&
          'cursor-pointer hover:border-primary/40 active:scale-[0.99]'
      )}
      onClick={() => {
        if (!isRestDay && onOpen) {
          onOpen(index);
        }
      }}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary shrink-0" />

              <p className="font-heading font-bold text-base">
                {day?.day_name || `Day ${index + 1}`}
              </p>
            </div>

            {day?.workout_type && (
              <div className="mt-2">
                <WorkoutTypeTag
                  workoutType={day.workout_type}
                />
              </div>
            )}
          </div>

          {isRestDay ? (
            <Badge
              variant="outline"
              className="text-xs shrink-0"
            >
              Rest
            </Badge>
          ) : (
            <div className="text-right shrink-0">
              <p className="text-xs font-medium">
                {exercises.length}{' '}
                {exercises.length === 1
                  ? 'exercise'
                  : 'exercises'}
              </p>

              {duration > 0 && (
                <div className="flex items-center justify-end gap-1 mt-1 text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span className="text-[10px]">
                    ~{duration} min
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Exercises */}
        {!isRestDay && (
          <div className="space-y-2 mt-4">
            {exercises.slice(0, 4).map((exercise, exerciseIndex) => (
              <ExercisePreview
                key={`${exercise?.name || 'exercise'}-${exerciseIndex}`}
                exercise={exercise}
                index={exerciseIndex}
              />
            ))}

            {exercises.length > 4 && (
              <div className="text-center pt-1">
                <p className="text-xs text-muted-foreground">
                  +{exercises.length - 4} more exercises
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Open workout footer */}
      {!isRestDay && (
        <div className="border-t border-border/60 bg-muted/20 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {isCurrentWeek
                ? 'Ready when you are'
                : 'View workout'}
            </span>

            <div className="flex items-center gap-1.5 text-primary">
              <Play className="w-3.5 h-3.5 fill-current" />

              <span className="text-xs font-semibold">
                {isCurrentWeek
                  ? 'Start Workout'
                  : 'View Workout'}
              </span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}


// ============================================================
// MAIN PAGE
// ============================================================

export default function WeeklyPlan({
  program,
  onLogWorkout,
}) {
  const navigate = useNavigate();

  const currentWeek = normalizeWeekNumber(
    program?.current_week
  ) || 1;

  const allWeeks = Array.isArray(program?.microcycles)
    ? program.microcycles
    : [];

  const totalWeeks = Math.max(
    normalizeWeekNumber(program?.duration_weeks) || 0,
    allWeeks.reduce((highest, week) => {
      return Math.max(
        highest,
        normalizeWeekNumber(week?.week_number) || 0
      );
    }, 0),
    12
  );

  /*
   * IMPORTANT:
   *
   * Use Number() here.
   *
   * Supabase/OpenRouter can sometimes return:
   *
   *   week_number: "1"
   *
   * instead of:
   *
   *   week_number: 1
   *
   * LiveWorkout already normalizes this. The old WeeklyPlan
   * did not, which is why a workout could work in Live Workout
   * while this page incorrectly said it wasn't generated.
   */
  const normalizedWeeks = useMemo(() => {
    return allWeeks
      .map((week) => ({
        ...week,
        week_number: normalizeWeekNumber(
          week?.week_number
        ),
      }))
      .filter((week) => week.week_number != null)
      .sort(
        (a, b) =>
          Number(a.week_number) -
          Number(b.week_number)
      );
  }, [allWeeks]);

  const [selectedWeek, setSelectedWeek] = useState(
    currentWeek
  );

  /*
   * If the program advances from Week 1 to Week 2 after
   * finishing a week, automatically move this page to the
   * newly available current week.
   */
  useEffect(() => {
    setSelectedWeek(currentWeek);
  }, [currentWeek]);

  const currentMicrocycle = normalizedWeeks.find(
    (week) =>
      Number(week.week_number) ===
      Number(selectedWeek)
  );

  const isFutureWeek =
    Number(selectedWeek) > Number(currentWeek);

  const isPastWeek =
    Number(selectedWeek) < Number(currentWeek);

  const mesocycleIndex = normalizeWeekNumber(
    currentMicrocycle?.mesocycle_index
  );

  const mesocycleName =
    mesocycleIndex != null
      ? program?.mesocycles?.[mesocycleIndex]?.name
      : null;

  const weekTypeCfg = getWeekTypeConfig(
    currentMicrocycle?.week_type
  );

  const WeekTypeIcon = weekTypeCfg?.icon;

  /*
   * The actual workouts for the selected week.
   *
   * This is what the user should see immediately.
   */
  const days = Array.isArray(
    currentMicrocycle?.days
  )
    ? currentMicrocycle.days
    : [];

  const trainingDays = days.filter(
    (day) =>
      Array.isArray(day?.exercises) &&
      day.exercises.length > 0
  );

  const restDays = days.filter(
    (day) =>
      !Array.isArray(day?.exercises) ||
      day.exercises.length === 0
  );


  // ==========================================================
  // OPEN WORKOUT
  // ==========================================================

  const openWorkout = (dayIndex) => {
    navigate(
      `/program/day/${dayIndex}`,
      {
        state: {
          week: Number(selectedWeek),
        },
      }
    );
  };


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="space-y-5 pb-6">

      {/* ====================================================
          WEEK HEADER
          ==================================================== */}

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          disabled={selectedWeek <= 1}
          onClick={() =>
            setSelectedWeek((week) =>
              Math.max(1, week - 1)
            )
          }
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <div className="text-center flex-1">
          <div className="flex items-center justify-center gap-2">
            <p className="font-heading font-bold text-lg">
              Week {selectedWeek}
            </p>

            {Number(selectedWeek) ===
              Number(currentWeek) && (
              <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-semibold border border-primary/20">
                Current
              </span>
            )}

            {isFutureWeek && (
              <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                <Eye className="w-2.5 h-2.5" />
                Preview
              </span>
            )}

            {isPastWeek && (
              <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-semibold">
                Completed
              </span>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
            {mesocycleName && (
              <p className="text-xs text-muted-foreground">
                {mesocycleName}
              </p>
            )}

            {weekTypeCfg && (
              <span
                className={cn(
                  'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                  weekTypeCfg.color
                )}
              >
                {WeekTypeIcon && (
                  <WeekTypeIcon className="w-2.5 h-2.5 inline mr-1" />
                )}

                {weekTypeCfg.label}
              </span>
            )}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          disabled={selectedWeek >= totalWeeks}
          onClick={() =>
            setSelectedWeek((week) =>
              Math.min(totalWeeks, week + 1)
            )
          }
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>


      {/* ====================================================
          WEEK PROGRESS BAR
          ==================================================== */}

      <div className="flex gap-0.5 items-end h-4">
        {Array.from(
          { length: totalWeeks },
          (_, index) => {
            const weekNumber = index + 1;

            const micro = normalizedWeeks.find(
              (week) =>
                Number(week.week_number) ===
                weekNumber
            );

            const weekType =
              String(
                micro?.week_type || ''
              ).toLowerCase();

            const isDeload =
              weekType.includes('deload') ||
              weekType.includes('taper');

            const isPast =
              weekNumber < currentWeek;

            const isCurrent =
              weekNumber === currentWeek;

            const isSelected =
              weekNumber === selectedWeek;

            return (
              <button
                key={weekNumber}
                onClick={() =>
                  setSelectedWeek(weekNumber)
                }
                className={cn(
                  'flex-1 rounded-sm transition-all',
                  isDeload ? 'h-2' : 'h-4',
                  isSelected
                    ? 'bg-primary'
                    : isPast
                      ? 'bg-primary/40'
                      : isCurrent
                        ? 'bg-primary/70'
                        : 'bg-muted/60',
                  'hover:opacity-80'
                )}
                title={`Week ${weekNumber}${
                  micro?.week_type
                    ? ` — ${micro.week_type}`
                    : ''
                }`}
              />
            );
          }
        )}
      </div>

      <div className="flex justify-between text-[10px] text-muted-foreground -mt-2 px-0.5">
        <span>Wk 1</span>

        <span>
          Wk {Math.ceil(totalWeeks / 2)}
        </span>

        <span>
          Wk {totalWeeks}
        </span>
      </div>


      {/* ====================================================
          NO WEEK DATA
          ==================================================== */}

      {!currentMicrocycle && (
        <Card className="p-6 text-center border-dashed">
          <Dumbbell className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />

          <p className="font-heading font-bold text-sm">
            Week {selectedWeek} isn't built yet
          </p>

          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            This week will be generated when it becomes
            available based on your training progress and
            completed workouts.
          </p>

          {Number(selectedWeek) > Number(currentWeek) && (
            <p className="text-xs text-primary mt-3 font-medium">
              Finish your current week's workouts and your
              next week will be generated automatically.
            </p>
          )}
        </Card>
      )}


      {/* ====================================================
          FUTURE WEEK NOTICE
          ==================================================== */}

      {currentMicrocycle && isFutureWeek && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/60">
          <Eye className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />

          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground/70">
              Upcoming plan.
            </span>{' '}
            This week's workouts are already available.
            Your future progression may be adjusted from
            your actual workout performance.
          </p>
        </div>
      )}


      {/* ====================================================
          CURRENT WEEK SUMMARY
          ==================================================== */}

      {currentMicrocycle && (
        <Card className="p-4 bg-primary/5 border-primary/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5 text-primary" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-heading font-bold text-sm">
                {isFutureWeek
                  ? `Week ${selectedWeek} — Upcoming`
                  : `Week ${selectedWeek} — Your Workouts`}
              </p>

              <p className="text-xs text-muted-foreground mt-0.5">
                {trainingDays.length}{' '}
                {trainingDays.length === 1
                  ? 'training day'
                  : 'training days'}
                {restDays.length > 0
                  ? ` · ${restDays.length} rest ${
                      restDays.length === 1
                        ? 'day'
                        : 'days'
                    }`
                  : ''}
              </p>
            </div>

            {trainingDays.length > 0 && (
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
            )}
          </div>
        </Card>
      )}


      {/* ====================================================
          UPCOMING WORKOUTS
          ==================================================== */}

      {currentMicrocycle &&
        trainingDays.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-heading font-bold text-base">
                  {isFutureWeek
                    ? 'Upcoming Workouts'
                    : 'This Week'}
                </p>

                <p className="text-xs text-muted-foreground mt-0.5">
                  Your programmed workouts for this week
                </p>
              </div>

              <Badge
                variant="outline"
                className="text-xs"
              >
                {trainingDays.length}{' '}
                {trainingDays.length === 1
                  ? 'workout'
                  : 'workouts'}
              </Badge>
            </div>

            <div className="space-y-3">
              {days.map((day, index) => {
                const exercises = Array.isArray(
                  day?.exercises
                )
                  ? day.exercises
                  : [];

                if (exercises.length === 0) {
                  return null;
                }

                return (
                  <WorkoutCard
                    key={`${day?.day_name || 'day'}-${index}`}
                    day={day}
                    index={index}
                    selectedWeek={selectedWeek}
                    currentWeek={currentWeek}
                    onOpen={openWorkout}
                  />
                );
              })}
            </div>
          </div>
        )}


      {/* ====================================================
          REST DAYS
          ==================================================== */}

      {currentMicrocycle &&
        restDays.length > 0 && (
          <div className="space-y-2">
            <p className="font-heading font-bold text-sm">
              Recovery
            </p>

            {days.map((day, index) => {
              const exercises = Array.isArray(
                day?.exercises
              )
                ? day.exercises
                : [];

              if (exercises.length > 0) {
                return null;
              }

              return (
                <Card
                  key={`rest-${index}`}
                  className="p-4 border-dashed opacity-70"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                      <TrendingDown className="w-4 h-4 text-muted-foreground" />
                    </div>

                    <div>
                      <p className="font-heading font-semibold text-sm">
                        {day?.day_name ||
                          `Day ${index + 1}`}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        Rest and recovery
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}


      {/* ====================================================
          CURRENT WEEK HAS NO WORKOUTS
          ==================================================== */}

      {currentMicrocycle &&
        days.length === 0 && (
          <Card className="p-6 text-center border-dashed">
            <Dumbbell className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />

            <p className="font-heading font-bold text-sm">
              No workouts found for this week
            </p>

            <p className="text-xs text-muted-foreground mt-1">
              The weekly program is present, but it doesn't
              contain any workout days yet.
            </p>
          </Card>
        )}
    </div>
  );
}
