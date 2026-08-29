import { useRef, useState } from 'react';

import {
  Camera,
  Package,
  Loader2,
  Lock,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

import {
  Card,
} from '@/components/ui/card';

import {
  Button,
} from '@/components/ui/button';

import {
  supabaseApi,
} from '@/lib/supabaseApi';

import {
  canAccess,
} from '@/lib/subscription';

import FoodEditModal from './FoodEditModal';

const FOOD_MEMORY_KEY =
  'washek_food_memory';

/*
 * ============================================================
 * FOOD MEMORY
 * ============================================================
 */

function getFoodMemory() {
  try {
    return JSON.parse(
      localStorage.getItem(
        FOOD_MEMORY_KEY
      ) ||
        '{}'
    );
  } catch {
    return {};
  }
}

function saveFoodMemory(
  foods
) {
  const memory =
    getFoodMemory();

  for (
    const food of foods
  ) {
    if (
      food?.food_name?.trim()
    ) {
      memory[
        food.food_name
          .toLowerCase()
          .trim()
      ] = {
        calories:
          food.calories,

        protein_g:
          food.protein_g,

        carbs_g:
          food.carbs_g,

        fat_g:
          food.fat_g,

        serving_size:
          food.serving_size,
      };
    }
  }

  localStorage.setItem(
    FOOD_MEMORY_KEY,
    JSON.stringify(
      memory
    )
  );
}

/*
 * ============================================================
 * FOOD MEMORY CONTEXT
 * ============================================================
 */

function buildMemoryContext() {
  const memory =
    getFoodMemory();

  const entries =
    Object.entries(
      memory
    );

  if (
    !entries.length
  ) {
    return '';
  }

  const lines =
    entries
      .map(
        ([
          name,
          food,
        ]) =>
          `- ${name}: ${food.calories} kcal, ${food.protein_g}g protein, ${food.carbs_g}g carbs, ${food.fat_g}g fat (${food.serving_size || 'per serving'})`
      )
      .join('\n');

  return `

Previously corrected foods for this user:
${lines}

Use these values as a baseline when the image clearly shows the same food, but do not blindly copy them when the portion or preparation is different.`;
}

/*
 * ============================================================
 * FOOD SCAN SCHEMA
 * ============================================================
 */

const FOOD_SCAN_SCHEMA = {
  type: 'object',

  additionalProperties: false,

  properties: {
    foods: {
      type: 'array',

      items: {
        type: 'object',

        additionalProperties: false,

        properties: {
          food_name: {
            type: 'string',
          },

          serving_size: {
            type: 'string',
          },

          calories: {
            type: 'number',
          },

          protein_g: {
            type: 'number',
          },

          carbs_g: {
            type: 'number',
          },

          fat_g: {
            type: 'number',
          },

          confidence: {
            type: 'string',

            enum: [
              'high',
              'medium',
              'low',
            ],
          },

          notes: {
            type: 'string',
          },
        },

        required: [
          'food_name',
          'serving_size',
          'calories',
          'protein_g',
          'carbs_g',
          'fat_g',
          'confidence',
          'notes',
        ],
      },
    },
  },

  required: [
    'foods',
  ],
};

/*
 * ============================================================
 * BARCODE / PACKAGE SCAN SCHEMA
 * ============================================================
 */

const FOOD_BARCODE_SCHEMA = {
  type: 'object',

  additionalProperties: false,

  properties: {
    food_name: {
      type: 'string',
    },

    serving_size: {
      type: 'string',
    },

    calories: {
      type: 'number',
    },

    protein_g: {
      type: 'number',
    },

    carbs_g: {
      type: 'number',
    },

    fat_g: {
      type: 'number',
    },

    confidence: {
      type: 'string',

      enum: [
        'high',
        'medium',
        'low',
      ],
    },

    source: {
      type: 'string',

      enum: [
        'nutrition_label',
        'identified_product',
        'estimate',
      ],
    },

    notes: {
      type: 'string',
    },
  },

  required: [
    'food_name',
    'serving_size',
    'calories',
    'protein_g',
    'carbs_g',
    'fat_g',
    'confidence',
    'source',
    'notes',
  ],
};

/*
 * ============================================================
 * FOOD PHOTO PROMPT
 * ============================================================
 */

function buildFoodScanPrompt() {
  return `
You are a precision nutrition analyst for Washek Fitness.

Analyze the food shown in the attached image.

ACCURACY IS THE PRIORITY.

Do not invent foods that are not visible.

Identify every distinct food item that can reasonably be identified.

For each item:

1. Identify the food as specifically as the image allows.
   Example:
   "grilled chicken breast"
   is better than
   "chicken".

2. Estimate the portion size using visible cues such as:
   - plate size
   - bowl size
   - food volume
   - relative size of nearby objects
   - normal density of the food

3. Estimate calories and macros for that estimated portion.

4. Account for likely preparation:
   - oils
   - butter
   - sauces
   - dressings
   - frying
   - visible toppings

5. Do NOT automatically add arbitrary extra fat.
   Only include cooking oils or fats when the preparation or food appearance reasonably supports them.

6. Calories and macros must be internally consistent.
   Check approximately:
   protein × 4
   + carbs × 4
   + fat × 9

7. If the exact portion cannot be determined, give your best realistic estimate and mark confidence as medium or low.

8. Never claim exact precision from a photograph.
   A photo gives an estimate, not a laboratory measurement.

9. Separate foods when multiple foods are clearly visible.

10. Use the previously corrected-food context only when the same food and a reasonably similar portion are clearly present.

${buildMemoryContext()}
`;
}

/*
 * ============================================================
 * PACKAGE / LABEL PROMPT
 * ============================================================
 */

function buildBarcodePrompt() {
  return `
You are a precision nutrition analyst for Washek Fitness.

Analyze the attached food package or nutrition label.

ACCURACY IS THE PRIORITY.

If a Nutrition Facts label is visible:

- Read the values directly from the label.
- Do NOT estimate values that are clearly printed.
- Use the serving size exactly as printed.
- Use calories exactly as printed.
- Use protein, carbohydrate, and fat exactly as printed.
- Preserve the exact product name when visible.

If the label is not visible but the exact product and brand can be identified:

- identify the product as specifically as possible;
- provide the most reliable known nutrition information;
- mark confidence appropriately.

If neither the label nor exact product can be determined:

- do not invent an exact nutritional profile;
- provide a reasonable estimate;
- mark confidence low.

Do not fabricate brand-specific information.

Calories and macros must be internally checked for consistency.

${buildMemoryContext()}
`;
}

/*
 * ============================================================
 * VALIDATE SCAN
 * ============================================================
 */

function normalizeFoods(
  foods
) {
  if (
    !Array.isArray(
      foods
    )
  ) {
    return [];
  }

  return foods
    .map(
      (
        food
      ) => ({
        food_name:
          String(
            food?.food_name ||
              ''
          ).trim(),

        serving_size:
          String(
            food?.serving_size ||
              '1 serving'
          ).trim(),

        calories:
          Number.isFinite(
            Number(
              food?.calories
            )
          )
            ? Math.max(
                0,
                Number(
                  food.calories
                )
              )
            : 0,

        protein_g:
          Number.isFinite(
            Number(
              food?.protein_g
            )
          )
            ? Math.max(
                0,
                Number(
                  food.protein_g
                )
              )
            : 0,

        carbs_g:
          Number.isFinite(
            Number(
              food?.carbs_g
            )
          )
            ? Math.max(
                0,
                Number(
                  food.carbs_g
                )
              )
            : 0,

        fat_g:
          Number.isFinite(
            Number(
              food?.fat_g
            )
          )
            ? Math.max(
                0,
                Number(
                  food.fat_g
                )
              )
            : 0,

        confidence:
          food?.confidence ||
          'medium',

        notes:
          String(
            food?.notes ||
              ''
          ).trim(),
      })
    )
    .filter(
      (
        food
      ) =>
        Boolean(
          food.food_name
        )
    );
}

/*
 * ============================================================
 * COMPONENT
 * ============================================================
 */

export default function FoodScanner({
  onFoodDetected,
  userPlan = 'free',
}) {
  const [
    scanning,
    setScanning,
  ] = useState(false);

  const [
    mode,
    setMode,
  ] = useState(null);

  const [
    pendingFoods,
    setPendingFoods,
  ] = useState(null);

  const [
    error,
    setError,
  ] = useState('');

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('');

  const fileInputRef =
    useRef(null);

  /*
   * ==========================================================
   * SNAP FOOD
   * ==========================================================
   */

  const handleCapture =
    async (
      event
    ) => {
      const file =
        event.target
          ?.files?.[0];

      if (
        !file
      ) {
        return;
      }

      setScanning(
        true
      );

      setMode(
        'photo'
      );

      setError(
        ''
      );

      setSuccessMessage(
        ''
      );

      try {
        if (
          !file.type.startsWith(
            'image/'
          )
        ) {
          throw new Error(
            'Please select a food photo.'
          );
        }

        /*
         * Upload image.
         */

        const uploaded =
          await supabaseApi.storage.uploadFile(
            {
              file,
            }
          );

        if (
          !uploaded?.file_url
        ) {
          throw new Error(
            'The food photo uploaded, but no image URL was returned.'
          );
        }

        /*
         * Vision AI request.
         */

        const result =
          await supabaseApi.ai.invoke(
            {
              type:
                'food_scan',

              prompt:
                buildFoodScanPrompt(),

              file_urls: [
                uploaded.file_url,
              ],

              response_json_schema:
                FOOD_SCAN_SCHEMA,
            }
          );

        const foods =
          normalizeFoods(
            result?.foods
          );

        if (
          !foods.length
        ) {
          throw new Error(
            'The AI could not identify any food clearly enough to estimate.'
          );
        }

        /*
         * Show review screen.
         */

        setPendingFoods({
          foods,

          imageUrl:
            uploaded.file_url,
        });

        setSuccessMessage(
          'Food scan complete. Review the estimates before saving.'
        );
      } catch (
        scanError
      ) {
        console.error(
          '[FoodScanner] Food scan failed:',
          scanError
        );

        setError(
          scanError?.message ||
            'Food scanning failed. Please try another photo.'
        );
      } finally {
        setScanning(
          false
        );

        event.target.value =
          '';
      }
    };

  /*
   * ==========================================================
   * PACKAGE / LABEL SCAN
   * ==========================================================
   */

  const handleBarcodeCapture =
    async (
      event
    ) => {
      const file =
        event.target
          ?.files?.[0];

      if (
        !file
      ) {
        return;
      }

      setScanning(
        true
      );

      setMode(
        'barcode'
      );

      setError(
        ''
      );

      setSuccessMessage(
        ''
      );

      try {
        if (
          !file.type.startsWith(
            'image/'
          )
        ) {
          throw new Error(
            'Please select a package or nutrition-label photo.'
          );
        }

        const uploaded =
          await supabaseApi.storage.uploadFile(
            {
              file,
            }
          );

        if (
          !uploaded?.file_url
        ) {
          throw new Error(
            'The package photo uploaded, but no image URL was returned.'
          );
        }

        const result =
          await supabaseApi.ai.invoke(
            {
              type:
                'food_barcode',

              prompt:
                buildBarcodePrompt(),

              file_urls: [
                uploaded.file_url,
              ],

              response_json_schema:
                FOOD_BARCODE_SCHEMA,
            }
          );

        const foods =
          normalizeFoods([
            result,
          ]);

        if (
          !foods.length
        ) {
          throw new Error(
            'The AI could not identify the product or nutrition information clearly enough.'
          );
        }

        setPendingFoods({
          foods,

          imageUrl:
            uploaded.file_url,
        });

        setSuccessMessage(
          'Package scan complete. Review the nutrition values before saving.'
        );
      } catch (
        scanError
      ) {
        console.error(
          '[FoodScanner] Package scan failed:',
          scanError
        );

        setError(
          scanError?.message ||
            'Package scanning failed. Please try again.'
        );
      } finally {
        setScanning(
          false
        );

        event.target.value =
          '';
      }
    };

  /*
   * ==========================================================
   * CONFIRM
   * ==========================================================
   */

  const handleConfirm =
    (
      items
    ) => {
      const validItems =
        items.filter(
          (
            item
          ) =>
            item?.food_name?.trim()
        );

      if (
        !validItems.length
      ) {
        return;
      }

      saveFoodMemory(
        validItems
      );

      for (
        const food of
        validItems
      ) {
        /*
         * Do not send AI confidence/notes to the nutrition
         * database unless the database explicitly supports them.
         */
        onFoodDetected({
          food_name:
            food.food_name,

          serving_size:
            food.serving_size,

          calories:
            food.calories,

          protein_g:
            food.protein_g,

          carbs_g:
            food.carbs_g,

          fat_g:
            food.fat_g,

          image_url:
            pendingFoods?.imageUrl ||
            null,
        });
      }

      setPendingFoods(
        null
      );

      setSuccessMessage(
        'Food added to your nutrition log.'
      );
    };

  /*
   * ==========================================================
   * LOCKS
   * ==========================================================
   */

  const snapLocked =
    !canAccess(
      userPlan,
      'snap_food'
    );

  const barcodeLocked =
    !canAccess(
      userPlan,
      'scan_barcode'
    );

  /*
   * ==========================================================
   * REVIEW
   * ==========================================================
   */

  if (
    pendingFoods
  ) {
    return (
      <FoodEditModal
        foods={
          pendingFoods.foods
        }

        imageUrl={
          pendingFoods.imageUrl
        }

        onConfirm={
          handleConfirm
        }

        onCancel={() =>
          setPendingFoods(
            null
          )
        }
      />
    );
  }

  /*
   * ==========================================================
   * SCANNING
   * ==========================================================
   */

  if (
    scanning
  ) {
    return (
      <Card className="p-8 flex flex-col items-center gap-3">

        <Loader2 className="w-10 h-10 text-primary animate-spin" />

        <p className="font-heading font-bold">
          {mode === 'barcode'
            ? 'Reading nutrition information…'
            : 'Analyzing your food…'}
        </p>

        <p className="text-sm text-muted-foreground text-center max-w-xs">
          {mode === 'barcode'
            ? 'Kael is reading the package and nutrition label.'
            : 'Kael is identifying the food, estimating the portion, and calculating the nutrition.'}
        </p>

      </Card>
    );
  }

  /*
   * ==========================================================
   * NORMAL VIEW
   * ==========================================================
   */

  return (
    <div className="space-y-3">

      <input
        ref={
          fileInputRef
        }

        type="file"

        accept="image/*"

        capture="environment"

        className="hidden"

        onChange={
          mode ===
          'barcode'
            ? handleBarcodeCapture
            : handleCapture
        }
      />

      {error && (
        <Card className="p-3 border-destructive/30 bg-destructive/5">

          <div className="flex items-start gap-2">

            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />

            <p className="text-xs text-destructive leading-relaxed">
              {error}
            </p>

          </div>

        </Card>
      )}

      {successMessage && (
        <Card className="p-3 border-accent/30 bg-accent/5">

          <div className="flex items-start gap-2">

            <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 shrink-0" />

            <p className="text-xs text-muted-foreground leading-relaxed">
              {successMessage}
            </p>

          </div>

        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">

        {/* Snap Food */}

        <Card
          className={`p-5 flex flex-col items-center gap-2 transition-all ${
            snapLocked
              ? 'opacity-60 cursor-default'
              : 'cursor-pointer hover:border-primary/40 active:scale-[0.98]'
          }`}
          onClick={() => {
            if (
              snapLocked
            ) {
              return;
            }

            setMode(
              'photo'
            );

            setError(
              ''
            );

            setTimeout(
              () =>
                fileInputRef.current?.click(),
              50
            );
          }}
        >

          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              snapLocked
                ? 'bg-muted'
                : 'bg-primary/15'
            }`}
          >

            {snapLocked ? (
              <Lock className="w-6 h-6 text-muted-foreground" />
            ) : (
              <Camera className="w-6 h-6 text-primary" />
            )}

          </div>

          <p className="font-heading font-bold text-sm">
            Snap Food
          </p>

          <p className="text-[10px] text-muted-foreground text-center">
            {snapLocked
              ? 'Progress plan+'
              : 'Take a photo of your meal'}
          </p>

        </Card>

        {/* Scan Package */}

        <Card
          className={`p-5 flex flex-col items-center gap-2 transition-all ${
            barcodeLocked
              ? 'opacity-60 cursor-default'
              : 'cursor-pointer hover:border-primary/40 active:scale-[0.98]'
          }`}
          onClick={() => {
            if (
              barcodeLocked
            ) {
              return;
            }

            setMode(
              'barcode'
            );

            setError(
              ''
            );

            setTimeout(
              () =>
                fileInputRef.current?.click(),
              50
            );
          }}
        >

          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              barcodeLocked
                ? 'bg-muted'
                : 'bg-accent/15'
            }`}
          >

            {barcodeLocked ? (
              <Lock className="w-6 h-6 text-muted-foreground" />
            ) : (
              <Package className="w-6 h-6 text-accent" />
            )}

          </div>

          <p className="font-heading font-bold text-sm">
            Scan Package
          </p>

          <p className="text-[10px] text-muted-foreground text-center">
            {barcodeLocked
              ? 'Progress plan+'
              : 'Photo of food packaging'}
          </p>

        </Card>

      </div>

      <p className="text-[10px] text-muted-foreground text-center px-3 leading-relaxed">
        Photo-based nutrition values are
        estimates unless a readable
        nutrition label provides exact
        values. Review the results before
        saving.
      </p>

    </div>
  );
}
