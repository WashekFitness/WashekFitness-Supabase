import { supabase } from '@/lib/supabase';
import { supabaseApi } from '@/lib/supabaseApi';
import { buildWeekPrompt } from '@/lib/trainingTypes';

/*
 * ============================================================
 * WEEK SCHEMA
 * ============================================================
 *
 * This intentionally matches the schema already used by
 * Onboarding for Week 1.
 *
 * DO NOT change the AI backend for this.
 * This uses the existing supabaseApi.ai.invoke() path.
 */

const weekSchema = {
  type: 'object',
  additionalProperties: false,

  properties: {
    microcycle: {
      type: 'object',
      additionalProperties: false,

      properties: {
        week_number: {
          type: 'number',
        },

        mesocycle_index: {
          type: 'number',
        },

        week_type: {
          type: 'string',
        },

        days: {
          type: 'array',

          items: {
            type: 'object',
            additionalProperties: false,

            properties: {
              day_name: {
                type: 'string',
              },

              workout_type: {
                type: 'string',
              },

              exercises: {
                type: 'array',

                items: {
                  type: 'object',
                  additionalProperties: false,

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
              'day_name',
              'workout_type',
              'exercises',
            ],
          },
        },
      },

      required: [
        'week_number',
        'mesocycle_index',
        'week_type',
        'days',
      ],
    },
  },

  required: [
    'microcycle',
  ],
};


/*
 * ============================================================
 * SAFE HELPERS
 * ============================================================
 */

function parseMaybeJson(value, fallback) {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  if (
    typeof value !== 'string'
  ) {
    return value;
  }

  const trimmed =
    value.trim();

  if (!trimmed) {
    return fallback;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return fallback;
  }
}


function asArray(value) {
  const parsed =
    parseMaybeJson(value, []);

  if (Array.isArray(parsed)) {
    return parsed;
  }

  return [];
}


function asObject(value) {
  const parsed =
    parseMaybeJson(value, {});

  if (
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed)
  ) {
    return parsed;
  }

  return {};
}


function rpcObject(data) {
  if (
    Array.isArray(data)
  ) {
    return data[0] || {};
  }

  return data || {};
}


/*
 * ============================================================
 * PROFILE → AI PROMPT DATA
 * ============================================================
 */

function buildPromptData(
  profile,
  originalRequirements,
  previousMicrocycle,
  recentLogs
) {
  const fitnessGoals =
    asArray(
      profile?.fitness_goals
    );

  const weightGoals =
    asArray(
      profile?.weight_goals
    );

  const heightInches =
    Number(
      profile?.height_inches
    );

  let heightFt = '';
  let heightIn = '';

  if (
    Number.isFinite(
      heightInches
    ) &&
    heightInches > 0
  ) {
    heightFt =
      Math.floor(
        heightInches / 12
      );

    heightIn =
      heightInches % 12;
  }

  /*
   * Give the next week's AI useful information about what
   * actually happened in the previous week.
   *
   * Keep this bounded so we don't unnecessarily inflate the
   * OpenRouter request.
   */

  const previousWeekSummary =
    previousMicrocycle
      ? JSON.stringify(
          previousMicrocycle
        ).slice(
          0,
          12000
        )
      : '';

  const workoutLogSummary =
    Array.isArray(
      recentLogs
    ) && recentLogs.length
      ? JSON.stringify(
          recentLogs
        ).slice(
          0,
          12000
        )
      : '';

  let requirements =
    originalRequirements || '';

  if (
    previousWeekSummary
  ) {
    requirements += `

PREVIOUS PROGRAMMED WEEK:
The athlete's immediately previous programmed week was:
${previousWeekSummary}

Use this to create appropriate progression. Do not simply duplicate the previous week.`;
  }

  if (
    workoutLogSummary
  ) {
    requirements += `

RECENT WORKOUT PERFORMANCE:
These are the available workout logs from the previous week:
${workoutLogSummary}

Use these logs as performance feedback when deciding progression, recovery, volume, exercise selection, and difficulty.`;
  }

  return {
    gender:
      profile?.gender,

    level:
      profile?.fitness_level,

    age:
      profile?.age,

    weightLbs:
      profile?.weight_lbs,

    heightFt,

    heightIn,

    unit:
      profile?.unit || 'imperial',

    currentSkills:
      profile?.current_skills || '',

    goalDescription:
      profile?.primary_goal || '',

    timeframe:
      profile?.goal_timeframe || '',

    equipment:
      profile?.available_equipment || '',

    requirements,

    fitnessGoals,

    weightGoals,
  };
}


/*
 * ============================================================
 * MESOCYCLE INFORMATION
 * ============================================================
 */

function getMesocycleIndex(
  weekNumber
) {
  return Math.floor(
    (weekNumber - 1) / 4
  );
}


/*
 * ============================================================
 * FETCH FRESH PROGRAM
 * ============================================================
 */

async function fetchProgram(
  programId
) {
  const {
    data,
    error,
  } =
    await supabase
      .from('workout_programs')
      .select('*')
      .eq('id', programId)
      .single();

  if (error) {
    throw error;
  }

  return data;
}


/*
 * ============================================================
 * GET SERVER-AUTHORITATIVE CURRENT CALENDAR WEEK
 * ============================================================
 */

async function getCalendarWeek(
  programId
) {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_current_program_week',
      {
        p_program_id:
          programId,
      }
    );

  if (error) {
    throw error;
  }

  /*
   * The SQL function returns an integer, but accepting an
   * object here makes this tolerant of a future RPC shape.
   */

  if (
    typeof data === 'number'
  ) {
    return data;
  }

  if (
    typeof data === 'string'
  ) {
    const number =
      Number(data);

    if (
      Number.isFinite(number)
    ) {
      return number;
    }
  }

  const result =
    rpcObject(data);

  const candidates = [
    result.current_week,
    result.week_number,
    result.get_current_program_week,
  ];

  for (
    const candidate of candidates
  ) {
    const number =
      Number(candidate);

    if (
      Number.isFinite(number)
    ) {
      return number;
    }
  }

  throw new Error(
    'Could not determine the current program calendar week.'
  );
}


