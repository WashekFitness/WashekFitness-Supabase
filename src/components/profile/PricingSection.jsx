import { Check, Zap, Crown, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const APP_URL = window.location.origin;

const plans = [
  {
    name: 'Progress',
    planKey: 'progress',
    paymentLink: `https://buy.stripe.com/test_9B67sN50m2Qu3N19j1g3600?client_reference_id=progress&success_url=${encodeURIComponent(APP_URL + '/subscription-return?plan=progress')}`,
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
      'Adaptive programming — Kael learns from your workout edits',
      'Food scan & barcode tracking',
      'Advanced macro tracking',
      'Save & compare progress photos',
    ],
  },
  {
    name: 'Performance',
    planKey: 'performance',
    paymentLink: `https://buy.stripe.com/test_7sY14p1Oa9eS97l0Mvg3601?client_reference_id=performance&success_url=${encodeURIComponent(APP_URL + '/subscription-return?plan=performance')}`,
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
    disclaimer: '* AI body fat estimates are approximations only and may not be fully accurate.',
  },
  {
    name: 'Elite',
    planKey: 'elite',
    paymentLink: `https://buy.stripe.com/test_dRm00l9gC62G0AP7aTg3602?client_reference_id=elite&success_url=${encodeURIComponent(APP_URL + '/subscription-return?plan=elite')}`,
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
      'Form Analysis: AI calisthenics form analysis with video',
      'AI form scoring, rep/hold counting & corrective drills',
      'Elite tips & insider coaching secrets from Kael',
      'Deep recovery insights',
      'Fatigue & deload suggestions',
    ],
  },
];

export default function PricingSection() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Crown className="w-4 h-4 text-chart-4" />
        <h3 className="font-heading font-bold text-sm text-muted-foreground uppercase tracking-wider">
          Upgrade Your Plan
        </h3>
      </div>

      <p className="text-xs text-muted-foreground -mt-2 mb-3">
        Unlock the full Washek experience. The Live Workout Tracker is free for everyone; Elite adds real-time program adjustments.
      </p>

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
                <Icon className={`w-5 h-5 ${plan.color}`} />
                <span className="font-heading font-bold text-base">
                  {plan.name}
                </span>
              </div>

              <div className="flex items-baseline gap-0.5">
                <span className={`font-heading font-bold text-xl ${plan.color}`}>
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

      <p className="text-[10px] text-muted-foreground text-center">
        Cancel anytime. Billed monthly.
      </p>
    </div>
  );
}
