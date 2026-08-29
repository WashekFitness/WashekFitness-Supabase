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

/*
 * ============================================================
 * SERVER CONFIG
 * ============================================================
 */

const STRIPE_SECRET_KEY =
  Deno.env.get('STRIPE_SECRET_KEY') || '';

const SUPABASE_URL =
  Deno.env.get('SUPABASE_URL') || '';

const SUPABASE_ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ||
  '';

const APP_URL =
  Deno.env.get('APP_URL') ||
  'https://washekfitness.com';

/*
 * ============================================================
 * YOUR STRIPE PRODUCT IDS
 * ============================================================
 */

const PRODUCTS = {
  progress:
    'prod_USTp1fOzf3aHsl',

  performance:
    'prod_USTpsXJPgs7ccs',

  elite:
    'prod_USTqn0bZsTVUkH',
};

const VALID_PLANS = [
  'progress',
  'performance',
  'elite',
];

/*
 * ============================================================
 * HELPERS
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
 * STRIPE REQUEST
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
      'STRIPE_SECRET_KEY is missing from Supabase Edge Function Secrets.'
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

  const rawText =
    await response.text();

  let data: any = {};

  try {
    data =
      JSON.parse(
        rawText
      );
  } catch {
    data = {
      raw:
        rawText,
    };
  }

  if (
    !response.ok
  ) {
    throw new Error(
      data?.error?.message ||
        data?.message ||
        `Stripe returned HTTP ${response.status}.`
    );
  }

  return data;
}

/*
 * ============================================================
 * AUTHENTICATE THE WASHEK USER
 * ============================================================
 *
 * Uses the user's existing JWT instead of relying on
 * SUPABASE_SERVICE_ROLE_KEY.
 * ============================================================
 */

async function authenticateUser(
  req: Request
) {
  const authHeader =
    req.headers.get(
      'Authorization'
    );

  if (
    !authHeader
  ) {
    throw new Error(
      'Missing Authorization header. Please sign in again.'
    );
  }

  if (
    !SUPABASE_URL
  ) {
    throw new Error(
      'SUPABASE_URL is missing from the Edge Function environment.'
    );
  }

  if (
    !SUPABASE_ANON_KEY
  ) {
    throw new Error(
      'SUPABASE_ANON_KEY is missing from the Edge Function environment.'
    );
  }

  const supabase =
    createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization:
              authHeader,
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
      'No authenticated Washek user was found.'
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
 * PRODUCT
 * ============================================================
 */

function getProductId(
  plan: string
) {
  if (
    !VALID_PLANS.includes(
      plan
    )
  ) {
    throw new Error(
      'Invalid plan. Choose Progress, Performance, or Elite.'
    );
  }

  return (
    PRODUCTS[
      plan as keyof typeof PRODUCTS
    ]
  );
}

/*
 * ============================================================
 * GET THE ACTIVE RECURRING PRICE ATTACHED TO A PRODUCT
 * ============================================================
 */

async function getPriceForProduct(
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

  let result: any;

  try {
    result =
      await stripe(
        `prices?${params.toString()}`
      );
  } catch (
    error
  ) {
    throw new Error(
      `Unable to retrieve the Stripe Price for Product ${productId}: ${
        error instanceof Error
          ? error.message
          : 'Stripe request failed.'
      }`
    );
  }

  const prices =
    result?.data ||
    [];

  if (
    prices.length ===
    0
  ) {
    throw new Error(
      `Stripe Product ${productId} has no active recurring Price in the current Stripe environment.`
    );
  }

  /*
   * Prefer monthly recurring billing.
   */
  const monthly =
    prices.find(
      (price: any) =>
        price?.recurring
          ?.interval ===
        'month'
    );

  return (
    monthly ||
    prices[0]
  );
}

/*
 * ============================================================
 * GET PROFILE
 * ============================================================
 */

async function getProfile(
  supabase: any,
  userId: string
) {
  const {
    data,
    error,
  } =
    await supabase
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
        userId
      )
      .maybeSingle();

  if (
    error
  ) {
    throw new Error(
      `Unable to load your Washek profile: ${error.message}`
    );
  }

  /*
   * A profile isn't optional for subscription operations.
   */
  if (
    !data
  ) {
    throw new Error(
      'Your Washek profile could not be found. Please finish setting up your account before subscribing.'
    );
  }

  return data;
}

