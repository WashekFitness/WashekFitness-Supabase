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

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { supabase } from '@/lib/supabase';


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
      'Full custom workout adjustments',
      'Adaptive programming — Kael learns from your workout edits',
      'Food & package scan',
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
      'Everything in Progress',
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
      'Everything in Performance',
      'Enhanced real-time workout adjustments',
      'AI calisthenics form analysis with video',
      'AI form scoring, rep/hold counting & corrective drills',
      'Elite tips & insider coaching secrets',
      'Deep recovery & deload guidance',
    ],
  },
];


const PAID_PLANS = [
  'progress',
  'performance',
  'elite',
];


export default function PricingSection() {
  const [
    loadingPlan,
    setLoadingPlan,
  ] = useState(null);


  const [
    cancelling,
    setCancelling,
  ] = useState(false);


  const [
    currentPlan,
    setCurrentPlan,
  ] = useState('free');


  const [
    subscription,
    setSubscription,
  ] = useState(null);


  const [
    error,
    setError,
  ] = useState('');


  useEffect(() => {
    let active = true;

    const loadSubscription =
      async () => {
        try {
          const {
            data: {
              user,
            },
          } =
            await supabase.auth.getUser();

          if (
            !user ||
            !active
          ) {
            return;
          }

          const {
            data,
            error:
              subscriptionError,
          } =
            await supabase
              .from(
                'stripe_subscriptions'
              )
              .select('*')
              .eq(
                'user_id',
                user.id
              )
              .maybeSingle();

          if (
            subscriptionError
          ) {
            console.error(
              '[PricingSection] Subscription lookup failed:',
              subscriptionError
            );

            return;
          }

          if (!active) {
            return;
          }

          setSubscription(
            data || null
          );

          const plan =
            data?.plan ||
            data?.plan_key ||
            'free';

          setCurrentPlan(
            PAID_PLANS.includes(
              plan
            )
              ? plan
              : 'free'
          );
        } catch (
          subscriptionError
        ) {
          console.error(
            '[PricingSection] Failed to load subscription:',
            subscriptionError
          );
        }
      };

    loadSubscription();

    return () => {
      active = false;
    };
  }, []);


  const handleCheckout =
    async (
      plan
    ) => {
      if (
        !plan?.planKey ||
        loadingPlan
      ) {
        return;
      }

      setError('');
      setLoadingPlan(
        plan.planKey
      );

      try {
        const {
          data: {
            user,
          },
        } =
          await supabase.auth.getUser();

        if (!user) {
          throw new Error(
            'Please sign in before upgrading your plan.'
          );
        }

        const {
          data,
          error:
            functionError,
        } =
          await supabase.functions.invoke(
            'create-checkout-session',
            {
              body: {
                plan:
                  plan.planKey,
              },
            }
          );

        if (
          functionError
        ) {
          throw functionError;
        }

        if (
          data?.url
        ) {
          window.location.href =
            data.url;

          return;
        }

        throw new Error(
          'Unable to start checkout.'
        );
      } catch (
        checkoutError
      ) {
        console.error(
          '[PricingSection] Checkout failed:',
          checkoutError
        );

        setError(
          checkoutError?.message ||
            'Unable to start checkout.'
        );

        setLoadingPlan(
          null
        );
      }
    };


  const handleCancel =
    async () => {
      if (
        cancelling
      ) {
        return;
      }

      setCancelling(
        true
      );

      setError('');

      try {
        const {
          data,
          error:
            functionError,
        } =
          await supabase.functions.invoke(
            'cancel-subscription',
            {
              body: {},
            }
          );

        if (
          functionError
        ) {
          throw functionError;
        }

        if (
          data?.error
        ) {
          throw new Error(
            data.error
          );
        }

        setSubscription(
          (
            previous
          ) =>
            previous
              ? {
                  ...previous,
                  cancel_at_period_end:
                    true,
                }
              : previous
        );
      } catch (
        cancelError
      ) {
        console.error(
          '[PricingSection] Cancellation failed:',
          cancelError
        );

        setError(
          cancelError?.message ||
            'Unable to cancel your subscription.'
        );
      } finally {
        setCancelling(
          false
        );
      }
    };


  return (
    <div className="space-y-4">

      {error && (
        <div className="
          flex
          items-start
          gap-2
          rounded-xl
          border
          border-destructive/30
          bg-destructive/5
          p-3
          text-sm
        ">
          <XCircle
            className="
              mt-0.5
              h-4
              w-4
              shrink-0
              text-destructive
            "
          />

          <span>
            {error}
          </span>
        </div>
      )}


      {currentPlan !== 'free' && (
        <Card className="
          border-primary/30
          bg-primary/5
          p-4
        ">
          <div className="
            flex
            items-center
            justify-between
            gap-3
          ">
            <div>
              <p className="
                font-heading
                font-bold
              ">
                Current plan
              </p>

              <p className="
                text-sm
                text-muted-foreground
              ">
                {currentPlan.charAt(0).toUpperCase() +
                  currentPlan.slice(1)}
              </p>
            </div>

            {subscription?.cancel_at_period_end ? (
              <Badge
                variant="outline"
                className="text-xs"
              >
                Cancels at period end
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={
                  handleCancel
                }
                disabled={
                  cancelling
                }
              >
                {cancelling ? (
                  <>
                    <Loader2
                      className="
                        mr-2
                        h-3.5
                        w-3.5
                        animate-spin
                      "
                    />

                    Cancelling...
                  </>
                ) : (
                  'Cancel'
                )}
              </Button>
            )}
          </div>
        </Card>
      )}


      <div className="
        flex
        items-center
        gap-2
        mb-1
      ">
        <Crown
          className="
            w-4
            h-4
            text-chart-4
          "
        />

        <h3 className="
          font-heading
          font-bold
          text-sm
          text-muted-foreground
          uppercase
          tracking-wider
        ">
          Upgrade Your Plan
        </h3>
      </div>


      <p className="
        text-xs
        text-muted-foreground
        -mt-2
        mb-3
      ">
        Unlock the full Washek experience.
        The Live Workout Tracker is free for
        everyone; Elite adds real-time workout
        adjustments.
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

          return (
            <Card
              key={
                plan.name
              }
              className={`
                p-4
                border-2
                ${plan.borderColor}
                ${plan.bgColor}
                relative
              `}
            >

              {plan.badge && (
                <Badge
                  className="
                    absolute
                    -top-2.5
                    right-4
                    bg-primary
                    text-primary-foreground
                    text-[10px]
                    px-2
                    py-0.5
                  "
                >
                  {plan.badge}
                </Badge>
              )}


              <div className="
                flex
                items-center
                justify-between
                mb-3
              ">
                <div className="
                  flex
                  items-center
                  gap-2
                ">
                  <Icon
                    className={`
                      w-5
                      h-5
                      ${plan.color}
                    `}
                  />

                  <span className="
                    font-heading
                    font-bold
                    text-base
                  ">
                    {plan.name}
                  </span>
                </div>


                <div className="
                  flex
                  items-baseline
                  gap-0.5
                ">
                  <span className={`
                    font-heading
                    font-bold
                    text-xl
                    ${plan.color}
                  `}>
                    {plan.price}
                  </span>

                  <span className="
                    text-xs
                    text-muted-foreground
                  ">
                    {plan.period}
                  </span>
                </div>
              </div>


              <ul className="
                space-y-1.5
                mb-3
              ">
                {plan.features.map(
                  (
                    feature
                  ) => (
                    <li
                      key={
                        feature
                      }
                      className="
                        flex
                        items-start
                        gap-2
                        text-sm
                      "
                    >
                      <Check
                        className="
                          w-3.5
                          h-3.5
                          mt-0.5
                          text-accent
                          flex-shrink-0
                        "
                      />

                      <span>
                        {feature}
                      </span>
                    </li>
                  )
                )}
              </ul>


              {plan.disclaimer && (
                <p className="
                  text-[10px]
                  text-muted-foreground
                  italic
                  mb-3
                ">
                  {plan.disclaimer}
                </p>
              )}


              {isCurrent ? (
                <Button
                  className="
                    w-full
                    h-10
                    font-heading
                    font-semibold
                  "
                  variant="outline"
                  disabled
                >
                  Current Plan
                </Button>
              ) : (
                <Button
                  className="
                    w-full
                    h-10
                    font-heading
                    font-semibold
                  "
                  variant="outline"
                  onClick={() =>
                    handleCheckout(
                      plan
                    )
                  }
                  disabled={
                    !!loadingPlan
                  }
                >
                  {loadingPlan ===
                  plan.planKey ? (
                    <>
                      <Loader2
                        className="
                          mr-2
                          h-4
                          w-4
                          animate-spin
                        "
                      />

                      Loading...
                    </>
                  ) : (
                    `Get ${plan.name}`
                  )}
                </Button>
              )}

            </Card>
          );
        }
      )}


      <p className="
        text-[10px]
        text-muted-foreground
        text-center
      ">
        Cancel anytime. Billed monthly.
      </p>

    </div>
  );
}
