// Training type configurations
export const TRAINING_TYPES = [
  {
    value: 'calisthenics',
    label: 'Calisthenics',
    iconName: 'PersonStanding',
    desc: 'Bodyweight training focused on skills, strength, muscle and endurance.',
    hasSkills: true,
    hasLevel: true,
    hasTimeframe: true,
    hasWeightGoals: false,
  },
  {
    value: 'weighted_calisthenics',
    label: 'Weighted Calisthenics',
    iconName: 'Dumbbell',
    desc: 'Calisthenics combined with progressive external loading.',
    hasSkills: true,
    hasLevel: true,
    hasTimeframe: true,
    hasWeightGoals: false,
  },
  {
    value: 'weights',
    label: 'Weight Training',
    iconName: 'Trophy',
    desc: 'Traditional strength, hypertrophy and weight training.',
    hasSkills: false,
    hasLevel: false,
    hasTimeframe: false,
    hasWeightGoals: true,
  },
  {
    value: 'hybrid',
    label: 'Hybrid Training',
    iconName: 'Layers',
    desc: 'Calisthenics skill work combined with weight training.',
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

function athleteProfile(data = {}) {
  const {
    gender,
    level,
    age,
    weightLbs,
    heightFt,
    heightIn,
    unit,
  } = data;

  const height = unit === 'metric'
    ? `${heightFt || '?'}cm`
    : `${heightFt || '?'}'${heightIn || 0}"`;

  const weight = unit === 'metric'
    ? `${weightLbs || '?'}kg`
    : `${weightLbs || '?'}lbs`;

  return `ATHLETE: ${gender || 'unspecified'}${level ? `, ${level} level` : ''}, age ${age || '?'}, ${weight}, ${height}`;
}

function genderRules(gender) {
  if (gender === 'male') {
    return 'Prioritize balanced push/pull development, scapular stability, strict form and adequate CNS recovery.';
  }

  if (gender === 'female') {
    return 'Use appropriate moderate-volume training, posterior-chain and core development, mobility and controlled eccentrics while respecting individual recovery and goals.';
  }

  return 'Use a balanced approach with appropriate volume, progressive overload and excellent technique.';
}

function buildContext(data = {}) {
  const parts = [athleteProfile(data)];

  if (data.currentSkills) {
    parts.push(`CURRENT SKILLS: ${data.currentSkills}`);
  }

  if (data.fitnessGoals?.length) {
    parts.push(`GOALS: ${data.fitnessGoals.join(', ')}${data.goalDescription ? `. ${data.goalDescription}` : ''}`);
  } else if (data.goalDescription) {
    parts.push(`GOALS: ${data.goalDescription}`);
  }

  if (data.weightGoals?.length) {
    parts.push(`WEIGHT TRAINING GOALS: ${data.weightGoals.join(', ')}`);
  }

  if (data.timeframe) {
    parts.push(`TIMEFRAME: ${data.timeframe}`);
  }

  if (data.equipment) {
    parts.push(`EQUIPMENT: ${data.equipment}`);
  }

  if (data.requirements) {
    parts.push(`REQUIREMENTS: ${data.requirements}`);
  }

  parts.push(`GENDER RULES: ${genderRules(data.gender)}`);
  return parts.join('\n');
}

function summarizeAdaptations(history) {
  if (!Array.isArray(history) || history.length === 0) {
    return 'No Progress+ workout edits have been recorded yet.';
  }

  const counts = new Map();
  const recent = history.slice(-20);

  for (const record of recent) {
    const changes = Array.isArray(record?.changes) ? record.changes : [];

    for (const change of changes) {
      let key = null;

      switch (change?.type) {
        case 'exercise_replaced':
          key = `Exercise replacement: ${change.from || '?'} -> ${change.to || '?'}`;
          break;
        case 'exercise_added':
          key = `Exercise added: ${change.exercise || '?'}`;
          break;
        case 'exercise_removed':
          key = `Exercise removed: ${change.exercise || '?'}`;
          break;
        case 'sets_changed':
          key = `Sets changed: ${change.exercise || '?'} ${change.from ?? '?'} -> ${change.to ?? '?'}`;
          break;
        case 'reps_changed':
          key = `Reps/time changed: ${change.exercise || '?'} ${change.from ?? '?'} -> ${change.to ?? '?'}`;
          break;
        case 'rest_changed':
          key = `Rest changed: ${change.exercise || '?'} ${change.from ?? '?'}s -> ${change.to ?? '?'}s`;
          break;
        default:
          break;
      }

      if (key) {
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
  }

  const lines = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([key, count]) => `- ${key} (${count}x)`);

  return lines.length
    ? lines.join('\n')
    : 'No usable Progress+ workout edits have been recorded yet.';
}

function adaptiveRules(data = {}) {
  const history = data.adaptationHistory || data.adaptation_history || data.program?.adaptation_history || [];

  return `
PROGRESS+ ADAPTIVE PROGRAMMING
The athlete can edit generated workouts. Those edits are behavioral feedback about what works for this athlete.

Use repeated edits as stronger evidence than isolated edits.
Do not blindly copy every edit.
Do not make every exercise harder simply because the week number increased.
Preserve the athlete's goals, equipment, recovery and movement balance.
If the athlete repeatedly replaces an exercise, prefer an appropriate movement with the same training purpose and consider the preferred pattern.
If the athlete repeatedly increases or decreases sets, reps or rest, use that pattern as evidence for future programming.
If explicit current requirements conflict with historical edits, current requirements win.

RECORDED EDIT PATTERNS:
${summarizeAdaptations(history)}
`;
}

const TYPE_RULES = {
  calisthenics: `
CALISTHENICS RULES:
- Progress skills through appropriate variations, leverage, ROM, reps, sets and tempo.
- Skill work comes before fatiguing strength work when technique matters.
- Hard skill/isometric work generally uses short technically clean holds, not long failure holds.
- Strength work generally uses 3-8 reps and hypertrophy work 8-12 reps.
- Never train skills to failure.
- Include legs unless explicitly excluded.
`,
  weighted_calisthenics: `
WEIGHTED CALISTHENICS RULES:
- Use external load only when earned by performance and technique.
- Use small practical load increases rather than automatic weekly increases.
- Strength work generally uses 3-8 reps and hypertrophy work 8-12 reps.
- Keep skill work technically clean and submaximal.
- Include legs unless explicitly excluded.
`,
  weights: `
WEIGHT TRAINING RULES:
- ONLY use equipment explicitly available to the athlete.
- Use double progression or another appropriate overload method.
- Strength work generally uses 3-8 reps and hypertrophy work 8-12 reps.
- Keep most working sets around 1-3 RIR and never require failure as the default.
- Include legs unless explicitly excluded.
`,
  hybrid: `
HYBRID RULES:
- Put important calisthenics skill work before fatiguing strength work.
- Use weights to directly support the athlete's goals.
- Strength work generally uses 3-8 reps and hypertrophy work 8-12 reps.
- Avoid excessive total session volume.
- Include legs unless explicitly excluded.
`,
};

function buildWeekPrompt(
  trainingType,
  data,
  weekNumber,
  previousWeekData,
  performanceData = []
) {
  const week = Math.max(1, Number(weekNumber) || 1);
  const type = trainingType || 'calisthenics';
  const mesocycleIndex = Math.min(2, Math.floor((week - 1) / 4));
  const weekType = week % 4 === 0 ? 'DELOAD / RECOVERY' : week === 1 ? 'FOUNDATION' : 'PROGRESSION';

  const previous = previousWeekData
    ? JSON.stringify(previousWeekData, null, 2)
    : 'No previous week exists. This is the athlete\'s first training week.';

  const performance = Array.isArray(performanceData) && performanceData.length
    ? JSON.stringify(performanceData.map((log) => ({
        date: log?.date || null,
        day_name: log?.day_name || null,
        workout_type: log?.workout_type || null,
        exercises_completed: log?.exercises_completed || [],
        post_workout_checkin: log?.post_workout_checkin || '',
        ai_adjustment_notes: log?.ai_adjustment_notes || '',
        duration_seconds: log?.duration_seconds || null,
      })), null, 2)
    : 'No completed workout data was recorded.';

  return `You are Kael, an elite strength and conditioning coach and personalized programming specialist.

Generate ONLY WEEK ${week} of an ongoing program. This is not a generic workout generator.

${buildContext(data || {})}

TRAINING TYPE: ${type}
TARGET WEEK: ${week}
MESOCYCLE: ${mesocycleIndex + 1}
WEEK TYPE: ${weekType}

${TYPE_RULES[type] || TYPE_RULES.calisthenics}
${adaptiveRules(data || {})}

PREVIOUS WEEK'S PROGRAM:
${previous}

ACTUAL PERFORMANCE DATA:
${performance}

PROGRESSION ENGINE:
- Study the previous program and actual performance before changing anything.
- If the athlete completed work comfortably with good technique, choose ONE sensible progression: slightly more reps, slightly more sets, a harder variation, less assistance, more ROM, a small load increase, or improved execution.
- Do not simultaneously increase load, sets, reps and exercise difficulty.
- If work was barely completed, keep it similar or progress minimally.
- If work was not completed, reduce or maintain difficulty rather than punishing the athlete with more work.
- If an exercise was repeatedly edited, treat that as meaningful preference feedback.
- If pain is reported, modify/remove the aggravating movement and do not tell the athlete to push through pain. Do not diagnose injuries.
- If fatigue is excessive, reduce unnecessary training stress.
- Do not automatically increase every exercise every week.
- Actual demonstrated performance matters more than the stated level.

EQUIPMENT LOCK:
Only use equipment explicitly listed by the athlete. Never silently assume barbells, dumbbells, cables, machines, bands, rings, parallettes, dip bars, pull-up bars, benches or racks unless the athlete has stated they have them or full gym access.

PROGRAMMING REQUIREMENTS:
- Normally use approximately 4-6 useful exercises per normal training session.
- Dedicated skill/recovery sessions may use fewer.
- Cover the athlete's primary goal, relevant movement patterns, major musculature, legs, core where appropriate, and push/pull balance where appropriate.
- Legs are mandatory unless explicitly excluded.
- Strength: generally 3-8 reps.
- Hypertrophy: generally 8-12 reps.
- Endurance: generally 10-15 reps.
- Hard skill isometrics: generally short technically clean holds.
- Demanding strength/skill work normally gets about 2-4 minutes rest.
- Every exercise needs a specific coaching note and movement-specific activation cue.
- Most strength work should remain approximately 1-3 RIR.
- Scheduled deload weeks must substantially reduce volume while maintaining movement quality.

Return ONLY valid JSON with EXACTLY this structure:
{
  "microcycle": {
    "week_number": ${week},
    "mesocycle_index": ${mesocycleIndex},
    "week_type": "${weekType}",
    "days": [
      {
        "day_name": "string",
        "workout_type": "string",
        "exercises": [
          {
            "name": "string",
            "sets": 3,
            "reps": "8-10",
            "rest_seconds": 120,
            "notes": "specific progression, RIR, tempo and coaching instruction",
            "activation_cue": "specific movement execution and muscle activation cue"
          }
        ]
      }
    ]
  }
}

Do not return multiple weeks, program metadata, markdown or a code block.`;
}

export { buildWeekPrompt };

export function buildProgramPrompt(trainingType, data) {
  return buildWeekPrompt(trainingType, data, 1, null, []);
}

export function buildStructurePrompt(trainingType, data) {
  return buildWeekPrompt(trainingType, data, 1, null, []) + '\nReturn only the program structure rather than microcycles.';
}

export function buildMicrocyclePrompt(trainingType, data, mesocycleIndex, mesocycle) {
  const weekStart = mesocycle?.week_start || (Number(mesocycleIndex) * 4 + 1);
  return buildWeekPrompt(trainingType, data, weekStart, null, []);
}

export function getKaelSystemPrompt(trainingType, firstName, isElite = false) {
  const names = {
    calisthenics: 'elite-level calisthenics coach',
    weighted_calisthenics: 'elite-level weighted calisthenics coach',
    weights: 'elite-level weight training and strength coach',
    hybrid: 'elite-level hybrid training coach',
  };

  return `You are Kael, an ${names[trainingType] || 'elite-level fitness coach'}${firstName ? ` — the athlete's name is ${firstName}` : ''}.

You are an expert across calisthenics, weighted calisthenics, weight training, hybrid training, strength, hypertrophy, endurance, technique, progressive overload, recovery, periodization and skill acquisition.

PERSONALITY: Direct, knowledgeable, practical and honest. No fluff and no generic filler.

${isElite ? 'When the athlete asks how to perform something, include a specific elite/insider technique tip when appropriate.' : ''}

Give accurate training guidance. Do not diagnose injuries. If an athlete reports significant or persistent pain, recommend professional assessment.`;
}

export function getProgressPhotoPrompt(trainingType, firstName, prevContext, equipment) {
  const guidance = {
    calisthenics: 'Recommend calisthenics exercises appropriate to the visible areas that may need development.',
    weighted_calisthenics: 'Recommend weighted calisthenics and bodyweight progressions appropriate to the visible areas that may need development.',
    weights: `Recommend weight-training exercises using only available equipment: ${equipment || 'the athlete\'s stated equipment'}.`,
    hybrid: `Recommend complementary calisthenics and weight-training exercises using available equipment: ${equipment || 'the athlete\'s stated equipment'}.`,
  };

  return `You are Kael, ${firstName || 'the athlete'}'s personal fitness coach. Review the physique photo and provide direct, personalized, non-clinical feedback.

${prevContext || 'No previous photo context is available.'}

Provide:
1. An estimated body-fat percentage range when visually appropriate, clearly labeled as an estimate.
2. A numeric midpoint only when useful for graphing.
3. Specific visible observations about muscle development, symmetry, progress and areas that appear to lag. Compare with previous photos only when a real comparison is available.
4. ${guidance[trainingType] || guidance.calisthenics}

Do not diagnose medical conditions or invent changes that cannot reasonably be observed.`;
}
