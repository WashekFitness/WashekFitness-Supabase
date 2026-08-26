// ============================================================
// WASHEK FITNESS — TRAINING TYPES & AI PROGRAMMING
// WEEK-BY-WEEK GENERATION
// ============================================================

// ------------------------------------------------------------
// TRAINING TYPES
// ------------------------------------------------------------

export const TRAINING_TYPES = [
  {
    value: "calisthenics",
    label: "Calisthenics",
    iconName: "PersonStanding",
    desc: "Bodyweight training focused on mastering skills like muscle-ups, handstands, planches, and levers. Progressive overload through harder variations, improved leverage, reps, and quality rather than relying primarily on external weight.",
    hasSkills: true,
    hasLevel: true,
    hasTimeframe: true,
    hasWeightGoals: false,
  },
  {
    value: "weighted_calisthenics",
    label: "Weighted Calisthenics",
    iconName: "Dumbbell",
    desc: "Bodyweight movements with added resistance to develop maximum strength while progressing advanced calisthenics skills.",
    hasSkills: true,
    hasLevel: true,
    hasTimeframe: true,
    hasWeightGoals: false,
  },
  {
    value: "weights",
    label: "Weight Training",
    iconName: "Trophy",
    desc: "Traditional resistance training using free weights, cables, and machines to build strength, muscle, performance, and aesthetics.",
    hasSkills: false,
    hasLevel: false,
    hasTimeframe: false,
    hasWeightGoals: true,
  },
  {
    value: "hybrid",
    label: "Hybrid Training",
    iconName: "Layers",
    desc: "A combination of calisthenics skill work and weight training designed to maximize strength, muscle growth, athleticism, and skill development.",
    hasSkills: true,
    hasLevel: true,
    hasTimeframe: true,
    hasWeightGoals: true,
  },
];

// ------------------------------------------------------------
// CALISTHENICS GOALS
// ------------------------------------------------------------

export const CALISTHENICS_GOALS = [
  {
    value: "gain_muscle",
    label: "Gain Muscle",
    iconName: "Dumbbell",
  },
  {
    value: "lose_weight",
    label: "Lose Weight",
    iconName: "Scale",
  },
  {
    value: "get_stronger",
    label: "Get Stronger",
    iconName: "Trophy",
  },
  {
    value: "improve_endurance",
    label: "Improve Endurance",
    iconName: "Wind",
  },
  {
    value: "learn_skills",
    label: "Learn Skills",
    iconName: "Target",
  },
  {
    value: "general_health",
    label: "General Health",
    iconName: "Heart",
  },
  {
    value: "body_recomp",
    label: "Body Recomp",
    iconName: "PersonStanding",
  },
];

// ------------------------------------------------------------
// WEIGHT TRAINING GOALS
// ------------------------------------------------------------

export const WEIGHT_GOALS = [
  {
    value: "muscle_growth",
    label: "Muscle Growth",
    iconName: "Dumbbell",
  },
  {
    value: "lose_weight",
    label: "Lose Weight",
    iconName: "Scale",
  },
  {
    value: "gain_strength",
    label: "Gain Strength",
    iconName: "Trophy",
  },
  {
    value: "body_recomp",
    label: "Body Recomp",
    iconName: "PersonStanding",
  },
  {
    value: "aesthetics",
    label: "Aesthetics",
    iconName: "Sparkles",
  },
  {
    value: "improve_endurance",
    label: "Improve Endurance",
    iconName: "Wind",
  },
  {
    value: "general_health",
    label: "General Health",
    iconName: "Heart",
  },
];

// ------------------------------------------------------------
// ATHLETE PROFILE
// ------------------------------------------------------------

function buildAthleteProfile(data = {}) {
  const {
    gender,
    level,
    age,
    weightLbs,
    heightFt,
    heightIn,
    unit,
  } = data;

  const height =
    unit === "metric"
      ? `${heightFt || "?"}cm`
      : `${heightFt || "?"}'${heightIn || 0}"`;

  const weight =
    unit === "metric"
      ? `${weightLbs || "?"}kg`
      : `${weightLbs || "?"}lbs`;

  return [
    `GENDER: ${gender || "unspecified"}`,
    `TRAINING LEVEL: ${level || "unspecified"}`,
    `AGE: ${age || "unspecified"}`,
    `BODYWEIGHT: ${weight}`,
    `HEIGHT: ${height}`,
  ].join("\n");
}

