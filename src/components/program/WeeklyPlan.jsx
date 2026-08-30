import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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


const WEEK_TYPES = {
  foundation: {
    label: 'Foundation',
    color:
      'bg-accent/15 text-accent border-accent/20',
    icon: Target,
  },

  accumulation: {
    label: 'Accumulation',
    color:
      'bg-primary/15 text-primary border-primary/20',
    icon: Layers,
  },

  intensification: {
    label: 'Intensification',
    color:
      'bg-chart-4/15 text-chart-4 border-chart-4/20',
    icon: Zap,
  },

  peak: {
    label: 'Peak',
    color:
      'bg-chart-3/15 text-chart-3 border-chart-3/20',
    icon: Zap,
  },

  taper: {
    label: 'Taper',
    color:
      'bg-chart-3/15 text-chart-3 border-chart-3/20',
    icon: TrendingDown,
  },

  deload: {
    label: 'Deload',
    color:
      'bg-muted text-muted-foreground border-border',
    icon: TrendingDown,
  },
};


function normalizeWeekNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? Math.trunc(number)
    : null;
}


function getWeekTypeConfig(value) {
  if (!value) {
    return null;
  }

  const key = String(value)
    .toLowerCase()
    .trim();

  return (
    WEEK_TYPES[key] || {
      label: value,
      color:
        'bg-muted text-muted-foreground border-border',
      icon: Target,
    }
  );
}


function getMicrocycles(program) {
  const microcycles =
    Array.isArray(
      program?.microcycles
    )
      ? program.microcycles
      : [];

  return microcycles
    .filter(Boolean)
    .map((microcycle) => ({
      ...microcycle,

      week_number:
        normalizeWeekNumber(
          microcycle.week_number
        ),
    }))
    .filter(
      (microcycle) =>
        microcycle.week_number !== null
    )
    .sort(
      (a, b) =>
        a.week_number -
        b.week_number
    );
}


function getDays(microcycle) {
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


function getExercises(day) {
  return Array.isArray(
    day?.exercises
  )
    ? day.exercises
    : [];
}


function formatRest(seconds) {
  const value = Number(seconds);

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return null;
  }

  if (value < 60) {
    return `${value}s`;
  }

  const minutes = Math.floor(
    value / 60
  );

  const remainder =
    value % 60;

  return remainder === 0
    ? `${minutes} min`
    : `${minutes}m ${remainder}s`;
}


function estimateMinutes(exercises) {
  if (!exercises.length) {
    return 0;
  }

  const sets =
    exercises.reduce(
      (total, exercise) =>
        total +
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
      sets * 2.5
    )
  );
}


function WorkoutTypeTag({
  workoutType,
}) {
  if (!workoutType) {
    return null;
  }

  const lower =
    String(
      workoutType
    ).toLowerCase();

  let className =
    'bg-muted/60 text-muted-foreground';

  if (
    lower.includes('strength') ||
    lower.includes('power') ||
    lower.includes('intensity') ||
    lower.includes('neural')
  ) {
    className =
      'bg-chart-4/10 text-chart-4';
  } else if (
    lower.includes('volume') ||
    lower.includes('hypertrophy') ||
    lower.includes('muscle')
  ) {
    className =
      'bg-primary/10 text-primary';
  } else if (
    lower.includes('skill') ||
    lower.includes('recovery') ||
    lower.includes('mobility') ||
    lower.includes('deload')
  ) {
    className =
      'bg-accent/10 text-accent';
  }

  return (
    <span
      className={cn(
        'text-[10px] font-semibold px-2 py-0.5 rounded-full',
        className
      )}
    >
      {workoutType}
    </span>
  );
}


