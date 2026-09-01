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

// ------------------------------------------------------------
// Helper functions
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
    return 'Male: volume-heavy, push/pull balance, scapular stability, strict form. Prioritize CNS recovery with adequate rest days.';
  }

  if (gender === 'female') {
    return 'Female: higher reps (8-15), more frequency at moderate intensity, prioritize posterior chain, core stability, hip mobility. Controlled eccentrics to protect lax connective tissue. Hormonal cycle awareness: slightly higher volume in follicular phase.';
  }

  return 'Gender-neutral: balanced approach, moderate volume, focus on form and progressive overload.';
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
    parts.push(
      `WEIGHT TRAINING GOALS: ${weightGoals.join(', ')}`
    );
  }

  if (timeframe) {
    parts.push(`TIMEFRAME: ${timeframe}`);
  }

  if (equipment) {
    parts.push(`EQUIPMENT: ${equipment}`);
  }

  if (requirements) {
    parts.push(
      `REQUIREMENTS (time available, injuries, notes): ${requirements}`
    );
  }

  parts.push(
    `GENDER RULES: ${buildGenderRules(data.gender)}`
  );

  return parts.join('\n');
}

// ------------------------------------------------------------
// Shared output/schema instructions
// ------------------------------------------------------------

const OUTPUT_FORMAT = `OUTPUT: Generate ALL 12 microcycles. Each microcycle has week_number (1-12), mesocycle_index (0, 1, or 2), and days array. Each day has day_name, workout_type, and exercises array. Each exercise has name, sets (number), reps (string like "5" or "8-10" or "6s hold"), rest_seconds (number), notes (coaching cue string), and activation_cue (concise activation and form cue string — see Hunter Stein method).`;

const SCHEMA_INSTRUCTION = `Respond as a JSON object with this structure:
{
  "program_name": string,
  "duration_weeks": number,
  "macrocycle": {
    "overview": string,
    "phases": [
      {
        "name": string,
        "weeks": string,
        "focus": string
      }
    ]
  },
  "mesocycles": [
    {
      "name": string,
      "focus": string,
      "weeks": number,
      "intensity": string,
      "week_start": number,
      "week_end": number
    }
  ],
  "microcycles": [
    {
      "week_number": number,
      "mesocycle_index": number,
      "week_type": string,
      "days": [
        {
          "day_name": string,
          "workout_type": string,
          "exercises": [
            {
              "name": string,
              "sets": number,
              "reps": string,
              "rest_seconds": number,
              "notes": string,
              "activation_cue": string
            }
          ]
        }
      ]
    }
  ]
}`;

// ------------------------------------------------------------
// Hunter Stein activation method
// ------------------------------------------------------------

const HUNTER_STEIN_METHOD = `── HUNTER STEIN ACTIVATION METHOD (MANDATORY — INTEGRATE INTO EVERY EXERCISE ALONGSIDE ALL OTHER METHODS) ──
This method layers ON TOP of all other methods (submax, periodization, progressive overload). It is about achieving perfect muscle activation while being maximally explosive and efficient — without ever breaking form. This accelerates progress by ensuring every rep trains the nervous system correctly.

CORE PRINCIPLES:
1. PRE-ACTIVATION: Before each primary movement, engage the target muscle group — mentally and physically "turn on" the right muscles before moving.
2. EXPLOSIVE CONCENTRIC: On the lifting/pushing/pulling phase, move with MAXIMUM intent and speed — even under heavy load. Recruits high-threshold motor units and builds rate of force development.
3. CONTROLLED ECCENTRIC (2-3s negative): Never let gravity do the work. Eccentrics build tendon strength and stimulate muscle growth.
4. FULL-BODY TENSION: Brace core, squeeze glutes, pack shoulders. No energy leaks. Every rep looks identical to rep 1.
5. MIND-MUSCLE CONNECTION: Feel the target muscle on every rep. If you can't feel it, adjust position or reduce load.
6. PERFECT FORM ALWAYS: If form breaks, the set is over. One sloppy rep teaches bad neural patterning — non-negotiable.

ACTIVATION CUE (REQUIRED FOR EVERY EXERCISE): Each exercise must include an "activation_cue" field — a concise, specific, actionable instruction telling the athlete exactly how to engage the correct muscles and execute with perfect form. Examples:
- Pull-ups: "Depress and retract scapulae — think elbows to hips, not chin over bar"
- Push-ups: "Screw hands into the floor, squeeze glutes hard, pull chest toward hands"
- Handstand hold: "Push the floor away aggressively, protract shoulders fully, reach toes to ceiling"
- Muscle-up: "Aggressive hip pop, then pull elbows DOWN fast — not around the bar"
- Front Lever: "Depress scapulae hard, round upper back, pull bar to hips"

These cues must be movement-specific and immediately actionable — not generic platitudes.`;

