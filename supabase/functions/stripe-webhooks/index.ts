import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/*
 * ============================================================
 * WASHEK FITNESS — STRIPE WEBHOOKS
 * ============================================================
 *
 * Handles:
 *
 * - checkout.session.completed
 * - checkout.session.async_payment_succeeded
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.paid
 * - invoice.payment_failed
 *
 * The plan mapping uses the exact Stripe Price IDs provided
 * for the Washek Fitness Sandbox.
 */

/*
 * ============================================================
 * ENVIRONMENT
 * ============================================================
 */

const STRIPE_SECRET_KEY =
  Deno.env.get('STRIPE_SECRET_KEY') || '';

const STRIPE_WEBHOOK_SECRET =
  Deno.env.get(
    'STRIPE_WEBHOOK_SECRET'
  ) || '';

const SUPABASE_URL =
  Deno.env.get('SUPABASE_URL') || '';

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get(
    'SUPABASE_SERVICE_ROLE_KEY'
  ) || '';

/*
 * ============================================================
 * EXACT STRIPE PRICE -> WASHEK PLAN MAPPING
 * ============================================================
 */

const PRICE_TO_PLAN: Record<
  string,
  string
> = {
  'price_1TTYrbRuQpZftYKRoSyLbQ0c':
    'progress',

  'price_1TTYs8RuQpZftYKR8ZzpNg7x':
    'performance',

  'price_1TTYsWRuQpZftYKRKIm8V10E':
    'elite',
};

const PAID_PLANS = [
  'progress',
  'performance',
  'elite',
];

const PAID_STATUSES = [
  'active',
  'trialing',
];

const NON_PAID_STATUSES = [
  'canceled',
  'incomplete_expired',
];

/*
 * ============================================================
 * SUPABASE ADMIN CLIENT
 * ============================================================
 */

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
      'STRIPE_SECRET_KEY is not configured.'
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
        `Stripe returned HTTP ${response.status}.`
    );
  }

  return data;
}

/*
 * ============================================================
 * STRIPE SIGNATURE VERIFICATION
 * ============================================================
 */

async function verifySignature(
  payload: string,
  signatureHeader: string
) {
  if (
    !STRIPE_WEBHOOK_SECRET
  ) {
    throw new Error(
      'STRIPE_WEBHOOK_SECRET is not configured.'
    );
  }

  const pieces =
    signatureHeader.split(',');

  const timestampPart =
    pieces.find(
      (part) =>
        part.startsWith(
          't='
        )
    );

  const signatures =
    pieces
      .filter(
        (part) =>
          part.startsWith(
            'v1='
          )
      )
      .map(
        (part) =>
          part.slice(3)
      );

  if (
    !timestampPart ||
    signatures.length ===
      0
  ) {
    throw new Error(
      'Invalid Stripe signature.'
    );
  }

  const timestamp =
    Number(
      timestampPart.slice(2)
    );

  if (
    !Number.isFinite(
      timestamp
    )
  ) {
    throw new Error(
      'Invalid Stripe timestamp.'
    );
  }

  /*
   * Five-minute replay protection.
   */
  const age =
    Math.abs(
      Date.now() / 1000 -
        timestamp
    );

  if (
    age >
    300
  ) {
    throw new Error(
      'Stripe webhook signature is too old.'
    );
  }

  const signedPayload =
    `${timestamp}.${payload}`;

  const encoder =
    new TextEncoder();

  const cryptoKey =
    await crypto.subtle.importKey(
      'raw',

      encoder.encode(
        STRIPE_WEBHOOK_SECRET
      ),

      {
        name:
          'HMAC',

        hash:
          'SHA-256',
      },

      false,

      ['sign']
    );

  const digest =
    await crypto.subtle.sign(
      'HMAC',

      cryptoKey,

      encoder.encode(
        signedPayload
      )
    );

  const expected =
    Array.from(
      new Uint8Array(
        digest
      )
    )
      .map(
        (byte) =>
          byte
            .toString(16)
            .padStart(
              2,
              '0'
            )
      )
      .join('');

  for (
    const candidate of
    signatures
  ) {
    if (
      candidate.length !==
      expected.length
    ) {
      continue;
    }

    let difference = 0;

    for (
      let index = 0;
      index <
      expected.length;
      index += 1
    ) {
      difference |=
        expected.charCodeAt(
          index
        ) ^
        candidate.charCodeAt(
          index
        );
    }

    if (
      difference ===
      0
    ) {
      return true;
    }
  }

  throw new Error(
    'Invalid Stripe webhook signature.'
  );
}

