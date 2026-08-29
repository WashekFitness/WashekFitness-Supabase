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
      `Invalid subscription plan: ${plan}`
    );
  }

  /*
   * Confirm there is an authenticated session.
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
      'You are not currently signed in. Please sign in again.'
    );
  }

  /*
   * Call the existing Supabase Edge Function.
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

  /*
   * A Supabase invocation error means the function
   * itself could not be reached or returned a non-2xx
   * response.
   */
  if (
    error
  ) {
    console.error(
      '[STRIPE CHECKOUT] Supabase invocation error:',
      error
    );

    throw new Error(
      error.message ||
        'The Stripe checkout service could not be reached.'
    );
  }

  console.log(
    '[STRIPE CHECKOUT] Supabase response:',
    data
  );

  if (
    !data
  ) {
    throw new Error(
      'The checkout service returned no data.'
    );
  }

  /*
   * Our Edge Function intentionally returns
   * success:false for application errors while still
   * using a successful HTTP response.
   */
  if (
    data.success ===
    false
  ) {
    throw new Error(
      data.error ||
        'The checkout service rejected the request.'
    );
  }

  /*
   * Normal FREE -> PAID checkout.
   */
  if (
    data.success ===
      true &&
    data.action ===
      'checkout' &&
    typeof data.url ===
      'string' &&
    data.url.length >
      0
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
   * Existing subscription changed directly.
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
   * Defensive fallback in case the backend returns
   * a URL without the expected action field.
   */
  if (
    typeof data.url ===
      'string' &&
    data.url.length >
      0
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
    'Stripe did not return a valid Checkout URL.'
  );
}
