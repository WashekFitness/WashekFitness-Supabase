// Training type configurations
export const TRAINING_TYPES = [
  {
    value: 'calisthenics',
    label: 'Calisthenics',
    iconName: 'PersonStanding',
    desc: 'Bodyweight training focused on mastering skills like muscle-ups, handstands, planches, and levers. Progressive overload through harder variations, not added weight.',
    hasSkills: true,
    hasLevel: true,
    hasTimeframe: true,
    hasWeightGoals: false,
  },
  {
    value: 'weighted_calisthenics',
    label: 'Weighted Calisthenics',
    iconName: 'Dumbbell',
    desc: 'Bodyweight movements with added weight (dip belt, weighted vest) to build raw strength and push past plateaus. Combines skill work with loaded progressions for faster gains.',
    hasSkills: true,
    hasLevel: true,
    hasTimeframe: true,
    hasWeightGoals: false,
  },
  {
    value: 'weights',
    label: 'Weight Training',
    iconName: 'Trophy',
    desc: 'Traditional gym training with free weights, cables, and machines. Build muscle, strength, and aesthetics through progressive overload with iron. No skill work — pure hypertrophy and strength.',
    hasSkills: false,
    hasLevel: false,
    hasTimeframe: false,
    hasWeightGoals: true,
  },
  {
    value: 'hybrid',
    label: 'Hybrid Training',
    iconName: 'Layers',
    desc: 'The best of both worlds. Calisthenics skill work first when your CNS is fresh, then weight training at the end for maximal muscle growth. Weights are chosen to accelerate your calisthenics goals too.',
    hasSkills: true,
    hasLevel: true,
    hasTimeframe: true,
    hasWeightGoals: true,
  },
];

export const CALISTHENICS_GOALS = [
  { value: 'gain_muscle', label: 'Gain Muscle', iconName: 'Dumbbell' },
  { value: 'lose_weight', label: 'Lose Weight', iconName: 'Scale' },
  { value: 'get_stronger', label: 'Get Stronger', iconName: 'Trophy' },
  { value: 'improve_endurance', label: 'Improve Endurance', iconName: 'Wind' },
  { value: 'learn_skills', label: 'Learn Skills', iconName: 'Target' },
  { value: 'general_health', label: 'General Health', iconName: 'Heart' },
  { value: 'body_recomp', label: 'Body Recomp', iconName: 'PersonStanding' },
];

export const WEIGHT_GOALS = [
  { value: 'muscle_growth', label: 'Muscle Growth', iconName: 'Dumbbell' },
  { value: 'lose_weight', label: 'Lose Weight', iconName: 'Scale' },
  { value: 'gain_strength', label: 'Gain Strength', iconName: 'Trophy' },
  { value: 'body_recomp', label: 'Body Recomp', iconName: 'PersonStanding' },
  { value: 'aesthetics', label: 'Aesthetics', iconName: 'Sparkles' },
  { value: 'improve_endurance', label: 'Improve Endurance', iconName: 'Wind' },
  { value: 'general_health', label: 'General Health', iconName: 'Heart' },
];

// ─────────────────────────────────────────────────────────────
// ATHLETE CONTEXT
// ─────────────────────────────────────────────────────────────

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

  const heightStr =
    unit === 'metric'
      ? `${heightFt || '?'}cm`
      : `${heightFt || '?'}'${heightIn || 0}"`;

  const weightStr =
    unit === 'metric'
      ? `${weightLbs || '?'}kg`
      : `${weightLbs || '?'}lbs`;

  return `ATHLETE: ${gender || 'unspecified'}${
    level ? `, ${level} level` : ''
  }, age ${age || '?'}, ${weightStr}, ${heightStr}`;
}

