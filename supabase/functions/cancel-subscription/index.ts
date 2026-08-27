import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const STRIPE_SECRET_KEY =
  Deno.env.get('STRIPE_SECRET_KEY') || '';

const SUPABASE_URL =
  Deno.env.get('SUPABASE_URL') || '';

const SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

function json(body: unknown, status = 200) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: corsHeaders,
    }
  );
}

async function stripe(
  path: string,
  options: RequestInit = {}
) {
  if (!STRIPE_SECRET_KEY) {
    throw new Error(
      'Stripe is not configured on the server.'
    );
  }

  const response = await fetch(
    `https://api.stripe.com/v1/${path}`,
    {
      ...options,

      headers: {
        Authorization:
          `Bearer ${STRIPE_SECRET_KEY}`,

        'Content-Type':
          'application/x-www-form-urlencoded',

        ...(options.headers || {}),
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        'Stripe request failed.'
    );
  }

  return data;
}

function isPaidStatus(
  status: string
) {
  return (
    status === 'active' ||
    status === 'trialing'
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return json(
      {
        success: false,
        error: 'Method not allowed.',
      },
      405
    );
  }

  try {
    const authHeader =
      req.headers.get(
        'Authorization'
      );

    if (!authHeader) {
      return json(
        {
          success: false,
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
          success: false,
          error:
            'Your session is invalid or expired.',
        },
        401
      );
    }

    const userId =
      authData.user.id;

    const email =
      authData.user.email || '';

    const {
      data: profile,
      error: profileError,
    } =
      await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (profileError) {
      throw new Error(
        'Unable to load your subscription.'
      );
    }

    const currentPlan =
      profile.subscription_plan ||
      'free';

    if (currentPlan === 'free') {
      return json({
        success: true,
        message:
          'You are already on the Free Plan.',
        user: {
          ...profile,
          subscription_plan:
            'free',
        },
      });
    }

    let subscriptionId =
      profile.stripe_subscription_id ||
      null;

    let customerId =
      profile.stripe_customer_id ||
      null;

    let subscription = null;

    if (subscriptionId) {
      try {
        subscription =
          await stripe(
            `subscriptions/${encodeURIComponent(
              subscriptionId
            )}`
          );
      } catch {
        subscription = null;
      }
    }

    if (
      !subscription &&
      customerId
    ) {
      const list =
        await stripe(
          `subscriptions?customer=${encodeURIComponent(
            customerId
          )}&status=all&limit=20`
        );

      subscription =
        (list.data || []).find(
          (item: any) =>
            isPaidStatus(
              item.status
            ) ||
            item.status ===
              'past_due'
        ) || null;
    }

    /*
     * Recover subscriptions created before
     * the new Stripe IDs were added to profiles.
     */
    if (
      !subscription &&
      email
    ) {
      const customers =
        await stripe(
          `customers?email=${encodeURIComponent(
            email
          )}&limit=20`
        );

      for (
        const customer of
        customers.data || []
      ) {
        const list =
          await stripe(
            `subscriptions?customer=${encodeURIComponent(
              customer.id
            )}&status=all&limit=20`
          );

        const candidate =
          (list.data || []).find(
            (item: any) =>
              isPaidStatus(
                item.status
              ) ||
              item.status ===
                'past_due'
          );

        if (candidate) {
          customerId =
            customer.id;

          subscription =
            candidate;

          subscriptionId =
            candidate.id;

          break;
        }
      }
    }

    /*
     * If the user is marked paid but Stripe
     * has no subscription, remove the stale
     * paid entitlement.
     */
    if (!subscription) {
      const {
        data: updated,
        error,
      } =
        await supabaseAdmin
          .from('profiles')
          .update({
            subscription_plan:
              'free',

            stripe_customer_id:
              null,

            stripe_subscription_id:
              null,

            subscription_status:
              'canceled',

            subscription_cancelled_at:
              new Date().toISOString(),

            updated_at:
              new Date().toISOString(),
          })
          .eq('id', userId)
          .select()
          .single();

      if (error) {
        throw error;
      }

      return json({
        success: true,
        message:
          'No active Stripe subscription was found. Your account has been returned to Free.',
        user: updated,
      });
    }

    customerId =
      customerId ||
      subscription.customer ||
      null;

    subscriptionId =
      subscription.id;

    /*
     * DELETE /subscriptions/:id cancels
     * immediately.
     */
    if (
      isPaidStatus(
        subscription.status
      ) ||
      subscription.status ===
        'past_due'
    ) {
      await stripe(
        `subscriptions/${encodeURIComponent(
          subscriptionId
        )}`,
        {
          method: 'DELETE',
        }
      );
    }

    const {
      data: updated,
      error: updateError,
    } =
      await supabaseAdmin
        .from('profiles')
        .update({
          subscription_plan:
            'free',

          stripe_customer_id:
            customerId,

          stripe_subscription_id:
            null,

          subscription_status:
            'canceled',

          subscription_cancelled_at:
            new Date().toISOString(),

          updated_at:
            new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

    if (updateError) {
      throw updateError;
    }

    return json({
      success: true,
      message:
        'Subscription cancelled immediately.',
      user: updated,
    });
  } catch (error) {
    console.error(
      'cancel-subscription error:',
      error
    );

    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to cancel your subscription.',
      },
      400
    );
  }
});
