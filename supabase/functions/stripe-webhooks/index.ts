import {
  createClient,
} from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY =
  Deno.env.get(
    'STRIPE_SECRET_KEY'
  ) || '';

const STRIPE_WEBHOOK_SECRET =
  Deno.env.get(
    'STRIPE_WEBHOOK_SECRET'
  ) || '';

const SUPABASE_URL =
  Deno.env.get(
    'SUPABASE_URL'
  ) || '';

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
        persistSession:
          false,

        autoRefreshToken:
          false,
      },
    }
  );

const PRODUCT_TO_PLAN = {
  'prod_USTp1fOzf3aHsl':
    'progress',

  'prod_USTpsXJPgs7ccs':
    'performance',

  'prod_USTqn0bZsTVUkH':
    'elite',
};

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

/*
 * ==========================================================
 * STRIPE API
 * ==========================================================
 */

async function stripe(
  path: string
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
        headers: {
          Authorization:
            `Bearer ${STRIPE_SECRET_KEY}`,
        },
      }
    );

  const data =
    await response.json();

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
 * SIGNATURE VERIFICATION
 * ==========================================================
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

  const parts =
    signatureHeader.split(',');

  const timestampPart =
    parts.find(
      (part) =>
        part.startsWith('t=')
    );

  const signatures =
    parts
      .filter(
        (part) =>
          part.startsWith('v1=')
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
      'Invalid Stripe webhook signature.'
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
      let i = 0;
      i < expected.length;
      i += 1
    ) {
      difference |=
        expected.charCodeAt(
          i
        ) ^
        candidate.charCodeAt(
          i
        );
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

/*
 * ==========================================================
 * CUSTOMER
 * ==========================================================
 */

async function getCustomer(
  customerId: string | null
) {
  if (
    !customerId
  ) {
    return null;
  }

  return stripe(
    `customers/${encodeURIComponent(
      customerId
    )}`
  );
}

function getCustomerEmail(
  customer: any
) {
  return (
    customer?.email
      ?.trim()
      .toLowerCase() ||
    null
  );
}

/*
 * ==========================================================
 * PROFILE LOOKUP
 * ==========================================================
 */

async function findProfileByUserId(
  userId: string | null
) {
  if (
    !userId
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
        'id',
        userId
      )
      .maybeSingle();

  if (
    error
  ) {
    throw error;
  }

  return data;
}

async function findProfileByCustomerId(
  customerId: string | null
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

  return data;
}

async function findProfileByEmail(
  email: string | null
) {
  if (
    !email
  ) {
    return null;
  }

  const normalized =
    email
      .trim()
      .toLowerCase();

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from('profiles')
      .select('*')
      .ilike(
        'email',
        normalized
      )
      .limit(1)
      .maybeSingle();

  if (
    error
  ) {
    throw error;
  }

  return data;
}

async function findProfile({
  userId,
  customerId,
  email,
}: {
  userId: string | null;
  customerId: string | null;
  email: string | null;
}) {
  const byUser =
    await findProfileByUserId(
      userId
    );

  if (
    byUser
  ) {
    return byUser;
  }

  const byCustomer =
    await findProfileByCustomerId(
      customerId
    );

  if (
    byCustomer
  ) {
    return byCustomer;
  }

  const byEmail =
    await findProfileByEmail(
      email
    );

  if (
    byEmail
  ) {
    return byEmail;
  }

  return null;
}

/*
 * ==========================================================
 * PLAN DETECTION
 * ==========================================================
 */

function getPlan(
  subscription: any,
  fallbackPlan: string | null = null
) {
  const item =
    subscription
      ?.items
      ?.data?.[0];

  const price =
    item?.price;

  const productId =
    typeof price?.product ===
    'string'
      ? price.product
      : null;

  const priceId =
    price?.id ||
    null;

  /*
   * PRIMARY:
   * Product ID.
   */
  if (
    productId &&
    PRODUCT_TO_PLAN[
      productId
    ]
  ) {
    return (
      PRODUCT_TO_PLAN[
        productId
      ]
    );
  }

  /*
   * SECONDARY:
   * Existing Price ID secrets.
   */
  const progressPrice =
    Deno.env.get(
      'STRIPE_PROGRESS_PRICE_ID'
    );

  const performancePrice =
    Deno.env.get(
      'STRIPE_PERFORMANCE_PRICE_ID'
    );

  const elitePrice =
    Deno.env.get(
      'STRIPE_ELITE_PRICE_ID'
    );

  if (
    progressPrice &&
    priceId ===
      progressPrice
  ) {
    return 'progress';
  }

  if (
    performancePrice &&
    priceId ===
      performancePrice
  ) {
    return 'performance';
  }

  if (
    elitePrice &&
    priceId ===
      elitePrice
  ) {
    return 'elite';
  }

  /*
   * THIRDARY:
   * Subscription metadata.
   */
  const metadataPlan =
    subscription
      ?.metadata
      ?.plan;

  if (
    [
      'progress',
      'performance',
      'elite',
    ].includes(
      metadataPlan
    )
  ) {
    return metadataPlan;
  }

  return fallbackPlan;
}

/*
 * ==========================================================
 * UPDATE PROFILE
 * ==========================================================
 */

async function updateProfile(
  profileId: string,
  values: Record<string, unknown>
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
        profileId
      );

  if (
    error
  ) {
    throw error;
  }
}

/*
 * ==========================================================
 * CHECKOUT COMPLETED
 * ==========================================================
 */