const HUNTER_STEIN_WEIGHTS_NOTE = `WEIGHT TRAINING ADAPTATION: The Hunter Stein method was designed for calisthenics, but applies perfectly to weight training. For weighted movements:
- Pre-activation: Engage target muscle before the lift (flex lats before pulling, flex chest before pressing)
- Explosive concentric: Maximum bar speed intent on every rep, even if the bar moves slowly due to load
- Controlled eccentric: 2-3s negative on ALL compound lifts — never drop or bounce
- Full-body tension: Brace core, drive feet into floor, create torque (screw feet/hands outward)
- Perfect form: If bar path degrades or form breaks, terminate the set immediately
The activation_cue field is critical for compound lifts — it should tell the athlete exactly how to set up and maintain tension.`;

// ------------------------------------------------------------
// Mandatory leg training
// ------------------------------------------------------------

const LEG_TRAINING_MANDATE = `── LEG TRAINING — MANDATORY FOR ALL TRAINING TYPES ──
Unless the athlete has EXPLICITLY stated in their goals, requirements, or notes that they do NOT want leg training (e.g., "upper body only", "no legs", "skip legs"), you MUST include dedicated leg work in every week of the program. Legs are NOT optional — a complete athlete trains every muscle group.

TARGET ALL MAJOR LEG MUSCLES: quads, hamstrings, glutes, AND calves. Every week must include exercises that hit each of these.

Include at least 1-2 dedicated leg days OR integrate substantial leg work into existing training days (minimum 3-4 leg exercises per week total).

EXERCISE SELECTION BY TRAINING TYPE:
- CALISTHENICS: Pistol squats, shrimp squats, jump squats, sissy squats, Nordic curls, glute bridges, single-leg glute bridges, reverse lunges, Bulgarian split squats (bodyweight), calf raises (single-leg, double-leg), box jumps, broad jumps, wall sits, dragon flag negatives for posterior chain
- WEIGHTED CALISTHENICS: Weighted squats, weighted pistol squats, weighted lunges, weighted Bulgarian split squats, weighted calf raises, Nordic curls (weighted), weighted glute bridges, jump squats with weight
- WEIGHT TRAINING: Back squats, front squats, Romanian deadlifts, deadlifts, walking lunges, leg press, leg extensions, leg curls, calf raises (standing + seated), hip thrusts, Bulgarian split squats (dumbbell or barbell), good mornings, reverse hyperextensions
- HYBRID: Mix of calisthenics and weight leg exercises — e.g., pistol squats for skill/coordination + barbell squats for raw strength, Nordic curls for hamstring health + Romanian deadlifts for posterior chain power

If the athlete explicitly says "no legs", "upper body only", "skip leg training", or similar — then you may skip leg work. Otherwise, legs are MANDATORY in every week.`;

// ------------------------------------------------------------
// Calisthenics
// ------------------------------------------------------------

