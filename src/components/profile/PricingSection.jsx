import { useEffect, useState } from 'react';
import {
  Check,
  Zap,
  Crown,
  Flame,
  XCircle,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { supabaseApi } from '@/lib/supabaseApi';

const APP_URL = window.location.origin;

const PLAN_LABELS = {
  free: 'Free',
  progress: 'Progress',
  performance: 'Performance',
  elite: 'Elite',
};

const plans = [
  {
    name: 'Progress',
    planKey: 'progress',
    paymentLink: `https://buy.stripe.com/test_9B67sN50m2Qu3N19j1g3600?client_reference_id=progress&success_url=${encodeURIComponent(
      APP_URL + '/subscription-return?plan=progress',
    )}`,
    price: '$7.99',
    period: '/mo',
    icon: Flame,
    color: 'text-accent',
    borderColor: 'border-accent/30',
    bgColor: 'bg-accent/5',
    badge: null,
    features: [
      '300 Kael AI messages/month',
      'Smarter, faster AI responses',
      'Full custom workout adjustments',
      'Food scan & barcode tracking',
      'Advanced macro tracking',
      'Save & compare progress photos',
    ],
  },
  {
    name: 'Performance',
    planKey: 'performance',
    paymentLink: `https://buy.stripe.com/test_7sY14p1Oa9eS97l0Mvg3601?client_reference_id=performance&success_url=${encodeURIComponent(
      APP_URL + '/subscription-return?plan=performance',
    )}`,
    price: '$14.99',
    period: '/mo',
    icon: Zap,
    color: 'text-primary',
    borderColor: 'border-primary/40',
    bgColor: 'bg-primary/5',
    badge: 'Most Popular',
    features: [
      '800 Kael AI messages/month',
      'Advanced coaching + progressive overload tracking',
      'Dynamic program adaptation',
      'AI body fat % scanner*',
      'Nutrition insights & suggestions',
      'Workout analytics dashboard',
    ],
    disclaimer:
      '* AI body fat estimates are approximations only and may not be fully accurate.',
  },
  {
    name: 'Elite',
    planKey: 'elite',
    paymentLink: `https://buy.stripe.com/test_dRm00l9gC62G0AP7aTg3602?client_reference_id=elite&success_url=${encodeURIComponent(
      APP_URL + '/subscription-return?plan=elite',
    )}`,
    price: '$24.99',
    period: '/mo',
    icon: Crown,
    color: 'text-chart-4',
    borderColor: 'border-chart-4/40',
    bgColor: 'bg-chart-4/5',
    badge: 'Best',
    features: [
      '2,000 Kael AI messages/month',
      'Highest-level AI, fastest responses',
      'Real-time workout adjustments',
      'Live workout tracker',
      'Form Analysis: AI calisthenics form analysis with video',
      'AI form scoring, rep/hold counting & corrective drills',
      'Elite tips & insider coaching secrets from Kael',
      'Deep recovery insights',
      'Fatigue & deload suggestions',
    ],
  },
];

export default function PricingSection() {
  const [user, setUser] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  useEffect(() => {
    let mounted = true;

    supabaseApi.auth
      .me()
      .then((currentUser) => {
        if (mounted) {
          setUser(currentUser);
        }
      })
      .catch((error) => {
        console.error(
          'Unable to load subscription:',
          error,
        );
      });

    return () => {
      mounted = false;
    };
  }, []);

  const currentPlan =
    user?.subscription_plan || 'free';

  const isPaid =
    currentPlan !== 'free' &&
    ['progress', 'performance', 'elite'].includes(
      currentPlan,
    );

  const cancelSubscription = async () => {
    setCanceling(true);
    setCancelError('');

    try {
      await supabaseApi.subscriptions.cancel();

      /*
       * Immediately update the local user state.
       * This prevents the user from continuing to see
       * paid-plan UI while the rest of the app refreshes.
       */
      const refreshed =
        await supabaseApi.auth.me();

      setUser(refreshed);
      setCancelOpen(false);

      /*
       * Reloading guarantees every feature gate in the
       * application sees Free immediately.
       */
      window.location.reload();
    } catch (error) {
      console.error(
        'Subscription cancellation failed:',
        error,
      );

      setCancelError(
        error?.message ||
          'Unable to cancel your subscription. Please try again.',
      );
    } finally {
      setCanceling(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Crown className="w-4 h-4 text-chart-4" />

        <h3 className="font-heading font-bold text-sm text-muted-foreground uppercase tracking-wider">
          {isPaid
            ? 'Manage Your Plan'
            : 'Upgrade Your Plan'}
        </h3>
      </div>

      <p className="text-xs text-muted-foreground -mt-2 mb-3">
        {isPaid
          ? `You're currently on the ${PLAN_LABELS[currentPlan]} Plan.`
          : 'Unlock the full Washek experience.'}
      </p>

      {isPaid && (
        <Card className="p-4 border-destructive/20 bg-destructive/5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-heading font-bold text-sm">
                {PLAN_LABELS[currentPlan]} Plan
              </p>

              <p className="text-xs text-muted-foreground mt-1">
                Want to return to the Free Plan?
              </p>
            </div>

            <Button
              variant="outline"
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => {
                setCancelError('');
                setCancelOpen(true);
              }}
              disabled={canceling}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancel Plan
            </Button>
          </div>
        </Card>
      )}

      {cancelOpen && (
        <Card className="p-4 border-destructive/40 bg-destructive/5">
          <div className="space-y-3">
            <div>
              <h4 className="font-heading font-bold text-sm">
                Cancel {PLAN_LABELS[currentPlan]}?
              </h4>

              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Your subscription will be canceled
                <strong> immediately</strong>. You will
                immediately move to the Free Plan and
                lose access to paid features and paid
                Kael AI allowances.
              </p>
            </div>

            {cancelError && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                {cancelError}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() =>
                  setCancelOpen(false)
                }
                disabled={canceling}
              >
                Keep My Plan
              </Button>

              <Button
                variant="destructive"
                className="flex-1"
                onClick={cancelSubscription}
                disabled={canceling}
              >
                {canceling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Canceling…
                  </>
                ) : (
                  'Cancel & Go Free'
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {!isPaid && (
        <>
          {plans.map((plan) => {
            const Icon = plan.icon;

            return (
              <Card
                key={plan.name}
                className={`p-4 border-2 ${plan.borderColor} ${plan.bgColor} relative`}
              >
                {plan.badge && (
                  <Badge className="absolute -top-2.5 right-4 bg-primary text-primary-foreground text-[10px] px-2 py-0.5">
                    {plan.badge}
                  </Badge>
                )}

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon
                      className={`w-5 h-5 ${plan.color}`}
                    />

                    <span className="font-heading font-bold text-base">
                      {plan.name}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-0.5">
                    <span
                      className={`font-heading font-bold text-xl ${plan.color}`}
                    >
                      {plan.price}
                    </span>

                    <span className="text-xs text-muted-foreground">
                      {plan.period}
                    </span>
                  </div>
                </div>

                <ul className="space-y-1.5 mb-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm"
                    >
                      <Check className="w-3.5 h-3.5 mt-0.5 text-accent flex-shrink-0" />

                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.disclaimer && (
                  <p className="text-[10px] text-muted-foreground italic mb-3">
                    {plan.disclaimer}
                  </p>
                )}

                <Button
                  className="w-full h-10 font-heading font-semibold"
                  variant="outline"
                  asChild
                >
                  <a
                    href={plan.paymentLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Get {plan.name}
                  </a>
                </Button>
              </Card>
            );
          })}
        </>
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        {isPaid
          ? 'Cancel anytime. Cancellation takes effect immediately.'
          : 'Cancel anytime. Billed monthly.'}
      </p>
    </div>
  );
}