export default function WeeklyPlan({
  program,
  onLogWorkout,
}) {
  const navigate =
    useNavigate();

  const microcycles =
    useMemo(
      () =>
        getMicrocycles(
          program
        ),
      [program]
    );


  const currentWeek =
    normalizeWeekNumber(
      program?.current_week
    ) || 1;


  const totalWeeks =
    normalizeWeekNumber(
      program?.duration_weeks
    ) ||
    Math.max(
      currentWeek,
      microcycles.length
        ? Math.max(
            ...microcycles.map(
              (microcycle) =>
                microcycle.week_number
            )
          )
        : 1
    );


  const [
    selectedWeek,
    setSelectedWeek,
  ] = useState(
    currentWeek
  );


  const [
    userPlan,
    setUserPlan,
  ] = useState(
    'free'
  );


  const [
    editingDayIndex,
    setEditingDayIndex,
  ] = useState(
    null
  );


  const [
    editingExercises,
    setEditingExercises,
  ] = useState(
    []
  );


  const [
    savingEdit,
    setSavingEdit,
  ] = useState(
    false
  );


  useEffect(
    () => {
      let mounted = true;

      supabaseApi.auth
        .me()
        .then(
          (user) => {
            if (mounted) {
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
              '[WeeklyPlan] Failed to load user plan:',
              error
            );
          }
        );

      return () => {
        mounted = false;
      };
    },
    []
  );


  /*
   * Progress is the manual workout-editing entitlement.
   * Performance and Elite inherit Progress access.
   */
  const canEditWorkouts =
    hasPlan(
      userPlan,
      'progress'
    );


  const currentMicrocycle =
    microcycles.find(
      (microcycle) =>
        microcycle.week_number ===
        selectedWeek
    );


  const days =
    getDays(
      currentMicrocycle
    );


  const weekHasWorkoutData =
    days.length > 0;


  const isFutureWeek =
    selectedWeek >
    currentWeek;


  const weekType =
    getWeekTypeConfig(
      currentMicrocycle?.week_type
    );


  const WeekTypeIcon =
    weekType?.icon ||
    Target;


  const isEditing =
    editingDayIndex !== null;


  const editingDay =
    isEditing
      ? days[
          editingDayIndex
        ]
      : null;


  /*
   * =========================================================
   * EDITOR
   * =========================================================
   */

  const openWorkoutEditor = (
    dayIndex,
    day
  ) => {
    if (!canEditWorkouts) {
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


  const closeEditor = () => {
    if (savingEdit) {
      return;
    }

    setEditingDayIndex(
      null
    );

    setEditingExercises(
      []
    );
  };


  const updateExercise = (
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


            const number =
              Number(
                value
              );


            return {
              ...exercise,

              [field]:
                Number.isFinite(
                  number
                )
                  ? Math.max(
                      0,
                      number
                    )
                  : 0,
            };
          }
        )
    );
  };


  const addExercise = () => {
    setEditingExercises(
      (previous) => [
        ...previous,

        {
          name: '',
          sets: 3,
          reps: '8-12',
          rest_seconds: 60,
          notes: '',
          activation_cue: '',
        },
      ]
    );
  };


  const removeExercise = (
    index
  ) => {
    setEditingExercises(
      (previous) => {
        if (
          previous.length <=
          1
        ) {
          return previous;
        }

        return previous.filter(
          (
            _,
            exerciseIndex
          ) =>
            exerciseIndex !==
            index
        );
      }
    );
  };


  const saveWorkoutEdits =
    async () => {
      if (
        !canEditWorkouts ||
        editingDayIndex === null ||
        !program?.id ||
        savingEdit
      ) {
        return;
      }


      const cleanedExercises =
        editingExercises
          .filter(
            (exercise) =>
              exercise?.name?.trim()
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
        cleanedExercises.length ===
        0
      ) {
        window.alert(
          'Add at least one exercise before saving.'
        );

        return;
      }


      setSavingEdit(
        true
      );


      try {
        const updatedMicrocycles =
          microcycles.map(
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
                        cleanedExercises,
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


        /*
         * Reload the program everywhere so the edited workout
         * becomes the single source of truth for the application.
         */
        window.location.reload();

      } catch (
        error
      ) {
        console.error(
          '[WeeklyPlan] Save failed:',
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


  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <div className="space-y-4">

      {/* =====================================================
          WEEK HEADER
          ===================================================== */}

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
          flex-1
          text-center
          min-w-0
        ">

          <div className="
            flex
            items-center
            justify-center
            gap-2
            flex-wrap
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
              ">
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

            {currentMicrocycle?.mesocycle_name && (
              <p className="
                text-xs
                text-muted-foreground
              ">
                {
                  currentMicrocycle.mesocycle_name
                }
              </p>
            )}


            {weekType && (
              <span
                className={cn(
                  'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                  weekType.color
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

                  {weekType.label}

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


      {/* =====================================================
          WEEK BAR
          ===================================================== */}

      <div className="
        flex
        items-end
        gap-0.5
        h-4
      ">

        {Array.from(
          {
            length:
              totalWeeks,
          },
          (
            _,
            index
          ) => {

            const weekNumber =
              index + 1;

            const generated =
              microcycles.some(
                (microcycle) =>
                  microcycle.week_number ===
                  weekNumber
              );

            const selected =
              weekNumber ===
              selectedWeek;

            const past =
              weekNumber <
              currentWeek;


            return (
              <button
                type="button"
                key={
                  weekNumber
                }
                onClick={() =>
                  setSelectedWeek(
                    weekNumber
                  )
                }
                className={cn(
                  'flex-1 rounded-sm transition-all',

                  selected
                    ? 'bg-primary'
                    : generated &&
                        past
                      ? 'bg-primary/50'
                      : generated
                        ? 'bg-primary/30'
                        : past
                          ? 'bg-muted/70'
                          : 'bg-muted/50',

                  currentMicrocycle?.week_type
                    ?.toLowerCase()
                    .includes('deload') &&
                    'h-2',

                  !currentMicrocycle?.week_type
                    ?.toLowerCase()
                    .includes('deload') &&
                    'h-4'
                )}
                aria-label={`Week ${weekNumber}`}
                title={`Week ${weekNumber}`}
              />
            );
          }
        )}

      </div>


      {/* =====================================================
          WEEK SUMMARY
          ===================================================== */}

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
              shrink-0
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

              <p className="
                font-heading
                font-bold
                text-sm
              ">
                Week {selectedWeek} Training Plan
              </p>


              <p className="
                text-xs
                text-muted-foreground
                mt-1
                leading-relaxed
              ">
                Your personalized workouts for this week.
                Follow the sessions below and use Live Workout
                to track your actual performance.
              </p>


              {canEditWorkouts && (
                <p className="
                  text-[10px]
                  text-primary
                  font-medium
                  mt-2
                ">
                  You can customize these workouts.
                </p>
              )}

            </div>

          </div>

        </Card>
      )}


      {/* =====================================================
          EMPTY / NOT GENERATED
          ===================================================== */}

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
            leading-relaxed
          ">
            This week has not been generated yet.
            Complete your current training to unlock
            the next personalized week.
          </p>

        </Card>
      )}


      {/* =====================================================
          FUTURE WEEK
          ===================================================== */}

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
              mt-0.5
              text-muted-foreground
              shrink-0
            />


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
              This workout is available for preview.
            </p>

          </div>
        )}


      {/* =====================================================
          WORKOUT DAYS
          ===================================================== */}

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

              const workoutType =
                day?.workout_type ||
                day?.session_type ||
                day?.type ||
                '';

              const dayName =
                day?.day_name ||
                day?.name ||
                `Day ${dayIndex + 1}`;

              const minutes =
                estimateMinutes(
                  exercises
                );


              return (
                <Card
                  key={`${selectedWeek}-${dayIndex}-${dayName}`}
                  className={cn(
                    'overflow-hidden',

                    !isRestDay &&
                      'transition-all hover:border-primary/40'
                  )}
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

                          <WorkoutTypeTag
                            workoutType={
                              workoutType
                            }
                          />


                          {!isRestDay && (
                            <span className="
                              text-[10px]
                              text-muted-foreground
                              flex
                              items-center
                              gap-1
                            ">

                              <Dumbbell className="w-3 h-3" />

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
                        shrink-0
                      ">

                        {isRestDay ? (

                          <span className="
                            text-xs
                            text-muted-foreground
                            font-medium
                          ">
                            Rest
                          </span>

                        ) : (

                          <span className="
                            text-xs
                            text-muted-foreground
                            inline-flex
                            items-center
                            gap-1
                          ">

                            <Clock className="w-3 h-3" />

                            ~{minutes} min

                          </span>

                        )}

                      </div>

                    </div>


                    {/* Edit button */}

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
                        "
                        onClick={() =>
                          openWorkoutEditor(
                            dayIndex,
                            day
                          )
                        }
                      >

                        <Edit3 className="w-3.5 h-3.5" />

                        Edit Workout

                      </Button>
                    )}

                  </div>


                  {/* Exercise list */}

                  {!isRestDay && (
                    <div className="
                      px-4
                      py-3
                      border-t
                      border-border/60
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
                                  shrink-0
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
                                        × {
                                          exercise.reps
                                        }
                                      </span>
                                    )}


                                    {rest && (
                                      <span className="
                                        text-[11px]
                                        text-muted-foreground
                                        inline-flex
                                        items-center
                                        gap-1
                                      ">

                                        <Timer className="
                                          w-3
                                          h-3
                                        " />

                                        {
                                          rest
                                        }

                                      </span>
                                    )}

                                  </div>

                                </div>

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
                        "
                        onClick={() =>
                          navigate(
                            `/program/day/${dayIndex}`,
                            {
                              state: {
                                week:
                                  selectedWeek,
                              },
                            }
                          )
                        }
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


      {/* =====================================================
          EDIT WORKOUT MODAL
          ===================================================== */}

      {isEditing && (
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

            {/* Modal header */}

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
                  mt-1
                ">
                  {editingDay?.day_name ||
                    editingDay?.name ||
                    'Workout'}
                </p>

              </div>


              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={
                  closeEditor
                }
                disabled={
                  savingEdit
                }
                aria-label="Close editor"
              >

                <X className="w-5 h-5" />

              </Button>

            </header>


            {/* Modal body */}

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
                        Exercise {
                          index + 1
                        }
                      </p>


                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="
                          text-destructive
                          hover:text-destructive
                        "
                        onClick={() =>
                          removeExercise(
                            index
                          )
                        }
                        disabled={
                          savingEdit ||
                          editingExercises.length <=
                            1
                        }
                        aria-label={`Remove exercise ${index + 1}`}
                      >

                        <Trash2 className="w-4 h-4" />

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
                        onChange={(event) =>
                          updateExercise(
                            index,
                            'name',
                            event.target.value
                          )
                        }
                        disabled={
                          savingEdit
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
                          onChange={(event) =>
                            updateExercise(
                              index,
                              'sets',
                              event.target.value
                            )
                          }
                          disabled={
                            savingEdit
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
                          onChange={(event) =>
                            updateExercise(
                              index,
                              'reps',
                              event.target.value
                            )
                          }
                          disabled={
                            savingEdit
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
                          onChange={(event) =>
                            updateExercise(
                              index,
                              'rest_seconds',
                              event.target.value
                            )
                          }
                          disabled={
                            savingEdit
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
                        onChange={(event) =>
                          updateExercise(
                            index,
                            'notes',
                            event.target.value
                          )
                        }
                        disabled={
                          savingEdit
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
                        Activation Cue
                      </label>


                      <Input
                        value={
                          exercise.activation_cue
                        }
                        onChange={(event) =>
                          updateExercise(
                            index,
                            'activation_cue',
                            event.target.value
                          )
                        }
                        disabled={
                          savingEdit
                        }
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
                onClick={
                  addExercise
                }
                disabled={
                  savingEdit
                }
              >

                <Plus className="
                  w-4
                  h-4
                " />

                Add Exercise

              </Button>

            </div>


            {/* =================================================
                MODAL FOOTER
                ================================================= */}

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
                onClick={
                  saveWorkoutEdits
                }
                disabled={
                  savingEdit
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
                    " />

                    Save Workout

                  </>

                )}

              </Button>

            </footer>

          </section>

        </div>
      )}

    </div>
  );
}