function calisthenicsPrompt(data) {
  return `You are a world-class calisthenics periodization scientist and coach. Build a COMPLETE 12-week program for this athlete with ALL 12 weekly microcycles fully detailed. This program uses Anton's Submax training method — the fastest evidence-based progression system for calisthenics skills.

${buildContext(data)}

=== PERIODIZATION SCIENCE (MANDATORY — FOLLOW EXACTLY) ===

ADAPTATION HIERARCHY: Tendon adaptation is SLOWEST (weeks 4-12+), then CNS adaptation (days-weeks), then muscle hypertrophy. Volume must increase gradually so tendons can keep up. Never jump more than 10-15% total volume per week. Injury prevention is paramount — when in doubt, do less. Respect any injuries or limitations listed in REQUIREMENTS.

── ANTON'S SUBMAX METHOD (THE CORE OF THIS PROGRAM) ──
Submax training means NEVER training to failure or even near-failure on skill and strength movements. Every set ends 2-3 reps BEFORE failure (3+ RIR on strength sets, 40-60% of max for skill holds). This allows:
1. Higher training frequency without CNS burnout
2. Perfect technique on every rep
3. Faster tendon adaptation
4. Faster skill acquisition
5. Zero overuse injuries from accumulated fatigue damage

SUBMAX RULES TO ENFORCE IN EVERY SESSION:
- Strength sets: stop when reps start to slow or form breaks — never grind. Note this in exercise "notes" field.
- Skill holds (handstand, planche, lever, L-sit): hold for 40-60% of max hold time per set, many sets.
- Never train a skill to failure.
- Encourage high-frequency practice.
- Include a note like "Stop 2-3 reps early — submax" in the notes field for every strength exercise.

WEEKLY STRUCTURE (4-6 training days):
- DAY A — INTENSITY PUSH: Push-dominant movements at 80-90% submax. Low reps (3-5), hard variations, long rests (3-4 min). Skill work first.
- DAY B — INTENSITY PULL: Pull-dominant movements at 80-90% submax. Low reps and long rests.
- DAY C — VOLUME PUSH: Push-dominant movements at 65-75% submax. Moderate reps (6-10).
- DAY D — VOLUME PULL: Pull-dominant movements at 65-75% submax. Moderate reps (6-10).
- DAY E — DELOAD & SKILL: 40-55% effort. Light skill practice, mobility, flexibility, prehab.

Rest days between training days as needed. Never 2 consecutive high-intensity days. Push/pull balance mandatory across the week.

MESOCYCLE STRUCTURE (3 mesocycles of 4 weeks each):
MESO 1 (Weeks 1-4): FOUNDATION + TENDON CONDITIONING
- Wk1: Submax volume LOW (50-60% of capacity).
- Wk2: Submax volume +10%.
- Wk3: Submax volume +10% from wk2.
- Wk4: DELOAD — drop to 40% volume.

MESO 2 (Weeks 5-8): INTENSIFICATION + SKILL BREAKTHROUGH
- Wk5: Reset volume slightly above meso1 peak with harder progressions.
- Wk6: Volume +10%.
- Wk7: Volume +10% from wk6.
- Wk8: DELOAD — cut volume 40%.

MESO 3 (Weeks 9-12): PEAK + SKILL MASTERY
- Wk9: Near-peak submax volume.
- Wk10: Peak volume week.
- Wk11: Taper — reduce volume 20%, keep intensity.
- Wk12: FULL DELOAD — 50% volume, 30% intensity drop.

EXERCISE SELECTION RULES:
- 4-5 training days per week, 5-6 exercises per training day, 2-3 on skill/recovery days
- Push/pull balance mandatory
- Target skill ALWAYS first
- Scapular/rotator cuff prehab every week
- Never repeat same movement pattern twice in one session
- Progressions follow a clear regression → target skill ladder
- Tendon prehab: slow eccentrics (3-5s down), isometric holds 2x/week
- In exercise notes specify the submax cue
- Injury history must be respected

${LEG_TRAINING_MANDATE}

${HUNTER_STEIN_METHOD}

${OUTPUT_FORMAT}

${SCHEMA_INSTRUCTION}`;
}

