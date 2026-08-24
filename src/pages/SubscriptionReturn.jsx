import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseApi } from '@/lib/supabaseApi';
import { Zap, CheckCircle2 } from 'lucide-react';
import { PLAN_HIERARCHY } from '@/lib/subscription';

const PLAN_LABELS = {
  progress: 'Progress',
  performance: 'Performance',
  elite: 'Elite',
};

export default function SubscriptionReturn() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [planName, setPlanName] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const plan = params.get('plan');

    if (!plan || !PLAN_HIERARCHY.includes(plan)) {
      navigate('/profile');
      return;
    }

    setPlanName(PLAN_LABELS[plan] || plan);

    supabaseApi.auth.me().then(async (user) => {
      const currentIdx = PLAN_HIERARCHY.indexOf(user?.subscription_plan || 'free');
      const newIdx = PLAN_HIERARCHY.indexOf(plan);

      // Only upgrade, never downgrade via return URL
      if (newIdx > currentIdx) {
        await supabaseApi.auth.updateMe({ subscription_plan: plan });
      }
      setStatus('success');
      setTimeout(() => navigate('/profile'), 2500);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      {status === 'loading' ? (
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      ) : (
        <div className="space-y-4">
          <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-accent" />
          </div>
          <h1 className="font-heading font-bold text-2xl">You're on {planName}!</h1>
          <p className="text-muted-foreground text-sm">Your features are now unlocked. Taking you back to the app…</p>
          <div className="flex items-center justify-center gap-2 text-primary">
            <Zap className="w-4 h-4" />
            <span className="text-sm font-medium">Washek Fitness</span>
          </div>
        </div>
      )}
    </div>
  );
}