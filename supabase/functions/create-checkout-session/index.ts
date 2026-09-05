import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
  'Content-Type': 'application/json',
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

const CHECKOUT_LOCK_MINUTES = 30;

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
  const raw =
    Deno.env.get(
      'SUPABASE_PUBLISHABLE_KEYS'
    );

  if (raw) {
    try {
      const parsed =
        JSON.parse(raw);

      if (parsed?.default) {
        return parsed.default;
      }
    } catch {
      // Fall through to legacy anon key.
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

  let data: any = {};

  try {
    data =
      JSON.parse(text);
  } catch {
    data = {
      raw: text,
    };
  }

  if (!response.ok) {
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
  priceId: string | null
) {
  if (!priceId) {
    return null;
  }

  const entry =
    Object.entries(
      PRICES
    ).find(
      ([, configuredPriceId]) =>
        configuredPriceId ===
        priceId
    );

  return entry?.[0] || null;
}

/*
 * ============================================================
 * PROFILE
 * ============================================================
 */

async function getProfileSubscription(
  userId: string
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from('profiles')
      .select(
        'subscription_plan, subscription_status, stripe_subscription_id, stripe_customer_id, stripe_price_id'
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

  return data || null;
}

function isProfilePaid(
  profile: any
) {
  const plan =
    String(
      profile?.subscription_plan ||
        ''
    )
      .trim()
      .toLowerCase();

  const status =
    String(
      profile?.subscription_status ||
        ''
    )
      .trim()
      .toLowerCase();

  return (
    VALID_PLANS.includes(
      plan
    ) &&
    ACTIVE_STATUSES.includes(
      status
    ) &&
    Boolean(
      profile?.stripe_subscription_id
    )
  );
}

/*
 * ============================================================
 * GET EXISTING STRIPE SUBSCRIPTION
 * ============================================================
 */

async function getExistingProfileSubscription(
  profile: any
) {
  const subscriptionId =
    String(
      profile?.stripe_subscription_id ||
        ''
    ).trim();

  if (!subscriptionId) {
    return null;
  }

  try {
    return await stripe(
      `subscriptions/${encodeURIComponent(
        subscriptionId
      )}`
    );
  } catch (error) {
    console.warn(
      '[CHECKOUT] Could not retrieve existing Stripe subscription:',
      error
    );

    return null;
  }
}

/*
 * ============================================================
 * VERIFY EXISTING SUBSCRIPTION OWNERSHIP
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

  if (
    subscription.id !==
    profile?.stripe_subscription_id
  ) {
    return false;
  }

  const profileCustomerId =
    String(
      profile?.stripe_customer_id ||
        ''
    ).trim();

  const stripeCustomerId =
    typeof subscription.customer ===
    'string'
      ? subscription.customer
      : subscription.customer?.id ||
        '';

  if (
    profileCustomerId &&
    stripeCustomerId !==
      profileCustomerId
  ) {
    return false;
  }

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

  return true;
}

/*
 * ============================================================
 * CHECKOUT LOCK
 * ============================================================
 */

async function claimCheckoutLock(
  userId: string,
  plan: string
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin.rpc(
      'claim_checkout_session_lock',
      {
        p_user_id:
          userId,

        p_plan:
          plan,

        p_lock_minutes:
          CHECKOUT_LOCK_MINUTES,
      }
    );

  if (error) {
    throw new Error(
      `Unable to protect checkout from duplicate requests: ${error.message}`
    );
  }

  return data || null;
}

async function finishCheckoutLock(
  userId: string,
  plan: string,
  sessionId: string,
  checkoutUrl: string
) {
  const {
    error,
  } =
    await supabaseAdmin
      .from(
        'stripe_checkout_locks'
      )
      .update({
        status:
          'created',

        plan,

        stripe_session_id:
          sessionId,

        checkout_url:
          checkoutUrl,

        expires_at:
          new Date(
            Date.now() +
              CHECKOUT_LOCK_MINUTES *
                60 *
                1000
          ).toISOString(),

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'user_id',
        userId
      );

  if (error) {
    console.error(
      '[CHECKOUT] Failed to save checkout lock:',
      error
    );
  }
}

async function releaseCheckoutLock(
  userId: string
) {
  const {
    error,
  } =
    await supabaseAdmin
      .from(
        'stripe_checkout_locks'
      )
      .delete()
      .eq(
        'user_id',
        userId
      );

  if (error) {
    console.error(
      '[CHECKOUT] Failed to release checkout lock:',
      error
    );
  }
}

/*
 * ============================================================
 * CHECKOUT SESSION HELPERS
 * ============================================================
 */

async function getCheckoutSession(
  sessionId: string
) {
  if (!sessionId) {
    return null;
  }

  try {
    return await stripe(
      `checkout/sessions/${encodeURIComponent(
        sessionId
      )}`
    );
  } catch (error) {
    console.warn(
      '[CHECKOUT] Could not retrieve Checkout Session:',
      error
    );

    return null;
  }
}

async function expireCheckoutSession(
  sessionId: string
) {
  if (!sessionId) {
    return;
  }

  try {
    await stripe(
      `checkout/sessions/${encodeURIComponent(
        sessionId
      )}/expire`,
      {
        method:
          'POST',

        body:
          '',
      }
    );
  } catch (error) {
    console.warn(
      '[CHECKOUT] Could not expire Checkout Session:',
      error
    );
  }
}

async function resolveExistingCheckoutLock(
  userId: string,
  requestedPlan: string,
  lock: any
) {
  if (!lock?.locked) {
    return {
      action:
        'continue',
    };
  }

  const sessionId =
    lock.stripe_session_id ||
    '';

  if (!sessionId) {
    return {
      action:
        'in_progress',
    };
  }

  const session =
    await getCheckoutSession(
      sessionId
    );

  if (!session) {
    await releaseCheckoutLock(
      userId
    );

    return {
      action:
        'retry',
    };
  }

  const status =
    String(
      session?.status ||
        ''
    ).toLowerCase();

  const lockedPlan =
    String(
      session
        ?.metadata
        ?.plan ||
        lock?.plan ||
        ''
    )
      .trim()
      .toLowerCase();

  if (
    status ===
    'complete'
  ) {
    /*
     * Stripe already completed this Checkout.
     * The webhook is responsible for synchronization.
     */

    await releaseCheckoutLock(
      userId
    );

    return {
      action:
        'retry',
    };
  }

  if (
    status ===
    'expired'
  ) {
    await releaseCheckoutLock(
      userId
    );

    return {
      action:
        'retry',
    };
  }

  if (
    status ===
      'open' &&
    lockedPlan ===
      requestedPlan
  ) {
    return {
      action:
        'reuse',

      session,
    };
  }

  if (
    status ===
    'open'
  ) {
    await expireCheckoutSession(
      sessionId
    );

    await releaseCheckoutLock(
      userId
    );

    return {
      action:
        'retry',
    };
  }

  await releaseCheckoutLock(
    userId
  );

  return {
    action:
      'retry',
  };
}

/*
 * ============================================================
 * CREATE CHECKOUT
 * ============================================================
 *
 * IMPORTANT:
 *
 * For a paid -> paid plan change, this creates a BRAND NEW
 * Stripe subscription.
 *
 * The old subscription is NOT canceled here.
 *
 * The old subscription is canceled by stripe-webhooks only
 * after Stripe confirms the new Checkout payment succeeded.
 */

async function createCheckout(
  user: any,
  email: string,
  plan: string,
  priceId: string,
  customerId: string | null,
  oldSubscriptionId: string | null
) {
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
    user.id
  );

  /*
   * Reuse the same Stripe Customer when one already exists.
   *
   * This keeps the user's Stripe billing identity together
   * while still creating a completely NEW subscription.
   */

  if (
    customerId
  ) {
    params.set(
      'customer',
      customerId
    );
  } else {
    params.set(
      'customer_email',
      email
    );
  }

  /*
   * ==========================================================
   * CHECKOUT SESSION METADATA
   * ==========================================================
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

  /*
   * This tells the webhook which old subscription must be
   * canceled AFTER the new payment succeeds.
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
   * ==========================================================
   * NEW SUBSCRIPTION METADATA
   * ==========================================================
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

  if (
    oldSubscriptionId
  ) {
    params.set(
      'subscription_data[metadata][old_subscription_id]',
      oldSubscriptionId
    );
  }

  /*
   * Tell Stripe that this is a new subscription purchase.
   */

  params.set(
    'payment_settings[save_default_payment_method]',
    'on_subscription'
  );

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
      'Stripe created Checkout but did not return a usable Checkout URL.'
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
    let checkoutLockUserId:
      string | null = null;

    let checkoutLockOwned =
      false;

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
       * ======================================================
       * 1. AUTHENTICATE
       * ======================================================
       */

      const user =
        await getAuthenticatedUser(
          req
        );

      /*
       * ======================================================
       * 2. READ REQUEST
       * ======================================================
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

      /*
       * ======================================================
       * 3. READ PROFILE
       * ======================================================
       */

      const profile =
        await getProfileSubscription(
          user.id
        );

      const profilePaid =
        isProfilePaid(
          profile
        );

      const currentPlan =
        String(
          profile?.subscription_plan ||
            'free'
        )
          .trim()
          .toLowerCase();

      /*
       * ======================================================
       * 4. SAME PLAN
       * ======================================================
       */

      if (
        profilePaid &&
        currentPlan ===
          plan
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
            profile?.stripe_subscription_id ||
            null,

          price_id:
            profile?.stripe_price_id ||
            priceId,

          message:
            `You already have an active ${plan} subscription.`,
        });
      }

      /*
       * ======================================================
       * 5. GET / VERIFY OLD SUBSCRIPTION
       * ======================================================
       */

      let oldSubscription:
        any = null;

      let oldSubscriptionId:
        string | null = null;

      let stripeCustomerId:
        string | null = null;

      if (
        profilePaid &&
        profile?.stripe_subscription_id
      ) {
        oldSubscriptionId =
          String(
            profile.stripe_subscription_id
          ).trim();

        oldSubscription =
          await getExistingProfileSubscription(
            profile
          );

        /*
         * If the profile says the user is paid but Stripe
         * cannot retrieve the subscription, do NOT create a
         * second subscription blindly.
         */

        if (
          !oldSubscription
        ) {
          throw new Error(
            'Your Washek account references a Stripe subscription that could not be retrieved. Please contact support before purchasing another plan.'
          );
        }

        /*
         * Verify the subscription really belongs to this user.
         */

        const ownershipValid =
          verifySubscriptionOwnership(
            oldSubscription,
            user.id,
            profile
          );

        if (
          !ownershipValid
        ) {
          throw new Error(
            'The Stripe subscription associated with this Washek account could not be verified.'
          );
        }

        stripeCustomerId =
          typeof oldSubscription.customer ===
          'string'
            ? oldSubscription.customer
            : oldSubscription.customer?.id ||
              null;

        /*
         * Only subscriptions that are currently billing/entitled
         * enter the replacement flow.
         */

        const oldStatus =
          String(
            oldSubscription?.status ||
              ''
          )
            .trim()
            .toLowerCase();

        if (
          !ACTIVE_STATUSES.includes(
            oldStatus
          )
        ) {
          /*
           * The old subscription is no longer active.
           * Treat this as a fresh checkout.
           */

          oldSubscription =
            null;

          oldSubscriptionId =
            null;

          /*
           * Keep the customer if we have a verified Stripe
           * customer ID.
           */

          stripeCustomerId =
            typeof profile?.stripe_customer_id ===
            'string'
              ? profile.stripe_customer_id
              : null;
        }
      }

      /*
       * ======================================================
       * 6. LOCK NEW CHECKOUT
       * ======================================================
       */

      checkoutLockUserId =
        user.id;

      let lock =
        await claimCheckoutLock(
          user.id,
          plan
        );

      if (
        lock?.locked
      ) {
        const resolved =
          await resolveExistingCheckoutLock(
            user.id,
            plan,
            lock
          );

        if (
          resolved.action ===
          'reuse'
        ) {
          checkoutLockOwned =
            false;

          return json({
            success:
              true,

            action:
              'checkout',

            plan,

            price_id:
              priceId,

            url:
              resolved.session.url,

            session_id:
              resolved.session.id ||
              null,

            reused:
              true,
          });
        }

        if (
          resolved.action ===
          'in_progress'
        ) {
          return json(
            {
              success:
                false,

              action:
                'checkout_in_progress',

              error:
                'A checkout session is already in progress. Please wait a moment and try again.',
            },
            409
          );
        }

        /*
         * Retry after an expired/different checkout.
         */

        lock =
          await claimCheckoutLock(
            user.id,
            plan
          );

        if (
          lock?.locked
        ) {
          const retryResolved =
            await resolveExistingCheckoutLock(
              user.id,
              plan,
              lock
            );

          if (
            retryResolved.action ===
            'reuse'
          ) {
            return json({
              success:
                true,

              action:
                'checkout',

              plan,

              price_id:
                priceId,

              url:
                retryResolved.session.url,

              session_id:
                retryResolved.session.id ||
                null,

              reused:
                true,
            });
          }

          return json(
            {
              success:
                false,

              action:
                'checkout_in_progress',

              error:
                'A checkout session is already in progress. Please wait a moment and try again.',
            },
            409
          );
        }
      }

      /*
       * ======================================================
       * 7. CREATE THE NEW SUBSCRIPTION
       * ======================================================
       *
       * IMPORTANT:
       *
       * If the user already has a paid subscription:
       *
       * OLD SUBSCRIPTION:
       *     remains alive
       *
       * NEW SUBSCRIPTION:
       *     gets created through Checkout
       *
       * ONLY AFTER PAYMENT:
       *     webhook cancels OLD
       */

      checkoutLockOwned =
        true;

      console.log(
        '[CHECKOUT] Creating new subscription:',
        {
          userId:
            user.id,

          requestedPlan:
            plan,

          newPriceId:
            priceId,

          oldSubscriptionId,

          stripeCustomerId,
        }
      );

      const checkout =
        await createCheckout(
          user,
          email,
          plan,
          priceId,
          stripeCustomerId,
          oldSubscriptionId
        );

      await finishCheckoutLock(
        user.id,
        plan,
        checkout.id,
        checkout.url
      );

      checkoutLockOwned =
        false;

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
      console.error(
        '[CHECKOUT] create-checkout-session failed:',
        error
      );

      if (
        checkoutLockUserId &&
        checkoutLockOwned
      ) {
        await releaseCheckoutLock(
          checkoutLockUserId
        );
      }

      return json(
        {
          success:
            false,

          error:
            error instanceof Error
              ? error.message
              : 'Unable to start Stripe Checkout.',
        },
        400
      );
    }
  }
);
