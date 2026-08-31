import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import FoodEditModal from '@/components/nutrition/FoodEditModal';

const mealEmojis = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎',
};

export default function FoodLog({ entries, onDelete }) {
  const queryClient = useQueryClient();
  const [editingEntry, setEditingEntry] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [localEntries, setLocalEntries] = useState(entries || []);

  useEffect(() => {
    setLocalEntries(entries || []);
  }, [entries]);

  const handleEditConfirm = async (foods) => {
    if (!editingEntry || !foods?.length) return;

    const food = foods[0];
    setSavingEdit(true);

    try {
      const { supabaseApi } = await import('@/lib/supabaseApi');

      const updated = await supabaseApi.entities.NutritionEntry.update(
        editingEntry.id,
        {
          food_name: food.food_name,
          serving_size: food.serving_size,
          calories: Number(food.calories) || 0,
          protein_g: Number(food.protein_g) || 0,
          carbs_g: Number(food.carbs_g) || 0,
          fat_g: Number(food.fat_g) || 0,
          meal_type: editingEntry.meal_type || 'snack',
          image_url: food.image_url || editingEntry.image_url || null,
        }
      );

      setLocalEntries((current) =>
        current.map((entry) =>
          entry.id === editingEntry.id
            ? { ...entry, ...updated }
            : entry
        )
      );

      await queryClient.invalidateQueries({
        queryKey: ['nutrition'],
      });

      setEditingEntry(null);
      toast.success('Food entry updated.');
    } catch (error) {
      console.error('[FoodLog] Failed to update food entry:', error);
      toast.error(error?.message || 'Could not update this food entry.');
    } finally {
      setSavingEdit(false);
    }
  };

  const grouped = localEntries.reduce((acc, entry) => {
    const meal = entry.meal_type || 'snack';
    if (!acc[meal]) acc[meal] = [];
    acc[meal].push(entry);
    return acc;
  }, {});

  const mealOrder = ['breakfast', 'lunch', 'dinner', 'snack'];

  if (localEntries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No food logged today.</p>
        <p className="text-xs mt-1">Scan or add your first meal!</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {mealOrder.map(meal => {
          const items = grouped[meal];
          if (!items?.length) return null;

          const mealCalories = items.reduce((sum, e) => sum + (Number(e.calories) || 0), 0);

          return (
            <div key={meal}>
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="font-heading font-bold text-sm capitalize">
                  {mealEmojis[meal]} {meal}
                </p>
                <span className="text-xs text-muted-foreground">{Math.round(mealCalories)} kcal</span>
              </div>
              <div className="space-y-1.5">
                {items.map((entry) => (
                  <Card key={entry.id} className="p-3 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{entry.food_name}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>{entry.calories} kcal</span>
                        <span>P: {entry.protein_g || 0}g</span>
                        <span>C: {entry.carbs_g || 0}g</span>
                        <span>F: {entry.fat_g || 0}g</span>
                      </div>
                    </div>

                    <div className="flex items-center shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditingEntry(entry)}
                        aria-label={`Edit ${entry.food_name || 'food entry'}`}
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onDelete(entry.id)}
                        aria-label={`Delete ${entry.food_name || 'food entry'}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {editingEntry && (
        <FoodEditModal
          foods={[editingEntry]}
          imageUrl={editingEntry.image_url}
          onConfirm={handleEditConfirm}
          onCancel={() => {
            if (!savingEdit) setEditingEntry(null);
          }}
        />
      )}
    </>
  );
}