async function handleCheckoutCompleted(
  session: any
) {
  const customerId =
    typeof session?.customer ===
    'string'
      ? session.customer
      : null;

  const userId =
    session
      ?.metadata
      ?.user_id ||
    null;

  const metadataPlan =
    session
      ?.metadata
      ?.plan ||
    null;

  let email =
    session
      ?.customer_details
      ?.email
      ?.trim()
      .toLowerCase() ||
    session
      ?.customer_email
      ?.trim()
      .toLowerCase() ||
    null;

  if (
    !email &&
    customerId
  ) {
    email =
      getCustomerEmail(
        await getCustomer(
          customerId
        )
      );
  }

  const profile =
    await findProfile({
      userId,

      customerId,

      email,
    });

  if (
    !profile
  ) {
    console.error(
      'Stripe checkout could not be matched to a Washek profile.',
      {
        sessionId:
          session?.id,

        userId,

        customerId,

        email,
      }
    );

    return;
  }

  const subscriptionId =
    typeof session?.subscription ===
    'string'
      ? session.subscription
      : null;

  if (
    !subscriptionId
  ) {
    console.error(
      'Checkout session did not contain a subscription ID.',
      {
        sessionId:
          session?.id,

        profileId:
          profile.id,
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
    getPlan(
      subscription,
      metadataPlan
    );

  if (
    !plan
  ) {
    console.error(
      'Unable to determine Washek plan.',
      {
        subscriptionId,

        profileId:
          profile.id,

        productId:
          subscription
            ?.items
            ?.data?.[0]
            ?.price
            ?.product,

        priceId:
          subscription
            ?.items
            ?.data?.[0]
            ?.price
            ?.id,

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
    profile.id,
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
    }
  );

  console.log(
    'Washek subscription activated.',
    {
      profileId:
        profile.id,

      plan,

      customerId,

      subscriptionId,

      priceId,
    }
  );
}

/*
 * ==========================================================
 * SUBSCRIPTION EVENTS
 * ==========================================================
 */

async function handleSubscription(
  subscription: any
) {
  const customerId =
    typeof subscription?.customer ===
    'string'
      ? subscription.customer
      : null;

  const userId =
    subscription
      ?.metadata
      ?.user_id ||
    null;

  const email =
    getCustomerEmail(
      await getCustomer(
        customerId
      )
    );

  const profile =
    await findProfile({
      userId,

      customerId,

      email,
    });

  if (
    !profile
  ) {
    console.error(
      'Stripe subscription could not be matched to Washek.',
      {
        subscriptionId:
          subscription?.id,

        userId,

        customerId,

        email,
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

  const plan =
    getPlan(
      subscription,
      profile.subscription_plan ||
        null
    );

  /*
   * Immediate cancellation.
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
      }
    );

    console.log(
      'Washek subscription canceled.',
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
   * Active paid subscription.
   */
  if (
    (
      status ===
        'active' ||
      status ===
        'trialing'
    ) &&
    plan &&
    plan !==
      'free'
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
      }
    );

    console.log(
      'Washek subscription synchronized.',
      {
        profileId:
          profile.id,

        plan,

        status,

        productId:
          subscription
            ?.items
            ?.data?.[0]
            ?.price
            ?.product,

        priceId,
      }
    );

    return;
  }

  /*
   * Anything that isn't an active paid
   * entitlement becomes Free.
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
    }
  );
}

/*
 * ==========================================================
 * INVOICE PAID
 * ==========================================================
 */

async function handleInvoicePaid(
  invoice: any
) {
  const direct =
    typeof invoice?.subscription ===
    'string'
      ? invoice.subscription
      : null;

  const nested =
    typeof invoice?.parent
      ?.subscription_details
      ?.subscription ===
    'string'
      ? invoice.parent
          .subscription_details
          .subscription
      : null;

  const subscriptionId =
    direct ||
    nested ||
    null;

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
 * ==========================================================
 * INVOICE FAILED
 * ==========================================================
 */

async function handleInvoicePaymentFailed(
  invoice: any
) {
  const direct =
    typeof invoice?.subscription ===
    'string'
      ? invoice.subscription
      : null;

  const nested =
    typeof invoice?.parent
      ?.subscription_details
      ?.subscription ===
    'string'
      ? invoice.parent
          .subscription_details
          .subscription
      : null;

  const subscriptionId =
    direct ||
    nested ||
    null;

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

  const customerId =
    typeof subscription?.customer ===
    'string'
      ? subscription.customer
      : null;

  const email =
    getCustomerEmail(
      await getCustomer(
        customerId
      )
    );

  const profile =
    await findProfile({
      userId:
        subscription
          ?.metadata
          ?.user_id ||
        null,

      customerId,

      email,
    });

  if (
    !profile
  ) {
    return;
  }

  await updateProfile(
    profile.id,
    {
      subscription_status:
        subscription.status ||
        'past_due',

      stripe_customer_id:
        customerId,

      stripe_subscription_id:
        subscription.id,
    }
  );
}

/*
 * ==========================================================
 * WEBHOOK
 * ==========================================================
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

      if (
        !signature
      ) {
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
        `Stripe webhook received: ${event.type}`
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
            `Ignoring Stripe event: ${event.type}`
          );
      }

      return json({
        received:
          true,
      });
    } catch (
      error
    ) {
      console.error(
        'Stripe webhook error:',
        error
      );

      return json(
        {
          received:
            false,

          error:
            error instanceof Error
              ? error.message
              : 'Webhook processing failed.',
        },
        400
      );
    }
  }
);
