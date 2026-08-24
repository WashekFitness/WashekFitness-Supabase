// ── Calisthenics exercise list for FormLab ──────────────────
// category: 'hold' = static isometric skill, 'dynamic' = rep-based movement

export const FORM_EXERCISES = [
  // Push
  { name: 'Push-up', category: 'dynamic' },
  { name: 'Pseudo Planche Push-up', category: 'dynamic' },
  { name: 'Archer Push-up', category: 'dynamic' },
  { name: 'Diamond Push-up', category: 'dynamic' },
  { name: 'Decline Push-up', category: 'dynamic' },
  { name: 'Ring Push-up', category: 'dynamic' },
  { name: 'Dip', category: 'dynamic' },
  { name: 'Ring Dip', category: 'dynamic' },
  { name: 'Pike Push-up', category: 'dynamic' },
  { name: 'Handstand Push-up', category: 'dynamic' },
  // Pull
  { name: 'Pull-up', category: 'dynamic' },
  { name: 'Chin-up', category: 'dynamic' },
  { name: 'Australian Row', category: 'dynamic' },
  { name: 'Scapular Pull-up', category: 'dynamic' },
  { name: 'Archer Pull-up', category: 'dynamic' },
  { name: 'Typewriter Pull-up', category: 'dynamic' },
  { name: 'Muscle-up', category: 'dynamic' },
  { name: 'Bar Muscle-up', category: 'dynamic' },
  { name: 'Ring Muscle-up', category: 'dynamic' },
  // Legs
  { name: 'Bodyweight Squat', category: 'dynamic' },
  { name: 'Pistol Squat', category: 'dynamic' },
  { name: 'Shrimp Squat', category: 'dynamic' },
  { name: 'Cossack Squat', category: 'dynamic' },
  { name: 'Jump Squat', category: 'dynamic' },
  { name: 'Nordic Curl', category: 'dynamic' },
  // Core
  { name: 'Hanging Leg Raise', category: 'dynamic' },
  { name: 'Toes to Bar', category: 'dynamic' },
  { name: 'Hanging Windshield Wiper', category: 'dynamic' },
  { name: 'Dragon Flag', category: 'dynamic' },
  { name: 'Hollow Body Hold', category: 'hold' },
  { name: 'L-Sit', category: 'hold' },
  { name: 'V-Sit', category: 'hold' },
  { name: 'Tuck Planche', category: 'hold' },
  { name: 'Adv Tuck Planche', category: 'hold' },
  { name: 'Straddle Planche', category: 'hold' },
  { name: 'Full Planche', category: 'hold' },
  { name: 'Front Lever', category: 'hold' },
  { name: 'Back Lever', category: 'hold' },
  { name: 'Tuck Front Lever', category: 'hold' },
  { name: 'Adv Tuck Front Lever', category: 'hold' },
  { name: 'Straddle Front Lever', category: 'hold' },
  // Handstand & static holds
  { name: 'Handstand', category: 'hold' },
  { name: 'Wall Handstand Hold', category: 'hold' },
  { name: 'Handstand Press (Pike to HS)', category: 'dynamic' },
  { name: 'One-Arm Handstand', category: 'hold' },
  { name: 'Human Flag', category: 'hold' },
  { name: 'Elbow Lever', category: 'hold' },
  { name: 'Dead Hang', category: 'hold' },
  // Other
  { name: 'Other / Custom', category: 'dynamic' },
];

// ── Check if a training type includes calisthenics ──────────
export function hasCalisthenics(trainingType) {
  // Default to calisthenics (the entity default) when the field is missing —
  // covers older programs created before training_type existed.
  if (!trainingType) return true;
  return trainingType === 'calisthenics' || trainingType === 'weighted_calisthenics' || trainingType === 'hybrid';
}

