import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseApi } from '@/lib/supabaseApi';
import { useQuery } from '@tanstack/react-query';
import DailyWorkoutCard from '@/components/dashboard/DailyWorkoutCard';
import NutritionSummary from '@/components/dashboard/NutritionSummary';
import WeekProgress from '@/components/dashboard/WeekProgress';
import StreakCard from '@/components/dashboard/StreakCard';
import WeeklyUpdate from '@/components/dashboard/WeeklyUpdate';
import PullToRefresh from '@/components/layout/PullToRefresh';
import QuickAccess from '@/components/layout/QuickAccess';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabaseApi.auth.me().then((u) => {
      setUser(u);

      if (!u?.onboarded) {
        navigate('/onboarding');
      }
    });
  }, [navigate]);

  const { data: programs = [] } = useQuery({
    queryKey: ['programs', user?.email],
    queryFn: () =>
      supabaseApi.entities.WorkoutProgram.filter(
        {
          status: 'active',
          created_by: user.email,
        },
        '-created_date',
        1
      ),
    enabled: !!user?.email,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['logs', user?.email],
    queryFn: () =>
      supabaseApi.entities.WorkoutLog.filter(
        {
          created_by: user.email,
        },
        '-date',
        30
      ),
    enabled: !!user?.email,
  });

  const { data: nutrition = [] } = useQuery({
    queryKey: ['nutrition', user?.email],
    queryFn: () =>
      supabaseApi.entities.NutritionEntry.filter(
        {
          created_by: user.email,
        },
        '-date',
        50
      ),
    enabled: !!user?.email,
  });

  const { data: photos = [] } = useQuery({
    queryKey: ['progress-photos', user?.email],
    queryFn: () =>
      supabaseApi.entities.ProgressPhoto.filter(
        {
          created_by: user.email,
        },
        '-date',
        20
      ),
    enabled: !!user?.email,
  });

  const activeProgram = programs[0];

  return (
    <PullToRefresh
      queryKeys={[
        ['programs', user?.email],
        ['logs', user?.email],
        ['nutrition', user?.email],
        ['progress-photos', user?.email],
      ]}
    >
      <div className="px-5 pb-4">
        {/* Greeting / Brand */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <img
              src="/washek-fitness-logo.jpg"
              alt="Washek Fitness"
              className="w-8 h-8 rounded-xl object-contain shrink-0"
            />

            <span className="text-xs font-bold text-primary uppercase tracking-widest font-heading">
              Washek Fitness
            </span>
          </div>

          <h1 className="font-heading text-2xl font-bold">
            Hey,{' '}
            {user?.first_name ||
              user?.full_name?.split(' ')[0] ||
              'Athlete'}{' '}
            👋
          </h1>

          <p className="text-muted-foreground text-sm mt-0.5">
            Let's crush it today.
          </p>
        </div>

        <div className="space-y-4">
          <StreakCard logs={logs} />

          <DailyWorkoutCard
            program={activeProgram}
          />

          <NutritionSummary
            entries={nutrition}
            user={user}
          />

          <WeekProgress logs={logs} />

          <WeeklyUpdate
            logs={logs}
            nutrition={nutrition}
            photos={photos}
            user={user}
            program={activeProgram}
          />

          <QuickAccess />
        </div>
      </div>
    </PullToRefresh>
  );
}
