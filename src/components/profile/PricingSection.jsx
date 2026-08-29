import {
  useEffect,
  useState,
} from 'react';

import {
  Check,
  Zap,
  Crown,
  Flame,
  Loader2,
  XCircle,
} from 'lucide-react';

import {
  Button,
} from '@/components/ui/button';

import {
  Card,
} from '@/components/ui/card';

import {
  Badge,
} from '@/components/ui/badge';

import {
  supabaseApi,
} from '@/lib/supabaseApi';

import {
  createStripeCheckout,
} from '@/lib/stripeCheckout';

import {
  toast,
} from 'sonner';

const plans = [
  {
    name:
      'Progress',

    planKey:
      'progress',

    price:
      '$7.99',

    period:
      '/mo',

    icon:
      Flame,

    color:
      'text-accent',

    borderColor:
      'border-accent/30',

    bgColor:
      'bg-accent/5',

    badge:
      null,

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
    name:
      'Performance',

    planKey:
      'performance',

    price:
      '$14.99',

    period:
      '/mo',

    icon:
      Zap,

    color:
      'text-primary',

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
    name:
      'Elite',

    planKey:
      'elite',

    price:
      '$24.99',

    period:
      '/mo',

    icon:
      Crown,

    color:
      'text-chart-4',

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

function getPlanLabel(
  plan
) {
  return (
    PLAN_LABELS[
      plan
    ] ||
    'Paid'
  );
}

export default function PricingSection({
  user:
    suppliedUser,

  onSubscriptionChanged,
}) {
  const [
    user,
    setUser,
  ] =
    useState(
      suppliedUser ||
        null
    );

  const [
    loadingUser,
    setLoadingUser,
  ] =
    useState(
      !suppliedUser
    );

  const [
    checkoutPlan,
    setCheckoutPlan,
  ] =
    useState(
      null
    );

  const [
    canceling,
    setCanceling,
  ] =
    useState(
      false
    );

  /*
   * ==========================================================
   * LOAD USER IF PARENT DIDN'T PROVIDE ONE
   * ==========================================================
   */

  useEffect(() => {
    if (
      suppliedUser
    ) {
      setUser(
        suppliedUser
      );

      setLoadingUser(
        false
      );

      return;
    }

    let mounted =
      true;

    const load =
      async () => {
        try {
          const current =
            await supabaseApi.auth.me();

          if (
            mounted
          ) {
            setUser(
              current
            );
          }
        } catch (
          error
        ) {
          console.error(
            'Unable to load user for pricing:',
            error
          );
        } finally {
          if (
            mounted
          ) {
            setLoadingUser(
              false
            );
          }
        }
      };

    load();

    return () => {
      mounted =
        false;
    };
  }, [
    suppliedUser,
  ]);

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

  /*
   * ==========================================================
   * CHECKOUT
   * ==========================================================
   */

  const handleUpgrade =
    async (
      planKey
    ) => {
      if (
        loadingUser
      ) {
        toast.error(
          'Your account is still loading. Please try again in a moment.'
        );

        return;
      }

      if (
        !user?.id
      ) {
        toast.error(
          'Please sign in before choosing a subscription.'
        );

        return;
      }

      if (
        ![
          'progress',
          'performance',
          'elite',
        ].includes(
          planKey
        )
      ) {
        toast.error(
          'Invalid subscription plan.'
        );

        return;
      }

      if (
        planKey ===
        currentPlan
      ) {
        return;
      }

      if (
        checkoutPlan
      ) {
        return;
      }

      /*
       * ========================================================
       * OPEN THE NEW TAB IMMEDIATELY
       * ========================================================
       */

      const checkoutTab =
        window.open(
          '',
          '_blank'
        );

      if (
        !checkoutTab
      ) {
        toast.error(
          'Your browser blocked the Stripe checkout tab. Please allow pop-ups for Washek Fitness and try again.'
        );

        return;
      }

      /*
       * Temporary loading page.
       */
      try {
        checkoutTab.document.open();

        checkoutTab.document.write(`
          <!doctype html>

          <html>

            <head>

              <meta charset="utf-8">

              <meta
                name="viewport"
                content="width=device-width, initial-scale=1"
              >

              <title>
                Washek Fitness — Checkout
              </title>

              <style>

                html,
                body {
                  margin: 0;
                  padding: 0;
                  min-height: 100%;
                  background: #ffffff;
                  color: #111827;
                  font-family:
                    system-ui,
                    -apple-system,
                    BlinkMacSystemFont,
                    "Segoe UI",
                    sans-serif;
                }

                body {
                  min-height: 100vh;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                }

                .wrapper {
                  width:
                    min(90vw, 560px);

                  padding:
                    32px;

                  text-align:
                    center;
                }

                .spinner {
                  width:
                    38px;

                  height:
                    38px;

                  margin:
                    0 auto 18px;

                  border:
                    4px solid #e5e7eb;

                  border-top-color:
                    #111827;

                  border-radius:
                    50%;

                  animation:
                    spin
                    0.8s
                    linear
                    infinite;
                }

                h1 {
                  margin:
                    0 0 8px;

                  font-size:
                    20px;
                }

                p {
                  margin:
                    0;

                  color:
                    #6b7280;

                  font-size:
                    14px;
                }

                @keyframes spin {

                  from {
                    transform:
                      rotate(0deg);
                  }

                  to {
                    transform:
                      rotate(360deg);
                  }

                }

              </style>

            </head>

            <body>

              <div class="wrapper">

                <div class="spinner"></div>

                <h1>
                  Connecting to Stripe Checkout…
                </h1>

                <p>
                  Please wait.
                </p>

              </div>

            </body>

          </html>
        `);

        checkoutTab.document.close();
      } catch {
        /*
         * Not fatal.
         */
      }

      setCheckoutPlan(
        planKey
      );

      try {
        /*
         * ======================================================
         * ASK BACKEND FOR STRIPE URL
         * ======================================================
         */

        const result =
          await createStripeCheckout(
            planKey
          );

        /*
         * ======================================================
         * CRITICAL:
         *
         * We only require a URL.
         *
         * We DO NOT require result.action because
         * the current backend does not return it.
         * ======================================================
         */

        if (
          result?.url
        ) {
          checkoutTab.location.href =
            result.url;

          return;
        }

        throw new Error(
          'Stripe returned no Checkout URL.'
        );
      } catch (
        error
      ) {
        console.error(
          '[PricingSection] Stripe Checkout failed:',
          error
        );

        /*
         * Keep the original Washek tab open.
         *
         * Close the temporary checkout tab because
         * checkout could not be created.
         */
        try {
          checkoutTab.close();
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
   * CANCEL SUBSCRIPTION
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
          `Cancel your ${getPlanLabel(
            currentPlan
          )} subscription immediately?\n\nYour account will return to the Free Plan immediately and paid-only features will be removed.`
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
          {
            ...(result?.user ||
              user),

            subscription_plan:
              'free',

            subscription_status:
              'canceled',

            stripe_subscription_id:
              null,

            stripe_price_id:
              null,
          };

        setUser(
          updatedUser
        );

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
          '[PricingSection] Cancellation failed:',
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

  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <div className="space-y-4">

      {isPaid && (
        <Card className="p-4 border-destructive/20 bg-destructive/5">

          <div className="flex items-center gap-2 mb-2">

            <XCircle className="w-4 h-4 text-destructive" />

            <span className="font-heading font-bold text-sm">
              Cancel Subscription
            </span>

          </div>

          <p className="text-xs text-muted-foreground mb-3">
            Cancel immediately and return
            to the Free Plan. Paid-only
            features will be removed
            immediately.
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

      <div className="flex items-center gap-2 pt-2">

        <Crown className="w-4 h-4 text-chart-4" />

        <h3 className="font-heading font-bold text-sm text-muted-foreground uppercase tracking-wider">
          {
            isPaid
              ? 'Change Your Plan'
              : 'Upgrade Your Plan'
          }
        </h3>

      </div>

      <p className="text-xs text-muted-foreground -mt-2 mb-3">
        {
          isPaid
            ? 'Choose another plan to change your subscription.'
            : 'Unlock more of the Washek experience.'
        }
      </p>

      {plans.map(
        (
          plan
        ) => {
          const Icon =
            plan.icon;

          const isCurrent =
            currentPlan ===
            plan.planKey;

          const isLoading =
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
                  {
                    plan.badge
                  }
                </Badge>
              )}

              <div className="flex items-center justify-between mb-3">

                <div className="flex items-center gap-2">

                  <Icon
                    className={`w-5 h-5 ${plan.color}`}
                  />

                  <span className="font-heading font-bold text-base">
                    {
                      plan.name
                    }
                  </span>

                </div>

                <div className="flex items-baseline gap-0.5">

                  <span
                    className={`font-heading font-bold text-xl ${plan.color}`}
                  >
                    {
                      plan.price
                    }
                  </span>

                  <span className="text-xs text-muted-foreground">
                    {
                      plan.period
                    }
                  </span>

                </div>

              </div>

              <ul className="space-y-1.5 mb-3">

                {plan.features.map(
                  (
                    feature
                  ) => (
                    <li
                      key={
                        feature
                      }
                      className="flex items-start gap-2 text-sm"
                    >

                      <Check className="w-3.5 h-3.5 mt-0.5 text-accent flex-shrink-0" />

                      <span>
                        {
                          feature
                        }
                      </span>

                    </li>
                  )
                )}

              </ul>

              {plan.disclaimer && (
                <p className="text-[10px] text-muted-foreground italic mb-3">
                  {
                    plan.disclaimer
                  }
                </p>
              )}

              {isCurrent ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full h-10 font-heading font-semibold"
                  disabled
                >
                  Current Plan
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 font-heading font-semibold"
                  onClick={() =>
                    handleUpgrade(
                      plan.planKey
                    )
                  }
                  disabled={
                    loadingUser ||
                    checkoutPlan !==
                      null ||
                    canceling
                  }
                >
                  {isLoading ? (
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
