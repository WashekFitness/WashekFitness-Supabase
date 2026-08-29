import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/*
 * ============================================================
 * CORS
 * ============================================================
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',

  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',

  'Access-Control-Allow-Methods':
    'POST, OPTIONS',

  'Content-Type':
    'application/json',
};

/*
 * ============================================================
 * ENVIRONMENT
 * ============================================================
 */

const SUPABASE_URL =
  Deno.env.get('SUPABASE_URL') || '';

const STRIPE_SECRET_KEY =
  Deno.env.get('STRIPE_SECRET_KEY') || '';

const APP_URL =
  Deno.env.get('APP_URL') ||
  'https://washekfitness.com';

/*
 * ============================================================
 * EXACT STRIPE PRICE IDS
 * ============================================================
 *
 * These are the actual recurring Price IDs from your
 * Stripe Sandbox.
 */

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

/*
 * ============================================================
 * RESPONSE HELPER
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

      headers:
        corsHeaders,
    }
  );
}

/*
 * ============================================================
 * SUPABASE PUBLIC KEY
 * ============================================================
 *
 * Uses the same publishable-key approach as your working
 * ai-generate function.
 * ============================================================
 */

function getSupabaseKey() {
  const raw =
    Deno.env.get(
      'SUPABASE_PUBLISHABLE_KEYS'
    );

  if (
    raw
  ) {
    try {
      const parsed =
        JSON.parse(
          raw
        );

      if (
        parsed?.default
      ) {
        return parsed.default;
      }
    } catch {
      /*
       * Fall through.
       */
    }
  }

  return (
    Deno.env.get(
      'SUPABASE_ANON_KEY'
    ) || ''
  );
}

/*
 * ============================================================
 * AUTHENTICATE USER
 * ============================================================
 */

async function getUser(
  req: Request
) {
  const authorization =
    req.headers.get(
      'Authorization'
    );

  if (
    !authorization
  ) {
    throw new Error(
      'Missing Authorization header. Please sign in again.'
    );
  }

  if (
    !SUPABASE_URL
  ) {
    throw new Error(
      'SUPABASE_URL is not configured.'
    );
  }

  const supabaseKey =
    getSupabaseKey();

  if (
    !supabaseKey
  ) {
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
          persistSession:
            false,

          autoRefreshToken:
            false,
        },
      }
    );

  const {
    data,
    error,
  } =
    await supabase.auth.getUser();

  if (
    error
  ) {
    throw new Error(
      `Supabase authentication failed: ${error.message}`
    );
  }

  if (
    !data?.user
  ) {
    throw new Error(
      'No authenticated user was found.'
    );
  }

  return {
    user:
      data.user,

    supabase,
  };
}

/*
 * ============================================================
 * GET STRIPE PRICE
 * ============================================================
 */

