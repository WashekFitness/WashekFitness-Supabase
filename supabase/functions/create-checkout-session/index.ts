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

const STRIPE_SECRET_KEY =
  Deno.env.get('STRIPE_SECRET_KEY') || '';

const SUPABASE_URL =
  Deno.env.get('SUPABASE_URL') || '';

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const APP_URL =
  Deno.env.get('APP_URL') ||
  'https://washekfitness.com';

/*
 * ============================================================
 * WASHEK STRIPE PRODUCTS
 * ============================================================
 *
 * These are PRODUCT IDs, not Price IDs.
 *
 * The function dynamically finds the active recurring
 * Price attached to each Product.
 */
const PRODUCT_IDS = {
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

const supabaseAdmin =
  createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession:
          false,

        autoRefreshToken:
          false,
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

      headers:
        corsHeaders,
    }
  );
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
      raw: text,
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
 * AUTHENTICATION
 * ============================================================
 */

async function getAuthenticatedUser(
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
      'You must be signed in.'
    );
  }

  /*
   * Use the service-role client only on the
   * server to validate the user's JWT.
   */
  const token =
    authHeader.replace(
      /^Bearer\s+/i,
      ''
    );

  const {
    data,
    error,
  } =
    await supabaseAdmin.auth.getUser(
      token
    );

  if (
    error ||
    !data?.user
  ) {
    throw new Error(
      'Your login session is invalid or expired.'
    );
  }

  return data.user;
}

/*
 * ============================================================
 * PRODUCT / PRICE
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
      'Invalid subscription plan.'
    );
  }

  return (
    PRODUCT_IDS[
      plan as keyof typeof PRODUCT_IDS
    ]
  );
}

async function getActiveRecurringPrice(
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
    result?.data ||
    [];

  if (
    prices.length ===
    0
  ) {
    throw new Error(
      `Stripe has no active recurring Price attached to product ${productId}.`
    );
  }

  /*
   * Prefer monthly billing.
   */
  const monthly =
    prices.find(
      (price: any) =>
        price?.recurring
          ?.interval ===
        'month'
    );

  if (
    monthly
  ) {
    return monthly;
  }

  /*
   * If the product only has another recurring interval,
   * use it rather than failing silently.
   */
  return prices[0];
}

/*
 * ============================================================
 * EXISTING SUBSCRIPTION
 * ============================================================
 */

function isUsableSubscriptionStatus(
  status: string
) {
  return [
    'active',
    'trialing',
    'past_due',
    'unpaid',
  ].includes(
    status
  );
}

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
        isUsableSubscriptionStatus(
          subscription.status
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
   * 2. Saved customer ID.
   */
  if (
    profile?.stripe_customer_id
  ) {
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
          isUsableSubscriptionStatus(
            item.status
          )
      );

    if (
      subscription
    ) {
      return subscription;
    }
  }

  /*
   * 3. Customer by email.
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
            isUsableSubscriptionStatus(
              item.status
            )
        );

      if (
        subscription
      ) {
        return subscription;
      }
    }
  }

  return null;
}

/*
 * ============================================================
 * UPDATE PROFILE
 * ============================================================
 */

async function updateProfile(
  userId: string,
  values: Record<
    string,
    unknown
  >
) {
  const {
    error,
  } =
    await supabaseAdmin
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
    throw error;
  }
}

/*
 * ============================================================
 * MAIN FUNCTION
 * ============================================================
 */