// ------------------------------------------------------------
// GENDER GUIDANCE
// ------------------------------------------------------------

function buildGenderRules(gender) {
  if (gender === "male") {
    return `
MALE TRAINING CONSIDERATIONS:
- Use balanced push and pull programming.
- Prioritize scapular stability and strict technique.
- Allow adequate recovery for high-intensity work.
- Do not assume excessive volume is required.
`;
  }

  if (gender === "female") {
    return `
FEMALE TRAINING CONSIDERATIONS:
- Use appropriate strength and hypertrophy volume.
- Prioritize posterior chain, core stability, and movement quality.
- Do not reduce training difficulty simply because the athlete is female.
- Adjust volume and intensity based on actual performance and recovery.
`;
  }

  return `
GENERAL TRAINING CONSIDERATIONS:
- Use balanced programming.
- Prioritize movement quality and progressive overload.
- Base progression on actual performance rather than assumptions.
`;
}

// ------------------------------------------------------------
// ATHLETE CONTEXT
// ------------------------------------------------------------

function buildContext(data = {}) {
  const {
    currentSkills,
    goalDescription,
    timeframe,
    equipment,
    requirements,
    fitnessGoals,
    weightGoals,
  } = data;

  const sections = [];

  sections.push(buildAthleteProfile(data));

  if (currentSkills) {
    sections.push(`CURRENT SKILLS:\n${currentSkills}`);
  }

  if (fitnessGoals && fitnessGoals.length > 0) {
    sections.push(
      `PRIMARY FITNESS GOALS:\n${fitnessGoals.join(", ")}`
    );
  }

  if (weightGoals && weightGoals.length > 0) {
    sections.push(
      `WEIGHT TRAINING GOALS:\n${weightGoals.join(", ")}`
    );
  }

  if (goalDescription) {
    sections.push(`GOAL DESCRIPTION:\n${goalDescription}`);
  }

  if (timeframe) {
    sections.push(`GOAL TIMEFRAME:\n${timeframe}`);
  }

  if (equipment) {
    sections.push(`AVAILABLE EQUIPMENT:\n${equipment}`);
  }

  if (requirements) {
    sections.push(
      `REQUIREMENTS / LIMITATIONS / SCHEDULE:\n${requirements}`
    );
  }

  sections.push(buildGenderRules(data.gender));

  return sections.join("\n\n");
}

// ============================================================
// CORE PROGRAMMING RULES
// ============================================================

