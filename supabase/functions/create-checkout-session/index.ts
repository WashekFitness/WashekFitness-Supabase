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
  Deno.env.get(
    'SUPABASE_SERVICE_ROLE_KEY'
  ) || '';

const APP_URL =
  Deno.env.get('APP_URL') ||
  'https://washekfitness.com';

/*
 * YOUR ACTUAL STRIPE PRODUCT IDS
 *
 * We use these directly so you do not need
 * to configure three separate Price ID secrets.
 */
const PRODUCTS = {
  progress:
    'prod_USTp1fOzf3aHsl',

  performance:
    'prod_USTpsXJPgs7ccs',

  elite:
    'prod_USTqn0bZsTVUkH',
};

const PAID_PLANS = [
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

      headers:
        corsHeaders,
    }
  );
}

/*
 * ==========================================================
 * STRIPE API HELPER
 * ==========================================================
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

  const data =
    await response
      .json()
      .catch(
        () => ({})
      );

  if (
    !response.ok
  ) {
    throw new Error(
      data?.error?.message ||
        'Stripe API request failed.'
    );
  }

  return data;
}

/*
 * ==========================================================
 * PRODUCT / PRICE HELPERS
 * ==========================================================
 */

function getProductId(
  plan: string
) {
  if (
    !PAID_PLANS.includes(
      plan
    )
  ) {
    throw new Error(
      'Invalid subscription plan.'
    );
  }

  return (
    PRODUCTS[
      plan as keyof typeof PRODUCTS
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
      `No active recurring Stripe Price was found for product ${productId}.`
    );
  }

  /*
   * Prefer a monthly recurring price.
   */
  const monthly =
    prices.find(
      (price: any) =>
        price?.recurring
          ?.interval ===
        'month'
    );

  /*
   * Otherwise use the first active recurring
   * price Stripe returned.
   */
  return (
    monthly ||
    prices[0]
  );
}

/*
 * ==========================================================
 * PROFILE / EXISTING SUBSCRIPTION
 * ==========================================================
 */

async function findExistingSubscription(
  profile: any
) {
  /*
   * First try the saved subscription ID.
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
          subscription.status ===
            'active' ||
          subscription.status ===
            'trialing' ||
          subscription.status ===
            'past_due' ||
          subscription.status ===
            'unpaid'
        )
      ) {
        return subscription;
      }
    } catch {
      /*
       * Continue to the customer lookup.
       */
    }
  }

  /*
   * Next try the saved customer ID.
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

    const active =
      (
        result?.data ||
        []
      ).find(
        (subscription: any) =>
          subscription.status ===
            'active' ||
          subscription.status ===
            'trialing' ||
          subscription.status ===
            'past_due' ||
          subscription.status ===
            'unpaid'
      );

    if (
      active
    ) {
      return active;
    }
  }

  /*
   * Finally, try to recover the Stripe customer
   * from the Washek account email.
   */
  const email =
    profile?.email ||
    '';

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

      const active =
        (
          result?.data ||
          []
        ).find(
          (subscription: any) =>
            subscription.status ===
              'active' ||
            subscription.status ===
              'trialing' ||
            subscription.status ===
              'past_due' ||
            subscription.status ===
              'unpaid'
        );

      if (
        active
      ) {
        return active;
      }
    }
  }

  return null;
}

/*
 * ==========================================================
 * PROFILE UPDATE
 * ==========================================================
 */

async function updateProfile(
  userId: string,
  patch: Record<string, unknown>
) {
  const {
    error,
  } =
    await supabaseAdmin
      .from('profiles')
      .update({
        ...patch,

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
 * ==========================================================
 * EDGE FUNCTION
 * ==========================================================
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
       * AUTHENTICATE USER
       * ======================================================
       */

      const authHeader =
        req.headers.get(
          'Authorization'
        );

      if (
        !authHeader
      ) {
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
        data:
          authData,
        error:
          authError,
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
              'Your login session is invalid or expired.',
          },
          401
        );
      }

      const authUser =
        authData.user;

      /*
       * ======================================================
       * READ REQUEST
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

      const productId =
        getProductId(
          plan
        );

      /*
       * ======================================================
       * GET WASHEK PROFILE
       * ======================================================
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
            authUser.id
          )
          .single();

      if (
        profileError
      ) {
        throw new Error(
          'Unable to load your Washek Fitness profile.'
        );
      }

      /*
       * ======================================================
       * GET THE STRIPE PRICE ATTACHED TO THE PRODUCT
       * ======================================================
       */

      const targetPrice =
        await getActiveRecurringPrice(
          productId
        );

      /*
       * ======================================================
       * CHECK FOR EXISTING SUBSCRIPTION
       * ======================================================
       */

      const existingSubscription =
        await findExistingSubscription(
          profile
        );

      /*
       * ======================================================
       * PAID -> PAID
       * ======================================================
       *
       * Do not create two subscriptions.
       *
       * Change the existing subscription item instead.
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
            'Your Stripe subscription has no subscription item to change.'
          );
        }

        /*
         * If they already have this exact price,
         * update our local record and finish.
         */
        if (
          item?.price?.id ===
          targetPrice.id
        ) {
          await updateProfile(
            authUser.id,
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
         * Change the subscription item.
         *
         * proration_behavior=none prevents an
         * unexpected immediate prorated charge.
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
         * Keep Stripe metadata synchronized.
         */
        const subscriptionParams =
          new URLSearchParams();

        subscriptionParams.set(
          'metadata[user_id]',
          authUser.id
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
              subscriptionParams.toString(),
          }
        );

        const customerId =
          typeof existingSubscription.customer ===
          'string'
            ? existingSubscription.customer
            : profile?.stripe_customer_id ||
              null;

        /*
         * Update Washek immediately rather than waiting
         * for a webhook.
         */
        await updateProfile(
          authUser.id,
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
       * ======================================================
       * FREE -> PAID
       * ======================================================
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
       * Return to Washek after checkout.
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
       * Associate checkout session with
       * authenticated Washek user.
       */
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
        targetPrice.id
      );

      /*
       * Associate the actual Stripe Subscription
       * with the Washek user too.
       */
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
        targetPrice.id
      );

      /*
       * Reuse existing Stripe Customer.
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
          authUser.email ||
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
       * ======================================================
       * CREATE STRIPE CHECKOUT SESSION
       * ======================================================
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
          'Stripe did not return a Checkout URL.'
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
          targetPrice.id,
      });
    } catch (
      error
    ) {
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
              : 'Unable to start Stripe Checkout.',
        },
        400
      );
    }
  }
);