/*
 * ============================================================
 * CLAIM A WEEK
 * ============================================================
 */

async function claimWeek(
  programId,
  weekNumber
) {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      'claim_program_week_generation',
      {
        p_program_id:
          programId,

        p_week_number:
          weekNumber,
      }
    );

  if (error) {
    throw error;
  }

  return rpcObject(data);
}


/*
 * ============================================================
 * COMPLETE A WEEK
 * ============================================================
 */

async function completeWeek(
  programId,
  weekNumber,
  microcycle
) {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      'complete_program_week_generation',
      {
        p_program_id:
          programId,

        p_week_number:
          weekNumber,

        p_microcycle:
          microcycle,
      }
    );

  if (error) {
    throw error;
  }

  return rpcObject(data);
}


/*
 * ============================================================
 * MARK GENERATION FAILED
 * ============================================================
 */

async function failWeek(
  programId,
  weekNumber
) {
  const {
    error,
  } =
    await supabase.rpc(
      'fail_program_week_generation',
      {
        p_program_id:
          programId,

        p_week_number:
          weekNumber,
      }
    );

  if (error) {
    console.error(
      '[ProgramWeekGeneration] Failed to mark generation as failed:',
      error
    );
  }
}


/*
 * ============================================================
 * GENERATE ONE WEEK
 * ============================================================
 *
 * Updated to add a client-side timeout and robust failure handling
 * so claims are released and the UI can recover quickly when the
 * AI or edge runtime is slow/timeouting.
 */

