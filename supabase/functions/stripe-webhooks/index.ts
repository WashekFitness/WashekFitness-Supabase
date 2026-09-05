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

/*
 * ============================================================
 * WASHEK FITNESS PLAN CONFIGURATION
 * ============================================================
 */

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

/*
 * ============================================================
 * RESPONSE
 * ============================================================
 */

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

/*
 * ============================================================
 * STRIPE HELPERS
 * ============================================================
 */

function getSubscriptionIdFromEvent(
  event: Stripe.Event,
): string | null {
  const object =
    event.data.object as Record<string, unknown>;

  /*
   * Invoice events.
   */
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

  /*
   * Subscription events.
   */
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

function getUserIdFromMetadata(
  metadata:
    | Stripe.Metadata
    | Record<string, string>
    | null
    | undefined,
): string | null {
  if (!metadata) {
    return null;
  }

  const userId = metadata.user_id;

  if (
    typeof userId === "string" &&
    userId.trim()
  ) {
    return userId.trim();
  }

  return null;
}

function getPlanFromMetadata(
  metadata:
    | Stripe.Metadata
    | Record<string, string>
    | null
    | undefined,
): string | null {
  if (!metadata) {
    return null;
  }

  const plan = metadata.plan;

  if (
    plan === "progress" ||
    plan === "performance" ||
    plan === "elite"
  ) {
    return plan;
  }

  return null;
}

function getPlanFromPriceId(
  priceId: string | null | undefined,
): string | null {
  if (!priceId) {
    return null;
  }

  return PLAN_BY_PRICE_ID[priceId] ?? null;
}

function getPlanFromSubscription(
  subscription: Stripe.Subscription,
): string | null {
  /*
   * Metadata is the primary source of truth.
   */
  const metadataPlan =
    getPlanFromMetadata(
      subscription.metadata,
    );

  if (metadataPlan) {
    return metadataPlan;
  }

  /*
   * Price ID is the fallback.
   */
  const priceId =
    subscription.items.data[0]?.price?.id;

  return getPlanFromPriceId(priceId);
}

function getUserIdFromSubscription(
  subscription: Stripe.Subscription,
): string | null {
  return getUserIdFromMetadata(
    subscription.metadata,
  );
}

/*
 * ============================================================
 * PROFILE SYNC
 * ============================================================
 *
 * THIS is the important part.
 *
 * Stripe is the billing source of truth.
 * Supabase profiles receives the resulting subscription state.
 */

async function syncSubscriptionToProfile(
  subscription: Stripe.Subscription,
  explicitUserId?: string | null,
): Promise<void> {
  const userId =
    explicitUserId ||
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

  const priceId =
    subscription.items.data[0]?.price?.id ??
    null;

  const isEntitled =
    PAID_STATUSES.has(
      subscription.status,
    );

  const subscriptionPlan =
    isEntitled
      ? plan
      : "free";

  console.log(
    "[WASHEK SYNC] Updating profile:",
    JSON.stringify({
      userId,
      subscriptionId:
        subscription.id,
      status:
        subscription.status,
      plan:
        subscriptionPlan,
      priceId,
    }),
  );

  const { data, error } =
    await supabase
      .from("profiles")
      .update({
        subscription_plan:
          subscriptionPlan,

        subscription_status:
          subscription.status,

        stripe_subscription_id:
          subscription.id,

        stripe_price_id:
          priceId,

        stripe_customer_id:
          typeof subscription.customer ===
          "string"
            ? subscription.customer
            : subscription.customer?.id ??
              null,
      })
      .eq("id", userId)
      .select(
        "id, subscription_plan, subscription_status, stripe_subscription_id",
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to update profile ${userId}: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      `Profile ${userId} was not found while syncing Stripe subscription ${subscription.id}`,
    );
  }

  console.log(
    "[WASHEK SYNC] Profile successfully updated:",
    JSON.stringify(data),
  );
}

