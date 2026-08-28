import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const STRIPE_SECRET_KEY =
  Deno.env.get('STRIPE_SECRET_KEY') || '';

const STRIPE_WEBHOOK_SECRET =
  Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

const SUPABASE_URL =
  Deno.env.get('SUPABASE_URL') || '';

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const PLAN_ORDER = [
  'free',
  'progress',
  'performance',
  'elite',
];

/*
 * YOUR STRIPE PRODUCT IDS
 */
const PRODUCT_IDS = {
  progress:
    Deno.env.get('STRIPE_PROGRESS_PRODUCT_ID') ||
    'prod_USTp1fOzf3aHsl',

  performance:
    Deno.env.get('STRIPE_PERFORMANCE_PRODUCT_ID') ||
    'prod_USTpsXJPgs7ccs',

  elite:
    Deno.env.get('STRIPE_ELITE_PRODUCT_ID') ||
    'prod_USTqn0bZsTVUkH',
};

function paidStatus(status: string) {
  return (
    status === 'active' ||
    status === 'trialing'
  );
}

/*
 * Determine the Washek plan from the Stripe PRODUCT.
 *
 * This is the important fix.
 */
function planFromProduct(
  productId: string | null
) {
  if (!productId) {
    return null;
  }

  if (
    productId === PRODUCT_IDS.progress
  ) {
    return 'progress';
  }

  if (
    productId === PRODUCT_IDS.performance
  ) {
    return 'performance';
  }

  if (
    productId === PRODUCT_IDS.elite
  ) {
    return 'elite';
  }

  return null;
}

/*
 * Keep compatibility with any Price IDs you
 * may already have configured.
 */
function planFromPrice(
  priceId: string | null
) {
  if (!priceId) {
    return null;
  }

  const progress =
    Deno.env.get(
      'STRIPE_PROGRESS_PRICE_ID'
    );

  const performance =
    Deno.env.get(
      'STRIPE_PERFORMANCE_PRICE_ID'
    );

  const elite =
    Deno.env.get(
      'STRIPE_ELITE_PRICE_ID'
    );

  if (
    progress &&
    priceId === progress
  ) {
    return 'progress';
  }

  if (
    performance &&
    priceId === performance
  ) {
    return 'performance';
  }

  if (
    elite &&
    priceId === elite
  ) {
    return 'elite';
  }

  return null;
}

async function stripe(
  path: string,
  options: RequestInit = {}
) {
  if (!STRIPE_SECRET_KEY) {
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

          ...(options.headers || {}),
        },
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        'Stripe API request failed.'
    );
  }

  return data;
}

/*
 * Verify Stripe's webhook signature.
 */
async function verifySignature(
  payload: string,
  signatureHeader: string
) {
  if (!STRIPE_WEBHOOK_SECRET) {
    throw new Error(
      'STRIPE_WEBHOOK_SECRET is not configured.'
    );
  }

  const pieces =
    signatureHeader.split(',');

  const timestampPart =
    pieces.find((part) =>
      part.startsWith('t=')
    );

  const signatures =
    pieces
      .filter((part) =>
        part.startsWith('v1=')
      )
      .map((part) =>
        part.slice(3)
      );

  if (
    !timestampPart ||
    signatures.length === 0
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
    !Number.isFinite(timestamp)
  ) {
    throw new Error(
      'Invalid Stripe webhook timestamp.'
    );
  }

  /*
   * Five-minute tolerance.
   */
  const age =
    Math.abs(
      Date.now() / 1000 -
        timestamp
    );

  if (age > 300) {
    throw new Error(
      'Stripe webhook signature is too old.'
    );
  }

  const signedPayload =
    `${timestamp}.${payload}`;

  const key =
    await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(
        STRIPE_WEBHOOK_SECRET
      ),
      {
        name: 'HMAC',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );

  const digest =
    await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(
        signedPayload
      )
    );

  const expected =
    Array.from(
      new Uint8Array(digest)
    )
      .map((byte) =>
        byte
          .toString(16)
          .padStart(2, '0')
      )
      .join('');

  for (
    const candidate of signatures
  ) {
    if (
      candidate.length !==
      expected.length
    ) {
      continue;
    }

    let difference = 0;

    for (
      let i = 0;
      i < expected.length;
      i += 1
    ) {
      difference |=
        expected.charCodeAt(i) ^
        candidate.charCodeAt(i);
    }

    if (
      difference === 0
    ) {
      return true;
    }
  }

  throw new Error(
    'Invalid Stripe webhook signature.'
  );
}

