import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseApi } from '@/lib/supabaseApi';
import { Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import { PLAN_HIERARCHY } from '@/lib/subscription';

const PLAN_LABELS = {
  free: 'Free',
  progress: 'Progress',
  performance: 'Performance',
  elite: 'Elite',
};

export default function SubscriptionReturn() {
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading');
  const [planName, setPlanName] = useState('');

  useEffect(() => {
    let cancelled = false;

    const requestedPlan = new URLSearchParams(
      window.location.search
    ).get('plan');

    if (
      !requestedPlan ||
      !PLAN_HIERARCHY.includes(requestedPlan) ||
      requestedPlan === 'free'
    ) {
      navigate('/profile', { replace: true });
      return;
    }

    const waitForWebhook = async () => {
      for (let attempt = 0; attempt < 15; attempt += 1) {
        try {
          const user = await supabaseApi.auth.me();

          if (cancelled) return;

          const actualPlan =
            user?.subscription_plan || 'free';

          setPlanName(
            PLAN_LABELS[actualPlan] || actualPlan
          );

          if (actualPlan === requestedPlan) {
            setStatus('success');

            setTimeout(() => {
              navigate('/profile', { replace: true });
            }, 1800);

            return;
          }
        } catch {
          // Keep polling while Stripe/Supabase finishes propagation.
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 1000)
        );
      }

      if (!cancelled) {
        setStatus('error');
        setPlanName(
          PLAN_LABELS[requestedPlan] || requestedPlan
        );
      }
    };

    waitForWebhook();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      {status === 'loading' && (
        <div className="space-y-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />

          <p className="text-sm text-muted-foreground">
            Confirming your subscription…
          </p>
        </div>
      )}

      {status === 'success' && (
        <div className="space-y-4">
          <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-accent" />
          </div>

          <h1 className="font-heading font-bold text-2xl">
            You're on {planName}!
          </h1>

          <p className="text-muted-foreground text-sm">
            Your subscription has been confirmed and your
            features are unlocked.
          </p>

          <div className="flex items-center justify-center gap-2 text-primary">
            <Zap className="w-4 h-4" />

            <span className="text-sm font-medium">
              Washek Fitness
            </span>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>

          <h1 className="font-heading font-bold text-2xl">
            Subscription confirmation is taking longer than expected
          </h1>

          <p className="text-muted-foreground text-sm">
            Stripe has received your payment, but Washek has
            not finished confirming the subscription yet. Your
            paid plan will not be unlocked until Stripe confirms it.
          </p>

          <button
            className="text-sm text-primary underline"
            onClick={() =>
              navigate('/profile', { replace: true })
            }
          >
            Return to Profile
          </button>
        </div>
      )}
    </div>
  );
}
