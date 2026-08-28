import { supabase } from '@/lib/supabase';

const CHECKOUT_FUNCTION =
  import.meta.env.VITE_SUPABASE_CHECKOUT_FUNCTION ||
  'create-checkout-session';

const VALID_PLANS = [
  'progress',
  'performance',
  'elite',
];

export async function createStripeCheckout(plan) {
  if (!VALID_PLANS.includes(plan)) {
    throw new Error('Invalid subscription plan.');
  }

  const {
    data: sessionData,
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(
      sessionError.message ||
        'Unable to verify your login session.'
    );
  }

  const accessToken =
    sessionData?.session?.access_token;

  if (!accessToken) {
    throw new Error(
      'You must be signed in before changing your subscription.'
    );
  }

  const {
    data,
    error,
  } = await supabase.functions.invoke(
    CHECKOUT_FUNCTION,
    {
      body: {
        plan,
      },
    }
  );

  if (error) {
    console.error(
      'Supabase checkout function error:',
      error
    );

    throw new Error(
      error.message ||
        'Unable to start subscription checkout.'
    );
  }

  if (!data) {
    throw new Error(
      'No response was received from the subscription service.'
    );
  }

  if (!data.success) {
    throw new Error(
      data.error ||
        'Unable to change your subscription.'
    );
  }

  /*
   * When a free user purchases a plan,
   * Stripe gives us a Checkout URL.
   */
  if (data.action === 'checkout') {
    if (!data.url) {
      throw new Error(
        'Stripe did not return a checkout URL.'
      );
    }

    return {
      ...data,
      action: 'checkout',
      url: data.url,
    };
  }

  /*
   * When an existing paid user switches
   * plans, Stripe changes the subscription
   * directly and no checkout page is needed.
   */
  if (data.action === 'changed') {
    return {
      ...data,
      action: 'changed',
    };
  }

  throw new Error(
    'The subscription service returned an unexpected response.'
  );
}
