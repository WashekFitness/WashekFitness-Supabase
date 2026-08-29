import {
  createClient,
} from 'https://esm.sh/@supabase/supabase-js@2';

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

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get(
    'SUPABASE_SERVICE_ROLE_KEY'
  ) || '';

const supabaseAdmin =
  createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
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
  return [
    'active',
    'trialing',
    'past_due',
    'unpaid',
  ].includes(status);
}

async function findSubscription(
  profile: any,
  email: string
) {
  /*
   * Saved subscription ID.
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
   * Saved customer ID.
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
      (result?.data || [])
        .find(
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
   * Recover using the authenticated user's email.
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
      customers?.data ||
      []
    ) {
      const result =
        await stripe(
          `subscriptions?customer=${encodeURIComponent(
            customer.id
          )}&status=all&limit=50`
        );

      const subscription =
        (result?.data || [])
          .find(
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
       * =====================================================
       * AUTH
       * =====================================================
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
              'You must be signed in.',
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
        data:
          authData,
        error:
          authError,
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
       * =====================================================
       * PROFILE
       * =====================================================
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
       * =====================================================
       * FIND THE REAL STRIPE SUBSCRIPTION
       * =====================================================
       */

      const subscription =
        await findSubscription(
          profile,
          email
        );

      /*
       * No active subscription.
       * Make the profile Free anyway so stale
       * data cannot keep paid features enabled.
       */
      if (
        !subscription
      ) {
        const {
          data:
            updated,
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

          user:
            updated,
        });
      }

      /*
       * =====================================================
       * IMMEDIATE STRIPE CANCELLATION
       * =====================================================
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

      const customerId =
        typeof subscription.customer ===
        'string'
          ? subscription.customer
          : profile?.stripe_customer_id ||
            null;

      /*
       * =====================================================
       * REMOVE PAID ACCESS IMMEDIATELY
       * =====================================================
       */

      const {
        data:
          updated,
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