async function findProfile(
  userId: string | null,
  customerId: string | null
) {
  /*
   * First: exact Washek user ID.
   */
  if (userId) {
    const {
      data,
    } =
      await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq(
          'id',
          userId
        )
        .maybeSingle();

    if (data) {
      return data;
    }
  }

  /*
   * Second: saved Stripe customer ID.
   */
  if (customerId) {
    const {
      data,
    } =
      await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq(
          'stripe_customer_id',
          customerId
        )
        .maybeSingle();

    if (data) {
      return data;
    }
  }

  return null;
}

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

  if (error) {
    throw error;
  }
}

/*
 * Read a Stripe subscription and determine
 * its Washek plan from the underlying product.
 */
function getSubscriptionPlan(
  subscription: any,
  fallbackPlan: string | null = null
) {
  const item =
    subscription
      ?.items
      ?.data?.[0];

  const priceId =
    item?.price?.id ||
    null;

  const productId =
    typeof item?.price?.product ===
    'string'
      ? item.price.product
      : null;

  /*
   * PRODUCT ID FIRST
   */
  const productPlan =
    planFromProduct(
      productId
    );

  if (productPlan) {
    return productPlan;
  }

  /*
   * PRICE ID SECOND
   */
  const pricePlan =
    planFromPrice(
      priceId
    );

  if (pricePlan) {
    return pricePlan;
  }

  /*
   * Stripe subscription metadata may have
   * the Washek plan.
   */
  const metadataPlan =
    subscription?.metadata?.plan;

  if (
    metadataPlan &&
    PLAN_ORDER.includes(
      metadataPlan
    )
  ) {
    return metadataPlan;
  }

  return fallbackPlan;
}

/*
 * Handle Checkout completion.
 *
 * This is used for brand-new subscriptions.
 */
