import { useState } from 'react';

import {
  Check,
  Zap,
  Crown,
  Flame,
  Loader2
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
      'Food scan & barcode tracking',
      'Advanced macro tracking',
      'Save & compare progress photos'
    ]
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
      'Workout analytics dashboard'
    ],

    disclaimer:
      '* AI body fat estimates are approximations only and may not be fully accurate.'
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
      'Deep recovery & deload guidance'
    ]
  }
];


export default function PricingSection() {
  const [loadingPlan, setLoadingPlan] = useState(null);

  const startCheckout = async (planKey) => {
    if (loadingPlan) {
      return;
    }

    setLoadingPlan(planKey);

    try {
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        window.location.assign('/login');
        return;
      }

      const {
        data,
        error
      } = await supabase.functions.invoke(
        'create-checkout-session',
        {
          body: {
            plan: planKey
          }
        }
      );

      if (error) {
        throw error;
      }

      if (data?.success === false) {
        throw new Error(
          data.error ||
          'Unable to start checkout.'
        );
      }

      if (data?.mode === 'already_on_plan') {
        window.location.assign(
          '/subscription-return?status=already-active'
        );
        return;
      }

      if (data?.mode === 'upgrade') {
        window.location.assign(
          `/subscription-return?plan=${encodeURIComponent(
            planKey
          )}&upgraded=1`
        );
        return;
      }

      if (!data?.url) {
        throw new Error(
          'Stripe did not return a checkout URL.'
        );
      }

      window.location.assign(data.url);

    } catch (error) {
      console.error(
        '[PRICING] Checkout failed:',
        error
      );

      window.alert(
        error?.message ||
        'Unable to start checkout. Please try again.'
      );

    } finally {
      setLoadingPlan(null);
    }
  };


  return (
    <div className="space-y-4">

      <div className="flex items-center gap-2 mb-1">
        <Crown className="w-4 h-4 text-chart-4" />

        <h3 className="font-heading font-bold text-sm text-muted-foreground uppercase tracking-wider">
          Upgrade Your Plan
        </h3>
      </div>


      <p className="text-xs text-muted-foreground -mt-2 mb-3">
        Live Workout tracking is free for everyone.
        Paid plans unlock more AI usage and personalization.
      </p>


      {plans.map((plan) => {
        const Icon = plan.icon;
        const loading = loadingPlan === plan.planKey;

        return (
          <Card
            key={plan.name}
            className={
              `p-4 border-2 ${plan.borderColor} ` +
              `${plan.bgColor} relative`
            }
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
                  className={
                    `font-heading font-bold text-xl ${plan.color}`
                  }
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
              onClick={() =>
                startCheckout(plan.planKey)
              }
              disabled={loadingPlan !== null}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Opening Stripe…
                </span>
              ) : (
                `Get ${plan.name}`
              )}
            </Button>

          </Card>
        );
      })}


      <p className="text-[10px] text-muted-foreground text-center">
        Cancel anytime. Billed monthly.
      </p>

    </div>
  );
}
