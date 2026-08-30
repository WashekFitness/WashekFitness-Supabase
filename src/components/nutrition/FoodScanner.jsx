import { useState, useRef } from 'react';

import {
  Button,
} from '@/components/ui/button';

import {
  Card,
} from '@/components/ui/card';

import {
  Camera,
  Package,
  Loader2,
  Lock,
  AlertCircle,
} from 'lucide-react';

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
      ) || '{}'
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

  foods.forEach(
    food => {
      if (
        food?.food_name
          ?.trim()
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
  );

  localStorage.setItem(
    FOOD_MEMORY_KEY,
    JSON.stringify(
      memory
    )
  );
}

/*
 * Keep this context deliberately small.
 *
 * The old version could keep accumulating a large amount of
 * prior food data and make an otherwise simple image request
 * unnecessarily expensive/heavy.
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

  /*
   * Only use the most recent 20 remembered foods.
   */
  const recent =
    entries.slice(
      -20
    );

  const lines =
    recent
      .map(
        (
          [
            name,
            value,
          ]
        ) =>
          `- ${name}: ${value.calories ?? '?'} kcal, ${value.protein_g ?? '?'}g protein, ${value.carbs_g ?? '?'}g carbs, ${value.fat_g ?? '?'}g fat (${value.serving_size || 'per serving'})`
      )
      .join(
        '\n'
      );

  return `

PREVIOUSLY CORRECTED FOODS:
Use these only as a reference when you recognize the same food.

${lines}
`;
}

/*
 * ============================================================
 * VALIDATION / NORMALIZATION
 * ============================================================
 */

function numberOrZero(
  value
) {
  const number =
    Number(
      value
    );

  return Number.isFinite(
    number
  )
    ? Math.max(
        0,
        number
      )
    : 0;
}

function normalizeFood(
  food
) {
  if (
    !food ||
    typeof food !==
      'object'
  ) {
    return null;
  }

  const name =
    String(
      food.food_name ||
        food.name ||
        ''
    ).trim();

  if (
    !name
  ) {
    return null;
  }

  return {
    food_name:
      name,

    serving_size:
      String(
        food.serving_size ||
          'Estimated serving'
      ).trim(),

    calories:
      Math.round(
        numberOrZero(
          food.calories
        )
      ),

    protein_g:
      Number(
        numberOrZero(
          food.protein_g
        ).toFixed(
          1
        )
      ),

    carbs_g:
      Number(
        numberOrZero(
          food.carbs_g
        ).toFixed(
          1
        )
      ),

    fat_g:
      Number(
        numberOrZero(
          food.fat_g
        ).toFixed(
          1
        )
      ),
  };
}

function normalizeFoods(
  value
) {
  if (
    Array.isArray(
      value
    )
  ) {
    return value
      .map(
        normalizeFood
      )
      .filter(Boolean);
  }

  if (
    value &&
    typeof value ===
      'object'
  ) {
    if (
      Array.isArray(
        value.foods
      )
    ) {
      return value.foods
        .map(
          normalizeFood
        )
        .filter(
          Boolean
        );
    }

    const single =
      normalizeFood(
        value
      );

    return single
      ? [single]
      : [];
  }

  return [];
}

/*
 * ============================================================
 * PROMPTS
 * ============================================================
 */

function buildFoodPrompt() {
  return `
You are Kael's food-analysis system for Washek Fitness.

Analyze the supplied food photograph.

Your job is to estimate the visible food as accurately as a photograph allows.

IMPORTANT:

- Identify every distinct visible food item that can reasonably be identified.
- Use specific names when visually supported.
- Estimate the visible portion size.
- Estimate calories, protein, carbohydrates, and fat.
- Consider visible cooking methods, sauces, dressings, oils, toppings, breading, and other visible ingredients.
- Do not invent hidden ingredients.
- Do not pretend a photograph provides exact laboratory nutrition data.
- Make realistic estimates rather than extreme guesses.
- Calories should be reasonably consistent with the listed macros.
- If the exact portion cannot be known, give your best defensible estimate.
- Do not return a generic meal description instead of individual food items.

Return ONLY valid JSON in exactly this shape:

{
  "foods": [
    {
      "food_name": "specific food name",
      "serving_size": "estimated portion",
      "calories": 0,
      "protein_g": 0,
      "carbs_g": 0,
      "fat_g": 0
    }
  ]
}

Do not use markdown.
Do not add commentary outside the JSON object.

${buildMemoryContext()}
`;
}

