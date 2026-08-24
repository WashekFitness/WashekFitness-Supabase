import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Check, X, Plus, Trash2 } from 'lucide-react';

/**
 * Shown after AI scans food. Lets the user review/edit macros before saving.
 * For multi-food scans, shows each item editably. User can also add more items.
 */
export default function FoodEditModal({ foods, imageUrl, onConfirm, onCancel }) {
  const [items, setItems] = useState(
    foods.map(f => ({ ...f, image_url: imageUrl }))
  );

  const update = (idx, field, value) => {
    setItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, [field]: field === 'food_name' || field === 'serving_size' ? value : (parseFloat(value) || 0) } : item
    ));
  };

  const addItem = () => {
    setItems(prev => [...prev, { food_name: '', serving_size: '1 serving', calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, image_url: imageUrl }]);
  };

  const removeItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const totalCals = items.reduce((s, i) => s + (i.calories || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between px-5 safe-top pb-4 border-b border-border">
        <div>
          <h2 className="font-heading font-bold text-lg">Review Scan</h2>
          <p className="text-xs text-muted-foreground">Edit anything the AI got wrong</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {items.map((item, idx) => (
          <Card key={idx} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Item {idx + 1}</p>
              {items.length > 1 && (
                <button onClick={() => removeItem(idx)} className="text-destructive hover:opacity-70">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div>
              <p className="text-[11px] text-muted-foreground mb-1">Food Name</p>
              <Input
                value={item.food_name}
                onChange={e => update(idx, 'food_name', e.target.value)}
                className="h-9 text-sm"
                placeholder="e.g. Grilled Chicken Breast"
              />
            </div>

            <div>
              <p className="text-[11px] text-muted-foreground mb-1">Serving Size</p>
              <Input
                value={item.serving_size || ''}
                onChange={e => update(idx, 'serving_size', e.target.value)}
                className="h-9 text-sm"
                placeholder="e.g. 1 cup, 150g"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Calories</p>
                <Input
                  type="number"
                  value={item.calories || ''}
                  onChange={e => update(idx, 'calories', e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Protein (g)</p>
                <Input
                  type="number"
                  value={item.protein_g || ''}
                  onChange={e => update(idx, 'protein_g', e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Carbs (g)</p>
                <Input
                  type="number"
                  value={item.carbs_g || ''}
                  onChange={e => update(idx, 'carbs_g', e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Fat (g)</p>
                <Input
                  type="number"
                  value={item.fat_g || ''}
                  onChange={e => update(idx, 'fat_g', e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </Card>
        ))}

        <Button variant="outline" size="sm" className="w-full gap-2" onClick={addItem}>
          <Plus className="w-4 h-4" /> Add Another Item
        </Button>
      </div>

      <div className="px-5 pb-8 pt-3 border-t border-border bg-card">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="font-heading font-bold">{Math.round(totalCals)} kcal · {items.length} item{items.length !== 1 ? 's' : ''}</p>
        </div>
        <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
          ⚠️ AI estimates are approximate and may not be 100% accurate. Portion sizes, cooking methods, and brand differences can affect values. Always verify with a nutrition label if precision matters.
        </p>
        <Button
          className="w-full h-12 font-heading font-semibold gap-2"
          onClick={() => onConfirm(items.filter(i => i.food_name?.trim()))}
          disabled={!items.some(i => i.food_name?.trim())}
        >
          <Check className="w-4 h-4" /> Save to Log
        </Button>
      </div>
    </div>
  );
}