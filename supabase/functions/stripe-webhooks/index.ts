import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import {
  createClient,
} from 'jsr:@supabase/supabase-js@2';

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
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

/*
 * ============================================================
 * WASHEK FITNESS STRIPE PRODUCTS
 * ============================================================
 */

const PRODUCT_IDS = {
  progress:
    'prod_USTp1fOzf3aHsl',

  performance:
    'prod_USTpsXJPgs7ccs',

  elite:
    'prod_USTqn0bZsTVUkH',
};

const PLAN_ORDER = [
  'free',
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
      headers: {
        'Content-Type':
          'application/json',
      },
    }
  );
}

function isPaidStatus(
  status: string
) {
  return (
    status === 'active' ||
    status === 'trialing'
  );
}

/*
 * Convert a Stripe Product ID to the
 * corresponding Washek plan.
 */
function planFromProduct(
  productId: string | null
) {
  if (
    productId ===
    PRODUCT_IDS.progress
  ) {
    return 'progress';
  }

  if (
    productId ===
    PRODUCT_IDS.performance
  ) {
    return 'performance';
  }

  if (
    productId ===
    PRODUCT_IDS.elite
  ) {
    return 'elite';
  }

  return null;
}

/*
 * Compatibility with any Price IDs you may
 * already have configured.
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
 * ============================================================
 * STRIPE WEBHOOK SIGNATURE VERIFICATION
 * ============================================================
 */

