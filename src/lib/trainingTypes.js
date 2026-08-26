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

// ── Helper functions ──

function buildAthleteProfile(data) {
  const { gender, level, age, weightLbs, heightFt, heightIn, unit } = data;

  const heightStr = unit === 'metric'
    ? `${heightFt || '?'}cm`
    : `${heightFt || '?'}'${heightIn || 0}"`;

  const weightStr = unit === 'metric'
    ? `${weightLbs || '?'}kg`
    : `${weightLbs || '?'}lbs`;

  return `ATHLETE: ${gender || 'unspecified'}${level ? `, ${level} level` : ''}, age ${age || '?'}, ${weightStr}, ${heightStr}`;
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

function buildContext(data) {
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
    parts.push(`GOALS: ${fitnessGoals.join(', ')}. ${goalDescription || ''}`);
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
    parts.push(`REQUIREMENTS (time available, injuries, notes): ${requirements}`);
  }

  parts.push(`GENDER RULES: ${buildGenderRules(data.gender)}`);

  return parts.join('\n');
}

// ── Program prompt builders ──

const OUTPUT_FORMAT = `OUTPUT: Generate ALL 12 microcycles. Each microcycle has week_number (1-12), mesocycle_index (0, 1, or 2), and days array. Each day has day_name, workout_type, and exercises array. Each exercise has name, sets (number), reps (string like "5" or "8-10" or "6s hold"), rest_seconds (number), notes (coaching cue string), and activation_cue (concise activation and form cue string — see Hunter Stein method).`;

const SCHEMA_INSTRUCTION = `Respond as a JSON object with this structure:
{
  "program_name": string,
  "duration_weeks": number,
  "macrocycle": { "overview": string, "phases": [{ "name": string, "weeks": string, "focus": string }] },
  "mesocycles": [{ "name": string, "focus": string, "weeks": number, "intensity": string, "week_start": number, "week_end": number }],
  "microcycles": [{ "week_number": number, "mesocycle_index": number, "week_type": string, "days": [{ "day_name": string, "workout_type": string, "exercises": [{ "name": string, "sets": number, "reps": string, "rest_seconds": number, "notes": string, "activation_cue": string }] }] }]
}`;

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

function calisthenicsPrompt(data) {
  return `You are a world-class calisthenics periodization scientist and coach. Build a COMPLETE 12-week program for this athlete with ALL 12 weekly microcycles fully detailed. This program uses Anton's Submax training method — the fastest evidence-based progression system for calisthenics skills.

${buildContext(data)}

=== PERIODIZATION SCIENCE (MANDATORY — FOLLOW EXACTLY) ===

ADAPTATION HIERARCHY: Tendon adaptation is SLOWEST (weeks 4-12+), then CNS adaptation (days-weeks), then muscle hypertrophy. Volume must increase gradually so tendons can keep up. Never jump more than 10-15% total volume per week. Injury prevention is paramount — when in doubt, do less. Respect any injuries or limitations listed in REQUIREMENTS.

── ANTON'S SUBMAX METHOD (THE CORE OF THIS PROGRAM) ──
Submax training means NEVER training to failure or even near-failure on skill and strength movements. Every set ends 2-3 reps BEFORE failure (3+ RIR on strength sets, 40-60% of max for skill holds). This allows:
1. Higher training frequency without CNS burnout
2. Perfect technique on every rep
3. Faster tendon adaptation (tendons get more total volume safely)
4. Faster skill acquisition (nervous system learns the pattern fresh, not fatigued)
5. Zero overuse injuries from accumulated fatigue damage

SUBMAX RULES TO ENFORCE IN EVERY