// ------------------------------------------------------------
// Weighted calisthenics
// ------------------------------------------------------------

function weightedCalisthenicsPrompt(data) {
  return `You are a world-class calisthenics periodization scientist and coach specializing in WEIGHTED calisthenics. Build a COMPLETE 12-week program for this athlete with ALL 12 weekly microcycles fully detailed. This program uses Anton's Submax training method combined with weighted progressions for maximum strength and skill acquisition.

${buildContext(data)}

=== PERIODIZATION SCIENCE ===

ADAPTATION HIERARCHY: Tendon adaptation is SLOWEST, then CNS adaptation, then muscle hypertrophy. Weighted progressions stress tendons MORE than bodyweight — volume must increase gradually. Never jump more than 10% total volume or 5lbs added weight per week.

SUBMAX METHOD + WEIGHTED PROGRESSIONS:
- Skill work is ALWAYS unweighted and submax (40-60% of max).
- Weighted strength work uses added resistance at submax intensity.
- Progressive overload via added weight: start with 5-10% of bodyweight, increase 2.5-5 lbs per week.
- Never grind a weighted rep.

SUBMAX RULES:
- Skill holds: 40-60% of max hold time.
- Weighted strength sets: 2-3 RIR.
- Weighted hypertrophy sets: 1-2 RIR.
- Never train a skill to failure.
- Include weight suggestion and submax cue in notes.

WEEKLY STRUCTURE:
- DAY A — INTENSITY PUSH
- DAY B — INTENSITY PULL
- DAY C — VOLUME PUSH
- DAY D — VOLUME PULL
- DAY E — DELOAD & SKILL

MESOCYCLE STRUCTURE:
MESO 1 (Weeks 1-4): FOUNDATION + LOADED TENDON CONDITIONING
- Wk1: Establish baseline weights.
- Wk2: +5 lbs and +10% volume.
- Wk3: +5 lbs and +10% volume.
- Wk4: DELOAD — reduce weight 40%.

MESO 2 (Weeks 5-8): STRENGTH BUILD + SKILL BREAKTHROUGH
- Wk5: Reset to meso1 peak weights + 5 lbs.
- Wk6: +5 lbs.
- Wk7: +5 lbs. Peak weighted intensity.
- Wk8: DELOAD — reduce weight 40%.

MESO 3 (Weeks 9-12): PEAK + SKILL MASTERY
- Wk9: Near-peak weights.
- Wk10: Peak week.
- Wk11: Taper — reduce weight 20%.
- Wk12: FULL DELOAD — 50% weight, 50% volume.

EXERCISE SELECTION RULES:
- 4-5 exercises per training day.
- Skill work ALWAYS first.
- Weighted variations should match available equipment.
- Progressive overload: add 2.5-5 lbs per week when all reps hit.
- Push/pull balance mandatory.
- Scapular/rotator cuff prehab every week.
- Tendon prehab: slow eccentrics.
- Notes must specify weight suggestion and submax cue.
- Injury history must be respected.

${LEG_TRAINING_MANDATE}

${HUNTER_STEIN_METHOD}

${OUTPUT_FORMAT}

${SCHEMA_INSTRUCTION}`;
}

// ------------------------------------------------------------
// Weight training
// ------------------------------------------------------------

