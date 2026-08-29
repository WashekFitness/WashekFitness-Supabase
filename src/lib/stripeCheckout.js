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
   * Confirm the user is actually logged in.
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

  const accessToken =
    sessionData?.session
      ?.access_token;

  if (
    !accessToken
  ) {
    throw new Error(
      'You must be signed in before upgrading.'
    );
  }

  /*
   * Ask Supabase to create the Stripe Checkout
   * session.
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

  if (
    error
  ) {
    console.error(
      'create-checkout-session invocation failed:',
      error
    );

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

  if (
    data.success ===
    false
  ) {
    throw new Error(
      data.error ||
        'Unable to create Stripe Checkout.'
    );
  }

  if (
    data.action ===
      'checkout' &&
    data.url
  ) {
    return data;
  }

  if (
    data.action ===
      'changed'
  ) {
    return data;
  }

  if (
    data.url
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
    'Stripe did not return a Checkout URL.'
  );
}