async function handleCheckoutCompleted(
  session: any
) {
  const userId =
    session?.metadata?.user_id ||
    session?.client_reference_id ||
    null;

  const metadataPlan =
    session?.metadata?.plan ||
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

  if (!userId) {
    console.error(
      'Stripe checkout has no Washek user ID.',
      {
        sessionId:
          session?.id,
      }
    );

    return;
  }

  if (!subscriptionId) {
    console.error(
      'Stripe checkout has no subscription ID.',
      {
        sessionId:
          session?.id,

        userId,
      }
    );

    return;
  }

  const subscription =
    await stripe(
      `subscriptions/${encodeURIComponent(
        subscriptionId
      )}`
    );

  const plan =
    getSubscriptionPlan(
      subscription,
      metadataPlan
    );

  if (
    !plan ||
    !PLAN_ORDER.includes(
      plan
    ) ||
    plan === 'free'
  ) {
    console.error(
      'Unable to determine Washek plan from Stripe subscription.',
      {
        subscriptionId,
        userId,
        priceId:
          subscription
            ?.items
            ?.data?.[0]
            ?.price
            ?.id,
        productId:
          subscription
            ?.items
            ?.data?.[0]
            ?.price
            ?.product,
        metadataPlan,
      }
    );

    return;
  }

  const priceId =
    subscription
      ?.items
      ?.data?.[0]
      ?.price?.id ||
    null;

  await updateProfile(
    userId,
    {
      subscription_plan:
        plan,

      subscription_status:
        subscription.status ||
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
    `Washek subscription activated: ${userId} → ${plan}`
  );
}

/*
 * Handle subscription created/updated/deleted.
 */
async function handleSubscription(
  subscription: any
) {
  const metadata =
    subscription?.metadata ||
    {};

  const userId =
    metadata.user_id ||
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

  if (!profile) {
    console.error(
      'No Washek profile found for Stripe subscription.',
      {
        subscriptionId:
          subscription?.id,

        userId,

        customerId,
      }
    );

    return;
  }

  const status =
    subscription?.status ||
    'inactive';

  const priceId =
    subscription
      ?.items
      ?.data?.[0]
      ?.price?.id ||
    null;

  const productId =
    typeof subscription
      ?.items
      ?.data?.[0]
      ?.price
      ?.product ===
    'string'
      ? subscription
          .items
          .data[0]
          .price
          .product
      : null;

  const plan =
    getSubscriptionPlan(
      subscription,
      profile.subscription_plan ||
        null
    );

  /*
   * Canceled subscription:
   * immediately Free.
   */
  if (
    status ===
      'canceled' ||
    status ===
      'incomplete_expired'
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
      `Washek subscription canceled: ${profile.id}`
    );

    return;
  }

  /*
   * Active/trialing subscription:
   * paid plan.
   */
  if (
    paidStatus(status) &&
    plan &&
    PLAN_ORDER.includes(
      plan
    ) &&
    plan !== 'free'
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
      `Washek subscription synchronized: ${profile.id} → ${plan}`,
      {
        productId,
        priceId,
      }
    );

    return;
  }

  /*
   * Stripe no longer represents an active
   * paid entitlement.
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
}

/*
 * invoice.paid
 */
async function handleInvoicePaid(
  invoice: any
) {
  const subscriptionId =
    typeof invoice?.subscription ===
    'string'
      ? invoice.subscription
      : null;

  if (!subscriptionId) {
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
 * invoice.payment_failed
 *
 * We record the status but don't instantly
 * revoke access solely because of one failed invoice.
 */
async function handleInvoicePaymentFailed(
  invoice: any
) {
  const subscriptionId =
    typeof invoice?.subscription ===
    'string'
      ? invoice.subscription
      : null;

  if (!subscriptionId) {
    return;
  }

  const subscription =
    await stripe(
      `subscriptions/${encodeURIComponent(
        subscriptionId
      )}`
    );

  const customerId =
    typeof subscription?.customer ===
    'string'
      ? subscription.customer
      : null;

  const profile =
    await findProfile(
      subscription
        ?.metadata
        ?.user_id ||
        null,
      customerId
    );

  if (!profile) {
    return;
  }

  await updateProfile(
    profile.id,
    {
      subscription_status:
        subscription?.status ||
        'past_due',
    }
  );
}

Deno.serve(
  async (req) => {
    if (
      req.method !==
      'POST'
    ) {
      return new Response(
        'Method not allowed.',
        {
          status: 405,
        }
      );
    }

    try {
      const payload =
        await req.text();

      const signature =
        req.headers.get(
          'stripe-signature'
        );

      if (!signature) {
        return new Response(
          'Missing Stripe signature.',
          {
            status: 400,
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
        `Received Stripe event: ${event.type}`
      );

      switch (
        event.type
      ) {
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded':
          await handleCheckoutCompleted(
            event.data.object
          );
          break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
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
          break;
      }

      return new Response(
        JSON.stringify({
          received:
            true,
        }),
        {
          status: 200,

          headers: {
            'Content-Type':
              'application/json',
          },
        }
      );
    } catch (
      error
    ) {
      console.error(
        'stripe-webhooks error:',
        error
      );

      return new Response(
        JSON.stringify({
          received:
            false,

          error:
            error instanceof Error
              ? error.message
              : 'Webhook processing failed.',
        }),
        {
          status: 400,

          headers: {
            'Content-Type':
              'application/json',
          },
        }
      );
    }
  }
);
