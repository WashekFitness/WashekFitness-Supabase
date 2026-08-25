/**
 * Expands a program that only has 3 anchor microcycles (weeks 1, 5, 9)
 * into a full 12-week program by interpolating the missing weeks.
 *
 * Periodization logic:
 * Meso 1 (wks 1-4): Foundation
 *   Wk1 = anchor (as-is)
 *   Wk2 = +10% volume (add 1 set to main lifts)function safeParse(value, fallback) {
  if (value == null) return fallback;

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function deepClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
}

function asString(value, fallback = '') {
  if (typeof value === 'string') return value;
  if (value == null) return fallback;

  try {
    return String(value);
  } catch {
    return fallback;
  }
}

function asNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeExercise(exercise) {
  const ex = exercise && typeof exercise === 'object'
    ? exercise
    : {};

  return {
    ...ex,
    name: asString(ex.name, 'Exercise'),
    sets: Math.max(1, Math.round(asNumber(ex.sets, 3))),
    reps: asString(ex.reps, '8-10'),
    rest_seconds: Math.max(0, Math.round(asNumber(ex.rest_seconds, 90))),
    notes: asString(ex.notes, ''),
    activation_cue: asString(ex.activation_cue, ''),
  };
}

function normalizeDay(day, index) {
  const source = day && typeof day === 'object'
    ? day
    : {};

  const exercises = Array.isArray(source.exercises)
    ? source.exercises.map(normalizeExercise)
    : [];

  return {
    ...source,
    day_name: asString(source.day_name, `Day ${index + 1}`),
    workout_type: asString(source.workout_type, exercises.length ? 'Training' : 'Rest'),
    exercises,
  };
}

function normalizeMicrocycle(micro, index) {
  const source = micro && typeof micro === 'object'
    ? micro
    : {};

  const days = Array.isArray(source.days)
    ? source.days.map(normalizeDay)
    : [];

  return {
    ...source,
    week_number: Math.max(
      1,
      Math.round(asNumber(source.week_number, index + 1))
    ),
    mesocycle_index: Math.max(
      0,
      Math.round(asNumber(source.mesocycle_index, Math.floor(index / 4)))
    ),
    week_type: asString(source.week_type, ''),
    days,
  };
}

function normalizeMeso(meso, index) {
  const source = meso && typeof meso === 'object'
    ? meso
    : {};

  return {
    ...source,
    name: asString(source.name, `Training Phase ${index + 1}`),
    focus: asString(source.focus, ''),
    weeks: Math.max(1, Math.round(asNumber(source.weeks, 4))),
    intensity: asString(source.intensity, 'Moderate'),
    week_start: Math.max(
      1,
      Math.round(asNumber(source.week_start, index * 4 + 1))
    ),
    week_end: Math.max(
      1,
      Math.round(asNumber(source.week_end, index * 4 + 4))
    ),
  };
}

function normalizeProgram(program) {
  const parsed = safeParse(program, null);

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const microcyclesValue = safeParse(parsed.microcycles, []);
  const mesocyclesValue = safeParse(parsed.mesocycles, []);

  const microcycles = Array.isArray(microcyclesValue)
    ? microcyclesValue
        .map(normalizeMicrocycle)
        .sort((a, b) => a.week_number - b.week_number)
    : [];

  const mesocycles = Array.isArray(mesocyclesValue)
    ? mesocyclesValue.map(normalizeMeso)
    : [];

  const macrocycle = safeParse(parsed.macrocycle, {});

  return {
    ...parsed,

    program_name: asString(
      parsed.program_name,
      'Your Training Program'
    ),

    duration_weeks: Math.max(
      1,
      Math.round(
        asNumber(
          parsed.duration_weeks,
          microcycles.length || 12
        )
      )
    ),

    fitness_level: asString(
      parsed.fitness_level,
      'Intermediate'
    ),

    current_week: Math.max(
      1,
      Math.round(asNumber(parsed.current_week, 1))
    ),

    macrocycle:
      macrocycle && typeof macrocycle === 'object'
        ? macrocycle
        : {},

    mesocycles,

    microcycles,
  };
}

function adjustSets(days, multiplier) {
  return (Array.isArray(days) ? days : []).map((day, index) => ({
    ...normalizeDay(day, index),

    exercises: (Array.isArray(day?.exercises) ? day.exercises : [])
      .map(normalizeExercise)
      .map((ex) => ({
        ...ex,
        sets: Math.max(
          1,
          Math.round((Number(ex.sets) || 3) * multiplier)
        ),
      })),
  }));
}

function makeWeek(
  anchorMicro,
  weekNumber,
  mesocycleIndex,
  weekType,
  setsMultiplier
) {
  const cloned = deepClone(anchorMicro) || {};

  return {
    ...normalizeMicrocycle(cloned, weekNumber - 1),

    week_number: weekNumber,
    mesocycle_index: mesocycleIndex,
    week_type: weekType,

    days: adjustSets(
      cloned.days || [],
      setsMultiplier
    ),
  };
}

/**
 * Normalizes a generated workout program and, when the AI only returned
 * three anchor weeks, expands those anchors into a complete 12-week plan.
 *
 * This function is deliberately defensive because AI-generated JSON can
 * occasionally contain missing fields, strings instead of arrays, or null
 * values. The Program page should never go completely blank because one
 * generated field is malformed.
 */
