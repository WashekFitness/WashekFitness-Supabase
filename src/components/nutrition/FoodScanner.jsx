import { useState, useRef } from 'react';

import {
  Camera,
  Package,
  Loader2,
  Lock,
  AlertCircle,
} from 'lucide-react';

import {
  Card,
} from '@/components/ui/card';

import {
  supabaseApi,
} from '@/lib/supabaseApi';

import {
  canAccess,
} from '@/lib/subscription';

import FoodEditModal from './FoodEditModal';


/*
 * ============================================================
 * FOOD MEMORY
 * ============================================================
 */

const FOOD_MEMORY_KEY =
  'washek_food_memory';


function getFoodMemory() {
  try {
    const raw =
      localStorage.getItem(
        FOOD_MEMORY_KEY
      );

    if (!raw) {
      return {};
    }

    const parsed =
      JSON.parse(raw);

    return parsed &&
      typeof parsed === 'object'
      ? parsed
      : {};
  } catch {
    return {};
  }
}


function saveFoodMemory(
  foods
) {
  try {
    const memory =
      getFoodMemory();

    for (
      const food of
      foods || []
    ) {
      const name =
        String(
          food?.food_name ||
            ''
        )
          .trim()
          .toLowerCase();

      if (!name) {
        continue;
      }

      memory[name] = {
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

    localStorage.setItem(
      FOOD_MEMORY_KEY,
      JSON.stringify(
        memory
      )
    );
  } catch (
    error
  ) {
    console.warn(
      '[FoodScanner] Could not save food memory:',
      error
    );
  }
}


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
   * Keep this deliberately small.
   * A huge history makes the multimodal request unnecessarily large.
   */
  const recent =
    entries.slice(
      -20
    );

  const lines =
    recent
      .map(
        ([
          name,
          value,
        ]) =>
          `- ${name}: ${value.calories ?? '?'} kcal, ${value.protein_g ?? '?'}g protein, ${value.carbs_g ?? '?'}g carbs, ${value.fat_g ?? '?'}g fat (${value.serving_size || 'per serving'})`
      )
      .join(
        '\n'
      );

  return `

PREVIOUSLY CORRECTED FOODS:
These are reference examples only. Use them when the same food is visibly present.

${lines}
`;
}


/*
 * ============================================================
 * NUMBER / NORMALIZATION HELPERS
 * ============================================================
 */

function numberOrZero(
  value
) {
  const parsed =
    Number(
      value
    );

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    parsed
  );
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

  const foodName =
    String(
      food.food_name ||
        food.name ||
        ''
    ).trim();

  if (
    !foodName
  ) {
    return null;
  }

  return {
    food_name:
      foodName,

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
      .filter(
        Boolean
      );
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

    const one =
      normalizeFood(
        value
      );

    return one
      ? [one]
      : [];
  }

  return [];
}


/*
 * ============================================================
 * AI JSON PARSER
 * ============================================================
 *
 * Food Scan intentionally does NOT request JSON schema from
 * openrouter/free anymore.
 *
 * The model returns ordinary text containing JSON.
 * We parse it ourselves here.
 */

function parseFoodAIResult(
  value
) {
  /*
   * Some models may return an object anyway.
   */
  if (
    value &&
    typeof value ===
      'object'
  ) {
    return value;
  }

  if (
    typeof value !==
    'string'
  ) {
    return null;
  }

  let text =
    value.trim();

  /*
   * Remove a markdown JSON fence.
   */
  text =
    text.replace(
      /^```(?:json)?\s*/i,
      ''
    );

  text =
    text.replace(
      /\s*```$/i,
      ''
    );

  /*
   * First attempt: whole response is JSON.
   */
  try {
    return JSON.parse(
      text
    );
  } catch {
    /*
     * Some free models may put a little text before/after
     * the JSON. Attempt to extract the outermost object.
     */
  }

  const firstBrace =
    text.indexOf(
      '{'
    );

  const lastBrace =
    text.lastIndexOf(
      '}'
    );

  if (
    firstBrace >= 0 &&
    lastBrace >
      firstBrace
  ) {
    const candidate =
      text.slice(
        firstBrace,
        lastBrace +
          1
      );

    try {
      return JSON.parse(
        candidate
      );
    } catch {
      return null;
    }
  }

  /*
   * Also support an array response just in case.
   */

  const firstBracket =
    text.indexOf(
      '['
    );

  const lastBracket =
    text.lastIndexOf(
      ']'
    );

  if (
    firstBracket >= 0 &&
    lastBracket >
      firstBracket
  ) {
    const candidate =
      text.slice(
        firstBracket,
        lastBracket +
          1
      );

    try {
      return JSON.parse(
        candidate
      );
    } catch {
      return null;
    }
  }

  return null;
}


