import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabaseApi } from '@/lib/supabaseApi';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Dumbbell,
  CalendarDays,
  Repeat2,
  Activity,
  Flame,
  Utensils,
} from 'lucide-react';
import { useAppSettings } from '@/lib/AppSettingsContext';


// ============================================================
// WEEK HELPERS
// ============================================================

// Monday of the current week as YYYY-MM-DD
function getWeekStart() {
  const d = new Date();
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;

  d.setDate(d.getDate() + diff);

  return d.toISOString().split('T')[0];
}


// Normalize week numbers because Supabase/JSON may return
// either 1 or "1".
function normalizeWeekNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}


// Safely convert something to a number.
function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}


// ============================================================
// COMPONENT
// ============================================================

export default function WeeklyUpdate({
  logs = [],
  nutrition = [],
  photos = [],
  user,
  program,
}) {
  const { settings } = useAppSettings();

  const [open, setOpen] = useState(false);
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alreadyGenerated, setAlreadyGenerated] = useState(false);

  const weekStartStr = getWeekStart();


  // ==========================================================
  // WEEK DATA
  // ==========================================================

  const weekLogs = useMemo(() => {
    if (!Array.isArray(logs)) return [];

    return logs.filter((log) => {
      if (!log?.date) return false;

      return String(log.date).slice(0, 10) >= weekStartStr;
    });
  }, [logs, weekStartStr]);


  const weekNutrition = useMemo(() => {
    if (!Array.isArray(nutrition)) return [];

    return nutrition.filter((entry) => {
      if (!entry?.date) return false;

      return String(entry.date).slice(0, 10) >= weekStartStr;
    });
  }, [nutrition, weekStartStr]);


  const recentPhotos = Array.isArray(photos)
    ? photos.slice(0, 3)
    : [];


  // ==========================================================
  // WEEKLY NUMBERS
  //
  // These are calculated locally.
  //
  // NO AI COST.
  // ==========================================================

  const weeklyStats = useMemo(() => {
    const workoutCount = weekLogs.length;

    const trainingDates = [
      ...new Set(
        weekLogs
          .map((log) => String(log?.date || '').slice(0, 10))
          .filter(Boolean)
      ),
    ];

    let exerciseCount = 0;
    let totalSets = 0;
    let totalReps = 0;

    const exerciseNames = [];

    weekLogs.forEach((log) => {
      const exercises = Array.isArray(
        log?.exercises_completed
      )
        ? log.exercises_completed
        : [];

      exerciseCount += exercises.length;

      exercises.forEach((exercise) => {
        const sets = toNumber(
          exercise?.sets_completed
        );

        const reps = toNumber(
          exercise?.reps_achieved
        );

        totalSets += sets;
        totalReps += reps;

        if (exercise?.name) {
          exerciseNames.push(exercise.name);
        }
      });
    });


    const checkinCount = weekLogs.filter(
      (log) =>
        typeof log?.post_workout_checkin === 'string' &&
        log.post_workout_checkin.trim().length > 0
    ).length;


    const nutritionDates = [
      ...new Set(
        weekNutrition
          .map((entry) =>
            String(entry?.date || '').slice(0, 10)
          )
          .filter(Boolean)
      ),
    ];


    const totalCalories = weekNutrition.reduce(
      (sum, entry) =>
        sum + toNumber(entry?.calories),
      0
    );


    const daysWithNutrition =
      nutritionDates.length;


    const averageCalories =
      daysWithNutrition > 0
        ? Math.round(
            totalCalories / daysWithNutrition
          )
        : 0;


    const photoBf = recentPhotos
      .filter(
        (photo) =>
          photo?.body_fat_estimate != null
      )
      .map(
        (photo) =>
          photo.body_fat_estimate
      );


    return {
      workoutCount,
      trainingDays: trainingDates.length,
      exerciseCount,
      totalSets,
      totalReps,
      checkinCount,
      daysWithNutrition,
      totalCalories,
      averageCalories,
      bodyFatReadings: photoBf,
      exerciseNames,
    };
  }, [
    weekLogs,
    weekNutrition,
    recentPhotos,
  ]);


  // ==========================================================
  // WEEKLY SUMMARY TEXT
  // ==========================================================

  const weeklySummary = useMemo(() => {
    const {
      workoutCount,
      trainingDays,
      exerciseCount,
      totalSets,
      totalReps,
    } = weeklyStats;


    if (workoutCount === 0) {
      return 'No completed workouts have been logged this week yet.';
    }


    const workoutWord =
      workoutCount === 1
        ? 'workout'
        : 'workouts';


    const dayWord =
      trainingDays === 1
        ? 'training day'
        : 'training days';


    const exerciseWord =
      exerciseCount === 1
        ? 'exercise'
        : 'exercises';


    const setWord =
      totalSets === 1
        ? 'set'
        : 'sets';


    const repWord =
      totalReps === 1
        ? 'rep'
        : 'reps';


    return (
      `You completed ${workoutCount} ${workoutWord} ` +
      `across ${trainingDays} ${dayWord}, ` +
      `with ${exerciseCount} ${exerciseWord}, ` +
      `${totalSets} ${setWord}, and ${totalReps} ${repWord}.`
    );
  }, [weeklyStats]);


  // ==========================================================
  // CACHE
  // ==========================================================

  const cacheKey =
    `weekly_insight_${weekStartStr}_${user?.id || 'u'}`;


  useEffect(() => {
    const cached =
      localStorage.getItem(cacheKey);

    if (!cached) return;

    try {
      const parsed = JSON.parse(cached);

      setInsight(parsed);
      setAlreadyGenerated(true);
    } catch {
      // Ignore invalid cached data.
    }
  }, [cacheKey]);


  const hasEnoughData =
    weeklyStats.workoutCount >= 1;


  // ==========================================================
  // GENERATE KAEL UPDATE
  // ==========================================================

  const generate = async () => {
    if (alreadyGenerated || loading) return;

    setLoading(true);


    try {
      const lang =
        settings.language || 'English';

      const unit =
        settings.unit || 'imperial';


      // ------------------------------------------------------
      // CHECK-INS
      // ------------------------------------------------------

      const checkins = weekLogs
        .map(
          (log) =>
            log?.post_workout_checkin
        )
        .filter(Boolean)
        .join('\n---\n') ||
        'No check-ins logged this week.';


      // ------------------------------------------------------
      // EXERCISES
      // ------------------------------------------------------

      const exerciseSummary = weekLogs
        .flatMap((log) =>
          (
            Array.isArray(
              log?.exercises_completed
            )
              ? log.exercises_completed
              : []
          ).map(
            (exercise) =>
              `${exercise?.name || 'Exercise'}: ` +
              `${exercise?.sets_completed || 0}×` +
              `${exercise?.reps_achieved || 0}`
          )
        )
        .join(', ') ||
        'No exercises logged';


      // ------------------------------------------------------
      // PAIN / DISCOMFORT
      // ------------------------------------------------------

      const painMentions = weekLogs
        .map(
          (log) =>
            log?.post_workout_checkin
        )
        .filter(Boolean)
        .filter((checkin) =>
          /pain|hurt|sore|tight|ache|injury|strain/i.test(
            checkin
          )
        )
        .join(' | ');


      // ------------------------------------------------------
      // BODY COMPOSITION
      // ------------------------------------------------------

      const photoBf = recentPhotos
        .filter(
          (photo) =>
            photo?.body_fat_estimate
        )
        .map(
          (photo) =>
            photo.body_fat_estimate
        )
        .join(', ');


      // ------------------------------------------------------
      // CURRENT / NEXT WEEK
      // ------------------------------------------------------

      const currentWeek =
        normalizeWeekNumber(
          program?.current_week
        ) || 1;


      const nextWeekNumber =
        currentWeek + 1;


      const nextMicro =
        Array.isArray(
          program?.microcycles
        )
          ? program.microcycles.find(
              (microcycle) =>
                normalizeWeekNumber(
                  microcycle?.week_number
                ) === nextWeekNumber
            )
          : null;


      // ------------------------------------------------------
      // TRAINING TYPE
      // ------------------------------------------------------

      const trainingType =
        user?.training_type ||
        program?.training_type ||
        'calisthenics';


      const typeLabel =
        {
          calisthenics:
            'calisthenics',

          weighted_calisthenics:
            'weighted calisthenics',

          weights:
            'weight training',

          hybrid:
            'hybrid training (calisthenics + weights)',
        }[trainingType] ||
        trainingType;


      // ------------------------------------------------------
      // PROMPT
      // ------------------------------------------------------

      const prompt = `
You are Kael, a straight-talking, knowledgeable ${typeLabel} coach.

Give a weekly check-in summary for this athlete.

Respond ENTIRELY in ${lang}.

ATHLETE:
${user?.full_name?.split(' ')[0] || 'Athlete'}

LEVEL:
${user?.fitness_level || 'intermediate'}

TRAINING TYPE:
${typeLabel}

GOALS:
${
  user?.fitness_goals?.join(', ') ||
  user?.weight_goals?.join(', ') ||
  user?.primary_goal ||
  'general fitness'
}

WEEK START:
${weekStartStr}

============================================================
ACTUAL WEEKLY PERFORMANCE
============================================================

WORKOUTS COMPLETED:
${weeklyStats.workoutCount}

TRAINING DAYS:
${weeklyStats.trainingDays}

EXERCISES COMPLETED:
${weeklyStats.exerciseCount}

SETS COMPLETED:
${weeklyStats.totalSets}

REPS COMPLETED:
${weeklyStats.totalReps}

POST-WORKOUT CHECK-INS:
${weeklyStats.checkinCount}

EXERCISES:
${exerciseSummary}

============================================================
ATHLETE FEEDBACK
============================================================

POST-WORKOUT CHECK-INS:
${checkins}

PAIN / DISCOMFORT:
${painMentions || 'none reported'}

============================================================
NUTRITION
============================================================

DAYS TRACKED:
${weeklyStats.daysWithNutrition}

TOTAL CALORIES:
${Math.round(weeklyStats.totalCalories)}

AVERAGE CALORIES:
${weeklyStats.averageCalories || 'not enough data'}

============================================================
BODY COMPOSITION
============================================================

BODY FAT READINGS:
${photoBf || 'no data'}

============================================================
PROGRAM
============================================================

PROGRAM:
${program?.program_name || 'custom'}

CURRENT WEEK:
${currentWeek}

MEASUREMENT SYSTEM:
${
  unit === 'metric'
    ? 'metric (kg, cm)'
    : 'imperial (lbs, ft)'
}

============================================================
INSTRUCTIONS
============================================================

Provide a concise, human weekly check-in.

Cover:

1. What they did well.
   Be specific and reference actual exercises,
   completed work, or their check-ins.

2. What to watch out for or improve.
   Be honest and reference actual struggles,
   fatigue, pain, or missed work when relevant.

3. A concrete recommendation for next week.

4. One short genuine motivational line.

Do NOT invent accomplishments that are not present
in the data.

Do NOT claim they completed workouts they did not log.

Do NOT diagnose injuries.

============================================================
NEXT WEEK PROGRAM
============================================================

${
  nextMicro
    ? JSON.stringify(
        nextMicro,
        null,
        2
      )
    : 'none'
}

If a NEXT WEEK PROGRAM exists, return an adjusted version:

- If they struggled with something:
  reduce volume/reps by 10-20% on those movements.

- If they mentioned pain in a movement:
  remove that movement or replace it with a safer variation.

- If they performed well:
  increase reps/sets slightly or use a harder progression.

- Keep the overall weekly structure the same.

- Do not make unreasonable jumps in volume or intensity.

- Preserve the appropriate rep ranges and rest periods
  for the training goal.

Return JSON only.
`;


      // ------------------------------------------------------
      // AI REQUEST
      // ------------------------------------------------------

      const result =
        await supabaseApi.ai.invoke({
          type: 'weekly_update',
          prompt,

          response_json_schema: {
            type: 'object',

            properties: {
              win: {
                type: 'string',
              },

              improve: {
                type: 'string',
              },

              next_recommendation: {
                type: 'string',
              },

              motivation: {
                type: 'string',
              },

              adjusted_microcycle: {
                type: 'object',
              },
            },

            required: [
              'win',
              'improve',
              'next_recommendation',
              'motivation',
            ],
          },
        });


      // ------------------------------------------------------
      // UPDATE NEXT WEEK
      // ------------------------------------------------------

      if (
        result?.adjusted_microcycle &&
        nextMicro &&
        program
      ) {
        const updatedMicrocycles =
          program.microcycles.map(
            (microcycle) =>
              normalizeWeekNumber(
                microcycle?.week_number
              ) === nextWeekNumber
                ? {
                    ...result.adjusted_microcycle,

                    // Make sure the week number isn't
                    // accidentally lost when Kael returns
                    // the adjusted object.
                    week_number:
                      nextWeekNumber,
                  }
                : microcycle
          );


        await supabaseApi.entities.WorkoutProgram.update(
          program.id,
          {
            microcycles:
              updatedMicrocycles,
          }
        );
      }


      // ------------------------------------------------------
      // CACHE DISPLAY RESULT
      // ------------------------------------------------------

      const {
        adjusted_microcycle,
        ...displayResult
      } = result || {};


      localStorage.setItem(
        cacheKey,
        JSON.stringify(
          displayResult
        )
      );


      setInsight(displayResult);
      setAlreadyGenerated(true);
    } catch (error) {
      console.error(
        'Weekly Kael update failed:',
        error
      );
    } finally {
      setLoading(false);
    }
  };


  // ============================================================
  // RENDER
  // ============================================================

  return (
    <Card className="p-4 border-primary/20 bg-primary/5">

      {/* ======================================================
          HEADER
          ====================================================== */}

      <button
        onClick={() =>
          setOpen((value) => !value)
        }
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">

          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>

          <div className="text-left">

            <p className="font-heading font-bold text-sm">
              Weekly Check-in from Kael
            </p>

            <p className="text-xs text-muted-foreground">
              {alreadyGenerated
                ? "This week's update is ready"
                : `${weeklyStats.workoutCount} workout${
                    weeklyStats.workoutCount !== 1
                      ? 's'
                      : ''
                  } logged · tap to view`}
            </p>

          </div>
        </div>

        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>


      {/* ======================================================
          OPEN CONTENT
          ====================================================== */}

      {open && (
        <div className="mt-4 space-y-4">

          {/* ==================================================
              WEEKLY SUMMARY
              ================================================== */}

          <div className="space-y-2">

            <div className="flex items-center justify-between">

              <div>
                <p className="font-heading font-bold text-sm">
                  Your Week
                </p>

                <p className="text-[11px] text-muted-foreground mt-0.5">
                  A snapshot of what you actually completed
                </p>
              </div>

              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <CalendarDays className="w-3 h-3" />
                <span>
                  Week of {weekStartStr}
                </span>
              </div>

            </div>


            {/* Main summary sentence */}

            <div className="p-3 rounded-xl bg-background/70 border border-border">

              <p className="text-sm leading-relaxed">
                {weeklySummary}
              </p>

            </div>


            {/* =================================================
                STAT GRID
                ================================================= */}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">

              {/* Workouts */}

              <div className="p-3 rounded-xl bg-background/70 border border-border">

                <div className="flex items-center gap-2">

                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Dumbbell className="w-3.5 h-3.5 text-primary" />
                  </div>

                  <div>
                    <p className="text-lg font-heading font-bold leading-none">
                      {weeklyStats.workoutCount}
                    </p>

                    <p className="text-[10px] text-muted-foreground mt-1">
                      Workouts
                    </p>
                  </div>

                </div>

              </div>


              {/* Training Days */}

              <div className="p-3 rounded-xl bg-background/70 border border-border">

                <div className="flex items-center gap-2">

                  <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                    <CalendarDays className="w-3.5 h-3.5 text-accent" />
                  </div>

                  <div>
                    <p className="text-lg font-heading font-bold leading-none">
                      {weeklyStats.trainingDays}
                    </p>

                    <p className="text-[10px] text-muted-foreground mt-1">
                      Training days
                    </p>
                  </div>

                </div>

              </div>


              {/* Sets */}

              <div className="p-3 rounded-xl bg-background/70 border border-border">

                <div className="flex items-center gap-2">

                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Repeat2 className="w-3.5 h-3.5 text-primary" />
                  </div>

                  <div>
                    <p className="text-lg font-heading font-bold leading-none">
                      {weeklyStats.totalSets}
                    </p>

                    <p className="text-[10px] text-muted-foreground mt-1">
                      Sets
                    </p>
                  </div>

                </div>

              </div>


              {/* Reps */}

              <div className="p-3 rounded-xl bg-background/70 border border-border">

                <div className="flex items-center gap-2">

                  <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Activity className="w-3.5 h-3.5 text-accent" />
                  </div>

                  <div>
                    <p className="text-lg font-heading font-bold leading-none">
                      {weeklyStats.totalReps}
                    </p>

                    <p className="text-[10px] text-muted-foreground mt-1">
                      Reps
                    </p>
                  </div>

                </div>

              </div>

            </div>


            {/* =================================================
                SECONDARY STATS
                ================================================= */}

            <div className="grid grid-cols-2 gap-2">

              {/* Check-ins */}

              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background/50 border border-border/60">

                <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />

                <div>
                  <p className="text-xs font-semibold">
                    {weeklyStats.checkinCount}{' '}
                    post-workout check-in
                    {weeklyStats.checkinCount !== 1
                      ? 's'
                      : ''}
                  </p>

                  <p className="text-[10px] text-muted-foreground">
                    Athlete feedback logged
                  </p>
                </div>

              </div>


              {/* Nutrition */}

              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background/50 border border-border/60">

                <Utensils className="w-3.5 h-3.5 text-primary shrink-0" />

                <div>

                  <p className="text-xs font-semibold">
                    {weeklyStats.daysWithNutrition}{' '}
                    nutrition day
                    {weeklyStats.daysWithNutrition !== 1
                      ? 's'
                      : ''}
                  </p>

                  <p className="text-[10px] text-muted-foreground">

                    {weeklyStats.averageCalories > 0
                      ? `~${weeklyStats.averageCalories.toLocaleString()} cal/day`
                      : 'No calorie average yet'}

                  </p>

                </div>

              </div>

            </div>

          </div>


          {/* ==================================================
              GENERATION STATE
              ================================================== */}

          {!insight && !loading && (
            <>
              {!hasEnoughData ? (

                <div className="p-3 rounded-xl bg-muted/40 border border-border text-center">

                  <p className="text-xs text-muted-foreground">
                    Complete at least 1 workout this week to
                    unlock your Kael check-in.
                  </p>

                </div>

              ) : (

                <Button
                  size="sm"
                  className="w-full"
                  onClick={generate}
                  disabled={loading}
                >
                  <Sparkles className="w-4 h-4 mr-2" />

                  Get This Week's Check-in
                </Button>

              )}
            </>
          )}


          {/* ==================================================
              LOADING
              ================================================== */}

          {loading && (

            <div className="p-3 rounded-xl bg-background/60 border border-border">

              <div className="flex items-center gap-2 text-sm text-muted-foreground">

                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />

                <span>
                  Kael is reviewing your week...
                </span>

              </div>

            </div>

          )}


          {/* ==================================================
              KAEL RESULTS
              ================================================== */}

          {insight && (

            <div className="space-y-3">

              {/* Lock indicator */}

              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/50 rounded-lg px-2 py-1.5 w-fit">

                <CheckCircle2 className="w-3 h-3 text-accent" />

                Generated for this week · resets Monday

              </div>


              {/* =================================================
                  WHAT YOU CRUSHED
                  ================================================= */}

              <div className="p-3 rounded-xl bg-accent/10 border border-accent/20">

                <p className="text-xs font-bold text-accent uppercase tracking-wider mb-1">
                  What you crushed 🔥
                </p>

                <p className="text-sm">
                  {insight.win}
                </p>

              </div>


              {/* =================================================
                  KEEP AN EYE ON
                  ================================================= */}

              <div className="p-3 rounded-xl bg-muted/50 border border-border">

                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Keep an eye on
                </p>

                <p className="text-sm">
                  {insight.improve}
                </p>

              </div>


              {/* =================================================
                  NEXT WEEK
                  ================================================= */}

              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">

                <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                  Next week
                </p>

                <p className="text-sm">
                  {insight.next_recommendation}
                </p>

              </div>


              {/* =================================================
                  MOTIVATION
                  ================================================= */}

              <p className="text-sm italic text-muted-foreground border-l-2 border-primary/40 pl-3">
                {insight.motivation}
              </p>


              {/* =================================================
                  NEXT WEEK PROGRAM UPDATED
                  ================================================= */}

              {Array.isArray(
                program?.microcycles
              ) &&
                program.microcycles.some(
                  (microcycle) =>
                    normalizeWeekNumber(
                      microcycle?.week_number
                    ) ===
                    (
                      normalizeWeekNumber(
                        program?.current_week
                      ) || 1
                    ) + 1
                ) && (

                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">

                    <Sparkles className="w-3 h-3 text-primary flex-shrink-0" />

                    Next week's workout has been adjusted
                    based on your feedback.

                  </div>

                )}

            </div>

          )}

        </div>
      )}

    </Card>
  );
}
