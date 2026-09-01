import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due', 'unpaid'];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

async function stripe(path: string, options: RequestInit = {}) {
  if (!STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured in Supabase.');
  }

  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data: any = {};

  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      data?.error?.message || `Stripe returned HTTP ${response.status}.`
    );
  }

  return data;
}

function isActive(subscription: any) {
  return ACTIVE_STATUSES.includes(
    String(subscription?.status || '').toLowerCase()
  );
}

async function subscriptionsForCustomer(customerId: string) {
  const result = await stripe(
    `subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=100`
  );

  return Array.isArray(result?.data) ? result.data : [];
}

async function findSubscription(profile: any, user: any) {
  /* First use the exact subscription ID saved on the Washek profile. */
  if (profile?.stripe_subscription_id) {
    try {
      const saved = await stripe(
        `subscriptions/${encodeURIComponent(profile.stripe_subscription_id)}`
      );

      if (isActive(saved)) {
        return saved;
      }
    } catch {
      // Continue recovery below.
    }
  }

  const email = String(profile?.email || user?.email || '').trim().toLowerCase();

  if (!email) {
    return null;
  }

  const customerResult = await stripe(
    `customers?email=${encodeURIComponent(email)}&limit=100`
  );

  const customers = Array.isArray(customerResult?.data)
    ? customerResult.data
    : [];

  const matches: Array<{ customer: any; subscription: any }> = [];

  for (const customer of customers) {
    const subscriptions = await subscriptionsForCustomer(customer.id);

    for (const subscription of subscriptions) {
      if (isActive(subscription)) {
        matches.push({ customer, subscription });
      }
    }
  }

  /* Prefer metadata tied to this exact Washek user. */
  const exact = matches.find(
    ({ customer, subscription }) =>
      customer?.metadata?.user_id === user.id ||
      subscription?.metadata?.user_id === user.id
  );

  if (exact) {
    return exact.subscription;
  }

  /* Older subscriptions may have no user_id metadata. */
  return matches[0]?.subscription || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
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
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return json(
        {
          success: false,
          error: 'You must be signed in.',
        },
        401
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');

    const {
      data: authData,
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authData?.user) {
      return json(
        {
          success: false,
          error: 'Your login session is invalid or expired.',
        },
        401
      );
    }

    const user = authData.user;

    const {
      data: profile,
      error: profileError,
    } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new Error(
        'Unable to load your Washek Fitness profile.'
      );
    }

    const subscription = await findSubscription(profile, user);

    /* No live Stripe subscription: clean stale paid access. */
    if (!subscription) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          subscription_plan: 'free',
          subscription_status: 'canceled',
          stripe_subscription_id: null,
          stripe_price_id: null,
          subscription_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      return json({
        success: true,
        alreadyCanceled: true,
        user: updated,
      });
    }

    /* Immediately cancel the real Stripe subscription. */
    const canceled = await stripe(
      `subscriptions/${encodeURIComponent(subscription.id)}`,
      {
        method: 'DELETE',
      }
    );

    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id || profile?.stripe_customer_id || null;

    /* Remove paid access immediately in Washek. */
    const {
      data: updated,
      error: updateError,
    } = await supabaseAdmin
      .from('profiles')
      .update({
        subscription_plan: 'free',
        subscription_status: 'canceled',
        stripe_customer_id: customerId,
        stripe_subscription_id: null,
        stripe_price_id: null,
        subscription_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return json({
      success: true,
      message: 'Your subscription has been cancelled immediately.',
      stripe_status: canceled?.status || 'canceled',
      subscription_id: subscription.id,
      user: updated,
    });
  } catch (error) {
    console.error('cancel-subscription error:', error);

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
