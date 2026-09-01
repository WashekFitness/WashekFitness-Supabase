import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  ChevronLeft,
  ChevronRight,
  Zap,
  Layers,
  TrendingDown,
  Target,
  Eye,
  Clock,
  Dumbbell,
  Timer,
  CheckCircle2,
  Edit3,
  Plus,
  Trash2,
  Save,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { hasPlan } from '@/lib/subscription';
import { supabaseApi } from '@/lib/supabaseApi';

const weekTypeConfig = {
  foundation: { label: 'Foundation', color: 'bg-accent/15 text-accent border-accent/20', icon: Target },
  accumulation: { label: 'Accumulation', color: 'bg-primary/15 text-primary border-primary/20', icon: Layers },
  intensification: { label: 'Intensification', color: 'bg-chart-4/15 text-chart-4 border-chart-4/20', icon: Zap },
  peak: { label: 'Peak', color: 'bg-chart-3/15 text-chart-3 border-chart-3/20', icon: Zap },
  taper: { label: 'Taper', color: 'bg-chart-3/15 text-chart-3 border-chart-3/20', icon: TrendingDown },
  deload: { label: 'Deload', color: 'bg-muted text-muted-foreground border-border', icon: TrendingDown },
};

function getWeekTypeConfig(weekType) {
  if (!weekType) return null;
  const key = String(weekType).toLowerCase().trim();
  return weekTypeConfig[key] || {
    label: weekType,
    color: 'bg-muted text-muted-foreground border-border',
    icon: Target,
  };
}

function WorkoutTypeTag({ workoutType }) {
  if (!workoutType) return null;
  const lower = String(workoutType).toLowerCase();
  let color = 'bg-muted/60 text-muted-foreground';
  if (lower.includes('intensity') || lower.includes('neural') || lower.includes('strength') || lower.includes('power')) {
    color = 'bg-chart-4/10 text-chart-4';
  } else if (lower.includes('volume') || lower.includes('hypertrophy') || lower.includes('muscle')) {
    color = 'bg-primary/10 text-primary';
  } else if (lower.includes('skill') || lower.includes('recovery') || lower.includes('active') || lower.includes('deload') || lower.includes('mobility')) {
    color = 'bg-accent/10 text-accent';
  }
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', color)}>
      {workoutType}
    </span>
  );
}

function getExercises(day) {
  return Array.isArray(day?.exercises) ? day.exercises : [];
}

function buildAdaptationChanges(beforeExercises, afterExercises) {
  const before = Array.isArray(beforeExercises) ? beforeExercises : [];
  const after = Array.isArray(afterExercises) ? afterExercises : [];
  const changes = [];
  const maxLength = Math.max(before.length, after.length);

  for (let index = 0; index < maxLength; index += 1) {
    const previous = before[index] || null;
    const next = after[index] || null;

    if (!previous && next) {
      changes.push({ type: 'exercise_added', exercise: next.name || null, sets: next.sets ?? null, reps: next.reps ?? null, rest_seconds: next.rest_seconds ?? null });
      continue;
    }
    if (previous && !next) {
      changes.push({ type: 'exercise_removed', exercise: previous.name || null });
      continue;
    }
    if (!previous || !next) continue;

    const previousName = String(previous.name || '').trim();
    const nextName = String(next.name || '').trim();

    if (previousName.toLowerCase() !== nextName.toLowerCase()) {
      changes.push({ type: 'exercise_replaced', from: previousName || null, to: nextName || null });
    }
    if (Number(previous.sets) !== Number(next.sets)) {
      changes.push({
        type: 'sets_changed',
        exercise: nextName || previousName || null,
        from: Number(previous.sets) || 0,
        to: Number(next.sets) || 0,
        direction: Number(next.sets) > Number(previous.sets) ? 'increased' : 'decreased',
      });
    }
    if (String(previous.reps ?? '').trim() !== String(next.reps ?? '').trim()) {
      changes.push({ type: 'reps_changed', exercise: nextName || previousName || null, from: String(previous.reps ?? ''), to: String(next.reps ?? '') });
    }
    if (Number(previous.rest_seconds) !== Number(next.rest_seconds)) {
      changes.push({
        type: 'rest_changed',
        exercise: nextName || previousName || null,
        from: Number(previous.rest_seconds) || 0,
        to: Number(next.rest_seconds) || 0,
        direction: Number(next.rest_seconds) > Number(previous.rest_seconds) ? 'increased' : 'decreased',
      });
    }
  }
  return changes;
}