async function verifyStripeSignature(
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
    parts.find((part) =>
      part.startsWith('t=')
    );

  const signatureParts =
    parts
      .filter((part) =>
        part.startsWith('v1=')
      )
      .map((part) =>
        part.slice(3)
      );

  if (
    !timestampPart ||
    signatureParts.length === 0
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
      'Invalid Stripe webhook timestamp.'
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
      .map((byte) =>
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
 * ============================================================
 * FIND WASHEK USER
 * ============================================================
 */

/*
 * Find a Washek profile by Supabase auth user ID.
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

  if (error) {
    throw error;
  }

  return data;
}

/*
 * Find a Washek profile by Stripe customer ID.
 */
async function findProfileByCustomerId(
  customerId: string
) {
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

  if (error) {
    throw error;
  }

  return data;
}

/*
 * Find a Washek profile by email.
 *
 * Payment Links already know the customer's email,
 * so this is the critical fallback for existing
 * Stripe subscriptions.
 */
async function findProfileByEmail(
  email: string
) {
  const normalized =
    email
      .trim()
      .toLowerCase();

  if (!normalized) {
    return null;
  }

  /*
   * First try the profiles table.
   */
  const {
    data: directProfile,
    error: directError,
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

  if (directError) {
    throw directError;
  }

  if (directProfile) {
    return directProfile;
  }

  /*
   * Fallback to Supabase Auth.
   *
   * This handles cases where profile email
   * was not populated correctly.
   */
  const {
    data: usersData,
    error: usersError,
  } =
    await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

  if (usersError) {
    throw usersError;
  }

  const authUser =
    usersData.users.find(
      (user) =>
        user.email
          ?.trim()
          .toLowerCase() ===
        normalized
    );

  if (!authUser) {
    return null;
  }

  return findProfileByUserId(
    authUser.id
  );
}

/*
 * Given Stripe information, find the
 * correct Washek profile.
 */
async function findWashekProfile({
  userId,
  customerId,
  email,
}: {
  userId?: string | null;
  customerId?: string | null;
  email?: string | null;
}) {
  if (
    userId
  ) {
    const profile =
      await findProfileByUserId(
        userId
      );

    if (profile) {
      return profile;
    }
  }

  if (
    customerId
  ) {
    const profile =
      await findProfileByCustomerId(
        customerId
      );

    if (profile) {
      return profile;
    }
  }

  if (
    email
  ) {
    const profile =
      await findProfileByEmail(
        email
      );

    if (profile) {
      return profile;
    }
  }

  return null;
}

/*
 * ============================================================
 * STRIPE CUSTOMER DATA
 * ============================================================
 */

async function getCustomer(
  customerId: string | null
) {
  if (!customerId) {
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
 * ============================================================
 * SUBSCRIPTION PLAN DETECTION
 * ============================================================
 */

function getPlanFromSubscription(
  subscription: any,
  fallbackPlan: string | null
) {
  const item =
    subscription
      ?.items
      ?.data?.[0];

  const price =
    item?.price;

  const priceId =
    price?.id ||
    null;

  const productId =
    typeof price?.product ===
    'string'
      ? price.product
      : null;

  /*
   * PRODUCT ID FIRST.
   *
   * This is what your current app gave me,
   * and it is the most reliable plan mapping.
   */
  const productPlan =
    planFromProduct(
      productId
    );

  if (
    productPlan
  ) {
    return productPlan;
  }

  /*
   * PRICE ID SECOND.
   */
  const pricePlan =
    planFromPrice(
      priceId
    );

  if (
    pricePlan
  ) {
    return pricePlan;
  }

  /*
   * METADATA THIRD.
   */
  const metadataPlan =
    subscription
      ?.metadata
      ?.plan;

  if (
    metadataPlan &&
    PLAN_ORDER.includes(
      metadataPlan
    )
  ) {
    return metadataPlan;
  }

  /*
   * Existing profile plan last.
   */
  return fallbackPlan;
}

/*
 * ============================================================
 * PROFILE UPDATE
 * ============================================================
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

  if (error) {
    throw error;
  }
}

/*
 * ============================================================
 * CHECKOUT COMPLETED
 * ============================================================
 */

async function handleCheckoutCompleted(
  session: any
) {
  const sessionCustomerId =
    typeof session?.customer ===
    'string'
      ? session.customer
      : null;

  /*
   * The Payment Link may have a plan as its
   * client_reference_id. Do not assume that
   * value is a Washek user ID.
   */
  const possibleUserId =
    session?.metadata?.user_id ||
    null;

  /*
   * Retrieve the Stripe Customer so we can
   * reliably obtain the customer's email.
   */
  const customer =
    await getCustomer(
      sessionCustomerId
    );

  const customerEmail =
    getCustomerEmail(
      customer
    ) ||
    session?.customer_details?.email
      ?.trim()
      .toLowerCase() ||
    session?.customer_email
      ?.trim()
      .toLowerCase() ||
    null;

  const profile =
    await findWashekProfile({
      userId:
        possibleUserId,

      customerId:
        sessionCustomerId,

      email:
        customerEmail,
    });

  if (!profile) {
    console.error(
      'Stripe checkout completed but no Washek profile could be matched.',
      {
        sessionId:
          session?.id,

        customerId:
          sessionCustomerId,

        email:
          customerEmail,
      }
    );

    return;
  }

  const subscriptionId =
    typeof session?.subscription ===
    'string'
      ? session.subscription
      : null;

  if (!subscriptionId) {
    console.error(
      'Stripe checkout completed without a subscription ID.',
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
    getPlanFromSubscription(
      subscription,
      session?.metadata
        ?.plan ||
        null
    );

  if (
    !plan ||
    !PLAN_ORDER.includes(
      plan
    ) ||
    plan ===
      'free'
  ) {
    console.error(
      'Could not determine Washek subscription plan.',
      {
        sessionId:
          session?.id,

        subscriptionId,

        profileId:
          profile.id,

        priceId:
          subscription
            ?.items
            ?.data?.[0]
            ?.price?.id,

        productId:
          subscription
            ?.items
            ?.data?.[0]
            ?.price?.product,
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

  const productId =
    typeof subscription
      ?.items
      ?.data?.[0]
      ?.price?.product ===
    'string'
      ? subscription
          .items
          .data[0]
          .price
          .product
      : null;

  await updateProfile(
    profile.id,
    {
      subscription_plan:
        plan,

      subscription_status:
        subscription.status ||
        'active',

      stripe_customer_id:
        sessionCustomerId,

      stripe_subscription_id:
        subscriptionId,

      stripe_price_id:
        priceId,

      subscription_cancelled_at:
        null,
    }
  );

  console.log(
    'Washek subscription activated.',
    {
      profileId:
        profile.id,

      plan,

      productId,

      priceId,

      subscriptionId,
    }
  );
}

/*
 * ============================================================
 * SUBSCRIPTION CREATED / UPDATED / DELETED
 * ============================================================
 */

async function handleSubscription(
  subscription: any
) {
  const metadata =
    subscription
      ?.metadata ||
    {};

  const userId =
    metadata.user_id ||
    null;

  const customerId =
    typeof subscription?.customer ===
    'string'
      ? subscription.customer
      : null;

  /*
   * Retrieve customer email for subscriptions
   * that don't have usable metadata.
   */
  const customer =
    await getCustomer(
      customerId
    );

  const customerEmail =
    getCustomerEmail(
      customer
    );

  const profile =
    await findWashekProfile({
      userId,

      customerId,

      email:
        customerEmail,
    });

  if (!profile) {
    console.error(
      'Could not match Stripe subscription to a Washek profile.',
      {
        subscriptionId:
          subscription?.id,

        customerId,

        email:
          customerEmail,
      }
    );

    return;
  }

  const status =
    subscription?.status ||
    'inactive';

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

  const plan =
    getPlanFromSubscription(
      subscription,
      metadata.plan ||
        profile.subscription_plan ||
        null
    );

  /*
   * CANCELED
   *
   * Immediately return to Free.
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
      'Washek subscription canceled.',
      {
        profileId:
          profile.id,

        subscriptionId:
          subscription?.id,
      }
    );

    return;
  }

  /*
   * ACTIVE / TRIALING
   */
  if (
    paidStatus(status) &&
    plan &&
    PLAN_ORDER.includes(
      plan
    ) &&
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

        subscription_cancelled_at:
          null,
      }
    );

    console.log(
      'Washek subscription synchronized.',
      {
        profileId:
          profile.id,

        plan,

        productId,

        priceId,

        status,
      }
    );

    return;
  }

  /*
   * Any subscription state that is not
   * an active paid entitlement becomes Free.
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
 * ============================================================
 * INVOICE PAID
 * ============================================================
 */

async function handleInvoicePaid(
  invoice: any
) {
  /*
   * Depending on Stripe API/event version,
   * subscription may be directly present or
   * inside parent.subscription_details.
   */
  const directSubscription =
    typeof invoice?.subscription ===
    'string'
      ? invoice.subscription
      : null;

  const nestedSubscription =
    typeof invoice?.parent
      ?.subscription_details
      ?.subscription ===
    'string'
      ? invoice.parent
          .subscription_details
          .subscription
      : null;

  const subscriptionId =
    directSubscription ||
    nestedSubscription ||
    null;

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
 * ============================================================
 * INVOICE PAYMENT FAILED
 * ============================================================
 */

async function handleInvoicePaymentFailed(
  invoice: any
) {
  const directSubscription =
    typeof invoice?.subscription ===
    'string'
      ? invoice.subscription
      : null;

  const nestedSubscription =
    typeof invoice?.parent
      ?.subscription_details
      ?.subscription ===
    'string'
      ? invoice.parent
          .subscription_details
          .subscription
      : null;

  const subscriptionId =
    directSubscription ||
    nestedSubscription ||
    null;

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

  const customer =
    await getCustomer(
      customerId
    );

  const email =
    getCustomerEmail(
      customer
    );

  const profile =
    await findWashekProfile({
      userId:
        subscription
          ?.metadata
          ?.user_id ||
        null,

      customerId,

      email,
    });

  if (!profile) {
    return;
  }

  /*
   * Record the current Stripe status.
   *
   * Do not revoke access just because one
   * invoice failed if Stripe still considers
   * the subscription active.
   */
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

      await verifyStripeSignature(
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
          console.log(
            `Ignoring Stripe event: ${event.type}`
          );
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
