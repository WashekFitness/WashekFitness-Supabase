/**
 * Expands a program that only has 3 anchor microcycles (weeks 1, 5, 9)
 * into a full 12-week program by interpolating the missing weeks.
 *
 * Periodization logic:
 * Meso 1 (wks 1-4): Foundation
 *   Wk1 = anchor (as-is)
 *   Wk2 = +10% volume (add 1 set to main lifts)
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