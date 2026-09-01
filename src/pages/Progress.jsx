import { useMemo } from 'react';

import { supabaseApi } from '@/lib/supabaseApi';

import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

import {
  Trophy,
  Flame,
  Clock,
  TrendingUp,
  Lock,
  Dumbbell,
  Repeat2,
  CalendarDays,
  Activity,
  Target,
  Zap,
  Timer,
} from 'lucide-react';

import PageHeader from '@/components/layout/PageHeader';

import { canAccess } from '@/lib/subscription';


/* ============================================================
   DATE HELPERS
   ============================================================ */

function toDateString(date) {
  const value =
    date instanceof Date
      ? date
      : new Date(date);

  if (
    Number.isNaN(
      value.getTime()
    )
  ) {
    return '';
  }

  return value
    .toISOString()
    .split('T')[0];
}


function startOfWeek(date) {
  const value =
    new Date(date);

  const day =
    value.getDay();

  value.setDate(
    value.getDate() - day
  );

  value.setHours(
    0,
    0,
    0,
    0
  );

  return value;
}


function addDays(
  date,
  amount
) {
  const value =
    new Date(date);

  value.setDate(
    value.getDate() + amount
  );

  return value;
}


function getWeekKey(
  date
) {
  return toDateString(
    startOfWeek(date)
  );
}


/* ============================================================
   LOG HELPERS
   ============================================================ */

function getCompletedExercises(
  log
) {
  return Array.isArray(
    log?.exercises_completed
  )
    ? log.exercises_completed
    : [];
}


function getCompletedSets(
  log
) {
  return getCompletedExercises(
    log
  ).reduce(
    (
      total,
      exercise
    ) =>
      total +
      (
        Number(
          exercise?.sets_completed
        ) || 0
      ),
    0
  );
}


function getLoggedReps(
  log
) {
  return getCompletedExercises(
    log
  ).reduce(
    (
      total,
      exercise
    ) => {
      const reps =
        exercise?.reps_achieved;

      /*
       * reps_achieved can be:
       *
       * 8
       * "8"
       * "8-12"
       * "30 sec"
       *
       * Only count a numeric value as an actual
       * rep total. We don't invent numbers from
       * ranges or time strings.
       */
      if (
        typeof reps ===
        'number' &&
        Number.isFinite(
          reps
        )
      ) {
        return (
          total +
          Math.max(
            0,
            reps
          )
        );
      }

      if (
        typeof reps ===
        'string' &&
        /^\d+(?:\.\d+)?$/.test(
          reps.trim()
        )
      ) {
        return (
          total +
          Math.max(
            0,
            Number(
              reps.trim()
            )
          )
        );
      }

      return total;
    },
    0
  );
}


function normalizeExerciseName(
  name
) {
  return String(
    name || ''
  )
    .trim()
    .toLowerCase();
}


/* ============================================================
   STREAK
   ============================================================ */

function calculateStreak(
  logs
) {
  const uniqueDates =
    [
      ...new Set(
        logs
          .map(
            (log) =>
              log?.date
          )
          .filter(Boolean)
      ),
    ].sort(
      (
        a,
        b
      ) =>
        b.localeCompare(a)
    );

  if (
    uniqueDates.length ===
    0
  ) {
    return 0;
  }

  const today =
    toDateString(
      new Date()
    );

  const yesterday =
    toDateString(
      addDays(
        new Date(),
        -1
      )
    );

  /*
   * A current streak can begin today or yesterday.
   */
  if (
    uniqueDates[0] !==
      today &&
    uniqueDates[0] !==
      yesterday
  ) {
    return 0;
  }

  let streak = 1;

  let previous =
    new Date(
      uniqueDates[0]
    );

  for (
    let index = 1;
    index <
    uniqueDates.length;
    index += 1
  ) {
    const current =
      new Date(
        uniqueDates[index]
      );

    const difference =
      Math.round(
        (
          previous.getTime() -
          current.getTime()
        ) /
          86400000
      );

    if (
      difference !== 1
    ) {
      break;
    }

    streak += 1;
    previous = current;
  }

  return streak;
}


