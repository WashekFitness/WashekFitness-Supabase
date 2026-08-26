// ============================================================
// WASHEK FITNESS — TRAINING TYPES & AI PROGRAMMING PROMPTS
// ============================================================

// ------------------------------------------------------------
// TRAINING TYPES
// ------------------------------------------------------------

export const TRAINING_TYPES = [
  {
    value: "calisthenics",
    label: "Calisthenics",
    iconName: "PersonStanding",
    desc: "Bodyweight training focused on mastering skills like muscle-ups, handstands, planches, and levers. Progressive overload through harder variations, not added weight.",
    hasSkills: true,
    hasLevel: true,
    hasTimeframe: true,
    hasWeightGoals: false,
  },
  {
    value: "weighted_calisthenics",
    label: "Weighted Calisthenics",
    iconName: "Dumbbell",
    desc: "Bodyweight movements with added weight to build raw strength while progressing toward advanced calisthenics skills.",
    hasSkills: true,
    hasLevel: true,
    hasTimeframe: true,
    hasWeightGoals: false,
  },
  {
    value: "weights",
    label: "Weight Training",
    iconName: "Trophy",
    desc: "Traditional gym training with free weights, cables, and machines. Build muscle, strength, and aesthetics through progressive overload.",
    hasSkills: false,
    hasLevel: false,
    hasTimeframe: false,
    hasWeightGoals: true,
  },
  {
    value: "hybrid",
    label: "Hybrid Training",
    iconName: "Layers",
    desc: "A combination of calisthenics skill work and weight training designed to maximize strength, muscle growth, and skill development.",
    hasSkills: true,
    hasLevel: true,
    hasTimeframe: true,
    hasWeightGoals: true,
  },
];

// ------------------------------------------------------------
// GOALS
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
    `LEVEL: ${level || "unspecified"}`,
    `AGE: ${age || "unspecified"}`,
    `WEIGHT: ${weight}`,
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
- Do not assume the athlete requires excessive training volume.
`;
  }

  if (gender === "female") {
    return `
FEMALE TRAINING CONSIDERATIONS:
- Use appropriate strength and hypertrophy volume.
- Prioritize posterior chain, core stability, and movement quality.
- Use controlled eccentrics where appropriate.
- Do not reduce training difficulty simply because the athlete is female.
- Adjust volume and intensity according to actual performance and recovery.
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
// BUILD GENERAL ATHLETE CONTEXT
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
      `FITNESS GOALS:\n${fitnessGoals.join(", ")}`
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
    sections.push(`TIMEFRAME:\n${timeframe}`);
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

// ------------------------------------------------------------
// HUNTER STEIN METHOD
// ------------------------------------------------------------

const HUNTER_STEIN_METHOD = `
HUNTER STEIN ACTIVATION METHOD

Apply these principles to every exercise whenever appropriate.

1. PRE-ACTIVATION
Engage the target muscle before initiating the movement.

2. EXPLOSIVE CONCENTRIC INTENT
Move the resistance with maximum safe intent during the lifting, pushing, or pulling phase.

3. CONTROLLED ECCENTRIC
Use approximately a 2–3 second eccentric whenever appropriate.

4. FULL-BODY TENSION
Brace the core and create appropriate shoulder, scapular, and lower-body tension.

5. MIND-MUSCLE CONNECTION
The athlete should actively feel the intended target muscles working.

6. PERFECT FORM
If technique significantly breaks down, the set should end.

EVERY EXERCISE MUST HAVE AN activation_cue.

Activation cues must be:
- movement-specific
- short
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

// ------------------------------------------------------------
// WEIGHT TRAINING METHOD
// ------------------------------------------------------------

const WEIGHTS_METHOD = `
WEIGHT TRAINING APPLICATION

For loaded movements:
- Pre-activate the target muscle.
- Use maximum safe concentric intent.
- Control the eccentric.
- Brace the trunk.
- Maintain consistent movement path.
- Use appropriate range of motion.
- Stop the set when technique meaningfully deteriorates.

Every exercise must have an activation_cue explaining the specific setup and tension strategy.
`;

// ------------------------------------------------------------
// LEG TRAINING
// ------------------------------------------------------------

const LEG_TRAINING_MANDATE = `
LEG TRAINING — MANDATORY UNLESS EXPLICITLY EXCLUDED

Unless the athlete explicitly states they do not want leg training, every program must train the lower body.

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

WEIGHTED CALISTHENICS OPTIONS:
- weighted squats
- weighted pistol squats
- weighted lunges
- weighted Bulgarian split squats
- weighted calf raises
- weighted Nordic curls
- weighted glute bridges

WEIGHT TRAINING OPTIONS:
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

If the athlete explicitly excludes leg training, respect that restriction.
`;

// ------------------------------------------------------------
// RECOVERY RULES
// ------------------------------------------------------------

const RECOVERY_RULES = `
RECOVERY AND SAFETY