/*
 * ============================================================
 * PROMPTS
 * ============================================================
 */

function buildFoodPrompt() {
  return `
You are Kael, the nutrition-analysis system for Washek Fitness.

Analyze the supplied food photograph as a careful nutrition estimator. The goal is a realistic, defensible estimate for the FOOD AND PORTION ACTUALLY VISIBLE in the image, not a generic serving from memory.

STEP 1 — IDENTIFY THE FOOD:
- Identify every distinct visible food item.
- Be specific when the image supports it (for example, grilled chicken breast rather than "meat").
- Identify visible toppings, breading, cheese, sauces, dressings, oils, spreads, and cooking fats when they are visible or strongly supported.
- Do not invent ingredients that cannot reasonably be inferred from the image.
- If a food cannot be identified confidently, use a conservative generic description.

STEP 2 — ESTIMATE THE PORTION:
- Estimate the amount actually shown in the photo, not an assumed restaurant serving.
- Use visual size, plate/bowl/container dimensions, thickness, count of pieces, and relative scale.
- For countable foods, use the visible count when possible.
- For mixed dishes, estimate the major components separately when they are visually distinguishable.
- State the estimated portion in a useful unit such as "6 oz cooked", "1 cup", "2 eggs", or "1 medium banana".
- Do not silently multiply a standard serving by an arbitrary factor.

STEP 3 — ESTIMATE NUTRITION:
- Estimate calories, protein, carbs, and fat for THAT estimated visible portion.
- Prefer realistic nutrition values from common food composition knowledge.
- Account for calorie-dense visible additions such as oil, butter, cheese, sauces, dressings, nuts, and breading.
- For cooked meat/starches, distinguish cooked portion from raw weight when estimating.
- Do not make protein, carbohydrate, or fat values unrealistically high or low just to hit a calorie number.
- Do not assume a food is "diet", "low fat", or "high protein" unless the image or known product information supports it.

STEP 4 — RECONCILE THE NUMBERS:
- Check that the reported macros are plausible for the identified food and portion.
- As a sanity check, 4 kcal/g protein + 4 kcal/g carbs + 9 kcal/g fat should be reasonably close to the reported calories.
- Small differences are expected because fiber, rounding, sugar alcohols, and food composition can affect calorie totals.
- If the first estimate produces a large calorie/macro mismatch, revise the MACROS AND/OR CALORIES before returning the result.
- Never report a calorie number that is obviously incompatible with the reported macros.
- The calorie total must represent the same portion as the macro values.

ACCURACY / UNCERTAINTY:
- A photograph cannot provide laboratory precision. Give the best defensible estimate rather than false precision.
- When portion size is uncertain, use visual evidence and choose a reasonable midpoint instead of an extreme guess.
- Do not invent a brand, recipe, ingredient, or exact nutrition label.
- Previous corrections below are reference examples only. Use them only when the same food is visibly present and the portion is comparable.

Return ONLY valid JSON.
Do not use Markdown.
Do not add commentary outside the JSON.
Do not wrap the JSON in code fences.

Return exactly this structure:

{
  "foods": [
    {
      "food_name": "specific food name",
      "serving_size": "estimated visible portion",
      "calories": 0,
      "protein_g": 0,
      "carbs_g": 0,
      "fat_g": 0
    }
  ]
}

Before returning JSON, internally double-check:
1. The portion matches what is visible.
2. Every major visible calorie source is accounted for.
3. The macros are plausible for that food.
4. Calories and macros are reasonably reconciled.

${buildMemoryContext()}
`;
}


