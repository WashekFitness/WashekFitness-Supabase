import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY =
  Deno.env.get('STRIPE_SECRET_KEY') || '';

const STRIPE_WEBHOOK_SECRET =
  Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

const SUPABASE_URL =
  Deno.env.get('SUPABASE_URL') || '';

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const PRICE_TO_PLAN = {
  'price_1TTYrbRuQpZftYKRoSyLbQ0c':
    'progress',

  'price_1TTYs8RuQpZftYKR8ZzpNg7x':
    'performance',

  'price_1TTYsWRuQpZftYKRKIm8V10E':
    'elite',
};

const PRODUCT_TO_PLAN = {
  'prod_USTp1fOzf3aHsl':
    'progress',

  'prod_USTpsXJPgs7ccs':
    'performance',

  'prod_USTqn0bZsTVUkH':
    'elite',
};

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
      headers: {
        'Content-Type':
          'application/json',
      },
    }
  );
}

async function stripe(
  path: string
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
        headers: {
          Authorization:
            `Bearer ${STRIPE_SECRET_KEY}`,
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
        `Stripe API returned HTTP ${response.status}.`
    );
  }

  return data;
}

async function verifySignature(
  payload: string,
  header: string
) {
  if (!STRIPE_WEBHOOK_SECRET) {
    throw new Error(
      'STRIPE_WEBHOOK_SECRET is not configured.'
    );
  }

  const parts =
    header.split(',');

  const timestampPart =
    parts.find(
      (part) =>
        part.trim().startsWith('t=')
    );

  const signatures =
    parts
      .filter(
        (part) =>
          part.trim().startsWith('v1=')
      )
      .map(
        (part) =>
          part.trim().slice(3)
      );

  if (
    !timestampPart ||
    signatures.length === 0
  ) {
    throw new Error(
      'Invalid Stripe signature header.'
    );
  }

  const timestamp =
    Number(
      timestampPart
        .trim()
        .slice(2)
    );

  if (
    !Number.isFinite(
      timestamp
    )
  ) {
    throw new Error(
      'Invalid Stripe webhook timestamp.'
    );
  }

  if (
    Math.abs(
      Date.now() / 1000 -
        timestamp
    ) >
    300
  ) {
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
      new Uint8Array(
        digest
      )
    )
      .map(
        (byte) =>
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
      i++
    ) {
      difference |=
        expected.charCodeAt(i) ^
        candidate.charCodeAt(i);
    }

    if (
      difference === 0
    ) {
      return;
    }
  }

  throw new Error(
    'Invalid Stripe webhook signature.'
  );
}

function getPlanFromPrice(
  priceId: string | null
) {
  if (!priceId) {
    return null;
  }

  return (
    PRICE_TO_PLAN[
      priceId
    ] || null
  );
}

function getPlanFromProduct(
  productId: string | null
) {
  if (!productId) {
    return null;
  }

  return (
    PRODUCT_TO_PLAN[
      productId
    ] || null
  );
}

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

function getSubscriptionPlan(
  subscription: any,
  fallbackPlan: string | null = null
) {
  const price =
    subscription
      ?.items
      ?.data?.[0]
      ?.price;

  const priceId =
    typeof price?.id === 'string'
      ? price.id
      : null;

  const productId =
    typeof price?.product === 'string'
      ? price.product
      : null;

  const pricePlan =
    getPlanFromPrice(
      priceId
    );

  if (pricePlan) {
    return pricePlan;
  }

  const productPlan =
    getPlanFromProduct(
      productId
    );

  if (productPlan) {
    return productPlan;
  }

  const metadataPlan =
    subscription
      ?.metadata
      ?.plan;

  if (
    metadataPlan === 'progress' ||
    metadataPlan === 'performance' ||
    metadataPlan === 'elite'
  ) {
    return metadataPlan;
  }

  return fallbackPlan;
}

