export function buildMicrocyclePrompt(
  trainingType,
  data,
  mesocycleIndex,
  mesocycle,
  weekNumber = null
) {
  const baseRules = buildProgramPrompt(trainingType, data)
    .replace(OUTPUT_FORMAT, '')
    .replace(SCHEMA_INSTRUCTION, '');

  const weekStart =
    mesocycle.week_start || (mesocycleIndex * 4 + 1);

  const weekEnd =
    mesocycle.week_end || (mesocycleIndex * 4 + 4);

  // When generating one week at a time, explicitly override the
  // larger 12-week instructions that exist inside the training prompt.
  if (weekNumber !== null) {
    return `${baseRules}

=== CRITICAL OUTPUT LIMIT ===

You are generating ONLY ONE WEEK of the athlete's program.

IGNORE any earlier instruction that says to generate a complete 12-week program.
DO NOT generate multiple weeks.
DO NOT generate weeks other than WEEK ${weekNumber}.

Generate ONLY WEEK ${weekNumber}.

This week belongs to MESOCYCLE ${mesocycleIndex + 1}: "${mesocycle.name}".

Mesocycle focus:
${mesocycle.focus || 'Progressive training'}

Mesocycle intensity:
${mesocycle.intensity || 'moderate'}

Week number:
${weekNumber}

The athlete needs a complete, detailed training week.

Each week must contain:
- week_number: ${weekNumber}
- mesocycle_index: ${mesocycleIndex}
- week_type
- days
- each day must have day_name
- each day must have workout_type
- each day must have exercises
- each exercise must have name
- sets must be a number
- reps must be a string
- rest_seconds must be a number
- notes must contain a useful coaching cue
- activation_cue must contain a specific Hunter Stein activation/form cue

Follow ALL athlete requirements, equipment limitations, training type rules,
periodization rules, injury limitations, leg-training requirements,
submax rules, progressive-overload rules, and Hunter Stein activation rules
from the instructions above.

Do not create exercises requiring equipment the athlete does not have.

Do not explain your answer.
Do not use markdown.
Return ONLY valid JSON.

Return exactly this structure:

{
  "microcycles": [
    {
      "week_number": ${weekNumber},
      "mesocycle_index": ${mesocycleIndex},
      "week_type": "string",
      "days": [
        {
          "day_name": "string",
          "workout_type": "string",
          "exercises": [
            {
              "name": "string",
              "sets": 3,
              "reps": "8-10",
              "rest_seconds": 90,
              "notes": "string",
              "activation_cue": "string"
            }
          ]
        }
      ]
    }
  ]
}`;
  }

  // Fallback: preserve the existing four-week mesocycle behavior.
  return `${baseRules}

OUTPUT: Generate ONLY ${weekEnd - weekStart + 1} weekly microcycles for MESOCYCLE ${mesocycleIndex + 1}: "${mesocycle.name}" (focus: ${mesocycle.focus}, intensity: ${mesocycle.intensity || 'moderate'}). These cover weeks ${weekStart} to ${weekEnd}.

Each microcycle has:
- week_number
- mesocycle_index
- week_type
- days

Each day has:
- day_name
- workout_type
- exercises

Each exercise has:
- name
- sets (number)
- reps (string)
- rest_seconds (number)
- notes (coaching cue string)
- activation_cue (concise activation and form cue string)

Respond as a JSON object with this structure:

{
  "microcycles": [
    {
      "week_number": number,
      "mesocycle_index": number,
      "week_type": "string",
      "days": [
        {
          "day_name": "string",
          "workout_type": "string",
          "exercises": [
            {
              "name": "string",
              "sets": number,
              "reps": "string",
              "rest_seconds": number,
              "notes": "string",
              "activation_cue": "string"
            }
          ]
        }
      ]
    }
  ]
}`;
}
