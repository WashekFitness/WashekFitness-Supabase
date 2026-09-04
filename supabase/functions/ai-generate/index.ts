import { supabase } from '@/lib/supabase';
import { supabaseApi } from '@/lib/supabaseApi';
import { buildWeekPrompt } from '@/lib/trainingTypes';

/*
 * ============================================================
 * WEEK SCHEMA
 * ============================================================
 *
 * Matches schema used by Onboarding for Week 1.
 */

const weekSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    microcycle: {
      type: 'object',
      additionalProperties: false,
      properties: {
        week_number: { type: 'number' },
        mesocycle_index: { type: 'number' },
        week_type: { type: 'string' },
        days: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              day_name: { type: 'string' },
              workout_type: { type: 'string' },
              exercises: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    name: { type: 'string' },
                    sets: { type: 'number' },
                    reps: { type: 'string' },
                    rest_seconds: { type: 'number' },
                    notes: { type: 'string' },
                    activation_cue: { type: 'string' },
                  },
                  required: ['name', 'sets', 'reps', 'rest_seconds', 'notes', 'activation_cue'],
                },
              },
            },
            required: ['day_name', 'workout_type', 'exercises'],
          },
        },
      },
      required: ['week_number', 'mesocycle_index', 'week_type', 'days'],
    },
  },
  required: ['microcycle'],
};


/*
 * ============================================================
 * SAFE HELPERS
 * ============================================================
 */

function parseMaybeJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed);
  } catch {
    return fallback;
  }
}

function asArray(value) {
  const parsed = parseMaybeJson(value, []);
  return Array.isArray(parsed) ? parsed : [];
}

function asObject(value) {
  const parsed = parseMaybeJson(value, {});
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  return {};
}

function rpcObject(data) {
  if (Array.isArray(data)) return data[0] || {};
  return data || {};
}


/*
 * ============================================================
 * PROMPT DATA
 * ============================================================
 */

function buildPromptData(profile, originalRequirements, previousMicrocycle, recentLogs) {
  const fitnessGoals = asArray(profile?.fitness_goals);
  const weightGoals = asArray(profile?.weight_goals);
  const heightInches = Number(profile?.height_inches);

  let heightFt = '';
  let heightIn = '';

  if (Number.isFinite(heightInches) && heightInches > 0) {
    heightFt = Math.floor(heightInches / 12);
    heightIn = heightInches % 12;
  }

  const previousWeekSummary = previousMicrocycle ? JSON.stringify(previousMicrocycle).slice(0, 12000) : '';
  const workoutLogSummary = Array.isArray(recentLogs) && recentLogs.length ? JSON.stringify(recentLogs).slice(0, 12000) : '';

  let requirements = originalRequirements || '';

  if (previousWeekSummary) {
    requirements += `

PREVIOUS PROGRAMMED WEEK:
The athlete's immediately previous programmed week was:
${previousWeekSummary}

Use this to create appropriate progression. Do not simply duplicate the previous week.`;
  }

  if (workoutLogSummary) {
    requirements += `

RECENT WORKOUT PERFORMANCE:
These are the available workout logs from the previous week:
${workoutLogSummary}

Use these logs as performance feedback when deciding progression, recovery, volume, exercise selection, and difficulty.`;
  }

  return {
    gender: profile?.gender,
    level: profile?.fitness_level,
    age: profile?.age,
    weightLbs: profile?.weight_lbs,
    heightFt,
    heightIn,
    unit: profile?.unit || 'imperial',
    currentSkills: profile?.current_skills || '',
    goalDescription: profile?.primary_goal || '',
    timeframe: profile?.goal_timeframe || '',
    equipment: profile?.available_equipment || '',
    requirements,
    fitnessGoals,
    weightGoals,
  };
}


/*
 * ============================================================
 * UTILITIES
 * ============================================================
 */

function getMesocycleIndex(weekNumber) {
  return Math.floor((weekNumber - 1) / 4);
}

