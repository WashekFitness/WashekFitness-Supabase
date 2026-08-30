import {
  Check,
  Zap,
  Crown,
  Flame,
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


const APP_URL =
  window.location.origin;


const plans = [
  {
    name:
      'Progress',

    planKey:
      'progress',

    paymentLink:
      `https://buy.stripe.com/test_9B67sN50m2Qu3N19j1g3600?client_reference_id=progress&success_url=${encodeURIComponent(
        APP_URL +
          '/subscription-return?plan=progress'
      )}`,

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

      /*
       * Wording updated only.
       * No functionality changed.
       */
      'Food & package scan',

      'Advanced macro tracking',
      'Save & compare progress photos',
    ],
  },


  {
    name:
      'Performance',

    planKey:
      'performance',

    paymentLink:
      `https://buy.stripe.com/test_7sY14p1Oa9eS97l0Mvg3601?client_reference_id=performance&success_url=${encodeURIComponent(
        APP_URL +
          '/subscription-return?plan=performance'
      )}`,

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

    paymentLink:
      `https://buy.stripe.com/test_dRm00l9gC62G0AP7aTg3602?client_reference_id=elite&success_url=${encodeURIComponent(
        APP_URL +
          '/subscription-return?plan=elite'
      )}`,

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
      'Form Analysis: AI calisthenics form analysis with video',
      'AI form scoring, rep/hold counting & corrective drills',
      'Elite tips & insider coaching secrets from Kael',
      'Deep recovery insights',
      'Fatigue & deload suggestions',
    ],
  },
];


export default function PricingSection() {
  /*
   * Keep the existing pricing behavior intact.
   * This file only changes the displayed Progress
   * feature wording.
   */

  return (
    <section className="space-y-4">

      <div className="text-center">

        <h2 className="
          font-heading
          text-2xl
          font-bold
        ">
          Choose Your Plan
        </h2>

        <p className="
          text-sm
          text-muted-foreground
          mt-1
        ">
          Pick the level of coaching and analysis
          that fits your training.
        </p>

      </div>


      <div className="
        grid
        gap-4
      ">

        {plans.map(
          (plan) => {

            const Icon =
              plan.icon;

            return (
              <Card
                key={
                  plan.planKey
                }
                className={`
                  relative
                  overflow-hidden
                  border
                  ${plan.borderColor}
                  ${plan.bgColor}
                `}
              >

                <div className="p-5">

                  {/* Header */}

                  <div className="
                    flex
                    items-start
                    justify-between
                    gap-3
                  ">

                    <div className="
                      flex
                      items-center
                      gap-3
                    ">

                      <div className={`
                        w-11
                        h-11
                        rounded-2xl
                        flex
                        items-center
                        justify-center
                        bg-background/50
                      `}>

                        <Icon
                          className={`
                            w-5
                            h-5
                            ${plan.color}
                          `}
                        />

                      </div>


                      <div>

                        <div className="
                          flex
                          items-center
                          gap-2
                        ">

                          <h3 className="
                            font-heading
                            font-bold
                            text-lg
                          ">
                            {
                              plan.name
                            }
                          </h3>


                          {plan.badge && (
                            <Badge
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {
                                plan.badge
                              }
                            </Badge>
                          )}

                        </div>


                        <p className="
                          text-sm
                          text-muted-foreground
                        ">
                          {
                            plan.price
                          }
                          {
                            plan.period
                          }
                        </p>

                      </div>

                    </div>

                  </div>


                  {/* Features */}

                  <div className="
                    mt-5
                    space-y-2
                  ">

                    {plan.features.map(
                      (
                        feature
                      ) => (

                        <div
                          key={
                            feature
                          }
                          className="
                            flex
                            items-start
                            gap-2
                          "
                        >

                          <Check
                            className={`
                              w-4
                              h-4
                              mt-0.5
                              shrink-0
                              ${plan.color}
                            `}
                          />

                          <span className="
                            text-sm
                            text-muted-foreground
                          ">
                            {
                              feature
                            }
                          </span>

                        </div>

                      )
                    )}

                  </div>


                  {/* Disclaimer */}

                  {plan.disclaimer && (
                    <p className="
                      text-[10px]
                      text-muted-foreground
                      mt-4
                    ">
                      {
                        plan.disclaimer
                      }
                    </p>
                  )}


                  {/* Upgrade button */}

                  <Button
                    type="button"
                    className="
                      w-full
                      mt-5
                      h-11
                      font-heading
                      font-semibold
                    "
                  >
                    Get {
                      plan.name
                    }
                  </Button>

                </div>

              </Card>
            );
          }
        )}

      </div>

    </section>
  );
}
