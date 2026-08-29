import { supabase } from '@/lib/supabase';

const CHECKOUT_FUNCTION =
  import.meta.env.VITE_SUPABASE_CHECKOUT_FUNCTION ||
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
   * Make sure the user has a current session.
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
    !sessionData?.session
      ?.access_token
  ) {
    throw new Error(
      'You must be signed in before upgrading.'
    );
  }

  /*
   * Call the Supabase Edge Function.
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

  /*
   * Supabase function invocation errors.
   */
  if (
    error
  ) {
    console.error(
      'Checkout function invocation failed:',
      error
    );

    throw new Error(
      error.message ||
        'The checkout service could not be reached.'
    );
  }

  /*
   * Backend explicitly reported failure.
   */
  if (
    data?.success ===
    false
  ) {
    throw new Error(
      data.error ||
        'The checkout service rejected the request.'
    );
  }

  /*
   * Normal new-subscription flow.
   */
  if (
    data?.success &&
    data?.action ===
      'checkout' &&
    data?.url
  ) {
    return data;
  }

  /*
   * Existing subscription changed directly.
   */
  if (
    data?.success &&
    data?.action ===
      'changed'
  ) {
    return data;
  }

  /*
   * Defensive fallback.
   */
  if (
    data?.url
  ) {
    return {
      ...data,

      success:
        true,

      action:
        'checkout',
    };
  }

  throw new Error(
    'The checkout service did not return a Stripe Checkout URL.'
  );
}