async function fetchProgram(programId) {
  const { data, error } = await supabase.from('workout_programs').select('*').eq('id', programId).single();
  if (error) throw error;
  return data;
}

async function getCalendarWeek(programId) {
  const { data, error } = await supabase.rpc('get_current_program_week', { p_program_id: programId });
  if (error) throw error;

  if (typeof data === 'number') return data;
  if (typeof data === 'string') {
    const number = Number(data);
    if (Number.isFinite(number)) return number;
  }

  const result = rpcObject(data);
  const candidates = [result.current_week, result.week_number, result.get_current_program_week];

  for (const candidate of candidates) {
    const number = Number(candidate);
    if (Number.isFinite(number)) return number;
  }

  throw new Error('Could not determine the current program calendar week.');
}

async function claimWeek(programId, weekNumber) {
  const { data, error } = await supabase.rpc('claim_program_week_generation', { p_program_id: programId, p_week_number: weekNumber });
  if (error) throw error;
  return rpcObject(data);
}

async function completeWeek(programId, weekNumber, microcycle) {
  const { data, error } = await supabase.rpc('complete_program_week_generation', { p_program_id: programId, p_week_number: weekNumber, p_microcycle: microcycle });
  if (error) throw error;
  return rpcObject(data);
}

async function failWeek(programId, weekNumber) {
  const { error } = await supabase.rpc('fail_program_week_generation', { p_program_id: programId, p_week_number: weekNumber });
  if (error) {
    console.error('[ProgramWeekGeneration] Failed to mark generation as failed:', error);
  }
}


/*
 * ============================================================
 * FALLBACK MICROCYCLE GENERATOR
 * ============================================================
 *
 * Creates a simple, safe 3-workout-per-week microcycle when AI fails.
 */

function createFallbackMicrocycle(profile, weekNumber) {
  // Determine simple difficulty scaling from profile fitness level
  const level = (profile?.fitness_level || '').toLowerCase();
  let sets = 3;
  let reps = '8-12';
  let rest = 90;

  if (level.includes('beginner') || level.includes('novice')) {
    sets = 2;
    reps = '8-12';
    rest = 90;
  } else if (level.includes('intermediate')) {
    sets = 3;
    reps = '8-12';
    rest = 75;
  } else if (level.includes('advanced')) {
    sets = 4;
    reps = '6-10';
    rest = 60;
  }

  // Basic bodyweight/resistance exercises; safe defaults for fallback
  const workouts = [
    {
      day_name: 'Workout A',
      workout_type: 'Strength',
      exercises: [
        {
          name: 'Push-up',
          sets,
          reps,
          rest_seconds: rest,
          notes: 'Maintain a straight body. Scale with knees or incline if needed.',
          activation_cue: 'Scapular protraction and a strong core.',
        },
        {
          name: 'Bodyweight Squat',
          sets,
          reps,
          rest_seconds: rest,
          notes: 'Depth comfortable to the athlete. Use box if mobility is limited.',
          activation_cue: 'Knees tracking over toes, engage glutes.',
        },
        {
          name: 'Plank',
          sets: 3,
          reps: '30-60s',
          rest_seconds: 60,
          notes: 'Hold a neutral spine. Reduce duration if needed.',
          activation_cue: 'Brace through the core.',
        },
      ],
    },
    {
      day_name: 'Workout B',
      workout_type: 'Strength',
      exercises: [
        {
          name: 'Inverted Row or Band Row',
          sets,
          reps,
          rest_seconds: rest,
          notes: 'Use available equipment. Keep scapular control.',
          activation_cue: 'Squeeze shoulder blades together.',
        },
        {
          name: 'Reverse Lunge (each leg)',
          sets,
          reps: '8-12 per leg',
          rest_seconds: rest,
          notes: 'Step back, keep torso upright.',
          activation_cue: 'Drive through front heel.',
        },
        {
          name: 'Glute Bridge',
          sets,
          reps,
          rest_seconds: rest,
          notes: 'Squeeze at the top of the movement.',
          activation_cue: 'Engage glutes before starting reps.',
        },
      ],
    },
    {
      day_name: 'Workout C',
      workout_type: 'Hybrid',
      exercises: [
        {
          name: 'Overhead Press (dumbbell or band)',
          sets,
          reps,
          rest_seconds: rest,
          notes: 'Control through full range.',
          activation_cue: 'Engage lats and core.',
        },
        {
          name: 'Romanian Deadlift (hinge pattern, light to moderate load)',
          sets,
          reps,
          rest_seconds: rest,
          notes: 'Maintain neutral spine, hinge from hips.',
          activation_cue: 'Soft knee, push hips back.',
        },
        {
          name: 'Farmer Carry or Suitcase Carry (distance/time)',
          sets: 3,
          reps: '30-60s',
          rest_seconds: 60,
          notes: 'Grip and core stability work for general fitness.',
          activation_cue: 'Tall posture, core braced.',
        },
      ],
    },
  ];

  const microcycle = {
    week_number: weekNumber,
    mesocycle_index: getMesocycleIndex(weekNumber),
    week_type: 'Fallback',
    days: workouts,
  };

  return microcycle;
}


