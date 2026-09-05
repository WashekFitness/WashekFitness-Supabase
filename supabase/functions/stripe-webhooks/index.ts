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

/*
 * ============================================================
 * SUBSCRIPTION ENTITLEMENT
 * ============================================================
 *
 * A failed payment does NOT immediately remove access.
 *
 * Users receive a 3-day payment grace period.
 *
 * During that period Stripe may report:
 *
 *   active
 *   trialing
 *   past_due
 *   unpaid
 *
 * All four remain entitled.
 *
 * Stripe is separately instructed to cancel the subscription
 * at the end of the 3-day grace period if payment has not
 * been recovered.
 *
 * Once Stripe actually cancels the subscription, the
 * customer.subscription.deleted event changes the profile
 * back to free.
 */

const ENTITLED_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
]);

/*
 * ============================================================
 * PAYMENT GRACE PERIOD
 * ============================================================
 *
 * Exactly 3 days.
 */

const PAYMENT_GRACE_PERIOD_SECONDS =
  3 * 24 * 60 * 60;

/*
 * Metadata keys used to identify cancellations created by
 * this payment-grace mechanism.
 *
 * This prevents us from accidentally removing a cancellation
 * that was created for another reason.
 */

const GRACE_METADATA_KEY =
  "washek_grace_period";

const GRACE_METADATA_STARTED_KEY =
  "washek_grace_started_at";

/*
 * ============================================================
 * STRIPE PRICE -> WASHEK PLAN
 * ============================================================
 */

const PLAN_BY_PRICE_ID: Record<string, string> = {
  "price_1TTYrbRuQpZftYKRoSyLbQ0c":
    "progress",

  "price_1TTYs8RuQpZftYKR8ZzpNg7x":
    "performance",

  "price_1TTYsWRuQpZftYKRKIm8V10E":
    "elite",
};

/*
 * ============================================================
 * RESPONSE HELPER
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
        "Content-Type":
          "application/json",
      },
    },
  );
}

/*
 * ============================================================
 * GET SUBSCRIPTION ID FROM EVENT
 * ============================================================
 */

