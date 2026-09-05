import Stripe from "npm:stripe@17.7.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

if (!stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

if (!webhookSecret) {
  throw new Error("Missing STRIPE_WEBHOOK_SECRET");
}

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL");
}

if (!serviceRoleKey) {
  throw new Error("Missing SERVICE_ROLE_KEY");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-12-18.acacia",
});

const supabase = createClient(
  supabaseUrl,
  serviceRoleKey,
);

const PAID_STATUSES = new Set([
  "active",
  "trialing",
]);

const GRACE_PERIOD_SECONDS =
  3 * 24 * 60 * 60;

const PLAN_BY_PRICE_ID: Record<string, string> = {
  "price_1TTYrbRuQpZftYKRoSyLbQ0c": "progress",
  "price_1TTYs8RuQpZftYKR8ZzpNg7x": "performance",
  "price_1TTYsWRuQpZftYKRKIm8V10E": "elite",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  );
}

function getSubscriptionIdFromEvent(
  event: Stripe.Event,
): string | null {
  const object =
    event.data.object as Record<string, unknown>;

  if (
    typeof object.subscription === "string"
  ) {
    return object.subscription;
  }

  if (
    object.subscription &&
    typeof object.subscription === "object" &&
    "id" in object.subscription &&
    typeof object.subscription.id === "string"
  ) {
    return object.subscription.id;
  }

  if (
    typeof object.id === "string" &&
    event.type.startsWith(
      "customer.subscription.",
    )
  ) {
    return object.id;
  }

  return null;
}

function getUserIdFromSubscription(
  subscription: Stripe.Subscription,
): string | null {
  const metadataUserId =
    subscription.metadata?.user_id;

  if (
    metadataUserId &&
    typeof metadataUserId === "string"
  ) {
    return metadataUserId;
  }

  return null;
}

function getPlanFromSubscription(
  subscription: Stripe.Subscription,
): string | null {
  const metadataPlan =
    subscription.metadata?.plan;

  if (
    metadataPlan === "progress" ||
    metadataPlan === "performance" ||
    metadataPlan === "elite"
  ) {
    return metadataPlan;
  }

  const priceId =
    subscription.items.data[0]?.price?.id;

  if (!priceId) {
    return null;
  }

  return PLAN_BY_PRICE_ID[priceId] ?? null;
}

async function claimWebhookEvent(
  event: Stripe.Event,
): Promise<boolean> {
  const { data, error } =
    await supabase.rpc(
      "claim_stripe_webhook_event",
      {
        p_event_id: event.id,
        p_event_type: event.type,
        p_event_created: event.created,
      },
    );

  if (error) {
    throw new Error(
      `Failed to claim webhook event: ${error.message}`,
    );
  }

  return data === true;
}

async function claimOrderedSubscriptionEvent(
  event: Stripe.Event,
  subscriptionId: string,
): Promise<boolean> {
  const { data, error } =
    await supabase.rpc(
      "claim_stripe_subscription_event",
      {
        p_event_id: event.id,
        p_event_type: event.type,
        p_event_created: event.created,
        p_subscription_id: subscriptionId,
      },
    );

  if (error) {
    throw new Error(
      `Failed to claim ordered subscription event: ${error.message}`,
    );
  }

  return data === true;
}

async function markWebhookEvent(
  eventId: string,
  status: "succeeded" | "failed",
  errorMessage?: string,
): Promise<void> {
  const { error } =
    await supabase
      .from("stripe_webhook_events")
      .update({
        status,
        processed_at:
          new Date().toISOString(),
        error_message:
          errorMessage ?? null,
      })
      .eq("event_id", eventId);

  if (error) {
    console.error(
      "Failed to update webhook event status:",
      error,
    );
  }
}