function buildBarcodePrompt() {
  return `
You are Kael's nutrition-label analysis system for Washek Fitness.

Analyze the supplied food package or Nutrition Facts image.

When a Nutrition Facts label is readable:

- use the printed serving size
- use the printed calories
- use the printed protein
- use the printed carbohydrates
- use the printed fat

Do NOT invent numbers when clearly printed values are visible.

If the exact product cannot be identified from the image, say so through the JSON values you can actually determine.

Return ONLY valid JSON in exactly this shape:

{
  "food_name": "product name",
  "serving_size": "serving size",
  "calories": 0,
  "protein_g": 0,
  "carbs_g": 0,
  "fat_g": 0
}

Do not use markdown.
Do not add commentary outside the JSON object.

${buildMemoryContext()}
`;
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

  const fileInputRef =
    useRef(null);

  /*
   * ==========================================================
   * RESET
   * ==========================================================
   */

  function resetScanner() {
    setScanning(
      false
    );

    setMode(
      null
    );

    setError(
      ''
    );

    if (
      fileInputRef.current
    ) {
      fileInputRef.current.value =
        '';
    }
  }

  /*
   * ==========================================================
   * FOOD PHOTO
   * ==========================================================
   */

  const handleCapture =
    async (
      e
    ) => {
      const file =
        e.target
          ?.files?.[0];

      if (
        !file
      ) {
        return;
      }

      setError(
        ''
      );

      setScanning(
        true
      );

      setMode(
        'photo'
      );

      try {
        /*
         * Make sure this really is an image.
         */
        if (
          !file.type.startsWith(
            'image/'
          )
        ) {
          throw new Error(
            'Please choose a photo of your food.'
          );
        }

        /*
         * Upload.
         */
        const uploaded =
          await supabaseApi.storage.uploadFile(
            {
              file,
            }
          );

        const imageUrl =
          uploaded?.file_url;

        if (
          !imageUrl
        ) {
          throw new Error(
            'The food photo uploaded, but no image URL was returned.'
          );
        }

        console.log(
          '[FoodScanner] Uploaded food image.'
        );

        /*
         * AI.
         *
         * IMPORTANT:
         * We still use the existing centralized ai-generate
         * function. No new backend function is required.
         */
        const result =
          await supabaseApi.ai.invoke(
            {
              type:
                'food_scan',

              prompt:
                buildFoodPrompt(),

              file_urls: [
                imageUrl,
              ],

              response_json_schema: {
                type:
                  'object',

                properties: {
                  foods: {
                    type:
                      'array',

                    items: {
                      type:
                        'object',

                      properties: {
                        food_name: {
                          type:
                            'string',
                        },

                        serving_size: {
                          type:
                            'string',
                        },

                        calories: {
                          type:
                            'number',
                        },

                        protein_g: {
                          type:
                            'number',
                        },

                        carbs_g: {
                          type:
                            'number',
                        },

                        fat_g: {
                          type:
                            'number',
                        },
                      },
                    },
                  },
                },
              },
            }
          );

        console.log(
          '[FoodScanner] AI response received.',
          result
        );

        /*
         * Normalize response.
         */
        const foods =
          normalizeFoods(
            result
          );

        if (
          !foods.length
        ) {
          throw new Error(
            'Kael could not identify any food items in that photo. Try a clearer photo with the entire meal visible.'
          );
        }

        /*
         * Show edit/confirmation modal instead of saving
         * immediately.
         */
        setPendingFoods(
          {
            foods,

            imageUrl,
          }
        );
      } catch (
        caught
      ) {
        console.error(
          '[FoodScanner] Food analysis failed:',
          caught
        );

        const message =
          caught?.message ||
          'Food analysis failed. Please try again.';

        setError(
          message
        );
      } finally {
        /*
         * THIS IS CRITICAL.
         *
         * The scanner can never remain stuck on the spinner.
         */
        setScanning(
          false
        );

        setMode(
          null
        );

        if (
          e.target
        ) {
          e.target.value =
            '';
        }
      }
    };

  /*
   * ==========================================================
   * PACKAGE / LABEL
   * ==========================================================
   */

  const handleBarcodeCapture =
    async (
      e
    ) => {
      const file =
        e.target
          ?.files?.[0];

      if (
        !file
      ) {
        return;
      }

      setError(
        ''
      );

      setScanning(
        true
      );

      setMode(
        'barcode'
      );

      try {
        if (
          !file.type.startsWith(
            'image/'
          )
        ) {
          throw new Error(
            'Please choose a photo of the food package or label.'
          );
        }

        const uploaded =
          await supabaseApi.storage.uploadFile(
            {
              file,
            }
          );

        const imageUrl =
          uploaded?.file_url;

        if (
          !imageUrl
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
                imageUrl,
              ],

              response_json_schema: {
                type:
                  'object',

                properties: {
                  food_name: {
                    type:
                      'string',
                  },

                  serving_size: {
                    type:
                      'string',
                  },

                  calories: {
                    type:
                      'number',
                  },

                  protein_g: {
                    type:
                      'number',
                  },

                  carbs_g: {
                    type:
                      'number',
                  },

                  fat_g: {
                    type:
                      'number',
                  },
                },
              },
            }
          );

        const foods =
          normalizeFoods(
            result
          );

        if (
          !foods.length
        ) {
          throw new Error(
            'Kael could not read that food package. Try a clearer photo of the Nutrition Facts label.'
          );
        }

        setPendingFoods(
          {
            foods,

            imageUrl,
          }
        );
      } catch (
        caught
      ) {
        console.error(
          '[FoodScanner] Package analysis failed:',
          caught
        );

        setError(
          caught?.message ||
            'Package analysis failed. Please try again.'
        );
      } finally {
        setScanning(
          false
        );

        setMode(
          null
        );

        if (
          e.target
        ) {
          e.target.value =
            '';
        }
      }
    };

  /*
   * ==========================================================
   * CONFIRM
   * ==========================================================
   */

  const handleConfirm =
    items => {
      const normalized =
        normalizeFoods(
          items
        );

      if (
        !normalized.length
      ) {
        setError(
          'There were no valid food items to save.'
        );

        return;
      }

      saveFoodMemory(
        normalized
      );

      normalized.forEach(
        food => {
          onFoodDetected(
            food
          );
        }
      );

      setPendingFoods(
        null
      );

      setError(
        ''
      );
    };

  /*
   * ==========================================================
   * ACCESS
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
   * EDIT MODAL
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

          {mode ===
          'barcode'
            ? 'Reading your food label...'
            : 'Analyzing your food...'}

        </p>

        <p className="text-sm text-muted-foreground text-center">
          Kael is identifying the food and estimating its nutrition.
        </p>

      </Card>
    );
  }

  /*
   * ==========================================================
   * MAIN UI
   * ==========================================================
   */

  return (
    <div className="space-y-3">

      {error && (
        <Card className="p-3 border-destructive/30 bg-destructive/5">

          <div className="flex items-start gap-2">

            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />

            <div className="flex-1">

              <p className="text-xs font-semibold text-destructive">
                Food analysis failed
              </p>

              <p className="text-xs text-muted-foreground mt-1 break-words">
                {error}
              </p>

              <button
                type="button"
                className="text-xs font-semibold text-primary mt-2"
                onClick={() =>
                  setError(
                    ''
                  )
                }
              >
                Dismiss
              </button>

            </div>

          </div>

        </Card>
      )}

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

      <div className="grid grid-cols-2 gap-3">

        <Card
          className={`
            p-5
            flex
            flex-col
            items-center
            gap-2
            transition-all
            ${
              snapLocked
                ? 'opacity-60 cursor-default'
                : 'cursor-pointer hover:border-primary/40 active:scale-[0.98]'
            }
          `}

          onClick={() => {
            if (
              snapLocked
            ) {
              return;
            }

            setError(
              ''
            );

            setMode(
              'photo'
            );

            setTimeout(
              () =>
                fileInputRef.current?.click(),
              50
            );
          }}
        >

          <div
            className={`
              w-12 h-12
              rounded-2xl
              flex
              items-center
              justify-center
              ${
                snapLocked
                  ? 'bg-muted'
                  : 'bg-primary/15'
              }
            `}
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

        <Card
          className={`
            p-5
            flex
            flex-col
            items-center
            gap-2
            transition-all
            ${
              barcodeLocked
                ? 'opacity-60 cursor-default'
                : 'cursor-pointer hover:border-primary/40 active:scale-[0.98]'
            }
          `}

          onClick={() => {
            if (
              barcodeLocked
            ) {
              return;
            }

            setError(
              ''
            );

            setMode(
              'barcode'
            );

            setTimeout(
              () =>
                fileInputRef.current?.click(),
              50
            );
          }}
        >

          <div
            className={`
              w-12 h-12
              rounded-2xl
              flex
              items-center
              justify-center
              ${
                barcodeLocked
                  ? 'bg-muted'
                  : 'bg-accent/15'
              }
            `}
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

    </div>
  );
}