function getPriceId(
  plan: string
) {
  const priceId =
    PRICES[
      plan as keyof typeof PRICES
    ];

  if (
    !priceId
  ) {
    throw new Error(
      `Invalid subscription plan: ${plan}`
    );
  }

  return priceId;
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

  const text =
    await response.text();

  let data: any = {};

  try {
    data =
      JSON.parse(
        text
      );
  } catch {
    data = {
      raw:
        text,
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
 * FIND STRIPE CUSTOMER BY EMAIL
 * ============================================================
 */

async function findCustomerByEmail(
  email: string
) {
  if (
    !email
  ) {
    return null;
  }

  const result =
    await stripe(
      `customers?email=${encodeURIComponent(
        email
      )}&limit=50`
    );

  const customers =
    Array.isArray(
      result?.data
    )
      ? result.data
      : [];

  return (
    customers[0] ||
    null
  );
}

/*
 * ============================================================
 * FIND EXISTING ACTIVE SUBSCRIPTION
 * ============================================================
 *
 * This prevents a user from accidentally creating a second
 * subscription if Stripe already has one for this email.
 * ============================================================
 */

async function findExistingSubscription(
  customerId: string
) {
  if (
    !customerId
  ) {
    return null;
  }

  const result =
    await stripe(
      `subscriptions?customer=${encodeURIComponent(
        customerId
      )}&status=all&limit=50`
    );

  const subscriptions =
    Array.isArray(
      result?.data
    )
      ? result.data
      : [];

  return (
    subscriptions.find(
      (subscription: any) =>
        [
          'active',
          'trialing',
          'past_due',
          'unpaid',
        ].includes(
          subscription.status
        )
    ) ||
    null
  );
}

/*
 * ============================================================
 * UPDATE SUBSCRIPTION
 * ============================================================
 *
 * Used when a current paid customer changes from one
 * Washek plan to another.
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

  if (
    !item
  ) {
    throw new Error(
      'Your Stripe subscription has no subscription item to change.'
    );
  }

  /*
   * Change the subscription item to the new Price.
   */
  const itemParams =
    new URLSearchParams();

  itemParams.set(
    'price',
    priceId
  );

  itemParams.set(
    'quantity',
    String(
      item.quantity ||
        1
    )
  );

  /*
   * Avoid an unexpected prorated charge.
   */
  itemParams.set(
    'proration_behavior',
    'none'
  );

  await stripe(
    `subscription_items/${encodeURIComponent(
      item.id
    )}`,
    {
      method:
        'POST',

      body:
        itemParams.toString(),
    }
  );

  /*
   * Keep Stripe metadata synchronized with Washek.
   */
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
      method:
        'POST',

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
        : null,
  };
}

/*
 * ============================================================
 * CREATE STRIPE CHECKOUT SESSION
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

  /*
   * Successful checkout returns the user to Washek.
   */
  params.set(
    'success_url',
    `${APP_URL}/subscription-return?session_id={CHECKOUT_SESSION_ID}&plan=${encodeURIComponent(
      plan
    )}`
  );

  /*
   * User canceled checkout.
   */
  params.set(
    'cancel_url',
    `${APP_URL}/profile`
  );

  /*
   * Link Checkout Session to the exact Washek account.
   */
  params.set(
    'client_reference_id',
    user.id
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

  /*
   * The metadata below is copied to the created Stripe
   * Subscription and is what your webhook can use later.
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

  /*
   * Use the authenticated email.
   */
  params.set(
    'customer_email',
    email
  );

  /*
   * Create Checkout.
   */
  return stripe(
    'checkout/sessions',
    {
      method:
        'POST',

      body:
        params.toString(),
    }
  );
}

/*
 * ============================================================
 * MAIN EDGE FUNCTION
 * ============================================================
 */

Deno.serve(
  async (req) => {
    /*
     * --------------------------------------------------------
     * OPTIONS
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
       * AUTH
       * ------------------------------------------------------
       */

      const {
        user,
        supabase,
      } =
        await getUser(
          req
        );

      /*
       * ------------------------------------------------------
       * BODY
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

      /*
       * ------------------------------------------------------
       * EXACT PRICE
       * ------------------------------------------------------
       */

      const priceId =
        getPriceId(
          plan
        );

      /*
       * ------------------------------------------------------
       * EMAIL
       * ------------------------------------------------------
       */

      const email =
        (
          user.email ||
          ''
        )
          .trim()
          .toLowerCase();

      if (
        !email
      ) {
        throw new Error(
          'Your Washek account does not have an email address.'
        );
      }

      console.log(
        '[CHECKOUT] Starting checkout:',
        {
          userId:
            user.id,

          plan,

          priceId,

          email,
        }
      );

      /*
       * ------------------------------------------------------
       * FIND EXISTING STRIPE CUSTOMER
       * ------------------------------------------------------
       */

      const customer =
        await findCustomerByEmail(
          email
        );

      /*
       * ------------------------------------------------------
       * FIND EXISTING SUBSCRIPTION
       * ------------------------------------------------------
       */

      if (
        customer
      ) {
        const existing =
          await findExistingSubscription(
            customer.id
          );

        if (
          existing
        ) {
          const item =
            existing
              ?.items
              ?.data?.[0];

          const currentPriceId =
            item?.price?.id ||
            null;

          /*
           * Already on selected plan.
           */
          if (
            currentPriceId ===
            priceId
          ) {
            return json({
              success:
                true,

              action:
                'changed',

              plan,

              subscription_id:
                existing.id,

              price_id:
                priceId,

              message:
                `You already have an active ${plan} subscription.`,
            });
          }

          /*
           * Change existing subscription instead of
           * creating a duplicate one.
           */
          const changed =
            await changeExistingSubscription(
              existing,
              priceId,
              user.id,
              plan
            );

          /*
           * Keep Washek's local profile synchronized
           * when RLS allows the authenticated user to
           * update these fields.
           */
          const {
            error:
              profileUpdateError,
          } =
            await supabase
              .from('profiles')
              .update({
                subscription_plan:
                  plan,

                subscription_status:
                  existing.status,

                stripe_customer_id:
                  changed.customerId,

                stripe_subscription_id:
                  existing.id,

                stripe_price_id:
                  priceId,

                subscription_updated_at:
                  new Date().toISOString(),

                updated_at:
                  new Date().toISOString(),
              })
              .eq(
                'id',
                user.id
              );

          if (
            profileUpdateError
          ) {
            console.warn(
              '[CHECKOUT] Profile update could not be completed:',
              profileUpdateError.message
            );
          }

          console.log(
            '[CHECKOUT] Existing subscription changed:',
            {
              userId:
                user.id,

              plan,

              subscriptionId:
                existing.id,

              priceId,
            }
          );

          return json({
            success:
              true,

            action:
              'changed',

            plan,

            subscription_id:
              existing.id,

            price_id:
              priceId,
          });
        }
      }

      /*
       * ------------------------------------------------------
       * CREATE NEW CHECKOUT
       * ------------------------------------------------------
       */

      const session =
        await createCheckout(
          user,
          email,
          plan,
          priceId
        );

      if (
        !session?.url
      ) {
        throw new Error(
          'Stripe did not return a Checkout URL.'
        );
      }

      console.log(
        '[CHECKOUT] Stripe Checkout created:',
        {
          userId:
            user.id,

          plan,

          priceId,

          sessionId:
            session.id,
        }
      );

      /*
       * ------------------------------------------------------
       * SUCCESS
       * ------------------------------------------------------
       */

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

        price_id:
          priceId,
      });
    } catch (
      error
    ) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to start Stripe Checkout.';

      console.error(
        '[CHECKOUT] create-checkout-session failed:',
        {
          message,

          timestamp:
            new Date().toISOString(),
        }
      );

      /*
       * Return 200 with success:false so the frontend
       * receives the real error instead of a generic
       * Supabase non-2xx error.
       */
      return json({
        success:
          false,

        error:
          message,
      });
    }
  }
);
