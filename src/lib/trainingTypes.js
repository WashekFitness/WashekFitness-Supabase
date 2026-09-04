function buildContext(data = {}) {
  const {
    trainingType,
    level,
    currentSkills,
    goalDescription,
    timeframe,
    equipment,
    requirements,
    fitnessGoals,
    weightGoals,
  } = data;

  const parts = [buildAthleteProfile(data)];

  if (level && trainingType === 'weights') {
    parts.push(
      `WEIGHT TRAINING EXPERIENCE LEVEL: ${level}. This level refers specifically to resistance-training experience and must determine the starting exercise complexity, loading approach, exercise selection, and progression rate.`
    );
  }

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