function buildBarcodePrompt() {
  return `
You are Kael's nutrition-label analysis system for Washek Fitness.

Analyze the supplied food package or Nutrition Facts image.

When the Nutrition Facts label is readable:
- use the printed serving size
- use the printed calories
- use the printed protein
- use the printed carbohydrates
- use the printed fat

Do NOT invent printed nutrition values.

If the exact product or label cannot be read, make that clear in the product name rather than pretending certainty.

Return ONLY valid JSON.

Do not use Markdown.
Do not add commentary outside the JSON.

Return exactly:

{
  "food_name": "product name",
  "serving_size": "serving size",
  "calories": 0,
  "protein_g": 0,
  "carbs_g": 0,
  "fat_g": 0
}

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
  ] =
    useState(
      false
    );

  const [
    scanMode,
    setScanMode,
  ] =
    useState(
      null
    );

  const [
    pendingFoods,
    setPendingFoods,
  ] =
    useState(
      null
    );

  const [
    error,
    setError,
  ] =
    useState(
      ''
    );

  const inputRef =
    useRef(
      null
    );


  /*
   * ----------------------------------------------------------
   * ACCESS
   * ----------------------------------------------------------
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
   * ----------------------------------------------------------
   * RESET INPUT
   * ----------------------------------------------------------
   */

  const resetFileInput =
    () => {
      if (
        inputRef.current
      ) {
        inputRef.current.value =
          '';
      }
    };


  /*
   * ----------------------------------------------------------
   * OPEN CAMERA/GALLERY
   * ----------------------------------------------------------
   */

  const openScanner =
    (
      mode
    ) => {
      setError(
        ''
      );

      setScanMode(
        mode
      );

      window.setTimeout(
        () => {
          inputRef.current?.click();
        },
        50
      );
    };


  /*
   * ==========================================================
   * FOOD PHOTO
   * ==========================================================
   */

  const handleFoodPhoto =
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

      if (
        snapLocked
      ) {
        setError(
          'Food scanning is available on the Progress plan and above.'
        );

        resetFileInput();

        return;
      }

      setScanning(
        true
      );

      setScanMode(
        'photo'
      );

      setError(
        ''
      );

      try {
        /*
         * ------------------------------------------------------
         * VALIDATE IMAGE
         * ------------------------------------------------------
         */

        if (
          !file.type.startsWith(
            'image/'
          )
        ) {
          throw new Error(
            'Please choose an image of your food.'
          );
        }


        /*
         * ------------------------------------------------------
         * UPLOAD
         * ------------------------------------------------------
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


        /*
         * ------------------------------------------------------
         * AI REQUEST
         *
         * NO response_json_schema HERE.
         *
         * This is the actual fix for the OpenRouter 404:
         *
         * "No endpoints found that can handle the requested
         * parameters."
         * ------------------------------------------------------
         */

        console.log(
          '[FoodScanner] Starting food image analysis.'
        );

        const rawResult =
          await supabaseApi.ai.invoke(
            {
              type:
                'food_scan',

              prompt:
                buildFoodPrompt(),

              file_urls: [
                imageUrl,
              ],
            }
          );


        /*
         * ------------------------------------------------------
         * PARSE MODEL OUTPUT
         * ------------------------------------------------------
         */

        const parsedResult =
          parseFoodAIResult(
            rawResult
          );

        if (
          !parsedResult
        ) {
          throw new Error(
            'Kael returned an unreadable food analysis. Please try another photo.'
          );
        }


        const foods =
          normalizeFoods(
            parsedResult
          );


        if (
          !foods.length
        ) {
          throw new Error(
            'Kael could not identify any food items in that photo. Try a clearer photo with the entire meal visible.'
          );
        }


        /*
         * ------------------------------------------------------
         * SAVE MEMORY
         * ------------------------------------------------------
         */

        saveFoodMemory(
          foods
        );


        /*
         * ------------------------------------------------------
         * OPEN EDIT/CONFIRMATION
         * ------------------------------------------------------
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
          '[FoodScanner] Food scan failed:',
          caught
        );

        setError(
          caught?.message ||
            'Food analysis failed. Please try again.'
        );
      } finally {
        setScanning(
          false
        );

        setScanMode(
          null
        );

        resetFileInput();
      }
    };


  /*
   * ==========================================================
   * BARCODE / PACKAGE PHOTO
   * ==========================================================
   */

  const handleBarcodePhoto =
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

      if (
        barcodeLocked
      ) {
        setError(
          'Package scanning is available on the Progress plan and above.'
        );

        resetFileInput();

        return;
      }

      setScanning(
        true
      );

      setScanMode(
        'barcode'
      );

      setError(
        ''
      );

      try {
        if (
          !file.type.startsWith(
            'image/'
          )
        ) {
          throw new Error(
            'Please choose an image of the package or nutrition label.'
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


        /*
         * Same fix here:
         * no structured-output schema.
         */

        const rawResult =
          await supabaseApi.ai.invoke(
            {
              type:
                'food_barcode',

              prompt:
                buildBarcodePrompt(),

              file_urls: [
                imageUrl,
              ],
            }
          );


        const parsedResult =
          parseFoodAIResult(
            rawResult
          );


        if (
          !parsedResult
        ) {
          throw new Error(
            'Kael returned an unreadable label analysis. Try a clearer photo of the Nutrition Facts panel.'
          );
        }


        const foods =
          normalizeFoods(
            parsedResult
          );


        if (
          !foods.length
        ) {
          throw new Error(
            'Kael could not read that package. Try a clearer photo of the Nutrition Facts label.'
          );
        }


        saveFoodMemory(
          foods
        );


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
          '[FoodScanner] Package scan failed:',
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

        setScanMode(
          null
        );

        resetFileInput();
      }
    };


  /*
   * ==========================================================
   * FILE ROUTER
   * ==========================================================
   *
   * One hidden input is used for both modes.
   */

  const handleFileChange =
    async (
      event
    ) => {
      if (
        scanMode ===
        'barcode'
      ) {
        await handleBarcodePhoto(
          event
        );

        return;
      }

      await handleFoodPhoto(
        event
      );
    };


  /*
   * ==========================================================
   * CONFIRM FOOD
   * ==========================================================
   */

  const handleConfirm =
    async (
      items
    ) => {
      const foods =
        normalizeFoods(
          items
        );

      if (
        !foods.length
      ) {
        setError(
          'There were no valid food items to save.'
        );

        return;
      }

      setError(
        ''
      );

      try {
        /*
         * Wait for every database save to finish before closing
         * the review screen. If any save fails, keep the edited
         * values on screen so the user can retry.
         */
        for (
          const food of
          foods
        ) {
          await onFoodDetected(
            food
          );
        }

        /*
         * Only remember values after the database save succeeds.
         */
        saveFoodMemory(
          foods
        );

        setPendingFoods(
          null
        );
      } catch (
        caught
      ) {
        console.error(
          '[FoodScanner] Failed to save food to log:',
          caught
        );

        setError(
          caught?.message ||
            'Could not save the food to your log. Please try again.'
        );
      }
    };


  /*
   * ==========================================================
   * CANCEL EDIT
   * ==========================================================
   */

  const handleCancel =
    () => {
      setPendingFoods(
        null
      );

      setError(
        ''
      );
    };


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

        onCancel={
          handleCancel
        }
      />
    );
  }


  /*
   * ==========================================================
   * SCANNING UI
   * ==========================================================
   */

  if (
    scanning
  ) {
    return (
      <Card className="p-8 flex flex-col items-center gap-3">

        <Loader2 className="w-10 h-10 text-primary animate-spin" />

        <p className="font-heading font-bold">
          {scanMode ===
          'barcode'
            ? 'Reading your food label…'
            : 'Analyzing your food…'}
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
                {
                  error
                }
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
          inputRef
        }

        type="file"

        accept="image/*"

        capture="environment"

        className="hidden"

        onChange={
          handleFileChange
        }
      />


      <div className="grid grid-cols-2 gap-3">

        {/* SNAP FOOD */}

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
                ? 'opacity-60'
                : 'cursor-pointer hover:border-primary/40 active:scale-[0.98]'
            }
          `}

          onClick={() => {
            if (
              snapLocked
            ) {
              setError(
                'Food scanning is available on the Progress plan and above.'
              );

              return;
            }

            openScanner(
              'photo'
            );
          }}
        >

          <div
            className={`
              w-12
              h-12
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


        {/* SCAN PACKAGE */}

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
                ? 'opacity-60'
                : 'cursor-pointer hover:border-primary/40 active:scale-[0.98]'
            }
          `}

          onClick={() => {
            if (
              barcodeLocked
            ) {
              setError(
                'Package scanning is available on the Progress plan and above.'
              );

              return;
            }

            openScanner(
              'barcode'
            );
          }}
        >

          <div
            className={`
              w-12
              h-12
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
