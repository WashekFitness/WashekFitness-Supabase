import { useState } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

import {
  Check,
  X,
  Plus,
  Trash2,
} from 'lucide-react';


/**
 * Shown after AI scans food.
 * Lets the user review/edit macros before saving.
 */
export default function FoodEditModal({
  foods,
  imageUrl,
  onConfirm,
  onCancel,
}) {
  const [
    items,
    setItems,
  ] = useState(
    foods.map(
      (food) => ({
        ...food,
        image_url:
          imageUrl,
      })
    )
  );


  const update = (
    index,
    field,
    value
  ) => {
    setItems(
      (
        previous
      ) =>
        previous.map(
          (
            item,
            itemIndex
          ) => {
            if (
              itemIndex !==
              index
            ) {
              return item;
            }

            return {
              ...item,

              [field]:
                field ===
                  'food_name' ||
                field ===
                  'serving_size'
                  ? value
                  : (
                      parseFloat(
                        value
                      ) || 0
                    ),
            };
          }
        )
    );
  };


  const addItem = () => {
    setItems(
      (
        previous
      ) => [
        ...previous,

        {
          food_name:
            '',

          serving_size:
            '1 serving',

          calories:
            0,

          protein_g:
            0,

          carbs_g:
            0,

          fat_g:
            0,

          image_url:
            imageUrl,
        },
      ]
    );
  };


  const removeItem = (
    index
  ) => {
    setItems(
      (
        previous
      ) =>
        previous.filter(
          (
            _,
            itemIndex
          ) =>
            itemIndex !==
            index
        )
    );
  };


  const totalCals =
    items.reduce(
      (
        sum,
        item
      ) =>
        sum +
        (
          Number(
            item.calories
          ) || 0
        ),
      0
    );


  const validItems =
    items.filter(
      item =>
        item.food_name
          ?.trim()
    );


  return createPortal(
    <div
      className="
        fixed
        inset-0
        z-[10000]
        bg-background/95
        backdrop-blur-sm
        flex
        flex-col
        overflow-hidden
      "
    >

      {/* -------------------------------------------------- */}
      {/* HEADER */}
      {/* -------------------------------------------------- */}

      <div
        className="
          flex
          items-center
          justify-between
          px-5
          pt-[max(1rem,env(safe-area-inset-top))]
          pb-4
          border-b
          border-border
          bg-background
          shrink-0
        "
      >

        <div>
          <h2 className="font-heading font-bold text-lg">
            Review Scan
          </h2>

          <p className="text-xs text-muted-foreground">
            Edit anything the AI got wrong
          </p>
        </div>


        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={
            onCancel
          }
        >
          <X className="w-5 h-5" />
        </Button>

      </div>


      {/* -------------------------------------------------- */}
      {/* SCROLLING FOOD LIST */}
      {/* -------------------------------------------------- */}

      <div
        className="
          flex-1
          min-h-0
          overflow-y-auto
          overscroll-contain
          px-5
          py-4
          space-y-4
        "
      >

        {items.map(
          (
            item,
            index
          ) => (

            <Card
              key={
                index
              }
              className="p-4 space-y-3"
            >

              <div className="flex items-center justify-between">

                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Item {index + 1}
                </p>


                {items.length >
                  1 && (

                  <button
                    type="button"
                    onClick={() =>
                      removeItem(
                        index
                      )
                    }
                    className="
                      text-destructive
                      hover:opacity-70
                      p-2
                      -m-2
                    "
                    aria-label={`Remove item ${
                      index + 1
                    }`}
                  >

                    <Trash2 className="w-4 h-4" />

                  </button>

                )}

              </div>


              <div>

                <p className="text-[11px] text-muted-foreground mb-1">
                  Food Name
                </p>

                <Input
                  value={
                    item.food_name ||
                    ''
                  }
                  onChange={e =>
                    update(
                      index,
                      'food_name',
                      e.target.value
                    )
                  }
                  className="h-10 text-sm"
                  placeholder="e.g. Grilled Chicken Breast"
                />

              </div>


              <div>

                <p className="text-[11px] text-muted-foreground mb-1">
                  Serving Size
                </p>

                <Input
                  value={
                    item.serving_size ||
                    ''
                  }
                  onChange={e =>
                    update(
                      index,
                      'serving_size',
                      e.target.value
                    )
                  }
                  className="h-10 text-sm"
                  placeholder="e.g. 1 cup, 150g"
                />

              </div>


              <div className="grid grid-cols-2 gap-2">

                <div>

                  <p className="text-[11px] text-muted-foreground mb-1">
                    Calories
                  </p>

                  <Input
                    type="number"
                    inputMode="decimal"
                    value={
                      item.calories ??
                      ''
                    }
                    onChange={e =>
                      update(
                        index,
                        'calories',
                        e.target.value
                      )
                    }
                    className="h-10 text-sm"
                  />

                </div>


                <div>

                  <p className="text-[11px] text-muted-foreground mb-1">
                    Protein (g)
                  </p>

                  <Input
                    type="number"
                    inputMode="decimal"
                    value={
                      item.protein_g ??
                      ''
                    }
                    onChange={e =>
                      update(
                        index,
                        'protein_g',
                        e.target.value
                      )
                    }
                    className="h-10 text-sm"
                  />

                </div>


                <div>

                  <p className="text-[11px] text-muted-foreground mb-1">
                    Carbs (g)
                  </p>

                  <Input
                    type="number"
                    inputMode="decimal"
                    value={
                      item.carbs_g ??
                      ''
                    }
                    onChange={e =>
                      update(
                        index,
                        'carbs_g',
                        e.target.value
                      )
                    }
                    className="h-10 text-sm"
                  />

                </div>


                <div>

                  <p className="text-[11px] text-muted-foreground mb-1">
                    Fat (g)
                  </p>

                  <Input
                    type="number"
                    inputMode="decimal"
                    value={
                      item.fat_g ??
                      ''
                    }
                    onChange={e =>
                      update(
                        index,
                        'fat_g',
                        e.target.value
                      )
                    }
                    className="h-10 text-sm"
                  />

                </div>

              </div>

            </Card>

          )
        )}


        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full h-10 gap-2"
          onClick={
            addItem
          }
        >

          <Plus className="w-4 h-4" />

          Add Another Item

        </Button>


        {/* Extra space so the last item is never hidden behind
            the fixed confirmation bar. */}

        <div className="h-4" />

      </div>


      {/* -------------------------------------------------- */}
      {/* CONFIRMATION FOOTER */}
      {/* -------------------------------------------------- */}

      <div
        className="
          shrink-0
          px-5
          pt-3
          border-t
          border-border
          bg-card
          shadow-[0_-8px_24px_rgba(0,0,0,0.22)]
        "
        style={{
          paddingBottom:
            'max(1rem, env(safe-area-inset-bottom))',
        }}
      >

        <div className="flex items-center justify-between mb-3">

          <p className="text-sm text-muted-foreground">
            Total
          </p>

          <p className="font-heading font-bold text-sm">
            {Math.round(
              totalCals
            )}{' '}
            kcal · {items.length}{' '}
            item
            {items.length !==
            1
              ? 's'
              : ''}
          </p>

        </div>


        <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
          ⚠️ AI estimates are approximate and may not be 100% accurate.
          Portion sizes, cooking methods, and brand differences can affect
          values. Always verify with a nutrition label if precision matters.
        </p>


        <Button
          type="button"
          className="
            w-full
            h-12
            min-h-12
            font-heading
            font-semibold
            gap-2
            mb-1
          "
          onClick={() =>
            onConfirm(
              validItems
            )
          }
          disabled={
            validItems.length ===
            0
          }
        >

          <Check className="w-4 h-4" />

          Save to Log

        </Button>

      </div>

    </div>,
    document.body
  );
}
