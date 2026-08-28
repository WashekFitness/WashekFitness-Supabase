import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import {
  createClient,
} from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Content-Type':
    'application/json',
};

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

/*
 * ==========================================================
 * YOUR STRIPE PRODUCT IDS
 * ==========================================================
 */

const PRODUCT_TO_PLAN = {
  'prod_USTp1fOzf3aHsl':
    'progress',

  'prod_USTpsXJPgs7ccs':
    'performance',

  'prod_USTqn0bZsTVUkH':
    'elite',
};

const PLAN_ORDER = [
  'free',
  'progress',
  'performance',
  'elite',
];

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

function isPaidStatus(
  status: string
) {
  return (
    status === 'active' ||
    status === 'trialing'
  );
}

/*
 * ==========================================================
 * STRIPE API
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
 * STRIPE SIGNATURE VERIFICATION
 * ==========================================================
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

  const pieces =
    signatureHeader.split(
      ','
    );

  const timestampPiece =
    pieces.find((piece) =>
      piece.startsWith(
        't='
      )
    );

  const signaturePieces =
    pieces
      .filter((piece) =>
        piece.startsWith(
          'v1='
        )
      )
      .map((piece) =>
        piece.slice(3)
      );

  if (
    !timestampPiece ||
    signaturePieces.length ===
      0
  ) {
    throw new Error(
      'Invalid Stripe signature.'
    );
  }

  const timestamp =
    Number(
      timestampPiece.slice(
        2
      )
    );

  if (
    !Number.isFinite(
      timestamp
    )
  ) {
    throw new Error(
      'Invalid Stripe signature timestamp.'
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
    age > 300
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

  const signature =
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
        signature
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
    signaturePieces
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
      i <
      expected.length;
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
 * CUSTOMER / PRODUCT HELPERS
 * ==========================================================
 */

