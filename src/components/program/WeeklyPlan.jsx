import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  Zap,
  Layers,
  TrendingDown,
  Target,
  Eye,
  Clock,
  Dumbbell,
  Timer,
  CheckCircle2,
  Edit3,
  Plus,
  Trash2,
  Save,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { hasPlan } from '@/lib/subscription';
import { supabaseApi } from '@/lib/supabaseApi';

/*
 * Weekly Plan
 *
 * Reads the existing WorkoutProgram.microcycles data.
 *
 * Progress, Performance, and Elite users can manually edit
 * generated workouts.
 *
 * Free users can view workouts but cannot edit them.
 */

/* ============================================================
   WEEK TYPES
   ============================================================ */

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
};


function getWeekTypeConfig(weekType) {
  if (!weekType) {
    return null;
  }

  const key =
    String(weekType)
      .toLowerCase()
      .trim();

  return (
    weekTypeConfig[key] || {
      label: weekType,
      color:
        'bg-muted text-muted-foreground border-border',
      icon: Target,
    }
  );
}


/* ============================================================
   WORKOUT TYPE
   ============================================================ */

function WorkoutTypeTag({
  workoutType,
}) {
  if (!workoutType) {
    return null;
  }

  const lower =
    String(workoutType)
      .toLowerCase();

  let color =
    'bg-muted/60 text-muted-foreground';

  if (
    lower.includes('intensity') ||
    lower.includes('neural') ||
    lower.includes('strength') ||
    lower.includes('power')
  ) {
    color =
      'bg-chart-4/10 text-chart-4';
  } else if (
    lower.includes('volume') ||
    lower.includes('hypertrophy') ||
    lower.includes('muscle')
  ) {
    color =
      'bg-primary/10 text-primary';
  } else if (
    lower.includes('skill') ||
    lower.includes('recovery') ||
    lower.includes('active') ||
    lower.includes('deload') ||
    lower.includes('mobility')
  ) {
    color =
      'bg-accent/10 text-accent';
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


/* ============================================================
   HELPERS
   ============================================================ */

function normalizeWeekNumber(value) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return null;
  }

  return Math.trunc(
    number
  );
}


function normalizeMicrocycles(
  program
) {
  const raw =
    Array.isArray(
      program?.microcycles
    )
      ? program.microcycles
      : [];

  return raw
    .filter(Boolean)
    .map(
      (microcycle) => ({
        ...microcycle,

        week_number:
          normalizeWeekNumber(
            microcycle.week_number
          ),
      })
    )
    .filter(
      (microcycle) =>
        microcycle.week_number !==
        null
    )
    .sort(
      (a, b) =>
        a.week_number -
        b.week_number
    );
}


function getDays(
  microcycle
) {
  if (
    Array.isArray(
      microcycle?.days
    )
  ) {
    return microcycle.days;
  }

  if (
    Array.isArray(
      microcycle?.workouts
    )
  ) {
    return microcycle.workouts;
  }

  if (
    Array.isArray(
      microcycle?.sessions
    )
  ) {
    return microcycle.sessions;
  }

  return [];
}


function getExercises(
  day
) {
  if (
    Array.isArray(
      day?.exercises
    )
  ) {
    return day.exercises;
  }

  return [];
}


function formatRest(
  restSeconds
) {
  const seconds =
    Number(
      restSeconds
    );

  if (
    !Number.isFinite(
      seconds
    ) ||
    seconds <= 0
  ) {
    return null;
  }

  if (
    seconds >=
    60
  ) {
    const minutes =
      Math.floor(
        seconds /
        60
      );

    const remainder =
      seconds %
      60;

    if (
      remainder ===
      0
    ) {
      return `${minutes} min`;
    }

    return `${minutes}m ${remainder}s`;
  }

  return `${seconds}s`;
}


function getEstimatedMinutes(
  exercises
) {
  if (
    !exercises?.length
  ) {
    return 0;
  }

  const totalSets =
    exercises.reduce(
      (sum, exercise) =>
        sum +
        (
          Number(
            exercise?.sets
          ) || 1
        ),
      0
    );

  return Math.max(
    10,
    Math.round(
      totalSets *
      2.5
    )
  );
}


/* ============================================================
   MAIN
   ============================================================ */

