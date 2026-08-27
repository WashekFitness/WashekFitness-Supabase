import { createClient } from
  'https://esm.sh/@supabase/supabase-js@2';

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

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get(
    'SUPABASE_SERVICE_ROLE_KEY'
  ) || '';

const APP_URL =
  Deno.env.get('APP_URL') ||
  'https://washekfitness.com';

const PRICE_IDS = {
  progress:
    Deno.env.get(
      'STRIPE_PROGRESS_PRICE_ID'
    ) || '',

  performance:
    Deno.env.get(
      'STRIPE_PERFORMANCE_PRICE_ID'
    ) || '',

  elite:
    Deno.env.get(
      'STRIPE_ELITE_PRICE_ID'
    ) || '',
};

const supabaseAdmin =
  createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
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

function getPriceId(
  plan: string
) {
  if (
    ![
      'progress',
      'performance',
      'elite',
    ].includes(plan)
  ) {
    throw new Error(
      'Invalid subscription plan.'
    );
  }

  const priceId =
    PRICE_IDS[
      plan as keyof typeof PRICE_IDS
    ];

  if (!priceId) {
    throw new Error(
      `Stripe Price ID for ${plan} is not configured.`
    );
  }

  return priceId;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(
      'ok',
      {
        headers: corsHeaders,
      }
    );
  }

  if (req.method !== 'POST') {
    return json(
      {
        success: false,
        error:
          'Method not allowed.',
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

    const authUser =
      authData.user;

    const body =
      await req.json().catch(
        () => ({})
      );

    const plan =
      String(body?.plan || '')
        .trim()
        .toLowerCase();

    const priceId =
      getPriceId(plan);

    const {
      data: profile,
      error: profileError,
    } =
      await supabaseAdmin
        .from('profiles')
        .select(
          'id, email, full_name, subscription_plan, stripe_customer_id, stripe_subscription_id'
        )
        .eq(
          'id',
          authUser.id
        )
        .single();

    if (profileError) {
      throw new Error(
        'Unable to load your profile.'
      );
    }

    if (
      profile?.subscription_plan ===
      plan
    ) {
      throw new Error(
        'You are already subscribed to this plan.'
      );
    }

    /*
     * If the user already has an active
     * subscription, do not create a second
     * subscription.
     *
     * They should cancel first or use the
     * appropriate future upgrade flow.
     */
    if (
      profile?.stripe_subscription_id &&
      profile?.subscription_status ===
        'active'
    ) {
      throw new Error(
        'You already have an active subscription. Cancel your current subscription before starting a different plan.'
      );
    }

    const email =
      profile?.email ||
      authUser.email ||
      '';

    const customerId =
      profile?.stripe_customer_id ||
      null;

    const params =
      new URLSearchParams();

    params.set(
      'mode',
      'subscription'
    );

    params.set(
      'line_items[0][price]',
      priceId
    );

    params.set(
      'line_items[0][quantity]',
      '1'
    );

    params.set(
      'success_url',
      `${APP_URL}/subscription-return?session_id={CHECKOUT_SESSION_ID}`
    );

    params.set(
      'cancel_url',
      `${APP_URL}/profile`
    );

    params.set(
      'client_reference_id',
      authUser.id
    );

    params.set(
      'metadata[user_id]',
      authUser.id
    );

    params.set(
      'metadata[plan]',
      plan
    );

    params.set(
      'subscription_data[metadata][user_id]',
      authUser.id
    );

    params.set(
      'subscription_data[metadata][plan]',
      plan
    );

    if (customerId) {
      params.set(
        'customer',
        customerId
      );
    } else if (email) {
      params.set(
        'customer_email',
        email
      );
    }

    const session =
      await stripe(
        'checkout/sessions',
        {
          method: 'POST',
          body: params.toString(),
        }
      );

    if (!session?.url) {
      throw new Error(
        'Stripe did not return a checkout URL.'
      );
    }

    return json({
      success: true,
      url: session.url,
      session_id:
        session.id,
    });
  } catch (error) {
    console.error(
      'create-checkout-session error:',
      error
    );

    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to start Stripe checkout.',
      },
      400
    );
  }
});
