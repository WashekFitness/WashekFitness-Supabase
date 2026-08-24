import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, Package, Loader2, Lock } from 'lucide-react';
import { supabaseApi } from '@/lib/supabaseApi';
import { canAccess } from '@/lib/subscription';
import FoodEditModal from './FoodEditModal';

const FOOD_MEMORY_KEY = 'washek_food_memory';

function getFoodMemory() {
  try { return JSON.parse(localStorage.getItem(FOOD_MEMORY_KEY) || '{}'); } catch { return {}; }
}

function saveFoodMemory(foods) {
  const memory = getFoodMemory();
  foods.forEach(f => {
    if (f.food_name?.trim()) {
      memory[f.food_name.toLowerCase().trim()] = {
        calories: f.calories, protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g, serving_size: f.serving_size
      };
    }
  });
  localStorage.setItem(FOOD_MEMORY_KEY, JSON.stringify(memory));
}

function buildMemoryContext() {
  const memory = getFoodMemory();
  const entries = Object.entries(memory);
  if (!entries.length) return '';
  const lines = entries.map(([name, m]) => `- ${name}: ${m.calories}kcal, ${m.protein_g}g protein, ${m.carbs_g}g carbs, ${m.fat_g}g fat (${m.serving_size || 'per serving'})`).join('\n');
  return `\n\nFor reference, here are foods this user has previously logged with their corrected macros — use these as a baseline if you recognize the same food:\n${lines}`;
}

export default function FoodScanner({ onFoodDetected, userPlan = 'free' }) {
  const [scanning, setScanning] = useState(false);
  const [mode, setMode] = useState(null);
  const [pendingFoods, setPendingFoods] = useState(null); // { foods, imageUrl }
  const fileInputRef = useRef(null);

  const handleCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    try {
      const { file_url } = await supabaseApi.storage.uploadFile({ file });

      const result = await supabaseApi.ai.invoke({
        type: 'food_scan',
        prompt: `You are a registered dietitian and precision nutrition expert with deep knowledge of USDA food databases, restaurant portion standards, and culinary preparation methods. Analyze this food photo with extreme accuracy.

Step-by-step analysis:
1. IDENTIFY each distinct food item visible — be specific (e.g. "white jasmine rice" not just "rice", "pan-fried chicken breast" not just "chicken").
2. ESTIMATE portion weight in grams using visual cues: plate size, food density, volume, and typical serving norms.
3. CALCULATE macros using exact database values (USDA/FDA standard):
   - Protein: include ALL protein sources including sauces, dressings, grains
   - Carbs: include NET carbs from all components (rice, bread, vegetables, sauces)
   - Fat: account for cooking oils, dressings, marbling — these are often underestimated
   - Calories: must be mathematically consistent (protein×4 + carbs×4 + fat×9 ≈ total calories)
4. For restaurant or home-cooked meals, add 10-20% to fat estimates as hidden oils in cooking are almost always underreported.
5. If multiple items are on the plate, log EACH separately for maximum accuracy.

Be precise. A person's diet depends on this.${buildMemoryContext()}`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            foods: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  food_name: { type: "string" },
                  serving_size: { type: "string" },
                  calories: { type: "number" },
                  protein_g: { type: "number" },
                  carbs_g: { type: "number" },
                  fat_g: { type: "number" }
                }
              }
            }
          }
        }
      });

      if (result.foods?.length) {
        setPendingFoods({ foods: result.foods, imageUrl: file_url });
      }
    } finally {
      setScanning(false);
      setMode(null);
      e.target.value = '';
    }
  };

  const handleBarcodeCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    try {
      const { file_url } = await supabaseApi.storage.uploadFile({ file });

      const result = await supabaseApi.ai.invoke({
        type: 'food_barcode',
        prompt: `You are a precision nutrition expert. This is a photo of a food product package or nutrition label.

Your task:
1. READ the nutrition facts label directly if visible — transcribe EXACT values as printed. Do not estimate if the label is readable.
2. If the label is partially visible, read what you can and fill the rest from your knowledge of that exact product.
3. If no label is visible but you can identify the product brand and name from the packaging, use your knowledge of that specific product's official nutritional values (from the brand's published data).
4. Use PER SERVING values as listed on the label. If multiple serving sizes are shown, use the standard single serving.
5. Double-check: calories must equal approximately (protein_g × 4) + (carbs_g × 4) + (fat_g × 9). If there's a discrepancy, trust the calorie number on the label and adjust fat (fat is most often rounded down on labels).
6. Include the full product name as it appears on the packaging.

Accuracy is critical — a person's diet tracking depends on this.${buildMemoryContext()}`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            food_name: { type: "string" },
            serving_size: { type: "string" },
            calories: { type: "number" },
            protein_g: { type: "number" },
            carbs_g: { type: "number" },
            fat_g: { type: "number" }
          }
        }
      });

      if (result.food_name) {
        setPendingFoods({ foods: [result], imageUrl: file_url });
      }
    } finally {
      setScanning(false);
      setMode(null);
      e.target.value = '';
    }
  };

  const handleConfirm = (items) => {
    saveFoodMemory(items);
    items.forEach(food => onFoodDetected(food));
    setPendingFoods(null);
  };

  const snapLocked = !canAccess(userPlan, 'snap_food');
  const barcodeLocked = !canAccess(userPlan, 'scan_barcode');

  if (pendingFoods) {
    return (
      <FoodEditModal
        foods={pendingFoods.foods}
        imageUrl={pendingFoods.imageUrl}
        onConfirm={handleConfirm}
        onCancel={() => setPendingFoods(null)}
      />
    );
  }

  if (scanning) {
    return (
      <Card className="p-8 flex flex-col items-center gap-3">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="font-heading font-bold">Analyzing your food...</p>
        <p className="text-sm text-muted-foreground">AI is estimating nutrition info</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={mode === 'barcode' ? handleBarcodeCapture : handleCapture}
      />

      <div className="grid grid-cols-2 gap-3">
        <Card
          className={`p-5 flex flex-col items-center gap-2 transition-all ${snapLocked ? 'opacity-60 cursor-default' : 'cursor-pointer hover:border-primary/40 active:scale-[0.98]'}`}
          onClick={() => { if (!snapLocked) { setMode('photo'); setTimeout(() => fileInputRef.current?.click(), 50); } }}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${snapLocked ? 'bg-muted' : 'bg-primary/15'}`}>
            {snapLocked ? <Lock className="w-6 h-6 text-muted-foreground" /> : <Camera className="w-6 h-6 text-primary" />}
          </div>
          <p className="font-heading font-bold text-sm">Snap Food</p>
          <p className="text-[10px] text-muted-foreground text-center">{snapLocked ? 'Progress plan+' : 'Take a photo of your meal'}</p>
        </Card>

        <Card
          className={`p-5 flex flex-col items-center gap-2 transition-all ${barcodeLocked ? 'opacity-60 cursor-default' : 'cursor-pointer hover:border-primary/40 active:scale-[0.98]'}`}
          onClick={() => { if (!barcodeLocked) { setMode('barcode'); setTimeout(() => fileInputRef.current?.click(), 50); } }}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${barcodeLocked ? 'bg-muted' : 'bg-accent/15'}`}>
            {barcodeLocked ? <Lock className="w-6 h-6 text-muted-foreground" /> : <Package className="w-6 h-6 text-accent" />}
          </div>
          <p className="font-heading font-bold text-sm">Scan Package</p>
          <p className="text-[10px] text-muted-foreground text-center">{barcodeLocked ? 'Progress plan+' : 'Photo of food packaging'}</p>
        </Card>
      </div>
    </div>
  );
}