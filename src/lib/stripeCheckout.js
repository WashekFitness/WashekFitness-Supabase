import { supabase } from '@/lib/supabase';

const CHECKOUT_FUNCTION =
  import.meta.env.VITE_SUPABASE_CHECKOUT_FUNCTION ||
  'create-checkout-session';

export async function createStripeCheckout(
  plan
) {
  if (
    ![
      'progress',
      'performance',
      'elite',
    ].includes(plan)
  ) {
    throw new Error(
      'Invalid subscription plan.'
    );
  }

  const {
    data: sessionData,
  } =
    await supabase.auth.getSession();

  const accessToken =
    sessionData?.session
      ?.access_token;

  if (!accessToken) {
    throw new Error(
      'You must be signed in before upgrading.'
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
    throw new Error(
      error.message ||
        'Unable to start Stripe checkout.'
    );
  }

  if (
    !data?.success ||
    !data?.url
  ) {
    throw new Error(
      data?.error ||
        'Stripe did not return a checkout URL.'
    );
  }

  return data;
}
