import { createClient } from
  'https://esm.sh/@supabase/supabase-js@2';

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

const PLAN_ORDER = [
  'free',
  'progress',
  'performance',
  'elite',
];

function planFromPrice(
  priceId: string
) {
  const map: Record<
    string,
    string
  > = {};

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

  if (progress) {
    map[progress] =
      'progress';
  }

  if (performance) {
    map[performance] =
      'performance';
  }

  if (elite) {
    map[elite] =
      'elite';
  }

  return map[priceId] || null;
}

function paidStatus(
  status: string
) {
  return (
    status === 'active' ||
    status === 'trialing'
  );
}

async function stripe(
  path: string
) {
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
 * Stripe signs the raw webhook payload.
 *
 * This implementation verifies the
 * Stripe-Signature header without requiring
 * the Stripe npm package.
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
    signatureHeader
      .split(',');

  const timestampPart =
    pieces.find((p) =>
      p.startsWith('t=')
    );

  const signatureParts =
    pieces
      .filter((p) =>
        p.startsWith('v1=')
      )
      .map((p) =>
        p.slice(3)
      );

  if (
    !timestampPart ||
    signatureParts.length === 0
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
      'Invalid Stripe timestamp.'
    );
  }

  /*
   * Reject signatures older than five minutes.
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

  const encoder =
    new TextEncoder();

  const keyData =
    encoder.encode(
      STRIPE_WEBHOOK_SECRET
    );

  const cryptoKey =
    await crypto.subtle.importKey(
      'raw',
      keyData,
      {
        name: 'HMAC',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );

  const signature =
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
        signature
      )
    )
      .map((b) =>
        b
          .toString(16)
          .padStart(2, '0')
      )
      .join('');

  for (
    const candidate of
    signatureParts
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

    if (difference === 0) {
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
  if (userId) {
    const { data } =
      await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

    if (data) {
      return data;
    }
  }

  if (customerId) {
    const { data } =
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
  const { error } =
    await supabaseAdmin
      .from('profiles')
      .update({
        ...patch,
        subscription_updated_at:
          new Date().toISOString(),
        updated_at:
          new Date().toISOString(),
      })
      .eq('id', userId);

  if (error) {
    throw error;
  }
}

async function handleCheckoutCompleted(
  session: any
) {
  const userId =
    session?.metadata?.user_id ||
    session?.client_reference_id ||
    null;

  const plan =
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
      'checkout.session.completed missing user_id',
      session?.id
    );
    return;
  }

  let finalPlan = plan;

  let subscription =
    null;

  if (subscriptionId) {
    subscription =
      await stripe(
        `subscriptions/${encodeURIComponent(
          subscriptionId
        )}`
      );
  }

  if (
    subscription &&
    subscription.items?.data?.length
  ) {
    const priceId =
      subscription
        .items
        .data[0]
        ?.price?.id;

    const pricePlan =
      planFromPrice(
        priceId
      );

    if (pricePlan) {
      finalPlan =
        pricePlan;
    }
  }

  if (
    !finalPlan ||
    !PLAN_ORDER.includes(
      finalPlan
    ) ||
    finalPlan === 'free'
  ) {
    console.error(
      'Unable to determine paid plan.',
      {
        sessionId:
          session?.id,
        userId,
        plan,
      }
    );

    return;
  }

  await updateProfile(
    userId,
    {
      subscription_plan:
        finalPlan,

      subscription_status:
        subscription?.status ||
        'active',

      stripe_customer_id:
        customerId,

      stripe_subscription_id:
        subscriptionId,

      stripe_price_id:
        subscription
          ?.items
          ?.data?.[0]
          ?.price?.id ||
        null,

      subscription_cancelled_at:
        null,
    }
  );
}

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
      'No profile found for Stripe subscription.',
      {
        subscriptionId:
          subscription?.id,
        userId,
        customerId,
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

  const plan =
    planFromPrice(
      priceId
    ) ||
    metadata.plan ||
    profile.subscription_plan ||
    'free';

  const status =
    subscription?.status ||
    'inactive';

  if (
    status === 'canceled' ||
    status === 'incomplete_expired'
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

    return;
  }

  if (
    paidStatus(status) &&
    PLAN_ORDER.includes(plan) &&
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

    return;
  }

  /*
   * Anything that is no longer an active
   * paid entitlement becomes Free.
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

  /*
   * Do not automatically give a user Free
   * just because one invoice failed.
   *
   * Store the status and let Stripe's
   * subscription status determine access.
   */
  await updateProfile(
    profile.id,
    {
      subscription_status:
        subscription?.status ||
        'past_due',
    }
  );
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
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
      JSON.parse(payload);

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
        /*
         * Ignore events we do not need.
         */
        break;
    }

    return new Response(
      JSON.stringify({
        received: true,
      }),
      {
        status: 200,
        headers: {
          'Content-Type':
            'application/json',
        },
      }
    );
  } catch (error) {
    console.error(
      'stripe-webhooks error:',
      error
    );

    return new Response(
      JSON.stringify({
        received: false,
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
});
