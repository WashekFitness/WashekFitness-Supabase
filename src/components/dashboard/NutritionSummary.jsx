import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Flame, Drumstick, Wheat, Droplets } from 'lucide-react';
import { calcNutritionGoals } from '@/lib/nutritionGoals';

export default function NutritionSummary({ entries, user }) {
  const today = new Date().toISOString().split('T')[0];
  const todayEntries = entries.filter(e => e.date === today);

  const totals = todayEntries.reduce((acc, e) => ({
    calories: acc.calories + (e.calories || 0),
    protein: acc.protein + (e.protein_g || 0),
    carbs: acc.carbs + (e.carbs_g || 0),
    fat: acc.fat + (e.fat_g || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const goals = calcNutritionGoals(user);
  const calorieGoal = goals.calories;
  const progress = Math.min((totals.calories / calorieGoal) * 100, 100);

  const macros = [
    { label: 'Protein', value: totals.protein, unit: 'g', icon: Drumstick, color: 'text-primary' },
    { label: 'Carbs', value: totals.carbs, unit: 'g', icon: Wheat, color: 'text-accent' },
    { label: 'Fat', value: totals.fat, unit: 'g', icon: Droplets, color: 'text-chart-4' },
  ];

  return (
    <Link to="/nutrition">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
              <Flame className="w-4 h-4 text-accent" />
            </div>
            <p className="font-heading font-bold">Nutrition</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {totals.calories} / {calorieGoal} kcal
          </p>
        </div>

        <div className="w-full h-2.5 bg-muted rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent to-primary rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {macros.map(({ label, value, unit, icon: Icon, color }) => (
            <div key={label} className="text-center">
              <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
              <p className="font-bold text-sm">{Math.round(value)}{unit}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>
      </Card>
    </Link>
  );
}