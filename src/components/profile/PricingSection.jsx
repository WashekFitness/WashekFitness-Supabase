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
import { toast } from 'sonner';

/*
 * These are the Stripe Payment Links that were already
 * working before the recent checkout changes.
 *
 * We are deliberately going back to these for upgrades.
 * No new checkout/session logic is used here.
 */
const PAYMENT_LINKS = {
  progress:
    'https://buy.stripe.com/test_9B67sN50m2Qu3N19j1g3600',

  performance:
    'https://buy.stripe.com/test_7sY14p1Oa9eS97l0Mvg3601',

  elite:
    'https://buy.stripe.com/test_dRm00l9gC62G0AP7aTg3602',
};

const plans = [
  {
    name: 'Progress',
    planKey: 'progress',
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

const PLAN_LABELS = {
  free: 'Free',
  progress: 'Progress',
  performance: 'Performance',
  elite: 'Elite',
};

export default function PricingSection() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [canceling, setCanceling] = useState(false);

  /*
   * Load the real current user here.
   *
   * This means PricingSection works even if Profile.jsx
   * doesn't pass user props.
   */
  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const currentUser =
          await supabaseApi.auth.me();

        if (mounted) {
          setUser(currentUser);
        }
      } catch (error) {
        console.error(
          'Unable to load subscription user:',
          error
        );
      } finally {
        if (mounted) {
          setLoadingUser(false);
        }
      }
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  const currentPlan =
    user?.subscription_plan ||
    'free';

  const isPaid =
    [
      'progress',
      'performance',
      'elite',
    ].includes(
      currentPlan
    );

  const handleCancel = async () => {
    if (
      !user?.id ||
      canceling
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Cancel your ${PLAN_LABELS[currentPlan] || 'paid'} subscription immediately?\n\nYou will be moved to the Free Plan immediately and paid-only features will be removed.`
      );

    if (!confirmed) {
      return;
    }

    setCanceling(true);

    try {
      const result =
        await supabaseApi.subscription.cancel();

      /*
       * Update the local component immediately.
       */
      const updatedUser = {
        ...(result?.user || user),

        subscription_plan:
          'free',

        subscription_status:
          'canceled',

        stripe_subscription_id:
          null,
      };

      setUser(updatedUser);

      toast.success(
        'Your subscription has been cancelled. You are now on the Free Plan.'
      );

      /*
       * Give the rest of the application the new state.
       * A full reload is intentional here because other parts
       * of Washek may be using the user's subscription state
       * to gate paid features.
       */
      setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (error) {
      console.error(
        'Unable to cancel subscription:',
        error
      );

      toast.error(
        error?.message ||
          'Unable to cancel your subscription. Please try again.'
      );
    } finally {
      setCanceling(false);
    }
  };

  return (
    <div className="space-y-4">

      {/* =====================================================
          CURRENT PAID SUBSCRIPTION
          ===================================================== */}

      {isPaid && (
        <Card className="p-4 border-destructive/25 bg-destructive/5">

          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-destructive" />

            <span className="font-heading font-bold text-sm">
              Cancel Subscription
            </span>
          </div>

          <p className="text-xs text-muted-foreground mb-3">
            Cancel your{' '}
            <span className="font-semibold text-foreground">
              {PLAN_LABELS[currentPlan]}
            </span>{' '}
            subscription immediately.
            Your account will return to the
            Free Plan and paid-only features
            will be removed right away.
          </p>

          <Button
            type="button"
            variant="outline"
            className="w-full text-destructive border-destructive/30 hover:text-destructive hover:bg-destructive/5"
            onClick={handleCancel}
            disabled={
              canceling ||
              loadingUser
            }
          >
            {canceling ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4 mr-2" />
            )}

            {canceling
              ? 'Cancelling…'
              : 'Cancel Subscription'}
          </Button>

        </Card>
      )}

      {/* =====================================================
          PLAN OPTIONS
          ===================================================== */}

      <div className="flex items-center gap-2 pt-2">

        <Crown className="w-4 h-4 text-chart-4" />

        <h3 className="font-heading font-bold text-sm text-muted-foreground uppercase tracking-wider">
          {isPaid
            ? 'Change Your Plan'
            : 'Upgrade Your Plan'}
        </h3>

      </div>

      <p className="text-xs text-muted-foreground -mt-2 mb-3">
        {isPaid
          ? 'Choose another plan to change your subscription.'
          : 'Unlock more of the Washek experience.'}
      </p>

      {plans.map((plan) => {
        const Icon = plan.icon;

        const isCurrent =
          currentPlan ===
          plan.planKey;

        return (
          <Card
            key={plan.planKey}
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

              {plan.features.map(
                (feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm"
                  >
                    <Check className="w-3.5 h-3.5 mt-0.5 text-accent flex-shrink-0" />

                    <span>
                      {feature}
                    </span>
                  </li>
                )
              )}

            </ul>

            {plan.disclaimer && (
              <p className="text-[10px] text-muted-foreground italic mb-3">
                {plan.disclaimer}
              </p>
            )}

            {isCurrent ? (
              <Button
                type="button"
                className="w-full h-10 font-heading font-semibold"
                variant="secondary"
                disabled
              >
                Current Plan
              </Button>
            ) : (
              <Button
                type="button"
                className="w-full h-10 font-heading font-semibold"
                variant="outline"
                onClick={() => {
                  /*
                   * Restore the original working Stripe
                   * Payment Link behavior.
                   *
                   * Same tab — no target="_blank".
                   */
                  window.location.href =
                    PAYMENT_LINKS[
                      plan.planKey
                    ];
                }}
              >
                {isPaid
                  ? plan.planKey ===
                    'progress'
                    ? 'Switch to Progress'
                    : plan.planKey ===
                      'performance'
                      ? 'Switch to Performance'
                      : 'Switch to Elite'
                  : `Get ${plan.name}`}
              </Button>
            )}

          </Card>
        );
      })}

      <p className="text-[10px] text-muted-foreground text-center">
        Paid plans are billed monthly.
        Cancellation is immediate.
      </p>

    </div>
  );
}
