import { useState } from 'react';

import {
  Button,
} from '@/components/ui/button';

import {
  Input,
} from '@/components/ui/input';

import {
  Card,
} from '@/components/ui/card';

import {
  Check,
  X,
  Plus,
  Trash2,
} from 'lucide-react';


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
    (foods || []).map(
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
      (previous) =>
        previous.map(
          (
            item,
            itemIndex
          ) =>
            itemIndex ===
            index
              ? {
                  ...item,
                  [field]:
                    field ===
                      'food_name' ||
                    field ===
                      'serving_size'
                      ? value
                      : parseFloat(
                          value
                        ) || 0,
                }
              : item
        )
    );
  };


  const addItem = () => {
    setItems(
      (previous) => [
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
      (previous) =>
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
        total,
        item
      ) =>
        total +
        (
          Number(
            item.calories
          ) || 0
        ),
      0
    );


  const validItems =
    items.filter(
      (item) =>
        item?.food_name
          ?.trim()
    );


  return (
    <div
      className="
        fixed
        inset-0
        z-[1000]
        bg-background/95
        backdrop-blur-sm
        flex
        flex-col
        overflow-hidden
        pointer-events-auto
      "
    >

      {/* =====================================================
          HEADER
          ===================================================== */}

      <div
        className="
          relative
          z-10
          shrink-0
          flex
          items-center
          justify-between
          px-5
          pt-[max(0.75rem,env(safe-area-inset-top))]
          pb-4
          border-b
          border-border
          bg-background
        "
      >

        <div>

          <h2 className="
            font-heading
            font-bold
            text-lg
          ">
            Review Scan
          </h2>

          <p className="
            text-xs
            text-muted-foreground
          ">
            Edit anything the AI got wrong
          </p>

        </div>


        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="
            relative
            z-20
            pointer-events-auto
            touch-manipulation
          "
          onClick={
            onCancel
          }
          aria-label="Close food review"
        >

          <X className="w-5 h-5 pointer-events-none" />

        </Button>

      </div>


      {/* =====================================================
          SCROLLING CONTENT
          ===================================================== */}

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
              className="
                p-4
                space-y-3
              "
            >

              <div className="
                flex
                items-center
                justify-between
              ">

                <p className="
                  text-xs
                  font-bold
                  text-muted-foreground
                  uppercase
                  tracking-wider
                ">
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
                      relative
                      z-10
                      p-2
                      -m-2
                      text-destructive
                      hover:opacity-70
                      pointer-events-auto
                      touch-manipulation
                    "
                    aria-label={`Remove item ${
                      index + 1
                    }`}
                  >
                    <Trash2 className="w-4 h-4 pointer-events-none" />
                  </button>

                )}

              </div>


              {/* Food name */}

              <div>

                <p className="
                  text-[11px]
                  text-muted-foreground
                  mb-1
                ">
                  Food Name
                </p>


                <Input
                  value={
                    item.food_name ||
                    ''
                  }
                  onChange={
                    (event) =>
                      update(
                        index,
                        'food_name',
                        event.target.value
                      )
                  }
                  className="
                    h-10
                    text-sm
                  "
                  placeholder="e.g. Grilled Chicken Breast"
                />

              </div>


              {/* Serving */}

              <div>

                <p className="
                  text-[11px]
                  text-muted-foreground
                  mb-1
                ">
                  Serving Size
                </p>


                <Input
                  value={
                    item.serving_size ||
                    ''
                  }
                  onChange={
                    (event) =>
                      update(
                        index,
                        'serving_size',
                        event.target.value
                      )
                  }
                  className="
                    h-10
                    text-sm
                  "
                  placeholder="e.g. 1 cup, 150g"
                />

              </div>


              {/* Macros */}

              <div className="
                grid
                grid-cols-2
                gap-2
              ">

                <div>

                  <p className="
                    text-[11px]
                    text-muted-foreground
                    mb-1
                  ">
                    Calories
                  </p>


                  <Input
                    type="number"
                    inputMode="decimal"
                    value={
                      item.calories ??
                      ''
                    }
                    onChange={
                      (event) =>
                        update(
                          index,
                          'calories',
                          event.target.value
                        )
                    }
                    className="
                      h-10
                      text-sm
                    "
                  />

                </div>


                <div>

                  <p className="
                    text-[11px]
                    text-muted-foreground
                    mb-1
                  ">
                    Protein (g)
                  </p>


                  <Input
                    type="number"
                    inputMode="decimal"
                    value={
                      item.protein_g ??
                      ''
                    }
                    onChange={
                      (event) =>
                        update(
                          index,
                          'protein_g',
                          event.target.value
                        )
                    }
                    className="
                      h-10
                      text-sm
                    "
                  />

                </div>


                <div>

                  <p className="
                    text-[11px]
                    text-muted-foreground
                    mb-1
                  ">
                    Carbs (g)
                  </p>


                  <Input
                    type="number"
                    inputMode="decimal"
                    value={
                      item.carbs_g ??
                      ''
                    }
                    onChange={
                      (event) =>
                        update(
                          index,
                          'carbs_g',
                          event.target.value
                        )
                    }
                    className="
                      h-10
                      text-sm
                    "
                  />

                </div>


                <div>

                  <p className="
                    text-[11px]
                    text-muted-foreground
                    mb-1
                  ">
                    Fat (g)
                  </p>


                  <Input
                    type="number"
                    inputMode="decimal"
                    value={
                      item.fat_g ??
                      ''
                    }
                    onChange={
                      (event) =>
                        update(
                          index,
                          'fat_g',
                          event.target.value
                        )
                    }
                    className="
                      h-10
                      text-sm
                    "
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
          className="
            relative
            z-10
            w-full
            h-10
            gap-2
            pointer-events-auto
            touch-manipulation
          "
          onClick={
            addItem
          }
        >

          <Plus className="w-4 h-4 pointer-events-none" />

          Add Another Item

        </Button>


        {/* Space above the footer */}

        <div className="h-4" />

      </div>


      {/* =====================================================
          CONFIRMATION FOOTER
          ===================================================== */}

      <div
        className="
          relative
          z-20
          shrink-0
          px-5
          pt-3
          bg-card
          border-t
          border-border
          shadow-[0_-8px_24px_rgba(0,0,0,0.30)]
        "
        style={{
          paddingBottom:
            'max(1rem, env(safe-area-inset-bottom))',
        }}
      >

        <div className="
          flex
          items-center
          justify-between
          mb-3
        ">

          <p className="
            text-sm
            text-muted-foreground
          ">
            Total
          </p>


          <p className="
            font-heading
            font-bold
            text-sm
          ">
            {Math.round(
              totalCals
            )}{' '}
            kcal ·{' '}
            {items.length}{' '}
            item
            {items.length !==
            1
              ? 's'
              : ''}
          </p>

        </div>


        <p className="
          text-[10px]
          text-muted-foreground
          mb-3
          leading-relaxed
        ">
          ⚠️ AI estimates are approximate and may not be 100% accurate.
          Portion sizes, cooking methods, and brand differences can affect
          values. Always verify with a nutrition label if precision matters.
        </p>


        <Button
          type="button"
          className="
            relative
            z-[30]
            w-full
            h-12
            min-h-12
            font-heading
            font-semibold
            gap-2
            pointer-events-auto
            touch-manipulation
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

          <Check className="w-4 h-4 pointer-events-none" />

          Save to Log

        </Button>

        <div className="h-1" />

      </div>

    </div>
  );
}