/*
 * ============================================================
 * FIND EXISTING STRIPE SUBSCRIPTION
 * ============================================================
 */

async function findExistingSubscription(
  profile: any
) {
  /*
   * 1. Saved subscription ID.
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
        [
          'active',
          'trialing',
          'past_due',
          'unpaid',
        ].includes(
          subscription.status
        )
      ) {
        return subscription;
      }
    } catch {
      /*
       * Ignore stale subscription IDs and
       * continue searching.
       */
    }
  }

  /*
   * 2. Saved customer ID.
   */
  if (
    profile?.stripe_customer_id
  ) {
    try {
      const result =
        await stripe(
          `subscriptions?customer=${encodeURIComponent(
            profile.stripe_customer_id
          )}&status=all&limit=50`
        );

      const subscription =
        (
          result?.data ||
          []
        ).find(
          (item: any) =>
            [
              'active',
              'trialing',
              'past_due',
              'unpaid',
            ].includes(
              item.status
            )
        );

      if (
        subscription
      ) {
        return subscription;
      }
    } catch {
      /*
       * Continue.
       */
    }
  }

  /*
   * 3. Recover Stripe customer through email.
   */
  const email =
    (
      profile?.email ||
      ''
    )
      .trim()
      .toLowerCase();

  if (
    email
  ) {
    try {
      const customers =
        await stripe(
          `customers?email=${encodeURIComponent(
            email
          )}&limit=50`
        );

      for (
        const customer of
        customers?.data ||
        []
      ) {
        const result =
          await stripe(
            `subscriptions?customer=${encodeURIComponent(
              customer.id
            )}&status=all&limit=50`
          );

        const subscription =
          (
            result?.data ||
            []
          ).find(
            (item: any) =>
              [
                'active',
                'trialing',
                'past_due',
                'unpaid',
              ].includes(
                item.status
              )
          );

        if (
          subscription
        ) {
          return subscription;
        }
      }
    } catch {
      /*
       * Continue to checkout creation.
       */
    }
  }

  return null;
}

/*
 * ============================================================
 * UPDATE LOCAL PROFILE
 * ============================================================
 */