/*
 * ============================================================
 * GENERATE ONE WEEK
 * ============================================================
 *
 * Generates a single program week:
 *  - Claims the week in the DB to avoid concurrent generation
 *  - Attempts AI generation (supabaseApi.ai.invoke)
 *  - On AI failure or invalid output, constructs a safe fallback and completes the week
 */

async function generateOneWeek(program, user, weekNumber) {
  const programId = program.id;
  console.log(`[ProgramWeekGeneration] Starting Week ${weekNumber} for program=${programId} user=${user?.id}`);

  // Claim first to prevent concurrent generation
  const claim = await claimWeek(programId, weekNumber).catch((err) => {
    console.error('[ProgramWeekGeneration] claimWeek error:', err);
    throw err;
  });

  if (claim?.allowed === false) {
    console.log(`[ProgramWeekGeneration] Week ${weekNumber} was not claimed:`, claim);
    return { generated: false, reason: claim?.reason || 'generation_in_progress' };
  }

  // Refresh program after claim
  let freshProgram = await fetchProgram(programId);

  const existingMicrocycles = asArray(freshProgram.microcycles);
  const existingWeek = existingMicrocycles.find((w) => Number(w?.week_number) === Number(weekNumber));
  if (existingWeek) {
    return { generated: false, reason: 'already_exists', program: freshProgram };
  }

  // Load the latest profile
  const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (profileError) {
    await failWeek(programId, weekNumber);
    console.error('[ProgramWeekGeneration] Profile load failed:', profileError);
    throw profileError;
  }

  // previous microcycle and logs
  const previousMicrocycle = existingMicrocycles.find((w) => Number(w?.week_number) === Number(weekNumber - 1)) || null;

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

  const promptData = buildPromptData(profile, profile.training_requirements || '', previousMicrocycle, recentLogs);

  // AI invocation with client-side timeout handled by supabaseApi.ai.invoke
  let parsed;
  try {
    parsed = await supabaseApi.ai.invoke({
      type: 'microcycle',
      prompt: buildWeekPrompt(trainingType, promptData, weekNumber, adaptationHistory),
      schema: weekSchema,
    });
  } catch (error) {
    // AI failed. Instead of leaving the claim blocked, generate fallback microcycle and complete the week.
    console.warn(`[ProgramWeekGeneration] AI generation failed for Week ${weekNumber}, using fallback. Error:`, error);

    const fallbackMicrocycle = createFallbackMicrocycle(profile, weekNumber);

    try {
      await completeWeek(programId, weekNumber, fallbackMicrocycle);
      freshProgram = await fetchProgram(programId);
      console.log(`[ProgramWeekGeneration] Week ${weekNumber} completed using fallback microcycle.`);
      return { generated: true, reason: 'fallback_generated', program: freshProgram };
    } catch (completeErr) {
      // If completion fails, mark the failure in DB and rethrow so caller can handle/retry
      await failWeek(programId, weekNumber);
      console.error('[ProgramWeekGeneration] Failed to complete fallback week:', completeErr);
      throw completeErr;
    }
  }

  const microcycle = parsed?.microcycle;

  if (!microcycle || !Array.isArray(microcycle.days) || microcycle.days.length === 0) {
    // AI returned invalid or empty microcycle; use fallback instead of failing.
    console.warn(`[ProgramWeekGeneration] AI returned invalid microcycle for Week ${weekNumber}. Using fallback.`);

    const fallbackMicrocycle = createFallbackMicrocycle(profile, weekNumber);

    try {
      await completeWeek(programId, weekNumber, fallbackMicrocycle);
      freshProgram = await fetchProgram(programId);
      console.log(`[ProgramWeekGeneration] Week ${weekNumber} completed using fallback microcycle (AI empty/invalid).`);
      return { generated: true, reason: 'fallback_generated', program: freshProgram };
    } catch (completeErr) {
      await failWeek(programId, weekNumber);
      console.error('[ProgramWeekGeneration] Failed to complete fallback week after invalid AI output:', completeErr);
      throw completeErr;
    }
  }

  // Normalize and ensure week metadata
  const safeMicrocycle = {
    ...microcycle,
    week_number: weekNumber,
    mesocycle_index: getMesocycleIndex(weekNumber),
    week_type: microcycle.week_type || 'Progression',
  };

  // Try to complete the week with AI output
  try {
    await completeWeek(programId, weekNumber, safeMicrocycle);
  } catch (error) {
    // If RPC fails, mark failed and rethrow
    await failWeek(programId, weekNumber);
    console.error(`[ProgramWeekGeneration] completeWeek failed for Week ${weekNumber}:`, error);
    throw error;
  }

  freshProgram = await fetchProgram(programId);
  console.log(`[ProgramWeekGeneration] Week ${weekNumber} generated successfully (AI).`);

  return { generated: true, reason: 'generated', program: freshProgram };
}


