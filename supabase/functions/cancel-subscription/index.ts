import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import {
  createClient,
} from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin':
    '*',

  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',

  'Access-Control-Allow-Methods':
    'POST, OPTIONS',

  'Content-Type':
    'application/json',
};

const STRIPE_SECRET_KEY =
  Deno.env.get(
    'STRIPE_SECRET_KEY'
  ) || '';

const SUPABASE_URL =
  Deno.env.get(
    'SUPABASE_URL'
  ) || '';

const SERVICE_ROLE_KEY =
  Deno.env.get(
    'SUPABASE_SERVICE_ROLE_KEY'
  ) || '';

const supabaseAdmin =
  createClient(
    SUPABASE_URL,
    SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession:
          false,

        autoRefreshToken:
          false,
      },
    }
  );

function json(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers:
        corsHeaders,
    }
  );
}

async function stripe(
  path: string,
  options: RequestInit = {}
) {
  if (!STRIPE_SECRET_KEY) {
    throw new Error(
      'STRIPE_SECRET_KEY is not configured in Supabase.'
    );
  }

  const response =
    await fetch(
      `https://api.stripe.com/v1/${path}`,
      {
        ...options,

        headers: {
          Authorization:
            `Bearer ${STRIPE_SECRET_KEY}`,

          'Content-Type':
            'application/x-www-form-urlencoded',

          ...(options.headers ||
            {}),
        },
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        'Stripe request failed.'
    );
  }

  return data;
}

function canCancel(
  status: string
) {
  return (
    status ===
      'active' ||
    status ===
      'trialing' ||
    status ===
      'past_due' ||
    status ===
      'unpaid'
  );
}

/*
 * Find the current Stripe subscription
 * for this exact authenticated user.
 *
 * We try several sources because some existing
 * Washek test accounts may have been created
 * before Stripe IDs were stored on profiles.
 */
async function findSubscription(
  profile: any,
  email: string
) {
  /*
   * ---------------------------------------------------------
   * 1. Saved Stripe subscription ID
   * ---------------------------------------------------------
   */

  if (
    profile?.stripe_subscription_id
  ) {
    try {
      const subscription =
        await stripe(
          `subscriptions/${encodeURIComponent(
            profile.stripe_subscription_id
          )}`
        );

      if (
        subscription &&
        canCancel(
          subscription.status
        )
      ) {
        return {
          subscription,
          customerId:
            typeof subscription.customer ===
            'string'
              ? subscription.customer
              : profile?.stripe_customer_id ||
                null,
        };
      }
    } catch {
      // Continue searching.
    }
  }

  /*
   * ---------------------------------------------------------
   * 2. Saved Stripe customer ID
   * ---------------------------------------------------------
   */

  if (
    profile?.stripe_customer_id
  ) {
    const result =
      await stripe(
        `subscriptions?customer=${encodeURIComponent(
          profile.stripe_customer_id
        )}&status=all&limit=50`
      );

    const subscription =
      (result?.data || []).find(
        (item: any) =>
          canCancel(
            item.status
          )
      );

    if (
      subscription
    ) {
      return {
        subscription,
        customerId:
          profile.stripe_customer_id,
      };
    }
  }

  /*
   * ---------------------------------------------------------
   * 3. Stripe customer lookup by authenticated
   *    Washek account email.
   * ---------------------------------------------------------
   *
   * This is the important recovery path for
   * subscriptions created before we saved IDs.
   * ---------------------------------------------------------
   */

  if (email) {
    const customers =
      await stripe(
        `customers?email=${encodeURIComponent(
          email
        )}&limit=50`
      );

    for (
      const customer of
        customers?.data || []
    ) {
      const result =
        await stripe(
          `subscriptions?customer=${encodeURIComponent(
            customer.id
          )}&status=all&limit=50`
        );

      const subscription =
        (result?.data || []).find(
          (item: any) =>
            canCancel(
              item.status
            )
        );

      if (
        subscription
      ) {
        return {
          subscription,
          customerId:
            customer.id,
        };
      }
    }
  }

  return null;
}