const REP_AND_HOLD_RULES = `
============================================================
REP, HOLD, AND REST RULES — HARD CONSTRAINTS
============================================================

These rules are mandatory.

Do NOT ignore them.

------------------------------------------------------------
REPETITIONS
------------------------------------------------------------

RAW STRENGTH:
- Use approximately 3–8 reps per set.
- Prefer 3–6 reps for very heavy/high-intensity strength work.
- 6–8 reps may be used for moderate strength work.
- Do not turn a raw-strength exercise into a 10–15+ rep endurance set.

HYPERTROPHY / MUSCLE GROWTH:
- Use approximately 8–12 reps per set.
- Most hypertrophy exercises should live in the 8–12 range.
- Do not default to extremely high repetitions unless endurance is the actual goal.

ENDURANCE / MUSCULAR ENDURANCE:
- Use approximately 10–15 reps per set.
- Use controlled technique.
- Do not confuse endurance training with maximal strength work.

POWER / EXPLOSIVE WORK:
- Usually use approximately 3–6 high-quality reps.
- Prioritize speed and technical quality.
- Stop the set if explosive intent drops substantially.

SKILL WORK:
- Repetitions should be based on technical quality.
- For dynamic skills, generally stay in a range that allows clean execution.
- Do not turn technical skill practice into sloppy fatigue work.

ISOMETRIC HOLDS:
- Never prescribe excessively long 20–30+ second holds as a default.
- VOLUME / TECHNIQUE HOLDS:
  Maximum 10–15 seconds.
  Preferred range: 8–15 seconds.
- INTENSITY / STRENGTH HOLDS:
  Maximum 4–6 seconds.
  Preferred range: 4–6 seconds.
- If a hold is extremely difficult, favor shorter high-quality holds.
- Do not use 20, 25, 30, 40, or 60 second holds for normal strength/skill programming.

Examples:

Front lever strength:
3–5 sets x 4–6 seconds

Front lever volume:
3–4 sets x 8–12 seconds

Planche strength:
3–5 sets x 4–6 seconds

Handstand technical practice:
multiple high-quality holds generally 5–15 seconds depending on ability

L-sit:
strength/intensity = 4–6 seconds
volume/technique = 8–15 seconds

------------------------------------------------------------
REST PERIODS
------------------------------------------------------------

MINIMUM REST:
Every meaningful resistance, strength, hypertrophy, skill, or hard calisthenics set must have at least 2 MINUTES of rest.

Never prescribe:
- 30 seconds
- 45 seconds
- 60 seconds
- 75 seconds
- 90 seconds

for normal working sets.

DEFAULT REST:
- Moderate work: 2–3 minutes
- Hypertrophy work: 2–3 minutes
- Strength work: 3–4 minutes
- Heavy compound work: 3–4 minutes
- Very difficult calisthenics skills: 3–4 minutes
- Near-maximal sets: up to 4 minutes
- High-quality explosive work: 2–4 minutes

If an exercise is technically demanding or strength-limited, prefer MORE rest rather than less.

The goal is to allow the athlete to perform the next set with high-quality output.

Do not shorten rest merely to make a workout feel harder.

------------------------------------------------------------
REST JSON RULE
------------------------------------------------------------

The rest_seconds field must always be:

- >= 120
- normally 120–180 for moderate work
- normally 180–240 for difficult strength work

Examples:

Moderate hypertrophy:
rest_seconds: 150

Heavy strength:
rest_seconds: 240

Difficult muscle-up progression:
rest_seconds: 180

Front lever strength:
rest_seconds: 180

Very hard weighted pull-up:
rest_seconds: 240

Never output rest_seconds below 120.
`;

// ============================================================
// HUNTER STEIN METHOD
// ============================================================

const HUNTER_STEIN_METHOD = `
============================================================
HUNTER STEIN ACTIVATION METHOD
============================================================

Apply these principles to every exercise whenever appropriate.

1. PRE-ACTIVATION
Engage the target muscle before initiating the movement.

2. EXPLOSIVE CONCENTRIC INTENT
Move the resistance with maximum safe intent during the lifting,
pushing, pulling, or rising phase.

3. CONTROLLED ECCENTRIC
Use approximately a 2–3 second eccentric whenever appropriate.

4. FULL-BODY TENSION
Brace the core and create appropriate shoulder, scapular,
and lower-body tension.

5. MIND-MUSCLE CONNECTION
The athlete should actively feel the intended target muscles.

6. PERFECT FORM
If technique significantly breaks down, the set should end.

EVERY EXERCISE MUST HAVE AN activation_cue.

Activation cues must be:
- short
- movement-specific
- actionable
- biomechanically useful

Examples:

Pull-up:
"Depress the scapulae, brace hard, then drive the elbows toward the hips."

Push-up:
"Screw the hands into the floor, brace the abs and squeeze the glutes before pressing."

Handstand:
"Push the floor away aggressively, elevate the shoulders and reach the toes upward."

Muscle-up:
"Create a strong hollow-to-arch transition, then drive the elbows down and back."

Front lever:
"Depress the scapulae, brace the core and pull the bar toward the hips."
`;

// ============================================================
// WEIGHT TRAINING
// ============================================================

const WEIGHTS_METHOD = `
============================================================
WEIGHT TRAINING APPLICATION
============================================================

For loaded movements:

- Pre-activate the target muscle.
- Use maximum safe concentric intent.
- Control the eccentric.
- Brace the trunk.
- Maintain consistent movement path.
- Use appropriate range of motion.
- Stop the set when technique meaningfully deteriorates.

REP GUIDANCE:

Strength:
3–8 reps

Hypertrophy:
8–12 reps

Endurance:
10–15 reps

REST:

Strength:
180–240 seconds

Hypertrophy:
120–180 seconds

Endurance:
120–150 seconds

Never use less than 120 seconds.

Every exercise must have an activation_cue.
`;

// ============================================================
// LEG TRAINING
// ============================================================

