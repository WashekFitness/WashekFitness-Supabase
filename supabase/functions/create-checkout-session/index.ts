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
 * PROFILE SUBSCRIPTION STATE
 * ============================================================
 *
 * This is intentionally checked BEFORE searching Stripe.
 *
 * A Stripe customer with the same email is NOT enough proof
 * that the subscription belongs to this Washek account.
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
 * EXISTING STRIPE SUBSCRIPTION
 * ============================================================
 *
 * We only retrieve a subscription by an exact Stripe
 * subscription ID already stored on the Washek profile.
 *
 * We DO NOT search Stripe by email and assume the first
 * subscription belongs to this user.
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
    const subscription =
      await stripe(
        `subscriptions/${encodeURIComponent(
          subscriptionId
        )}`
      );

    return subscription;
  } catch (error) {
    console.warn(
      '[CHECKOUT] Could not retrieve profile Stripe subscription:',
      error
    );

    return null;
  }
}

/*
 * ============================================================
 * CHANGE EXISTING PAID SUBSCRIPTION
 * ============================================================
 *
 * This path is ONLY used when the Washek profile already
 * contains a valid active paid subscription.
 *
 * Free users NEVER enter this path.
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

  const currentPriceId =
    item?.price?.id ||
    null;

  if (
    currentPriceId ===
    priceId
  ) {
    return {
      subscriptionId:
        subscription.id,

      customerId:
        typeof subscription.customer ===
        'string'
          ? subscription.customer
          : subscription.customer?.id ||
            null,

      changed:
        false,
    };
  }

  /*
   * IMPORTANT:
   *
   * For an existing paid subscription, use Stripe's
   * subscription update rather than creating a second
   * subscription.
   *
   * Proration is enabled so Stripe can generate the
   * appropriate billing adjustment for the upgrade.
   */

  const params =
    new URLSearchParams();

  params.set(
    'items[0][id]',
    item.id
  );

  params.set(
    'items[0][price]',
    priceId
  );

  params.set(
    'items[0][quantity]',
    String(
      item.quantity || 1
    )
  );

  params.set(
    'proration_behavior',
    'always_invoice'
  );

  params.set(
    'payment_behavior',
    'pending_if_incomplete'
  );

  params.set(
    'metadata[user_id]',
    userId
  );

  params.set(
    'metadata[plan]',
    plan
  );

  params.set(
    'metadata[price_id]',
    priceId
  );

  const updated =
    await stripe(
      `subscriptions/${encodeURIComponent(
        subscription.id
      )}`,
      {
        method:
          'POST',

        body:
          params.toString(),
      }
    );

  /*
   * Stripe may return a subscription with a pending update
   * when payment is required.
   *
   * We do NOT immediately tell the UI that the user has
   * successfully upgraded unless Stripe confirms the new
   * price on the subscription.
   */

  const updatedPriceId =
    updated
      ?.items
      ?.data?.[0]
      ?.price
      ?.id ||
    null;

  if (
    updatedPriceId !==
    priceId
  ) {
    return {
      subscriptionId:
        updated.id,

      customerId:
        typeof updated.customer ===
        'string'
          ? updated.customer
          : updated.customer?.id ||
            null,

      changed:
        false,

      paymentRequired:
        true,

      pending:
        true,
    };
  }

  return {
    subscriptionId:
      updated.id,

    customerId:
      typeof updated.customer ===
      'string'
        ? updated.customer
        : updated.customer?.id ||
          null,

    changed:
      true,

    paymentRequired:
      false,

    pending:
      false,
  };
}