export function expandMicrocycles(program) {
  const normalized = normalizeProgram(program);

  if (!normalized) {
    return null;
  }

  const microcycles = normalized.microcycles;

  if (!Array.isArray(microcycles) || microcycles.length === 0) {
    return normalized;
  }

  /*
   * If the program already contains a substantial/full set of weeks,
   * preserve the AI-generated weeks rather than overwriting them.
   */
  const weekNumbers = microcycles
    .map((micro) => Number(micro.week_number))
    .filter(Number.isFinite);

  const uniqueWeeks = new Set(weekNumbers);

  if (uniqueWeeks.size >= 10) {
    return {
      ...normalized,
      microcycles: microcycles.map((micro, index) =>
        normalizeMicrocycle(micro, index)
      ),
    };
  }

  /*
   * The fallback expansion only makes sense when there are at least
   * three anchor weeks.
   */
  const sorted = [...microcycles]
    .sort((a, b) => a.week_number - b.week_number);

  if (sorted.length < 3) {
    return normalized;
  }

  const anchor1 = sorted[0];
  const anchor2 = sorted[1];
  const anchor3 = sorted[2];

  if (!anchor1 || !anchor2 || !anchor3) {
    return normalized;
  }

  const expanded = [
    // MESOCYCLE 1 — Foundation
    makeWeek(anchor1, 1, 0, 'Foundation', 1.0),
    makeWeek(anchor1, 2, 0, 'Accumulation', 1.1),
    makeWeek(anchor1, 3, 0, 'Accumulation', 1.2),
    makeWeek(anchor1, 4, 0, 'Deload', 0.6),

    // MESOCYCLE 2 — Intensification
    makeWeek(anchor2, 5, 1, 'Intensification', 1.0),
    makeWeek(anchor2, 6, 1, 'Intensification', 1.1),
    makeWeek(anchor2, 7, 1, 'Intensification', 1.2),
    makeWeek(anchor2, 8, 1, 'Deload', 0.6),

    // MESOCYCLE 3 — Peak
    makeWeek(anchor3, 9, 2, 'Peak', 1.0),
    makeWeek(anchor3, 10, 2, 'Peak', 1.1),
    makeWeek(anchor3, 11, 2, 'Taper', 0.8),
    makeWeek(anchor3, 12, 2, 'Deload', 0.5),
  ];

  return {
    ...normalized,
    duration_weeks: Math.max(
      normalized.duration_weeks || 0,
      12
    ),
    microcycles: expanded,
  };
}
 *   Wk3 = +10% volume again, slightly harder reps
 *   Wk4 = DELOAD (reduce sets by ~40%, add "Deload" label)
 *
 * Meso 2 (wks 5-8): Intensification
 *   Wk5 = anchor (as-is)
 *   Wk6 = +10% volume
 *   Wk7 = +10% volume, peak of meso
 *   Wk8 = DELOAD
 *
 * Meso 3 (wks 9-12): Peak
 *   Wk9 = anchor (as-is)
 *   Wk10 = +10% volume / max effort
 *   Wk11 = Taper (reduce volume ~20%)
 *   Wk12 = FULL DELOAD
 */

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function adjustSets(days, multiplier) {
  return days.map(day => ({
    ...day,
    exercises: (day.exercises || []).map(ex => ({
      ...ex,
      sets: Math.max(1, Math.round((ex.sets || 3) * multiplier)),
    })),
  }));
}

function tagDay(days, workoutTypes) {
  // If days already have workout_type, keep them. Otherwise assign defaults.
  return days.map((day, i) => ({
    ...day,
    workout_type: day.workout_type || workoutTypes[i % workoutTypes.length],
  }));
}

function makeWeek(anchorMicro, weekNumber, mesocycleIndex, weekType, setsMultiplier) {
  const cloned = deepClone(anchorMicro);
  cloned.week_number = weekNumber;
  cloned.mesocycle_index = mesocycleIndex;
  cloned.week_type = weekType;
  cloned.days = adjustSets(cloned.days || [], setsMultiplier);
  return cloned;
}

export function expandMicrocycles(program) {
  const microcycles = program?.microcycles;
  if (!microcycles || microcycles.length === 0) return program;

  // Already has all 12 weeks — nothing to do
  const weekNumbers = microcycles.map(m => m.week_number);
  if (weekNumbers.length >= 10) return program;

  // Find the 3 anchor weeks (typically 1, 5, 9)
  const sorted = [...microcycles].sort((a, b) => a.week_number - b.week_number);
  const anchor1 = sorted[0];  // Meso 1 anchor
  const anchor2 = sorted[1];  // Meso 2 anchor
  const anchor3 = sorted[2];  // Meso 3 anchor

  if (!anchor1 || !anchor2 || !anchor3) return program;

  const expanded = [
    // MESO 1 — Foundation (weeks 1-4)
    makeWeek(anchor1, 1, 0, 'Foundation',     1.0),
    makeWeek(anchor1, 2, 0, 'Accumulation',   1.1),
    makeWeek(anchor1, 3, 0, 'Accumulation',   1.2),
    makeWeek(anchor1, 4, 0, 'Deload',         0.6),

    // MESO 2 — Intensification (weeks 5-8)
    makeWeek(anchor2, 5, 1, 'Intensification', 1.0),
    makeWeek(anchor2, 6, 1, 'Intensification', 1.1),
    makeWeek(anchor2, 7, 1, 'Intensification', 1.2),
    makeWeek(anchor2, 8, 1, 'Deload',          0.6),

    // MESO 3 — Peak (weeks 9-12)
    makeWeek(anchor3, 9,  2, 'Peak',   1.0),
    makeWeek(anchor3, 10, 2, 'Peak',   1.1),
    makeWeek(anchor3, 11, 2, 'Taper',  0.8),
    makeWeek(anchor3, 12, 2, 'Deload', 0.5),
  ];

  return { ...program, microcycles: expanded };
}
