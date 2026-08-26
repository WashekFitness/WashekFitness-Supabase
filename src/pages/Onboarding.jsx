import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { queryClientInstance } from '@/lib/query-client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronLeft,
  Zap,
  Target,
  Flame,
  Trophy,
  Sparkles,
  Dumbbell,
  Scale,
  Heart,
  Wind,
  PersonStanding,
  Globe,
} from 'lucide-react';
import { COUNTRIES, LANGUAGES, getCountryDefaults } from '@/lib/countries';
import { useAppSettings } from '@/lib/AppSettingsContext';
import { supabase } from '@/lib/supabase';
import { supabaseApi } from '@/lib/supabaseApi';
import { cn } from '@/lib/utils';
import TrainingTypeSelect from '@/components/onboarding/TrainingTypeSelect';
import { CALISTHENICS_GOALS, WEIGHT_GOALS } from '@/lib/trainingTypes';
import { toast } from 'sonner';

const GENERATION_LOCK_KEY = 'washek_fitness_program_generation_lock';
const GENERATION_LOCK_MS = 20 * 60 * 1000;

const levels = [
  {
    value: 'beginner',
    label: 'Beginner',
    desc: '0–6 months training',
    icon: Flame,
    placeholder:
      'e.g. 10 push-ups, bodyweight squats, a few jumping pull-ups...',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    desc: '6–24 months',
    icon: Zap,
    placeholder:
      'e.g. 8 pull-ups, 15 dips, can hold an L-sit for 5s...',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    desc: '2–5 years',
    icon: Target,
    placeholder:
      'e.g. muscle-ups, 30s handstand, working on front lever...',
  },
  {
    value: 'elite',
    label: 'Elite',
    desc: '5+ years',
    icon: Trophy,
    placeholder:
      'e.g. straddle planche, full front lever 5s, learning flag...',
  },
];

const GOAL_ICONS = {
  Dumbbell,
  Scale,
  Trophy,
  Wind,
  Target,
  Heart,
  PersonStanding,
  Sparkles,
};

function SearchSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = options
    .filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 200);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setSearch('');
        }}
        className="w-full h-12 px-4 rounded-2xl border-2 border-border bg-card text-sm text-left flex items-center justify-between hover:border-muted-foreground/30 transition-all"
      >
        <span
          className={
            value ? 'text-foreground' : 'text-muted-foreground'
          }
        >
          {value || placeholder}
        </span>

        <span className="text-muted-foreground text-xs">▾</span>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full h-9 px-3 text-sm bg-muted rounded-xl outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="max-h-52 overflow-y-auto">
            {filtered.map((opt) => (
              <button
                type="button"
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                  setSearch('');
                }}
                className={cn(
                  'w-full px-4 py-2.5 text-sm text-left hover:bg-muted/80 transition-all',
                  opt === value &&
                    'bg-primary/10 text-primary font-semibold'
                )}
              >
                {opt}
              </button>
            ))}

            {filtered.length === 0 && (
              <p className="px-4 py-3 text-xs text-muted-foreground">
                No results
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CountrySelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = COUNTRIES.find((c) => c.code === value);

  const filtered = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setSearch('');
        }}
        className="w-full h-12 px-4 rounded-2xl border-2 border-border bg-card text-sm text-left flex items-center justify-between hover:border-muted-foreground/30 transition-all"
      >
        <span
          className={
            selected ? 'text-foreground' : 'text-muted-foreground'
          }
        >
          {selected?.name || 'Select your country…'}
        </span>

        <span className="text-muted-foreground text-xs">▾</span>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search country..."
              className="w-full h-9 px-3 text-sm bg-muted rounded-xl outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="max-h-52 overflow-y-auto">
            {filtered.map((c) => (
              <button
                type="button"
                key={c.code}
                onClick={() => {
                  onChange(c.code);
                  setOpen(false);
                  setSearch('');
                }}
                className={cn(
                  'w-full px-4 py-2.5 text-sm text-left hover:bg-muted/80 transition-all',
                  c.code === value &&
                    'bg-primary/10 text-primary font-semibold'
                )}
              >
                {c.name}
              </button>
            ))}

            {filtered.length === 0 && (
              <p className="px-4 py-3 text-xs text-muted-foreground">
                No results
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/*
 * IMPORTANT:
 *
 * Program structure is now deterministic.
 *
 * We do NOT waste an OpenRouter request asking the AI to invent:
 * - program_name
 * - duration
 * - macrocycle
 * - mesocycles
 *
 * Those things are predictable and can be created locally.
 *
 * OpenRouter is reserved for the part that actually needs AI:
 * the detailed workouts.
 */
function buildLocalProgramStructure(trainingType, firstName) {
  const name = firstName?.trim() || 'Athlete';

  const configs = {
    calisthenics: {
      programName: `${name}'s 12-Week Calisthenics Program`,
      overview:
        'A 12-week calisthenics progression using submax training, progressive skill development, tendon conditioning, strength development, and a structured peak and deload phase.',
      phases: [
        {
          name: 'Foundation & Tendon Conditioning',
          weeks: '1-4',
          focus: 'Technique, submax volume, tendon preparation, movement quality',
        },
        {
          name: 'Intensification & Skill Breakthrough',
          weeks: '5-8',
          focus: 'Harder progressions, increased volume, strength and skill development',
        },
        {
          name: 'Peak & Skill Mastery',
          weeks: '9-12',
          focus: 'Advanced progressions, neural sharpening, taper and recovery',
        },
      ],
      mesocycles: [
        {
          name: 'Foundation & Tendon Conditioning',
          focus:
            'Establish perfect technique, build safe submax volume, and condition connective tissue.',
          weeks: 4,
          intensity: 'low to moderate',
          week_start: 1,
          week_end: 4,
        },
        {
          name: 'Intensification & Skill Breakthrough',
          focus:
            'Increase training stimulus and introduce harder skill progressions while maintaining submax rules.',
          weeks: 4,
          intensity: 'moderate to high',
          week_start: 5,
          week_end: 8,
        },
        {
          name: 'Peak & Skill Mastery',
          focus:
            'Peak the athlete toward their target skills, taper intelligently, and finish with recovery.',
          weeks: 4,
          intensity: 'high with planned taper and deload',
          week_start: 9,
          week_end: 12,
        },
      ],
    },

    weighted_calisthenics: {
      programName: `${name}'s 12-Week Weighted Calisthenics Program`,
      overview:
        'A 12-week weighted calisthenics progression combining skill practice, submax loaded strength, progressive overload, tendon conditioning, and planned deloads.',
      phases: [
        {
          name: 'Foundation & Loaded Tendon Conditioning',
          weeks: '1-4',
          focus: 'Technique, baseline loading, submax volume, tendon preparation',
        },
        {
          name: 'Strength Build & Skill Breakthrough',
          weeks: '5-8',
          focus: 'Progressive loading, harder skill progressions, strength development',
        },
        {
          name: 'Peak & Skill Mastery',
          weeks: '9-12',
          focus: 'Peak strength and skills, taper, final recovery',
        },
      ],
      mesocycles: [
        {
          name: 'Foundation & Loaded Tendon Conditioning',
          focus:
            'Establish safe loading and perfect movement mechanics before increasing intensity.',
          weeks: 4,
          intensity: 'low to moderate',
          week_start: 1,
          week_end: 4,
        },
        {
          name: 'Strength Build & Skill Breakthrough',
          focus:
            'Progress weighted movements and harder calisthenics skills without sacrificing form.',
          weeks: 4,
          intensity: 'moderate to high',
          week_start: 5,
          week_end: 8,
        },
        {
          name: 'Peak & Skill Mastery',
          focus:
            'Peak loaded strength and target skills, then taper and recover.',
          weeks: 4,
          intensity: 'high with planned taper and deload',
          week_start: 9,
          week_end: 12,
        },
      ],
    },

    weights: {
      programName: `${name}'s 12-Week Weight Training Program`,
      overview:
        'A 12-week strength and hypertrophy program using progressive overload, submax training, planned deloads, and Hunter Stein activation principles.',
      phases: [
        {
          name: 'Foundation & Hypertrophy Base',
          weeks: '1-4',
          focus: 'Technique, baseline loads, moderate volume, hypertrophy foundation',
        },
        {
          name: 'Strength & Intensification',
          weeks: '5-8',
          focus: 'Progressive loading, strength development, controlled intensity',
        },
        {
          name: 'Peak & Specialization',
          weeks: '9-12',
          focus: 'Peak performance, specialization, taper, and recovery',
        },
      ],
      mesocycles: [
        {
          name: 'Foundation & Hypertrophy Base',
          focus:
            'Establish baseline loads, perfect technique, and build a sustainable hypertrophy base.',
          weeks: 4,
          intensity: 'moderate',
          week_start: 1,
          week_end: 4,
        },
        {
          name: 'Strength & Intensification',
          focus:
            'Increase strength and loading while maintaining 2-3 reps in reserve.',
          weeks: 4,
          intensity: 'moderate to high',
          week_start: 5,
          week_end: 8,
        },
        {
          name: 'Peak & Specialization',
          focus:
            'Emphasize priority goals, sharpen strength, taper volume, and recover.',
          weeks: 4,
          intensity: 'high with planned taper and deload',
          week_start: 9,
          week_end: 12,
        },
      ],
    },

    hybrid: {
      programName: `${name}'s 12-Week Hybrid Program`,
      overview:
        'A 12-week hybrid program combining calisthenics skill work with weight training, using submax skill practice, progressive strength work, hypertrophy, and planned recovery.',
      phases: [
        {
          name: 'Foundation & Dual Adaptation',
          weeks: '1-4',
          focus: 'Calisthenics technique, weight baselines, tendon conditioning',
        },
        {
          name: 'Intensification & Skill Breakthrough',
          weeks: '5-8',
          focus: 'Harder skills, progressive loading, strength and hypertrophy',
        },
        {
          name: 'Peak & Mastery',
          weeks: '9-12',
          focus: 'Advanced skills, peak strength, taper, and final recovery',
        },
      ],
      mesocycles: [
        {
          name: 'Foundation & Dual Adaptation',
          focus:
            'Build the technical and physical foundation for both calisthenics and weight training.',
          weeks: 4,
          intensity: 'moderate',
          week_start: 1,
          week_end: 4,
        },
        {
          name: 'Intensification & Skill Breakthrough',
          focus:
            'Increase strength and introduce harder calisthenics progressions while managing total fatigue.',
          weeks: 4,
          intensity: 'moderate to high',
          week_start: 5,
          week_end: 8,
        },
        {
          name: 'Peak & Mastery',
          focus:
            'Peak target skills and strength, then taper and recover.',
          weeks: 4,
          intensity: 'high with planned taper and deload',
          week_start: 9,
          week_end: 12,
        },
      ],
    },
  };

  return configs[trainingType] || configs.calisthenics;
}

/*
 * This is intentionally much smaller than the old full 12-week prompt.
 *
 * The previous version repeatedly sent the entire training methodology
 * into OpenRouter for every week. That multiplied the same large prompt
 * across 12 calls.
 *
 * This version sends only the rules needed to generate the current
 * two-week batch.
 */
function buildCompactWeeklyPrompt(
  trainingType,
  data,
  mesocycleIndex,
  mesocycle,
  weekStart,
  weekEnd
) {
  const athlete = [
    `Training type: ${trainingType}`,
    `Gender: ${data.gender || 'unspecified'}`,
    `Level: ${data.level || 'intermediate'}`,
    `Age: ${data.age || 'unspecified'}`,
    `Weight: ${data.weightLbs || 'unspecified'} ${
      data.unit === 'metric' ? 'kg' : 'lbs'
    }`,
    `Height: ${
      data.unit === 'metric'
        ? `${data.heightFt || '?'} cm`
        : `${data.heightFt || '?'}'${data.heightIn || 0}"`
    }`,
    `Current skills: ${data.currentSkills || 'None specified'}`,
    `Fitness goals: ${
      data.fitnessGoals?.length
        ? data.fitnessGoals.join(', ')
        : 'General fitness'
    }`,
    `Weight goals: ${
      data.weightGoals?.length
        ? data.weightGoals.join(', ')
        : 'None specified'
    }`,
    `Goal description: ${data.goalDescription || 'None specified'}`,
    `Goal timeframe: ${data.timeframe || 'None specified'}`,
    `Available equipment: ${data.equipment || 'None specified'}`,
    `Requirements and limitations: ${
      data.requirements || 'None specified'
    }`,
  ].join('\n');

  const typeRules = {
    calisthenics: `
CALISTHENICS RULES:
- Skill work comes first when the CNS is fresh.
- Use bodyweight progressions unless the listed equipment permits another option.
- Skills remain submax: approximately 40-60% of maximum hold/repetition capacity.
- Strength work stays 2-3 reps away from failure.
- Prioritize clean technique and progressive skill difficulty.
`,

    weighted_calisthenics: `
WEIGHTED CALISTHENICS RULES:
- Skill work comes first and remains unweighted/submax.
- Weighted strength work stays 2-3 reps from failure.
- Use only listed loading equipment.
- Increase loading gradually.
- Never grind a weighted repetition.
`,

    weights: `
WEIGHT TRAINING RULES:
- Use only exercises possible with the athlete's listed equipment.
- Compound movements are primary.
- Most working sets stay around 2-3 reps in reserve.
- Use progressive overload without failure training.
- Include appropriate hypertrophy/accessory work based on the athlete's goals.
`,

    hybrid: `
HYBRID RULES:
- Calisthenics skill work comes first.
- Weight training follows skill work.
- Use weights to support the athlete's calisthenics goals.
- Manage total fatigue carefully.
- Keep both skill development and muscle/strength development present.
`,
  };

  const weekRules = {
    0: `
WEEKS 1-4 — FOUNDATION:
Week 1: establish baseline and technique.
Week 2: small volume/progression increase.
Week 3: progress difficulty or load.
Week 4: deload.
`,
    1: `
WEEKS 5-8 — INTENSIFICATION:
Week 5: return from deload with slightly harder work.
Week 6: progressive volume/load increase.
Week 7: strongest training week of the phase while staying submax.
Week 8: deload.
`,
    2: `
WEEKS 9-12 — PEAK:
Week 9: advanced progression.
Week 10: peak training stimulus while remaining submax.
Week 11: taper volume while maintaining quality.
Week 12: full deload and assessment.
`,
  };

  return `
You are generating a SMALL JSON BATCH inside an existing 12-week fitness program.

IMPORTANT:
- Generate ONLY weeks ${weekStart} through ${weekEnd}.
- Do not generate any other weeks.
- Do not generate the program structure.
- Do not explain your answer.
- Do not use markdown.
- Return ONLY valid JSON.
- The JSON must match the requested schema exactly.

ATHLETE:
${athlete}

MESOCYCLE:
Number: ${mesocycleIndex + 1}
Name: ${mesocycle.name}
Focus: ${mesocycle.focus || 'Progressive training'}
Intensity: ${mesocycle.intensity || 'moderate'}

${typeRules[trainingType] || typeRules.calisthenics}

${weekRules[mesocycleIndex] || weekRules[0]}

UNIVERSAL TRAINING RULES:
- Respect every athlete requirement and limitation.
- NEVER use equipment the athlete does not have.
- Legs are mandatory unless the athlete explicitly says no legs, upper body only, or skip leg training.
- When legs are included, cover quads, hamstrings, glutes, and calves across the week.
- Push/pull balance should be maintained.
- Never train a movement to technical failure.
- Use controlled eccentrics.
- Use explosive concentric intent where appropriate.
- Every exercise needs a specific activation_cue.
- Every exercise needs a useful coaching note.
- Do not invent injuries or abilities.
- Do not add equipment that was not listed.
- Do not make the program unnecessarily long.
- If the athlete says they have limited session time, keep the number of exercises appropriate for that time.
- Prefer 4 exercises per training day for short sessions and never exceed 5 exercises per training day.
- Use the athlete's requested number of training days when it is clearly stated.
- If the requested number of training days is not stated, use 5 training days.
- Do not count warm-ups or cooldowns as exercise entries.

HUNTER STEIN ACTIVATION METHOD:
- Pre-activate the target muscle before the movement.
- Use maximum intent on the concentric phase.
- Control the eccentric for approximately 2-3 seconds.
- Maintain full-body tension.
- Maintain mind-muscle connection.
- Perfect form is mandatory.
- If form breaks, the set ends.
- activation_cue must be specific to the actual movement.

OUTPUT REQUIREMENTS:
Generate exactly the requested week numbers.
Each week must contain:
- week_number
- mesocycle_index
- week_type
- days

Each day must contain:
- day_name
- workout_type
- exercises

Each exercise must contain:
- name
- sets
- reps
- rest_seconds
- notes
- activation_cue

The response must contain exactly this top-level shape:
{
  "microcycles": [...]
}
`.trim();
}

const MICROCycle_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    microcycles: {
      type: 'array',
      minItems: 1,
      maxItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          week_number: {
            type: 'integer',
          },
          mesocycle_index: {
            type: 'integer',
          },
          week_type: {
            type: 'string',
          },
          days: {
            type: 'array',
            minItems: 1,
            maxItems: 7,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                day_name: {
                  type: 'string',
                },
                workout_type: {
                  type: 'string',
                },
                exercises: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 5,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      name: {
                        type: 'string',
                      },
                      sets: {
                        type: 'integer',
                      },
                      reps: {
                        type: 'string',
                      },
                      rest_seconds: {
                        type: 'integer',
                      },
                      notes: {
                        type: 'string',
                      },
                      activation_cue: {
                        type: 'string',
                      },
                    },
                    required: [
                      'name',
                      'sets',
                      'reps',
                      'rest_seconds',
                      'notes',
                      'activation_cue',
                    ],
                  },
                },
              },
              required: [
                'day_name',
                'workout_type',
                'exercises',
              ],
            },
          },
        },
        required: [
          'week_number',
          'mesocycle_index',
          'week_type',
          'days',
        ],
      },
    },
  },
  required: ['microcycles'],
};

function getGenerationLock() {
  try {
    const raw = window.localStorage.getItem(GENERATION_LOCK_KEY);

    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!parsed?.timestamp) {
      window.localStorage.removeItem(GENERATION_LOCK_KEY);
      return null;
    }

    if (Date.now() - parsed.timestamp > GENERATION_LOCK_MS) {
      window.localStorage.removeItem(GENERATION_LOCK_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function acquireGenerationLock() {
  const existing = getGenerationLock();

  if (existing) {
    return false;
  }

  const token = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;

  window.localStorage.setItem(
    GENERATION_LOCK_KEY,
    JSON.stringify({
      token,
      timestamp: Date.now(),
    })
  );

  return token;
}

function releaseGenerationLock(token) {
  try {
    const current = getGenerationLock();

    if (current?.token === token) {
      window.localStorage.removeItem(GENERATION_LOCK_KEY);
    }
  } catch {
    // Ignore localStorage cleanup errors.
  }
}

function getGenerationErrorMessage(error) {
  const raw =
    error?.message ||
    error?.details ||
    error?.hint ||
    error?.error_description ||
    '';

  const message = String(raw);

  if (/402/i.test(message)) {
    return 'AI generation was stopped because the current OpenRouter route requires paid usage. No more automatic retries were made.';
  }

  if (/429/i.test(message)) {
    return 'AI generation was rate-limited. Please wait before trying again.';
  }

  if (/502/i.test(message)) {
    return 'The AI provider returned an incomplete response. The program generator has stopped instead of repeatedly retrying and consuming more requests.';
  }

  if (/timeout|timed out/i.test(message)) {
    return 'The AI provider took too long to finish this section. Please try again later.';
  }

  if (/no assistant content|no output/i.test(message)) {
    return 'The AI provider stopped before returning the workout data. Please try again later.';
  }

  return message || 'Failed to generate your program. Please try again.';
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { updateSettings } = useAppSettings();

  const [step, setStep] = useState(0);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState('');
  const [language, setLanguage] = useState('English');
  const [unit, setUnit] = useState('imperial');

  const [trainingType, setTrainingType] = useState('');
  const [level, setLevel] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [timeframe, setTimeframe] = useState('');
  const [equipment, setEquipment] = useState('');
  const [requirements, setRequirements] = useState('');

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingPhase, setLoadingPhase] = useState('');

  const progressTimer = useRef(null);
  const generationStartedRef = useRef(false);
  const generationLockTokenRef = useRef(null);

  const [age, setAge] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');

  const [fitnessGoals, setFitnessGoals] = useState([]);
  const [currentSkills, setCurrentSkills] = useState('');
  const [gender, setGender] = useState('');
  const [weightGoals, setWeightGoals] = useState([]);

  const handleCountryChange = (code) => {
    setCountry(code);

    const defaults = getCountryDefaults(code);

    setLanguage(defaults.language);
    setUnit(defaults.unit);
  };

  const toggleGoal = (val) => {
    setFitnessGoals((prev) =>
      prev.includes(val)
        ? prev.filter((g) => g !== val)
        : [...prev, val]
    );
  };

  const toggleWeightGoal = (val) => {
    setWeightGoals((prev) =>
      prev.includes(val)
        ? prev.filter((g) => g !== val)
        : [...prev, val]
    );
  };

  const hasSkills =
    trainingType === 'calisthenics' ||
    trainingType === 'weighted_calisthenics' ||
    trainingType === 'hybrid';

  const hasWeightGoals =
    trainingType === 'weights' ||
    trainingType === 'hybrid';

  useEffect(() => {
    if (step === 0) return;

    window.history.pushState({ step }, '');

    const handler = () =>
      setStep((s) => Math.max(0, s - 1));

    window.addEventListener('popstate', handler);

    return () =>
      window.removeEventListener('popstate', handler);
  }, [step]);

  const runProgressTo = (target) => {
    clearInterval(progressTimer.current);

    progressTimer.current = setInterval(() => {
      setProgress((p) => {
        if (p >= target - 0.5) return p;

        const remaining = target - p;

        return Math.min(
          p + Math.max(remaining * 0.04, 0.1),
          target - 0.5
        );
      });
    }, 400);
  };

  const handleGenerate = async () => {
    if (loading || generationStartedRef.current) {
      return;
    }

    const lockToken = acquireGenerationLock();

    if (!lockToken) {
      toast.error(
        'A program generation is already running. Please wait for it to finish before starting another one.'
      );
      return;
    }

    generationLockTokenRef.current = lockToken;
    generationStartedRef.current = true;

    setLoading(true);
    setProgress(3);
    setLoadingPhase('Connecting to your account…');

    updateSettings({
      country,
      language,
      unit,
    });

    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      const user = authData?.user;

      if (!user) {
        throw new Error(
          'No authenticated user found. Please sign in again.'
        );
      }

      const parsedAge = Number.parseInt(age, 10);
      const enteredWeight = Number.parseFloat(weightLbs);
      const parsedCm = Number.parseFloat(heightFt);

      const feet = Number.parseInt(heightFt, 10) || 0;
      const inches = Number.parseInt(heightIn, 10) || 0;

      const heightInches = feet * 12 + inches;

      const weightStoredLbs = Number.isFinite(
        enteredWeight
      )
        ? unit === 'metric'
          ? enteredWeight / 0.453592
          : enteredWeight
        : null;

      const profileData = {
        id: user.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        training_type: trainingType,
        fitness_level: level || 'intermediate',
        primary_goal:
          goalDescription.trim() ||
          weightGoals.join(', ') ||
          fitnessGoals.join(', '),
        goal_timeframe: timeframe.trim(),
        available_equipment: equipment.trim(),
        training_requirements: requirements.trim(),
        weight_goals: weightGoals,
        fitness_goals: fitnessGoals,
        current_skills: currentSkills.trim(),
        age: Number.isFinite(parsedAge)
          ? parsedAge
          : null,
        gender: gender || null,
        weight_lbs: weightStoredLbs,
        height_inches:
          unit === 'imperial' && heightInches > 0
            ? heightInches
            : null,
        height_cm:
          unit === 'metric' &&
          Number.isFinite(parsedCm) &&
          parsedCm > 0
            ? parsedCm
            : null,
        country,
        language,
        unit,
        onboarded: true,
      };

      setProgress(10);
      setLoadingPhase('Saving your profile…');

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profileData, {
          onConflict: 'id',
        });

      if (profileError) {
        throw profileError;
      }

      const promptData = {
        gender,
        level,
        age,
        weightLbs,
        heightFt,
        heightIn,
        unit,
        currentSkills,
        goalDescription,
        timeframe,
        equipment,
        requirements,
        fitnessGoals,
        weightGoals,
      };

      /*
       * ---------------------------------------------------------
       * LOCAL PROGRAM STRUCTURE
       * ---------------------------------------------------------
       *
       * This replaces the old AI "structure" request.
       *
       * That old request was the 18% -> 30% section.
       * If it failed, the entire generation failed before
       * any workouts were created.
       *
       * There is no reason to spend an AI request generating
       * three four-week phases.
       */
      setProgress(18);
      setLoadingPhase(
        'Designing your 12-week training structure…'
      );

      const structure = buildLocalProgramStructure(
        trainingType,
        firstName
      );

      const mesocycles = structure.mesocycles;

      if (
        !Array.isArray(mesocycles) ||
        mesocycles.length !== 3
      ) {
        throw new Error(
          'The local program structure could not be created.'
        );
      }

      setProgress(24);
      setLoadingPhase(
        'Structure ready — preparing workout generation…'
      );

      /*
       * ---------------------------------------------------------
       * GENERATE WORKOUTS TWO WEEKS AT A TIME
       * ---------------------------------------------------------
       *
       * Old system:
       *   1 structure request
       *   12 separate week requests
       *   = 13 OpenRouter requests
       *
       * New system:
       *   structure is local
       *   2 weeks per AI request
       *   = 6 OpenRouter requests
       *
       * This dramatically reduces request count and repeated
       * prompt tokens.
       */
      const allMicrocycles = [];

      const totalWeeks = 12;
      let completedWeeks = 0;

      for (
        let batchStart = 1;
        batchStart <= totalWeeks;
        batchStart += 2
      ) {
        const batchEnd = Math.min(
          batchStart + 1,
          totalWeeks
        );

        const mesoIndex = Math.min(
          2,
          Math.floor((batchStart - 1) / 4)
        );

        const meso = mesocycles[mesoIndex];

        const phaseName =
          meso?.name ||
          `Training phase ${mesoIndex + 1}`;

        setLoadingPhase(
          `Building Weeks ${batchStart}-${batchEnd} — ${phaseName}…`
        );

        const weeklyPrompt =
          buildCompactWeeklyPrompt(
            trainingType,
            promptData,
            mesoIndex,
            meso,
            batchStart,
            batchEnd
          );

        console.info(
          '[ONBOARDING] GENERATING WEEK BATCH',
          {
            batchStart,
            batchEnd,
            mesoIndex,
            phaseName,
          }
        );

        /*
         * IMPORTANT:
         * No automatic retry here.
         *
         * OpenRouter free-tier requests are limited and repeated
         * failed attempts can burn the request allowance.
         *
         * If the provider fails, stop cleanly and tell the user
         * exactly what happened.
         */
        const parsed =
          await supabaseApi.ai.invoke({
            type: 'microcycle',
            prompt: weeklyPrompt,
            schema: MICROCycle_SCHEMA,
          });

        const generated = Array.isArray(
          parsed?.microcycles
        )
          ? parsed.microcycles
          : [];

        if (!generated.length) {
          throw new Error(
            `AI returned no workouts for Weeks ${batchStart}-${batchEnd}.`
          );
        }

        for (
          let weekNumber = batchStart;
          weekNumber <= batchEnd;
          weekNumber++
        ) {
          const week =
            generated.find(
              (microcycle) =>
                Number(
                  microcycle?.week_number
                ) === Number(weekNumber)
            ) || null;

          if (!week) {
            throw new Error(
              `AI did not return Week ${weekNumber}.`
            );
          }

          if (
            !week ||
            typeof week !== 'object'
          ) {
            throw new Error(
              `AI returned invalid data for Week ${weekNumber}.`
            );
          }

          /*
           * Do not trust the AI to change these metadata fields.
           * The application owns them.
           */
          week.week_number = weekNumber;
          week.mesocycle_index = mesoIndex;

          if (!Array.isArray(week.days)) {
            throw new Error(
              `AI returned no training days for Week ${weekNumber}.`
            );
          }

          for (const day of week.days) {
            if (!Array.isArray(day?.exercises)) {
              throw new Error(
                `AI returned invalid exercises for Week ${weekNumber}.`
              );
            }

            for (const exercise of day.exercises) {
              if (
                typeof exercise?.name !== 'string' ||
                !exercise.name.trim()
              ) {
                throw new Error(
                  `AI returned an invalid exercise in Week ${weekNumber}.`
                );
              }

              if (
                typeof exercise?.sets !== 'number'
              ) {
                exercise.sets = Number(
                  exercise.sets
                ) || 3;
              }

              if (
                typeof exercise?.rest_seconds !==
                'number'
              ) {
                exercise.rest_seconds =
                  Number(
                    exercise.rest_seconds
                  ) || 90;
              }

              if (
                typeof exercise?.reps !== 'string'
              ) {
                exercise.reps = String(
                  exercise.reps ?? '8-10'
                );
              }

              if (
                typeof exercise?.notes !== 'string' ||
                !exercise.notes.trim()
              ) {
                exercise.notes =
                  'Stop before technical failure and maintain perfect form.';
              }

              if (
                typeof exercise?.activation_cue !==
                  'string' ||
                !exercise.activation_cue.trim()
              ) {
                exercise.activation_cue =
                  'Brace, activate the target muscles, and maintain perfect position throughout the movement.';
              }
            }
          }

          allMicrocycles.push(week);
          completedWeeks += 1;
        }

        const generationProgress =
          24 +
          (completedWeeks / totalWeeks) * 64;

        setProgress(
          Math.min(generationProgress, 88)
        );

        setLoadingPhase(
          `Weeks ${batchStart}-${batchEnd} complete (${completedWeeks}/${totalWeeks}).`
        );
      }

      /*
       * Make absolutely sure we have all 12 weeks before
       * touching the database.
       */
      if (allMicrocycles.length !== 12) {
        throw new Error(
          `Only ${allMicrocycles.length} of 12 weeks were generated. The program was not saved because it is incomplete.`
        );
      }

      /*
       * Sort weeks deterministically.
       */
      allMicrocycles.sort(
        (a, b) =>
          Number(a.week_number) -
          Number(b.week_number)
      );

      /*
       * Verify every week exists exactly once.
       */
      const weekNumbers =
        allMicrocycles.map((w) =>
          Number(w.week_number)
        );

      const uniqueWeekNumbers =
        new Set(weekNumbers);

      if (
        uniqueWeekNumbers.size !== 12 ||
        !weekNumbers.every(
          (week, index) =>
            week === index + 1
        )
      ) {
        throw new Error(
          'The AI returned duplicate or missing weeks. The program was not saved.'
        );
      }

      setProgress(90);
      setLoadingPhase(
        'Saving your personalized program…'
      );

      const programPayload = {
        user_id: user.id,
        program_name: structure.programName,
        duration_weeks: 12,
        macrocycle: {
          overview: structure.overview,
          phases: structure.phases,
        },
        mesocycles: structure.mesocycles,
        microcycles: allMicrocycles,
        training_type: trainingType,
        fitness_level:
          level || 'intermediate',
        goal:
          goalDescription.trim() ||
          weightGoals.join(', ') ||
          fitnessGoals.join(', '),
        current_week: 1,
        status: 'active',
      };

      /*
       * Before inserting, remove an accidental duplicate active
       * program created by a previous successful attempt.
       *
       * We only look for this user's active program.
       */
      const {
        data: existingPrograms,
        error: existingProgramError,
      } = await supabase
        .from('workout_programs')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1);

      if (existingProgramError) {
        throw existingProgramError;
      }

      if (
        Array.isArray(existingPrograms) &&
        existingPrograms.length > 0
      ) {
        /*
         * Do not silently create a second active program.
         *
         * If one already exists, the new program is still the
         * one the user just generated, so archive the old active
         * one before saving the new one.
         */
        const oldProgramId =
          existingPrograms[0]?.id;

        if (oldProgramId) {
          const { error: archiveError } =
            await supabase
              .from('workout_programs')
              .update({
                status: 'archived',
              })
              .eq('id', oldProgramId)
              .eq('user_id', user.id);

          if (archiveError) {
            throw archiveError;
          }
        }
      }

      const {
        data: savedProgram,
        error: programError,
      } = await supabase
        .from('workout_programs')
        .insert(programPayload)
        .select()
        .single();

      if (programError) {
        throw programError;
      }

      if (!savedProgram) {
        throw new Error(
          'The program was generated but could not be confirmed as saved.'
        );
      }

      setProgress(96);
      setLoadingPhase(
        'Refreshing your app data…'
      );

      await queryClientInstance.invalidateQueries();

      setProgress(100);
      setLoadingPhase(
        'Your personalized program is ready!'
      );

      toast.success(
        'Your personalized program is ready!'
      );

      await new Promise((resolve) =>
        window.setTimeout(resolve, 700)
      );

      navigate('/', {
        replace: true,
      });
    } catch (error) {
      console.error(
        '[ONBOARDING] PROGRAM GENERATION FAILED',
        error
      );

      const message =
        getGenerationErrorMessage(error);

      toast.error(message);

      setProgress(0);
      setLoadingPhase('');
      setLoading(false);
      generationStartedRef.current = false;
    } finally {
      clearInterval(progressTimer.current);

      releaseGenerationLock(
        generationLockTokenRef.current
      );

      generationLockTokenRef.current = null;
    }
  };

  const step3Valid = hasSkills
    ? level &&
      (!hasWeightGoals ||
        weightGoals.length > 0)
    : weightGoals.length > 0;

  const step4Valid = hasSkills
    ? goalDescription.trim().length >= 10 &&
      equipment.trim().length > 0
    : equipment.trim().length > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col safe-top safe-bottom">
      <div className="px-6 pt-4 pb-4">
        <div className="flex items-center gap-2 mb-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={cn(
                'h-1 rounded-full flex-1 transition-all duration-500',
                i <= step
                  ? 'bg-primary'
                  : 'bg-muted'
              )}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="welcome"
            initial={{
              opacity: 0,
              x: 50,
            }}
            animate={{
              opacity: 1,
              x: 0,
            }}
            exit={{
              opacity: 0,
              x: -50,
            }}
            className="flex-1 flex flex-col px-6"
          >
            <h1 className="font-heading text-4xl font-bold mb-2 tracking-tight">
              Welcome to{' '}
              <span className="text-primary">
                Washek Fitness
              </span>
            </h1>

            <p className="text-muted-foreground text-lg mb-8">
              Your AI-powered training coach. Let's build your perfect program.
            </p>

            <div className="flex-1 flex flex-col justify-center gap-4">
              <div className="flex justify-center mb-4">
                <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Zap className="w-14 h-14 text-primary" />
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1 font-medium">
                  First Name
                </p>

                <Input
                  placeholder="e.g. Alex"
                  value={firstName}
                  onChange={(e) =>
                    setFirstName(
                      e.target.value
                    )
                  }
                  className="h-14 text-lg rounded-2xl"
                />
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1 font-medium">
                  Last Name
                </p>

                <Input
                  placeholder="e.g. Johnson"
                  value={lastName}
                  onChange={(e) =>
                    setLastName(
                      e.target.value
                    )
                  }
                  className="h-14 text-lg rounded-2xl"
                />
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1 font-medium flex items-center gap-1.5">
                  <Globe className="w-3 h-3" />
                  Country
                </p>

                <CountrySelect
                  value={country}
                  onChange={
                    handleCountryChange
                  }
                />
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1 font-medium">
                  Language
                </p>

                <SearchSelect
                  value={language}
                  onChange={setLanguage}
                  options={LANGUAGES}
                  placeholder="Select language…"
                />
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1 font-medium">
                  Measurement System
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      value: 'metric',
                      label: 'Metric (kg, cm)',
                    },
                    {
                      value: 'imperial',
                      label: 'Imperial (lbs, ft)',
                    },
                  ].map(
                    ({
                      value: v,
                      label,
                    }) => (
                      <button
                        type="button"
                        key={v}
                        onClick={() =>
                          setUnit(v)
                        }
                        className={cn(
                          'h-11 rounded-2xl border-2 text-sm font-semibold transition-all',
                          unit === v
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30'
                        )}
                      >
                        {label}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            <Button
              size="lg"
              className="w-full h-14 text-lg font-heading font-semibold mb-8 mt-4"
              disabled={
                !firstName.trim() ||
                !country
              }
              onClick={() =>
                setStep(1)
              }
            >
              Get Started
              <ChevronRight className="ml-2 w-5 h-5" />
            </Button>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="training-type"
            initial={{
              opacity: 0,
              x: 50,
            }}
            animate={{
              opacity: 1,
              x: 0,
            }}
            exit={{
              opacity: 0,
              x: -50,
            }}
            className="flex-1 flex flex-col px-6"
          >
            <h2 className="font-heading text-2xl font-bold mb-1">
              Choose Your Path
            </h2>

            <p className="text-muted-foreground mb-6">
              What type of training are you here for,{' '}
              {firstName || 'Athlete'}?
            </p>

            <div className="flex-1">
              <TrainingTypeSelect
                value={trainingType}
                onChange={setTrainingType}
              />
            </div>

            <div className="flex gap-3 mb-8 mt-4">
              <Button
                variant="outline"
                size="lg"
                className="h-14"
                onClick={() =>
                  setStep(0)
                }
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>

              <Button
                size="lg"
                className="flex-1 h-14 text-lg font-heading font-semibold"
                disabled={!trainingType}
                onClick={() =>
                  setStep(2)
                }
              >
                Continue
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="bodystats"
            initial={{
              opacity: 0,
              x: 50,
            }}
            animate={{
              opacity: 1,
              x: 0,
            }}
            exit={{
              opacity: 0,
              x: -50,
            }}
            className="flex-1 flex flex-col px-6"
          >
            <h2 className="font-heading text-2xl font-bold mb-1">
              About You
            </h2>

            <p className="text-muted-foreground mb-6">
              Your stats help us personalize nutrition goals and training load.
            </p>

            <div className="space-y-4 flex-1">
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
                  Gender
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {['male', 'female'].map(
                    (g) => (
                      <button
                        type="button"
                        key={g}
                        onClick={() =>
                          setGender(g)
                        }
                        className={cn(
                          'h-12 rounded-2xl border-2 font-semibold text-sm capitalize transition-all',
                          gender === g
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30'
                        )}
                      >
                        {g === 'male'
                          ? '♂ Male'
                          : '♀ Female'}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1 font-medium">
                    Age
                  </p>

                  <Input
                    type="number"
                    placeholder="e.g. 24"
                    value={age}
                    onChange={(e) =>
                      setAge(
                        e.target.value
                      )
                    }
                    className="h-12 text-base"
                  />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1 font-medium">
                    Weight (
                    {unit === 'metric'
                      ? 'kg'
                      : 'lbs'}
                    )
                  </p>

                  <Input
                    type="number"
                    placeholder={
                      unit === 'metric'
                        ? 'e.g. 80'
                        : 'e.g. 175'
                    }
                    value={weightLbs}
                    onChange={(e) =>
                      setWeightLbs(
                        e.target.value
                      )
                    }
                    className="h-12 text-base"
                  />
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1 font-medium">
                  Height
                </p>

                {unit === 'metric' ? (
                  <Input
                    type="number"
                    placeholder="Height in cm (e.g. 178)"
                    value={heightFt}
                    onChange={(e) =>
                      setHeightFt(
                        e.target.value
                      )
                    }
                    className="h-12 text-base"
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="number"
                      placeholder="Feet (e.g. 5)"
                      value={heightFt}
                      onChange={(e) =>
                        setHeightFt(
                          e.target.value
                        )
                      }
                      className="h-12 text-base"
                    />

                    <Input
                      type="number"
                      placeholder="Inches (e.g. 10)"
                      value={heightIn}
                      onChange={(e) =>
                        setHeightIn(
                          e.target.value
                        )
                      }
                      className="h-12 text-base"
                    />
                  </div>
                )}
              </div>

              {hasSkills && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
                    Your Goals (select all that apply)
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    {CALISTHENICS_GOALS.map(
                      ({
                        value,
                        label,
                        iconName,
                      }) => {
                        const GoalIcon =
                          GOAL_ICONS[
                            iconName
                          ] ||
                          Dumbbell;

                        return (
                          <button
                            type="button"
                            key={value}
                            onClick={() =>
                              toggleGoal(
                                value
                              )
                            }
                            aria-pressed={fitnessGoals.includes(
                              value
                            )}
                            className={cn(
                              'flex items-center gap-2 p-3 rounded-2xl border-2 text-left transition-all',
                              fitnessGoals.includes(
                                value
                              )
                                ? 'border-primary bg-primary/10 text-foreground'
                                : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30'
                            )}
                          >
                            <GoalIcon className="w-4 h-4 flex-shrink-0" />

                            <span className="text-sm font-medium">
                              {label}
                            </span>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mb-8 mt-4">
              <Button
                variant="outline"
                size="lg"
                className="h-14"
                onClick={() =>
                  setStep(1)
                }
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>

              <Button
                size="lg"
                className="flex-1 h-14 text-lg font-heading font-semibold"
                disabled={
                  !gender ||
                  (hasSkills &&
                    fitnessGoals.length === 0)
                }
                onClick={() =>
                  setStep(3)
                }
              >
                Continue
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            initial={{
              opacity: 0,
              x: 50,
            }}
            animate={{
              opacity: 1,
              x: 0,
            }}
            exit={{
              opacity: 0,
              x: -50,
            }}
            className="flex-1 flex flex-col px-6"
          >
            {hasSkills && (
              <>
                <h2 className="font-heading text-2xl font-bold mb-1">
                  Your Level
                </h2>

                <p className="text-muted-foreground mb-6">
                  Where are you in your journey,{' '}
                  {firstName ||
                    'Athlete'}
                  ?
                </p>

                <div className="space-y-3 flex-1">
                  {levels.map(
                    ({
                      value,
                      label,
                      desc,
                      icon: Icon,
                      placeholder,
                    }) => (
                      <div key={value}>
                        <button
                          type="button"
                          onClick={() =>
                            setLevel(
                              value
                            )
                          }
                          className={cn(
                            'w-full p-4 rounded-2xl border-2 text-left transition-all',
                            level === value
                              ? 'border-primary bg-primary/10'
                              : 'border-border bg-card hover:border-muted-foreground/30'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'w-10 h-10 rounded-xl flex items-center justify-center',
                                level ===
                                  value
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              <Icon className="w-5 h-5" />
                            </div>

                            <div>
                              <p className="font-semibold">
                                {label}
                              </p>

                              <p className="text-sm text-muted-foreground">
                                {desc}
                              </p>
                            </div>
                          </div>
                        </button>

                        {level ===
                          value && (
                          <div className="mt-1.5 px-1">
                            <Textarea
                              value={
                                currentSkills
                              }
                              onChange={(
                                e
                              ) =>
                                setCurrentSkills(
                                  e.target
                                    .value
                                )
                              }
                              placeholder={
                                placeholder
                              }
                              className="text-sm resize-none min-h-[72px] rounded-2xl border-primary/40 bg-primary/5 focus:border-primary leading-relaxed"
                              onClick={(
                                e
                              ) =>
                                e.stopPropagation()
                              }
                            />

                            <p className="text-xs text-muted-foreground mt-1 pl-1">
                              What skills & moves can you currently do?
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>

                {hasWeightGoals && (
                  <div className="mt-6">
                    <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
                      Weight Training Goals (select all that apply)
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      {WEIGHT_GOALS.map(
                        ({
                          value,
                          label,
                          iconName,
                        }) => {
                          const GoalIcon =
                            GOAL_ICONS[
                              iconName
                            ] ||
                            Dumbbell;

                          return (
                            <button
                              type="button"
                              key={value}
                              onClick={() =>
                                toggleWeightGoal(
                                  value
                                )
                              }
                              aria-pressed={weightGoals.includes(
                                value
                              )}
                              className={cn(
                                'flex items-center gap-2 p-3 rounded-2xl border-2 text-left transition-all',
                                weightGoals.includes(
                                  value
                                )
                                  ? 'border-primary bg-primary/10 text-foreground'
                                  : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30'
                              )}
                            >
                              <GoalIcon className="w-4 h-4 flex-shrink-0" />

                              <span className="text-sm font-medium">
                                {label}
                              </span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {!hasSkills && (
              <>
                <h2 className="font-heading text-2xl font-bold mb-1">
                  Your Goals
                </h2>

                <p className="text-muted-foreground mb-6">
                  What do you want to achieve with weight training,{' '}
                  {firstName ||
                    'Athlete'}
                  ?
                </p>

                <div className="grid grid-cols-2 gap-3 flex-1">
                  {WEIGHT_GOALS.map(
                    ({
                      value,
                      label,
                      iconName,
                    }) => {
                      const GoalIcon =
                        GOAL_ICONS[
                          iconName
                        ] ||
                        Dumbbell;

                      return (
                        <button
                          type="button"
                          key={value}
                          onClick={() =>
                            toggleWeightGoal(
                              value
                            )
                          }
                          aria-pressed={weightGoals.includes(
                            value
                          )}
                          className={cn(
                            'flex items-center gap-2 p-4 rounded-2xl border-2 text-left transition-all',
                            weightGoals.includes(
                              value
                            )
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30'
                          )}
                        >
                          <GoalIcon className="w-5 h-5 flex-shrink-0" />

                          <span className="text-sm font-medium">
                            {label}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              </>
            )}

            <div className="flex gap-3 mb-8 mt-4">
              <Button
                variant="outline"
                size="lg"
                className="h-14"
                onClick={() =>
                  setStep(2)
                }
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>

              <Button
                size="lg"
                className="flex-1 h-14 text-lg font-heading font-semibold"
                disabled={!step3Valid}
                onClick={() =>
                  setStep(4)
                }
              >
                Continue
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div
            key="step4"
            initial={{
              opacity: 0,
              x: 50,
            }}
            animate={{
              opacity: 1,
              x: 0,
            }}
            exit={{
              opacity: 0,
              x: -50,
            }}
            className="flex-1 flex flex-col px-6"
          >
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-primary" />

              <h2 className="font-heading text-2xl font-bold">
                {hasSkills
                  ? `Tell us your goals, ${
                      firstName ||
                      'Athlete'
                    }`
                  : `Final details, ${
                      firstName ||
                      'Athlete'
                    }`}
              </h2>
            </div>

            <p className="text-muted-foreground mb-4">
              {hasSkills
                ? 'Describe your goals, what you want to achieve, and any limitations. The more detail you give, the more personalized your program will be.'
                : 'List your available equipment and any requirements. This helps us build the perfect program for you.'}
            </p>

            <div className="flex-1 flex flex-col gap-3">
              {hasSkills && (
                <>
                  <Textarea
                    value={goalDescription}
                    onChange={(e) =>
                      setGoalDescription(
                        e.target.value
                      )
                    }
                    placeholder={`e.g. "I want to learn the muscle up and build a strong back. I can currently do 10 pull-ups and 15 dips. I had a shoulder injury last year so I want to take it slow on pressing movements."`}
                    className="min-h-[140px] text-sm resize-none bg-card border-border focus:border-primary rounded-2xl p-4 leading-relaxed"
                  />

                  <div className="bg-muted/50 rounded-2xl p-4 border border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      ⏱ Timeframe for your goals
                    </p>

                    <Textarea
                      value={timeframe}
                      onChange={(e) =>
                        setTimeframe(
                          e.target.value
                        )
                      }
                      placeholder={`e.g. "Muscle up in 3 months, handstand in 6 months."`}
                      className="min-h-[60px] text-sm resize-none bg-card border-border focus:border-primary rounded-xl p-3 leading-relaxed"
                    />
                  </div>
                </>
              )}

              {!hasSkills && (
                <div className="bg-muted/50 rounded-2xl p-4 border border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    📋 Goals summary
                  </p>

                  <p className="text-sm text-muted-foreground">
                    You selected:{' '}
                    <span className="font-semibold text-foreground">
                      {weightGoals.join(
                        ', '
                      ) ||
                        'General fitness'}
                    </span>
                  </p>
                </div>
              )}

              <div className="bg-muted/50 rounded-2xl p-4 border border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  🏋️ Available equipment{' '}
                  <span className="text-destructive">
                    *
                  </span>
                </p>

                <Textarea
                  value={equipment}
                  onChange={(e) =>
                    setEquipment(
                      e.target.value
                    )
                  }
                  placeholder={
                    hasSkills
                      ? `e.g. "Pull-up bar, dip bars, resistance bands, gymnastic rings, parallettes."`
                      : `e.g. "Full gym access: barbells, dumbbells, cables, machines, squat rack, bench." or "Home gym: dumbbells up to 50lbs, bench, pull-up bar."`
                  }
                  className="min-h-[70px] text-sm resize-none bg-card border-border focus:border-primary rounded-xl p-3 leading-relaxed"
                />

                <p className="text-[10px] text-muted-foreground mt-1.5">
                  List everything you have access to — this is required.
                </p>
              </div>

              <div className="bg-muted/50 rounded-2xl p-4 border border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  📝 Requirements & Notes
                </p>

                <Textarea
                  value={requirements}
                  onChange={(e) =>
                    setRequirements(
                      e.target.value
                    )
                  }
                  placeholder={`e.g. "I can train 4 days a week, about 60 min per session. I have a history of lower back pain so I want to be careful with heavy deadlifts. I also want to focus on my chest since it's lagging."`}
                  className="min-h-[80px] text-sm resize-none bg-card border-border focus:border-primary rounded-xl p-3 leading-relaxed"
                />

                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Time available, injuries, limitations, areas to focus on — anything that helps us make your program perfect.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mb-8 mt-4">
              <Button
                variant="outline"
                size="lg"
                className="h-14"
                disabled={loading}
                onClick={() =>
                  setStep(3)
                }
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>

              <Button
                size="lg"
                className="flex-1 h-14 text-lg font-heading font-semibold"
                disabled={
                  !step4Valid ||
                  loading
                }
                onClick={
                  handleGenerate
                }
              >
                {loading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />

                    <span className="truncate">
                      {loadingPhase ||
                        'Building your program…'}{' '}
                      {Math.round(
                        progress
                      )}
                      %
                    </span>
                  </div>
                ) : (
                  <>
                    Build My Program
                    <Sparkles className="ml-2 w-5 h-5" />
                  </>
                )}
              </Button>
            </div>

            {loading && (
              <div className="mb-6 space-y-2">
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${progress}%`,
                    }}
                  />
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  {loadingPhase ||
                    'Building your program…'}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