async function findProfile(
  userId: string | null
) {
  if (!userId) {
    return null;
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to find profile ${userId}: ${error.message}`
    );
  }

  return data || null;
}

async function updateProfile(
  userId: string,
  values: Record<
    string,
    unknown
  >
) {
  const now =
    new Date().toISOString();

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from('profiles')
      .update({
        ...values,

        subscription_updated_at:
          now,

        updated_at:
          now,
      })
      .eq(
        'id',
        userId
      )
      .select('*')
      .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to update profile ${userId}: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      `Profile ${userId} could not be updated.`
    );
  }

  return data;
}

async function activateSubscription(
  userId: string,
  subscription: any,
  fallbackPlan: string | null
) {
  const profile =
    await findProfile(
      userId
    );

  if (!profile) {
    throw new Error(
      `No Washek profile exists for user ${userId}.`
    );
  }

  const plan =
    getSubscriptionPlan(
      subscription,
      fallbackPlan
    );

  if (
    plan !== 'progress' &&
    plan !== 'performance' &&
    plan !== 'elite'
  ) {
    throw new Error(
      `Could not determine Washek plan for subscription ${subscription?.id || 'unknown'}.`
    );
  }

  const customerId =
    typeof subscription?.customer === 'string'
      ? subscription.customer
      : null;

  const subscriptionId =
    typeof subscription?.id === 'string'
      ? subscription.id
      : null;

  const priceId =
    getSubscriptionPriceId(
      subscription
    );

  const status =
    subscription?.status ||
    'active';

  await updateProfile(
    userId,
    {
      subscription_plan:
        plan,

      subscription_status:
        status,

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
    '[WEBHOOK] SUBSCRIPTION ACTIVATED',
    {
      userId,
      plan,
      status,
      subscriptionId,
      priceId,
    }
  );
}

async function cancelSubscription(
  userId: string,
  subscription: any
) {
  const profile =
    await findProfile(
      userId
    );

  if (!profile) {
    throw new Error(
      `No Washek profile exists for user ${userId}.`
    );
  }

  const customerId =
    typeof subscription?.customer === 'string'
      ? subscription.customer
      : null;

  await updateProfile(
    userId,
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
    '[WEBHOOK] SUBSCRIPTION CANCELED',
    {
      userId,

      subscriptionId:
        subscription?.id ||
        null,
    }
  );
}

async function handleCheckoutCompleted(
  session: any
) {
  const userId =
    session
      ?.metadata
      ?.user_id ||
    session
      ?.client_reference_id ||
    null;

  const fallbackPlan =
    session
      ?.metadata
      ?.plan ||
    null;

  const subscriptionId =
    typeof session?.subscription === 'string'
      ? session.subscription
      : null;

  if (!userId) {
    throw new Error(
      `Checkout ${session?.id || 'unknown'} is missing metadata.user_id.`
    );
  }

  if (!subscriptionId) {
    throw new Error(
      `Checkout ${session?.id || 'unknown'} is missing its subscription ID.`
    );
  }

  console.log(
    '[WEBHOOK] CHECKOUT COMPLETED',
    {
      sessionId:
        session?.id,

      userId,

      fallbackPlan,

      subscriptionId,
    }
  );

  const subscription =
    await stripe(
      `subscriptions/${encodeURIComponent(
        subscriptionId
      )}`
    );

  await activateSubscription(
    userId,
    subscription,
    fallbackPlan
  );
}

async function handleSubscriptionCreatedOrUpdated(
  subscription: any
) {
  const userId =
    subscription
      ?.metadata
      ?.user_id ||
    null;

  const fallbackPlan =
    subscription
      ?.metadata
      ?.plan ||
    null;

  if (!userId) {
    throw new Error(
      `Subscription ${subscription?.id || 'unknown'} is missing metadata.user_id.`
    );
  }

  await activateSubscription(
    userId,
    subscription,
    fallbackPlan
  );
}

async function handleSubscriptionDeleted(
  subscription: any
) {
  const userId =
    subscription
      ?.metadata
      ?.user_id ||
    null;

  if (!userId) {
    throw new Error(
      `Canceled subscription ${subscription?.id || 'unknown'} is missing metadata.user_id.`
    );
  }

  await cancelSubscription(
    userId,
    subscription
  );
}

async function handleInvoicePaid(
  invoice: any
) {
  const subscriptionId =
    typeof invoice?.subscription === 'string'
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

  await handleSubscriptionCreatedOrUpdated(
    subscription
  );
}

async function handleInvoicePaymentFailed(
  invoice: any
) {
  const subscriptionId =
    typeof invoice?.subscription === 'string'
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

  const userId =
    subscription
      ?.metadata
      ?.user_id ||
    null;

  if (!userId) {
    throw new Error(
      `Failed-payment subscription ${subscription?.id || 'unknown'} is missing metadata.user_id.`
    );
  }

  const profile =
    await findProfile(
      userId
    );

  if (!profile) {
    throw new Error(
      `No Washek profile exists for user ${userId}.`
    );
  }

  await updateProfile(
    userId,
    {
      subscription_status:
        subscription?.status ||
        'past_due',

      stripe_customer_id:
        typeof subscription?.customer === 'string'
          ? subscription.customer
          : null,

      stripe_subscription_id:
        subscription?.id ||
        null,

      stripe_price_id:
        getSubscriptionPriceId(
          subscription
        ),
    }
  );

  console.log(
    '[WEBHOOK] PAYMENT FAILED',
    {
      userId,

      subscriptionId:
        subscription?.id,

      status:
        subscription?.status,
    }
  );
}

Deno.serve(
  async (
    req
  ) => {
    /*
     * Stripe only needs POST.
     */

    if (
      req.method !== 'POST'
    ) {
      return new Response(
        'Method not allowed.',
        {
          status: 405,
        }
      );
    }

    try {
      /*
       * IMPORTANT:
       * Read the raw body before parsing JSON.
       */

      const payload =
        await req.text();

      const signature =
        req.headers.get(
          'stripe-signature'
        );

      if (!signature) {
        return json(
          {
            received:
              false,

            error:
              'Missing Stripe-Signature header.',
          },
          400
        );
      }

      /*
       * Verify Stripe's signature.
       */

      await verifySignature(
        payload,
        signature
      );

      /*
       * Parse event.
       */

      const event =
        JSON.parse(
          payload
        );

      console.log(
        '[WEBHOOK] RECEIVED EVENT:',
        event?.type
      );

      /*
       * Handle event.
       */

      switch (
        event?.type
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
          await handleSubscriptionCreatedOrUpdated(
            event.data.object
          );
          break;

        case 'customer.subscription.updated':
          await handleSubscriptionCreatedOrUpdated(
            event.data.object
          );
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(
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
            '[WEBHOOK] Ignored event:',
            event?.type
          );
      }

      return json(
        {
          received:
            true,
        },
        200
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

      return json(
        {
          received:
            false,

          error:
            message,
        },
        400
      );
    }
  }
);