function buildGenderRules(gender) {
  if (gender === 'male') {
    return `
MALE TRAINING CONSIDERATIONS:
- Use appropriate push/pull balance.
- Prioritize scapular stability and strict technique.
- Allow adequate recovery for high-intensity CNS-demanding work.
- Do not assume the athlete needs unnecessarily high volume.
`;
  }

  if (gender === 'female') {
    return `
FEMALE TRAINING CONSIDERATIONS:
- Use appropriate strength and hypertrophy volume.
- Prioritize posterior chain, core stability, and movement quality.
- Use controlled eccentrics.
- Do not assume the athlete needs lighter training solely because they are female.
- Adjust volume and intensity according to actual performance and recovery feedback.
`;
  }

  return `
GENDER-NEUTRAL TRAINING CONSIDERATIONS:
- Use balanced programming.
- Prioritize movement quality, recovery, and progressive overload.
- Make decisions from actual athlete performance rather than assumptions.
`;
}

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

  const parts = [buildAthleteProfile(data)];

  if (currentSkills) {
    parts.push(`CURRENT SKILLS: ${currentSkills}`);
  }

  if (fitnessGoals?.length) {
    parts.push(
      `GOALS: ${fitnessGoals.join(', ')}. ${goalDescription || ''}`
    );
  } else if (goalDescription) {
    parts.push(`GOALS: ${goalDescription}`);
  }

  if (weightGoals?.length) {
    parts.push(`WEIGHT TRAINING GOALS: ${weightGoals.join(', ')}`);
  }

  if (timeframe) {
    parts.push(`TIMEFRAME: ${timeframe}`);
  }

  if (equipment) {
    parts.push(`EQUIPMENT: ${equipment}`);
  }

  if (requirements) {
    parts.push(
      `REQUIREMENTS / LIMITATIONS / SCHEDULE / NOTES: ${requirements}`
    );
  }

  parts.push(buildGenderRules(data.gender));

  return parts.join('\n');
}

// ─────────────────────────────────────────────────────────────
// GENERAL PROGRAMMING RULES
// ─────────────────────────────────────────────────────────────

const HUNTER_STEIN_METHOD = `
HUNTER STEIN ACTIVATION METHOD — APPLY TO EVERY EXERCISE

1. PRE-ACTIVATION
Engage the target muscle before initiating the movement.

2. EXPLOSIVE CONCENTRIC INTENT
Move the resistance with maximum safe intent during the lifting/pushing/pulling phase.

3. CONTROLLED ECCENTRIC
Use approximately a 2–3 second eccentric whenever appropriate. Do not sacrifice technique to force this rule.

4. FULL-BODY TENSION
Brace the core, create appropriate shoulder/scapular tension, and eliminate unnecessary energy leaks.

5. MIND-MUSCLE CONNECTION
The athlete should actively feel the intended target muscles working.

6. PERFECT FORM
If technique breaks down, the set should end. Do not reward sloppy repetitions.

EVERY EXERCISE MUST HAVE AN activation_cue.

The activation cue must be:
- movement-specific
- short
- actionable
- biomechanically useful
- different when appropriate for different movements

Examples:
Pull-up:
"Depress the scapulae, brace hard, then drive elbows toward the hips."

Push-up:
"Screw the hands into the floor, brace the abs and squeeze the glutes before pressing."

Handstand:
"Push the floor away aggressively, fully elevate the shoulders and reach the toes upward."

Muscle-up:
"Create a strong hollow-to-arch transition, then drive the elbows down and back aggressively."

Front lever:
"Depress the scapulae, brace the core and pull the bar toward the hips."
`;

const WEIGHTS_METHOD = `
WEIGHT TRAINING APPLICATION

For loaded movements:
- Pre-activate the target muscle.
- Use maximum safe concentric intent.
- Control the eccentric.
- Brace the trunk.
- Create appropriate foot/hand torque.
- Maintain consistent bar or implement path.
- Stop the set when technique meaningfully deteriorates.

Activation cues must explain the specific setup and tension strategy for the exercise.
`;

const LEG_TRAINING_MANDATE = `
LEG TRAINING — MANDATORY UNLESS EXPLICITLY EXCLUDED

Unless the athlete explicitly states that they do not want leg training, every program must train the lower body.

Across every week, target:
- quads
- hamstrings
- glutes
- calves

Aim for at least 3–4 meaningful lower-body exercises per week.

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

HYBRID:
Use an appropriate combination of the above.

If the athlete explicitly excludes legs, respect that restriction.
`;

const RECOVERY_RULES = `
RECOVERY AND SAFETY

- Do not program every set to failure.
- Generally leave approximately 1–3 reps in reserve on strength/hypertrophy work unless a specific exercise calls for otherwise.
- Skill work should prioritize quality over fatigue.
- Avoid unnecessary consecutive high-CNS days.
- Include appropriate rest days.
- Do not aggressively increase weekly volume.
- If previous performance indicates poor recovery, reduce rather than blindly progress.
- If pain is reported, do not progress the painful movement.
- Never interpret pain as something the athlete should simply push through.
`;

const PERIODIZATION_RULES = `
12-WEEK PERIODIZATION

Weeks 1–4: FOUNDATION
- Establish technique.
- Establish sustainable training volume.
- Build work capacity.
- Identify appropriate exercise difficulty.
- Week 4 is a deload.

Weeks 5–8: INTENSIFICATION
- Increase difficulty appropriately.
- Progress resistance, reps, sets, leverage, skill complexity, or density when justified.
- Keep technique high.
- Week 8 is a deload.

Weeks 9–12: PEAK / MASTERY
- Move toward the athlete's stated goal.
- Prioritize high-value movements and skills.
- Use appropriate high-quality intensity.
- Week 12 is a deload / consolidation week.

Progression should be earned from performance rather than automatically increasing everything every week.
`;