async function updateProfile(
  supabase: any,
  userId: string,
  values: Record<string, unknown>
) {
  const {
    error,
  } =
    await supabase
      .from('profiles')
      .update({
        ...values,

        subscription_updated_at:
          new Date().toISOString(),

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        userId
      );

  if (
    error
  ) {
    throw new Error(
      `Unable to update your Washek subscription record: ${error.message}`
    );
  }
}

/*
 * ============================================================
 * CREATE CHECKOUT SESSION
 * ============================================================
 */

async function createCheckoutSession(
  user: any,
  profile: any,
  plan: string,
  priceId: string,
  productId: string
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
   * Successful payment returns the user here.
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
   * Session-level identity.
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
    'metadata[product_id]',
    productId
  );

  params.set(
    'metadata[price_id]',
    priceId
  );

  /*
   * Subscription-level identity.
   *
   * This is what the webhook will later use.
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
    'subscription_data[metadata][product_id]',
    productId
  );

  params.set(
    'subscription_data[metadata][price_id]',
    priceId
  );

  /*
   * Reuse the existing Stripe customer when
   * we already know who they are.
   */
  if (
    profile?.stripe_customer_id
  ) {
    params.set(
      'customer',
      profile.stripe_customer_id
    );
  } else {
    const email =
      profile?.email ||
      user?.email ||
      '';

    if (
      email
    ) {
      params.set(
        'customer_email',
        email
      );
    }
  }

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
 * EDGE FUNCTION
 * ============================================================
 */

Deno.serve(
  async (req) => {
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
       * --------------------------------------------------------
       * AUTHENTICATE
       * --------------------------------------------------------
       */

      const {
        user,
        supabase,
      } =
        await authenticateUser(
          req
        );

      /*
       * --------------------------------------------------------
       * BODY
       * --------------------------------------------------------
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
              'Invalid plan. Choose Progress, Performance, or Elite.',
          },
          400
        );
      }

      /*
       * --------------------------------------------------------
       * PRODUCT
       * --------------------------------------------------------
       */

      const productId =
        getProductId(
          plan
        );

      /*
       * --------------------------------------------------------
       * PROFILE
       * --------------------------------------------------------
       */

      const profile =
        await getProfile(
          supabase,
          user.id
        );

      /*
       * --------------------------------------------------------
       * PRICE
       * --------------------------------------------------------
       */

      const price =
        await getPriceForProduct(
          productId
        );

      /*
       * --------------------------------------------------------
       * EXISTING SUBSCRIPTION
       * --------------------------------------------------------
       */

      const existingSubscription =
        await findExistingSubscription(
          profile
        );

      /*
       * --------------------------------------------------------
       * EXISTING PAID SUBSCRIPTION
       * --------------------------------------------------------
       *
       * For now, paid -> paid changes are handled by
       * the same Stripe subscription instead of opening
       * another checkout.
       */

      if (
        existingSubscription
      ) {
        const item =
          existingSubscription
            ?.items
            ?.data?.[0];

        if (
          !item
        ) {
          throw new Error(
            'Your Stripe subscription does not contain a subscription item that can be changed.'
          );
        }

        /*
         * Already on desired plan.
         */
        if (
          item?.price?.id ===
          price.id
        ) {
          await updateProfile(
            supabase,
            user.id,
            {
              subscription_plan:
                plan,

              subscription_status:
                existingSubscription.status,

              stripe_customer_id:
                typeof existingSubscription.customer ===
                'string'
                  ? existingSubscription.customer
                  : profile?.stripe_customer_id ||
                    null,

              stripe_subscription_id:
                existingSubscription.id,

              stripe_price_id:
                price.id,
            }
          );

          return json({
            success:
              true,

            action:
              'changed',

            plan,

            subscription_id:
              existingSubscription.id,

            price_id:
              price.id,
          });
        }

        /*
         * Change the existing subscription item.
         */
        const itemParams =
          new URLSearchParams();

        itemParams.set(
          'price',
          price.id
        );

        itemParams.set(
          'quantity',
          String(
            item.quantity ||
              1
          )
        );

        /*
         * No automatic prorated charge.
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
         * Synchronize subscription metadata.
         */
        const subscriptionParams =
          new URLSearchParams();

        subscriptionParams.set(
          'metadata[user_id]',
          user.id
        );

        subscriptionParams.set(
          'metadata[plan]',
          plan
        );

        subscriptionParams.set(
          'metadata[product_id]',
          productId
        );

        subscriptionParams.set(
          'metadata[price_id]',
          price.id
        );

        await stripe(
          `subscriptions/${encodeURIComponent(
            existingSubscription.id
          )}`,
          {
            method:
              'POST',

            body:
              subscriptionParams.toString(),
          }
        );

        /*
         * Update Washek immediately.
         */
        await updateProfile(
          supabase,
          user.id,
          {
            subscription_plan:
              plan,

            subscription_status:
              existingSubscription.status,

            stripe_customer_id:
              typeof existingSubscription.customer ===
              'string'
                ? existingSubscription.customer
                : profile?.stripe_customer_id ||
                  null,

            stripe_subscription_id:
              existingSubscription.id,

            stripe_price_id:
              price.id,
          }
        );

        return json({
          success:
            true,

          action:
            'changed',

          plan,

          subscription_id:
            existingSubscription.id,

          price_id:
            price.id,
        });
      }

      /*
       * --------------------------------------------------------
       * FREE -> PAID
       * --------------------------------------------------------
       */

      const session =
        await createCheckoutSession(
          user,
          profile,
          plan,
          price.id,
          productId
        );

      if (
        !session?.url
      ) {
        throw new Error(
          'Stripe created the Checkout Session but did not return a checkout URL.'
        );
      }

      console.log(
        'Washek Stripe Checkout created successfully.',
        {
          userId:
            user.id,

          plan,

          productId,

          priceId:
            price.id,

          sessionId:
            session.id,
        }
      );

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
          price.id,
      });
    } catch (
      error
    ) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to start Stripe checkout.';

      console.error(
        'create-checkout-session error:',
        {
          message,

          error,

          timestamp:
            new Date().toISOString(),
        }
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
