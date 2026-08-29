import { useState } from 'react';

import {
  Check,
  Zap,
  Crown,
  Flame,
  Loader2,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { supabaseApi } from '@/lib/supabaseApi';
import { createStripeCheckout } from '@/lib/stripeCheckout';
import { toast } from 'sonner';

const plans = [
  {
    name: 'Progress',
    planKey: 'progress',
    price: '$7.99',
    period: '/mo',
    icon: Flame,
    color: 'text-accent',
    borderColor:
      'border-accent/30',
    bgColor:
      'bg-accent/5',
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
    borderColor:
      'border-primary/40',
    bgColor:
      'bg-primary/5',
    badge:
      'Most Popular',

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
    borderColor:
      'border-chart-4/40',
    bgColor:
      'bg-chart-4/5',
    badge:
      'Best',

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
  free:
    'Free',

  progress:
    'Progress',

  performance:
    'Performance',

  elite:
    'Elite',
};

export default function PricingSection({
  user,
  onSubscriptionChanged,
}) {
  const [
    checkoutPlan,
    setCheckoutPlan,
  ] = useState(null);

  const [
    canceling,
    setCanceling,
  ] = useState(false);

  const currentPlan =
    user?.subscription_plan ||
    'free';

  /*
   * ==========================================================
   * UPGRADE / PLAN CHANGE
   * ==========================================================
   */

  const handleUpgrade =
    async (
      planKey
    ) => {
      if (
        !user?.id
      ) {
        toast.error(
          'Please sign in before choosing a subscription.'
        );

        return;
      }

      if (
        planKey ===
        currentPlan
      ) {
        return;
      }

      /*
       * Open the new tab FIRST.
       *
       * This must happen directly inside the
       * click event so browsers do not block it.
       */
      const checkoutWindow =
        window.open(
          'about:blank',
          '_blank'
        );

      if (
        !checkoutWindow
      ) {
        toast.error(
          'Your browser blocked the Stripe checkout tab. Please allow pop-ups for Washek Fitness and try again.'
        );

        return;
      }

      /*
       * Show a simple loading page in the newly
       * opened tab.
       */
      try {
        checkoutWindow.document.title =
          'Washek Fitness — Stripe Checkout';

        checkoutWindow.document.body.innerHTML = `
          <div style="
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #ffffff;
            color: #111827;
          ">
            <div style="
              text-align: center;
              padding: 32px;
            ">
              <div style="
                width: 36px;
                height: 36px;
                border: 3px solid #e5e7eb;
                border-top-color: #111827;
                border-radius: 50%;
                animation: washek-spin 0.8s linear infinite;
                margin: 0 auto 18px;
              "></div>

              <div style="
                font-size: 18px;
                font-weight: 700;
                margin-bottom: 8px;
              ">
                Connecting to Stripe Checkout…
              </div>

              <div style="
                font-size: 14px;
                color: #6b7280;
              ">
                Please wait.
              </div>
            </div>
          </div>

          <style>
            @keyframes washek-spin {
              from {
                transform: rotate(0deg);
              }

              to {
                transform: rotate(360deg);
              }
            }
          </style>
        `;
      } catch {
        /*
         * Some browsers restrict access to the
         * new window's document. That's okay.
         */
      }

      setCheckoutPlan(
        planKey
      );

      try {
        /*
         * Now ask Supabase for the Stripe Checkout URL.
         */
        const result =
          await createStripeCheckout(
            planKey
          );

        /*
         * ====================================================
         * NEW SUBSCRIPTION
         * ====================================================
         */

        if (
          result?.action ===
            'checkout' &&
          result?.url
        ) {
          checkoutWindow.location.href =
            result.url;

          return;
        }

        /*
         * ====================================================
         * EXISTING SUBSCRIPTION CHANGED
         * ====================================================
         */

        if (
          result?.action ===
          'changed'
        ) {
          /*
           * The new plan was changed directly through
           * Stripe. Refresh our user state.
           */
          try {
            const refreshed =
              await supabaseApi.auth.me();

            onSubscriptionChanged?.(
              refreshed
            );
          } catch {
            /*
             * Parent state refresh is optional.
             */
          }

          /*
           * Close the temporary tab because there
           * was no Checkout page to navigate to.
           */
          try {
            checkoutWindow.close();
          } catch {
            // Ignore browser close restrictions.
          }

          toast.success(
            `Your plan is now ${PLAN_LABELS[planKey]}.`
          );

          return;
        }

        throw new Error(
          'Stripe did not provide a valid checkout response.'
        );
      } catch (
        error
      ) {
        console.error(
          'Stripe checkout error:',
          error
        );

        /*
         * Close only the temporary tab created by
         * this failed request.
         */
        try {
          checkoutWindow.close();
        } catch {
          // Ignore browser restrictions.
        }

        toast.error(
          error?.message ||
            'Unable to start Stripe Checkout. Please try again.'
        );
      } finally {
        setCheckoutPlan(
          null
        );
      }
    };

  /*
   * ==========================================================
   * CANCEL
   * ==========================================================
   */

  const handleCancel =
    async () => {
      if (
        !user?.id ||
        canceling
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          `Cancel your ${
            PLAN_LABELS[
              currentPlan
            ] || 'paid'
          } subscription immediately?\n\nYour account will return to the Free Plan immediately and paid-only features will be removed.`
        );

      if (
        !confirmed
      ) {
        return;
      }

      setCanceling(
        true
      );

      try {
        const result =
          await supabaseApi.subscription.cancel();

        const updatedUser =
          result?.user || {
            ...user,

            subscription_plan:
              'free',

            subscription_status:
              'canceled',

            stripe_subscription_id:
              null,

            stripe_price_id:
              null,
          };

        onSubscriptionChanged?.(
          updatedUser
        );

        toast.success(
          'Your subscription has been cancelled. You are now on the Free Plan.'
        );
      } catch (
        error
      ) {
        console.error(
          'Subscription cancellation error:',
          error
        );

        toast.error(
          error?.message ||
            'Unable to cancel your subscription. Please try again.'
        );
      } finally {
        setCanceling(
          false
        );
      }
    };

  const isPaid =
    [
      'progress',
      'performance',
      'elite',
    ].includes(
      currentPlan
    );

  return (
    <div className="space-y-4">

      {/* =====================================================
          CANCEL
          ===================================================== */}

      {isPaid && (
        <Card className="p-4 border-destructive/20 bg-destructive/5">

          <div className="flex items-center gap-2 mb-2">

            <XCircle className="w-4 h-4 text-destructive" />

            <span className="font-heading font-bold text-sm">
              Cancel Subscription
            </span>

          </div>

          <p className="text-xs text-muted-foreground mb-3">
            Cancel immediately and return to
            the Free Plan. Paid AI allowances
            and paid-only features will be
            removed immediately.
          </p>

          <Button
            type="button"
            variant="outline"
            className="w-full text-destructive border-destructive/30 hover:text-destructive"
            onClick={
              handleCancel
            }
            disabled={
              canceling ||
              checkoutPlan !==
                null
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
          PLAN HEADER
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

      {plans.map(
        (plan) => {
          const Icon =
            plan.icon;

          const isCurrent =
            currentPlan ===
            plan.planKey;

          const isCheckingOut =
            checkoutPlan ===
            plan.planKey;

          return (
            <Card
              key={
                plan.planKey
              }
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
                      key={
                        feature
                      }
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
                  onClick={() =>
                    handleUpgrade(
                      plan.planKey
                    )
                  }
                  disabled={
                    checkoutPlan !==
                      null ||
                    canceling
                  }
                >
                  {isCheckingOut ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />

                      Opening Checkout…
                    </>
                  ) : isPaid ? (
                    plan.planKey ===
                    'progress' ? (
                      'Switch to Progress'
                    ) : plan.planKey ===
                      'performance' ? (
                      'Switch to Performance'
                    ) : (
                      'Switch to Elite'
                    )
                  ) : (
                    `Get ${plan.name}`
                  )}
                </Button>
              )}

            </Card>
          );
        }
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        Paid plans are billed monthly.
        Cancellation is immediate.
      </p>

    </div>
  );
}