function weightsPrompt(data) {
  const goalsStr =
    data?.weightGoals?.join(', ') || 'general fitness';

  return `You are a world-class strength and conditioning coach specializing in weight training, hypertrophy, and strength periodization. Build a COMPLETE 12-week program for this athlete with ALL 12 weekly microcycles fully detailed. The program is optimized for: ${goalsStr}.

${buildContext(data)}

=== PERIODIZATION SCIENCE ===

ADAPTATION HIERARCHY: Muscle tissue adapts fastest, then CNS, then tendons/connective tissue. Progressive overload must be gradual — never increase weight more than 5-10% per week.

PROGRESSIVE OVERLOAD PRINCIPLES:
- Increase weight by 2.5-5 lbs when all sets and reps are completed with good form.
- If the athlete cannot hit the rep range, stay at the same weight.
- Deload every 4th week.
- Most working sets at RPE 7-8.
- Top sets may reach RPE 9 but NEVER RPE 10.

WEEKLY STRUCTURE:
- DAY A — INTENSITY PUSH
- DAY B — INTENSITY PULL
- DAY C — VOLUME PUSH
- DAY D — VOLUME PULL
- DAY E — DELOAD & MOBILITY

Adjust rep ranges and exercise selection based on the primary goal (${goalsStr}), but ALWAYS maintain the intensity/volume/deload structure and Hunter Stein activation principles.

MESOCYCLE STRUCTURE:
MESO 1 (Weeks 1-4): FOUNDATION + HYPERTROPHY BASE
- Wk1: Moderate volume, establish baseline weights. RPE 6-7.
- Wk2: Increase weight 5%. RPE 7.
- Wk3: Increase weight 5% more. RPE 7-8.
- Wk4: DELOAD — reduce weight 40%.

MESO 2 (Weeks 5-8): STRENGTH + INTENSIFICATION
- Wk5: Reset to meso1 peak weights, add 5 lbs.
- Wk6: Increase weight 5%.
- Wk7: Peak intensity.
- Wk8: DELOAD — reduce weight 40%.

MESO 3 (Weeks 9-12): PEAK + SPECIALIZATION
- Wk9: Near-peak weights.
- Wk10: Peak week.
- Wk11: Taper — reduce volume 20%.
- Wk12: FULL DELOAD — 50% weight, 30% volume.

EXERCISE SELECTION RULES:
- ONLY use exercises the athlete can do with their listed EQUIPMENT.
- Compound lifts as primary movements.
- 4-6 exercises per training day.
- Push/pull balance mandatory.
- Progressive overload noted in exercise notes.
- Injury history must be respected.
- Tendon prehab included.
- Isolation work: 10-15 reps, 2-3 sets.
- Warm-up sets and mobility work where relevant.
- RPE target noted in exercise notes.

${LEG_TRAINING_MANDATE}

${HUNTER_STEIN_METHOD}

${HUNTER_STEIN_WEIGHTS_NOTE}

${OUTPUT_FORMAT}

${SCHEMA_INSTRUCTION}`;
}

// ------------------------------------------------------------
// Hybrid
// ------------------------------------------------------------

