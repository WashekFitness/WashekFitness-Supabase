import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
  'Content-Type':
    'application/json',
};

const SUPABASE_URL =
  Deno.env.get('SUPABASE_URL') || '';

const SERVICE_ROLE_KEY =
  Deno.env.get('SERVICE_ROLE_KEY') || '';

const STRIPE_SECRET_KEY =
  Deno.env.get('STRIPE_SECRET_KEY') || '';

const APP_URL =
  Deno.env.get('APP_URL') ||
  'https://washekfitness.com';

const PRICES = {
  progress:
    'price_1TTYrbRuQpZftYKRoSyLbQ0c',

  performance:
    'price_1TTYs8RuQpZftYKR8ZzpNg7x',

  elite:
    'price_1TTYsWRuQpZftYKRKIm8V10E',
};

const VALID_PLANS = [
  'progress',
  'performance',
  'elite',
];

const ACTIVE_STATUSES = [
  'active',
  'trialing',
  'past_due',
  'unpaid',
];

const supabaseAdmin =
  createClient(
    SUPABASE_URL,
    SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

/*
 * ============================================================
 * RESPONSE
 * ============================================================
 */

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
 * ============================================================
 * AUTHENTICATION
 * ============================================================
 */

function getSupabaseKey() {
  const publishableKeys =
    Deno.env.get(
      'SUPABASE_PUBLISHABLE_KEYS'
    );

  if (
    publishableKeys
  ) {
    try {
      const parsed =
        JSON.parse(
          publishableKeys
        );

      if (
        parsed?.default
      ) {
        return parsed.default;
      }
    } catch {
      // Fall through.
    }
  }

  return (
    Deno.env.get(
      'SUPABASE_ANON_KEY'
    ) || ''
  );
}

async function getAuthenticatedUser(
  req: Request
) {
  const authorization =
    req.headers.get(
      'Authorization'
    );

  if (!authorization) {
    throw new Error(
      'Missing Authorization header. Please sign in again.'
    );
  }

  const supabaseKey =
    getSupabaseKey();

  if (!supabaseKey) {
    throw new Error(
      'SUPABASE_PUBLISHABLE_KEYS or SUPABASE_ANON_KEY is not configured.'
    );
  }

  const supabase =
    createClient(
      SUPABASE_URL,
      supabaseKey,
      {
        global: {
          headers: {
            Authorization:
              authorization,
          },
        },

        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

  const {
    data,
    error,
  } =
    await supabase.auth.getUser();

  if (
    error ||
    !data?.user
  ) {
    throw new Error(
      `Supabase authentication failed: ${
        error?.message ||
        'No authenticated user was found.'
      }`
    );
  }

  return data.user;
}

/*
 * ============================================================
 * STRIPE API
 * ============================================================
 */

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

  const text =
    await response.text();

  let data: any;

  try {
    data =
      JSON.parse(text);
  } catch {
    data = {
      raw: text,
    };
  }

  if (
    !response.ok
  ) {
    throw new Error(
      data?.error?.message ||
        `Stripe returned HTTP ${response.status}.`
    );
  }

  return data;
}

/*
 * ============================================================
 * PLAN HELPERS
 * ============================================================
 */

function getPriceId(
  plan: string
) {
  const priceId =
    PRICES[
      plan as keyof typeof PRICES
    ];

  if (!priceId) {
    throw new Error(
      `Invalid subscription plan: ${plan}`
    );
  }

  return priceId;
}

function getPlanFromPriceId(
  priceId:
    | string
    | null
    | undefined
) {
  if (!priceId) {
    return null;
  }

  for (
    const [
      plan,
      configuredPriceId,
    ] of Object.entries(
      PRICES
    )
  ) {
    if (
      configuredPriceId ===
      priceId
    ) {
      return plan;
    }
  }

  return null;
}

/*
 * ============================================================
 * PROFILE
 * ============================================================
 */

async function getProfile(
  userId: string
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from('profiles')
      .select(
        `
        subscription_plan,
        subscription_status,
        stripe_subscription_id,
        stripe_customer_id,
        stripe_price_id
        `
      )
      .eq(
        'id',
        userId
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to read subscription profile: ${error.message}`
    );
  }

  return data;
}

/*
 * ============================================================
 * STRIPE SUBSCRIPTION
 * ============================================================
 */

async function getStripeSubscription(
  subscriptionId: string
) {
  try {
    return await stripe(
      `subscriptions/${encodeURIComponent(
        subscriptionId
      )}`
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      '[CHECKOUT] Failed to retrieve Stripe subscription:',
      message
    );

    throw new Error(
      `Unable to retrieve your current Stripe subscription: ${message}`
    );
  }
}

/*
 * ============================================================
 * VERIFY SUBSCRIPTION OWNERSHIP
 * ============================================================
 */

function verifySubscriptionOwnership(
  subscription: any,
  userId: string,
  profile: any
) {
  if (!subscription) {
    return false;
  }

  /*
   * Must be the exact subscription stored on this profile.
   */

  if (
    subscription.id !==
    profile?.stripe_subscription_id
  ) {
    return false;
  }

  /*
   * If metadata contains a user ID, it MUST match.
   */

  const metadataUserId =
    String(
      subscription
        ?.metadata
        ?.user_id ||
        ''
    ).trim();

  if (
    metadataUserId &&
    metadataUserId !==
      userId
  ) {
    return false;
  }

  /*
   * If the profile has a Stripe customer ID, verify it too.
   */

  const profileCustomerId =
    String(
      profile
        ?.stripe_customer_id ||
        ''
    ).trim();

  const subscriptionCustomerId =
    typeof subscription.customer ===
    'string'
      ? subscription.customer
      : subscription.customer?.id ||
        '';

  if (
    profileCustomerId &&
    subscriptionCustomerId &&
    profileCustomerId !==
      subscriptionCustomerId
  ) {
    return false;
  }

  return true;
}

/*
 * ============================================================
 * PAID SUBSCRIPTION CHECK
 * ============================================================
 */

function isPaidSubscription(
  subscription: any
) {
  const status =
    String(
      subscription?.status ||
        ''
    )
      .trim()
      .toLowerCase();

  return ACTIVE_STATUSES.includes(
    status
  );
}

/*
 * ============================================================
 * CREATE STRIPE CHECKOUT
 * ============================================================
 *
 * IMPORTANT:
 *
 * FREE -> PAID
 *     Creates one new subscription.
 *
 * PAID -> PAID
 *     Creates a completely NEW subscription.
 *
 * The OLD subscription is NOT canceled here.
 *
 * The OLD subscription is canceled by stripe-webhooks
 * only AFTER the NEW Checkout payment succeeds.
 * ============================================================
 */

async function createCheckoutSession(
  user: any,
  plan: string,
  priceId: string,
  oldSubscriptionId:
    | string
    | null,
  stripeCustomerId:
    | string
    | null
) {
  const params =
    new URLSearchParams();

  /*
   * ----------------------------------------------------------
   * Checkout mode
   * ----------------------------------------------------------
   */

  params.set(
    'mode',
    'subscription'
  );

  /*
   * ----------------------------------------------------------
   * New plan
   * ----------------------------------------------------------
   */

  params.set(
    'line_items[0][price]',
    priceId
  );

  params.set(
    'line_items[0][quantity]',
    '1'
  );

  /*
   * ----------------------------------------------------------
   * Redirects
   * ----------------------------------------------------------
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

  /*
   * ----------------------------------------------------------
   * User identity
   * ----------------------------------------------------------
   */

  params.set(
    'client_reference_id',
    user.id
  );

  /*
   * Reuse the existing Stripe customer when available.
   *
   * This creates a NEW subscription under the same Stripe
   * customer rather than creating a second customer.
   */

  if (
    stripeCustomerId
  ) {
    params.set(
      'customer',
      stripeCustomerId
    );
  } else {
    const email =
      String(
        user.email ||
          ''
      )
        .trim()
        .toLowerCase();

    if (!email) {
      throw new Error(
        'Your Washek account does not have an email address.'
      );
    }

    params.set(
      'customer_email',
      email
    );
  }

  /*
   * ----------------------------------------------------------
   * Checkout metadata
   * ----------------------------------------------------------
   */

  params.set(
    'metadata[user_id]',
    user.id
  );

  params.set(
    'metadata[plan]',
    plan
  );

  params.set(
    'metadata[price_id]',
    priceId
  );

  params.set(
    'metadata[checkout_type]',
    oldSubscriptionId
      ? 'subscription_change'
      : 'new_subscription'
  );

  /*
   * THIS IS THE KEY.
   *
   * The webhook will use this to cancel the OLD subscription
   * after the NEW payment succeeds.
   */

  if (
    oldSubscriptionId
  ) {
    params.set(
      'metadata[old_subscription_id]',
      oldSubscriptionId
    );
  }

  /*
   * ----------------------------------------------------------
   * NEW SUBSCRIPTION metadata
   * ----------------------------------------------------------
   */

  params.set(
    'subscription_data[metadata][user_id]',
    user.id
  );

  params.set(
    'subscription_data[metadata][plan]',
    plan
  );

  params.set(
    'subscription_data[metadata][price_id]',
    priceId
  );

  params.set(
    'subscription_data[metadata][checkout_type]',
    oldSubscriptionId
      ? 'subscription_change'
      : 'new_subscription'
  );

  if (
    oldSubscriptionId
  ) {
    params.set(
      'subscription_data[metadata][old_subscription_id]',
      oldSubscriptionId
    );
  }

  /*
   * Save the payment method to the new subscription.
   */

  params.set(
    'payment_settings[save_default_payment_method]',
    'on_subscription'
  );

  /*
   * Create the Checkout Session.
   */

  const checkout =
    await stripe(
      'checkout/sessions',
      {
        method:
          'POST',

        body:
          params.toString(),
      }
    );

  if (
    !checkout?.id ||
    !checkout?.url
  ) {
    throw new Error(
      'Stripe did not return a valid Checkout Session.'
    );
  }

  return checkout;
}

/*
 * ============================================================
 * MAIN
 * ============================================================
 */

Deno.serve(
  async (req) => {
    /*
     * --------------------------------------------------------
     * CORS
     * --------------------------------------------------------
     */

    if (
      req.method ===
      'OPTIONS'
    ) {
      return new Response(
        'ok',
        {
          status:
            200,

          headers:
            corsHeaders,
        }
      );
    }

    /*
     * --------------------------------------------------------
     * METHOD
     * --------------------------------------------------------
     */

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
       * ------------------------------------------------------
       * 1. AUTHENTICATE
       * ------------------------------------------------------
       */

      const user =
        await getAuthenticatedUser(
          req
        );

      /*
       * ------------------------------------------------------
       * 2. READ REQUEST
       * ------------------------------------------------------
       */

      const body =
        await req
          .json()
          .catch(
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
        !VALID_PLANS.includes(
          plan
        )
      ) {
        return json(
          {
            success:
              false,

            error:
              'Invalid subscription plan.',
          },
          400
        );
      }

      const priceId =
        getPriceId(
          plan
        );

      /*
       * ------------------------------------------------------
       * 3. READ CURRENT PROFILE
       * ------------------------------------------------------
       */

      const profile =
        await getProfile(
          user.id
        );

      const currentPlan =
        String(
          profile
            ?.subscription_plan ||
            'free'
        )
          .trim()
          .toLowerCase();

      const currentSubscriptionId =
        String(
          profile
            ?.stripe_subscription_id ||
            ''
        ).trim() ||
        null;

      const currentStatus =
        String(
          profile
            ?.subscription_status ||
            ''
        )
          .trim()
          .toLowerCase();

      /*
       * ------------------------------------------------------
       * 4. SAME PLAN
       * ------------------------------------------------------
       */

      if (
        currentPlan ===
          plan &&
        currentSubscriptionId &&
        ACTIVE_STATUSES.includes(
          currentStatus
        )
      ) {
        return json({
          success:
            true,

          action:
            'already_active',

          alreadyActive:
            true,

          plan,

          subscription_id:
            currentSubscriptionId,

          price_id:
            profile
              ?.stripe_price_id ||
            priceId,

          message:
            `You already have an active ${plan} subscription.`,
        });
      }

      /*
       * ------------------------------------------------------
       * 5. DETERMINE OLD SUBSCRIPTION
       * ------------------------------------------------------
       */

      let oldSubscriptionId:
        string | null =
          null;

      let stripeCustomerId:
        string | null =
          profile
            ?.stripe_customer_id ||
          null;

      if (
        currentSubscriptionId
      ) {
        const existingSubscription =
          await getStripeSubscription(
            currentSubscriptionId
          );

        /*
         * Verify that the subscription actually belongs to
         * this Washek account.
         */

        const ownershipValid =
          verifySubscriptionOwnership(
            existingSubscription,
            user.id,
            profile
          );

        if (
          !ownershipValid
        ) {
          throw new Error(
            'The Stripe subscription associated with your Washek account could not be verified. Your current subscription was not changed.'
          );
        }

        /*
         * Get the real Stripe customer ID.
         */

        stripeCustomerId =
          typeof existingSubscription.customer ===
          'string'
            ? existingSubscription.customer
            : existingSubscription.customer?.id ||
              stripeCustomerId;

        /*
         * Only treat it as a replacement if Stripe says it is
         * still an active/paid subscription.
         */

        if (
          isPaidSubscription(
            existingSubscription
          )
        ) {
          oldSubscriptionId =
            existingSubscription.id;

          console.log(
            '[CHECKOUT] Paid-to-paid replacement:',
            JSON.stringify({
              userId:
                user.id,

              oldSubscriptionId,

              oldPlan:
                currentPlan,

              newPlan:
                plan,

              oldStatus:
                existingSubscription.status,

              stripeCustomerId,
            })
          );
        } else {
          /*
           * The profile still references an old subscription,
           * but Stripe says it is no longer active.
           *
           * Treat this as a normal new purchase.
           */

          console.log(
            '[CHECKOUT] Existing Stripe subscription is not active; creating fresh subscription:',
            JSON.stringify({
              userId:
                user.id,

              subscriptionId:
                existingSubscription.id,

              status:
                existingSubscription.status,
            })
          );
        }
      }

      /*
       * ------------------------------------------------------
       * 6. CREATE NEW CHECKOUT
       * ------------------------------------------------------
       */

      const checkout =
        await createCheckoutSession(
          user,
          plan,
          priceId,
          oldSubscriptionId,
          stripeCustomerId
        );

      console.log(
        '[CHECKOUT] Checkout created:',
        JSON.stringify({
          userId:
            user.id,

          sessionId:
            checkout.id,

          plan,

          priceId,

          oldSubscriptionId,

          replacingSubscription:
            Boolean(
              oldSubscriptionId
            ),
        })
      );

      /*
       * ------------------------------------------------------
       * 7. RETURN URL
       * ------------------------------------------------------
       */

      return json({
        success:
          true,

        action:
          'checkout',

        plan,

        price_id:
          priceId,

        url:
          checkout.url,

        session_id:
          checkout.id,

        replacing_subscription:
          Boolean(
            oldSubscriptionId
          ),

        old_subscription_id:
          oldSubscriptionId,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.error(
        '[CHECKOUT] create-checkout-session failed:',
        message
      );

      return json(
        {
          success:
            false,

          error:
            message,
        },
        400
      );
    }
  }
);