async function getExistingGraceDeadline(
  userId: string,
): Promise<string | null> {
  const { data, error } =
    await supabase
      .from("profiles")
      .select("subscription_grace_until")
      .eq("id", userId)
      .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to read existing subscription grace period: ${error.message}`,
    );
  }

  return (
    data?.subscription_grace_until ??
    null
  );
}

async function syncSubscription(
  subscription: Stripe.Subscription,
  graceUntil: string | null = null,
): Promise<void> {
  const userId =
    getUserIdFromSubscription(
      subscription,
    );

  if (!userId) {
    throw new Error(
      `Subscription ${subscription.id} is missing metadata.user_id`,
    );
  }

  const plan =
    getPlanFromSubscription(
      subscription,
    );

  if (!plan) {
    throw new Error(
      `Unable to determine Washek Fitness plan for subscription ${subscription.id}`,
    );
  }

  let effectiveGraceUntil =
    graceUntil;

  if (
    !effectiveGraceUntil &&
    (
      subscription.status === "past_due" ||
      subscription.status === "unpaid"
    )
  ) {
    effectiveGraceUntil =
      await getExistingGraceDeadline(
        userId,
      );
  }

  const graceActive =
    (
      subscription.status ===
        "past_due" ||
      subscription.status ===
        "unpaid"
    ) &&
    Boolean(effectiveGraceUntil) &&
    new Date(
      effectiveGraceUntil as string,
    ).getTime() > Date.now();

  const isPaidStatus =
    PAID_STATUSES.has(
      subscription.status,
    );

  const isEntitled =
    isPaidStatus ||
    graceActive;

  const isCanceled =
    subscription.status ===
      "canceled" ||
    subscription.status ===
      "incomplete_expired";

  const update = {
    subscription_plan:
      isEntitled
        ? plan
        : "free",

    subscription_status:
      subscription.status,

    subscription_updated_at:
      new Date().toISOString(),

    subscription_grace_until:
      graceActive
        ? effectiveGraceUntil
        : null,

    subscription_cancelled_at:
      isCanceled
        ? new Date().toISOString()
        : null,

    stripe_subscription_id:
      isEntitled
        ? subscription.id
        : null,

    stripe_price_id:
      isEntitled
        ? subscription.items.data[0]
            ?.price?.id ?? null
        : null,
  };

  const { error } =
    await supabase
      .from("profiles")
      .update(update)
      .eq("id", userId);

  if (error) {
    throw new Error(
      `Failed to update profile ${userId}: ${error.message}`,
    );
  }

  console.log(
    JSON.stringify({
      action:
        "subscription_sync",
      subscriptionId:
        subscription.id,
      userId,
      stripeStatus:
        subscription.status,
      plan:
        update.subscription_plan,
      entitled:
        isEntitled,
      graceUntil:
        update.subscription_grace_until,
    }),
  );
}

async function handleSubscriptionEvent(
  event: Stripe.Event,
  subscriptionId: string,
): Promise<void> {
  const shouldProcess =
    await claimOrderedSubscriptionEvent(
      event,
      subscriptionId,
    );

  if (!shouldProcess) {
    console.log(
      `Ignoring stale/duplicate subscription event ${event.id}`,
    );

    return;
  }

  const subscription =
    await stripe.subscriptions.retrieve(
      subscriptionId,
    );

  await syncSubscription(
    subscription,
  );
}

async function establishPaymentGracePeriod(
  subscription: Stripe.Subscription,
): Promise<void> {
  const userId =
    getUserIdFromSubscription(
      subscription,
    );

  if (!userId) {
    throw new Error(
      `Subscription ${subscription.id} is missing metadata.user_id`,
    );
  }

  /*
   * NEVER extend an existing grace period.
   *
   * If a previous invoice.payment_failed event
   * already established a deadline, preserve it.
   */
  const existingGraceUntil =
    await getExistingGraceDeadline(
      userId,
    );

  if (existingGraceUntil) {
    const existingDeadline =
      new Date(
        existingGraceUntil,
      ).getTime();

    if (
      existingDeadline >
      Date.now()
    ) {
      console.log(
        `Existing 3-day grace period remains active until ${existingGraceUntil}.`,
      );

      /*
       * Keep the existing deadline.
       * Do NOT move it forward.
       */
      await syncSubscription(
        subscription,
        existingGraceUntil,
      );

      return;
    }

    /*
     * Existing deadline has already passed.
     * Cancel immediately.
     */
    console.warn(
      `Existing grace period expired for ${subscription.id}. Canceling subscription.`,
    );

    const canceled =
      await stripe.subscriptions.cancel(
        subscription.id,
      );

    await syncSubscription(
      canceled,
      null,
    );

    return;
  }

  /*
   * Stripe's subscription current period end
   * represents the scheduled end of the current
   * billing period.
   *
   * The grace deadline is exactly 3 days after
   * that billing boundary.
   */
  const scheduledBillingAt =
    subscription.current_period_end;

  const nowEpoch =
    Math.floor(
      Date.now() / 1000,
    );

  const graceUntilEpoch =
    scheduledBillingAt +
    GRACE_PERIOD_SECONDS;

  if (
    graceUntilEpoch <=
    nowEpoch
  ) {
    console.warn(
      `Subscription ${subscription.id} is already beyond the 3-day grace deadline. Canceling immediately.`,
    );

    const canceled =
      await stripe.subscriptions.cancel(
        subscription.id,
      );

    await syncSubscription(
      canceled,
      null,
    );

    return;
  }

  const graceUntil =
    new Date(
      graceUntilEpoch * 1000,
    ).toISOString();

  /*
   * Ask Stripe to cancel automatically
   * at the exact grace deadline.
   */
  const scheduledCancellation =
    await stripe.subscriptions.update(
      subscription.id,
      {
        cancel_at:
          graceUntilEpoch,
      },
    );

  await syncSubscription(
    scheduledCancellation,
    graceUntil,
  );

  console.log(
    `Payment failed for ${subscription.id}. Grace period established until ${graceUntil}.`,
  );
}

async function handleInvoiceEvent(
  event: Stripe.Event,
): Promise<void> {
  const object =
    event.data.object as Stripe.Invoice;

  const subscriptionId =
    typeof object.subscription ===
    "string"
      ? object.subscription
      : object.subscription?.id ??
        null;

  if (!subscriptionId) {
    console.log(
      `Invoice event ${event.id} has no subscription; ignoring.`,
    );

    return;
  }

  const subscription =
    await stripe.subscriptions.retrieve(
      subscriptionId,
    );

  if (
    event.type ===
    "invoice.payment_failed"
  ) {
    await establishPaymentGracePeriod(
      subscription,
    );

    return;
  }

  if (
    event.type ===
    "invoice.paid"
  ) {
    /*
     * Successful payment completely clears
     * the payment grace state.
     *
     * If Stripe has a scheduled cancellation,
     * remove it.
     */
    let currentSubscription =
      subscription;

    if (
      subscription.cancel_at
    ) {
      currentSubscription =
        await stripe.subscriptions.update(
          subscriptionId,
          {
            cancel_at: null,
          },
        );
    }

    await syncSubscription(
      currentSubscription,
      null,
    );

    console.log(
      `Successful payment for ${subscriptionId}. Grace period cleared.`,
    );

    return;
  }

  await syncSubscription(
    subscription,
    null,
  );
}

Deno.serve(async (req) => {
  if (
    req.method ===
    "OPTIONS"
  ) {
    return new Response(
      "ok",
      {
        headers:
          corsHeaders,
      },
    );
  }

  if (
    req.method !==
    "POST"
  ) {
    return jsonResponse(
      {
        error:
          "Method not allowed",
      },
      405,
    );
  }

  const signature =
    req.headers.get(
      "stripe-signature",
    );

  if (!signature) {
    return jsonResponse(
      {
        error:
          "Missing Stripe signature",
      },
      400,
    );
  }

  const body =
    await req.text();

  let event: Stripe.Event;

  try {
    event =
      await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret,
      );
  } catch (error) {
    console.error(
      "Stripe signature verification failed:",
      error,
    );

    return jsonResponse(
      {
        error:
          "Invalid Stripe signature",
      },
      400,
    );
  }

  console.log(
    `Received Stripe event ${event.id} (${event.type})`,
  );

  try {
    const shouldProcess =
      await claimWebhookEvent(
        event,
      );

    if (!shouldProcess) {
      console.log(
        `Webhook event ${event.id} already processed; returning 200.`,
      );

      return jsonResponse({
        received: true,
        duplicate: true,
      });
    }

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed": {
        const subscriptionId =
          getSubscriptionIdFromEvent(
            event,
          );

        if (!subscriptionId) {
          throw new Error(
            `Unable to determine subscription ID for ${event.type}`,
          );
        }

        await handleSubscriptionEvent(
          event,
          subscriptionId,
        );

        break;
      }

      case "invoice.paid":
      case "invoice.payment_failed":
      case "invoice.finalization_failed": {
        await handleInvoiceEvent(
          event,
        );

        break;
      }

      default:
        console.log(
          `Unhandled Stripe event type: ${event.type}`,
        );
    }

    await markWebhookEvent(
      event.id,
      "succeeded",
    );

    return jsonResponse({
      received: true,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      `Stripe webhook ${event.id} failed:`,
      message,
    );

    await markWebhookEvent(
      event.id,
      "failed",
      message,
    );

    return jsonResponse(
      {
        error:
          "Webhook processing failed",
      },
      500,
    );
  }
});