async function getStripeCustomer(
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

async function getCustomerEmail(
  customerId: string | null
) {
  const customer =
    await getStripeCustomer(
      customerId
    );

  return (
    customer?.email
      ?.trim()
      .toLowerCase() ||
    null
  );
}

function getProductIdFromSubscription(
  subscription: any
) {
  const product =
    subscription
      ?.items
      ?.data?.[0]
      ?.price
      ?.product;

  if (
    typeof product ===
    'string'
  ) {
    return product;
  }

  return null;
}

function getPriceIdFromSubscription(
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

function getPlanFromProduct(
  productId: string | null
) {
  if (
    !productId
  ) {
    return null;
  }

  return (
    PRODUCT_TO_PLAN[
      productId
    ] || null
  );
}

/*
 * Preserve compatibility with already-configured
 * Price IDs, if you have them.
 */
function getPlanFromPrice(
  priceId: string | null
) {
  if (
    !priceId
  ) {
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
 * ==========================================================
 * PROFILE LOOKUP
 * ==========================================================
 *
 * This is the major fix.
 *
 * Payment Link subscriptions may not contain
 * a Washek user ID.
 *
 * We therefore identify the user by:
 *
 * 1. metadata.user_id
 * 2. Stripe customer ID
 * 3. Stripe customer email
 *
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

async function findProfileByCustomer(
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

  if (
    data
  ) {
    return data;
  }

  /*
   * Fall back to Supabase Auth if the
   * profile email isn't populated.
   */
  const {
    data: authData,
    error: authError,
  } =
    await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

  if (
    authError
  ) {
    throw authError;
  }

  const authUser =
    authData.users.find(
      (candidate) =>
        candidate.email
          ?.trim()
          .toLowerCase() ===
        normalized
    );

  if (
    !authUser
  ) {
    return null;
  }

  return findProfileByUserId(
    authUser.id
  );
}

async function findWashekProfile({
  userId,
  customerId,
  email,
}: {
  userId?: string | null;
  customerId?: string | null;
  email?: string | null;
}) {
  const byUser =
    await findProfileByUserId(
      userId ||
        null
    );

  if (
    byUser
  ) {
    return byUser;
  }

  const byCustomer =
    await findProfileByCustomer(
      customerId ||
        null
    );

  if (
    byCustomer
  ) {
    return byCustomer;
  }

  const byEmail =
    await findProfileByEmail(
      email ||
        null
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
 * PROFILE SYNCHRONIZATION
 * ==========================================================
 */

async function updateProfileSubscription(
  profileId: string,
  subscription: any,
  fallbackPlan: string | null = null
) {
  const status =
    subscription?.status ||
    'inactive';

  const productId =
    getProductIdFromSubscription(
      subscription
    );

  const priceId =
    getPriceIdFromSubscription(
      subscription
    );

  /*
   * Product ID is the primary source of truth.
   */
  const productPlan =
    getPlanFromProduct(
      productId
    );

  /*
   * Price ID is a compatibility fallback.
   */
  const pricePlan =
    getPlanFromPrice(
      priceId
    );

  /*
   * Metadata is another fallback.
   */
  const metadataPlan =
    subscription
      ?.metadata
      ?.plan ||
    null;

  const plan =
    productPlan ||
    pricePlan ||
    (
      metadataPlan &&
      PLAN_ORDER.includes(
        metadataPlan
      )
        ? metadataPlan
        : null
    ) ||
    fallbackPlan;

  /*
   * Cancellation immediately means Free.
   */
  if (
    status ===
      'canceled' ||
    status ===
      'incomplete_expired'
  ) {
    await updateProfile(
      profileId,
      {
        subscription_plan:
          'free',

        subscription_status:
          'canceled',

        stripe_customer_id:
          typeof subscription.customer ===
          'string'
            ? subscription.customer
            : null,

        stripe_subscription_id:
          null,

        stripe_price_id:
          null,

        subscription_cancelled_at:
          new Date().toISOString(),
      }
    );

    return {
      plan: 'free',
      status: 'canceled',
    };
  }

  /*
   * Active/trialing paid subscription.
   */
  if (
    isPaidStatus(
      status
    ) &&
    plan &&
    PLAN_ORDER.includes(
      plan
    ) &&
    plan !==
      'free'
  ) {
    await updateProfile(
      profileId,
      {
        subscription_plan:
          plan,

        subscription_status:
          status,

        stripe_customer_id:
          typeof subscription.customer ===
          'string'
            ? subscription.customer
            : null,

        stripe_subscription_id:
          subscription.id,

        stripe_price_id:
          priceId,

        subscription_cancelled_at:
          null,
      }
    );

    return {
      plan,
      status,
    };
  }

  /*
   * Anything that doesn't represent an active
   * paid subscription should not retain paid access.
   */
  await updateProfile(
    profileId,
    {
      subscription_plan:
        'free',

      subscription_status:
        status,

      stripe_customer_id:
        typeof subscription.customer ===
        'string'
          ? subscription.customer
          : null,

      stripe_subscription_id:
        null,

      stripe_price_id:
        null,

      subscription_cancelled_at:
        new Date().toISOString(),
    }
  );

  return {
    plan: 'free',
    status,
  };
}

async function updateProfile(
  profileId: string,
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

  /*
   * Only trust metadata.user_id if it
   * actually looks like a Washek user ID.
   *
   * Otherwise email lookup handles
   * Payment Links.
   */
  const metadataUserId =
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
      await getCustomerEmail(
        customerId
      );
  }

  const profile =
    await findWashekProfile({
      userId:
        metadataUserId,

      customerId,

      email,
    });

  if (
    !profile
  ) {
    console.error(
      'Stripe checkout completed but no Washek profile matched.',
      {
        sessionId:
          session?.id,

        customerId,

        email,

        metadataUserId,

        metadataPlan,
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
      'Checkout session has no subscription ID.',
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

  await updateProfileSubscription(
    profile.id,
    subscription,
    metadataPlan
  );

  console.log(
    'Stripe checkout synchronized to Washek.',
    {
      profileId:
        profile.id,

      subscriptionId,

      email,

      productId:
        getProductIdFromSubscription(
          subscription
        ),

      priceId:
        getPriceIdFromSubscription(
          subscription
        ),
    }
  );
}

/*
 * ==========================================================
 * SUBSCRIPTION CREATED / UPDATED / DELETED
 * ==========================================================
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

  const email =
    await getCustomerEmail(
      customerId
    );

  const profile =
    await findWashekProfile({
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

  await updateProfileSubscription(
    profile.id,
    subscription,
    metadata.plan ||
      null
  );

  console.log(
    'Stripe subscription synchronized.',
    {
      profileId:
        profile.id,

      subscriptionId:
        subscription.id,

      status:
        subscription.status,

      productId:
        getProductIdFromSubscription(
          subscription
        ),

      plan:
        getPlanFromProduct(
          getProductIdFromSubscription(
            subscription
          )
        ),
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
    await getCustomerEmail(
      customerId
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
 * WEBHOOK ENTRY
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

      await verifyStripeSignature(
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
          /*
           * Other Stripe events are safely ignored.
           */
          break;
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
