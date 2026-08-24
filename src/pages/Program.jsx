import { useState, useEffect } from 'react';
import { supabaseApi } from '@/lib/supabaseApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import CycleOverview from '@/components/program/CycleOverview';
import WeeklyPlan from '@/components/program/WeeklyPlan';
import PullToRefresh from '@/components/layout/PullToRefresh';
import { Dumbbell, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { expandMicrocycles } from '@/lib/expandMicrocycles';

export default function Program() {
  const queryClient = useQueryClient();

  const [userEmail, setUserEmail] = useState(null);
  useEffect(() => { supabaseApi.auth.me().then(u => setUserEmail(u?.email)); }, []);

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ['programs', userEmail],
    queryFn: () => supabaseApi.entities.WorkoutProgram.filter({ status: 'active', created_by: userEmail }, '-created_date', 1),
    enabled: !!userEmail,
  });

  const logMutation = useMutation({
    mutationFn: (data) => supabaseApi.entities.WorkoutLog.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      toast.success('Workout logged! Great job 💪');
    },
  });

  const program = programs[0] ? expandMicrocycles(programs[0]) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <Dumbbell className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="font-heading text-xl font-bold mb-2">No Program Yet</h2>
        <p className="text-muted-foreground">Complete the onboarding to generate your personalized program.</p>
      </div>
    );
  }

  return (
    <PullToRefresh queryKeys={[['programs', userEmail], ['logs', userEmail]]}>
    <div className="px-5 pb-4">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">{program.program_name}</h1>
          <p className="text-sm text-muted-foreground">{program.duration_weeks} weeks · {program.fitness_level} level</p>
        </div>
        <Link to="/live-workout">
          <Button size="sm" className="gap-1.5 rounded-xl font-heading font-semibold">
            <Play className="w-3.5 h-3.5" /> Live
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full mb-4 bg-muted/50">
          <TabsTrigger value="weekly" className="flex-1 font-heading">Weekly Plan</TabsTrigger>
          <TabsTrigger value="overview" className="flex-1 font-heading">Cycles</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly">
          <WeeklyPlan
            program={program}
            onLogWorkout={(data) => logMutation.mutate({ ...data, program_id: program.id })}
          />
        </TabsContent>

        <TabsContent value="overview">
          <CycleOverview program={program} />
        </TabsContent>
      </Tabs>
    </div>
    </PullToRefresh>
  );
}