// ─────────────────────────────────────────────────────────────
// TRAINING-TYPE RULES
// ─────────────────────────────────────────────────────────────

const TRAINING_TYPE_RULES = {
  calisthenics: `
CALISTHENICS RULES

- Prioritize bodyweight movements and skill progressions.
- Use regressions and progressions appropriate to the athlete's current ability.
- Skill work should generally occur early in the session.
- Use harder leverage, increased range of motion, additional reps, longer holds, or reduced assistance as progression tools.
- Do not randomly add weights unless the athlete's program specifically calls for weighted calisthenics.
`,

  weighted_calisthenics: `
WEIGHTED CALISTHENICS RULES

- Combine bodyweight skill work with intelligently loaded movements.
- Use external load for movements such as pull-ups, dips, push-ups, squats, lunges, etc. when appropriate.
- Skill work should generally occur before heavily fatiguing loaded work.
- Progress load conservatively.
- Preserve clean bodyweight technique.
`,

  weights: `
WEIGHT TRAINING RULES

- Prioritize barbells, dumbbells, cables, machines, and other equipment actually available to the athlete.
- Focus on hypertrophy, strength, aesthetics, or endurance according to the athlete's stated goals.
- Use appropriate compound and isolation movements.
- Do not add calisthenics skill work unless it is specifically useful or requested.
- Do not assume a standard commercial gym if the athlete's equipment says otherwise.
`,

  hybrid: `
HYBRID TRAINING RULES

- Combine calisthenics and weight training intelligently.
- Perform high-skill calisthenics work before fatiguing weight work when skill quality matters.
- Use weights to strengthen muscles and movement patterns that support the athlete's calisthenics goals.
- Avoid excessive duplication between modalities.
`,
};

// ─────────────────────────────────────────────────────────────
// PHASE HELPERS
// ─────────────────────────────────────────────────────────────

export function getPhaseForWeek(weekNumber) {
  const week = Number(weekNumber) || 1;

  if (week <= 4) {
    return {
      index: 0,
      name: 'Foundation',
      weekInPhase: week,
      weekType: week === 4 ? 'Deload' : week === 1 ? 'Baseline' : 'Progression',
      focus:
        week === 4
          ? 'Deload, recovery, technique consolidation'
          : 'Technique, sustainable volume, movement quality, base strength',
    };
  }

  if (week <= 8) {
    const weekInPhase = week - 4;

    return {
      index: 1,
      name: 'Intensification',
      weekInPhase,
      weekType:
        week === 8
          ? 'Deload'
          : week === 5
            ? 'Progression Reset'
            : 'Progression',
      focus:
        week === 8
          ? 'Deload, recovery, technique consolidation'
          : 'Progressive overload, increased strength, skill difficulty',
    };
  }

  const weekInPhase = week - 8;

  return {
    index: 2,
    name: 'Peak & Mastery',
    weekInPhase,
    weekType:
      week === 12
        ? 'Deload'
        : week === 9
          ? 'Progression Reset'
          : 'Progression',
    focus:
      week === 12
        ? 'Deload, recovery, consolidation'
        : 'Goal-specific strength, skill mastery and performance',
  };
}

// ─────────────────────────────────────────────────────────────
// ORIGINAL PROGRAM PROMPT
// ─────────────────────────────────────────────────────────────

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

${trainingType === 'weights' || trainingType === 'hybrid'
  ? WEIGHTS_METHOD
  : ''}

${LEG_TRAINING_MANDATE}

${RECOVERY_RULES}

${PERIODIZATION_RULES}

PROGRAMMING PRINCIPLES

1. The athlete's goals are the highest priority.
2. The program must be realistic for the athlete's available equipment and schedule.
3. Do not use exercises requiring equipment the athlete does not have.
4. Do not randomly change exercises every week. Maintain useful movements long enough to measure progression.
5. Progress difficulty intelligently.
6. Skill work should be performed while the athlete is relatively fresh.
7. Balance push, pull, legs, core, and conditioning according to the athlete's goals.
8. Do not overload the same joints or movement patterns on consecutive days without a reason.
9. Every exercise requires an activation_cue.
10. Do not prescribe unnecessary failure training.
11. The athlete's stated limitations and requirements must always be respected.