/* ============================================================
   WEEKLY ANALYTICS
   ============================================================ */

function buildWeeklyData(
  logs,
  numberOfWeeks = 8
) {
  const currentWeek =
    startOfWeek(
      new Date()
    );

  const weeks = [];

  for (
    let index =
      numberOfWeeks - 1;
    index >= 0;
    index -= 1
  ) {
    const weekStart =
      addDays(
        currentWeek,
        -index * 7
      );

    const weekEnd =
      addDays(
        weekStart,
        7
      );

    const weekLogs =
      logs.filter(
        (log) => {
          const date =
            new Date(
              log?.date
            );

          return (
            date >=
              weekStart &&
            date <
              weekEnd
          );
        }
      );

    const workouts =
      weekLogs.length;

    const minutes =
      weekLogs.reduce(
        (
          total,
          log
        ) =>
          total +
          (
            Number(
              log?.duration_minutes
            ) || 0
          ),
        0
      );

    const sets =
      weekLogs.reduce(
        (
          total,
          log
        ) =>
          total +
          getCompletedSets(
            log
          ),
        0
      );

    const reps =
      weekLogs.reduce(
        (
          total,
          log
        ) =>
          total +
          getLoggedReps(
            log
          ),
        0
      );

    weeks.push({
      key:
        toDateString(
          weekStart
        ),

      label:
        index === 0
          ? 'This'
          : `W${numberOfWeeks - index}`,

      workouts,

      minutes,

      sets,

      reps,
    });
  }

  return weeks;
}


/* ============================================================
   EXERCISE ANALYTICS
   ============================================================ */

function buildExerciseAnalytics(
  logs
) {
  const map =
    new Map();

  logs.forEach(
    (log) => {
      getCompletedExercises(
        log
      ).forEach(
        (exercise) => {
          const name =
            String(
              exercise?.name ||
                ''
            ).trim();

          if (!name) {
            return;
          }

          const key =
            normalizeExerciseName(
              name
            );

          const existing =
            map.get(
              key
            ) || {
              name,

              sessions: 0,

              sets: 0,

              reps: 0,

              lastDate: '',

              firstDate: '',
            };

          const date =
            log?.date ||
            '';

          existing.sessions +=
            1;

          existing.sets +=
            Number(
              exercise?.sets_completed
            ) || 0;

          existing.reps +=
            getExerciseReps(
              exercise
            );

          if (
            !existing.firstDate ||
            date <
              existing.firstDate
          ) {
            existing.firstDate =
              date;
          }

          if (
            !existing.lastDate ||
            date >
              existing.lastDate
          ) {
            existing.lastDate =
              date;
          }

          map.set(
            key,
            existing
          );
        }
      );
    }
  );

  return [
    ...map.values(),
  ]
    .sort(
      (
        a,
        b
      ) => {
        if (
          b.sessions !==
          a.sessions
        ) {
          return (
            b.sessions -
            a.sessions
          );
        }

        return (
          b.sets -
          a.sets
        );
      }
    );
}


function getExerciseReps(
  exercise
) {
  const reps =
    exercise?.reps_achieved;

  if (
    typeof reps ===
    'number' &&
    Number.isFinite(
      reps
    )
  ) {
    return Math.max(
      0,
      reps
    );
  }

  if (
    typeof reps ===
      'string' &&
    /^\d+(?:\.\d+)?$/.test(
      reps.trim()
    )
  ) {
    return Math.max(
      0,
      Number(
        reps.trim()
      )
    );
  }

  return 0;
}


/* ============================================================
   NUTRITION ANALYTICS
   ============================================================ */