function hybridPrompt(data) {
  const calGoals =
    data?.fitnessGoals?.join(', ') ||
    data?.goalDescription ||
    'general fitness';

  const weightGoalsStr =
    data?.weightGoals?.join(', ') ||
    'general strength';

  return `You are a world-class strength and conditioning coach specializing in HYBRID training — combining calisthenics skill work with weight training for maximum results. Build a COMPLETE 12-week program with ALL 12 weekly microcycles fully detailed.

KEY PRINCIPLE: Calisthenics skill work comes FIRST in every session when the CNS is fresh. Weight training comes SECOND at the end of the session. The weight exercises are specifically chosen to ACCELERATE calisthenics goals.

CALISTHENICS GOALS: ${calGoals}
WEIGHT TRAINING GOALS: ${weightGoalsStr}

${buildContext(data)}

=== HYBRID PERIODIZATION SCIENCE ===

ADAPTATION HIERARCHY: Tendon adaptation is SLOWEST, then CNS, then muscle. Both calisthenics and weight training stress the CNS — manage total session volume carefully. Never exceed 60-75 minutes per session.

SESSION STRUCTURE:
1. WARM-UP (5 min)
2. CALISTHENICS SKILL WORK (15-20 min)
3. STRENGTH/POWER (15-20 min)
4. HYPERTROPHY (15-20 min)
5. COOL-DOWN (5 min)

WEIGHT EXERCISE SELECTION — ACCELERATE CALISTHENICS GOALS:
- Muscle-up goal → Lat pulldowns, explosive pull-ups, bicep curls, face pulls
- Handstand goal → Overhead press, lateral raises, core holds, wrist strengtheners
- Planche goal → Overhead press, lean forward push-ups, wrist work, core compression
- Front lever goal → Lat pulldowns, ab wheel rollouts, hanging leg raises, back extensions
- Back lever goal → Romanian deadlifts, face pulls, back extensions, skin the cat
- Human flag goal → Side planks, oblique work, single-arm hanging, lateral raises
- General strength → Squats, deadlifts, bench press, overhead press, rows
- Muscle growth → Hypertrophy accessories targeting the muscles used in calisthenics skills

SUBMAX METHOD:
- Skill holds: 40-60% of max hold time.
- Never train a skill to failure.
- Stop 2-3 reps early on strength sets.
- High-frequency skill practice is encouraged.

PROGRESSIVE OVERLOAD:
- Increase weight 2.5-5 lbs when all reps hit with good form.
- RPE 7-8 on most sets.
- RPE 9 maximum on top sets.
- Never RPE 10.

WEEKLY STRUCTURE:
- DAY A — INTENSITY PUSH
- DAY B — INTENSITY PULL
- DAY C — VOLUME PUSH
- DAY D — VOLUME PULL
- DAY E — DELOAD & SKILL

MESOCYCLE STRUCTURE:
MESO 1 (Weeks 1-4): FOUNDATION + DUAL ADAPTATION
- Wk1: Establish baselines.
- Wk2: +5 lbs on weights, +10% calisthenics volume.
- Wk3: +5 lbs more, +10% volume.
- Wk4: DELOAD — reduce both 40%.

MESO 2 (Weeks 5-8): INTENSIFICATION + SKILL BREAKTHROUGH
- Wk5: Reset to peaks + 5 lbs.
- Wk6: +5 lbs weights, +10% volume.
- Wk7: Peak intensity.
- Wk8: DELOAD — reduce both 40%.

MESO 3 (Weeks 9-12): PEAK + MASTERY
- Wk9: Near-peak weights and skill progressions.
- Wk10: Peak week.
- Wk11: Taper — reduce volume 20%.
- Wk12: FULL DELOAD — 50% everything.

RECOVERY RULES:
- Never 2 consecutive heavy training days.
- Deload every 4th week.
- Monitor CNS fatigue.
- Tendon care is mandatory.
- Scapular/rotator cuff prehab every week.
- Push/pull balance mandatory.

${LEG_TRAINING_MANDATE}

${HUNTER_STEIN_METHOD}

${HUNTER_STEIN_WEIGHTS_NOTE}

${OUTPUT_FORMAT}

${SCHEMA_INSTRUCTION}`;
}

// ------------------------------------------------------------
// Public program prompt builder
// ------------------------------------------------------------

export function buildProgramPrompt(trainingType, data) {
  switch (trainingType) {
    case 'calisthenics':
      return calisthenicsPrompt(data);

    case 'weighted_calisthenics':
      return weightedCalisthenicsPrompt(data);

    case 'weights':
      return weightsPrompt(data);

    case 'hybrid':
      return hybridPrompt(data);

    default:
      return calisthenicsPrompt(data);
  }
}

// ------------------------------------------------------------
// Structure + microcycle split generation
// ------------------------------------------------------------

const STRUCTURE_OUTPUT = `OUTPUT: Generate ONLY the program structure — program_name, duration_weeks, macrocycle (overview + phases), and mesocycles (3 mesocycles of 4 weeks each with name, focus, weeks, intensity, week_start, week_end). Do NOT generate microcycles.`;

const STRUCTURE_SCHEMA = `Respond as a JSON object with this structure:
{
  "program_name": string,
  "duration_weeks": number,
  "macrocycle": {
    "overview": string,
    "phases": [
      {
        "name": string,
        "weeks": string,
        "focus": string
      }
    ]
  },
  "mesocycles": [
    {
      "name": string,
      "focus": string,
      "weeks": number,
      "intensity": string,
      "week_start": number,
      "week_end": number
    }
  ]
}`;