/*
 * ============================================================
 * PLAN DETECTION
 * ============================================================
 */

function planFromPrice(
  priceId: string | null
) {
  if (
    !priceId
  ) {
    return null;
  }

  return (
    PRICE_TO_PLAN[
      priceId
    ] ||
    null
  );
}

/*
 * ============================================================
 * GET SUBSCRIPTION PRICE
 * ============================================================
 */

function getSubscriptionPriceId(
  subscription: any
) {
  return (
    subscription
      ?.items
      ?.data?.[0]
      ?.price
      ?.id ||
    null
  );
}

/*
 * ============================================================
 * FIND PROFILE BY USER ID
 * ============================================================
 */

async function findProfileByUserId(
  userId: string
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq(
        'id',
        userId
      )
      .maybeSingle();

  if (
    error
  ) {
    throw error;
  }

  return data || null;
}

/*
 * ============================================================
 * FIND PROFILE BY STRIPE CUSTOMER
 * ============================================================
 */

async function findProfileByCustomerId(
  customerId: string
) {
  if (
    !customerId
  ) {
    return null;
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq(
        'stripe_customer_id',
        customerId
      )
      .maybeSingle();

  if (
    error
  ) {
    throw error;
  }

  return data || null;
}

/*
 * ============================================================
 * FIND PROFILE
 * ============================================================
 */

async function findProfile(
  userId: string | null,
  customerId: string | null
) {
  /*
   * User ID is the strongest identifier because the checkout
   * session contains it in metadata/client_reference_id.
   */
  if (
    userId
  ) {
    const profile =
      await findProfileByUserId(
        userId
      );

    if (
      profile
    ) {
      return profile;
    }
  }

  /*
   * Fallback to Stripe customer ID.
   */
  if (
    customerId
  ) {
    const profile =
      await findProfileByCustomerId(
        customerId
      );

    if (
      profile
    ) {
      return profile;
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
  profileId: string,
  patch: Record<
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
        ...patch,

        subscription_updated_at:
          new Date().toISOString(),

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        profileId
      );

  if (
    error
  ) {
    throw error;
  }
}

/*
 * ============================================================
 * WRITE PAID SUBSCRIPTION
 * ============================================================
 */

async function writePaidSubscription(
  profile: any,
  subscription: any,
  plan: string
) {
  const customerId =
    typeof subscription?.customer ===
    'string'
      ? subscription.customer
      : null;

  const subscriptionId =
    typeof subscription?.id ===
    'string'
      ? subscription.id
      : null;

  const priceId =
    getSubscriptionPriceId(
      subscription
    );

  await updateProfile(
    profile.id,
    {
      subscription_plan:
        plan,

      subscription_status:
        subscription?.status ||
        'active',

      stripe_customer_id:
        customerId,

      stripe_subscription_id:
        subscriptionId,

      stripe_price_id:
        priceId,

      subscription_cancelled_at:
        null,
    }
  );

  console.log(
    '[WEBHOOK] Paid subscription written:',
    {
      profileId:
        profile.id,

      userId:
        profile.id,

      plan,

      status:
        subscription?.status,

      subscriptionId,

      priceId,
    }
  );
}

/*
 * ============================================================
 * HANDLE CHECKOUT COMPLETED
 * ============================================================
 */

async function handleCheckoutCompleted(
  session: any
) {
  const userId =
    session?.metadata
      ?.user_id ||
    session?.client_reference_id ||
    null;

  const customerId =
    typeof session?.customer ===
    'string'
      ? session.customer
      : null;

  const subscriptionId =
    typeof session?.subscription ===
    'string'
      ? session.subscription
      : null;

  if (
    !userId
  ) {
    throw new Error(
      `Checkout Session ${session?.id || 'unknown'} does not contain the Washek user ID.`
    );
  }

  if (
    !subscriptionId
  ) {
    throw new Error(
      `Checkout Session ${session?.id || 'unknown'} does not contain a subscription ID.`
    );
  }

  /*
   * Retrieve the actual Stripe subscription.
   */
  const subscription =
    await stripe(
      `subscriptions/${encodeURIComponent(
        subscriptionId
      )}`
    );

  const priceId =
    getSubscriptionPriceId(
      subscription
    );

  const plan =
    planFromPrice(
      priceId
    );

  if (
    !plan
  ) {
    throw new Error(
      `Stripe Price ${priceId || 'unknown'} is not mapped to a Washek Fitness plan.`
    );
  }

  const profile =
    await findProfile(
      userId,
      customerId
    );

  if (
    !profile
  ) {
    throw new Error(
      `No Washek profile was found for user ${userId}.`
    );
  }

  await writePaidSubscription(
    profile,
    subscription,
    plan
  );
}

/*
 * ============================================================
 * HANDLE SUBSCRIPTION EVENT
 * ============================================================
 */

async function handleSubscription(
  subscription: any
) {
  const userId =
    subscription?.metadata
      ?.user_id ||
    null;

  const customerId =
    typeof subscription?.customer ===
    'string'
      ? subscription.customer
      : null;

  const profile =
    await findProfile(
      userId,
      customerId
    );

  if (
    !profile
  ) {
    throw new Error(
      `No Washek profile found for Stripe subscription ${subscription?.id || 'unknown'}.`
    );
  }

  const status =
    subscription?.status ||
    'inactive';

  const priceId =
    getSubscriptionPriceId(
      subscription
    );

  const plan =
    planFromPrice(
      priceId
    ) ||
    subscription
      ?.metadata
      ?.plan ||
    null;

  /*
   * ----------------------------------------------------------
   * CANCELED
   * ----------------------------------------------------------
   */

  if (
    NON_PAID_STATUSES.includes(
      status
    )
  ) {
    await updateProfile(
      profile.id,
      {
        subscription_plan:
          'free',

        subscription_status:
          'canceled',

        stripe_customer_id:
          customerId,

        stripe_subscription_id:
          null,

        stripe_price_id:
          null,

        subscription_cancelled_at:
          new Date().toISOString(),
      }
    );

    console.log(
      '[WEBHOOK] Subscription canceled:',
      {
        profileId:
          profile.id,

        subscriptionId:
          subscription.id,
      }
    );

    return;
  }

  /*
   * ----------------------------------------------------------
   * ACTIVE / TRIALING
   * ----------------------------------------------------------
   */

  if (
    PAID_STATUSES.includes(
      status
    ) &&
    plan &&
    PAID_PLANS.includes(
      plan
    )
  ) {
    await updateProfile(
      profile.id,
      {
        subscription_plan:
          plan,

        subscription_status:
          status,

        stripe_customer_id:
          customerId,

        stripe_subscription_id:
          subscription.id,

        stripe_price_id:
          priceId,

        subscription_cancelled_at:
          null,
      }
    );

    console.log(
      '[WEBHOOK] Subscription active:',
      {
        profileId:
          profile.id,

        plan,

        status,

        subscriptionId:
          subscription.id,

        priceId,
      }
    );

    return;
  }

  /*
   * ----------------------------------------------------------
   * NON-ACTIVE / UNUSABLE PAID STATE
   * ----------------------------------------------------------
   */

  await updateProfile(
    profile.id,
    {
      subscription_plan:
        'free',

      subscription_status:
        status,

      stripe_customer_id:
        customerId,

      stripe_subscription_id:
        null,

      stripe_price_id:
        null,

      subscription_cancelled_at:
        new Date().toISOString(),
    }
  );

  console.log(
    '[WEBHOOK] Subscription has no active paid entitlement:',
    {
      profileId:
        profile.id,

      status,

      subscriptionId:
        subscription.id,
    }
  );
}

/*
 * ============================================================
 * INVOICE PAID
 * ============================================================
 */

async function handleInvoicePaid(
  invoice: any
) {
  const subscriptionId =
    typeof invoice?.subscription ===
    'string'
      ? invoice.subscription
      : null;

  if (
    !subscriptionId
  ) {
    return;
  }

  const subscription =
    await stripe(
      `subscriptions/${encodeURIComponent(
        subscriptionId
      )}`
    );

  await handleSubscription(
    subscription
  );
}

/*
 * ============================================================
 * INVOICE PAYMENT FAILED
 * ============================================================
 */

async function handleInvoicePaymentFailed(
  invoice: any
) {
  const subscriptionId =
    typeof invoice?.subscription ===
    'string'
      ? invoice.subscription
      : null;

  if (
    !subscriptionId
  ) {
    return;
  }

  const subscription =
    await stripe(
      `subscriptions/${encodeURIComponent(
        subscriptionId
      )}`
    );

  const userId =
    subscription
      ?.metadata
      ?.user_id ||
    null;

  const customerId =
    typeof subscription?.customer ===
    'string'
      ? subscription.customer
      : null;

  const profile =
    await findProfile(
      userId,
      customerId
    );

  if (
    !profile
  ) {
    throw new Error(
      `No Washek profile found for failed-payment subscription ${subscription.id}.`
    );
  }

  /*
   * Record Stripe's actual subscription status.
   *
   * Do not blindly revoke access merely because one invoice
   * failed; Stripe may still retry payment.
   */
  await updateProfile(
    profile.id,
    {
      subscription_status:
        subscription?.status ||
        'past_due',

      stripe_customer_id:
        customerId,

      stripe_subscription_id:
        subscription.id,

      stripe_price_id:
        getSubscriptionPriceId(
          subscription
        ),
    }
  );

  console.log(
    '[WEBHOOK] Invoice payment failed:',
    {
      profileId:
        profile.id,

      subscriptionId:
        subscription.id,

      status:
        subscription?.status,
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
      req.method !==
      'POST'
    ) {
      return new Response(
        'Method not allowed.',
        {
          status:
            405,
        }
      );
    }

    try {
      /*
       * Read the RAW request body.
       * Stripe signature verification requires the raw payload.
       */
      const payload =
        await req.text();

      const signature =
        req.headers.get(
          'stripe-signature'
        );

      if (
        !signature
      ) {
        return new Response(
          'Missing Stripe signature.',
          {
            status:
              400,
          }
        );
      }

      await verifySignature(
        payload,
        signature
      );

      const event =
        JSON.parse(
          payload
        );

      console.log(
        '[WEBHOOK] Stripe event received:',
        event.type
      );

      switch (
        event.type
      ) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(
            event.data.object
          );
          break;

        case 'checkout.session.async_payment_succeeded':
          await handleCheckoutCompleted(
            event.data.object
          );
          break;

        case 'customer.subscription.created':
          await handleSubscription(
            event.data.object
          );
          break;

        case 'customer.subscription.updated':
          await handleSubscription(
            event.data.object
          );
          break;

        case 'customer.subscription.deleted':
          await handleSubscription(
            event.data.object
          );
          break;

        case 'invoice.paid':
          await handleInvoicePaid(
            event.data.object
          );
          break;

        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(
            event.data.object
          );
          break;

        default:
          console.log(
            '[WEBHOOK] Ignoring event:',
            event.type
          );
      }

      return new Response(
        JSON.stringify({
          received:
            true,
        }),
        {
          status:
            200,

          headers: {
            'Content-Type':
              'application/json',
          },
        }
      );
    } catch (
      error
    ) {
      const message =
        error instanceof Error
          ? error.message
          : 'Webhook processing failed.';

      console.error(
        '[WEBHOOK] FAILED:',
        {
          message,

          timestamp:
            new Date().toISOString(),
        }
      );

      return new Response(
        JSON.stringify({
          received:
            false,

          error:
            message,
        }),
        {
          status:
            400,

          headers: {
            'Content-Type':
              'application/json',
          },
        }
      );
    }
  }
);