function getSubscriptionIdFromEvent(
  event: Stripe.Event,
): string | null {
  const object =
    event.data.object as Record<
      string,
      unknown
    >;

  if (
    typeof object.subscription ===
    "string"
  ) {
    return object.subscription;
  }

  if (
    object.subscription &&
    typeof object.subscription ===
      "object" &&
    "id" in object.subscription &&
    typeof object.subscription.id ===
      "string"
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

/*
 * ============================================================
 * GET USER ID FROM SUBSCRIPTION
 * ============================================================
 */

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

/*
 * ============================================================
 * GET WASHEK PLAN FROM SUBSCRIPTION
 * ============================================================
 */

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

  return (
    PLAN_BY_PRICE_ID[priceId] ??
    null
  );
}

/*
 * ============================================================
 * CLAIM WEBHOOK EVENT
 * ============================================================
 *
 * Prevents duplicate Stripe webhook processing.
 */

async function claimWebhookEvent(
  event: Stripe.Event,
): Promise<boolean> {
  const { data, error } =
    await supabase.rpc(
      "claim_stripe_webhook_event",
      {
        p_event_id: event.id,
        p_event_type: event.type,
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
 * CLAIM ORDERED SUBSCRIPTION EVENT
 * ============================================================
 *
 * Stripe can deliver events out of order.
 *
 * This database RPC serializes subscription events so stale
 * events cannot overwrite newer subscription state.
 */

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
        p_event_created:
          event.created,
        p_subscription_id:
          subscriptionId,
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
 * MARK WEBHOOK EVENT
 * ============================================================
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
      .from(
        "stripe_webhook_events",
      )
      .update({
        status,
        processed_at:
          new Date().toISOString(),
        error_message:
          errorMessage ??
          null,
      })
      .eq(
        "event_id",
        eventId,
      );

  if (error) {
    console.error(
      "Failed to update webhook event status:",
      error,
    );
  }
}

/*
 * ============================================================
 * SYNC SUBSCRIPTION TO PROFILE
 * ============================================================
 *
 * This is the authoritative profile synchronization.
 *
 * During the 3-day payment grace period:
 *
 *   past_due -> retain paid plan
 *   unpaid   -> retain paid plan
 *
 * After Stripe actually cancels:
 *
 *   canceled -> free
 */

async function syncSubscription(
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

  const plan =
    getPlanFromSubscription(
      subscription,
    );

  if (!plan) {
    throw new Error(
      `Unable to determine Washek Fitness plan for subscription ${subscription.id}`,
    );
  }

  const isEntitled =
    ENTITLED_STATUSES.has(
      subscription.status,
    );

  const update = {
    subscription_plan:
      isEntitled
        ? plan
        : "free",

    subscription_status:
      subscription.status,

    stripe_subscription_id:
      subscription.id,

    stripe_price_id:
      subscription.items.data[0]
        ?.price?.id ??
      null,
  };

  const { error } =
    await supabase
      .from("profiles")
      .update(update)
      .eq(
        "id",
        userId,
      );

  if (error) {
    throw new Error(
      `Failed to update profile ${userId}: ${error.message}`,
    );
  }
}

/*
 * ============================================================
 * SCHEDULE 3-DAY PAYMENT GRACE CANCELLATION
 * ============================================================
 *
 * Called after an invoice.payment_failed event.
 *
 * The grace period is measured from invoice.created, which is
 * the scheduled billing/invoice creation time.
 *
 * Example:
 *
 * Billing time:
 * September 5, 12:00 PM
 *
 * Grace expires:
 * September 8, 12:00 PM
 *
 * If payment is recovered before then, invoice.paid clears
 * the scheduled cancellation.
 *
 * If payment is not recovered, Stripe automatically cancels
 * the subscription at the deadline.
 */

async function schedulePaymentGraceCancellation(
  subscriptionId: string,
  scheduledBillingTimestamp: number,
): Promise<void> {
  const subscription =
    await stripe.subscriptions.retrieve(
      subscriptionId,
    );

  /*
   * Already canceled.
   */

  if (
    subscription.status ===
    "canceled"
  ) {
    return;
  }

  /*
   * A user-requested cancellation in this application uses
   * cancel_at_period_end.
   *
   * Do not interfere with it.
   */

  if (
    subscription.cancel_at_period_end
  ) {
    return;
  }

  /*
   * If a grace cancellation is already scheduled, don't
   * replace it.
   */

  if (
    subscription.cancel_at
  ) {
    return;
  }

  /*
   * Calculate the exact grace-period deadline.
   */

  const graceDeadline =
    scheduledBillingTimestamp +
    PAYMENT_GRACE_PERIOD_SECONDS;

  const now =
    Math.floor(
      Date.now() / 1000,
    );

  /*
   * If Stripe tells us about the failed payment after the
   * three-day window has already elapsed, cancel immediately.
   */

  if (
    graceDeadline <= now
  ) {
    console.warn(
      `Subscription ${subscriptionId} has already exceeded the 3-day payment grace period; canceling it now.`,
    );

    await stripe.subscriptions.cancel(
      subscriptionId,
    );

    return;
  }

  /*
   * Preserve existing Stripe metadata while marking this
   * cancellation as ours.
   */

  const metadata = {
    ...subscription.metadata,

    [GRACE_METADATA_KEY]:
      "true",

    [GRACE_METADATA_STARTED_KEY]:
      String(
        scheduledBillingTimestamp,
      ),
  };

  /*
   * Tell Stripe to automatically cancel the subscription
   * exactly three days after the scheduled billing time.
   */

  await stripe.subscriptions.update(
    subscriptionId,
    {
      cancel_at:
        graceDeadline,

      metadata,
    },
  );

  console.log(
    `Scheduled subscription ${subscriptionId} to cancel at ${new Date(
      graceDeadline * 1000,
    ).toISOString()} after the 3-day payment grace period.`,
  );
}

/*
 * ============================================================
 * CLEAR PAYMENT GRACE CANCELLATION
 * ============================================================
 *
 * Called after invoice.paid.
 *
 * If the customer successfully pays within the grace period,
 * remove the cancellation that THIS mechanism created.
 *
 * We deliberately do not remove arbitrary cancellations.
 */

async function clearPaymentGraceCancellation(
  subscriptionId: string,
): Promise<void> {
  const subscription =
    await stripe.subscriptions.retrieve(
      subscriptionId,
    );

  if (
    subscription.status ===
    "canceled"
  ) {
    return;
  }

  /*
   * Only clear cancellations created by this payment-grace
   * mechanism.
   */

  if (
    subscription.metadata?.[
      GRACE_METADATA_KEY
    ] !== "true"
  ) {
    return;
  }

  /*
   * Never interfere with a user-requested
   * cancel_at_period_end cancellation.
   */

  if (
    subscription.cancel_at_period_end
  ) {
    return;
  }

  const metadata = {
    ...subscription.metadata,

    [GRACE_METADATA_KEY]:
      "",

    [GRACE_METADATA_STARTED_KEY]:
      "",
  };

  /*
   * Remove the automatic grace-period cancellation.
   */

  await stripe.subscriptions.update(
    subscriptionId,
    {
      cancel_at:
        null,

      metadata,
    },
  );

  console.log(
    `Cleared the payment-grace cancellation for subscription ${subscriptionId} after successful payment.`,
  );
}

/*
 * ============================================================
 * HANDLE SUBSCRIPTION EVENT
 * ============================================================
 *
 * Always fetch the current subscription directly from Stripe
 * rather than trusting the potentially stale webhook snapshot.
 */

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
   *
   * We therefore:
   *
   *   1. Serialize events for this subscription.
   *   2. Reject events older than the newest processed event.
   *   3. Fetch the current subscription from Stripe.
   *   4. Sync that current state into Supabase.
   */

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

/*
 * ============================================================
 * HANDLE INVOICE EVENT
 * ============================================================
 *
 * invoice.payment_failed:
 *
 *   - Keep access during grace period.
 *   - Schedule automatic cancellation 3 days after billing time.
 *
 * invoice.paid:
 *
 *   - Keep access.
 *   - Remove any grace-period cancellation.
 */

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

  /*
   * First synchronize the current Stripe subscription state.
   */

  await handleSubscriptionEvent(
    event,
    subscriptionId,
  );

  /*
   * PAYMENT FAILED
   *
   * Schedule the 3-day grace-period cancellation.
   */

  if (
    event.type ===
    "invoice.payment_failed"
  ) {
    await schedulePaymentGraceCancellation(
      subscriptionId,
      object.created,
    );

    return;
  }

  /*
   * PAYMENT RECOVERED
   *
   * Remove the grace-period cancellation.
   */

  if (
    event.type ===
    "invoice.paid"
  ) {
    await clearPaymentGraceCancellation(
      subscriptionId,
    );
  }
}

/*
 * ============================================================
 * STRIPE WEBHOOK SERVER
 * ============================================================
 */

Deno.serve(
  async (req) => {
    /*
     * CORS preflight.
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

    /*
     * Only Stripe POST requests are allowed.
     */

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

    /*
     * Stripe signature is mandatory.
     */

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
     * Read the raw request body.
     *
     * Stripe signature verification MUST use the raw body.
     */

    const body =
      await req.text();

    let event: Stripe.Event;

    /*
     * Verify Stripe signature.
     */

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
      /*
       * Global webhook idempotency.
       */

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

      /*
       * ======================================================
       * SUBSCRIPTION EVENTS
       * ======================================================
       */

      switch (
        event.type
      ) {
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
         * INVOICE EVENTS
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

        /*
         * ====================================================
         * EVERYTHING ELSE
         * ====================================================
         */

        default:
          console.log(
            `Unhandled Stripe event type: ${event.type}`,
          );
      }

      /*
       * Mark successful processing.
       */

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

      /*
       * Mark the event failed so the failure is visible and
       * Stripe can retry the webhook.
       */

      await markWebhookEvent(
        event.id,
        "failed",
        message,
      );

      /*
       * Return non-2xx so Stripe knows processing failed.
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