/*
 * ============================================================
 * CHECKOUT SESSION SYNC
 * ============================================================
 *
 * This is the critical new path.
 *
 * Stripe Checkout completing successfully now directly
 * retrieves the subscription and synchronizes the profile.
 *
 * We do NOT trust the browser's return page for entitlement.
 */

async function handleCheckoutCompleted(
  event: Stripe.Event,
): Promise<void> {
  const session =
    event.data.object as Stripe.Checkout.Session;

  console.log(
    "[WASHEK CHECKOUT] Checkout completed:",
    session.id,
  );

  /*
   * A subscription Checkout must have a subscription ID.
   */
  const subscriptionId =
    typeof session.subscription ===
    "string"
      ? session.subscription
      : session.subscription?.id ??
        null;

  if (!subscriptionId) {
    /*
     * One-time payment sessions are irrelevant to
     * subscription synchronization.
     */
    console.log(
      `[WASHEK CHECKOUT] Session ${session.id} has no subscription. Ignoring.`,
    );

    return;
  }

  /*
   * Get the user ID from Checkout metadata first.
   */
  const sessionUserId =
    getUserIdFromMetadata(
      session.metadata,
    );

  /*
   * Retrieve the actual current Stripe subscription.
   *
   * Stripe is the source of truth.
   */
  const subscription =
    await stripe.subscriptions.retrieve(
      subscriptionId,
    );

  /*
   * Prefer subscription metadata, then Checkout metadata.
   */
  const subscriptionUserId =
    getUserIdFromSubscription(
      subscription,
    );

  const userId =
    subscriptionUserId ||
    sessionUserId;

  if (!userId) {
    throw new Error(
      `Checkout session ${session.id} and subscription ${subscription.id} contain no metadata.user_id`,
    );
  }

  console.log(
    "[WASHEK CHECKOUT] Synchronizing subscription:",
    JSON.stringify({
      sessionId:
        session.id,
      subscriptionId:
        subscription.id,
      userId,
      status:
        subscription.status,
    }),
  );

  await syncSubscriptionToProfile(
    subscription,
    userId,
  );
}

/*
 * ============================================================
 * WEBHOOK IDEMPOTENCY
 * ============================================================
 */

async function claimWebhookEvent(
  event: Stripe.Event,
): Promise<boolean> {
  const { data, error } =
    await supabase.rpc(
      "claim_stripe_webhook_event",
      {
        p_event_id:
          event.id,

        p_event_type:
          event.type,

        p_event_created:
          event.created,
      },
    );

  if (error) {
    throw new Error(
      `Failed to claim webhook event: ${error.message}`,
    );
  }

  return data === true;
}

/*
 * ============================================================
 * SUBSCRIPTION EVENT ORDERING
 * ============================================================
 */

async function claimOrderedSubscriptionEvent(
  event: Stripe.Event,
  subscriptionId: string,
): Promise<boolean> {
  const { data, error } =
    await supabase.rpc(
      "claim_stripe_subscription_event",
      {
        p_event_id:
          event.id,

        p_event_type:
          event.type,

        p_subscription_id:
          subscriptionId,

        p_event_created:
          event.created,
      },
    );

  if (error) {
    throw new Error(
      `Failed to claim ordered subscription event: ${error.message}`,
    );
  }

  return data === true;
}

/*
 * ============================================================
 * WEBHOOK STATUS
 * ============================================================
 *
 * IMPORTANT:
 * The database column is last_error, NOT error_message.
 */

async function markWebhookEvent(
  eventId: string,
  status:
    | "succeeded"
    | "failed",
  errorMessage?: string,
): Promise<void> {
  const { error } =
    await supabase
      .from("stripe_webhook_events")
      .update({
        status,

        processed_at:
          new Date().toISOString(),

        last_error:
          errorMessage ?? null,
      })
      .eq(
        "event_id",
        eventId,
      );

  if (error) {
    console.error(
      "[WASHEK WEBHOOK] Failed to update webhook event status:",
      error,
    );
  }
}

