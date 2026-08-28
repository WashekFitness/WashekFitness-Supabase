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
  if (
    !STRIPE_SECRET_KEY
  ) {
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

  if (
    !response.ok
  ) {
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
    status === 'active' ||
    status === 'trialing' ||
    status === 'past_due' ||
    status === 'unpaid'
  );
}

async function findBySubscriptionId(
  subscriptionId: string
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq(
        'stripe_subscription_id',
        subscriptionId
      )
      .maybeSingle();

  if (
    error
  ) {
    throw error;
  }

  return data;
}

async function findByCustomerId(
  customerId: string
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq(
        'stripe_customer_id',
        customerId
      )
      .maybeSingle();

  if (
    error
  ) {
    throw error;
  }

  return data;
}

async function findByEmail(
  email: string
) {
  if (
    !email
  ) {
    return null;
  }

  const normalized =
    email
      .trim()
      .toLowerCase();

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from('profiles')
      .select('*')
      .ilike(
        'email',
        normalized
      )
      .limit(1)
      .maybeSingle();

  if (
    error
  ) {
    throw error;
  }

  return data;
}

async function findStripeSubscription(
  profile: any,
  email: string
) {
  /*
   * 1. Saved subscription ID.
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
        return subscription;
      }
    } catch {
      // Continue.
    }
  }

  /*
   * 2. Saved Stripe customer ID.
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
      return subscription;
    }
  }

  /*
   * 3. Recover the Stripe customer by email.
   */
  if (
    email
  ) {
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
        return subscription;
      }
    }
  }

  return null;
}

async function setFree(
  userId: string,
  customerId: string | null
) {
  const {
    data,
    error,
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
        userId
      )
      .select()
      .single();

  if (
    error
  ) {
    throw error;
  }

  return data;
}

Deno.serve(
  async (req) => {
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
       * AUTHENTICATE USER
       * -------------------------------------------------------
       */

      const authHeader =
        req.headers.get(
          'Authorization'
        );

      if (
        !authHeader
      ) {
        return json(
          {
            success:
              false,

            error:
              'You must be signed in to cancel your subscription.',
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
       * GET PROFILE
       * -------------------------------------------------------
       */

      const {
        data: profile,
        error:
          profileError,
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
       * FIND THE ACTUAL STRIPE SUBSCRIPTION
       *
       * NOTICE:
       *
       * We deliberately DO NOT check
       * profile.subscription_plan first.
       *
       * Stripe is checked directly.
       * -------------------------------------------------------
       */

      const subscription =
        await findStripeSubscription(
          profile,
          email
        );

      /*
       * -------------------------------------------------------
       * NO STRIPE SUBSCRIPTION
       *
       * Clean up any stale local paid state.
       * -------------------------------------------------------
       */

      if (
        !subscription
      ) {
        const updated =
          await setFree(
            user.id,

            profile?.stripe_customer_id ||
              null
          );

        return json({
          success:
            true,

          alreadyFree:
            true,

          message:
            'No active Stripe subscription was found. Your Washek account is now on the Free Plan.',

          user:
            updated,
        });
      }

      const customerId =
        typeof subscription.customer ===
        'string'
          ? subscription.customer
          : profile?.stripe_customer_id ||
            null;

      /*
       * -------------------------------------------------------
       * IMMEDIATE STRIPE CANCELLATION
       *
       * No cancel_at_period_end.
       *
       * The subscription is terminated now.
       * -------------------------------------------------------
       */

      let canceled =
        subscription;

      if (
        canCancel(
          subscription.status
        )
      ) {
        canceled =
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
       * IMMEDIATELY REMOVE PAID ACCESS
       * -------------------------------------------------------
       */

      const updated =
        await setFree(
          user.id,
          customerId
        );

      return json({
        success:
          true,

        message:
          'Your subscription has been cancelled immediately.',

        stripe_status:
          canceled?.status ||
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