export default function WeeklyPlan({
  program,
  onLogWorkout,
}) {
  const navigate =
    useNavigate();


  /* ----------------------------------------------------------
     PROGRAM
     ---------------------------------------------------------- */

  const allWeeks =
    useMemo(
      () =>
        normalizeMicrocycles(
          program
        ),
      [program]
    );


  const currentWeek =
    normalizeWeekNumber(
      program?.current_week
    ) || 1;


  const firstAvailableWeek =
    allWeeks[0]?.week_number ||
    currentWeek;


  const initialWeek =
    allWeeks.some(
      (week) =>
        week.week_number ===
        currentWeek
    )
      ? currentWeek
      : firstAvailableWeek;


  const [
    selectedWeek,
    setSelectedWeek,
  ] =
    useState(
      initialWeek
    );


  useEffect(() => {
    const normalizedCurrent =
      normalizeWeekNumber(
        program?.current_week
      ) || 1;

    const generatedCurrentExists =
      allWeeks.some(
        (week) =>
          week.week_number ===
          normalizedCurrent
      );

    if (
      generatedCurrentExists
    ) {
      setSelectedWeek(
        normalizedCurrent
      );

      return;
    }

    if (
      allWeeks.length >
      0
    ) {
      setSelectedWeek(
        (previous) => {
          const previousExists =
            allWeeks.some(
              (week) =>
                week.week_number ===
                previous
            );

          return previousExists
            ? previous
            : allWeeks[0].week_number;
        }
      );
    }
  }, [
    program?.current_week,
    allWeeks,
  ]);


  const currentMicrocycle =
    allWeeks.find(
      (microcycle) =>
        normalizeWeekNumber(
          microcycle.week_number
        ) ===
        normalizeWeekNumber(
          selectedWeek
        )
    );


  const totalWeeks =
    normalizeWeekNumber(
      program?.duration_weeks
    ) ||
    Math.max(
      allWeeks.length
        ? Math.max(
            ...allWeeks.map(
              (week) =>
                week.week_number
            )
          )
        : 1,
      currentWeek
    );


  const isFutureWeek =
    selectedWeek >
    currentWeek;


  const mesocycleName =
    program?.mesocycles?.find(
      (meso, index) => {
        const weekStart =
          normalizeWeekNumber(
            meso?.week_start
          ) ??
          index *
          4 +
          1;

        const weekEnd =
          normalizeWeekNumber(
            meso?.week_end
          ) ??
          index *
          4 +
          4;

        return (
          selectedWeek >=
          weekStart &&
          selectedWeek <=
          weekEnd
        );
      }
    )?.name ||
    (
      currentMicrocycle?.mesocycle_index !==
        undefined &&
      program?.mesocycles?.[
        Number(
          currentMicrocycle.mesocycle_index
        )
      ]
    )?.name;


  const weekTypeCfg =
    getWeekTypeConfig(
      currentMicrocycle?.week_type
    );


  const WeekTypeIcon =
    weekTypeCfg?.icon ||
    Target;


  const days =
    getDays(
      currentMicrocycle
    );


  const weekHasWorkoutData =
    !!currentMicrocycle &&
    days.length >
    0;


  const generatedWeekNumbers =
    new Set(
      allWeeks.map(
        (week) =>
          week.week_number
      )
    );


  /* ----------------------------------------------------------
     USER PLAN
     ---------------------------------------------------------- */

  const [
    userPlan,
    setUserPlan,
  ] =
    useState(
      'free'
    );


  const [
    loadingPlan,
    setLoadingPlan,
  ] =
    useState(
      true
    );


  useEffect(() => {
    let mounted =
      true;

    supabaseApi.auth
      .me()
      .then(
        (user) => {
          if (
            mounted
          ) {
            setUserPlan(
              user?.subscription_plan ||
              'free'
            );
          }
        }
      )
      .catch(
        (error) => {
          console.error(
            '[WeeklyPlan] Failed to load subscription:',
            error
          );
        }
      )
      .finally(() => {
        if (
          mounted
        ) {
          setLoadingPlan(
            false
          );
        }
      });

    return () => {
      mounted =
        false;
    };
  }, []);


  /*
   * Progress is the minimum plan for manual workout editing.
   * Performance and Elite inherit the same access.
   */
  const canEditWorkouts =
    !loadingPlan &&
    hasPlan(
      userPlan,
      'progress'
    );


  /* ----------------------------------------------------------
     EDITOR
     ---------------------------------------------------------- */

  const [
    editingDayIndex,
    setEditingDayIndex,
  ] =
    useState(
      null
    );


  const [
    editingExercises,
    setEditingExercises,
  ] =
    useState(
      []
    );


  const [
    savingEdit,
    setSavingEdit,
  ] =
    useState(
      false
    );


  const openWorkoutEditor =
    (
      dayIndex,
      day
    ) => {
      if (
        !canEditWorkouts
      ) {
        return;
      }

      const exercises =
        getExercises(
          day
        );

      setEditingDayIndex(
        dayIndex
      );

      setEditingExercises(
        exercises.map(
          (exercise) => ({
            ...exercise,

            name:
              exercise?.name ||
              '',

            sets:
              Number(
                exercise?.sets
              ) || 1,

            reps:
              exercise?.reps ??
              '',

            rest_seconds:
              Number(
                exercise?.rest_seconds
              ) || 60,

            notes:
              exercise?.notes ||
              '',

            activation_cue:
              exercise?.activation_cue ||
              '',
          })
        )
      );
    };


  const closeWorkoutEditor =
    () => {
      if (
        savingEdit
      ) {
        return;
      }

      setEditingDayIndex(
        null
      );

      setEditingExercises(
        []
      );
    };


  const updateEditingExercise =
    (
      index,
      field,
      value
    ) => {
      setEditingExercises(
        (previous) =>
          previous.map(
            (
              exercise,
              exerciseIndex
            ) => {
              if (
                exerciseIndex !==
                index
              ) {
                return exercise;
              }

              if (
                field ===
                  'name' ||
                field ===
                  'reps' ||
                field ===
                  'notes' ||
                field ===
                  'activation_cue'
              ) {
                return {
                  ...exercise,
                  [field]:
                    value,
                };
              }

              const numeric =
                Number(
                  value
                );

              return {
                ...exercise,

                [field]:
                  Number.isFinite(
                    numeric
                  ) &&
                  numeric >=
                  0
                    ? numeric
                    : 0,
              };
            }
          )
      );
    };


  const addEditingExercise =
    () => {
      setEditingExercises(
        (previous) => [
          ...previous,

          {
            name:
              '',

            sets:
              3,

            reps:
              '8-12',

            rest_seconds:
              60,

            notes:
              '',

            activation_cue:
              '',
          },
        ]
      );
    };


  const removeEditingExercise =
    (
      index
    ) => {
      setEditingExercises(
        (previous) =>
          previous.filter(
            (
              _,
              exerciseIndex
            ) =>
              exerciseIndex !==
              index
          )
      );
    };


  const saveWorkoutEdits =
    async () => {
      if (
        !canEditWorkouts ||
        editingDayIndex ===
          null ||
        savingEdit
      ) {
        return;
      }


      const cleanExercises =
        editingExercises
          .filter(
            (exercise) =>
              exercise?.name
                ?.trim()
          )
          .map(
            (exercise) => ({
              ...exercise,

              name:
                exercise.name.trim(),

              sets:
                Math.max(
                  1,
                  Number(
                    exercise.sets
                  ) || 1
                ),

              reps:
                String(
                  exercise.reps ??
                  ''
                ).trim(),

              rest_seconds:
                Math.max(
                  0,
                  Number(
                    exercise.rest_seconds
                  ) || 0
                ),

              notes:
                String(
                  exercise.notes ??
                  ''
                ).trim(),

              activation_cue:
                String(
                  exercise.activation_cue ??
                  ''
                ).trim(),
            })
          );


      if (
        cleanExercises.length ===
        0
      ) {
        window.alert(
          'Add at least one exercise before saving.'
        );

        return;
      }


      if (
        !program?.id ||
        !currentMicrocycle
      ) {
        window.alert(
          'This workout is not available to edit right now.'
        );

        return;
      }


      setSavingEdit(
        true
      );


      try {
        const updatedMicrocycles =
          allWeeks.map(
            (microcycle) => {
              if (
                microcycle.week_number !==
                selectedWeek
              ) {
                return microcycle;
              }


              const updatedDays =
                getDays(
                  microcycle
                ).map(
                  (
                    day,
                    dayIndex
                  ) => {
                    if (
                      dayIndex !==
                      editingDayIndex
                    ) {
                      return day;
                    }

                    return {
                      ...day,
                      exercises:
                        cleanExercises,
                    };
                  }
                );


              return {
                ...microcycle,
                days:
                  updatedDays,
              };
            }
          );


        await supabaseApi.entities.WorkoutProgram.update(
          program.id,
          {
            microcycles:
              updatedMicrocycles,
          }
        );


        window.location.reload();

      } catch (
        error
      ) {
        console.error(
          '[WeeklyPlan] Failed to save workout edits:',
          error
        );

        window.alert(
          error?.message ||
          'Unable to save your workout changes. Please try again.'
        );

        setSavingEdit(
          false
        );
      }
    };


  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <div className="space-y-4">

      {/* ======================================================
          WEEK SELECTOR
          ====================================================== */}

      <div className="
        flex
        items-center
        justify-between
      ">

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={
            selectedWeek <=
            1
          }
          onClick={
            goPreviousWeek
          }
          aria-label="Previous week"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>


        <div className="
          text-center
          flex-1
        ">

          <div className="
            flex
            items-center
            justify-center
            gap-2
          ">

            <p className="
              font-heading
              font-bold
              text-lg
            ">
              Week {selectedWeek}
            </p>


            {selectedWeek ===
              currentWeek && (
              <span className="
                text-[10px]
                bg-primary/15
                text-primary
                px-2
                py-0.5
                rounded-full
                font-semibold
                border
                border-primary/20
              ">
                Current
              </span>
            )}


            {isFutureWeek && (
              <span className="
                text-[10px]
                bg-muted
                text-muted-foreground
                px-2
                py-0.5
                rounded-full
                font-semibold
                inline-flex
                items-center
                gap-1
              ">

                <Eye className="
                  w-2.5
                  h-2.5
                " />

                Preview

              </span>
            )}

          </div>


          <div className="
            flex
            items-center
            justify-center
            gap-2
            mt-1
            flex-wrap
          ">

            {mesocycleName && (
              <p className="
                text-xs
                text-muted-foreground
              ">
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

                <span className="
                  inline-flex
                  items-center
                  gap-1
                ">

                  <WeekTypeIcon className="
                    w-2.5
                    h-2.5
                  " />

                  {weekTypeCfg.label}

                </span>

              </span>
            )}

          </div>

        </div>


        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={
            selectedWeek >=
            totalWeeks
          }
          onClick={
            goNextWeek
          }
          aria-label="Next week"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>

      </div>


      {/* ======================================================
          WEEK PROGRESS
          ====================================================== */}

      <div className="
        flex
        gap-0.5
        items-end
        h-4
      ">

        {Array.from(
          {
            length:
              totalWeeks,
          },
          (_, index) => {
            const weekNumber =
              index +
              1;

            const isGenerated =
              generatedWeekNumbers.has(
                weekNumber
              );

            const microcycle =
              allWeeks.find(
                (micro) =>
                  micro.week_number ===
                  weekNumber
              );

            const weekType =
              String(
                microcycle?.week_type ||
                ''
              ).toLowerCase();

            const isDeload =
              weekType.includes(
                'deload'
              ) ||
              weekType.includes(
                'taper'
              );

            const isPast =
              weekNumber <
              currentWeek;

            const isCurrent =
              weekNumber ===
              currentWeek;

            const isSelected =
              weekNumber ===
              selectedWeek;


            return (
              <button
                key={
                  weekNumber
                }
                type="button"
                onClick={() =>
                  setSelectedWeek(
                    weekNumber
                  )
                }
                className={cn(
                  'flex-1 rounded-sm transition-all',

                  isDeload
                    ? 'h-2'
                    : 'h-4',

                  isSelected
                    ? 'bg-primary'
                    : isGenerated &&
                        isPast
                      ? 'bg-primary/50'
                      : isGenerated &&
                          isCurrent
                        ? 'bg-primary/80'
                        : isGenerated
                          ? 'bg-primary/40'
                          : isPast
                            ? 'bg-muted/70'
                            : 'bg-muted/60',

                  'hover:opacity-80'
                )}
                title={
                  microcycle?.week_type
                    ? `Week ${weekNumber} — ${microcycle.week_type}`
                    : isGenerated
                      ? `Week ${weekNumber} — generated`
                      : `Week ${weekNumber} — not generated`
                }
                aria-label={`Week ${weekNumber}`}
              />
            );
          }
        )}

      </div>


      <div className="
        flex
        justify-between
        text-[10px]
        text-muted-foreground
        -mt-2
        px-0.5
      ">

        <span>
          Wk 1
        </span>

        <span>
          Wk {
            Math.ceil(
              totalWeeks /
              2
            )
          }
        </span>

        <span>
          Wk {totalWeeks}
        </span>

      </div>


      {/* ======================================================
          WEEK SUMMARY
          ====================================================== */}

      {weekHasWorkoutData && (
        <Card className="
          p-4
          bg-primary/5
          border-primary/15
        ">

          <div className="
            flex
            items-start
            gap-3
          ">

            <div className="
              w-9
              h-9
              rounded-xl
              bg-primary/15
              flex
              items-center
              justify-center
              flex-shrink-0
            ">

              <Dumbbell className="
                w-4
                h-4
                text-primary
              " />

            </div>


            <div className="
              flex-1
              min-w-0
            ">

              <div className="
                flex
                items-center
                gap-2
                flex-wrap
              ">

                <p className="
                  font-heading
                  font-bold
                  text-sm
                ">
                  Week {
                    selectedWeek
                  } Training Plan
                </p>


                {selectedWeek ===
                  currentWeek && (
                  <span className="
                    text-[9px]
                    font-bold
                    uppercase
                    tracking-wider
                    text-primary
                    bg-primary/10
                    px-2
                    py-0.5
                    rounded-full
                  ">
                    Active
                  </span>
                )}

              </div>


              <p className="
                text-xs
                text-muted-foreground
                mt-1
              ">
                Your personalized workouts for this week are ready.
                Follow the sessions below and use Live Workout to track
                your actual performance.
              </p>


              {canEditWorkouts && (
                <p className="
                  text-[10px]
                  text-primary
                  font-medium
                  mt-2
                ">
                  Progress+ workout editing is enabled.
                </p>
              )}

            </div>

          </div>

        </Card>
      )}


      {/* ======================================================
          NO DATA
          ====================================================== */}

      {!currentMicrocycle && (
        <Card className="
          p-6
          text-center
          border-dashed
        ">

          <Eye className="
            w-8
            h-8
            mx-auto
            mb-2
            text-muted-foreground
            opacity-40
          " />


          <p className="
            font-heading
            font-bold
            text-sm
          ">
            Week {selectedWeek} Not Yet Generated
          </p>


          <p className="
            text-xs
            text-muted-foreground
            mt-1
            max-w-sm
            mx-auto
            leading-relaxed
          ">
            This week has not been generated yet. Your next
            week's workout will be created using your completed
            workouts, performance, and feedback.
          </p>

        </Card>
      )}


      {/* ======================================================
          EMPTY GENERATED WEEK
          ====================================================== */}

      {currentMicrocycle &&
        !weekHasWorkoutData && (
        <Card className="
          p-6
          text-center
          border-dashed
        ">

          <Dumbbell className="
            w-8
            h-8
            mx-auto
            mb-2
            text-muted-foreground
            opacity-40
          " />


          <p className="
            font-heading
            font-bold
            text-sm
          ">
            Workout details are still loading
          </p>


          <p className="
            text-xs
            text-muted-foreground
            mt-1
          ">
            The week exists in your program, but no workout
            days have been returned yet. Refresh the page and
            try again.
          </p>

        </Card>
      )}


      {/* ======================================================
          FUTURE NOTICE
          ====================================================== */}

      {weekHasWorkoutData &&
        isFutureWeek && (
        <div className="
          flex
          items-start
          gap-2.5
          p-3
          rounded-xl
          bg-muted/40
          border
          border-border/60
        ">

          <Eye className="
            w-4
            h-4
            text-muted-foreground
            mt-0.5
            flex-shrink-0
          " />


          <p className="
            text-xs
            text-muted-foreground
            leading-relaxed
          ">

            <span className="
              font-semibold
              text-foreground/70
            ">
              Upcoming plan.
            </span>{' '}

            This workout has already been generated and is available
            to preview. Live Workout will use the same workout data
            when that week becomes active.

          </p>

        </div>
      )}


      {/* ======================================================
          WORKOUT DAYS
          ====================================================== */}

      {weekHasWorkoutData && (
        <div className="
          space-y-3
        ">

          {days.map(
            (
              day,
              dayIndex
            ) => {

              const exercises =
                getExercises(
                  day
                );

              const isRestDay =
                exercises.length ===
                0;

              const estimatedMinutes =
                getEstimatedMinutes(
                  exercises
                );

              const workoutType =
                day?.workout_type ||
                day?.session_type ||
                day?.type ||
                '';

              const dayName =
                day?.day_name ||
                day?.name ||
                `Day ${dayIndex + 1}`;


              return (
                <Card
                  key={`${selectedWeek}-${dayIndex}-${dayName}`}
                  className={cn(
                    'overflow-hidden transition-all',

                    isRestDay
                      ? 'opacity-60 border-dashed'
                      : 'cursor-pointer hover:border-primary/40 active:scale-[0.99]'
                  )}
                  onClick={() => {
                    if (
                      isRestDay
                    ) {
                      return;
                    }

                    navigate(
                      `/program/day/${dayIndex}`,
                      {
                        state: {
                          week:
                            selectedWeek,
                        },
                      }
                    );
                  }}
                >

                  {/* Day header */}

                  <div className="
                    p-4
                  ">

                    <div className="
                      flex
                      items-start
                      justify-between
                      gap-3
                    ">

                      <div className="
                        flex-1
                        min-w-0
                      ">

                        <p className="
                          font-heading
                          font-bold
                        ">
                          {dayName}
                        </p>


                        <div className="
                          flex
                          items-center
                          gap-2
                          mt-1.5
                          flex-wrap
                        ">

                          {workoutType && (
                            <WorkoutTypeTag
                              workoutType={
                                workoutType
                              }
                            />
                          )}


                          {!isRestDay && (
                            <span className="
                              text-[10px]
                              text-muted-foreground
                              flex
                              items-center
                              gap-1
                            ">

                              <Dumbbell className="
                                w-3
                                h-3
                              " />

                              {exercises.length}{' '}

                              {
                                exercises.length ===
                                1
                                  ? 'exercise'
                                  : 'exercises'
                              }

                            </span>
                          )}

                        </div>

                      </div>


                      <div className="
                        text-right
                        flex-shrink-0
                      ">

                        {isRestDay ? (

                          <p className="
                            text-xs
                            text-muted-foreground
                            font-medium
                          ">
                            Rest
                          </p>

                        ) : (

                          <p className="
                            text-xs
                            text-muted-foreground
                            flex
                            items-center
                            gap-1
                          ">

                            <Clock className="
                              w-3
                              h-3
                            " />

                            ~{
                              estimatedMinutes
                            } min

                          </p>

                        )}

                      </div>

                    </div>


                    {/* Progress+ editor button */}

                    {!isRestDay &&
                      canEditWorkouts && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="
                          w-full
                          mt-3
                          gap-2
                          font-semibold
                        "
                        onClick={(
                          event
                        ) => {
                          event.stopPropagation();

                          openWorkoutEditor(
                            dayIndex,
                            day
                          );
                        }}
                      >

                        <Edit3 className="
                          w-3.5
                          h-3.5
                        " />

                        Edit Workout

                      </Button>
                    )}

                  </div>


                  {/* Exercises */}

                  {!isRestDay && (
                    <div className="
                      border-t
                      border-border/60
                      px-4
                      py-3
                      bg-muted/20
                    ">

                      <div className="
                        space-y-2
                      ">

                        {exercises.map(
                          (
                            exercise,
                            exerciseIndex
                          ) => {

                            const rest =
                              formatRest(
                                exercise?.rest_seconds
                              );


                            return (
                              <div
                                key={`${exerciseIndex}-${exercise?.name || 'exercise'}`}
                                className="
                                  flex
                                  items-start
                                  gap-3
                                "
                              >

                                <div className="
                                  w-6
                                  h-6
                                  rounded-lg
                                  bg-primary/10
                                  flex
                                  items-center
                                  justify-center
                                  flex-shrink-0
                                  mt-0.5
                                >

                                  <span className="
                                    text-[10px]
                                    font-bold
                                    text-primary
                                  ">
                                    {
                                      exerciseIndex +
                                      1
                                    }
                                  </span>

                                </div>


                                <div className="
                                  flex-1
                                  min-w-0
                                ">

                                  <p className="
                                    text-sm
                                    font-medium
                                    leading-tight
                                  ">
                                    {
                                      exercise?.name ||
                                      `Exercise ${exerciseIndex + 1}`
                                    }
                                  </p>


                                  <div className="
                                    flex
                                    items-center
                                    gap-3
                                    mt-1
                                    flex-wrap
                                  ">

                                    {exercise?.sets !==
                                      undefined && (
                                      <span className="
                                        text-[11px]
                                        text-muted-foreground
                                      ">
                                        {
                                          exercise.sets
                                        } sets
                                      </span>
                                    )}


                                    {exercise?.reps && (
                                      <span className="
                                        text-[11px]
                                        text-muted-foreground
                                      ">
                                        ×{' '}
                                        {
                                          exercise.reps
                                        }
                                      </span>
                                    )}


                                    {rest && (
                                      <span className="
                                        text-[11px]
                                        text-muted-foreground
                                        flex
                                        items-center
                                        gap-1
                                      ">

                                        <Timer className="
                                          w-3
                                          h-3
                                        " />

                                        {rest}

                                      </span>
                                    )}

                                  </div>

                                </div>


                                <CheckCircle2 className="
                                  w-4
                                  h-4
                                  text-muted-foreground/30
                                  flex-shrink-0
                                  mt-1
                                " />

                              </div>
                            );
                          }
                        )}

                      </div>


                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="
                          w-full
                          mt-3
                          text-primary
                          hover:text-primary
                        "
                        onClick={(
                          event
                        ) => {
                          event.stopPropagation();

                          navigate(
                            `/program/day/${dayIndex}`,
                            {
                              state: {
                                week:
                                  selectedWeek,
                              },
                            }
                          );
                        }}
                      >

                        View Full Workout

                        <ChevronRight className="
                          w-4
                          h-4
                          ml-1
                        " />

                      </Button>

                    </div>
                  )}

                </Card>
              );
            }
          )}

        </div>
      )}


      {/* ======================================================
          WORKOUT EDITOR
          ====================================================== */}

      {editingDayIndex !==
        null && (
        <div
          className="
            fixed
            inset-0
            z-[1000]
            bg-black/60
            backdrop-blur-sm
            flex
            items-end
            sm:items-center
            justify-center
            p-0
            sm:p-4
          "
          role="dialog"
          aria-modal="true"
          aria-label="Edit Workout"
        >

          <section className="
            relative
            z-10
            w-full
            max-w-2xl
            max-h-[calc(100dvh-0.5rem)]
            sm:max-h-[90vh]
            flex
            flex-col
            overflow-hidden
            rounded-t-3xl
            sm:rounded-2xl
            border
            border-border
            bg-card
            shadow-2xl
          ">

            {/* Header */}

            <header className="
              shrink-0
              flex
              items-center
              justify-between
              gap-3
              px-5
              py-4
              border-b
              border-border
            ">

              <div className="
                flex-1
                min-w-0
              ">

                <h2 className="
                  font-heading
                  font-bold
                  text-lg
                ">
                  Edit Workout
                </h2>


                <p className="
                  text-xs
                  text-muted-foreground
                  mt-0.5
                ">
                  Customize exercises, sets, reps, rest,
                  and coaching notes.
                </p>

              </div>


              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={
                  savingEdit
                }
                onClick={
                  closeWorkoutEditor
                }
                aria-label="Close workout editor"
              >

                <X className="
                  w-5
                  h-5
                " />

              </Button>

            </header>


            {/* Body */}

            <div className="
              flex-1
              min-h-0
              overflow-y-auto
              overscroll-contain
              px-5
              py-4
              space-y-4
            ">

              {editingExercises.map(
                (
                  exercise,
                  index
                ) => (

                  <Card
                    key={
                      index
                    }
                    className="
                      p-4
                      space-y-3
                    "
                  >

                    <div className="
                      flex
                      items-center
                      justify-between
                      gap-2
                    ">

                      <p className="
                        text-xs
                        font-bold
                        uppercase
                        tracking-wider
                        text-muted-foreground
                      ">
                        Exercise {index + 1}
                      </p>


                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={
                          savingEdit ||
                          editingExercises.length ===
                            1
                        }
                        onClick={() =>
                          removeEditingExercise(
                            index
                          )
                        }
                        className="
                          text-destructive
                          hover:text-destructive
                        "
                        aria-label={`Remove exercise ${index + 1}`}
                      >

                        <Trash2 className="
                          w-4
                          h-4
                        " />

                      </Button>

                    </div>


                    <div>

                      <label className="
                        block
                        text-[11px]
                        text-muted-foreground
                        mb-1
                      ">
                        Exercise Name
                      </label>


                      <Input
                        value={
                          exercise.name
                        }
                        disabled={
                          savingEdit
                        }
                        onChange={(
                          event
                        ) =>
                          updateEditingExercise(
                            index,
                            'name',
                            event.target.value
                          )
                        }
                      />

                    </div>


                    <div className="
                      grid
                      grid-cols-3
                      gap-2
                    ">

                      <div>

                        <label className="
                          block
                          text-[11px]
                          text-muted-foreground
                          mb-1
                        ">
                          Sets
                        </label>


                        <Input
                          type="number"
                          min="1"
                          inputMode="numeric"
                          value={
                            exercise.sets
                          }
                          disabled={
                            savingEdit
                          }
                          onChange={(
                            event
                          ) =>
                            updateEditingExercise(
                              index,
                              'sets',
                              event.target.value
                            )
                          }
                        />

                      </div>


                      <div>

                        <label className="
                          block
                          text-[11px]
                          text-muted-foreground
                          mb-1
                        ">
                          Reps / Time
                        </label>


                        <Input
                          value={
                            exercise.reps
                          }
                          disabled={
                            savingEdit
                          }
                          onChange={(
                            event
                          ) =>
                            updateEditingExercise(
                              index,
                              'reps',
                              event.target.value
                            )
                          }
                        />

                      </div>


                      <div>

                        <label className="
                          block
                          text-[11px]
                          text-muted-foreground
                          mb-1
                        ">
                          Rest (sec)
                        </label>


                        <Input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          value={
                            exercise.rest_seconds
                          }
                          disabled={
                            savingEdit
                          }
                          onChange={(
                            event
                          ) =>
                            updateEditingExercise(
                              index,
                              'rest_seconds',
                              event.target.value
                            )
                          }
                        />

                      </div>

                    </div>


                    <div>

                      <label className="
                        block
                        text-[11px]
                        text-muted-foreground
                        mb-1
                      ">
                        Notes
                      </label>


                      <Input
                        value={
                          exercise.notes
                        }
                        disabled={
                          savingEdit
                        }
                        onChange={(
                          event
                        ) =>
                          updateEditingExercise(
                            index,
                            'notes',
                            event.target.value
                          )
                        }
                        placeholder="Optional coaching note"
                      />

                    </div>


                    <div>

                      <label className="
                        block
                        text-[11px]
                        text-muted-foreground
                        mb-1
                      ">
                        Activation Cue
                      </label>


                      <Input
                        value={
                          exercise.activation_cue
                        }
                        disabled={
                          savingEdit
                        }
                        onChange={(
                          event
                        ) =>
                          updateEditingExercise(
                            index,
                            'activation_cue',
                            event.target.value
                          )
                        }
                        placeholder="Optional activation cue"
                      />

                    </div>

                  </Card>

                )
              )}


              <Button
                type="button"
                variant="outline"
                className="
                  w-full
                  h-11
                  gap-2
                "
                disabled={
                  savingEdit
                }
                onClick={
                  addEditingExercise
                }
              >

                <Plus className="
                  w-4
                  h-4
                " />

                Add Exercise

              </Button>

              <div className="
                h-2
              " />

            </div>


            {/* Footer */}

            <footer
              className="
                shrink-0
                border-t
                border-border
                bg-card
                px-5
                pt-3
              "
              style={{
                paddingBottom:
                  'max(0.875rem, env(safe-area-inset-bottom))',
              }}
            >

              <Button
                type="button"
                className="
                  w-full
                  h-12
                  font-heading
                  font-semibold
                  gap-2
                "
                disabled={
                  savingEdit
                }
                onClick={
                  saveWorkoutEdits
                }
              >

                {savingEdit ? (

                  <>

                    <span className="
                      w-4
                      h-4
                      border-2
                      border-primary-foreground
                      border-t-transparent
                      rounded-full
                      animate-spin
                    />

                    Saving Workout…

                  </>

                ) : (

                  <>

                    <Save className="
                      w-4
                      h-4
                    />

                    Save Workout

                  </>

                )}

              </Button>

            </footer>

          </section>

        </div>
      )}


      {/* ======================================================
          FOOTER NOTE
          ====================================================== */}

      {weekHasWorkoutData && (
        <div className="
          flex
          items-start
          gap-2
          px-1
          pt-1
        ">

          <CheckCircle2 className="
            w-3.5
            h-3.5
            text-primary
            mt-0.5
            flex-shrink-0
          " />


          <p className="
            text-[10px]
            text-muted-foreground
            leading-relaxed
          ">
            These are the workouts currently stored in your
            personalized program. Live Workout uses this same
            training data and records your performance so Kael
            can make the next week smarter.
          </p>

        </div>
      )}

    </div>
  );
}
