/**
 * Calculate personalized daily nutrition goals based on user profile.
 * Protein: 1.5g per lb (mid-range of 1-2g)
 * Calories: Estimated TDEE based on weight/height/age + goal adjustment
 * Carbs & Fat: Fill remaining calories
 * Adjusts based on training type and goals (calisthenics, weights, hybrid, etc.)
 */
export function calcNutritionGoals(user) {
  const weight = user?.weight_lbs || 150;
  const heightIn = user?.height_inches || 68;
  const heightCm = user?.height_cm || (heightIn * 2.54);
  const age = user?.age || 25;
  const goals = user?.fitness_goals || [];
  const weightGoals = user?.weight_goals || [];
  const trainingType = user?.training_type || 'calisthenics';
  const gender = user?.gender || 'male';

  // Mifflin-St Jeor BMR
  const bmr = gender === 'female'
    ? 10 * (weight * 0.453592) + 6.25 * heightCm - 5 * age - 161
    : 10 * (weight * 0.453592) + 6.25 * heightCm - 5 * age + 5;

  // Activity multiplier — varies by training type
  // Weight training and hybrid tend to have slightly higher metabolic demand
  let activityMultiplier = 1.55; // moderate (default for calisthenics)
  if (trainingType === 'weights' || trainingType === 'hybrid') {
    activityMultiplier = 1.6; // slightly higher due to more muscle mass and metabolic stress
  } else if (trainingType === 'weighted_calisthenics') {
    activityMultiplier = 1.575;
  }

  let tdee = Math.round(bmr * activityMultiplier);

  // Adjust by calisthenics goals
  if (goals.includes('lose_weight')) tdee = Math.round(tdee * 0.85);
  else if (goals.includes('gain_muscle') || goals.includes('body_recomp')) tdee = Math.round(tdee * 1.1);
  else if (goals.includes('get_stronger')) tdee = Math.round(tdee * 1.05);

  // Adjust by weight training goals
  if (weightGoals.includes('lose_weight')) tdee = Math.round(tdee * 0.85);
  else if (weightGoals.includes('muscle_growth')) tdee = Math.round(tdee * 1.12);
  else if (weightGoals.includes('gain_strength')) tdee = Math.round(tdee * 1.08);
  else if (weightGoals.includes('body_recomp')) tdee = Math.round(tdee * 1.0); // maintenance for recomp
  else if (weightGoals.includes('aesthetics')) tdee = Math.round(tdee * 1.0); // maintenance, recomp via training
  else if (weightGoals.includes('improve_endurance')) tdee = Math.round(tdee * 0.95);

  // If both calisthenics lose_weight AND weight muscle_growth (hybrid conflicting goals), lean toward slight surplus for muscle
  if (goals.includes('lose_weight') && weightGoals.includes('muscle_growth')) {
    tdee = Math.round(tdee * 1.0); // balance — recomp approach
  }

  // Protein: 1.5g per lb for most, 1.6-1.8g for muscle growth/strength
  let proteinPerLb = 1.5;
  if (weightGoals.includes('muscle_growth') || weightGoals.includes('gain_strength') || weightGoals.includes('body_recomp')) {
    proteinPerLb = 1.7;
  } else if (goals.includes('gain_muscle') || goals.includes('body_recomp')) {
    proteinPerLb = 1.6;
  } else if (goals.includes('lose_weight') || weightGoals.includes('lose_weight')) {
    proteinPerLb = 1.6; // higher protein to preserve muscle in deficit
  }

  const protein = Math.round(weight * proteinPerLb);
  const proteinCals = protein * 4;

  // Fat: 25% of total calories (slightly lower for fat loss goals)
  let fatPct = 0.25;
  if (goals.includes('lose_weight') || weightGoals.includes('lose_weight')) {
    fatPct = 0.22;
  }
  const fat = Math.round((tdee * fatPct) / 9);
  const fatCals = fat * 9;

  // Carbs: remainder
  const carbs = Math.round((tdee - proteinCals - fatCals) / 4);

  return {
    calories: tdee,
    protein: Math.max(protein, 50),
    carbs: Math.max(carbs, 50),
    fat: Math.max(fat, 30),
  };
}

/**
 * Calculate personalized daily hydration goal in milliliters.
 * Based on body weight, gender, age, and training activity.
 * Keeps recommendations moderate — hydrated, not overly hydrated.
 *
 * Reference: EFSA & ACSM guidelines
 *   Men: ~35 ml/kg, Women: ~31 ml/kg
 *   Age 55+: slightly lower (30 ml/kg) due to reduced lean mass
 *   Training day: +500 ml (athletes lose extra via sweat)
 *   Hot climate: +300 ml
 *
 * Clamped between 2000–4000 ml to stay in a safe, moderate range.
 */
export function calcWaterGoal(user) {
  const weightLbs = user?.weight_lbs || 150;
  const weightKg = weightLbs * 0.453592;
  const age = user?.age || 25;
  const gender = user?.gender || 'male';
  const goals = user?.fitness_goals || [];
  const weightGoals = user?.weight_goals || [];
  const country = user?.country || 'US';

  // Base ml per kg
  let mlPerKg = gender === 'female' ? 31 : 35;
  if (age >= 55) mlPerKg = 30;

  let base = weightKg * mlPerKg;

  // Training adjustment — most users in this app train; add if actively pursuing fitness goals
  const isActive = goals.length > 0 || weightGoals.length > 0 || user?.training_type;
  if (isActive) base += 500;

  // Hot climate adjustment (tropical/hot countries)
  const hotCountries = ['IN', 'ID', 'TH', 'VN', 'PH', 'BR', 'MX', 'SA', 'AE', 'EG', 'NG', 'BD', 'PK', 'MY', 'SG', 'CO', 'PE'];
  if (hotCountries.includes(country)) base += 300;

  // Extra for endurance / high-volume goals
  if (goals.includes('improve_endurance') || weightGoals.includes('improve_endurance')) base += 200;

  // Fat loss: slightly less (lower caloric intake → less metabolic water), but keep adequate
  if (goals.includes('lose_weight') || weightGoals.includes('lose_weight')) base = Math.max(base - 100, 2000);

  // Clamp to safe, moderate range
  const goalMl = Math.round(Math.min(Math.max(base, 2000), 4000) / 50) * 50;

  return goalMl;
}