// Existing split-generation API
export function buildStructurePrompt(trainingType, data) {
  return buildProgramPrompt(trainingType, data)
    .replace(OUTPUT_FORMAT, STRUCTURE_OUTPUT)
    .replace(SCHEMA_INSTRUCTION, STRUCTURE_SCHEMA);
}

export function buildMicrocyclePrompt(
  trainingType,
  data,
  mesocycleIndex,
  mesocycle
) {
  const baseRules = buildProgramPrompt(
    trainingType,
    data
  )
    .replace(OUTPUT_FORMAT, '')
    .replace(SCHEMA_INSTRUCTION, '');

  const weekStart =
    mesocycle?.week_start ||
    (mesocycleIndex * 4 + 1);

  const weekEnd =
    mesocycle?.week_end ||
    (mesocycleIndex * 4 + 4);

  return `${baseRules}

OUTPUT: Generate ONLY ${
    weekEnd - weekStart + 1
  } weekly microcycles for MESOCYCLE ${
    mesocycleIndex + 1
  }: "${mesocycle?.name || `Mesocycle ${mesocycleIndex + 1}`}" (focus: ${
    mesocycle?.focus || 'progressive development'
  }, intensity: ${
    mesocycle?.intensity || 'moderate'
  }). These cover weeks ${weekStart} to ${weekEnd}.

Each microcycle has week_number (${weekStart}-${weekEnd}), mesocycle_index (${mesocycleIndex}), week_type, and days array.

Each day has day_name, workout_type, and exercises array.

Each exercise has name, sets (number), reps (string), rest_seconds (number), notes (coaching cue string), and activation_cue (concise activation and form cue string).

Respond as a JSON object with this structure:
{
  "microcycles": [
    {
      "week_number": number,
      "mesocycle_index": number,
      "week_type": string,
      "days": [
        {
          "day_name": string,
          "workout_type": string,
          "exercises": [
            {
              "name": string,
              "sets": number,
              "reps": string,
              "rest_seconds": number,
              "notes": string,
              "activation_cue": string
            }
          ]
        }
      ]
    }
  ]
}`;
}

// ------------------------------------------------------------
// Backwards-compatible weekly prompt
// ------------------------------------------------------------
// Onboarding currently imports buildWeekPrompt. Keep this export
// so older onboarding code and newer split-generation code both work.

export function buildWeekPrompt(
  trainingType,
  data,
  weekNumber = 1
) {
  const safeWeek = Math.min(
    12,
    Math.max(1, Number(weekNumber) || 1)
  );

  const mesocycleIndex =
    Math.floor((safeWeek - 1) / 4);

  const mesocycle = {
    name: `Mesocycle ${mesocycleIndex + 1}`,
    focus:
      mesocycleIndex === 0
        ? 'Foundation and adaptation'
        : mesocycleIndex === 1
          ? 'Intensification and progression'
          : 'Peak and specialization',
    intensity:
      safeWeek % 4 === 0
        ? 'deload'
        : 'moderate to high',
    week_start: safeWeek,
    week_end: safeWeek,
  };

  return buildMicrocyclePrompt(
    trainingType,
    data,
    mesocycleIndex,
    mesocycle
  );
}

// ------------------------------------------------------------
// Kael system prompt
// ------------------------------------------------------------

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
    typeContext[trainingType] ||
    'elite-level fitness coach'
  }${
    firstName
      ? ` — your athlete's name is ${firstName}`
      : ''
  }. You have trained world-class street workout athletes, gymnasts, powerlifters, bodybuilders, and elite military operators.

You can answer questions about ANY form of training — calisthenics, weighted calisthenics, weight training, or hybrid combinations. ${
    typeDesc[trainingType] || ''
  } When the athlete asks about a training type outside your primary specialty, still give expert advice — you are knowledgeable across all modalities.

PERSONALITY: Direct, real, no BS. Like a coach who actually knows their stuff and respects the athlete enough to tell them the truth. Friendly but not fluffy. Get to the point.

