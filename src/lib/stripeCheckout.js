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

  const token =
    sessionData?.session
      ?.access_token;

  if (!token) {
    throw new Error(
      'You must be signed in before changing your subscription.'
    );
  }

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

  if (error) {
    console.error(
      'Checkout Edge Function error:',
      error
    );

    throw new Error(
      error.message ||
        'Unable to contact the subscription service.'
    );
  }

  if (
    !data
  ) {
    throw new Error(
      'The subscription service returned no response.'
    );
  }

  if (
    data.success ===
    false
  ) {
    throw new Error(
      data.error ||
        'Unable to change your subscription.'
    );
  }

  if (
    data.action ===
    'checkout'
  ) {
    if (!data.url) {
      throw new Error(
        'Stripe did not return a checkout URL.'
      );
    }

    return data;
  }

  if (
    data.action ===
    'changed'
  ) {
    return data;
  }

  throw new Error(
    'The subscription service returned an invalid response.'
  );
}
