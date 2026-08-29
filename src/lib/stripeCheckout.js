import { supabase } from '@/lib/supabase';

const FUNCTION_NAME =
  'create-checkout-session';

const VALID_PLANS = [
  'progress',
  'performance',
  'elite',
];

export async function createStripeCheckout(
  plan
) {
  if (
    !VALID_PLANS.includes(
      plan
    )
  ) {
    throw new Error(
      'Invalid subscription plan.'
    );
  }

  /*
   * Make sure the browser has an authenticated
   * Supabase session.
   */
  const {
    data: sessionData,
    error: sessionError,
  } =
    await supabase.auth.getSession();

  if (
    sessionError
  ) {
    throw new Error(
      sessionError.message ||
        'Unable to verify your login session.'
    );
  }

  const session =
    sessionData?.session;

  if (
    !session?.access_token
  ) {
    throw new Error(
      'You must be signed in before upgrading.'
    );
  }

  /*
   * Call the existing Supabase Edge Function.
   *
   * supabase.functions.invoke() automatically includes
   * the current Supabase session credentials.
   */
  const {
    data,
    error,
  } =
    await supabase.functions.invoke(
      FUNCTION_NAME,
      {
        body: {
          plan,
        },
      }
    );

  console.log(
    '[Stripe Checkout] Edge Function data:',
    data
  );

  console.log(
    '[Stripe Checkout] Edge Function error:',
    error
  );

  /*
   * Supabase transport/function errors.
   */
  if (
    error
  ) {
    /*
     * Supabase can sometimes put the function response
     * body inside the error context. Try to surface it.
     */
    let message =
      error.message ||
      'The Stripe checkout service could not be reached.';

    try {
      const context =
        error.context;

      if (
        context &&
        typeof context.json ===
          'function'
      ) {
        const contextData =
          await context.json();

        if (
          contextData?.error
        ) {
          message =
            contextData.error;
        }
      }
    } catch {
      // Keep the normal error message.
    }

    throw new Error(
      message
    );
  }

  if (
    !data
  ) {
    throw new Error(
      'The Stripe checkout service returned no response.'
    );
  }

  /*
   * Backend explicitly reported an application error.
   */
  if (
    data.success ===
    false
  ) {
    throw new Error(
      data.error ||
        'The Stripe checkout service could not create a checkout session.'
    );
  }

  /*
   * Normal new-subscription checkout.
   */
  if (
    data.success ===
      true &&
    data.action ===
      'checkout' &&
    typeof data.url ===
      'string' &&
    data.url.trim()
  ) {
    return {
      success:
        true,

      action:
        'checkout',

      url:
        data.url,

      session_id:
        data.session_id ||
        null,

      plan:
        data.plan ||
        plan,

      product_id:
        data.product_id ||
        null,

      price_id:
        data.price_id ||
        null,
    };
  }

  /*
   * Existing paid subscription was changed directly.
   */
  if (
    data.success ===
      true &&
    data.action ===
      'changed'
  ) {
    return {
      success:
        true,

      action:
        'changed',

      plan:
        data.plan ||
        plan,

      subscription_id:
        data.subscription_id ||
        null,

      price_id:
        data.price_id ||
        null,
    };
  }

  /*
   * Defensive fallback.
   */
  if (
    typeof data.url ===
      'string' &&
    data.url.trim()
  ) {
    return {
      success:
        true,

      action:
        'checkout',

      url:
        data.url,

      session_id:
        data.session_id ||
        null,

      plan:
        data.plan ||
        plan,
    };
  }

  throw new Error(
    'Stripe returned a response, but no Checkout URL was provided.'
  );
}