- Do not program every set to failure.
- Generally leave approximately 1–3 reps in reserve on strength and hypertrophy work.
- Skill work should prioritize quality over fatigue.
- Avoid unnecessary consecutive high-CNS days.
- Include appropriate rest days.
- Do not aggressively increase weekly volume.
- If previous performance indicates poor recovery, reduce training stress.
- If pain is reported, do not progress the painful movement.
- Never tell the athlete to simply push through significant pain.
`;

// ------------------------------------------------------------
// PERIODIZATION
// ------------------------------------------------------------

const PERIODIZATION_RULES = `
12-WEEK PERIODIZATION

WEEKS 1–4: FOUNDATION
- Establish technique.
- Establish sustainable volume.
- Build work capacity.
- Identify appropriate exercise difficulty.
- Week 4 is a deload.

WEEKS 5–8: INTENSIFICATION
- Increase difficulty appropriately.
- Progress resistance, reps, sets, leverage, skill complexity, or density when justified.
- Keep technique high.
- Week 8 is a deload.

WEEKS 9–12: PEAK AND MASTERY
- Move toward the athlete's primary goal.
- Prioritize high-value movements and skills.
- Use appropriate intensity.
- Week 12 is a deload and consolidation week.

Progression must be earned from performance.
Do not automatically increase everything every week.
`;

// ------------------------------------------------------------
// TRAINING TYPE RULES
// ------------------------------------------------------------

const TRAINING_TYPE_RULES = {
  calisthenics: `
CALISTHENICS RULES

- Prioritize bodyweight movements and skill progressions.
- Use regressions and progressions appropriate to current ability.
- Skill work should generally occur early in the session.
- Use harder leverage, increased range of motion, additional reps, longer holds, or reduced assistance as progression tools.
- Do not randomly add weights unless specifically appropriate.
`,

  weighted_calisthenics: `
WEIGHTED CALISTHENICS RULES

- Combine bodyweight skill work with intelligently loaded movements.
- Use external load for movements such as pull-ups, dips, push-ups, squats, and lunges when appropriate.
- Skill work should generally occur before heavily fatiguing loaded work.
- Progress load conservatively.
- Preserve clean bodyweight technique.
`,

  weights: `
WEIGHT TRAINING RULES

- Prioritize barbells, dumbbells, cables, machines, and equipment actually available.
- Focus on hypertrophy, strength, aesthetics, or endurance according to the athlete's goals.
- Use appropriate compound and isolation movements.
- Do not add advanced calisthenics skill work unless specifically requested.
`,

  hybrid: `
HYBRID TRAINING RULES

- Combine calisthenics and weight training intelligently.
- Perform high-skill calisthenics work before fatiguing weight work when skill quality matters.
- Use weights to strengthen muscles and movement patterns supporting calisthenics goals.
- Avoid excessive duplication between modalities.
`,
};

// ------------------------------------------------------------
// PHASE INFORMATION
// ------------------------------------------------------------

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

// ------------------------------------------------------------
// ORIGINAL FULL PROGRAM PROMPT
// ------------------------------------------------------------

export function buildProgramPrompt(trainingType, data = {}) {
  const typeRules =
    TRAINING_TYPE_RULES[trainingType] ||
    TRAINING_TYPE_RULES.calisthenics;

  return `
You are an elite personal trainer and program designer creating a personalized 12-week training program.

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

${LEG_TRAINING_MANDATE}

${RECOVERY_RULES}

${PERIODIZATION_RULES}

PROGRAMMING PRINCIPLES

1. The athlete's goals are the highest priority.
2. The program must be realistic for the athlete's available equipment and schedule.
3. Never use equipment the athlete does not have.
4. Do not randomly change exercises every week.
5. Progress difficulty intelligently.
6. Skill work should be performed while the athlete is relatively fresh.
7. Balance push, pull, legs, core, and conditioning according to the athlete's goals.
8. Do not overload the same joints or movement patterns unnecessarily.
9. Every exercise requires an activation_cue.
10. Do not prescribe unnecessary failure training.
11. Always respect stated limitations and requirements.