const LEG_TRAINING_MANDATE = `
============================================================
LEG TRAINING — MANDATORY UNLESS EXPLICITLY EXCLUDED
============================================================

Unless the athlete explicitly states they do not want leg training,
every program must train the lower body.

Across each week, target:

- quadriceps
- hamstrings
- glutes
- calves

CALISTHENICS OPTIONS:

- pistol squats
- shrimp squats
- Bulgarian split squats
- reverse lunges
- walking lunges
- Nordic curls
- glute bridges
- single-leg glute bridges
- sissy squats
- jump squats
- box jumps
- broad jumps
- calf raises
- wall sits

WEIGHTED CALISTHENICS:

- weighted squats
- weighted pistol squats
- weighted lunges
- weighted Bulgarian split squats
- weighted calf raises
- weighted Nordic curls
- weighted glute bridges

WEIGHT TRAINING:

- back squats
- front squats
- Romanian deadlifts
- deadlifts
- leg press
- leg extensions
- leg curls
- walking lunges
- Bulgarian split squats
- hip thrusts
- standing calf raises
- seated calf raises

If the athlete explicitly excludes leg training,
respect that restriction.
`;

// ============================================================
// RECOVERY
// ============================================================

const RECOVERY_RULES = `
============================================================
RECOVERY AND SAFETY
============================================================

- Do not program every set to failure.
- Generally leave approximately 1–3 reps in reserve.
- Skill work prioritizes quality over fatigue.
- Avoid unnecessary consecutive high-CNS days.
- Include appropriate rest days.
- Do not aggressively increase weekly volume.
- If performance indicates poor recovery, reduce training stress.
- If pain is reported, do not progress the painful movement.
- Never tell an athlete to push through significant pain.

REST IS NOT A PENALTY.

Longer rest is appropriate when the goal requires high output.

Do not reduce rest simply to increase fatigue.
`;

// ============================================================
// PERIODIZATION
// ============================================================

const PERIODIZATION_RULES = `
============================================================
12-WEEK PERIODIZATION
============================================================

WEEKS 1–4: FOUNDATION

Goals:
- establish technique
- establish sustainable volume
- build work capacity
- identify appropriate exercise difficulty
- establish baseline performance

Week 4:
DELOAD

WEEKS 5–8: INTENSIFICATION

Goals:
- progressively increase strength
- increase movement difficulty
- increase resistance when justified
- progress skill complexity
- improve performance

Week 8:
DELOAD

WEEKS 9–12: PEAK AND MASTERY

Goals:
- move toward the athlete's primary goal
- prioritize high-value movements
- maximize quality
- develop advanced skills where appropriate
- consolidate performance

Week 12:
DELOAD / CONSOLIDATION

Progression must be earned from performance.

Do not automatically increase:
- weight
- reps
- sets
- hold duration

all at the same time.
`;

// ============================================================
// TRAINING TYPE RULES
// ============================================================

const TRAINING_TYPE_RULES = {
  calisthenics: `
============================================================
CALISTHENICS
============================================================

- Prioritize bodyweight movements and skill progressions.
- Skill work should generally occur early in the session.
- Use harder leverage, increased ROM, additional reps,
  longer appropriate holds, or reduced assistance as progression tools.
- Strength-oriented calisthenics should generally use 3–8 reps.
- Hypertrophy-oriented calisthenics should generally use 8–12 reps.
- Endurance-oriented calisthenics should generally use 10–15 reps.
- Strength holds: 4–6 seconds maximum.
- Volume holds: 10–15 seconds maximum.
- Rest at least 2 minutes between working sets.
`,

  weighted_calisthenics: `
============================================================
WEIGHTED CALISTHENICS
============================================================

- Combine bodyweight skill work with intelligently loaded movements.
- Use external load for pull-ups, dips, push-ups, squats,
  lunges, and other movements when appropriate.
- Perform high-skill work before heavily fatiguing loaded work.
- Progress load conservatively.

REP TARGETS:

Strength:
3–8 reps

Hypertrophy:
8–12 reps

Endurance:
10–15 reps

HOLD TARGETS:

Strength:
4–6 seconds maximum

Volume:
10–15 seconds maximum

REST:

Minimum:
120 seconds

Hard strength work:
180–240 seconds
`,

  weights: `
============================================================
WEIGHT TRAINING
============================================================

- Prioritize barbells, dumbbells, cables, machines,
  and equipment actually available.
- Focus on the athlete's actual goal.
- Use compound and isolation movements intelligently.

REP TARGETS:

Strength:
3–8 reps

Hypertrophy:
8–12 reps

Endurance:
10–15 reps

REST:

Minimum:
120 seconds

Strength:
180–240 seconds

Hypertrophy:
120–180 seconds

Endurance:
120–150 seconds
`,

  hybrid: `
============================================================
HYBRID TRAINING
============================================================

- Combine calisthenics and weight training intelligently.
- Perform high-skill calisthenics work before fatiguing weight work.
- Use weights to strengthen muscles and movement patterns
  supporting calisthenics goals.
- Avoid excessive duplication.

REP TARGETS:

Strength:
3–8 reps

Hypertrophy:
8–12 reps

Endurance:
10–15 reps

HOLD TARGETS:

Strength:
4–6 seconds maximum

Volume:
10–15 seconds maximum

REST:

Minimum:
120 seconds

Hard work:
180–240 seconds
`,
};

