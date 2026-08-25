import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function About() {
  return (
    <div className="px-5 pb-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6 pt-2">
        <Link
          to="/"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <div className="flex items-center gap-2">
          <img
            src="/washek-fitness-logo.jpg"
            alt="Washek Fitness"
            className="w-8 h-8 rounded-xl object-contain"
          />

          <span className="font-heading font-bold text-sm">
            Washek Fitness
          </span>
        </div>
      </div>

      <h1 className="font-heading text-3xl font-bold tracking-tight mb-6">
        About Washek Fitness
      </h1>

      <div className="prose prose-invert max-w-none space-y-4 text-muted-foreground leading-relaxed">
        <p>
          Washek Fitness is an AI-powered training platform designed to help athletes of all levels
          unlock their full physical potential. Whether you train with bodyweight, free weights, or a
          hybrid approach, the app builds fully personalized workout programs tailored to your goals,
          equipment, and experience level.
        </p>

        <p>
          At its core is <span className="text-foreground font-semibold">Kael</span>, an elite AI coach
          who provides real-time guidance, adjusts your programming based on performance feedback, and
          keeps you accountable every step of the way. Beyond training, Washek Fitness delivers
          high-precision nutrition tracking with macro targets and food scanning, so your diet stays
          dialed in alongside your workouts.
        </p>

        <p>
          The Form Lab feature uses AI video analysis to break down your technique rep by rep,
          identifying form faults and prescribing corrective drills. Progress photos with body composition
          estimates and movement baselines ensure you always know exactly where you stand and what to
          improve next.
        </p>

        <p>
          Built by Adrian Washek, a calisthenics athlete who wants to help other people in their own
          fitness journeys, Washek Fitness is for anyone serious about getting stronger, moving better,
          and staying consistent — from beginners taking their first steps to elite athletes chasing
          advanced skills like the planche, front lever, and maltese.
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading font-semibold text-lg mb-3">
          Key Features
        </h2>

        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            • Personalized calisthenics, weightlifting, and hybrid programs
          </li>
          <li>
            • Kael AI coach with persistent memory and plan-aware advice
          </li>
          <li>
            • Precision nutrition tracking with food scanning and macros
          </li>
          <li>
            • AI-powered form analysis via video upload
          </li>
          <li>
            • Progress photos with body composition insights
          </li>
          <li>
            • Movement baseline tracking for all major lifts and holds
          </li>
        </ul>
      </div>
    </div>
  );
}
