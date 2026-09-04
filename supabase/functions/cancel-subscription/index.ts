import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
  "Content-Type": "application/json",
};

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") || "";

const SERVICE_ROLE_KEY =
  Deno.env.get("SERVICE_ROLE_KEY") || "";

const SUPABASE_ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ||
  "";

const STRIPE_SECRET_KEY =
  Deno.env.get("STRIPE_SECRET_KEY") || "";

if (!SUPABASE_URL) {
  throw new Error(
    "Missing SUPABASE_URL"
  );
}

if (!SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing SERVICE_ROLE_KEY"
  );
}

if (!STRIPE_SECRET_KEY) {
  throw new Error(
    "Missing STRIPE_SECRET_KEY"
  );
}

const supabaseAdmin =
  createClient(
    SUPABASE_URL,
    SERVICE_ROLE_KEY,
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
      headers: corsHeaders,
    }
  );
}

async function getAuthenticatedUser(
  req: Request
) {
  const authorization =
    req.headers.get(
      "Authorization"
    );

  if (!authorization) {
    throw new Error(
      "Missing Authorization header."
    );
  }

  /*
   * Use the user's JWT to determine
   * who is requesting cancellation.
   *
   * Never trust a user_id supplied
   * in the request body.
   */
  const supabaseUser =
    createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization:
              authorization,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

  const {
    data,
    error,
  } =
    await supabaseUser.auth.getUser();

  if (
    error ||
    !data?.user
  ) {
    throw new Error(
      error?.message ||
        "Unable to authenticate user."
    );
  }

  return data.user;
}

async function stripeRequest(
  path: string,
  options: RequestInit = {}
) {
  const response =
    await fetch(
      `https://api.stripe.com/v1/${path}`,
      {
        ...options,
        headers: {
          Authorization:
            `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type":
            "application/x-www-form-urlencoded",
          ...(options.headers || {}),
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
        `Stripe returned HTTP ${response.status}.`
    );
  }

  return data;
}

async function getSubscription(
  subscriptionId: string
) {
  return stripeRequest(
    `subscriptions/${encodeURIComponent(
      subscriptionId
    )}`
  );
}

async function cancelSubscription(
  subscriptionId: string
) {
  /*
   * Cancel at the end of the current
   * billing period instead of immediately
   * removing the user's paid access.
   */
  return stripeRequest(
    `subscriptions/${encodeURIComponent(
      subscriptionId
    )}`,
    {
      method: "POST",
      body:
        new URLSearchParams({
          cancel_at_period_end:
            "true",
        }).toString(),
    }
  );
}

Deno.serve(
  async (req) => {
    if (
      req.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          status: 200,
          headers:
            corsHeaders,
        }
      );
    }

    if (
      req.method !==
      "POST"
    ) {
      return json(
        {
          success: false,
          error:
            "Method not allowed.",
        },
        405
      );
    }

    try {
      /*
       * ------------------------------------------------------
       * AUTHENTICATE
       * ------------------------------------------------------
       */

      const user =
        await getAuthenticatedUser(
          req
        );

      /*
       * ------------------------------------------------------
       * GET USER'S SUBSCRIPTION FROM SUPABASE
       * ------------------------------------------------------
       *
       * We identify the subscription using the authenticated
       * user's own profile. The client cannot substitute
       * another user's ID.
       */

      const {
        data: profile,
        error: profileError,
      } =
        await supabaseAdmin
          .from("profiles")
          .select(
            "id, email, stripe_subscription_id, subscription_plan, subscription_status"
          )
          .eq(
            "id",
            user.id
          )
          .maybeSingle();

      if (profileError) {
        throw new Error(
          `Unable to load your subscription information: ${profileError.message}`
        );
      }

      if (!profile) {
        throw new Error(
          "Your Washek Fitness profile could not be found."
        );
      }

      const subscriptionId =
        profile.stripe_subscription_id;

      if (
        !subscriptionId
      ) {
        return json({
          success: true,
          alreadyCanceled:
            false,
          message:
            "You do not currently have a Stripe subscription to cancel.",
        });
      }

      /*
       * ------------------------------------------------------
       * VERIFY THE STRIPE SUBSCRIPTION
       * ------------------------------------------------------
       *
       * This prevents us from blindly modifying an arbitrary
       * Stripe subscription ID stored in the profile.
       */

      const subscription =
        await getSubscription(
          subscriptionId
        );

      const metadataUserId =
        subscription
          ?.metadata
          ?.user_id;

      if (
        metadataUserId &&
        metadataUserId !==
          user.id
      ) {
        throw new Error(
          "This Stripe subscription does not belong to the authenticated account."
        );
      }

      /*
       * ------------------------------------------------------
       * ALREADY CANCELING
       * ------------------------------------------------------
       */

      if (
        subscription
          ?.cancel_at_period_end
      ) {
        return json({
          success: true,

          alreadyCanceled:
            true,

          cancel_at_period_end:
            true,

          current_period_end:
            subscription
              ?.current_period_end
              ? new Date(
                  subscription.current_period_end *
                    1000
                ).toISOString()
              : null,

          subscription_id:
            subscription.id,
        });
      }

      /*
       * ------------------------------------------------------
       * CANCEL AT PERIOD END
       * ------------------------------------------------------
       */

      const canceled =
        await cancelSubscription(
          subscriptionId
        );

      /*
       * ------------------------------------------------------
       * RETURN THE ACTUAL STRIPE STATE
       * ------------------------------------------------------
       *
       * The Stripe webhook remains responsible for
       * synchronizing the final subscription state back
       * into Supabase.
       */

      return json({
        success: true,

        canceled: true,

        cancel_at_period_end:
          Boolean(
            canceled
              ?.cancel_at_period_end
          ),

        current_period_end:
          canceled
            ?.current_period_end
            ? new Date(
                canceled.current_period_end *
                  1000
              ).toISOString()
            : null,

        subscription_id:
          canceled?.id ||
          subscriptionId,

        message:
          "Your subscription has been scheduled for cancellation at the end of the current billing period.",
      });
    } catch (error) {
      console.error(
        "[CANCEL SUBSCRIPTION] Error:",
        error
      );

      return json(
        {
          success: false,

          error:
            error instanceof
            Error
              ? error.message
              : "Unable to cancel your subscription.",
        },
        400
      );
    }
  }
);