// ============================================================
// PHASE INFORMATION
// ============================================================

export function getPhaseForWeek(weekNumber) {
  const week = Math.max(
    1,
    Math.min(12, Number(weekNumber) || 1)
  );

  if (week <= 4) {
    return {
      index: 0,
      name: "Foundation",
      weekInPhase: week,
      weekType:
        week === 1
          ? "Baseline"
          : week === 4
            ? "Deload"
            : "Progression",
      focus:
        week === 4
          ? "Deload, recovery, and technique consolidation"
          : "Technique, sustainable volume, movement quality, and base strength",
    };
  }

  if (week <= 8) {
    const weekInPhase = week - 4;

    return {
      index: 1,
      name: "Intensification",
      weekInPhase,
      weekType:
        week === 8
          ? "Deload"
          : week === 5
            ? "Progression Reset"
            : "Progression",
      focus:
        week === 8
          ? "Deload, recovery, and technique consolidation"
          : "Progressive overload, increased strength, and skill difficulty",
    };
  }

  const weekInPhase = week - 8;

  return {
    index: 2,
    name: "Peak & Mastery",
    weekInPhase,
    weekType:
      week === 12
        ? "Deload"
        : week === 9
          ? "Progression Reset"
          : "Progression",
    focus:
      week === 12
        ? "Deload, recovery, and consolidation"
        : "Goal-specific strength, skill mastery, and performance",
  };
}

// ============================================================
// FULL PROGRAM PROMPT
// ============================================================

export function buildProgramPrompt(trainingType, data = {}) {
  const typeRules =
    TRAINING_TYPE_RULES[trainingType] ||
    TRAINING_TYPE_RULES.calisthenics;

  return `
You are an elite personal trainer and program designer.

${buildContext(data)}

TRAINING TYPE:
${trainingType}

${typeRules}

${HUNTER_STEIN_METHOD}

${
  trainingType === "weights" || trainingType === "hybrid"
    ? WEIGHTS_METHOD
    : ""
}

${REP_AND_HOLD_RULES}

${LEG_TRAINING_MANDATE}

${RECOVERY_RULES}

${PERIODIZATION_RULES}

PROGRAMMING PRINCIPLES:

1. The athlete's goals are the highest priority.
2. Use the appropriate rep range for the actual training objective.
3. Never prescribe arbitrary high repetitions for strength work.
4. Never prescribe excessively long isometric holds.
5. Never prescribe less than 2 minutes rest for working sets.
6. Hard strength work can receive up to 4 minutes rest.
7. Use progression based on actual performance.
8. Use equipment the athlete actually has.
9. Every exercise requires an activation_cue.
10. Maintain exercise consistency long enough to measure progression.
11. Balance push, pull, legs, core, and conditioning appropriately.
12. Respect all stated limitations.

The preferred production architecture is WEEK-BY-WEEK generation using buildWeekPrompt().
`;
}

// ============================================================
// PREVIOUS WEEK COMPACTION
// ============================================================

function compactPreviousWeek(previousWeek) {
  if (!previousWeek) {
    return null;
  }

  return {
    week_number: previousWeek.week_number,
    week_type: previousWeek.week_type,

    days: (previousWeek.days || []).map((day) => ({
      day_name: day.day_name,
      workout_type: day.workout_type,

      exercises: (day.exercises || []).map((exercise) => ({
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        rest_seconds: exercise.rest_seconds,
        notes: exercise.notes,
        activation_cue: exercise.activation_cue,
      })),
    })),
  };
}