Deno.serve(
  async (req) => {
    /*
     * CORS preflight.
     */
    if (
      req.method ===
      'OPTIONS'
    ) {
      return new Response(
        'ok',
        {
          headers:
            corsHeaders,
        }
      );
    }

    if (
      req.method !==
      'POST'
    ) {
      return json(
        {
          success:
            false,

          error:
            'Method not allowed.',
        },
        405
      );
    }

    try {
      /*
       * -------------------------------------------------------
       * Authenticate the Supabase user.
       * -------------------------------------------------------
       */

      const authHeader =
        req.headers.get(
          'Authorization'
        );

      if (!authHeader) {
        return json(
          {
            success:
              false,

            error:
              'You must be signed in to cancel a subscription.',
          },
          401
        );
      }

      const token =
        authHeader.replace(
          /^Bearer\s+/i,
          ''
        );

      const {
        data: authData,
        error: authError,
      } =
        await supabaseAdmin.auth.getUser(
          token
        );

      if (
        authError ||
        !authData?.user
      ) {
        return json(
          {
            success:
              false,

            error:
              'Your login session is invalid or expired.',
          },
          401
        );
      }

      const user =
        authData.user;

      /*
       * -------------------------------------------------------
       * Get this user's profile.
       * -------------------------------------------------------
       */

      const {
        data: profile,
        error: profileError,
      } =
        await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq(
            'id',
            user.id
          )
          .single();

      if (
        profileError
      ) {
        throw new Error(
          'Unable to load your Washek Fitness profile.'
        );
      }

      const email =
        profile?.email ||
        user.email ||
        '';

      /*
       * -------------------------------------------------------
       * IMPORTANT:
       *
       * We DO NOT check subscription_plan before
       * searching Stripe.
       *
       * The Stripe account is the source of truth.
       * -------------------------------------------------------
       */

      const found =
        await findSubscription(
          profile,
          email
        );

      /*
       * -------------------------------------------------------
       * No Stripe subscription exists.
       *
       * Clean up any stale paid state.
       * -------------------------------------------------------
       */

      if (!found) {
        const {
          data: updated,
          error:
            updateError,
        } =
          await supabaseAdmin
            .from('profiles')
            .update({
              subscription_plan:
                'free',

              subscription_status:
                'canceled',

              stripe_subscription_id:
                null,

              stripe_price_id:
                null,

              subscription_cancelled_at:
                new Date().toISOString(),

              subscription_updated_at:
                new Date().toISOString(),

              updated_at:
                new Date().toISOString(),
            })
            .eq(
              'id',
              user.id
            )
            .select()
            .single();

        if (
          updateError
        ) {
          throw updateError;
        }

        return json({
          success:
            true,

          alreadyCanceled:
            true,

          message:
            'No active Stripe subscription was found. Your Washek account is now on the Free Plan.',

          user:
            updated,
        });
      }

      const subscription =
        found.subscription;

      const customerId =
        found.customerId;

      /*
       * -------------------------------------------------------
       * IMMEDIATE CANCELLATION
       *
       * DELETE /subscriptions/:id means the
       * subscription ends immediately.
       *
       * We deliberately do NOT use:
       *
       * cancel_at_period_end=true
       * -------------------------------------------------------
       */

      let canceledSubscription =
        subscription;

      if (
        canCancel(
          subscription.status
        )
      ) {
        canceledSubscription =
          await stripe(
            `subscriptions/${encodeURIComponent(
              subscription.id
            )}`,
            {
              method:
                'DELETE',
            }
          );
      }

      /*
       * -------------------------------------------------------
       * Immediately revoke paid access in Washek.
       * -------------------------------------------------------
       */

      const {
        data: updated,
        error:
          updateError,
      } =
        await supabaseAdmin
          .from('profiles')
          .update({
            subscription_plan:
              'free',

            subscription_status:
              'canceled',

            stripe_customer_id:
              customerId,

            stripe_subscription_id:
              null,

            stripe_price_id:
              null,

            subscription_cancelled_at:
              new Date().toISOString(),

            subscription_updated_at:
              new Date().toISOString(),

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'id',
            user.id
          )
          .select()
          .single();

      if (
        updateError
      ) {
        throw updateError;
      }

      return json({
        success:
          true,

        message:
          'Your subscription has been cancelled immediately.',

        stripe_status:
          canceledSubscription?.status ||
          'canceled',

        subscription_id:
          subscription.id,

        user:
          updated,
      });
    } catch (
      error
    ) {
      console.error(
        'cancel-subscription error:',
        error
      );

      return json(
        {
          success:
            false,

          error:
            error instanceof Error
              ? error.message
              : 'Unable to cancel your subscription.',
        },
        400
      );
    }
  }
);