/*
 * ============================================================
 * MAIN BOOTSTRAP
 * ============================================================
 */

export async function ensureCurrentProgramWeek(initialProgram, user) {
  if (!initialProgram?.id || !user?.id) {
    return { program: initialProgram, targetWeek: initialProgram?.current_week || 1, generated: false };
  }

  if (initialProgram.status && initialProgram.status !== 'active') {
    return { program: initialProgram, targetWeek: initialProgram.current_week || 1, generated: false };
  }

  let program = await fetchProgram(initialProgram.id);
  const targetWeek = await getCalendarWeek(program.id);

  const durationWeeks = Math.min(Number(program.duration_weeks) || 12, 12);
  const cappedTargetWeek = Math.min(Math.max(1, Number(targetWeek) || 1), durationWeeks);

  let currentWeek = Math.max(1, Number(program.current_week) || 1);
  let generatedAny = false;

  while (currentWeek < cappedTargetWeek) {
    const nextWeek = currentWeek + 1;
    const result = await generateOneWeek(program, user, nextWeek);

    if (result.reason === 'generation_in_progress') {
      break;
    }

    program = result.program || (await fetchProgram(program.id));

    const microcycles = asArray(program.microcycles);
    const weekNowExists = microcycles.some((w) => Number(w?.week_number) === Number(nextWeek));

    if (!weekNowExists) {
      break;
    }

    currentWeek = Math.max(currentWeek, nextWeek);
    generatedAny = generatedAny || result.generated;
  }

  program = await fetchProgram(program.id);

  return { program, targetWeek: cappedTargetWeek, generated: generatedAny };
}