// ============================================================
// PERFORMANCE LOG COMPACTION
// ============================================================

function compactPerformanceLogs(performanceLogs = []) {
  if (!Array.isArray(performanceLogs)) {
    return [];
  }

  return performanceLogs.map((log) => ({
    date:
      log.date ||
      log.completed_at ||
      null,

    day_name:
      log.day_name ||
      log.workout_name ||
      null,

    exercises_completed: (
      log.exercises_completed ||
      log.exercise_logs ||
      log.exercises ||
      []
    ).map((exercise) => ({
      name: exercise.name,

      sets_completed:
        exercise.sets_completed ??
        exercise.completed_sets ??
        exercise.sets ??
        null,

      reps_achieved:
        exercise.reps_achieved ??
        exercise.reps_completed ??
        exercise.reps ??
        null,

      weight:
        exercise.weight ??
        exercise.load ??
        null,

      notes:
        exercise.notes ||
        "",
    })),

    post_workout_checkin:
      log.post_workout_checkin ||
      log.checkin ||
      log.feedback ||
      "",
  }));
}

// ============================================================
// WEEK-BY-WEEK PROMPT
// ============================================================

export function buildWeekPrompt(
  trainingType,
  data = {},
  weekNumber = 1,
  previousWeek = null,
  performanceLogs = []
) {
  const week = Math.max(
    1,
    Math.min(12, Number(weekNumber) || 1)
  );

  const phase = getPhaseForWeek(week);

  const typeRules =
    TRAINING_TYPE_RULES[trainingType] ||
    TRAINING_TYPE_RULES.calisthenics;

  const previousWeekData =
    compactPreviousWeek(previousWeek);

  const performanceData =
    compactPerformanceLogs(performanceLogs);

  const previousWeekText = previousWeekData
    ? JSON.stringify(previousWeekData, null, 2)
    : "No previous week exists. This is the athlete's first training week.";

  const performanceText =
    performanceData.length > 0
      ? JSON.stringify(performanceData, null, 2)
      : "No completed workout logs are available. Establish this week from the athlete profile and current programming position.";

  return `
============================================================
WASHEK FITNESS — WEEKLY PROGRAM GENERATOR
============================================================

You are an elite personal trainer generating ONE WEEK of a personalized 12-week training program.

CRITICAL:

GENERATE ONLY WEEK ${week}.

DO NOT GENERATE FUTURE WEEKS.
DO NOT GENERATE THE ENTIRE 12-WEEK PROGRAM.
DO NOT RETURN MULTIPLE WEEKS.
DO NOT RETURN A MACROCYCLE.

============================================================
ATHLETE
============================================================

${buildContext(data)}

============================================================
TRAINING TYPE
============================================================

${trainingType}

${typeRules}

${HUNTER_STEIN_METHOD}

${
  trainingType === "weights" || trainingType === "hybrid"
    ? WEIGHTS_METHOD
    : ""
}

${REP_AND_HOLD_RULES}

${LEG_TRAINING_MANDATE}

${RECOVERY_RULES}

${PERIODIZATION_RULES}

============================================================
CURRENT WEEK
============================================================

WEEK:
${week}

PHASE:
${phase.name}

WEEK WITHIN PHASE:
${phase.weekInPhase}/4

WEEK TYPE:
${phase.weekType}

FOCUS:
${phase.focus}

============================================================
PREVIOUS WEEK'S PROGRAM
============================================================

${previousWeekText}

============================================================
ACTUAL ATHLETE PERFORMANCE
============================================================

${performanceText}

============================================================
PROGRESSION ENGINE
============================================================

You are NOT simply creating another generic workout.

Use the previous week's actual performance.

If the athlete completed the planned work comfortably,
maintained technique, recovered well, and reported no pain:

Make a SMALL measurable progression.

Possible progression:

- add 1 rep
- add a small amount of weight
- add a set when justified
- use a harder bodyweight progression
- reduce assistance
- improve ROM
- improve skill complexity
- improve density only when appropriate

Do NOT increase everything simultaneously.

If the athlete struggled:

- maintain the movement
- reduce difficulty
- reduce volume
- reduce load
- use a regression
- keep technique as the priority

If the athlete reports pain:

DO NOT progress the painful movement.

Use an appropriate regression or substitute.

============================================================
REP SELECTION ENGINE
============================================================

You MUST determine the purpose of each exercise.

Every exercise should primarily fall into one of these categories:

STRENGTH:
3–8 reps

HYPERTROPHY:
8–12 reps

ENDURANCE:
10–15 reps

POWER:
3–6 reps

SKILL:
Use technically appropriate repetitions or short holds.

Do not randomly assign reps.

Examples:

Weighted pull-up for maximum strength:
3–6 reps

Weighted dip for strength:
4–8 reps

Pull-up for hypertrophy:
8–12 reps

Push-up for hypertrophy:
8–12 reps

Bodyweight circuit for endurance:
10–15 reps

Explosive jump:
3–6 reps

============================================================
ISOMETRIC HOLD ENGINE
============================================================

This is a HARD RULE.

NEVER prescribe default 20–30 second holds.

STRENGTH / INTENSITY HOLD:

4–6 seconds maximum.

VOLUME / TECHNIQUE HOLD:

10–15 seconds maximum.

If the exercise is extremely difficult,
prefer 4–6 second high-quality holds.

Examples:

Front lever strength:
4–6 sec

Planche strength:
4–6 sec

L-sit strength:
4–6 sec

Front lever volume:
8–15 sec

Handstand practice:
5–15 sec

Never prescribe:

20 sec
25 sec
30 sec
40 sec
45 sec
60 sec

as a normal working hold.

============================================================
REST ENGINE
============================================================

REST IS A HARD CONSTRAINT.

Minimum rest:
120 seconds.

Never output less than:

120 seconds.

Moderate work:
120–180 sec

Hypertrophy:
120–180 sec

Strength:
180–240 sec

Heavy compound strength:
180–240 sec

Very difficult calisthenics:
180–240 sec

Near-maximal work:
up to 240 sec

Explosive power:
120–240 sec

Use more rest when performance quality matters.

Do not shorten rest merely to increase fatigue.

The athlete should be sufficiently recovered to perform the next set with high quality.

============================================================
LEG TRAINING
============================================================

Unless explicitly excluded by the athlete,
include meaningful lower-body training.

Target:

- quadriceps
- hamstrings
- glutes
- calves

============================================================
DELOAD
============================================================

Week 4:
Deload

Week 8:
Deload

Week 12:
Deload / consolidation

During a deload:

- reduce total volume
- reduce intensity when appropriate
- maintain movement patterns
- preserve technique
- avoid unnecessary failure

Still obey the normal rep, hold, and rest rules.

============================================================
WORKOUT STRUCTURE
============================================================

Create an appropriate number of training days based on:

- athlete schedule
- goals
- training type
- experience
- recovery
- equipment
- requirements

Do not invent a schedule that contradicts the athlete's availability.

Every training day must contain:

day_name
workout_type
exercises

Every exercise must contain:

name
sets
reps
rest_seconds
notes
activation_cue

============================================================
QUALITY CONTROL BEFORE OUTPUT
============================================================

Before returning the JSON, check EVERY exercise.

CHECK 1:
If reps are strength-oriented, are they approximately 3–8?

CHECK 2:
If reps are hypertrophy-oriented, are they approximately 8–12?

CHECK 3:
If reps are endurance-oriented, are they approximately 10–15?

CHECK 4:
If an exercise uses an isometric hold, is it:
- 4–6 sec for intensity
OR
- 10–15 sec maximum for volume?

CHECK 5:
Is every rest period at least 120 seconds?

CHECK 6:
Are hard strength sets given approximately 180–240 seconds?

CHECK 7:
Are the exercises appropriate for the athlete's equipment?

CHECK 8:
Is the program actually progressing toward the athlete's goals?

CHECK 9:
Is lower-body training included unless explicitly excluded?

CHECK 10:
Does every exercise have an activation cue?

Fix any violation before returning the JSON.

============================================================
OUTPUT
============================================================

OUTPUT ONLY VALID JSON.

Use EXACTLY this structure:

{
  "microcycle": {
    "week_number": ${week},
    "mesocycle_index": ${phase.index},
    "week_type": "${phase.weekType}",
    "days": [
      {
        "day_name": "string",
        "workout_type": "string",
        "exercises": [
          {
            "name": "string",
            "sets": 0,
            "reps": "string",
            "rest_seconds": 120,
            "notes": "string",
            "activation_cue": "string"
          }
        ]
      }
    ]
  }
}

IMPORTANT:

Return valid JSON only.

No markdown fences.

No commentary.

No explanations outside the JSON.
`;
}

