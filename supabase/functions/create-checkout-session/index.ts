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
 * SUPABASE AUTHENTICATION
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
 * PRICE / PLAN HELPERS
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

/*
 * ============================================================
 * EXISTING STRIPE CUSTOMERS
 * ============================================================
 */

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

/*
 * ============================================================
 * EXISTING STRIPE SUBSCRIPTIONS
 * ============================================================
 */

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
      subscription?.metadata
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

/*
 * ============================================================
 * FIND EXISTING ACTIVE SUBSCRIPTION
 * ============================================================
 */

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
   * Recover older subscriptions that
   * were created before user_id metadata.
   */

  return (
    allSubscriptions[0] ||
    null
  );
}

/*
 * ============================================================
 * CHANGE EXISTING SUBSCRIPTION
 * ============================================================
 */

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
        : subscription.customer?.id ||
          null,
  };
}

/*
 * ============================================================
 * CREATE NEW CHECKOUT SESSION
 * ============================================================
 */

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
 * ============================================================
 * CHECKOUT LOCK
 * ============================================================
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
 * CHECK EXISTING CHECKOUT SESSION
 * ============================================================
 *
 * This is the important fix.
 *
 * A database checkout lock can survive after the Stripe
 * Checkout Session has already been completed.
 *
 * We NEVER blindly trust checkout_url anymore.
 *
 * We retrieve the Stripe Checkout Session and verify:
 *
 * - it exists
 * - it is still open
 * - it belongs to the same requested plan
 *
 * If it is complete/expired/invalid, the stale lock is
 * removed and a fresh Checkout Session can be created.
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
      '[CHECKOUT] Unable to retrieve stored Checkout Session:',
      error
    );

    return null;
  }
}

/*
 * ============================================================
 * EXPIRE OLD OPEN CHECKOUT SESSION
 * ============================================================
 *
 * If an old session is still open but belongs to a different
 * plan than the user currently requested, expire it before
 * removing the stale lock.
 *
 * This prevents the old session from remaining usable.
 */

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
        method: 'POST',
        body: '',
      }
    );

    console.log(
      '[CHECKOUT] Expired stale Checkout Session:',
      sessionId
    );
  } catch (error) {
    /*
     * Expiration is cleanup.
     *
     * If Stripe says the session is already complete or expired,
     * that is fine. The important part is that the database lock
     * gets removed so a new checkout can be created.
     */

    console.warn(
      '[CHECKOUT] Could not expire old Checkout Session:',
      error
    );
  }
}