async function generateOneWeek(
  program,
  user,
  weekNumber
) {
  const programId = program.id;

  console.log(`[ProgramWeekGeneration] Starting Week ${weekNumber}`);

  // Claim first to prevent concurrent generation
  const claim = await claimWeek(programId, weekNumber);

  if (claim?.allowed === false) {
    console.log(`[ProgramWeekGeneration] Week ${weekNumber} was not claimed:`, claim);
    return {
      generated: false,
      reason: claim?.reason || 'generation_in_progress',
    };
  }

  // Refresh program after claim
  let freshProgram = await fetchProgram(programId);

  const existingMicrocycles = asArray(freshProgram.microcycles);
  const existingWeek = existingMicrocycles.find(
    week => Number(week?.week_number) === Number(weekNumber)
  );

  if (existingWeek) {
    return {
      generated: false,
      reason: 'already_exists',
      program: freshProgram,
    };
  }

  // Load the latest profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError) {
    // Mark failure and return so claim is not left dangling
    await failWeek(programId, weekNumber);
    console.error('[ProgramWeekGeneration] Profile load failed:', profileError);
    return {
      generated: false,
      reason: 'profile_load_failed',
      error: profileError.message || String(profileError),
    };
  }

  // previous microcycle and recent logs
  const previousMicrocycle = existingMicrocycles.find(
    week => Number(week?.week_number) === Number(weekNumber - 1)
  ) || null;

  let recentLogs = [];
  if (weekNumber > 1) {
    try {
      const { data: logs, error: logsError } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('program_id', programId)
        .eq('week_number', weekNumber - 1)
        .order('date', { ascending: false })
        .limit(30);

      if (logsError) {
        console.warn('[ProgramWeekGeneration] Could not load previous workout logs. Continuing without them:', logsError);
      } else {
        recentLogs = logs || [];
      }
    } catch (err) {
      console.warn('[ProgramWeekGeneration] Error loading previous logs, continuing:', err);
    }
  }

  const adaptationHistory = asArray(freshProgram.adaptation_history);
  const trainingType = freshProgram.training_type || profile.training_type || 'calisthenics';

  const promptData = buildPromptData(
    profile,
    profile.training_requirements || '',
    previousMicrocycle,
    recentLogs
  );

  /*
   * Generate exactly ONE week.
   * Wrap AI invocation in a client-side timeout and robust error handling.
   */

  // helper: promise timeout
  function promiseTimeout(promise, ms) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        const err = new Error(`AI invocation timed out after ${ms}ms`);
        err.name = 'AIInvocationTimeout';
        reject(err);
      }, ms);
    });

    return Promise.race([promise.finally(() => clearTimeout(timeoutId)), timeoutPromise]);
  }

  // Choose a conservative client-side timeout shorter than edge function runtime limit.
  const AI_INVOCATION_TIMEOUT_MS = 90 * 1000; // 90 seconds

  let parsed;
  try {
    parsed = await promiseTimeout(
      supabaseApi.ai.invoke({
        type: 'microcycle',
        prompt: buildWeekPrompt(trainingType, promptData, weekNumber, adaptationHistory),
        schema: weekSchema,
      }),
      AI_INVOCATION_TIMEOUT_MS
    );
  } catch (error) {
    // On any error (including timeout), mark generation as failed so claim is released.
    try {
      await failWeek(programId, weekNumber);
    } catch (failErr) {
      // If failWeek itself errors, log — but continue to return graceful failure.
      console.error('[ProgramWeekGeneration] failWeek failed after AI error:', failErr);
    }

    console.error(`[ProgramWeekGeneration] AI generation failed for Week ${weekNumber}:`, error);

    // Return a clear, non-throwing result so callers can respond in the UI
    return {
      generated: false,
      reason: error?.name === 'AIInvocationTimeout' ? 'timeout' : 'ai_error',
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const microcycle = parsed?.microcycle;

  if (!microcycle || !Array.isArray(microcycle.days) || microcycle.days.length === 0) {
    // Mark failure and release claim
    await failWeek(programId, weekNumber);

    console.error(`[ProgramWeekGeneration] AI returned no workouts for Week ${weekNumber}. Parsed:`, parsed);

    return {
      generated: false,
      reason: 'ai_returned_no_workouts',
      error: 'AI returned no workouts',
    };
  }

  // Ensure correct week_number etc
  const safeMicrocycle = {
    ...microcycle,
    week_number: weekNumber,
    mesocycle_index: getMesocycleIndex(weekNumber),
    week_type: microcycle.week_type || 'Progression',
  };

  try {
    await completeWeek(programId, weekNumber, safeMicrocycle);
  } catch (error) {
    // If completion fails, mark failure and return
    await failWeek(programId, weekNumber);

    console.error(`[ProgramWeekGeneration] completeWeek failed for Week ${weekNumber}:`, error);

    return {
      generated: false,
      reason: 'complete_failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // Refresh and return success
  freshProgram = await fetchProgram(programId);

  console.log(`[ProgramWeekGeneration] Week ${weekNumber} generated successfully.`);

  return {
    generated: true,
    reason: 'generated',
    program: freshProgram,
  };
}


/*
 * ============================================================
 * MAIN BOOTSTRAP
 * ============================================================
 *
 * This is the function the app calls whenever the user enters
 * the authenticated application.
 *
 * It catches the program up one week at a time.
 */

export async function ensureCurrentProgramWeek(
  initialProgram,
  user
) {
  if (
    !initialProgram?.id ||
    !user?.id
  ) {
    return {
      program:
        initialProgram,

      targetWeek:
        initialProgram?.current_week ||
        1,

      generated:
        false,
    };
  }

  /*
   * Never touch a non-active program.
   */

  if (
    initialProgram.status &&
    initialProgram.status !== 'active'
  ) {
    return {
      program:
        initialProgram,

      targetWeek:
        initialProgram.current_week ||
        1,

      generated:
        false,
    };
  }

  let program =
    await fetchProgram(
      initialProgram.id
    );

  /*
   * Ask the database what calendar week the athlete is actually
   * in. This is independent of how many workouts they completed.
   */

  const targetWeek =
    await getCalendarWeek(
      program.id
    );

  const durationWeeks =
    Math.min(
      Number(
        program.duration_weeks
      ) || 12,
      12
    );

  const cappedTargetWeek =
    Math.min(
      Math.max(
        1,
        Number(targetWeek) || 1
      ),
      durationWeeks
    );

  let currentWeek =
    Math.max(
      1,
      Number(
        program.current_week
      ) || 1
    );

  let generatedAny =
    false;

  /*
   * Generate missing weeks sequentially.
   *
   * This is important: Week 4 should not be generated before
   * Week 2 and Week 3 because each week's programming can use
   * the previous week's information.
   */

  while (
    currentWeek <
      cappedTargetWeek
  ) {
    const nextWeek =
      currentWeek + 1;

    const result =
      await generateOneWeek(
        program,
        user,
        nextWeek
      );

    /*
     * If another tab/device is currently generating the week,
     * stop here. That other process owns the generation.
     */

    if (
      result.reason ===
      'generation_in_progress'
    ) {
      break;
    }

    /*
     * Refresh regardless of whether the week already existed.
     */

    program =
      result.program ||
      await fetchProgram(
        program.id
      );

    const microcycles =
      asArray(
        program.microcycles
      );

    const weekNowExists =
      microcycles.some(
        week =>
          Number(
            week?.week_number
          ) ===
          Number(
            nextWeek
          )
      );

    if (
      !weekNowExists
    ) {
      /*
       * Generation did not complete, so do not advance past a
       * missing week.
       */
      break;
    }

    currentWeek =
      Math.max(
        currentWeek,
        nextWeek
      );

    generatedAny =
      generatedAny ||
      result.generated;
  }

  /*
   * Always return the freshest program.
   */

  program =
    await fetchProgram(
      program.id
    );

  return {
    program,

    targetWeek:
      cappedTargetWeek,

    generated:
      generatedAny,
  };
}