function buildNutritionData(
  entries
) {
  const days = [];

  for (
    let index = 6;
    index >= 0;
    index -= 1
  ) {
    const date =
      addDays(
        new Date(),
        -index
      );

    const dateString =
      toDateString(
        date
      );

    const dayEntries =
      entries.filter(
        (entry) =>
          entry?.date ===
          dateString
      );

    const calories =
      dayEntries.reduce(
        (
          total,
          entry
        ) =>
          total +
          (
            Number(
              entry?.calories
            ) || 0
          ),
        0
      );

    const protein =
      dayEntries.reduce(
        (
          total,
          entry
        ) =>
          total +
          (
            Number(
              entry?.protein
            ) || 0
          ),
        0
      );

    days.push({
      date:
        dateString,

      day:
        date.toLocaleDateString(
          'en-US',
          {
            weekday:
              'short',
          }
        ),

      calories,

      protein,
    });
  }

  return days;
}


/* ============================================================
   TREND HELPERS
   ============================================================ */

function getTrend(
  current,
  previous
) {
  const currentValue =
    Number(
      current
    ) || 0;

  const previousValue =
    Number(
      previous
    ) || 0;

  if (
    previousValue === 0
  ) {
    return {
      direction:
        currentValue > 0
          ? 'up'
          : 'flat',

      percent:
        currentValue > 0
          ? 100
          : 0,
    };
  }

  const percent =
    (
      (
        currentValue -
        previousValue
      ) /
      previousValue
    ) *
    100;

  if (
    Math.abs(
      percent
    ) <
    1
  ) {
    return {
      direction:
        'flat',

      percent: 0,
    };
  }

  return {
    direction:
      percent > 0
        ? 'up'
        : 'down',

    percent:
      Math.round(
        Math.abs(
          percent
        )
      ),
  };
}


/* ============================================================
   TOOLTIP
   ============================================================ */

function ChartTooltip({
  active,
  payload,
  label,
}) {
  if (
    !active ||
    !payload ||
    !payload.length
  ) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold mb-1">
        {label}
      </p>

      {payload.map(
        (
          item
        ) => (
          <p
            key={
              item.dataKey
            }
            className="text-xs text-muted-foreground"
          >
            {item.name ||
              item.dataKey}
            :{' '}
            <span className="font-semibold text-foreground">
              {item.value}
            </span>
          </p>
        )
      )}
    </div>
  );
}


/* ============================================================
   MAIN PAGE
   ============================================================ */

