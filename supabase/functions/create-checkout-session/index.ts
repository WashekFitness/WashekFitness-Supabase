import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || '';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';
const APP_URL =
  Deno.env.get('APP_URL') || 'https://washekfitness.com';

const PRICES = {
  progress: 'price_1TTYrbRuQpZftYKRoSyLbQ0c',
  performance: 'price_1TTYs8RuQpZftYKR8ZzpNg7x',
  elite: 'price_1TTYsWRuQpZftYKRKIm8V10E',
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

  if (!SUPABASE_URL) {
    throw new Error(
      'SUPABASE_URL is not configured.'
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

  return {
    user: data.user,
  };
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
          ...(options.headers || {}),
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

async function findAllCustomersByEmail(
  email: string
) {
  if (!email) {
    return [];
  }

  const result =
    await stripe(
      `customers?email=${encodeURIComponent(
        email
      )}&limit=100`
    );

  return Array.isArray(
    result?.data
  )
    ? result.data
    : [];
}

async function getSubscriptionsForCustomer(
  customerId: string
) {
  if (!customerId) {
    return [];
  }

  const result =
    await stripe(
      `subscriptions?customer=${encodeURIComponent(
        customerId
      )}&status=all&limit=100`
    );

  return Array.isArray(
    result?.data
  )
    ? result.data
    : [];
}

function isActiveSubscription(
  subscription: any
) {
  return ACTIVE_STATUSES.includes(
    String(
      subscription?.status ||
        ''
    ).toLowerCase()
  );
}

function getSubscriptionPlan(
  subscription: any
) {
  const metadataPlan =
    String(
      subscription
        ?.metadata
        ?.plan ||
        ''
    )
      .trim()
      .toLowerCase();

  if (
    VALID_PLANS.includes(
      metadataPlan
    )
  ) {
    return metadataPlan;
  }

  const priceId =
    subscription
      ?.items
      ?.data?.[0]
      ?.price?.id;

  return (
    Object.entries(
      PRICES
    ).find(
      ([, configuredPriceId]) =>
        configuredPriceId ===
        priceId
    )?.[0] || null
  );
}

async function findExistingActiveSubscription(
  userId: string,
  email: string
) {
  const customers =
    await findAllCustomersByEmail(
      email
    );

  if (!customers.length) {
    return null;
  }

  const allSubscriptions:
    Array<{
      customer: any;
      subscription: any;
    }> = [];

  for (
    const customer of customers
  ) {
    const subscriptions =
      await getSubscriptionsForCustomer(
        customer.id
      );

    for (
      const subscription of
        subscriptions
    ) {
      if (
        isActiveSubscription(
          subscription
        )
      ) {
        allSubscriptions.push({
          customer,
          subscription,
        });
      }
    }
  }

  /*
   * Prefer the exact Washek account
   * when metadata exists.
   */
  const exactUserMatch =
    allSubscriptions.find(
      ({
        subscription,
        customer,
      }) =>
        subscription
          ?.metadata
          ?.user_id ===
          userId ||
        customer
          ?.metadata
          ?.user_id ===
          userId
    );

  if (exactUserMatch) {
    return exactUserMatch;
  }

  /*
   * Recover older subscriptions
   * that were created before
   * user_id metadata existed.
   */
  return (
    allSubscriptions[0] ||
    null
  );
}

async function changeExistingSubscription(
  subscription: any,
  priceId: string,
  userId: string,
  plan: string
) {
  const item =
    subscription
      ?.items
      ?.data?.[0];

  if (!item) {
    throw new Error(
      'Your Stripe subscription has no subscription item to change.'
    );
  }

  const itemParams =
    new URLSearchParams();

  itemParams.set(
    'price',
    priceId
  );

  itemParams.set(
    'quantity',
    String(
      item.quantity || 1
    )
  );

  itemParams.set(
    'proration_behavior',
    'none'
  );

  await stripe(
    `subscription_items/${encodeURIComponent(
      item.id
    )}`,
    {
      method: 'POST',
      body:
        itemParams.toString(),
    }
  );

  const metadata =
    new URLSearchParams();

  metadata.set(
    'metadata[user_id]',
    userId
  );

  metadata.set(
    'metadata[plan]',
    plan
  );

  metadata.set(
    'metadata[price_id]',
    priceId
  );

  await stripe(
    `subscriptions/${encodeURIComponent(
      subscription.id
    )}`,
    {
      method: 'POST',
      body:
        metadata.toString(),
    }
  );

  return {
    subscriptionId:
      subscription.id,

    customerId:
      typeof subscription.customer ===
      'string'
        ? subscription.customer
        : subscription.customer
            ?.id ||
          null,
  };
}

async function createCheckout(
  user: any,
  email: string,
  plan: string,
  priceId: string
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

  params.set(
    'customer_email',
    email
  );

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

  return stripe(
    'checkout/sessions',
    {
      method: 'POST',
      body:
        params.toString(),
    }
  );
}

/*
 * ------------------------------------------------------------
 * CHECKOUT CONCURRENCY LOCK
 * ------------------------------------------------------------
 *
 * This calls the database RPC created by:
 *
 * 013_stripe_checkout_lock.sql
 *
 * The RPC atomically claims the user's checkout slot.
 */
async function claimCheckoutLock(
  userId: string,
  plan: string
) {
  if (!SERVICE_ROLE_KEY) {
    throw new Error(
      'SERVICE_ROLE_KEY is not configured in Supabase.'
    );
  }

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

/*
 * Store the Stripe Checkout Session
 * after it has successfully been created.
 */
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
      '[CHECKOUT] Failed to save checkout lock result:',
      error
    );
  }
}

/*
 * Release a lock when checkout did not
 * result in a reusable Stripe Session.
 */
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
          status: 200,
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
          success: false,
          error:
            'Method not allowed.',
        },
        405
      );
    }

    try {
      /*
       * ------------------------------------------------------
       * AUTHENTICATE USER
       * ------------------------------------------------------
       */

      const {
        user,
      } =
        await getAuthenticatedUser(
          req
        );

      /*
       * ------------------------------------------------------
       * READ REQUEST
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
            success: false,
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
       * ------------------------------------------------------
       * CLAIM CHECKOUT LOCK
       * ------------------------------------------------------
       *
       * This MUST happen before checking Stripe or creating
       * a Checkout Session.
       *
       * Two simultaneous requests for the same user cannot
       * both become the lock owner.
       */

      checkoutLockUserId =
        user.id;

      const lock =
        await claimCheckoutLock(
          user.id,
          plan
        );

      /*
       * Another request already owns
       * the checkout slot.
       */
      if (
        lock?.locked
      ) {
        /*
         * If the first request already created
         * its Checkout Session, reuse it rather
         * than creating another one.
         */
        if (
          lock.checkout_url
        ) {
          return json({
            success: true,
            action:
              'checkout',
            plan:
              lock.plan ||
              plan,
            price_id:
              priceId,
            url:
              lock.checkout_url,
            session_id:
              lock.stripe_session_id ||
              null,
            reused: true,
          });
        }

        /*
         * The first request is still creating
         * the Stripe session.
         */
        return json(
          {
            success: false,
            action:
              'checkout_in_progress',
            error:
              'A checkout session is already being created. Please wait a moment and try again.',
          },
          409
        );
      }

      /*
       * This request successfully owns
       * the checkout lock.
       */
      checkoutLockOwned =
        true;

      console.log(
        '[CHECKOUT] Checking existing Stripe subscriptions:',
        {
          userId:
            user.id,

          email,

          requestedPlan:
            plan,

          priceId,
        }
      );

      /*
       * ------------------------------------------------------
       * CHECK FOR EXISTING SUBSCRIPTION
       * ------------------------------------------------------
       */

      const existing =
        await findExistingActiveSubscription(
          user.id,
          email
        );

      if (existing) {
        const subscription =
          existing.subscription;

        const existingPlan =
          getSubscriptionPlan(
            subscription
          );

        const currentPriceId =
          subscription
            ?.items
            ?.data?.[0]
            ?.price
            ?.id ||
          null;

        /*
         * SAME PLAN:
         *
         * Never create another Checkout Session.
         */
        if (
          currentPriceId ===
            priceId ||
          existingPlan ===
            plan
        ) {
          await releaseCheckoutLock(
            user.id
          );

          checkoutLockOwned =
            false;

          return json({
            success: true,

            alreadyActive:
              true,

            action:
              'already_active',

            plan:
              existingPlan ||
              plan,

            subscription_id:
              subscription.id,

            price_id:
              currentPriceId ||
              priceId,

            message:
              `You already have an active ${plan} subscription.`,
          });
        }

        /*
         * DIFFERENT PLAN:
         *
         * Change the existing subscription
         * instead of creating another subscription.
         */
        const changed =
          await changeExistingSubscription(
            subscription,
            priceId,
            user.id,
            plan
          );

        await releaseCheckoutLock(
          user.id
        );

        checkoutLockOwned =
          false;

        return json({
          success: true,

          action:
            'changed',

          plan,

          subscription_id:
            changed.subscriptionId,

          customer_id:
            changed.customerId,

          price_id:
            priceId,
        });
      }

      /*
       * ------------------------------------------------------
       * CREATE NEW CHECKOUT
       * ------------------------------------------------------
       *
       * No active subscription exists, and this request
       * owns the user's checkout lock.
       */

      const checkout =
        await createCheckout(
          user,
          email,
          plan,
          priceId
        );

      if (
        !checkout?.url
      ) {
        throw new Error(
          'Stripe did not return a Checkout URL.'
        );
      }

      /*
       * Save the newly created Checkout Session in the lock.
       *
       * A concurrent request arriving after this point can
       * reuse this exact Stripe Checkout Session instead of
       * creating another one.
       */
      await finishCheckoutLock(
        user.id,
        plan,
        checkout.id || '',
        checkout.url
      );

      checkoutLockOwned =
        false;

      return json({
        success: true,

        action:
          'checkout',

        plan,

        price_id:
          priceId,

        url:
          checkout.url,

        session_id:
          checkout.id ||
          null,
      });
    } catch (error) {
      console.error(
        '[CHECKOUT] create-checkout-session error:',
        error
      );

      /*
       * If this request owned the lock and failed before
       * creating a reusable Checkout Session, release it
       * so the user can retry immediately.
       */
      try {
        if (
          checkoutLockUserId &&
          checkoutLockOwned
        ) {
          await releaseCheckoutLock(
            checkoutLockUserId
          );
        }
      } catch (
        releaseError
      ) {
        console.error(
          '[CHECKOUT] Failed to release checkout lock after error:',
          releaseError
        );
      }

      return json(
        {
          success: false,

          error:
            error instanceof
            Error
              ? error.message
              : 'Unable to start checkout.',
        },
        400
      );
    }
  }
);
