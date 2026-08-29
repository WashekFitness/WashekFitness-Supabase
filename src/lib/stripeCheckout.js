import { supabase } from '@/lib/supabase';

const CHECKOUT_FUNCTION =
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
   * Make sure we have a valid logged-in session.
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

  if (
    !sessionData?.session?.access_token
  ) {
    throw new Error(
      'You must be signed in before upgrading.'
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
      CHECKOUT_FUNCTION,
      {
        body: {
          plan,
        },
      }
    );

  console.log(
    '[Washek Stripe] Edge Function response:',
    data
  );

  console.log(
    '[Washek Stripe] Edge Function error:',
    error
  );

  /*
   * Transport/function failure.
   */
  if (
    error
  ) {
    throw new Error(
      error.message ||
        'Unable to contact the Stripe checkout service.'
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
   * Backend reported an application error.
   */
  if (
    data.success ===
    false
  ) {
    throw new Error(
      data.error ||
        'Stripe checkout could not be created.'
    );
  }

  /*
   * THIS IS THE IMPORTANT FIX.
   *
   * We only care whether the backend gave us
   * a valid URL. We no longer require an "action"
   * property that the current backend doesn't return.
   */

  if (
    typeof data.url ===
      'string' &&
    data.url.trim().length >
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
        plan,
    };
  }

  /*
   * There was a successful response, but no
   * Stripe Checkout URL.
   */
  throw new Error(
    data.error ||
      'Stripe did not return a Checkout URL.'
  );
}