RESPONSE STYLE: 2-4 sentences max unless a structured breakdown is truly needed. No long intros. No generic advice.${
    isElite
      ? `

SECRET TIPS RULE — CRITICAL: Whenever the user asks HOW to do something (a movement, skill, technique, exercise, or training method), you MUST include at least one "secret" or "insider" tip — something elite athletes actually use in practice that most coaches and internet guides never mention. These should be real, specific, and counterintuitive.

Examples:
- Specific tension cues that elite athletes use
- Breathing tricks, bracing patterns, or micro-timing cues
- Progressions that elite athletes use but almost nobody teaches online
- Recovery or CNS management tricks
- Hidden biomechanical details
- Training frequency and density secrets
- Psychological or visualization techniques

Label these clearly with something like "🔐 Elite tip:" or "⚡ Secret:" so they feel special.`
      : ''}

Only use their name occasionally when it feels natural — not every message.`;
}

// ------------------------------------------------------------
// Progress photo analysis prompt
// ------------------------------------------------------------

export function getProgressPhotoPrompt(
  trainingType,
  firstName,
  prevContext,
  equipment
) {
  const exerciseGuidance = {
    calisthenics:
      'For any muscle groups that appear underdeveloped or lagging, recommend CALISTHENICS exercises (not weights or machines) that target those specific muscles. For example: for weak shoulders → Pike push-ups, Wall handstand holds, Pike push-up negatives; for weak back → Australian rows, Dead hangs, Scapular pull-ups; for weak chest → Push-up variations, Ring push-ups. Never recommend gym equipment, dumbbells, barbells, or machines.',

    weighted_calisthenics:
      'For any muscle groups that appear underdeveloped or lagging, recommend WEIGHTED CALISTHENICS exercises that target those specific muscles. For example: for weak back → Weighted pull-ups, weighted Australian rows; for weak chest → Weighted dips, weighted push-ups; for weak shoulders → Weighted pike push-ups. You can also recommend bodyweight variations, but prioritize loaded progressions.',

    weights:
      `For any muscle groups that appear underdeveloped or lagging, recommend WEIGHT TRAINING exercises using the athlete's available equipment (${
        equipment ||
        'dumbbells, barbells, cables, machines'
      }). For example: for weak shoulders → Overhead press, lateral raises; for weak back → Lat pulldowns, barbell rows; for weak chest → Bench press, cable flyes. Only recommend exercises they can do with their equipment. Never recommend calisthenics or bodyweight exercises.`,

    hybrid:
      `For any muscle groups that appear underdeveloped or lagging, recommend a MIX of calisthenics AND weight training exercises that complement each other. Start with calisthenics options, then add weight training exercises that build the same muscles. Consider their available equipment: ${
        equipment || 'standard gym equipment'
      }. For example: for weak back → Pull-ups + barbell rows; for weak shoulders → Handstand holds + overhead press; for weak chest → Dips + bench press.`,
  };

  const coachTitle = {
    calisthenics: 'calisthenics',
    weighted_calisthenics: 'weighted calisthenics',
    weights: 'weight training',
    hybrid: 'hybrid training',
  };

  return `You are Kael, ${
    firstName || 'the athlete'
  }'s personal ${
    coachTitle[trainingType] || 'fitness'
  } coach. Review this physique photo and give ${
    firstName || 'the athlete'
  } direct, genuine, personalized feedback — like a real coach would. Not clinical, not generic.

${prevContext || ''}

Provide:
1. An estimated body fat percentage range (specific, like "14-17%")
2. A numeric midpoint for graphing (just the number, like 15.5)
3. Specific insights — address ${
    firstName || 'the athlete'
  } directly. What muscles are developing? Where is there visible progress? What areas visually lag behind? If there's a previous photo, compare and call out exactly what changed. Be real and conversational.
4. ${
    exerciseGuidance[trainingType] ||
    exerciseGuidance.calisthenics
  }`;
}