The original application may use this function for program-level generation, but the preferred production flow is now WEEK-BY-WEEK generation using buildWeekPrompt().
`;
}

// ─────────────────────────────────────────────────────────────
// WEEKLY GENERATION
// ─────────────────────────────────────────────────────────────

function compactPreviousWeek(previousWeek) {
  if (!previousWeek) return null;

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

function compactPerformanceLogs(performanceLogs = []) {
  return performanceLogs.map((log) => ({
    date: log.date || log.completed_at || null,
    day_name: log.day_name || log.workout_name || null,

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

      notes: exercise.notes || '',
    })),

    post_workout_checkin:
      log.post_workout_checkin ||
      log.checkin ||
      log.feedback ||
      '',
  }));
}

/**
 * Build exactly ONE week.
 *
 * Week 1:
 *   Uses the athlete profile and creates a baseline.
 *
 * Week 2+:
 *   Uses the athlete profile,
 *   the previous week's actual program,
 *   and the athlete's actual previous-week workout logs.
 *
 * This keeps AI usage and token consumption dramatically lower
 * than generating the entire 12-week program at onboarding.
 */
export function buildWeekPrompt(
  trainingType,
  data = {},
  weekNumber = 1,
  previousWeek = null,
  performanceLogs = []
) {
  const week = Math.max(1, Math.min(12, Number(weekNumber) || 1));

  const phase = getPhaseForWeek(week);

  const typeRules =
    TRAINING_TYPE_RULES[trainingType] ||
    TRAINING_TYPE_RULES.calisthenics;

  const previousWeekData = compactPreviousWeek(previousWeek);
  const performanceData = compactPerformanceLogs(performanceLogs);

  const previousWeekText = previousWeekData
    ? JSON.stringify(previousWeekData, null, 2)
    : 'No previous week exists. This is the athlete\\'s first training week.';

  const performanceText = performanceData.length
    ? JSON.stringify(performanceData, null, 2)
    : 'No completed workout logs are available. Establish the week from the athlete profile and current programming position.';

  return `
You are an elite personal trainer generating ONE WEEK of a personalized 12-week training program.

IMPORTANT:
GENERATE ONLY WEEK ${week}.
DO NOT GENERATE WEEKS ${week + 1 > 12 ? 'AFTER WEEK 12' : `${week + 1}-12`}.
DO NOT GENERATE THE ENTIRE 12-WEEK PROGRAM.
DO NOT RETURN A MACROCYCLE.
DO NOT RETURN MULTIPLE WEEKS.

${buildContext(data)}

TRAINING TYPE:
${trainingType}

${typeRules}

${HUNTER_STEIN_METHOD}

${trainingType === 'weights' || trainingType === 'hybrid'
  ? WEIGHTS_METHOD
  : ''}

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
- completed the planned work comfortably,
- maintained good technique,
- had no concerning fatigue,
- and did not report pain,

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
- missed reps,
- failed to complete planned sets,
- reported excessive fatigue,
- reported poor recovery,
- or struggled technically,

then maintain or slightly reduce the difficulty.

If the athlete reports PAIN:
- Do NOT progress the painful movement.
- Regress or substitute the movement.
- Respect the athlete's stated limitation.
- Never instruct the athlete to simply push through pain.

If a movement is clearly working well, keep it in the program long enough to measure progression rather than constantly replacing it.

GOAL PROGRESSION

Every week should move the athlete closer to the goals they selected during onboarding.

The most important goal-specific work should appear early enough in the workout that fatigue does not destroy quality.

For skill goals:
- prioritize quality skill practice
- use appropriate progressions
- avoid excessive fatigue before skill work

For strength goals:
- prioritize high-value compound movements
- use appropriate rest periods
- progress load/reps/leverages conservatively

For muscle-growth goals:
- use sufficient weekly volume
- include appropriate hypertrophy work
- maintain progressive overload

For endurance goals:
- include appropriate conditioning
- manage fatigue so strength and skill work remain productive

For fat-loss/body-recomposition goals:
- preserve muscle through resistance training
- use conditioning where appropriate
- do not create unnecessarily extreme training volume

LEG REQUIREMENT:
Unless the athlete explicitly excludes leg training, include meaningful lower-body work this week.

DELOAD RULE:
Week 4, Week 8, and Week 12 are deload/consolidation weeks.

During a deload:
- reduce training stress
- maintain movement patterns
- avoid unnecessary failure
- preserve technique
- reduce volume and/or intensity appropriately

Do not turn a deload into a completely inactive week unless the athlete's recovery requires it.

WEEK STRUCTURE

Create an appropriate number of training days based on:
- athlete schedule
- requirements
- training type
- goal
- recovery needs

