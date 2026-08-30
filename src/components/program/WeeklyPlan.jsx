import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Edit3,
  Plus,
  Trash2,
  Save,
  X,
  Clock,
  Dumbbell,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { hasPlan } from '@/lib/subscription';
import { supabaseApi } from '@/lib/supabaseApi';


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

  const key = String(weekType)
    .toLowerCase()
    .trim();

  return (
    weekTypeConfig[key] || {
      label: weekType,
      color: 'bg-muted text-muted-foreground border-border',
      icon: Target,
    }
  );
}


function WorkoutTypeTag({ workoutType }) {
  if (!workoutType) {
    return null;
  }

  const lower = String(workoutType).toLowerCase();

  let color = 'bg-muted/60 text-muted-foreground';

  if (
    lower.includes('intensity') ||
    lower.includes('neural') ||
    lower.includes('strength') ||
    lower.includes('power')
  ) {
    color = 'bg-chart-4/10 text-chart-4';
  } else if (
    lower.includes('volume') ||
    lower.includes('hypertrophy') ||
    lower.includes('muscle')
  ) {
    color = 'bg-primary/10 text-primary';
  } else if (
    lower.includes('skill') ||
    lower.includes('recovery') ||
    lower.includes('active') ||
    lower.includes('deload') ||
    lower.includes('mobility')
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


function getExercises(day) {
  return Array.isArray(day?.exercises)
    ? day.exercises
    : [];
}


function formatRest(seconds) {
  const value = Number(seconds);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  if (value < 60) {
    return `${value}s`;
  }

  const minutes = Math.floor(value / 60);
  const remainder = value % 60;

  if (remainder === 0) {
    return `${minutes} min`;
  }

  return `${minutes}m ${remainder}s`;
}


export default function WeeklyPlan({
  program,
  onLogWorkout,
}) {
  const navigate = useNavigate();


  /*
   * ------------------------------------------------------------
   * WEEK DATA
   * ------------------------------------------------------------
   */

  const allWeeks = useMemo(() => {
    return Array.isArray(program?.microcycles)
      ? program.microcycles
      : [];
  }, [program?.microcycles]);


  const currentWeek =
    Number(program?.current_week) || 1;


  const totalWeeks =
    Number(program?.duration_weeks) ||
    allWeeks.length ||
    12;


  const [selectedWeek, setSelectedWeek] =
    useState(currentWeek);


  const currentMicrocycle =
    allWeeks.find(
      (microcycle) =>
        Number(microcycle?.week_number) ===
        Number(selectedWeek)
    ) || null;


  const isFutureWeek =
    selectedWeek > currentWeek;


  const mesocycleName =
    program?.mesocycles?.[
      Number(
        currentMicrocycle?.mesocycle_index
      )
    ]?.name || null;


  const weekTypeCfg =
    getWeekTypeConfig(
      currentMicrocycle?.week_type
    );


  const WeekTypeIcon =
    weekTypeCfg?.icon || Target;


  /*
   * ------------------------------------------------------------
   * PLAN ACCESS
   * ------------------------------------------------------------
   *
   * Progress is the required level for manual workout editing.
   * Performance and Elite inherit Progress access.
   */

  const [userPlan, setUserPlan] =
    useState('free');


  useEffect(() => {
    let mounted = true;

    supabaseApi.auth
      .me()
      .then((user) => {
        if (!mounted) {
          return;
        }

        setUserPlan(
          user?.subscription_plan || 'free'
        );
      })
      .catch((error) => {
        console.error(
          '[WeeklyPlan] Could not load subscription plan:',
          error
        );
      });

    return () => {
      mounted = false;
    };
  }, []);


  const canEditWorkouts =
    hasPlan(
      userPlan,
      'progress'
    );


  /*
   * ------------------------------------------------------------
   * EDITOR STATE
   * ------------------------------------------------------------
   */

  const [
    editingDayIndex,
    setEditingDayIndex,
  ] = useState(null);


  const [
    editingExercises,
    setEditingExercises,
  ] = useState([]);


  const [
    savingWorkout,
    setSavingWorkout,
  ] = useState(false);


  /*
   * ------------------------------------------------------------
   * WEEK NAVIGATION
   * ------------------------------------------------------------
   */

  const previousWeek = () => {
    setSelectedWeek(
      (value) =>
        Math.max(
          1,
          value - 1
        )
    );
  };


  const nextWeek = () => {
    setSelectedWeek(
      (value) =>
        Math.min(
          totalWeeks,
          value + 1
        )
    );
  };


  /*
   * ------------------------------------------------------------
   * OPEN EDITOR
   * ------------------------------------------------------------
   */

  const openEditor = (
    dayIndex,
    day
  ) => {
    if (!canEditWorkouts) {
      return;
    }

    const exercises =
      getExercises(day);


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


  /*
   * ------------------------------------------------------------
   * CLOSE EDITOR
   * ------------------------------------------------------------
   */

  const closeEditor = () => {
    if (savingWorkout) {
      return;
    }

    setEditingDayIndex(
      null
    );

    setEditingExercises(
      []
    );
  };


  /*
   * ------------------------------------------------------------
   * UPDATE EDITOR
   * ------------------------------------------------------------
   */

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
              field === 'name' ||
              field === 'reps' ||
              field === 'notes' ||
              field === 'activation_cue'
            ) {
              return {
                ...exercise,
                [field]:
                  value,
              };
            }

            const numericValue =
              Number(value);


            return {
              ...exercise,

              [field]:
                Number.isFinite(
                  numericValue
                )
                  ? numericValue
                  : 0,
            };
          }
        )
    );
  };


  /*
   * ------------------------------------------------------------
   * ADD EXERCISE
   * ------------------------------------------------------------
   */

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


  /*
   * ------------------------------------------------------------
   * REMOVE EXERCISE
   * ------------------------------------------------------------
   */

  const removeExercise = (
    index
  ) => {
    setEditingExercises(
      (previous) =>
        previous.filter(
          (
            _exercise,
            exerciseIndex
          ) =>
            exerciseIndex !==
            index
        )
    );
  };


  /*
   * ------------------------------------------------------------
   * SAVE WORKOUT
   * ------------------------------------------------------------
   */

  const saveWorkout = async () => {
    if (
      !canEditWorkouts ||
      editingDayIndex === null ||
      savingWorkout ||
      !program?.id ||
      !currentMicrocycle
    ) {
      return;
    }


    const cleanedExercises =
      editingExercises
        .filter(
          (exercise) =>
            String(
              exercise?.name || ''
            ).trim()
        )
        .map(
          (exercise) => ({
            ...exercise,

            name:
              String(
                exercise.name
              ).trim(),

            sets:
              Math.max(
                1,
                Number(
                  exercise.sets
                ) || 1
              ),

            reps:
              String(
                exercise.reps ?? ''
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
                exercise.notes ?? ''
              ).trim(),

            activation_cue:
              String(
                exercise.activation_cue ?? ''
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


    setSavingWorkout(
      true
    );


    try {
      const updatedMicrocycles =
        allWeeks.map(
          (microcycle) => {
            if (
              Number(
                microcycle?.week_number
              ) !==
              Number(
                selectedWeek
              )
            ) {
              return microcycle;
            }


            const updatedDays =
              Array.isArray(
                microcycle?.days
              )
                ? microcycle.days.map(
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
                  )
                : [];


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


      closeEditor();

      /*
       * Refresh the application so the saved program
       * becomes the source of truth everywhere.
       */
      window.location.reload();

    } catch (error) {
      console.error(
        '[WeeklyPlan] Failed to save workout:',
        error
      );

      window.alert(
        error?.message ||
          'Unable to save the workout. Please try again.'
      );

      setSavingWorkout(
        false
      );
    }
  };


  /*
   * ------------------------------------------------------------
   * RENDER
   * ------------------------------------------------------------
   */

  return (
    <div className="space-y-4">

      {/* ========================================================
          WEEK SELECTOR
          ======================================================== */}

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
            selectedWeek <= 1
          }
          onClick={
            previousWeek
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
                />

                Preview

              </span>
            )}

          </div>


          <div className="
            flex
            items-center
            justify-center
            gap-2
            mt-0.5
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
            nextWeek
          }
          aria-label="Next week"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>

      </div>


      {/* ========================================================
          WEEK PROGRESS
          ======================================================== */}

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
          (
            _unused,
            index
          ) => {
            const weekNumber =
              index + 1;

            const micro =
              allWeeks.find(
                (
                  item
                ) =>
                  Number(
                    item?.week_number
                  ) ===
                  weekNumber
              );


            const weekType =
              String(
                micro?.week_type ||
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
                    : isPast
                      ? 'bg-primary/40'
                      : isCurrent
                        ? 'bg-primary/70'
                        : 'bg-muted/60',
                  'hover:opacity-80'
                )}
                title={
                  `Week ${weekNumber}` +
                  (
                    micro?.week_type
                      ? ` — ${micro.week_type}`
                      : ''
                  )
                }
                aria-label={
                  `Week ${weekNumber}`
                }
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

        <span className="
          text-center
        ">
          Wk {
            Math.ceil(
              totalWeeks / 2
            )
          }
        </span>

        <span>
          Wk {totalWeeks}
        </span>

      </div>


      {/* ========================================================
          NO DATA
          ======================================================== */}

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
          ">
            This week's plan will be personalized based on
            your program and workout history.
          </p>

        </Card>
      )}


      {/* ========================================================
          FUTURE WEEK NOTICE
          ======================================================== */}

      {currentMicrocycle &&
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
                Estimated plan.
              </span>{' '}

              These workouts are your projected baseline.
              Live workout tracking is available on every plan.

            </p>

          </div>
        )}


      {/* ========================================================
          WORKOUT DAYS
          ======================================================== */}

      {currentMicrocycle && (
        <div className="
          space-y-2
        ">

          {currentMicrocycle.days?.map(
            (
              day,
              dayIndex
            ) => {

              const exercises =
                getExercises(day);


              const isRestDay =
                exercises.length ===
                0;


              const estimatedMinutes =
                Math.max(
                  10,
                  Math.round(
                    (
                      exercises.reduce(
                        (
                          total,
                          exercise
                        ) =>
                          total +
                          (
                            Number(
                              exercise?.sets
                            ) || 1
                          ),
                        0
                      )
                    ) * 2.5
                  )
                );


              return (
                <Card
                  key={
                    `${selectedWeek}-${dayIndex}`
                  }
                  className={cn(
                    'p-4 transition-all',

                    isRestDay
                      ? 'opacity-60 border-dashed'
                      : 'cursor-pointer hover:border-primary/40 active:scale-[0.98]',

                    isFutureWeek &&
                      !isRestDay &&
                      'border-border/60'
                  )}
                  onClick={() => {
                    if (
                      !isRestDay
                    ) {
                      navigate(
                        `/program/day/${dayIndex}`,
                        {
                          state: {
                            week:
                              selectedWeek,
                          },
                        }
                      );
                    }
                  }}
                >

                  <div className="
                    flex
                    items-center
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
                        {
                          day?.day_name ||
                          `Day ${dayIndex + 1}`
                        }
                      </p>


                      <div className="
                        flex
                        items-center
                        gap-2
                        mt-1
                        flex-wrap
                      ">

                        {day?.workout_type && (
                          <WorkoutTypeTag
                            workoutType={
                              day.workout_type
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
                      ml-3
                      shrink-0
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


                  {/* ==================================================
                      PROGRESS+ EDIT BUTTON
                      ================================================== */}

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
                      onClick={(
                        event
                      ) => {
                        event.stopPropagation();

                        openEditor(
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

                </Card>
              );
            }
          )}

        </div>
      )}


      {/* ========================================================
          WORKOUT EDITOR
          ======================================================== */}

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

            {/* HEADER */}

            <div className="
              shrink-0
              flex
              items-center
              justify-between
              gap-3
              px-5
              py-4
              border-b
              border-border
              bg-card
            ">

              <div className="
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
                  Customize your workout for Week {selectedWeek}.
                </p>

              </div>


              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={
                  savingWorkout
                }
                onClick={
                  closeEditor
                }
                aria-label="Close editor"
              >

                <X className="
                  w-5
                  h-5
                " />

              </Button>

            </div>


            {/* SCROLLING BODY */}

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
                        disabled={
                          savingWorkout ||
                          editingExercises.length <=
                            1
                        }
                        onClick={() =>
                          removeExercise(
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
                        onChange={(
                          event
                        ) =>
                          updateExercise(
                            index,
                            'name',
                            event.target.value
                          )
                        }
                        disabled={
                          savingWorkout
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
                          onChange={(
                            event
                          ) =>
                            updateExercise(
                              index,
                              'sets',
                              event.target.value
                            )
                          }
                          disabled={
                            savingWorkout
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
                          onChange={(
                            event
                          ) =>
                            updateExercise(
                              index,
                              'reps',
                              event.target.value
                            )
                          }
                          disabled={
                            savingWorkout
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
                          onChange={(
                            event
                          ) =>
                            updateExercise(
                              index,
                              'rest_seconds',
                              event.target.value
                            )
                          }
                          disabled={
                            savingWorkout
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
                        onChange={(
                          event
                        ) =>
                          updateExercise(
                            index,
                            'notes',
                            event.target.value
                          )
                        }
                        disabled={
                          savingWorkout
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
                        onChange={(
                          event
                        ) =>
                          updateExercise(
                            index,
                            'activation_cue',
                            event.target.value
                          )
                        }
                        disabled={
                          savingWorkout
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
                  savingWorkout
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


            {/* FIXED EDITOR FOOTER */}

            <div
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
                  saveWorkout
                }
                disabled={
                  savingWorkout
                }
              >

                {savingWorkout ? (

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

            </div>

          </section>

        </div>
      )}

    </div>
  );
}
