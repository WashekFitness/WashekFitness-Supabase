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
import {
  CALISTHENICS_GOALS,
  WEIGHT_GOALS,
  buildMicrocyclePrompt,
} from '@/lib/trainingTypes';
import { toast } from 'sonner';

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
    .filter((o) =>
      o.toLowerCase().includes(search.toLowerCase())
    )
    .slice(0, 200);

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          setSearch('');
        }}
        className="w-full h-12 px-4 rounded-2xl border-2 border-border bg-card text-sm text-left flex items-center justify-between hover:border-muted-foreground/30 transition-all"
      >
        <span
          className={
            value
              ? 'text-foreground'
              : 'text-muted-foreground'
          }
        >
          {value || placeholder}
        </span>
        <span className="text-muted-foreground text-xs">
          ▾
        </span>
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

  const selected = COUNTRIES.find(
    (c) => c.code === value
  );

  const filtered = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          setSearch('');
        }}
        className="w-full h-12 px-4 rounded-2xl border-2 border-border bg-card text-sm text-left flex items-center justify-between hover:border-muted-foreground/30 transition-all"
      >
        <span
          className={
            selected
              ? 'text-foreground'
              : 'text-muted-foreground'
          }
        >
          {selected?.name || 'Select your country…'}
        </span>

        <span className="text-muted-foreground text-xs">
          ▾
        </span>
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
    if (
      loading ||
      generationStartedRef.current
    ) {
      return;
    }

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
      const enteredWeight =
        Number.parseFloat(weightLbs);
      const parsedCm =
        Number.parseFloat(heightFt);

      const feet =
        Number.parseInt(heightFt, 10) || 0;

      const inches =
        Number.parseInt(heightIn, 10) || 0;

      const heightInches =
        feet * 12 + inches;

      const weightStoredLbs =
        Number.isFinite(enteredWeight)
          ? unit === 'metric'
            ? enteredWeight / 0.453592
            : enteredWeight
          : null;

      const profileData = {
        id: user.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        training_type: trainingType,
        fitness_level:
          level || 'intermediate',

        primary_goal:
          goalDescription.trim() ||
          weightGoals.join(', ') ||
          fitnessGoals.join(', '),

        goal_timeframe: timeframe.trim(),
        available_equipment:
          equipment.trim(),

        training_requirements:
          requirements.trim(),

        weight_goals: weightGoals,
        fitness_goals: fitnessGoals,

        current_skills:
          currentSkills.trim(),

        age: Number.isFinite(parsedAge)
          ? parsedAge
          : null,

        gender: gender || null,

        weight_lbs:
          weightStoredLbs,

        height_inches:
          unit === 'imperial' &&
          heightInches > 0
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
      setLoadingPhase(
        'Saving your profile…'
      );

      const {
        error: profileError,
      } = await supabase
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

      // ============================================================
      // PROGRAM STRUCTURE
      //
      // IMPORTANT:
      // The 12-week structure is created locally.
      //
      // We intentionally DO NOT call:
      //
      // supabaseApi.ai.invoke({
      //   type: 'structure',
      //   ...
      // })
      //
      // here.
      //
      // This prevents the program from getting stuck at 18% while
      // OpenRouter tries to reason through the entire macrocycle.
      // ============================================================

      setProgress(18);
      setLoadingPhase(
        'Designing your program structure…'
      );

      const trainingTypeLabels = {
        calisthenics: 'Calisthenics',
        weighted_calisthenics:
          'Weighted Calisthenics',
        weights: 'Weight Training',
        hybrid: 'Hybrid Training',
      };

      const trainingLabel =
        trainingTypeLabels[trainingType] ||
        'Personalized Training';

      const goalText =
        goalDescription.trim() ||
        weightGoals.join(', ') ||
        fitnessGoals.join(', ') ||
        'general fitness';

      const structure = {
        program_name:
          `${firstName.trim() || 'Athlete'}'s ${trainingLabel} Program`,

        duration_weeks: 12,

        macrocycle: {
          overview:
            `A 12-week ${trainingLabel.toLowerCase()} program built around ${goalText}. ` +
            `The program progresses through foundation, intensification, and peak/mastery phases ` +
            `while respecting the athlete's equipment, training experience, goals, and requirements.`,

          phases: [
            {
              name:
                'Foundation & Adaptation',
              weeks: '1-4',
              focus:
                'Build technical consistency, establish training baselines, develop tendon and connective-tissue tolerance, and introduce progressive overload.',
            },
            {
              name:
                'Intensification & Progression',
              weeks: '5-8',
              focus:
                'Increase training intensity and productive volume while progressing skills, strength, hypertrophy, and movement quality.',
            },
            {
              name:
                'Peak & Mastery',
              weeks: '9-12',
              focus:
                'Peak the athlete toward their primary goals, consolidate advanced skills and strength, taper intelligently, and finish with recovery and assessment.',
            },
          ],
        },

        mesocycles: [
          {
            name:
              'Foundation & Adaptation',

            focus:
              'Establish technique, submaximal training tolerance, movement quality, baseline strength, and progressive adaptation.',

            weeks: 4,
            intensity: 'moderate',

            week_start: 1,
            week_end: 4,
          },

          {
            name:
              'Intensification & Progression',

            focus:
              'Increase intensity and productive training volume while progressing the athlete toward harder movements and stronger performance.',

            weeks: 4,
            intensity: 'moderate-high',

            week_start: 5,
            week_end: 8,
          },

          {
            name:
              'Peak & Mastery',

            focus:
              'Peak important skills and strength qualities, specialize toward the athlete goals, taper volume appropriately, and finish with a full recovery week.',

            weeks: 4,
            intensity:
              'high with planned taper/deload',

            week_start: 9,
            week_end: 12,
          },
        ],
      };

      // Structure is complete locally.
      // No OpenRouter request has been made.
      setProgress(30);

      setLoadingPhase(
        'Structure complete — starting your workouts…'
      );

      // ============================================================
      // GENERATE EACH WEEK SEPARATELY
      // ============================================================

      const microcycleSchema = {
        type: 'object',

        additionalProperties: false,

        properties: {
          microcycles: {
            type: 'array',
          },
        },

        required: ['microcycles'],
      };

      const mesocycles =
        structure.mesocycles;

      const totalWeeks =
        mesocycles.reduce(
          (total, meso) => {
            const weekStart =
              Number(meso?.week_start) ||
              1;

            const weekEnd =
              Number(meso?.week_end) ||
              4;

            return (
              total +
              Math.max(
                0,
                weekEnd -
                  weekStart +
                  1
              )
            );
          },
          0
        );

      let completedWeeks = 0;

      const allMicrocycles = [];

      for (
        let mesoIndex = 0;
        mesoIndex <
        mesocycles.length;
        mesoIndex++
      ) {
        const meso =
          mesocycles[mesoIndex];

        const phaseName =
          meso?.name ||
          `Training phase ${
            mesoIndex + 1
          }`;

        const weekStart =
          Number(meso?.week_start) ||
          mesoIndex * 4 + 1;

        const weekEnd =
          Number(meso?.week_end) ||
          mesoIndex * 4 + 4;

        for (
          let weekNumber =
            weekStart;
          weekNumber <= weekEnd;
          weekNumber++
        ) {
          setLoadingPhase(
            `Building Week ${weekNumber} — ${phaseName}…`
          );

          const weeklyPrompt =
            `${buildMicrocyclePrompt(
              trainingType,
              promptData,
              mesoIndex,
              meso
            )}

=== CRITICAL OUTPUT LIMIT ===

You are generating ONLY WEEK ${weekNumber}.

IGNORE any earlier instruction that says to generate a complete 12-week program.

DO NOT generate multiple weeks.

DO NOT generate weeks other than WEEK ${weekNumber}.

Generate ONLY WEEK ${weekNumber}.

This week belongs to MESOCYCLE ${mesoIndex + 1}: "${phaseName}".

Mesocycle focus:
${meso?.focus || 'Progressive training'}

Mesocycle intensity:
${meso?.intensity || 'moderate'}

Week number:
${weekNumber}

The response must contain EXACTLY ONE microcycle.

The microcycle must contain:

- week_number: ${weekNumber}
- mesocycle_index: ${mesoIndex}
- week_type
- days
- every day must contain day_name
- every day must contain workout_type
- every day must contain exercises
- every exercise must contain name
- sets must be a number
- reps must be a string
- rest_seconds must be a number
- notes must contain a useful coaching cue
- activation_cue must contain a specific actionable Hunter Stein activation/form cue

Respect ALL athlete requirements from the training methodology above.

Respect:

- training type
- fitness level
- goals
- current skills
- available equipment
- available training time
- injuries
- limitations
- training requirements
- Anton's Submax method
- progressive overload rules
- periodization rules
- leg-training requirements
- Hunter Stein activation method

Do not create exercises requiring equipment the athlete does not have.

Do not explain your answer.

Do not use markdown.

Return ONLY valid JSON.

Return exactly this structure:

{
  "microcycles": [
    {
      "week_number": ${weekNumber},
      "mesocycle_index": ${mesoIndex},
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

          const parsed =
            await supabaseApi.ai.invoke({
              type: 'microcycle',
              prompt: weeklyPrompt,
              schema:
                microcycleSchema,
            });

          const generated =
            Array.isArray(
              parsed?.microcycles
            )
              ? parsed.microcycles
              : [];

          if (!generated.length) {
            throw new Error(
              `AI returned no workout for Week ${weekNumber}.`
            );
          }

          const week =
            generated.find(
              (microcycle) =>
                Number(
                  microcycle?.week_number
                ) ===
                Number(weekNumber)
            ) ||
            generated[0];

          if (
            !week ||
            typeof week !==
              'object'
          ) {
            throw new Error(
              `AI returned an invalid workout for Week ${weekNumber}.`
            );
          }

          // Keep these values deterministic.
          week.week_number =
            weekNumber;

          week.mesocycle_index =
            mesoIndex;

          allMicrocycles.push(
            week
          );

          completedWeeks += 1;

          const generationProgress =
            totalWeeks > 0
              ? 30 +
                (completedWeeks /
                  totalWeeks) *
                  55
              : 85;

          setProgress(
            generationProgress
          );

          setLoadingPhase(
            `Week ${weekNumber} complete (${completedWeeks}/${totalWeeks}).`
          );
        }
      }

      if (
        !allMicrocycles.length
      ) {
        throw new Error(
          'No workouts were generated.'
        );
      }

      // ============================================================
      // SAVE COMPLETE PROGRAM
      // ============================================================

      setProgress(90);

      setLoadingPhase(
        'Saving your personalized program…'
      );

      const programPayload = {
        user_id: user.id,

        program_name:
          structure.program_name,

        duration_weeks:
          structure.duration_weeks,

        macrocycle:
          structure.macrocycle,

        mesocycles:
          structure.mesocycles,

        microcycles:
          allMicrocycles,

        training_type:
          trainingType,

        fitness_level:
          level || 'intermediate',

        goal:
          goalDescription.trim() ||
          weightGoals.join(', ') ||
          fitnessGoals.join(', '),

        current_week: 1,

        status: 'active',
      };

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

      await new Promise(
        (resolve) =>
          window.setTimeout(
            resolve,
            700
          )
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
        error?.message ||
        error?.details ||
        error?.hint ||
        'Failed to generate your program. Please try again.';

      toast.error(message);

      setProgress(0);
      setLoadingPhase('');
      setLoading(false);

      generationStartedRef.current =
        false;
    } finally {
      clearInterval(
        progressTimer.current
      );
    }
  };

  // Step 3 continue condition
  const step3Valid = hasSkills
    ? level &&
      (!hasWeightGoals ||
        weightGoals.length > 0)
    : weightGoals.length > 0;

  // Step 4 (generate) condition
  const step4Valid = hasSkills
    ? goalDescription.trim()
        .length >= 10 &&
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
        {/* STEP 0: Welcome */}
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
              Your AI-powered training
              coach. Let's build your
              perfect program.
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
                  onChange={
                    setLanguage
                  }
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
                      label:
                        'Metric (kg, cm)',
                    },
                    {
                      value:
                        'imperial',
                      label:
                        'Imperial (lbs, ft)',
                    },
                  ].map(
                    ({
                      value: v,
                      label,
                    }) => (
                      <button
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

        {/* STEP 1: Training Type */}
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
              What type of training
              are you here for,{' '}
              {firstName ||
                'Athlete'}
              ?
            </p>

            <div className="flex-1">
              <TrainingTypeSelect
                value={trainingType}
                onChange={
                  setTrainingType
                }
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

        {/* STEP 2: Body Stats */}
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
              Your stats help us
              personalize nutrition
              goals and training load.
            </p>

            <div className="space-y-4 flex-1">
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
                  Gender
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    'male',
                    'female',
                  ].map((g) => (
                    <button
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
                  ))}
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
                    {unit ===
                    'metric'
                      ? 'kg'
                      : 'lbs'}
                    )
                  </p>

                  <Input
                    type="number"
                    placeholder={
                      unit ===
                      'metric'
                        ? 'e.g. 80'
                        : 'e.g. 175'
                    }
                    value={
                      weightLbs
                    }
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

                {unit ===
                'metric' ? (
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
                    Your Goals
                    (select all
                    that apply)
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
                            key={
                              value
                            }
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
                    fitnessGoals.length ===
                      0)
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

        {/* STEP 3: Level+Skills OR Weight Goals */}
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
                  Where are you in
                  your journey,{' '}
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
                      <div
                        key={value}
                      >
                        <button
                          onClick={() =>
                            setLevel(
                              value
                            )
                          }
                          className={cn(
                            'w-full p-4 rounded-2xl border-2 text-left transition-all',
                            level ===
                              value
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
                                  e
                                    .target
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
                              What skills
                              & moves
                              can you
                              currently
                              do?
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
                      Weight Training
                      Goals (select
                      all that apply)
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
                              key={
                                value
                              }
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
                  What do you want
                  to achieve with
                  weight training,{' '}
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
                          key={
                            value
                          }
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
                disabled={
                  !step3Valid
                }
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

        {/* STEP 4: Goals/Timeframe/Equipment/Requirements */}
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
                    value={
                      goalDescription
                    }
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
                      ⏱ Timeframe for
                      your goals
                    </p>

                    <Textarea
                      value={
                        timeframe
                      }
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
                  🏋️ Available
                  equipment{' '}
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
                  List everything
                  you have access
                  to — this is
                  required.
                </p>
              </div>

              <div className="bg-muted/50 rounded-2xl p-4 border border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  📝 Requirements
                  & Notes
                </p>

                <Textarea
                  value={
                    requirements
                  }
                  onChange={(e) =>
                    setRequirements(
                      e.target.value
                    )
                  }
                  placeholder={`e.g. "I can train 4 days a week, about 60 min per session. I have a history of lower back pain so I want to be careful with heavy deadlifts. I also want to focus on my chest since it's lagging."`}
                  className="min-h-[80px] text-sm resize-none bg-card border-border focus:border-primary rounded-xl p-3 leading-relaxed"
                />

                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Time available,
                  injuries,
                  limitations,
                  areas to
                  focus on —
                  anything that
                  helps us make
                  your program
                  perfect.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mb-8 mt-4">
              <Button
                variant="outline"
                size="lg"
                className="h-14"
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