export default function Progress() {
  const {
    data: user,
    isLoading:
      userLoading,
  } = useQuery({
    queryKey: [
      'current-user',
    ],

    queryFn: () =>
      supabaseApi.auth.me(),
  });


  const plan =
    user?.subscription_plan ||
    'free';


  const hasWorkoutAnalytics =
    canAccess(
      plan,
      'workout_analytics'
    );


  const {
    data: logs = [],
    isLoading:
      logsLoading,
  } = useQuery({
    queryKey: [
      'logs',
    ],

    queryFn: () =>
      supabaseApi.entities.WorkoutLog.list(
        '-date',
        200
      ),
  });


  const {
    data: nutrition = [],
  } = useQuery({
    queryKey: [
      'nutrition-all',
    ],

    queryFn: () =>
      supabaseApi.entities.NutritionEntry.list(
        '-date',
        200
      ),
  });


  /* ==========================================================
     BASE STATS
     ========================================================== */

  const totalWorkouts =
    logs.length;


  const totalMinutes =
    logs.reduce(
      (
        total,
        log
      ) =>
        total +
        (
          Number(
            log?.duration_minutes
          ) || 0
        ),
      0
    );


  const totalSets =
    logs.reduce(
      (
        total,
        log
      ) =>
        total +
        getCompletedSets(
          log
        ),
      0
    );


  const totalLoggedReps =
    logs.reduce(
      (
        total,
        log
      ) =>
        total +
        getLoggedReps(
          log
        ),
      0
    );


  const streak =
    calculateStreak(
      logs
    );


  /* ==========================================================
     WEEKLY DATA
     ========================================================== */

  const weeklyData =
    useMemo(
      () =>
        buildWeeklyData(
          logs,
          8
        ),
      [logs]
    );


  const currentWeek =
    weeklyData[
      weeklyData.length - 1
    ] || {
      workouts: 0,
      minutes: 0,
      sets: 0,
      reps: 0,
    };


  const previousWeek =
    weeklyData[
      weeklyData.length - 2
    ] || {
      workouts: 0,
      minutes: 0,
      sets: 0,
      reps: 0,
    };


  const workoutTrend =
    getTrend(
      currentWeek.workouts,
      previousWeek.workouts
    );


  const volumeTrend =
    getTrend(
      currentWeek.sets,
      previousWeek.sets
    );


  const timeTrend =
    getTrend(
      currentWeek.minutes,
      previousWeek.minutes
    );


  /* ==========================================================
     EXERCISE DATA
     ========================================================== */

  const exerciseAnalytics =
    useMemo(
      () =>
        buildExerciseAnalytics(
          logs
        ),
      [logs]
    );


  const uniqueExercises =
    exerciseAnalytics.length;


  const mostTrainedExercise =
    exerciseAnalytics[0] ||
    null;


  /* ==========================================================
     NUTRITION
     ========================================================== */

  const calorieData =
    useMemo(
      () =>
        buildNutritionData(
          nutrition
        ),
      [nutrition]
    );


  const nutritionDays =
    calorieData.filter(
      (day) =>
        day.calories >
        0
    );


  const averageCalories =
    nutritionDays.length
      ? Math.round(
          nutritionDays.reduce(
            (
              total,
              day
            ) =>
              total +
              day.calories,
            0
          ) /
            nutritionDays.length
        )
      : 0;


  const averageProtein =
    nutritionDays.length
      ? Math.round(
          nutritionDays.reduce(
            (
              total,
              day
            ) =>
              total +
              day.protein,
            0
          ) /
            nutritionDays.length
        )
      : 0;


  /* ==========================================================
     BEST WEEK
     ========================================================== */

  const bestWeek =
    weeklyData.reduce(
      (
        best,
        week
      ) =>
        week.workouts >
        best.workouts
          ? week
          : best,
      {
        workouts: 0,
        minutes: 0,
        sets: 0,
        reps: 0,
      }
    );


  /* ==========================================================
     STATS
     ========================================================== */

  const stats = [
    {
      label:
        'Total Workouts',

      value:
        totalWorkouts,

      icon:
        Trophy,

      color:
        'text-primary',
    },

    {
      label:
        'Current Streak',

      value:
        `${streak} days`,

      icon:
        Flame,

      color:
        'text-accent',
    },

    {
      label:
        'Training Time',

      value:
        `${totalMinutes} min`,

      icon:
        Clock,

      color:
        'text-chart-4',
    },
  ];


  /* ==========================================================
     LOADING
     ========================================================== */

  if (
    userLoading ||
    logsLoading
  ) {
    return (
      <div className="px-5 pb-4">
        <PageHeader
          title="Progress"
          subtitle="Your journey at a glance"
        />

        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }


  /* ==========================================================
     PAGE
     ========================================================== */

  return (
    <div className="px-5 pb-24">
      <PageHeader
        title="Progress"
        subtitle="Your journey at a glance"
      />

      <div className="mb-5" />


      {/* ======================================================
          OVERVIEW
          ====================================================== */}

      <div className="grid grid-cols-3 gap-3 mb-6">
        {stats.map(
          ({
            label,
            value,
            icon:
              Icon,
            color,
          }) => (
            <Card
              key={
                label
              }
              className="p-3 text-center"
            >
              <Icon
                className={`w-5 h-5 ${color} mx-auto mb-1`}
              />

              <p className="font-heading font-bold text-lg">
                {value}
              </p>

              <p className="text-[10px] text-muted-foreground">
                {label}
              </p>
            </Card>
          )
        )}
      </div>


      {/* ======================================================
          WEEKLY WORKOUT TREND
          ====================================================== */}

      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />

            <div>
              <p className="font-heading font-bold text-sm">
                Training Consistency
              </p>

              <p className="text-[10px] text-muted-foreground">
                Workouts across the last 8 weeks
              </p>
            </div>
          </div>

          {hasWorkoutAnalytics && (
            <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full">
              Performance
            </span>
          )}
        </div>

        <ResponsiveContainer
          width="100%"
          height={180}
        >
          <BarChart
            data={
              weeklyData
            }
          >
            <XAxis
              dataKey="label"
              tick={{
                fontSize: 10,
                fill: 'hsl(var(--muted-foreground))',
              }}
              axisLine={
                false
              }
              tickLine={
                false
              }
            />

            <YAxis
              hide
            />

            <Tooltip
              content={
                <ChartTooltip />
              }
            />

            <Bar
              dataKey="workouts"
              name="Workouts"
              fill="hsl(var(--primary))"
              radius={[
                4,
                4,
                0,
                0,
              ]}
            />
          </BarChart>
        </ResponsiveContainer>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="rounded-lg bg-muted/40 p-2.5">
            <p className="text-[10px] text-muted-foreground">
              This week
            </p>

            <p className="font-heading font-bold text-base">
              {
                currentWeek.workouts
              }
            </p>
          </div>

          <div className="rounded-lg bg-muted/40 p-2.5">
            <p className="text-[10px] text-muted-foreground">
              Avg / week
            </p>

            <p className="font-heading font-bold text-base">
              {(
                weeklyData.reduce(
                  (
                    total,
                    week
                  ) =>
                    total +
                    week.workouts,
                  0
                ) /
                Math.max(
                  1,
                  weeklyData.length
                )
              ).toFixed(1)}
            </p>
          </div>

          <div className="rounded-lg bg-muted/40 p-2.5">
            <p className="text-[10px] text-muted-foreground">
              Best week
            </p>

            <p className="font-heading font-bold text-base">
              {
                bestWeek.workouts
              }
            </p>
          </div>
        </div>
      </Card>


      {/* ======================================================
          PERFORMANCE ANALYTICS
          ====================================================== */}

      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-chart-4" />

            <div>
              <p className="font-heading font-bold text-sm">
                Workout Analytics
              </p>

              <p className="text-[10px] text-muted-foreground">
                Your training performance and workload
              </p>
            </div>
          </div>

          {!hasWorkoutAnalytics && (
            <Lock className="w-4 h-4 text-muted-foreground" />
          )}
        </div>


        {hasWorkoutAnalytics ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays className="w-3.5 h-3.5 text-primary" />

                  <p className="text-[10px] text-muted-foreground">
                    This week
                  </p>
                </div>

                <p className="font-heading font-bold text-xl">
                  {
                    currentWeek.workouts
                  }
                </p>

                <p className="text-[10px] text-muted-foreground mt-0.5">
                  workouts
                </p>

                {workoutTrend.direction !==
                  'flat' && (
                  <p className="text-[10px] text-primary mt-1">
                    {workoutTrend.direction ===
                    'up'
                      ? '↑'
                      : '↓'}{' '}
                    {workoutTrend.percent}% vs last week
                  </p>
                )}
              </div>


              <div className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Timer className="w-3.5 h-3.5 text-chart-4" />

                  <p className="text-[10px] text-muted-foreground">
                    Avg session
                  </p>
                </div>

                <p className="font-heading font-bold text-xl">
                  {totalWorkouts
                    ? Math.round(
                        totalMinutes /
                          totalWorkouts
                      )
                    : 0}
                </p>

                <p className="text-[10px] text-muted-foreground mt-0.5">
                  minutes
                </p>

                {timeTrend.direction !==
                  'flat' && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {timeTrend.direction ===
                    'up'
                      ? '↑'
                      : '↓'}{' '}
                    {timeTrend.percent}% this week
                  </p>
                )}
              </div>


              <div className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Dumbbell className="w-3.5 h-3.5 text-accent" />

                  <p className="text-[10px] text-muted-foreground">
                    Logged sets
                  </p>
                </div>

                <p className="font-heading font-bold text-xl">
                  {
                    totalSets
                  }
                </p>

                <p className="text-[10px] text-muted-foreground mt-0.5">
                  completed
                </p>
              </div>


              <div className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Repeat2 className="w-3.5 h-3.5 text-primary" />

                  <p className="text-[10px] text-muted-foreground">
                    Logged reps
                  </p>
                </div>

                <p className="font-heading font-bold text-xl">
                  {
                    totalLoggedReps
                  }
                </p>

                <p className="text-[10px] text-muted-foreground mt-0.5">
                  numeric reps
                </p>
              </div>
            </div>


            <div className="mt-3 rounded-xl bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold">
                    Weekly training volume
                  </p>

                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Completed sets compared with the previous week
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-heading font-bold text-lg">
                    {
                      currentWeek.sets
                    }
                  </p>

                  {volumeTrend.direction !==
                    'flat' && (
                    <p className="text-[10px] text-primary">
                      {volumeTrend.direction ===
                      'up'
                        ? '↑'
                        : '↓'}{' '}
                      {volumeTrend.percent}%
                    </p>
                  )}
                </div>
              </div>
            </div>


            <div className="mt-3 rounded-xl border border-border p-3">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-accent" />

                <div>
                  <p className="text-xs font-semibold">
                    Exercise history
                  </p>

                  <p className="text-[10px] text-muted-foreground">
                    Exercises you've actually logged
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-lg bg-muted/40 p-2.5">
                  <p className="text-[10px] text-muted-foreground">
                    Exercises
                  </p>

                  <p className="font-heading font-bold text-base">
                    {
                      uniqueExercises
                    }
                  </p>
                </div>

                <div className="rounded-lg bg-muted/40 p-2.5">
                  <p className="text-[10px] text-muted-foreground">
                    Most trained
                  </p>

                  <p className="font-heading font-bold text-sm truncate">
                    {mostTrainedExercise
                      ?.name ||
                      '—'}
                  </p>
                </div>
              </div>


              {exerciseAnalytics.length >
              0 ? (
                <div className="space-y-2">
                  {exerciseAnalytics
                    .slice(
                      0,
                      6
                    )
                    .map(
                      (
                        exercise
                      ) => (
                        <div
                          key={
                            normalizeExerciseName(
                              exercise.name
                            )
                          }
                          className="flex items-center justify-between gap-3 py-1"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">
                              {
                                exercise.name
                              }
                            </p>

                            <p className="text-[10px] text-muted-foreground">
                              {
                                exercise.sessions
                              }{' '}
                              session
                              {exercise.sessions ===
                              1
                                ? ''
                                : 's'}
                              {' · '}
                              {
                                exercise.sets
                              }{' '}
                              sets
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-xs font-semibold">
                              {
                                exercise.reps ||
                                '—'
                              }
                            </p>

                            <p className="text-[9px] text-muted-foreground">
                              numeric reps
                            </p>
                          </div>
                        </div>
                      )
                    )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-3">
                  Complete a workout to start building exercise history.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-5 text-center">
            <Lock className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />

            <p className="font-heading font-bold text-sm">
              Performance Analytics
            </p>

            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Upgrade to Performance to unlock detailed training workload,
              consistency, session, set, rep, and exercise analytics.
            </p>
          </div>
        )}
      </Card>


      {/* ======================================================
          NUTRITION PERFORMANCE SNAPSHOT
          ====================================================== */}

      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-accent" />

            <div>
              <p className="font-heading font-bold text-sm">
                Nutrition Snapshot
              </p>

              <p className="text-[10px] text-muted-foreground">
                Your last 7 days of logged nutrition
              </p>
            </div>
          </div>

          {!hasWorkoutAnalytics && (
            <Lock className="w-4 h-4 text-muted-foreground" />
          )}
        </div>


        {hasWorkoutAnalytics ? (
          <>
            <ResponsiveContainer
              width="100%"
              height={160}
            >
              <BarChart
                data={
                  calorieData
                }
              >
                <XAxis
                  dataKey="day"
                  tick={{
                    fontSize: 10,
                    fill: 'hsl(var(--muted-foreground))',
                  }}
                  axisLine={
                    false
                  }
                  tickLine={
                    false
                  }
                />

                <YAxis
                  hide
                />

                <Tooltip
                  content={
                    <ChartTooltip />
                  }
                />

                <Bar
                  dataKey="calories"
                  name="Calories"
                  fill="hsl(var(--accent))"
                  radius={[
                    4,
                    4,
                    0,
                    0,
                  ]}
                />
              </BarChart>
            </ResponsiveContainer>


            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="rounded-xl border border-border p-3">
                <p className="text-[10px] text-muted-foreground">
                  Avg calories
                </p>

                <p className="font-heading font-bold text-xl">
                  {
                    averageCalories
                  }
                </p>

                <p className="text-[10px] text-muted-foreground">
                  per logged day
                </p>
              </div>

              <div className="rounded-xl border border-border p-3">
                <p className="text-[10px] text-muted-foreground">
                  Avg protein
                </p>

                <p className="font-heading font-bold text-xl">
                  {
                    averageProtein
                  }g
                </p>

                <p className="text-[10px] text-muted-foreground">
                  per logged day
                </p>
              </div>
            </div>


            <div className="mt-3 rounded-xl bg-muted/40 p-3">
              <p className="text-[10px] text-muted-foreground">
                Nutrition days logged
              </p>

              <p className="font-heading font-bold text-lg">
                {
                  nutritionDays.length
                } / 7
              </p>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-5 text-center">
            <Lock className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />

            <p className="font-heading font-bold text-sm">
              Performance Nutrition Analytics
            </p>

            <p className="text-xs text-muted-foreground mt-1">
              Upgrade to Performance to see nutrition trends and deeper
              training analytics together.
            </p>
          </div>
        )}
      </Card>


      {/* ======================================================
          TRAINING LOAD SUMMARY
          ====================================================== */}

      {hasWorkoutAnalytics && (
        <Card className="p-4 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-primary" />

            <div>
              <p className="font-heading font-bold text-sm">
                Training Load Summary
              </p>

              <p className="text-[10px] text-muted-foreground">
                Your recent completed-workout workload
              </p>
            </div>
          </div>


          <div className="space-y-3">
            {weeklyData
              .slice(
                -4
              )
              .map(
                (
                  week
                ) => {
                  const maxWorkouts =
                    Math.max(
                      ...weeklyData.map(
                        (
                          item
                        ) =>
                          item.workouts
                      ),
                      1
                    );

                  const percentage =
                    Math.round(
                      (
                        week.workouts /
                        maxWorkouts
                      ) *
                        100
                    );

                  return (
                    <div
                      key={
                        week.key
                      }
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground">
                          {
                            week.label
                          }
                        </span>

                        <span className="text-[10px] font-semibold">
                          {
                            week.workouts
                          }{' '}
                          workouts ·{' '}
                          {
                            week.sets
                          }{' '}
                          sets
                        </span>
                      </div>

                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{
                            width: `${percentage}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                }
              )}
          </div>
        </Card>
      )}


      {/* ======================================================
          BASIC PROGRESS MESSAGE
          ====================================================== */}

      {!hasWorkoutAnalytics && (
        <Card className="p-4 border-primary/20 bg-primary/5">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-primary shrink-0 mt-0.5" />

            <div>
              <p className="font-heading font-bold text-sm">
                Keep building your history
              </p>

              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Your workouts and nutrition entries are already being saved.
                Performance unlocks the deeper analytics layer so you can see
                training consistency, workload, exercise history, nutrition
                trends, and week-to-week changes in one place.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