/*
 * ============================================================
 * SUBSCRIPTION EVENT HANDLER
 * ============================================================
 */

async function handleSubscriptionEvent(
  event: Stripe.Event,
  subscriptionId: string,
): Promise<void> {
  /*
   * Serialize subscription events so older Stripe events
   * cannot overwrite newer states.
   */
  const shouldProcess =
    await claimOrderedSubscriptionEvent(
      event,
      subscriptionId,
    );

  if (!shouldProcess) {
    console.log(
      `[WASHEK WEBHOOK] Ignoring stale/duplicate subscription event ${event.id}`,
    );

    return;
  }

  /*
   * Always retrieve the current Stripe subscription.
   */
  const subscription =
    await stripe.subscriptions.retrieve(
      subscriptionId,
    );

  await syncSubscriptionToProfile(
    subscription,
  );
}

/*
 * ============================================================
 * INVOICE EVENT HANDLER
 * ============================================================
 */

async function handleInvoiceEvent(
  event: Stripe.Event,
): Promise<void> {
  const invoice =
    event.data.object as Stripe.Invoice;

  const subscriptionId =
    typeof invoice.subscription ===
    "string"
      ? invoice.subscription
      : invoice.subscription?.id ??
        null;

  if (!subscriptionId) {
    console.log(
      `[WASHEK INVOICE] Invoice event ${event.id} has no subscription.`,
    );

    return;
  }

  /*
   * A successful invoice can immediately restore access.
   * The subscription is retrieved from Stripe so the profile
   * receives the current authoritative state.
   */
  await handleSubscriptionEvent(
    event,
    subscriptionId,
  );
}

/*
 * ============================================================
 * MAIN WEBHOOK
 * ============================================================
 */

Deno.serve(
  async (req) => {
    /*
     * Stripe does not use Supabase JWT authentication.
     */

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

    /*
     * Stripe signature verification MUST use the raw body.
     */
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
    } catch (
      error
    ) {
      console.error(
        "[WASHEK WEBHOOK] Stripe signature verification failed:",
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
      `[WASHEK WEBHOOK] Received ${event.type} (${event.id})`,
    );

    try {
      /*
       * Prevent duplicate Stripe deliveries from being
       * processed twice.
       */
      const shouldProcess =
        await claimWebhookEvent(
          event,
        );

      if (!shouldProcess) {
        console.log(
          `[WASHEK WEBHOOK] Event ${event.id} already processed.`,
        );

        return jsonResponse({
          received:
            true,

          duplicate:
            true,
        });
      }

      /*
       * ======================================================
       * CHECKOUT COMPLETION
       * ======================================================
       *
       * THIS IS THE NEW PRIMARY INITIAL-SYNC PATH.
       */

      switch (
        event.type
      ) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded": {
          await handleCheckoutCompleted(
            event,
          );

          break;
        }

        /*
         * ====================================================
         * SUBSCRIPTION LIFECYCLE
         * ====================================================
         */

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

        /*
         * ====================================================
         * INVOICES
         * ====================================================
         */

        case "invoice.paid":
        case "invoice.payment_failed":
        case "invoice.finalization_failed": {
          await handleInvoiceEvent(
            event,
          );

          break;
        }

        default: {
          console.log(
            `[WASHEK WEBHOOK] Unhandled event type: ${event.type}`,
          );
        }
      }

      await markWebhookEvent(
        event.id,
        "succeeded",
      );

      console.log(
        `[WASHEK WEBHOOK] Successfully processed ${event.id}`,
      );

      return jsonResponse({
        received:
          true,
      });
    } catch (
      error
    ) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.error(
        `[WASHEK WEBHOOK] Event ${event.id} failed:`,
        message,
      );

      await markWebhookEvent(
        event.id,
        "failed",
        message,
      );

      /*
       * Non-2xx tells Stripe to retry the event.
       */
      return jsonResponse(
        {
          error:
            "Webhook processing failed",
        },
        500,
      );
    }
  },
);
