import { createClient } from
  'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',

  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',

  'Access-Control-Allow-Methods':
    'POST, OPTIONS',

  'Content-Type':
    'application/json',
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

/*
 * These are your Stripe PRODUCT IDs.
 *
 * They are not secret and can safely be
 * referenced by the server function.
 *
 * The function finds the active recurring
 * price attached to each product automatically.
 */
const PRODUCT_IDS = {
  progress:
    Deno.env.get(
      'STRIPE_PROGRESS_PRODUCT_ID'
    ) ||
    'prod_USTp1fOzf3aHsl',

  performance:
    Deno.env.get(
      'STRIPE_PERFORMANCE_PRODUCT_ID'
    ) ||
    'prod_USTpsXJPgs7ccs',

  elite:
    Deno.env.get(
      'STRIPE_ELITE_PRODUCT_ID'
    ) ||
    'prod_USTqn0bZsTVUkH',
};

const PLAN_ORDER = [
  'free',
  'progress',
  'performance',
  'elite',
];

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

/*
 * Generic Stripe API helper.
 */
async function stripe(
  path: string,
  options: RequestInit = {}
) {
  if (!STRIPE_SECRET_KEY) {
    throw new Error(
      'Stripe is not configured on the server. Add STRIPE_SECRET_KEY to Supabase secrets.'
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

/*
 * Return the Stripe Product ID for
 * a Washek subscription plan.
 */
function getProductId(
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

  return PRODUCT_IDS[
    plan as keyof typeof PRODUCT_IDS
  ];
}

/*
 * Find the active recurring Stripe Price
 * belonging to a Product.
 *
 * This means you only need to supply the
 * Product ID instead of manually finding
 * the Price ID.
 */
async function getRecurringPriceForProduct(
  productId: string
) {
  const params =
    new URLSearchParams();

  params.set(
    'product',
    productId
  );

  params.set(
    'active',
    'true'
  );

  params.set(
    'type',
    'recurring'
  );

  params.set(
    'limit',
    '100'
  );

  const result =
    await stripe(
      `prices?${params.toString()}`
    );

  const prices =
    result?.data || [];

  if (!prices.length) {
    throw new Error(
      `No active recurring Stripe price was found for product ${productId}.`
    );
  }

  /*
   * Prefer a monthly price if one exists.
   */
  const monthly =
    prices.find(
      (price: any) =>
        price?.recurring?.interval ===
        'month'
    );

  return monthly || prices[0];
}

function isPaidStatus(
  status: string
) {
  return (
    status === 'active' ||
    status === 'trialing'
  );
}

/*
 * Find the user's current Stripe
 * subscription if one exists.
 */
async function findCurrentSubscription(
  profile: any,
  email: string
) {
  /*
   * First use the subscription ID saved
   * directly on the profile.
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
        (
          isPaidStatus(
            subscription.status
          ) ||
          subscription.status ===
            'past_due'
        )
      ) {
        return subscription;
      }
    } catch {
      /*
       * Continue with customer lookup.
       */
    }
  }

  /*
   * Next search by saved Stripe customer ID.
   */
  if (
    profile?.stripe_customer_id
  ) {
    const result =
      await stripe(
        `subscriptions?customer=${encodeURIComponent(
          profile.stripe_customer_id
        )}&status=all&limit=20`
      );

    const subscription =
      (result?.data || []).find(
        (item: any) =>
          isPaidStatus(
            item.status
          ) ||
          item.status ===
            'past_due'
      );

    if (subscription) {
      return subscription;
    }
  }

  /*
   * Final recovery method:
   * find Stripe customers by email.
   */
  if (email) {
    const customers =
      await stripe(
        `customers?email=${encodeURIComponent(
          email
        )}&limit=20`
      );

    for (
      const customer of
      customers?.data || []
    ) {
      const result =
        await stripe(
          `subscriptions?customer=${encodeURIComponent(
            customer.id
          )}&status=all&limit=20`
        );

      const subscription =
        (result?.data || []).find(
          (item: any) =>
            isPaidStatus(
              item.status
            ) ||
            item.status ===
              'past_due'
        );

      if (subscription) {
        return subscription;
      }
    }
  }

  return null;
}

/*
 * Change an existing paid subscription
 * to another Washek paid plan.
 *
 * This prevents multiple subscriptions
 * being created for one user.
 */
async function changeExistingSubscription(
  subscription: any,
  newPriceId: string
) {
  const items =
    subscription?.items?.data || [];

  if (!items.length) {
    throw new Error(
      'The existing Stripe subscription has no subscription item to update.'
    );
  }

  const subscriptionItem =
    items[0];

  const params =
    new URLSearchParams();

  params.set(
    'price',
    newPriceId
  );

  /*
   * Keep the existing quantity.
   */
  params.set(
    'quantity',
    String(
      subscriptionItem.quantity ||
        1
    )
  );

  /*
   * Apply the plan change immediately
   * without generating an extra prorated
   * charge/refund.
   */
  params.set(
    'proration_behavior',
    'none'
  );

  const updatedItem =
    await stripe(
      `subscription_items/${encodeURIComponent(
        subscriptionItem.id
      )}`,
      {
        method: 'POST',
        body:
          params.toString(),
      }
    );

  return updatedItem;
}

Deno.serve(async (req) => {
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
     * Authenticate the request.
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
          success:
            false,

          error:
            'Your session is invalid or expired.',
        },
        401
      );
    }

    const authUser =
      authData.user;

    /*
     * Read requested plan.
     */
    const body =
      await req.json().catch(
        () => ({})
      );

    const plan =
      String(
        body?.plan ||
          ''
      )
        .trim()
        .toLowerCase();

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

    const productId =
      getProductId(plan);

    /*
     * Resolve the Product to an active
     * recurring Price.
     */
    const price =
      await getRecurringPriceForProduct(
        productId
      );

    const priceId =
      price.id;

    /*
     * Load the user's profile.
     */
    const {
      data: profile,
      error: profileError,
    } =
      await supabaseAdmin
        .from('profiles')
        .select(
          `
            id,
            email,
            full_name,
            subscription_plan,
            subscription_status,
            stripe_customer_id,
            stripe_subscription_id,
            stripe_price_id
          `
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

    const currentPlan =
      profile?.subscription_plan ||
      'free';

    if (
      currentPlan ===
      plan
    ) {
      throw new Error(
        `You are already subscribed to the ${plan} plan.`
      );
    }

    const email =
      profile?.email ||
      authUser.email ||
      '';

    /*
     * Check whether this user already
     * has an active Stripe subscription.
     */
    const existingSubscription =
      await findCurrentSubscription(
        profile,
        email
      );

    /*
     * =====================================================
     * PAID -> PAID
     *
     * Change the existing subscription instead
     * of creating a second subscription.
     * =====================================================
     */
    if (
      existingSubscription
    ) {
      const updatedItem =
        await changeExistingSubscription(
          existingSubscription,
          priceId
        );

      const customerId =
        typeof existingSubscription.customer ===
        'string'
          ? existingSubscription.customer
          : profile?.stripe_customer_id ||
            null;

      /*
       * Update Supabase immediately.
       *
       * The Stripe webhook will also verify
       * and maintain this state.
       */
      const {
        data: updatedProfile,
        error: updateError,
      } =
        await supabaseAdmin
          .from('profiles')
          .update({
            subscription_plan:
              plan,

            subscription_status:
              existingSubscription.status ||
              'active',

            stripe_customer_id:
              customerId,

            stripe_subscription_id:
              existingSubscription.id,

            stripe_price_id:
              priceId,

            subscription_cancelled_at:
              null,

            subscription_updated_at:
              new Date().toISOString(),

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'id',
            authUser.id
          )
          .select()
          .single();

      if (updateError) {
        throw updateError;
      }

      return json({
        success:
          true,

        action:
          'changed',

        plan,

        product_id:
          productId,

        price_id:
          priceId,

        subscription_id:
          existingSubscription.id,

        subscription_item_id:
          updatedItem?.id ||
          null,

        user:
          updatedProfile,
      });
    }

    /*
     * =====================================================
     * FREE -> PAID
     *
     * Create a normal Stripe Checkout Session.
     * =====================================================
     */

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

    /*
     * Include the requested plan in the
     * return URL so the frontend knows what
     * subscription was purchased.
     */
    params.set(
      'success_url',
      `${APP_URL}/subscription-return?session_id={CHECKOUT_SESSION_ID}&plan=${encodeURIComponent(
        plan
      )}`
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
      'metadata[product_id]',
      productId
    );

    params.set(
      'metadata[price_id]',
      priceId
    );

    params.set(
      'subscription_data[metadata][user_id]',
      authUser.id
    );

    params.set(
      'subscription_data[metadata][plan]',
      plan
    );

    params.set(
      'subscription_data[metadata][product_id]',
      productId
    );

    params.set(
      'subscription_data[metadata][price_id]',
      priceId
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
          method:
            'POST',

          body:
            params.toString(),
        }
      );

    if (!session?.url) {
      throw new Error(
        'Stripe did not return a checkout URL.'
      );
    }

    return json({
      success:
        true,

      action:
        'checkout',

      url:
        session.url,

      session_id:
        session.id,

      plan,

      product_id:
        productId,

      price_id:
        priceId,
    });
  } catch (error) {
    console.error(
      'create-checkout-session error:',
      error
    );

    return json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : 'Unable to start subscription checkout.',
      },
      400
    );
  }
});