The preferred production architecture is now WEEK-BY-WEEK generation using buildWeekPrompt().
`;
}

// ------------------------------------------------------------
// PREVIOUS WEEK COMPACTION
// ------------------------------------------------------------

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

// ------------------------------------------------------------
// PERFORMANCE LOG COMPACTION
// ------------------------------------------------------------

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

      notes: exercise.notes || "",
    })),

    post_workout_checkin:
      log.post_workout_checkin ||
      log.checkin ||
      log.feedback ||
      "",
  }));
}

// ------------------------------------------------------------
// WEEK-BY-WEEK AI PROMPT
// ------------------------------------------------------------

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
You are an elite personal trainer generating ONE WEEK of a personalized 12-week training program.

CRITICAL INSTRUCTION:

GENERATE ONLY WEEK ${week}.

DO NOT GENERATE FUTURE WEEKS.
DO NOT GENERATE THE ENTIRE 12-WEEK PROGRAM.
DO NOT RETURN MULTIPLE WEEKS.
DO NOT RETURN A MACROCYCLE.

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

${LEG_TRAINING_MANDATE}

${RECOVERY_RULES}

${PERIODIZATION_RULES}

CURRENT WEEK:
${week}

CURRENT PHASE:
${phase.name}

WEEK WITHIN PHASE:
${phase.weekInPhase}/4

WEEK TYPE:
${phase.weekType}

CURRENT PHASE FOCUS:
${phase.focus}

PREVIOUS WEEK'S PROGRAM:
${previousWeekText}

ACTUAL ATHLETE PERFORMANCE FROM THE PREVIOUS WEEK:
${performanceText}

WEEKLY PROGRESSION LOGIC

The athlete's previous-week performance is extremely important.

DO NOT simply copy the previous week.

If the athlete:

- completed the planned work comfortably
- maintained good technique
- had no concerning fatigue
- did not report pain

then make a SMALL, measurable progression.

Possible progressions include:

- additional repetitions
- slightly more load
- additional set when justified
- harder bodyweight variation
- longer skill hold
- reduced assistance
- improved range of motion
- slightly increased training density
- improved exercise complexity

Do NOT increase multiple progression variables aggressively at the same time.

If the athlete:

- missed reps
- failed to complete planned sets
- reported excessive fatigue
- reported poor recovery
- struggled technically

then maintain or slightly reduce the difficulty.

If the athlete reports PAIN:

- Do NOT progress the painful movement.
- Regress or substitute the movement.
- Respect the athlete's limitation.
- Never tell the athlete to simply push through pain.

If a movement is working well, keep it long enough to measure progression rather than constantly replacing it.

GOAL PROGRESSION

Every week must move the athlete closer to their onboarding goals.

For skill goals:

- prioritize quality skill practice
- use appropriate progressions
- avoid excessive fatigue before skill work

For strength goals:

- prioritize high-value compound movements
- use appropriate rest periods
- progress load, reps, or leverage conservatively

For muscle-growth goals:

- use sufficient weekly volume
- include appropriate hypertrophy work
- maintain progressive overload

For endurance goals:

- include appropriate conditioning
- manage fatigue appropriately

For fat-loss and body-recomposition goals:

- preserve muscle through resistance training
- use conditioning where appropriate
- do not create unnecessarily extreme training volume

LEG REQUIREMENT

Unless the athlete explicitly excludes leg training, include meaningful lower-body work this week.

DELOAD RULE

Week 4, Week 8, and Week 12 are deload/consolidation weeks.

During a deload:

- reduce training stress
- maintain movement patterns
- avoid unnecessary failure
- preserve technique
- reduce volume and/or intensity appropriately

Do not make the athlete completely inactive unless recovery requires it.

WEEK STRUCTURE

Create an appropriate number of training days based on:

- athlete schedule
- requirements
- training type
- goals
- recovery needs

Do not invent a schedule that contradicts the athlete's availability.

Every training day must include:

- day_name
- workout_type
- exercises

Every exercise must include:

- name
- sets
- reps
- rest_seconds
- notes
- activation_cue

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
            "rest_seconds": 0,
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

Do not use markdown fences.
Do not include commentary.
Do not include explanations outside the JSON.
`;
}

// ------------------------------------------------------------
// KAEL AI COACH
// ------------------------------------------------------------

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

You have trained world-class athletes across strength training, calisthenics, bodybuilding, and athletic performance.

${typeDesc[trainingType] || ""}

When the athlete asks about another training style, still provide useful expert advice.

PERSONALITY:

- Direct
- Real
- No BS
- Friendly but not fluffy
- Respectful
- Honest

RESPONSE STYLE:

Use approximately 2–4 sentences by default unless a structured breakdown is genuinely necessary.

Avoid generic filler.

SAFETY:

Never encourage an athlete to train through significant pain or injury.

When pain is mentioned, recommend stopping or modifying the painful movement and seeking appropriate professional evaluation when warranted.

${
  isElite
    ? `
SECRET TIPS RULE

Whenever the athlete asks HOW to do something, include at least one useful advanced technique when appropriate.

Examples:

- tension cues
- breathing and bracing
- positioning
- timing
- recovery strategies
- progression strategies
- biomechanical details

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

// ------------------------------------------------------------
// PROGRESS PHOTO ANALYSIS
// ------------------------------------------------------------

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

Review this physique photo and provide direct, genuine, personalized feedback.

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
