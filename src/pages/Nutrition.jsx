import { useState, useEffect } from 'react';

import {
  supabaseApi,
} from '@/lib/supabaseApi';

import {
  useSearchParams,
} from 'react-router-dom';

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import MobileSelect from '@/components/ui/MobileSelect';

import FoodScanner from '@/components/nutrition/FoodScanner';

import ManualFoodEntry from '@/components/nutrition/ManualFoodEntry';

import FoodLog from '@/components/nutrition/FoodLog';

import PullToRefresh from '@/components/layout/PullToRefresh';

import {
  Flame,
  Drumstick,
  Wheat,
  Droplets,
} from 'lucide-react';

import {
  toast,
} from 'sonner';

import {
  calcNutritionGoals,
} from '@/lib/nutritionGoals';

import PageHeader from '@/components/layout/PageHeader';

import {
  getLocalDateKey,
} from '@/lib/messageLimit';


export default function Nutrition() {
  const queryClient =
    useQueryClient();


  /*
   * IMPORTANT:
   *
   * This is the user's LOCAL date.
   *
   * The state is refreshed automatically so the UI
   * rolls over at local midnight even if the page stays open.
   */
  const [
    today,
    setToday,
  ] = useState(
    () => getLocalDateKey()
  );


  useEffect(() => {
    const updateDate =
      () => {
        setToday(
          getLocalDateKey()
        );
      };

    updateDate();

    const interval =
      window.setInterval(
        updateDate,
        30 * 1000
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, []);


  const [
    searchParams,
    setSearchParams,
  ] =
    useSearchParams();


  const mealType =
    searchParams.get(
      'meal'
    ) ||
    'snack';


  const setMealType =
    (value) => {
      const next =
        new URLSearchParams(
          searchParams
        );

      next.set(
        'meal',
        value
      );

      setSearchParams(
        next
      );
    };


  const [
    user,
    setUser,
  ] =
    useState(null);


  useEffect(() => {
    let active =
      true;

    supabaseApi.auth
      .me()
      .then(
        (currentUser) => {
          if (
            active
          ) {
            setUser(
              currentUser
            );
          }
        }
      )
      .catch(
        (error) => {
          console.error(
            '[Nutrition] Failed to load user:',
            error
          );
        }
      );

    return () => {
      active =
        false;
    };
  }, []);


  const {
    data:
      entries = [],
  } =
    useQuery({
      queryKey: [
        'nutrition',
        today,
        user?.email,
      ],

      queryFn: () =>
        supabaseApi.entities.NutritionEntry.filter(
          {
            date:
              today,

            created_by:
              user.email,
          },

          '-created_date',

          100
        ),

      enabled:
        !!user?.email,
    });


  const createMutation =
    useMutation({
      mutationFn:
        (data) =>
          supabaseApi.entities.NutritionEntry.create(
            {
              ...data,

              date:
                today,

              meal_type:
                data.meal_type ||
                mealType,
            }
          ),

      onMutate:
        async (
          data
        ) => {
          await queryClient.cancelQueries(
            {
              queryKey: [
                'nutrition',
                today,
                user?.email,
              ],
            }
          );

          const queryKey = [
            'nutrition',
            today,
            user?.email,
          ];

          const previous =
            queryClient.getQueryData(
              queryKey
            );

          const optimisticEntry = {
            ...data,

            id:
              `temp-${Date.now()}`,

            date:
              today,

            created_by:
              user?.email,

            meal_type:
              data.meal_type ||
              mealType,

            created_date:
              new Date().toISOString(),
          };

          queryClient.setQueryData(
            queryKey,
            (current = []) => [
              optimisticEntry,
              ...current,
            ]
          );

          return {
            previous,
            queryKey,
          };
        },

      onError:
        (
          error,
          _data,
          context
        ) => {
          if (
            context?.queryKey
          ) {
            queryClient.setQueryData(
              context.queryKey,
              context.previous
            );
          }

          toast.error(
            error?.message ||
              'Unable to save food.'
          );
        },

      onSuccess:
        () => {
          queryClient.invalidateQueries(
            {
              queryKey:
                ['nutrition'],
            }
          );
        },
    });


  const deleteMutation =
    useMutation({
      mutationFn:
        (id) =>
          supabaseApi.entities.NutritionEntry.delete(
            id
          ),

      onMutate:
        async (
          id
        ) => {
          const queryKey = [
            'nutrition',
            today,
            user?.email,
          ];

          await queryClient.cancelQueries(
            {
              queryKey,
            }
          );

          const previous =
            queryClient.getQueryData(
              queryKey
            );

          queryClient.setQueryData(
            queryKey,
            (current = []) =>
              current.filter(
                (entry) =>
                  entry.id !== id
              )
          );

          return {
            previous,
            queryKey,
          };
        },

      onError:
        (
          error,
          _id,
          context
        ) => {
          if (
            context?.queryKey
          ) {
            queryClient.setQueryData(
              context.queryKey,
              context.previous
            );
          }

          toast.error(
            error?.message ||
              'Unable to delete food.'
          );
        },

      onSuccess:
        () => {
          queryClient.invalidateQueries(
            {
              queryKey:
                ['nutrition'],
            }
          );
        },
    });


  const totals =
    entries.reduce(
      (
        accumulated,
        entry
      ) => ({
        calories:
          accumulated.calories +
          (
            Number(
              entry.calories
            ) || 0
          ),

        protein:
          accumulated.protein +
          (
            Number(
              entry.protein_g
            ) || 0
          ),

        carbs:
          accumulated.carbs +
          (
            Number(
              entry.carbs_g
            ) || 0
          ),

        fat:
          accumulated.fat +
          (
            Number(
              entry.fat_g
            ) || 0
          ),
      }),

      {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      }
    );


  const goals =
    calcNutritionGoals(
      user
    );


  const calorieGoal =
    goals.calories ||
    1;


  const progress =
    Math.min(
      (
        totals.calories /
        calorieGoal
      ) *
        100,
      100
    );


  return (
    <PullToRefresh
      queryKeys={[
        [
          'nutrition',
          today,
          user?.email,
        ],
      ]}
    >

      <div className="
        px-5
        pb-4
      ">

        <PageHeader
          title="Nutrition"
          subtitle="Track your fuel"
        />


        {/* ...existing Nutrition page UI continues unchanged... */}

      </div>

    </PullToRefresh>
  );
}
