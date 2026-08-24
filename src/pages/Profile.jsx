import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseApi } from '@/lib/supabaseApi';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Dumbbell, Target, RefreshCw, LogOut, Zap, Trash2 } from 'lucide-react';
import AppSettingsModal from '@/components/AppSettingsModal';
import ExpandableText from '@/components/ExpandableText';
import { toast } from 'sonner';
import PricingSection from '@/components/profile/PricingSection';
import QuickAccess from '@/components/layout/QuickAccess';
import { computeStats } from '@/lib/messageLimit';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    supabaseApi.auth.me().then(setUser);
  }, []);

  const { data: programs = [] } = useQuery({
    queryKey: ['programs', user?.email],
    queryFn: () => supabaseApi.entities.WorkoutProgram.filter({ status: 'active', created_by: user.email }, '-created_date', 1),
    enabled: !!user?.email,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['logs', user?.email],
    queryFn: () => supabaseApi.entities.WorkoutLog.filter({ created_by: user.email }, '-date', 999),
    enabled: !!user?.email,
  });

  const activeProgram = programs[0];
  const plan = user?.subscription_plan || 'free';
  const stats = user ? computeStats(user, plan) : null;

  const planLabels = { free: 'Free', progress: 'Progress', performance: 'Performance', elite: 'Elite' };
  const planColors = {
    free: 'bg-muted text-muted-foreground',
    progress: 'bg-accent/15 text-accent',
    performance: 'bg-primary/15 text-primary',
    elite: 'bg-chart-4/15 text-chart-4',
  };

  const handleRegenerate = async () => {
    if (!user?.fitness_level || !user?.primary_goal) {
      navigate('/onboarding');
      return;
    }
    setRegenerating(true);
    try {
      if (activeProgram) {
        await supabaseApi.entities.WorkoutProgram.update(activeProgram.id, { status: 'completed' });
      }
      navigate('/onboarding');
    } finally {
      setRegenerating(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await supabaseApi.auth.updateMe({ deleted: true });
      await supabaseApi.auth.logout();
    } catch (err) {
      toast.error('Failed to delete account. Please try again.');
    }
  };

  return (
    <div className="px-5 safe-bottom space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Profile</h1>
        <AppSettingsModal />
      </div>

      {/* User card */}
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
            <User className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="font-heading font-bold text-lg">{user?.full_name || 'Athlete'}</h2>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <Badge className={`mt-1 border-0 text-xs ${planColors[plan]}`}>
              {planLabels[plan]} Plan
            </Badge>
          </div>
        </div>

        {/* Message usage */}
        {stats && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> Kael Messages
              </span>
              <span className="text-xs font-semibold">{stats.used} / {stats.limit}</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${stats.remaining === 0 ? 'bg-destructive' : 'bg-primary'}`}
                style={{ width: `${Math.min((stats.used / stats.limit) * 100, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">{stats.remaining} messages remaining · resets monthly</p>
          </div>
        )}
      </Card>

      {/* Training Profile */}
      <Card className="p-4">
        <h3 className="font-heading font-bold text-sm mb-3 text-muted-foreground uppercase tracking-wider">Training Profile</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Level</span>
            </div>
            <span className="text-sm font-medium capitalize">{user?.fitness_level || '—'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Primary Goal</span>
            </div>
            <div className="pl-6">
              <ExpandableText text={user?.primary_goal} limit={80} className="text-sm font-medium text-foreground/80" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Total Workouts</span>
            </div>
            <span className="text-sm font-medium">{logs.length}</span>
          </div>
        </div>
      </Card>

      {/* Active Program */}
      {activeProgram && (
        <Card className="p-4">
          <h3 className="font-heading font-bold text-sm mb-3 text-muted-foreground uppercase tracking-wider">Active Program</h3>
          <p className="font-heading font-bold">{activeProgram.program_name}</p>
          <p className="text-sm text-muted-foreground mt-1">Week {activeProgram.current_week} of {activeProgram.duration_weeks}</p>
          <div className="w-full h-2 bg-muted rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${((activeProgram.current_week || 1) / (activeProgram.duration_weeks || 12)) * 100}%` }}
            />
          </div>
        </Card>
      )}

      {/* Quick Access */}
      <QuickAccess />

      {/* Actions */}
      <div className="space-y-2">
        <Button variant="outline" className="w-full h-12 justify-start" onClick={handleRegenerate} disabled={regenerating}>
          <RefreshCw className={`w-4 h-4 mr-3 ${regenerating ? 'animate-spin' : ''}`} />
          Generate New Program
        </Button>
        <Button variant="ghost" className="w-full h-12 justify-start text-destructive hover:text-destructive" onClick={() => supabaseApi.auth.logout()}>
          <LogOut className="w-4 h-4 mr-3" />
          Log Out
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" className="w-full h-12 justify-start text-destructive/70 hover:text-destructive hover:bg-destructive/5">
              <Trash2 className="w-4 h-4 mr-3" />
              Delete Account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Account</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete your account and all associated data including your workout programs, logs, nutrition entries, and progress photos. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDeleteAccount}
              >
                Delete My Account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Pricing / Upgrade section */}
      <div className="pt-2">
        <PricingSection />
      </div>
    </div>
  );
}