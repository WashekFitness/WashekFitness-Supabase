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

const supabase = createClient(supabaseUrl, serviceRoleKey);

const PAID_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
]);

const PLAN_BY_PRICE_ID: Record<string, string> = {
  "price_1TTYrbRuQpZftYKRoSyLbQ0c": "progress",
  "price_1TTYs8RuQpZftYKR8ZzpNg7x": "performance",
  "price_1TTYsWRuQpZftYKRKIm8V10E": "elite",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getSubscriptionIdFromEvent(event: Stripe.Event): string | null {
  const object = event.data.object as Record<string, unknown>;

  if (typeof object.subscription === "string") {
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
    event.type.startsWith("customer.subscription.")
  ) {
    return object.id;
  }

  return null;
}

function getUserIdFromSubscription(
  subscription: Stripe.Subscription,
): string | null {
  const metadataUserId = subscription.metadata?.user_id;

  if (metadataUserId && typeof metadataUserId === "string") {
    return metadataUserId;
  }

  return null;
}

function getPlanFromSubscription(
  subscription: Stripe.Subscription,
): string | null {
  const metadataPlan = subscription.metadata?.plan;

  if (
    metadataPlan === "progress" ||
    metadataPlan === "performance" ||
    metadataPlan === "elite"
  ) {
    return metadataPlan;
  }

  const priceId = subscription.items.data[0]?.price?.id;

  if (!priceId) {
    return null;
  }

  return PLAN_BY_PRICE_ID[priceId] ?? null;
}

async function claimWebhookEvent(event: Stripe.Event): Promise<boolean> {
  const { data, error } = await supabase.rpc(
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
  const { data, error } = await supabase.rpc(
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
  const { error } = await supabase
    .from("stripe_webhook_events")
    .update({
      status,
      processed_at: new Date().toISOString(),
      error_message: errorMessage ?? null,
    })
    .eq("event_id", eventId);

  if (error) {
    console.error(
      "Failed to update webhook event status:",
      error,
    );
  }
}

async function syncSubscription(
  subscription: Stripe.Subscription,
): Promise<void> {
  const userId = getUserIdFromSubscription(subscription);

  if (!userId) {
    throw new Error(
      `Subscription ${subscription.id} is missing metadata.user_id`,
    );
  }

  const plan = getPlanFromSubscription(subscription);

  if (!plan) {
    throw new Error(
      `Unable to determine Washek Fitness plan for subscription ${subscription.id}`,
    );
  }

  const isEntitled = PAID_STATUSES.has(subscription.status);

  const update = {
    subscription_plan: isEntitled ? plan : "free",
    subscription_status: subscription.status,
    stripe_subscription_id: subscription.id,
    stripe_price_id:
      subscription.items.data[0]?.price?.id ?? null,
  };

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", userId);

  if (error) {
    throw new Error(
      `Failed to update profile ${userId}: ${error.message}`,
    );
  }
}

async function handleSubscriptionEvent(
  event: Stripe.Event,
  subscriptionId: string,
): Promise<void> {
  /*
   * IMPORTANT:
   *
   * Do not trust the subscription snapshot inside the webhook
   * as the final source of truth.
   *
   * Stripe explicitly does not guarantee webhook delivery order.
   * We therefore:
   *
   *   1. Serialize events for this subscription.
   *   2. Reject events older than the newest processed event.
   *   3. Fetch the current subscription from Stripe.
   *   4. Sync that current state into Supabase.
   */

  const shouldProcess = await claimOrderedSubscriptionEvent(
    event,
    subscriptionId,
  );

  if (!shouldProcess) {
    console.log(
      `Ignoring stale/duplicate subscription event ${event.id}`,
    );
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(
    subscriptionId,
  );

  await syncSubscription(subscription);
}

async function handleInvoiceEvent(
  event: Stripe.Event,
): Promise<void> {
  const object = event.data.object as Stripe.Invoice;

  const subscriptionId =
    typeof object.subscription === "string"
      ? object.subscription
      : object.subscription?.id ?? null;

  if (!subscriptionId) {
    console.log(
      `Invoice event ${event.id} has no subscription; ignoring.`,
    );
    return;
  }

  await handleSubscriptionEvent(event, subscriptionId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed" },
      405,
    );
  }

  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return jsonResponse(
      { error: "Missing Stripe signature" },
      400,
    );
  }

  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
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
      { error: "Invalid Stripe signature" },
      400,
    );
  }

  console.log(
    `Received Stripe event ${event.id} (${event.type})`,
  );

  try {
    const shouldProcess = await claimWebhookEvent(event);

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
          getSubscriptionIdFromEvent(event);

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
        await handleInvoiceEvent(event);
        break;
      }

      default:
        console.log(
          `Unhandled Stripe event type: ${event.type}`,
        );
    }

    await markWebhookEvent(event.id, "succeeded");

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

    /*
     * Return a non-2xx response so Stripe knows the event
     * was not successfully processed and can retry it.
     */
    return jsonResponse(
      {
        error: "Webhook processing failed",
      },
      500,
    );
  }
});