Deno.serve(
  async (req) => {
    /*
     * CORS.
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
       * USER
       * --------------------------------------------------------
       */

      const user =
        await getAuthenticatedUser(
          req
        );

      /*
       * --------------------------------------------------------
       * REQUEST
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
              'Please choose Progress, Performance, or Elite.',
          },
          400
        );
      }

      const productId =
        getProductId(
          plan
        );

      /*
       * --------------------------------------------------------
       * PROFILE
       * --------------------------------------------------------
       */

      const {
        data: profile,
        error:
          profileError,
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
            user.id
          )
          .single();

      if (
        profileError
      ) {
        console.error(
          'Profile lookup failed:',
          profileError
        );

        throw new Error(
          'Unable to load your Washek Fitness profile.'
        );
      }

      /*
       * --------------------------------------------------------
       * FIND STRIPE PRICE
       * --------------------------------------------------------
       */

      const targetPrice =
        await getActiveRecurringPrice(
          productId
        );

      /*
       * --------------------------------------------------------
       * CHECK EXISTING SUBSCRIPTION
       * --------------------------------------------------------
       *
       * This prevents users from accidentally creating
       * multiple subscriptions.
       */

      const existingSubscription =
        await findExistingSubscription(
          profile
        );

      /*
       * --------------------------------------------------------
       * PAID -> PAID
       * --------------------------------------------------------
       */

      if (
        existingSubscription
      ) {
        const item =
          existingSubscription
            ?.items
            ?.data?.[0];

        if (!item) {
          throw new Error(
            'Your Stripe subscription does not contain a subscription item.'
          );
        }

        /*
         * Already on this exact price.
         */
        if (
          item?.price?.id ===
          targetPrice.id
        ) {
          await updateProfile(
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
                targetPrice.id,
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
              targetPrice.id,
          });
        }

        /*
         * Change the existing subscription item.
         */
        const itemParams =
          new URLSearchParams();

        itemParams.set(
          'price',
          targetPrice.id
        );

        itemParams.set(
          'quantity',
          String(
            item.quantity ||
              1
          )
        );

        /*
         * No unexpected prorated charge.
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
         * Keep subscription metadata in sync.
         */
        const metadata =
          new URLSearchParams();

        metadata.set(
          'metadata[user_id]',
          user.id
        );

        metadata.set(
          'metadata[plan]',
          plan
        );

        metadata.set(
          'metadata[product_id]',
          productId
        );

        metadata.set(
          'metadata[price_id]',
          targetPrice.id
        );

        await stripe(
          `subscriptions/${encodeURIComponent(
            existingSubscription.id
          )}`,
          {
            method:
              'POST',

            body:
              metadata.toString(),
          }
        );

        const customerId =
          typeof existingSubscription.customer ===
          'string'
            ? existingSubscription.customer
            : profile?.stripe_customer_id ||
              null;

        await updateProfile(
          user.id,
          {
            subscription_plan:
              plan,

            subscription_status:
              existingSubscription.status,

            stripe_customer_id:
              customerId,

            stripe_subscription_id:
              existingSubscription.id,

            stripe_price_id:
              targetPrice.id,
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
            targetPrice.id,
        });
      }

      /*
       * --------------------------------------------------------
       * FREE -> PAID
       * --------------------------------------------------------
       */

      const params =
        new URLSearchParams();

      params.set(
        'mode',
        'subscription'
      );

      params.set(
        'line_items[0][price]',
        targetPrice.id
      );

      params.set(
        'line_items[0][quantity]',
        '1'
      );

      /*
       * After payment, Stripe returns the customer
       * to our subscription confirmation route.
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
       * Identify the exact Washek user.
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
        targetPrice.id
      );

      /*
       * Put the same information on the actual
       * Stripe Subscription.
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
        targetPrice.id
      );

      /*
       * Reuse an existing Stripe customer if we know it.
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
          user.email ||
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

      /*
       * --------------------------------------------------------
       * CREATE CHECKOUT
       * --------------------------------------------------------
       */

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

      if (
        !session?.url
      ) {
        throw new Error(
          'Stripe created the session but did not return a Checkout URL.'
        );
      }

      console.log(
        'Stripe Checkout created:',
        {
          userId:
            user.id,

          plan,

          productId,

          priceId:
            targetPrice.id,

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
          targetPrice.id,
      });
    } catch (
      error
    ) {
      console.error(
        'create-checkout-session failed:',
        error
      );

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