function buildAdaptationRecord({ weekNumber, day, beforeExercises, afterExercises }) {
  const changes = buildAdaptationChanges(beforeExercises, afterExercises);
  if (!changes.length) return null;
  return {
    recorded_at: new Date().toISOString(),
    week_number: Number(weekNumber) || 1,
    day_name: day?.day_name || null,
    workout_type: day?.workout_type || null,
    changes,
  };
}

function formatRest(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value < 60) return `${value}s`;
  if (value % 60 === 0) return `${value / 60} min`;
  return `${Math.floor(value / 60)}m ${value % 60}s`;
}

function getEstimatedMinutes(exercises) {
  if (!Array.isArray(exercises) || exercises.length === 0) return 0;
  const totalSets = exercises.reduce((sum, exercise) => sum + (Number(exercise?.sets) || 1), 0);
  return Math.max(10, Math.round(totalSets * 2.5));
}

export default function WeeklyPlan({ program, onLogWorkout }) {
  const navigate = useNavigate();
  const [selectedWeek, setSelectedWeek] = useState(program?.current_week || 1);
  const [userPlan, setUserPlan] = useState('free');
  const [editingDayIndex, setEditingDayIndex] = useState(null);
  const [editingExercises, setEditingExercises] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const allWeeks = useMemo(
    () => Array.isArray(program?.microcycles) ? program.microcycles : [],
    [program]
  );
  const totalWeeks = program?.duration_weeks || allWeeks.length || 12;
  const currentWeek = program?.current_week || 1;
  const currentMicrocycle = allWeeks.find(
    (microcycle) => Number(microcycle?.week_number) === Number(selectedWeek)
  ) || null;
  const isFutureWeek = Number(selectedWeek) > Number(currentWeek);
  const mesocycleName = program?.mesocycles?.[currentMicrocycle?.mesocycle_index]?.name || null;
  const weekTypeCfg = getWeekTypeConfig(currentMicrocycle?.week_type);
  const WeekTypeIcon = weekTypeCfg?.icon || Target;
  const canEditWorkouts = hasPlan(userPlan, 'progress');

  useEffect(() => {
    let mounted = true;
    supabaseApi.auth.me()
      .then((user) => {
        if (mounted) setUserPlan(user?.subscription_plan || 'free');
      })
      .catch((error) => console.error('[WeeklyPlan] Failed to load subscription plan:', error));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (allWeeks.some((microcycle) => Number(microcycle?.week_number) === Number(selectedWeek))) return;
    if (allWeeks.length > 0) setSelectedWeek(Number(allWeeks[0]?.week_number) || 1);
  }, [allWeeks, selectedWeek]);

  const openWorkoutEditor = (dayIndex, day) => {
    if (!canEditWorkouts) return;
    const exercises = getExercises(day);
    setEditingDayIndex(dayIndex);
    setEditingExercises(exercises.map((exercise) => ({
      ...exercise,
      name: exercise?.name || '',
      sets: Number(exercise?.sets) || 1,
      reps: exercise?.reps ?? '',
      rest_seconds: Number(exercise?.rest_seconds) || 60,
      notes: exercise?.notes || '',
      activation_cue: exercise?.activation_cue || '',
    })));
  };

  const closeWorkoutEditor = () => {
    if (savingEdit) return;
    setEditingDayIndex(null);
    setEditingExercises([]);
  };

  const updateEditingExercise = (index, field, value) => {
    setEditingExercises((previous) => previous.map((exercise, exerciseIndex) => {
      if (exerciseIndex !== index) return exercise;
      if (field === 'name' || field === 'reps' || field === 'notes' || field === 'activation_cue') {
        return { ...exercise, [field]: value };
      }
      // Keep numeric inputs as strings while the user is editing so an empty field
      // is actually empty. Do not coerce an empty value back to 0/1 on every keystroke.
      if (value === '') return { ...exercise, [field]: '' };
      const numeric = Number(value);
      return { ...exercise, [field]: Number.isFinite(numeric) ? Math.max(0, numeric) : '' };
    }));
  };

  const addEditingExercise = () => {
    setEditingExercises((previous) => [...previous, {
      name: '',
      sets: 3,
      reps: '8-12',
      rest_seconds: 60,
      notes: '',
      activation_cue: '',
    }]);
  };

  const removeEditingExercise = (index) => {
    if (editingExercises.length <= 1) return;
    setEditingExercises((previous) => previous.filter((_, exerciseIndex) => exerciseIndex !== index));
  };

  const saveWorkoutEdits = async () => {
    if (!canEditWorkouts || editingDayIndex === null || savingEdit) return;
    if (!program?.id || !currentMicrocycle) {
      window.alert('This workout cannot be edited right now.');
      return;
    }

    const cleanExercises = editingExercises
      .filter((exercise) => String(exercise?.name || '').trim())
      .map((exercise) => ({
        ...exercise,
        name: String(exercise.name).trim(),
        sets: Math.max(1, Number(exercise.sets) || 1),
        reps: String(exercise.reps ?? '').trim(),
        rest_seconds: Math.max(0, Number(exercise.rest_seconds) || 0),
        notes: String(exercise.notes ?? '').trim(),
        activation_cue: String(exercise.activation_cue ?? '').trim(),
      }));

    if (cleanExercises.length === 0) {
      window.alert('Add at least one named exercise before saving.');
      return;
    }

    setSavingEdit(true);
    try {
      const originalDay = Array.isArray(currentMicrocycle?.days)
        ? currentMicrocycle.days[editingDayIndex]
        : null;

      const adaptationRecord = buildAdaptationRecord({
        weekNumber: selectedWeek,
        day: originalDay,
        beforeExercises: getExercises(originalDay),
        afterExercises: cleanExercises,
      });

      const existingAdaptations = Array.isArray(program?.adaptation_history)
        ? program.adaptation_history
        : [];
      const updatedAdaptationHistory = adaptationRecord
        ? [...existingAdaptations, adaptationRecord].slice(-100)
        : existingAdaptations;

      const updatedMicrocycles = allWeeks.map((microcycle) => {
        if (Number(microcycle?.week_number) !== Number(selectedWeek)) return microcycle;
        const days = Array.isArray(microcycle?.days) ? microcycle.days : [];
        const updatedDays = days.map((day, dayIndex) => (
          dayIndex === editingDayIndex ? { ...day, exercises: cleanExercises } : day
        ));
        return { ...microcycle, days: updatedDays };
      });

      await supabaseApi.entities.WorkoutProgram.update(program.id, {
        microcycles: updatedMicrocycles,
        adaptation_history: updatedAdaptationHistory,
      });

      setEditingDayIndex(null);
      setEditingExercises([]);
      window.location.reload();
    } catch (error) {
      console.error('[WeeklyPlan] Failed to save workout edits:', error);
      window.alert(error?.message || 'Unable to save your workout changes.');
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon" disabled={selectedWeek <= 1} onClick={() => setSelectedWeek((week) => Math.max(1, Number(week) - 1))} aria-label="Previous week">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="text-center flex-1">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <p className="font-heading font-bold text-lg">Week {selectedWeek}</p>
            {selectedWeek === currentWeek && <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-semibold border border-primary/20">Current</span>}
            {isFutureWeek && <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1"><Eye className="w-3 h-3" />Preview</span>}
          </div>
          {mesocycleName && <p className="text-xs text-muted-foreground mt-0.5">{mesocycleName}</p>}
        </div>
        <Button type="button" variant="ghost" size="icon" disabled={selectedWeek >= totalWeeks} onClick={() => setSelectedWeek((week) => Math.min(totalWeeks, Number(week) + 1))} aria-label="Next week">
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {weekTypeCfg && (
        <div className="flex items-center justify-center">
          <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border', weekTypeCfg.color)}>
            <WeekTypeIcon className="w-3.5 h-3.5" />
            {weekTypeCfg.label}
          </span>
        </div>
      )}

      <div className="space-y-3">
        {(!Array.isArray(currentMicrocycle?.days) || currentMicrocycle.days.length === 0) && (
          <Card className="p-6 text-center">
            <Dumbbell className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="font-heading font-bold">No workouts found</p>
            <p className="text-sm text-muted-foreground mt-1">Your program does not have any workouts for this week yet.</p>
          </Card>
        )}

        {Array.isArray(currentMicrocycle?.days) && currentMicrocycle.days.map((day, dayIndex) => {
          const exercises = getExercises(day);
          const estimatedMinutes = getEstimatedMinutes(exercises);
          const isEditing = editingDayIndex === dayIndex;

          return (
            <Card key={`${selectedWeek}-${dayIndex}`} className="overflow-hidden">
              <div className="p-4 border-b border-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-heading font-bold">{day?.day_name || `Day ${dayIndex + 1}`}</p>
                      {day?.workout_type && <WorkoutTypeTag workoutType={day.workout_type} />}
                    </div>
                    {day?.focus && <p className="text-xs text-muted-foreground mt-1">{day.focus}</p>}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Dumbbell className="w-3 h-3" />{exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'}</span>
                      {estimatedMinutes > 0 && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />~{estimatedMinutes} min</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canEditWorkouts && !isFutureWeek && !isEditing && (
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openWorkoutEditor(dayIndex, day)} aria-label={`Edit ${day?.day_name || 'workout'}`}>
                        <Edit3 className="w-4 h-4" />
                      </Button>
                    )}
                    {onLogWorkout && !isFutureWeek && !isEditing && (
                      <Button type="button" size="sm" className="h-8 gap-1.5" onClick={() => onLogWorkout(day)}>
                        <CheckCircle2 className="w-3.5 h-3.5" />Log
                      </Button>
                    )}
                  </div>
                </div>
                {day?.notes && <div className="mt-3 rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{day.notes}</p></div>}
              </div>

              {!isEditing && (
                <div className="divide-y divide-border">
                  {exercises.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">No exercises programmed.</div>
                  ) : exercises.map((exercise, exerciseIndex) => {
                    const rest = formatRest(exercise?.rest_seconds);
                    return (
                      <div key={`${exerciseIndex}-${exercise?.name || 'exercise'}`} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2">
                              <span className="text-xs text-muted-foreground font-mono mt-0.5 w-5 shrink-0">{exerciseIndex + 1}.</span>
                              <div className="min-w-0">
                                <p className="font-medium text-sm">{exercise?.name || 'Exercise'}</p>
                                <div className="flex items-center gap-2 flex-wrap mt-1.5">
                                  {exercise?.sets != null && <span className="text-xs font-semibold">{exercise.sets} sets</span>}
                                  {exercise?.reps && <span className="text-xs text-muted-foreground">× {exercise.reps}</span>}
                                  {rest && <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Timer className="w-3 h-3" />{rest}</span>}
                                </div>
                                {exercise?.notes && <p className="text-[11px] text-muted-foreground mt-2">{exercise.notes}</p>}
                                {exercise?.activation_cue && <p className="text-[11px] text-accent mt-1.5">Cue: {exercise.activation_cue}</p>}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {isEditing && (
                <div className="bg-muted/10">
                  <div className="p-4 border-b border-border">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-heading font-bold text-sm">Edit Workout</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Changes are saved to this program and used to personalize future programming.</p>
                      </div>
                      <Button type="button" variant="ghost" size="icon" disabled={savingEdit} onClick={closeWorkoutEditor} aria-label="Close editor"><X className="w-4 h-4" /></Button>
                    </div>
                  </div>

                  <div className="max-h-[65vh] overflow-y-auto overscroll-contain p-4 space-y-4">
                    {editingExercises.map((exercise, index) => (
                      <Card key={index} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Exercise {index + 1}</p>
                          <Button type="button" variant="ghost" size="icon" disabled={savingEdit || editingExercises.length <= 1} onClick={() => removeEditingExercise(index)} className="text-destructive hover:text-destructive" aria-label={`Remove exercise ${index + 1}`}><Trash2 className="w-4 h-4" /></Button>
                        </div>

                        <div>
                          <label className="block text-[11px] text-muted-foreground mb-1">Exercise Name</label>
                          <Input value={exercise.name} disabled={savingEdit} onChange={(event) => updateEditingExercise(index, 'name', event.target.value)} />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[11px] text-muted-foreground mb-1">Sets</label>
                            <Input type="number" min="1" inputMode="numeric" value={exercise.sets} disabled={savingEdit} onChange={(event) => updateEditingExercise(index, 'sets', event.target.value)} />
                          </div>
                          <div>
                            <label className="block text-[11px] text-muted-foreground mb-1">Reps / Time</label>
                            <Input value={exercise.reps} disabled={savingEdit} onChange={(event) => updateEditingExercise(index, 'reps', event.target.value)} />
                          </div>
                          <div>
                            <label className="block text-[11px] text-muted-foreground mb-1">Rest (sec)</label>
                            <Input type="number" min="0" inputMode="numeric" value={exercise.rest_seconds} disabled={savingEdit} onChange={(event) => updateEditingExercise(index, 'rest_seconds', event.target.value)} />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] text-muted-foreground mb-1">Notes</label>
                          <Input value={exercise.notes} disabled={savingEdit} onChange={(event) => updateEditingExercise(index, 'notes', event.target.value)} placeholder="Optional" />
                        </div>
                        <div>
                          <label className="block text-[11px] text-muted-foreground mb-1">Activation Cue</label>
                          <Input value={exercise.activation_cue} disabled={savingEdit} onChange={(event) => updateEditingExercise(index, 'activation_cue', event.target.value)} placeholder="Optional" />
                        </div>
                      </Card>
                    ))}

                    <Button type="button" variant="outline" className="w-full h-11 gap-2" disabled={savingEdit} onClick={addEditingExercise}>
                      <Plus className="w-4 h-4" />Add Exercise
                    </Button>
                  </div>

                  <div className="p-4 border-t border-border flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" disabled={savingEdit} onClick={closeWorkoutEditor}>Cancel</Button>
                    <Button type="button" className="flex-1 gap-2" disabled={savingEdit} onClick={saveWorkoutEdits}>
                      {savingEdit ? (
                        <><span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />Saving...</>
                      ) : (
                        <><Save className="w-4 h-4" />Save Changes</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {canEditWorkouts && (
        <Card className="p-4 border-accent/20 bg-accent/5">
          <div className="flex items-start gap-3">
            <TrendingDown className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="font-heading font-bold text-sm">Adaptive Programming</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Your workout edits are remembered. Repeated changes help Kael understand your exercise preferences, volume, rep ranges, and recovery needs so future programs can become more personalized.</p>
            </div>
          </div>
        </Card>
      )}

      {!canEditWorkouts && (
        <Card className="p-4 border-primary/20 bg-primary/5">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-heading font-bold text-sm">Want to customize your workouts?</p>
              <p className="text-xs text-muted-foreground mt-1">Progress+ lets you edit your workouts and teaches Kael from the changes you make.</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => navigate('/profile')}>Upgrade to Progress+</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