Do not invent an arbitrary schedule that contradicts the athlete's availability.

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

Use exactly this structure:

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

Do not include markdown fences.
Do not include commentary.
Do not include explanations outside the JSON object.
`;
}

// ─────────────────────────────────────────────────────────────
// KAEL
// ─────────────────────────────────────────────────────────────

export function getKaelSystemPrompt(
  trainingType,
  firstName,
  isElite = false
) {
  const typeContext = {
    calisthenics: 'elite-level calisthenics coach',
    weighted_calisthenics:
      'elite-level weighted calisthenics coach',
    weights:
      'elite-level weight training and strength coach',
    hybrid:
      'elite-level hybrid training coach (calisthenics + weights)',
  };

  const typeDesc = {
    calisthenics:
      'You specialize in bodyweight skill training — muscle-ups, handstands, planches, levers, and all calisthenics progressions.',

    weighted_calisthenics:
      'You specialize in weighted bodyweight training — adding load to pull-ups, dips, and other movements for maximum strength gains while pursuing skills.',

    weights:
      'You specialize in weight training — hypertrophy, strength, powerlifting, bodybuilding, and aesthetics with free weights, cables, and machines.',

    hybrid:
      'You specialize in combining calisthenics skill work with weight training — structuring sessions to maximize both skill acquisition and muscle/strength growth.',
  };

  return `You are Kael, an ${
    typeContext[trainingType] || 'elite-level fitness coach'
  }${firstName ? ` — your athlete's name is ${firstName}` : ''}.

You have trained world-class street workout athletes, gymnasts, powerlifters, bodybuilders, and elite military operators.

You can answer questions about ANY form of training — calisthenics, weighted calisthenics, weight training, or hybrid combinations.

${typeDesc[trainingType] || ''}

When the athlete asks about a training type outside your primary specialty, still give expert advice.

PERSONALITY:
Direct, real, no BS.
Friendly but not fluffy.
Get to the point.
Respect the athlete enough to tell them the truth.

RESPONSE STYLE:
2–4 sentences by default unless a structured breakdown is genuinely needed.
No long intros.
No generic filler.

SAFETY:
Never encourage an athlete to train through significant pain or injury.
When pain is mentioned, recommend stopping or modifying the painful movement and seeking appropriate professional evaluation when warranted.

${
  isElite
    ? `
SECRET TIPS RULE — CRITICAL

Whenever the user asks HOW to do something, include at least one useful elite-level or insider technique when appropriate.

Examples:
- tension cues
- breathing/bracing details
- micro-timing
- positioning
- recovery strategies
- progression strategies
- biomechanical details

Label these with:
"🔐 Elite tip:"
or
"⚡ Secret:"
`
    : ''
}

Only use the athlete's name occasionally when natural.
`;
}

// ─────────────────────────────────────────────────────────────
// PROGRESS PHOTO ANALYSIS
// ─────────────────────────────────────────────────────────────

export function getProgressPhotoPrompt(
  trainingType,
  firstName,
  prevContext,
  equipment
) {
  const exerciseGuidance = {
    calisthenics:
      'For lagging muscle groups, recommend calisthenics exercises appropriate to the athlete. Do not recommend gym equipment unless their program explicitly includes it.',

    weighted_calisthenics:
      'For lagging muscle groups, prioritize weighted calisthenics and bodyweight progressions using equipment the athlete actually has.',

    weights:
      `For lagging muscle groups, recommend weight-training exercises using the athlete's available equipment: ${
        equipment || 'their available gym equipment'
      }. Do not recommend equipment they do not have.`,

    hybrid:
      `For lagging muscle groups, recommend a useful combination of calisthenics and weight training based on the athlete's equipment: ${
        equipment || 'their available equipment'
      }.`,
  };

  const coachTitle = {
    calisthenics: 'calisthenics',
    weighted_calisthenics: 'weighted calisthenics',
    weights: 'weight training',
    hybrid: 'hybrid training',
  };

  return `You are Kael, ${firstName || 'the athlete'}'s personal ${
    coachTitle[trainingType] || 'fitness'
  } coach.

Review this physique photo and give direct, genuine, personalized feedback.

${prevContext || ''}

Provide:

1. An estimated body-fat percentage range.
2. A numeric midpoint for graphing.
3. Specific visible strengths.
4. Specific areas that appear to lag.
5. If a previous photo is available, identify visible changes.
6. Personalized training recommendations.

${exerciseGuidance[trainingType] || exerciseGuidance.calisthenics}

Do not make medical diagnoses.
Do not claim certainty from a photograph.
`;
}
