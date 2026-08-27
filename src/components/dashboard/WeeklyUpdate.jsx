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
  Utensils,
  AlertCircle,
} from 'lucide-react';
import { useAppSettings } from '@/lib/AppSettingsContext';


// ============================================================
// DATE / NUMBER HELPERS
// ============================================================

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  d.setDate(d.getDate() + diff);

  return d.toISOString().split('T')[0];
}


function normalizeWeekNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}


function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}


// ============================================================
// AI RESPONSE NORMALIZER
//
// Different OpenRouter/Supabase responses can sometimes be
// wrapped differently. This makes WeeklyUpdate tolerant of:
//
// { win, improve, next_recommendation, motivation }
//
// { result: { win, ... } }
//
// { data: { win, ... } }
//
// { result: "{\"win\":\"...\"}" }
//
// etc.
// ============================================================

function normalizeKaelResponse(raw) {
  let value = raw;

  // Unwrap common response wrappers.
  if (
    value &&
    typeof value === 'object' &&
    value.result !== undefined
  ) {
    value = value.result;
  }

  if (
    value &&
    typeof value === 'object' &&
    value.data !== undefined &&
    (
      typeof value.data === 'object' ||
      typeof value.data === 'string'
    )
  ) {
    value = value.data;
  }

  // Sometimes the AI result itself is a JSON string.
  if (typeof value === 'string') {
    const trimmed = value.trim();

    // Remove markdown JSON fences if the model returned them.
    const cleaned = trimmed
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      value = JSON.parse(cleaned);
    } catch {
      // If it is not JSON, keep the string so we can
      // attempt to extract useful information below.
      value = {
        raw_text: cleaned,
      };
    }
  }

  if (!value || typeof value !== 'object') {
    return {
      win: '',
      improve: '',
      next_recommendation: '',
      motivation: '',
      adjusted_microcycle: null,
    };
  }

  // Support a few alternate names in case the model/provider
  // changes field naming.
  const win =
    value.win ??
    value.what_you_crushed ??
    value.what_you_did_well ??
    value.strengths ??
    value.positive ??
    '';

  const improve =
    value.improve ??
    value.keep_an_eye_on ??
    value.what_to_improve ??
    value.improvements ??
    value.watch_out_for ??
    '';

  const nextRecommendation =
    value.next_recommendation ??
    value.next_week ??
    value.next_week_recommendation ??
    value.recommendation ??
    '';

  const motivation =
    value.motivation ??
    value.motivational_line ??
    value.motivational_message ??
    'Keep showing up. Consistency is what turns good weeks into real progress.';

  return {
    ...value,

    win:
      typeof win === 'string'
        ? win.trim()
        : String(win || '').trim(),

    improve:
      typeof improve === 'string'
        ? improve.trim()
        : String(improve || '').trim(),

    next_recommendation:
      typeof nextRecommendation === 'string'
        ? nextRecommendation.trim()
        : String(nextRecommendation || '').trim(),

    motivation:
      typeof motivation === 'string'
        ? motivation.trim()
        : String(motivation || '').trim(),

    adjusted_microcycle:
      value.adjusted_microcycle ?? null,
  };
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
  const [error, setError] = useState(null);

  const weekStartStr = getWeekStart();


  // ============================================================
  // WEEK LOGS
  // ============================================================

  const weekLogs = useMemo(() => {
    if (!Array.isArray(logs)) {
      return [];
    }

    return logs.filter((log) => {
      if (!log?.date) {
        return false;
      }

      const date = String(log.date).slice(0, 10);

      return date >= weekStartStr;
    });
  }, [logs, weekStartStr]);


  // ============================================================
  // WEEK NUTRITION
  // ============================================================

  const weekNutrition = useMemo(() => {
    if (!Array.isArray(nutrition)) {
      return [];
    }

    return nutrition.filter((entry) => {
      if (!entry?.date) {
        return false;
      }

      const date = String(entry.date).slice(0, 10);

      return date >= weekStartStr;
    });
  }, [nutrition, weekStartStr]);


  const recentPhotos = Array.isArray(photos)
    ? photos.slice(0, 3)
    : [];


  // ============================================================
  // WEEKLY STATS
  //
  // Calculated locally = NO AI COST.
  // ============================================================

  const weeklyStats = useMemo(() => {
    const workoutCount = weekLogs.length;

    const trainingDates = [
      ...new Set(
        weekLogs
          .map((log) =>
            String(log?.date || '').slice(0, 10)
          )
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
        totalSets += toNumber(
          exercise?.sets_completed
        );

        totalReps += toNumber(
          exercise?.reps_achieved
        );


        if (exercise?.name) {
          exerciseNames.push(
            exercise.name
          );
        }
      });
    });


    const checkinCount =
      weekLogs.filter((log) => {
        return (
          typeof log?.post_workout_checkin ===
            'string' &&
          log.post_workout_checkin.trim()
            .length > 0
        );
      }).length;


    const nutritionDates = [
      ...new Set(
        weekNutrition
          .map((entry) =>
            String(entry?.date || '').slice(0, 10)
          )
          .filter(Boolean)
      ),
    ];


    const totalCalories =
      weekNutrition.reduce(
        (sum, entry) =>
          sum +
          toNumber(entry?.calories),
        0
      );


    const daysWithNutrition =
      nutritionDates.length;


    const averageCalories =
      daysWithNutrition > 0
        ? Math.round(
            totalCalories /
              daysWithNutrition
          )
        : 0;


    const bodyFatReadings =
      recentPhotos
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
      trainingDays:
        trainingDates.length,
      exerciseCount,
      totalSets,
      totalReps,
      checkinCount,
      daysWithNutrition,
      totalCalories,
      averageCalories,
      bodyFatReadings,
      exerciseNames,
    };
  }, [
    weekLogs,
    weekNutrition,
    recentPhotos,
  ]);


  // ============================================================
  // WEEKLY SUMMARY
  // ============================================================

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
      `${totalSets} ${setWord}, and ` +
      `${totalReps} ${repWord}.`
    );
  }, [weeklyStats]);


  // ============================================================
  // CACHE
  // ============================================================

  const cacheKey =
    `weekly_insight_${weekStartStr}_${user?.id || 'u'}`;


  useEffect(() => {
    const cached =
      localStorage.getItem(cacheKey);


    if (!cached) {
      return;
    }


    try {
      const parsed =
        JSON.parse(cached);

      const normalized =
        normalizeKaelResponse(parsed);

      setInsight(normalized);
      setAlreadyGenerated(true);
    } catch (cacheError) {
      console.warn(
        'Unable to read cached Kael weekly update:',
        cacheError
      );

      localStorage.removeItem(cacheKey);
    }
  }, [cacheKey]);


  const hasEnoughData =
    weeklyStats.workoutCount >= 1;


  // ============================================================
  // GENERATE KAEL UPDATE
  // ============================================================

  const generate = async () => {
    if (alreadyGenerated || loading) {
      return;
    }


    setLoading(true);
    setError(null);


    try {
      const lang =
        settings?.language ||
        'English';


      const unit =
        settings?.unit ||
        'imperial';


      // --------------------------------------------------------
      // CHECK-INS
      // --------------------------------------------------------

      const checkins =
        weekLogs
          .map(
            (log) =>
              log?.post_workout_checkin
          )
          .filter(Boolean)
          .join('\n---\n') ||
        'No check-ins logged this week.';


      // --------------------------------------------------------
      // EXERCISE SUMMARY
      // --------------------------------------------------------

      const exerciseSummary =
        weekLogs
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


      // --------------------------------------------------------
      // PAIN / DISCOMFORT
      // --------------------------------------------------------

      const painMentions =
        weekLogs
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


      // --------------------------------------------------------
      // BODY COMPOSITION
      // --------------------------------------------------------

      const photoBf =
        recentPhotos
          .filter(
            (photo) =>
              photo?.body_fat_estimate != null
          )
          .map(
            (photo) =>
              photo.body_fat_estimate
          )
          .join(', ');


      // --------------------------------------------------------
      // CURRENT / NEXT WEEK
      // --------------------------------------------------------

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


      // --------------------------------------------------------
      // TRAINING TYPE
      // --------------------------------------------------------

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


      // --------------------------------------------------------
      // GOALS
      // --------------------------------------------------------

      const goals =
        user?.fitness_goals?.join(', ') ||
        user?.weight_goals?.join(', ') ||
        user?.primary_goal ||
        program?.goal ||
        'general fitness';


      // --------------------------------------------------------
      // PROMPT
      // --------------------------------------------------------

      const prompt = `
You are Kael, a straight-talking, knowledgeable ${typeLabel} coach.

Give a weekly coaching check-in for this athlete.

Respond ENTIRELY in ${lang}.

IMPORTANT:
Use ONLY the information supplied below.
Do not invent workouts, numbers, accomplishments,
pain, or progress that are not present in the data.

ATHLETE:
${user?.full_name?.split(' ')[0] || 'Athlete'}

FITNESS LEVEL:
${user?.fitness_level || 'intermediate'}

TRAINING TYPE:
${typeLabel}

GOALS:
${goals}

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

PAIN / DISCOMFORT MENTIONED:
${painMentions || 'none reported'}

============================================================
NUTRITION
============================================================

DAYS TRACKED:
${weeklyStats.daysWithNutrition}

AVERAGE CALORIES:
${weeklyStats.averageCalories || 'not enough data'}

============================================================
BODY COMPOSITION
============================================================

BODY FAT READINGS:
${photoBf || 'no data'}

============================================================
CURRENT PROGRAM
============================================================

PROGRAM:
${program?.program_name || 'custom'}

CURRENT WEEK:
${currentWeek}

============================================================
YOUR JOB
============================================================

Create a useful weekly coaching review.

SECTION 1 — WHAT YOU CRUSHED

Explain what the athlete did well this week.

Reference actual workouts, exercises,
sets/reps, consistency, or feedback.

SECTION 2 — KEEP AN EYE ON

Explain what could be improved or watched.

Reference actual fatigue, pain, difficulty,
missed work, recovery issues, or performance
when that information exists.

If there were no meaningful problems,
say so rather than inventing one.

SECTION 3 — NEXT WEEK

Give a concrete recommendation for next week
that moves the athlete toward their stated goals.

SECTION 4 — MOTIVATION

Give one short, genuine motivational line.

Keep everything concise, specific,
and coach-like.

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
    : 'No next week program available.'
}

If a next-week program exists, also return
an adjusted version only when the athlete's
actual performance or feedback justifies a change.

Adjustment rules:

- Struggled:
  reduce volume/reps by approximately 10-20%.

- Pain:
  remove the aggravating movement or use a
  safer appropriate variation.

- Strong performance:
  progress slightly through reps, sets,
  resistance, or exercise difficulty.

- Do not make unreasonable jumps.

- Preserve the athlete's training goal.

- Preserve appropriate rep ranges.

- Preserve appropriate rest periods.

- Do not change the entire program unnecessarily.

============================================================
REQUIRED RESPONSE
============================================================

Return ONLY valid JSON.

Use EXACTLY these top-level fields:

{
  "win": "specific description of what the athlete did well",
  "improve": "specific thing to watch or improve",
  "next_recommendation": "specific recommendation for next week",
  "motivation": "one short motivational line",
  "adjusted_microcycle": null
}

If the next week's program actually needs adjustment,
replace null with the complete adjusted microcycle object.

Do not rename these four coaching fields.
`;


      // --------------------------------------------------------
      // CALL AI
      // --------------------------------------------------------

      const rawResult =
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
                type: ['object', 'null'],
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


      console.log(
        '[Kael Weekly Update] Raw AI response:',
        rawResult
      );


      // --------------------------------------------------------
      // NORMALIZE RESPONSE
      // --------------------------------------------------------

      const result =
        normalizeKaelResponse(
          rawResult
        );


      console.log(
        '[Kael Weekly Update] Normalized response:',
        result
      );


      // --------------------------------------------------------
      // MAKE SURE THE FOUR SECTIONS ACTUALLY HAVE CONTENT
      // --------------------------------------------------------

      const finalResult = {
        ...result,

        win:
          result.win ||
          'You showed up and put work in this week. Keep building on that consistency.',

        improve:
          result.improve ||
          'Keep paying attention to how your body and performance respond to the training.',

        next_recommendation:
          result.next_recommendation ||
          'Continue progressing gradually next week while keeping your technique and recovery a priority.',

        motivation:
          result.motivation ||
          'Keep stacking good weeks. That is how the bigger goal gets built.',
      };


      // --------------------------------------------------------
      // UPDATE NEXT WEEK'S PROGRAM
      // --------------------------------------------------------

      const adjustedMicrocycle =
        result.adjusted_microcycle;


      if (
        adjustedMicrocycle &&
        nextMicro &&
        program &&
        Array.isArray(
          program.microcycles
        )
      ) {
        const updatedMicrocycles =
          program.microcycles.map(
            (microcycle) => {
              const weekNumber =
                normalizeWeekNumber(
                  microcycle?.week_number
                );


              if (
                weekNumber !==
                nextWeekNumber
              ) {
                return microcycle;
              }


              return {
                ...adjustedMicrocycle,

                week_number:
                  nextWeekNumber,

                mesocycle_index:
                  adjustedMicrocycle.mesocycle_index ??
                  microcycle.mesocycle_index,
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
      }


      // --------------------------------------------------------
      // CACHE ONLY THE DISPLAY DATA
      //
      // We intentionally do not cache the adjusted program
      // object in localStorage.
      // --------------------------------------------------------

      const displayResult = {
        win:
          finalResult.win,

        improve:
          finalResult.improve,

        next_recommendation:
          finalResult.next_recommendation,

        motivation:
          finalResult.motivation,
      };


      localStorage.setItem(
        cacheKey,
        JSON.stringify(
          displayResult
        )
      );


      setInsight(displayResult);
      setAlreadyGenerated(true);
    } catch (generationError) {
      console.error(
        '[Kael Weekly Update] Generation failed:',
        generationError
      );


      setError(
        generationError?.message ||
        'Kael could not generate your weekly update right now.'
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
          setOpen(
            (value) => !value
          )
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
          CONTENT
          ====================================================== */}

      {open && (

        <div className="mt-4 space-y-4">


          {/* ==================================================
              YOUR WEEK
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


            {/* Summary */}

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
              ERROR
              ================================================== */}

          {error && (

            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">

              <div className="flex items-start gap-2">

                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />

                <div>

                  <p className="text-xs font-bold text-destructive">
                    Kael couldn't generate the update
                  </p>

                  <p className="text-xs text-muted-foreground mt-1">
                    {error}
                  </p>

                </div>

              </div>

              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => {
                  setError(null);
                  generate();
                }}
              >
                Try Again
              </Button>

            </div>

          )}


          {/* ==================================================
              GENERATE BUTTON
              ================================================== */}

          {!insight &&
            !loading &&
            !error && (

              <>
                {!hasEnoughData ? (

                  <div className="p-3 rounded-xl bg-muted/40 border border-border text-center">

                    <p className="text-xs text-muted-foreground">
                      Complete at least 1 workout this week
                      to unlock your Kael check-in.
                    </p>

                  </div>

                ) : (

                  <Button
                    size="sm"
                    className="w-full"
                    onClick={generate}
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
              KAEL'S ACTUAL ANALYSIS
              ================================================== */}

          {insight && (

            <div className="space-y-3">


              {/* Lock */}

              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/50 rounded-lg px-2 py-1.5 w-fit">

                <CheckCircle2 className="w-3 h-3 text-accent" />

                Generated for this week · resets Monday

              </div>


              {/* =================================================
                  1. WHAT YOU CRUSHED
                  ================================================= */}

              <div className="p-3 rounded-xl bg-accent/10 border border-accent/20">

                <p className="text-xs font-bold text-accent uppercase tracking-wider mb-1">

                  What you crushed 🔥

                </p>


                <p className="text-sm leading-relaxed">

                  {insight.win ||
                    'You put in the work this week. Keep building on that consistency.'}

                </p>

              </div>


              {/* =================================================
                  2. KEEP AN EYE ON
                  ================================================= */}

              <div className="p-3 rounded-xl bg-muted/50 border border-border">

                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">

                  Keep an eye on

                </p>


                <p className="text-sm leading-relaxed">

                  {insight.improve ||
                    'Keep paying attention to your recovery, technique, and performance as you progress.'}

                </p>

              </div>


              {/* =================================================
                  3. NEXT WEEK
                  ================================================= */}

              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">

                <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">

                  Next week

                </p>


                <p className="text-sm leading-relaxed">

                  {insight.next_recommendation ||
                    'Continue progressing gradually while keeping your technique and recovery a priority.'}

                </p>

              </div>


              {/* =================================================
                  4. MOTIVATION
                  ================================================= */}

              <div className="border-l-2 border-primary/40 pl-3 py-1">

                <p className="text-sm italic text-muted-foreground">

                  {insight.motivation ||
                    'Keep stacking good weeks. That is how the bigger goal gets built.'}

                </p>

              </div>


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