/*
 * ============================================================
 * CREATE NEW CHECKOUT SESSION
 * ============================================================
 *
 * THIS IS THE NORMAL FREE -> PAID PATH.
 *
 * A real Stripe Checkout Session is created.
 * The user is redirected to Stripe.
 * Stripe collects payment.
 * Stripe creates the subscription.
 * Stripe webhook synchronizes the Washek profile.
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

  /*
   * Checkout metadata.
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
   * Subscription metadata.
   *
   * This is critical because the Stripe webhook uses the
   * subscription metadata to associate the Stripe subscription
   * with the correct Washek account.
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
      'Stripe created a Checkout Session but did not return a usable Checkout URL.'
    );
  }

  return checkout;
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
 * GET STORED CHECKOUT SESSION
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
      '[CHECKOUT] Unable to retrieve stored Checkout Session:',
      error
    );

    return null;
  }
}

/*
 * ============================================================
 * EXPIRE CHECKOUT SESSION
 * ============================================================
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
        method:
          'POST',

        body:
          '',
      }
    );
  } catch (error) {
    console.warn(
      '[CHECKOUT] Could not expire old Checkout Session:',
      error
    );
  }
}

/*
 * ============================================================
 * HANDLE EXISTING CHECKOUT LOCK
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
   * Completed Checkout Session:
   *
   * The user already went through Stripe. Do not reuse the
   * completed session. The webhook will be responsible for
   * synchronizing the subscription.
   */

  if (
    sessionStatus ===
    'complete'
  ) {
    await releaseCheckoutLock(
      userId
    );

    return {
      action:
        'retry',
    };
  }

  /*
   * Expired Checkout Session.
   */

  if (
    sessionStatus ===
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

  /*
   * Existing open session for the SAME plan.
   */

  if (
    sessionStatus ===
      'open' &&
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
   * Existing open session for a DIFFERENT plan.
   */

  if (
    sessionStatus ===
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

  /*
   * Unknown state.
   */

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
       * 1. AUTHENTICATE
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
       * 3. READ WASHEK PROFILE FIRST
       * ======================================================
       *
       * This is the critical change.
       *
       * We no longer search Stripe by email and assume that
       * whatever subscription we find belongs to this user.
       */

      const profile =
        await getProfileSubscription(
          user.id
        );

      const profilePaid =
        isProfilePaid(
          profile
        );

      console.log(
        '[CHECKOUT] Subscription state:',
        {
          userId:
            user.id,

          requestedPlan:
            plan,

          profilePlan:
            profile?.subscription_plan ||
            'free',

          profileStatus:
            profile?.subscription_status ||
            'none',

          profileStripeSubscriptionId:
            profile?.stripe_subscription_id ||
            null,

          profilePaid,
        }
      );

      /*
       * ======================================================
       * 4. CLAIM CHECKOUT LOCK
       * ======================================================
       *
       * The lock is needed for the new Checkout path.
       */

      checkoutLockUserId =
        user.id;

      /*
       * IMPORTANT:
       *
       * Only use the checkout lock for a NEW Checkout Session.
       *
       * Existing paid subscriptions are handled directly below.
       */

      if (
        !profilePaid
      ) {
        let lock =
          await claimCheckoutLock(
            user.id,
            plan
          );

        /*
         * ====================================================
         * 5. HANDLE EXISTING CHECKOUT LOCK
         * ====================================================
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

          if (
            resolved.action ===
            'retry'
          ) {
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
         * ====================================================
         * 6. CREATE REAL STRIPE CHECKOUT
         * ====================================================
         *
         * THIS IS THE FIX.
         *
         * A free user cannot be upgraded merely by changing a
         * Stripe subscription found by email.
         *
         * They must go through Checkout.
         */

        checkoutLockOwned =
          true;

        console.log(
          '[CHECKOUT] Free/unpaid Washek account. Creating real Stripe Checkout Session:',
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
        });
      }

      /*
       * ======================================================
       * 7. EXISTING PAID WASHEK SUBSCRIPTION
       * ======================================================
       */

      const currentPlan =
        String(
          profile?.subscription_plan ||
            ''
        )
          .trim()
          .toLowerCase();

      /*
       * Same plan.
       */

      if (
        currentPlan ===
        plan
      ) {
        return json({
          success:
            true,

          alreadyActive:
            true,

          action:
            'already_active',

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
       * 8. VERIFY EXISTING STRIPE SUBSCRIPTION
       * ======================================================
       */

      const existingSubscription =
        await getExistingProfileSubscription(
          profile
        );

      if (
        !existingSubscription
      ) {
        /*
         * The profile claims the user is paid, but Stripe no
         * longer has the subscription.
         *
         * Do NOT silently upgrade.
         *
         * Clear the stale subscription state and require a
         * fresh Checkout Session.
         */

        console.warn(
          '[CHECKOUT] Profile referenced a missing Stripe subscription. Creating fresh Checkout.',
          {
            userId:
              user.id,

            stripeSubscriptionId:
              profile?.stripe_subscription_id,
          }
        );

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
          })
          .eq(
            'id',
            user.id
          );

        checkoutLockOwned =
          true;

        const lock =
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
            const session =
              resolved.session;

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
        }

        const checkout =
          await createCheckout(
            user,
            email,
            plan,
            priceId
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
        });
      }

      /*
       * ======================================================
       * 9. VERIFY SUBSCRIPTION REALLY BELONGS TO USER
       * ======================================================
       */

      const subscriptionUserId =
        String(
          existingSubscription
            ?.metadata
            ?.user_id ||
            ''
        ).trim();

      if (
        subscriptionUserId &&
        subscriptionUserId !==
          user.id
      ) {
        throw new Error(
          'The Stripe subscription associated with this account does not belong to the current Washek user.'
        );
      }

      /*
       * If the subscription has no user metadata, only trust it
       * when its ID is already stored on this user's profile.
       *
       * This prevents email-based account collisions.
       */

      if (
        existingSubscription.id !==
        profile.stripe_subscription_id
      ) {
        throw new Error(
          'The Stripe subscription could not be verified for this Washek account.'
        );
      }

      /*
       * ======================================================
       * 10. VERIFY ACTIVE STATUS
       * ======================================================
       */

      const stripeStatus =
        String(
          existingSubscription?.status ||
            ''
        )
          .trim()
          .toLowerCase();

      if (
        !ACTIVE_STATUSES.includes(
          stripeStatus
        )
      ) {
        /*
         * Subscription is not active anymore.
         *
         * Require a new Checkout flow.
         */

        await supabaseAdmin
          .from('profiles')
          .update({
            subscription_plan:
              'free',

            subscription_status:
              stripeStatus ||
              'canceled',

            stripe_subscription_id:
              null,

            stripe_price_id:
              null,
          })
          .eq(
            'id',
            user.id
          );

        checkoutLockOwned =
          true;

        await claimCheckoutLock(
          user.id,
          plan
        );

        const checkout =
          await createCheckout(
            user,
            email,
            plan,
            priceId
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
        });
      }

      /*
       * ======================================================
       * 11. PAID -> PAID PLAN CHANGE
       * ======================================================
       */

      console.log(
        '[CHECKOUT] Existing verified paid subscription. Updating Stripe subscription:',
        {
          userId:
            user.id,

          currentPlan,

          requestedPlan:
            plan,

          subscriptionId:
            existingSubscription.id,
        }
      );

      const changed =
        await changeExistingSubscription(
          existingSubscription,
          priceId,
          user.id,
          plan
        );

      /*
       * Stripe did not actually apply the requested price.
       *
       * Do NOT tell the user they upgraded.
       */

      if (
        changed.pending ||
        changed.paymentRequired
      ) {
        return json({
          success:
            false,

          action:
            'payment_required',

          plan,

          subscription_id:
            changed.subscriptionId,

          price_id:
            priceId,

          error:
            'Stripe requires payment confirmation before this subscription can be upgraded. Your current plan has not been changed yet.',
        }, 402);
      }

      if (
        !changed.changed
      ) {
        throw new Error(
          'Stripe did not confirm the requested subscription change.'
        );
      }

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
    } catch (error) {
      console.error(
        '[CHECKOUT] create-checkout-session error:',
        error
      );

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
