import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Zap, Layers, TrendingDown, Target, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const key = weekType.toLowerCase();
  return weekTypeConfig[key] || { label: weekType, color: 'bg-muted text-muted-foreground border-border', icon: Target };
}

function WorkoutTypeTag({ workoutType }) {
  const lower = (workoutType || '').toLowerCase();
  let color = 'bg-muted/60 text-muted-foreground';
  if (lower.includes('intensity') || lower.includes('neural') || lower.includes('strength')) color = 'bg-chart-4/10 text-chart-4';
  else if (lower.includes('volume') || lower.includes('hypertrophy')) color = 'bg-primary/10 text-primary';
  else if (lower.includes('skill') || lower.includes('recovery') || lower.includes('active') || lower.includes('deload')) color = 'bg-accent/10 text-accent';
  return <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', color)}>{workoutType}</span>;
}

export default function WeeklyPlan({ program, onLogWorkout }) {
  const navigate = useNavigate();
  const [selectedWeek, setSelectedWeek] = useState(program?.current_week || 1);

  const allWeeks = program?.microcycles || [];
  const totalWeeks = program?.duration_weeks || allWeeks.length || 12;
  const currentMicrocycle = allWeeks.find(m => m.week_number === selectedWeek);
  const currentWeek = program?.current_week || 1;
  const isFutureWeek = selectedWeek > currentWeek;

  // Determine which mesocycle this week belongs to
  const mesocycleName = program?.mesocycles?.[currentMicrocycle?.mesocycle_index]?.name;
  const weekTypeCfg = getWeekTypeConfig(currentMicrocycle?.week_type);
  const WeekTypeIcon = weekTypeCfg?.icon;

  return (
    <div className="space-y-4">
      {/* Week selector */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          disabled={selectedWeek <= 1}
          onClick={() => setSelectedWeek(w => w - 1)}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="text-center flex-1">
          <div className="flex items-center justify-center gap-2">
            <p className="font-heading font-bold text-lg">Week {selectedWeek}</p>
            {selectedWeek === currentWeek && (
              <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-semibold border border-primary/20">Current</span>
            )}
            {isFutureWeek && (
              <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                <Eye className="w-2.5 h-2.5" />Preview
              </span>
            )}
          </div>
          <div className="flex items-center justify-center gap-2 mt-0.5">
            {mesocycleName && <p className="text-xs text-muted-foreground">{mesocycleName}</p>}
            {weekTypeCfg && (
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', weekTypeCfg.color)}>
                {weekTypeCfg.label}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          disabled={selectedWeek >= totalWeeks}
          onClick={() => setSelectedWeek(w => w + 1)}
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Progress bar across weeks */}
      <div className="flex gap-0.5 items-end h-4">
        {Array.from({ length: totalWeeks }, (_, i) => {
          const wk = i + 1;
          const micro = allWeeks.find(m => m.week_number === wk);
          const isDeload = micro?.week_type?.toLowerCase().includes('deload') || micro?.week_type?.toLowerCase().includes('taper');
          const isPast = wk < currentWeek;
          const isCurrent = wk === currentWeek;
          const isSelected = wk === selectedWeek;
          return (
            <button
              key={wk}
              onClick={() => setSelectedWeek(wk)}
              className={cn(
                'flex-1 rounded-sm transition-all',
                isDeload ? 'h-2' : 'h-4',
                isSelected ? 'bg-primary' : isPast ? 'bg-primary/40' : isCurrent ? 'bg-primary/70' : 'bg-muted/60',
                'hover:opacity-80'
              )}
              title={`Week ${wk}${micro?.week_type ? ` — ${micro.week_type}` : ''}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground -mt-2 px-0.5">
        <span>Wk 1</span>
        <span className="text-center">Wk {Math.ceil(totalWeeks / 2)}</span>
        <span>Wk {totalWeeks}</span>
      </div>

      {/* No data state for future weeks that weren't generated */}
      {!currentMicrocycle && (
        <Card className="p-6 text-center border-dashed">
          <Eye className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
          <p className="font-heading font-bold text-sm">Week {selectedWeek} Not Yet Generated</p>
          <p className="text-xs text-muted-foreground mt-1">
            This week's plan will be personalized based on your live workout performance in earlier weeks.
          </p>
        </Card>
      )}

      {/* Future week notice */}
      {currentMicrocycle && isFutureWeek && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/60">
          <Eye className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground/70">Estimated plan.</span> These workouts are your projected baseline. Live workout tracking will dynamically adjust difficulty, reps, and progressions based on your actual performance.
          </p>
        </div>
      )}

      {/* Days */}
      {currentMicrocycle && (
        <div className="space-y-2">
          {currentMicrocycle.days?.map((day, i) => {
            const isRestDay = !day.exercises || day.exercises.length === 0;
            return (
              <Card
                key={i}
                className={cn(
                  'p-4 transition-all',
                  isRestDay
                    ? 'opacity-60 border-dashed cursor-default'
                    : 'cursor-pointer hover:border-primary/40 active:scale-[0.98]',
                  isFutureWeek && !isRestDay && 'border-border/60'
                )}
                onClick={() => !isRestDay && navigate("/program/day/" + i, { state: { week: selectedWeek } })}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold">{day.day_name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {day.workout_type && <WorkoutTypeTag workoutType={day.workout_type} />}
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    {isRestDay ? (
                      <p className="text-xs text-muted-foreground font-medium">Rest</p>
                    ) : (
                      <>
                        <p className="text-sm font-medium">{day.exercises?.length || 0} exercises</p>
                        <p className="text-xs text-muted-foreground">~{Math.round((day.exercises?.length || 0) * 4.5)} min</p>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}