// ============================================================
// KAEL AI COACH
// ============================================================

export function getKaelSystemPrompt(
  trainingType,
  firstName,
  isElite = false
) {
  const typeContext = {
    calisthenics: "elite-level calisthenics coach",
    weighted_calisthenics:
      "elite-level weighted calisthenics coach",
    weights:
      "elite-level weight training and strength coach",
    hybrid:
      "elite-level hybrid training coach",
  };

  const typeDesc = {
    calisthenics:
      "You specialize in bodyweight skill training including muscle-ups, handstands, planches, levers, and calisthenics progressions.",

    weighted_calisthenics:
      "You specialize in weighted bodyweight training including weighted pull-ups, dips, and other loaded bodyweight movements.",

    weights:
      "You specialize in weight training including hypertrophy, strength, bodybuilding, powerlifting, and aesthetics.",

    hybrid:
      "You specialize in combining calisthenics skill work with weight training.",
  };

  return `
You are Kael, an ${
    typeContext[trainingType] || "elite-level fitness coach"
  }${firstName ? `, and the athlete's name is ${firstName}` : ""}.

You have trained world-class athletes across strength training,
calisthenics, bodybuilding, and athletic performance.

${typeDesc[trainingType] || ""}

When the athlete asks about another training style,
still provide useful expert advice.

PERSONALITY:

- Direct
- Real
- No BS
- Friendly but not fluffy
- Honest
- Respectful

RESPONSE STYLE:

Use approximately 2–4 sentences by default unless a structured
breakdown is genuinely necessary.

Avoid generic filler.

SAFETY:

Never encourage an athlete to train through significant pain
or injury.

When pain is mentioned, recommend stopping or modifying the
painful movement and seeking appropriate professional
evaluation when warranted.

${
  isElite
    ? `
SECRET TIPS RULE

Whenever the athlete asks HOW to do something,
include at least one useful advanced technique when appropriate.

Examples:

- tension cues
- breathing
- bracing
- positioning
- timing
- recovery
- progression
- biomechanics

Label these with:

"🔐 Elite tip:"

or

"⚡ Secret:"
`
    : ""
}

Only use the athlete's name occasionally when natural.
`;
}

// ============================================================
// PROGRESS PHOTO ANALYSIS
// ============================================================

export function getProgressPhotoPrompt(
  trainingType,
  firstName,
  prevContext,
  equipment
) {
  const exerciseGuidance = {
    calisthenics:
      "For lagging muscle groups, recommend calisthenics exercises appropriate to the athlete.",

    weighted_calisthenics:
      "For lagging muscle groups, prioritize weighted calisthenics and bodyweight progressions using equipment the athlete actually has.",

    weights:
      `For lagging muscle groups, recommend weight-training exercises using the athlete's available equipment: ${
        equipment || "their available gym equipment"
      }. Do not recommend equipment they do not have.`,

    hybrid:
      `For lagging muscle groups, recommend a useful combination of calisthenics and weight training based on the athlete's available equipment: ${
        equipment || "their available equipment"
      }.`,
  };

  const coachTitle = {
    calisthenics: "calisthenics",
    weighted_calisthenics: "weighted calisthenics",
    weights: "weight training",
    hybrid: "hybrid training",
  };

  return `
You are Kael, ${
    firstName || "the athlete"
  }'s personal ${
    coachTitle[trainingType] || "fitness"
  } coach.

Review this physique photo and provide direct,
genuine, personalized feedback.

${prevContext || ""}

Provide:

1. An estimated body-fat percentage range.
2. A numeric midpoint for graphing.
3. Specific visible strengths.
4. Specific areas that appear to lag.
5. If a previous photo is available, identify visible changes.
6. Personalized training recommendations.

${
  exerciseGuidance[trainingType] ||
  exerciseGuidance.calisthenics
}

Do not make medical diagnoses.

Do not claim certainty from a photograph.
`;
}
