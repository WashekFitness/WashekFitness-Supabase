import { useEffect, useRef } from 'react';

import {
  supabaseApi,
} from '@/lib/supabaseApi';

import {
  supabase,
} from '@/lib/supabase';

import {
  ensureCurrentProgramWeek,
} from '@/lib/programWeekGeneration';


export default function ProgramWeekBootstrap() {
  const runningRef =
    useRef(false);

  const lastRunRef =
    useRef(null);


  useEffect(() => {
    let mounted =
      true;


    async function run() {
      if (
        runningRef.current
      ) {
        return;
      }

      runningRef.current =
        true;

      try {
        const user =
          await supabaseApi.auth.me();

        if (
          !mounted ||
          !user?.id ||
          !user?.onboarded
        ) {
          return;
        }

        /*
         * Find the user's active program directly by user ID.
         */

        const {
          data: programs,
          error,
        } =
          await supabase
            .from('workout_programs')
            .select('*')
            .eq(
              'user_id',
              user.id
            )
            .eq(
              'status',
              'active'
            )
            .order(
              'created_at',
              {
                ascending:
                  false,
              }
            )
            .limit(1);

        if (error) {
          throw error;
        }

        const program =
          programs?.[0];

        if (
          !program
        ) {
          return;
        }

        /*
         * Use the program ID + current week as the identity of
         * the check that was performed.
         *
         * IMPORTANT:
         * We do not set this until the generation/check completes
         * successfully. If generation fails, the next scheduled
         * check is allowed to try again.
         */

        const runKey =
          `${program.id}:${program.current_week}`;

        if (
          lastRunRef.current ===
          runKey
        ) {
          return;
        }

        console.log(
          '[ProgramWeekBootstrap] Checking calendar week...'
        );

        const result =
          await ensureCurrentProgramWeek(
            program,
            user
          );

        if (
          !mounted
        ) {
          return;
        }

        /*
         * Mark this program/week as checked only after
         * ensureCurrentProgramWeek() finishes successfully.
         *
         * This prevents a failed generation attempt from being
         * permanently suppressed for the rest of the session.
         */

        lastRunRef.current =
          runKey;

        if (
          result?.generated
        ) {
          console.log(
            '[ProgramWeekBootstrap] New program week generated:',
            result.targetWeek
          );
        } else {
          console.log(
            '[ProgramWeekBootstrap] Program week is up to date.'
          );
        }
      } catch (error) {
        /*
         * Weekly generation must never prevent the rest of the
         * app from loading.
         *
         * Because lastRunRef is NOT updated when an error occurs,
         * the next scheduled check can retry the generation.
         */

        console.error(
          '[ProgramWeekBootstrap] Weekly generation failed:',
          error
        );
      } finally {
        runningRef.current =
          false;
      }
    }


    run();


    /*
     * Check periodically while the app remains open.
     *
     * This catches the transition into a new calendar week
     * without requiring the athlete to close and reopen the app.
     */

    const interval =
      window.setInterval(
        () => {
          /*
           * Allow another calendar-week check.
           *
           * The program is re-fetched before generation, so this
           * also picks up changes made elsewhere in the app.
           */

          lastRunRef.current =
            null;

          run();
        },
        60 * 1000
      );


    const handleVisibility =
      () => {
        if (
          document.visibilityState ===
          'visible'
        ) {
          lastRunRef.current =
            null;

          run();
        }
      };


    document.addEventListener(
      'visibilitychange',
      handleVisibility
    );


    return () => {
      mounted =
        false;

      window.clearInterval(
        interval
      );

      document.removeEventListener(
        'visibilitychange',
        handleVisibility
      );
    };
  }, []);


  /*
   * This component intentionally renders nothing.
   */

  return null;
}