/*
 * ============================================================
 * HANDLE EXISTING LOCK
 * ============================================================
 */

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

  const lockedPlan =
    String(
      lock.plan ||
        ''
    )
      .trim()
      .toLowerCase();

  const sessionId =
    lock.stripe_session_id ||
    '';

  /*
   * ----------------------------------------------------------
   * LOCK EXISTS BUT NO SESSION YET
   * ----------------------------------------------------------
   *
   * Another request is currently creating a Stripe session.
   * Do not create a duplicate.
   */

  if (!sessionId) {
    return {
      action:
        'in_progress',
    };
  }

  /*
   * ----------------------------------------------------------
   * VERIFY STORED STRIPE SESSION
   * ----------------------------------------------------------
   */

  const session =
    await getCheckoutSession(
      sessionId
    );

  /*
   * If Stripe no longer has the session,
   * remove the stale database lock.
   */

  if (!session) {
    console.log(
      '[CHECKOUT] Removing stale lock because Stripe Checkout Session no longer exists:',
      {
        userId,
        sessionId,
      }
    );

    await releaseCheckoutLock(
      userId
    );

    return {
      action:
        'retry',
    };
  }

  const sessionStatus =
    String(
      session?.status ||
        ''
    )
      .trim()
      .toLowerCase();

  const sessionPlan =
    String(
      session
        ?.metadata
        ?.plan ||
        lockedPlan ||
        ''
    )
      .trim()
      .toLowerCase();

  /*
   * ----------------------------------------------------------
   * SESSION IS ALREADY COMPLETE
   * ----------------------------------------------------------
   *
   * This is exactly what happens after the previous checkout
   * has already been successfully completed.
   */

  if (
    sessionStatus ===
    'complete'
  ) {
    console.log(
      '[CHECKOUT] Removing completed Checkout Session lock:',
      {
        userId,
        sessionId,
        sessionPlan,
        requestedPlan,
      }
    );

    await releaseCheckoutLock(
      userId
    );

    return {
      action:
        'retry',
    };
  }

  /*
   * ----------------------------------------------------------
   * SESSION IS EXPIRED
   * ----------------------------------------------------------
   */

  if (
    sessionStatus ===
    'expired'
  ) {
    console.log(
      '[CHECKOUT] Removing expired Checkout Session lock:',
      {
        userId,
        sessionId,
      }
    );

    await releaseCheckoutLock(
      userId
    );

    return {
      action:
        'retry',
    };
  }

  /*
   * ----------------------------------------------------------
   * SESSION IS STILL OPEN
   * ----------------------------------------------------------
   */

  if (
    sessionStatus ===
    'open'
  ) {
    /*
     * Same plan:
     *
     * The old checkout session is still valid, so reusing it
     * is safe and preserves duplicate-checkout protection.
     */

    if (
      sessionPlan ===
      requestedPlan
    ) {
      return {
        action:
          'reuse',

        session,
      };
    }

    /*
     * Different plan:
     *
     * NEVER send the user to a Checkout Session for a different
     * plan than the button they clicked.
     *
     * Expire the old session, remove the lock, and let this
     * request create a new session for the requested plan.
     */

    console.log(
      '[CHECKOUT] Existing open Checkout Session belongs to a different plan. Replacing it:',
      {
        userId,
        sessionId,
        lockedPlan,
        sessionPlan,
        requestedPlan,
      }
    );

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

  /*
   * ----------------------------------------------------------
   * UNKNOWN STATUS
   * ----------------------------------------------------------
   *
   * Do not trust an unknown session state.
   * Remove the lock and create a fresh session.
   */

  console.warn(
    '[CHECKOUT] Unknown Checkout Session status. Removing lock:',
    {
      userId,
      sessionId,
      sessionStatus,
    }
  );

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
 * MAIN FUNCTION
 * ============================================================
 */

Deno.serve(
  async (req) => {
    let checkoutLockUserId:
      string | null = null;

    let checkoutLockOwned =
      false;

    /*
     * --------------------------------------------------------
     * CORS PREFLIGHT
     * --------------------------------------------------------
     */

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

    /*
     * --------------------------------------------------------
     * POST ONLY
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
       * ======================================================
       * 1. AUTHENTICATE USER
       * ======================================================
       */

      const {
        user,
      } =
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
       * 3. CLAIM CHECKOUT LOCK
       * ======================================================
       */

      checkoutLockUserId =
        user.id;

      let lock =
        await claimCheckoutLock(
          user.id,
          plan
        );

      /*
       * ======================================================
       * 4. HANDLE EXISTING LOCK
       * ======================================================
       */

      if (
        lock?.locked
      ) {
        const resolved =
          await resolveExistingCheckoutLock(
            user.id,
            plan,
            lock
          );

        /*
         * ----------------------------------------------------
         * REUSE VALID SAME-PLAN SESSION
         * ----------------------------------------------------
         */

        if (
          resolved.action ===
          'reuse'
        ) {
          const session =
            resolved.session;

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
              session.url,

            session_id:
              session.id ||
              null,

            reused:
              true,
          });
        }

        /*
         * ----------------------------------------------------
         * ANOTHER REQUEST IS CREATING A SESSION
         * ----------------------------------------------------
         */

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
                'A checkout session is already being created. Please wait a moment and try again.',
            },
            409
          );
        }

        /*
         * ----------------------------------------------------
         * STALE LOCK WAS REMOVED
         * ----------------------------------------------------
         *
         * Claim a fresh lock.
         */

        if (
          resolved.action ===
          'retry'
        ) {
          lock =
            await claimCheckoutLock(
              user.id,
              plan
            );

          /*
           * Another request may have claimed the slot between
           * the stale-lock cleanup and this retry.
           */

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
              const session =
                retryResolved.session;

              return json({
                success:
                  true,

                action:
                  'checkout',

                plan,

                price_id:
                  priceId,

                url:
                  session.url,

                session_id:
                  session.id ||
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
                  'A checkout session is already being created. Please wait a moment and try again.',
              },
              409
            );
          }
        }
      }

      /*
       * ======================================================
       * 5. THIS REQUEST NOW OWNS THE LOCK
       * ======================================================
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
       * ======================================================
       * 6. CHECK FOR EXISTING ACTIVE SUBSCRIPTION
       * ======================================================
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
            ?.price?.id ||
          null;

        /*
         * SAME PLAN
         *
         * Never create a second Checkout Session.
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
            success:
              true,

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
         * DIFFERENT PLAN
         *
         * Change the existing Stripe subscription instead of
         * creating a second subscription.
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
          success:
            true,

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
       * ======================================================
       * 7. NO ACTIVE SUBSCRIPTION
       * ======================================================
       *
       * Create a completely new Stripe Checkout Session.
       */

      console.log(
        '[CHECKOUT] No active subscription found. Creating fresh Checkout Session:',
        {
          userId:
            user.id,

          plan,

          priceId,
        }
      );

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
       * ======================================================
       * 8. SAVE NEW CHECKOUT LOCK
       * ======================================================
       */

      await finishCheckoutLock(
        user.id,
        plan,
        checkout.id ||
          '',
        checkout.url
      );

      checkoutLockOwned =
        false;

      /*
       * ======================================================
       * 9. RETURN CHECKOUT URL
       * ======================================================
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
          checkout.id ||
          null,
      });
    } catch (error) {
      console.error(
        '[CHECKOUT] create-checkout-session error:',
        error
      );

      /*
       * If this request claimed the lock but failed before
       * producing a reusable Checkout Session, release it.
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
          success:
            false,

          error:
            error instanceof Error
              ? error.message
              : 'Unable to start checkout.',
        },
        400
      );
    }
  }
);