// ── Build the expert AI prompt for form analysis ───────────
export function buildFormAnalysisPrompt(exercise, category, user, trimStart, trimEnd) {
  const firstName = user?.first_name || user?.full_name?.split(' ')[0] || 'Athlete';
  const level = user?.fitness_level || 'intermediate';
  const trainingType = user?.training_type || 'calisthenics';
  const injuries = user?.injuries || '';

  const typeLabel = {
    calisthenics: 'calisthenics',
    weighted_calisthenics: 'weighted calisthenics',
    weights: 'weight training',
    hybrid: 'hybrid (calisthenics + weights)',
  }[trainingType] || 'calisthenics';

  const trimInfo = (trimStart != null && trimEnd != null)
    ? `The user has selected the analysis window from ${trimStart.toFixed(1)}s to ${trimEnd.toFixed(1)}s of the video. Focus your analysis on this section, but note the full video duration for context.`
    : 'Analyze the entire video. Identify the active portion (where the hold or reps are actually performed) and report the start and end timestamps.';

  return `You are an elite calisthenics form-analysis expert and coach — the best in the world. You are analyzing ${firstName}, a ${level} ${typeLabel} athlete.

EXERCISE: ${exercise}
TYPE: ${category === 'hold' ? 'Static isometric hold' : 'Dynamic rep-based movement'}

${trimInfo}

${injuries ? `KNOWN INJURIES/LIMITATIONS: ${injuries}` : ''}

Your job is to analyze this video with EXTREME precision and expertise. You must catch every form detail that matters for this specific exercise. Think like a world-class gymnastics + calisthenics coach watching frame by frame.

ANALYSIS REQUIREMENTS:

1. REP COUNT / HOLD TIME:
   - For dynamic exercises: count every full rep. A rep counts only if the full range of motion is completed.
   - For holds: measure the hold time in seconds (from when they achieve the position to when they break it).
   - Report the active range (start/end in seconds) where the actual exercise is performed.

2. SCORE (1-100): Give an overall form quality score. Be strict — a 100 means textbook perfect form. Most athletes score 40-70. Only genuinely excellent form gets 80+. Be honest, not generous.

3. DETAILED FORM ANALYSIS — analyze EVERYTHING that matters for THIS exercise:
   - Joint positions (shoulders, elbows, wrists, hips, knees, ankles, spine)
   - Body alignment and straightness (any arching, piking, or bending where there shouldn't be)
   - Scapular position: protraction vs retraction, elevation vs depression — state the correct position for this exercise and whether they achieve it
   - Core engagement and hollow body (where relevant)
   - Range of motion (full or partial)
   - Tempo and control (no momentum/kipping unless it's intentionally allowed)
   - Symmetry (left vs right)
   - Specific skill details:
     * Handstand: is it a banana handstand (arched back)? Are shoulders fully extended over the hands? Is the head through? Are fingers spread for balance?
     * Planche: are the arms straight or bent? Is the lean sufficient? Is the body parallel to ground? Is there any sagging?
     * Front/Back Lever: are arms straight or bent? Is the body parallel to ground? Is there any piking or arching?
     * Muscle-up: is the transition clean or is there excessive kipping? Are the rings turned out at the top? False grip?
     * Pull-up: full dead hang at bottom? Chin over bar? Are shoulders packed or elevated? Any swinging?
     * Dip: full depth? Are shoulders forward or upright? Any flaring?
     * Push-up: full lockout? Elbow angle at bottom (90°)? Body straight or sagging/arching? Scapular protraction at top?
   - Any other detail a top coach would notice.

4. ISSUES FOUND: List every form issue you identify. For each issue:
   - area: the body part or movement aspect (e.g., "Shoulder extension", "Core", "Elbow lockout")
   - problem: exactly what they're doing wrong, described in plain language
   - severity: minor | moderate | major | critical
   - fix: the specific cue or correction they should apply (e.g., "Push your shoulders up toward your ears and open them fully over your hands")
   - corrective_exercises: 1-3 specific calisthenics exercises or drills that fix THIS problem (e.g., "Wall pike push-ups for overhead shoulder mobility", "Hollow body rocks for core")

5. PRIORITY FOCUS: List the top 2-3 things they should focus on fixing first, in order of importance. Explain briefly why.

6. OVERALL ASSESSMENT: A 3-5 sentence coach-style summary. Be direct, no fluff. What's good, what needs work, and the #1 thing to focus on.

Respond in JSON with this exact structure:
{
  "camera_angle_ok": boolean,
  "camera_angle_note": "string — if angle is bad, explain why and suggest the correct angle. If ok, confirm.",
  "score": number (1-100),
  "rep_count": number or null (null for holds),
  "hold_time_seconds": number or null (null for dynamic),
  "active_range_start": number or null,
  "active_range_end": number or null,
  "overall_assessment": "string — 3-5 sentence summary",
  "issues": [
    {
      "area": "string",
      "problem": "string",
      "severity": "minor|moderate|major|critical",
      "fix": "string — specific correction cue",
      "corrective_exercises": ["string", ...]
    }
  ],
  "priority_focus": ["string", ...] — top 2-3 priorities
}`;
}