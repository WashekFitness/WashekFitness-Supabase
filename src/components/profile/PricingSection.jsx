import {
  createClient
} from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',

  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',

  'Access-Control-Allow-Methods':
    'POST, OPTIONS'
};


const PLAN_ORDER = {
  free: 0,
  progress: 1,
  performance: 2,
  elite: 3
};


const PLAN_PRICE_ENV = {
  progress:
    'STRIPE_PROGRESS_PRICE_ID',

  performance:
    'STRIPE_PERFORMANCE_PRICE_ID',

  elite:
    'STRIPE_ELITE_PRICE_ID'
};


function json(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,

      headers: {
        ...corsHeaders,

        'Content-Type':
          'application/json'
      }
    }
  );
}


async function requireUser(
  req: Request
) {
  const authHeader =
    req.headers.get(
      'Authorization'
    );

  if (!authHeader) {
    throw new Error(
      'Missing authorization header.'
    );
  }


  const url =
    Deno.env.get(
      'SUPABASE_URL'
    );

  const key =
    Deno.env.get(
      'SUPABASE_ANON_KEY'
    ) || '';


  if (!url || !key) {
    throw new Error(
      'Supabase authentication is not configured.'
    );
  }


  const client =
    createClient(
      url,
      key,
      {
        global: {
          headers: {
            Authorization:
              authHeader
          }
        }
      }
    );


  const {
    data,
    error
  } =
    await client.auth.getUser();


  if (
    error ||
    !data.user
  ) {
    throw new Error(
      'Not authenticated.'
    );
  }


  return data.user;
}


function getAdminClient() {
  const url =
    Deno.env.get(
      'SUPABASE_URL'
    ) || '';

  const key =
    Deno.env.get(
      'SUPABASE_SERVICE_ROLE_KEY'
    ) || '';


  if (!url || !key) {
    throw new Error(
      'Supabase server credentials are not configured.'
    );
  }


  return createClient(
    url,
    key,
    {
      auth: {
        persistSession:
          false,

        autoRefreshToken:
          false
      }
    }
  );
}


async function stripe(
  path: string,
  options: RequestInit = {}
) {
  const key =
    Deno.env.get(
      'STRIPE_SECRET_KEY'
    );


  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY is not configured.'
    );
  }


  const response =
    await fetch(
      `https://api.stripe.com/v1/${path}`,
      {
        ...options,

        headers: {
          Authorization:
            `Bearer ${key}`,

          'Content-Type':
            'application/x-www-form-urlencoded',

          ...(options.headers || {})
        }
      }
    );


  const data =
    await response
      .json()
      .catch(
        () => ({})
      );


  if (
    !response.ok
  ) {
    throw new Error(
      data?.error?.message ||
      'Stripe API request failed.'
    );
  }


  return data;
}


function formBody(
  values: Record<string, string>
) {
  const params =
    new URLSearchParams();


  for (
    const [
      key,
      value
    ]
      of Object.entries(
        values
      )
  ) {
    params.set(
      key,
      value
    );
  }


  return params.toString();
}


function priceToPlan(
  priceId: string | null
) {
  if (!priceId) {
    return null;
  }


  for (
    const [
      plan,
      envName
    ]
      of Object.entries(
        PLAN_PRICE_ENV
      )
  ) {
    const configured =
      Deno.env.get(
        envName
      );


    if (
      configured &&
      configured === priceId
    ) {
      return plan;
    }
  }


  return null;
}


Deno.serve(
  async (req) => {

    if (
      req.method ===
      'OPTIONS'
    ) {
      return new Response(
        'ok',
        {
          headers:
            corsHeaders
        }
      );
    }


    if (
      req.method !==
      'POST'
    ) {
      return json(
        {
          success:
            false,

          error:
            'Method not allowed.'
        },

        405
      );
    }


    try {

      const user =
        await requireUser(
          req
        );


      const admin =
        getAdminClient();


      const body =
        await req.json();


      const plan =
        String(
          body?.plan ||
          ''
        );


      if (
        ![
          'progress',
          'performance',
          'elite'
        ].includes(
          plan
        )
      ) {
        return json(
          {
            success:
              false,

            error:
              'Invalid subscription plan.'
          },

          400
        );
      }


      const priceId =
        Deno.env.get(
          PLAN_PRICE_ENV[
            plan
          ]
        );


      if (!priceId) {
        return json(
          {
            success:
              false,

            error:
              `${PLAN_PRICE_ENV[plan]} is not configured.`
          },

          503
        );
      }


      const {
        data:
          profile,
        error:
          profileError
      } =
        await admin
          .from(
            'profiles'
          )
          .select(
            [
              'id',
              'email',
              'subscription_plan',
              'subscription_status',
              'stripe_customer_id',
              'stripe_subscription_id'
            ].join(',')
          )
          .eq(
            'id',
            user.id
          )
          .maybeSingle();


      if (
        profileError
      ) {
        throw new Error(
          `Unable to load profile: ${profileError.message}`
        );
      }


      const currentPlan =
        profile?.subscription_plan ||
        'free';


      const currentRank =
        PLAN_ORDER[
          currentPlan
        ] ?? 0;


      const targetRank =
        PLAN_ORDER[
          plan
        ];


      /*
       * EXISTING PAID SUBSCRIBER
       *
       * Upgrade the existing Stripe subscription.
       *
       * Do NOT create a second subscription.
       */
      if (
        currentRank > 0 &&
        profile?.stripe_subscription_id
      ) {

        const subscription =
          await stripe(
            `subscriptions/${encodeURIComponent(
              profile.stripe_subscription_id
            )}`
          );


        if (
          ![
            'active',
            'trialing'
          ].includes(
            subscription?.status
          )
        ) {
          return json(
            {
              success:
                false,

              error:
                'Your current subscription needs attention before it can be upgraded.',

              error_code:
                'SUBSCRIPTION_NOT_UPGRADABLE'
            },

            409
          );
        }


        const currentPriceId =
          subscription
            ?.items
            ?.data?.[0]
            ?.price
            ?.id ||
          null;


        const actualCurrentPlan =
          priceToPlan(
            currentPriceId
          ) ||
          currentPlan;


        const actualCurrentRank =
          PLAN_ORDER[
            actualCurrentPlan
          ] ?? 0;


        if (
          actualCurrentRank ===
          targetRank
        ) {
          return json(
            {
              success:
                true,

              mode:
                'already_on_plan',

              plan
            }
          );
        }


        if (
          targetRank <
          actualCurrentRank
        ) {
          return json(
            {
              success:
                false,

              error:
                'Downgrades are handled through your billing controls.',

              error_code:
                'DOWNGRADE_NOT_SUPPORTED_HERE'
            },

            409
          );
        }


        const itemId =
          subscription
            ?.items
            ?.data?.[0]
            ?.id;


        if (!itemId) {
          throw new Error(
            'Stripe subscription has no subscription item.'
          );
        }


        const updated =
          await stripe(
            `subscriptions/${encodeURIComponent(
              subscription.id
            )}`,

            {
              method:
                'POST',

              body:
                formBody(
                  {
                    'items[0][id]':
                      itemId,

                    'items[0][price]':
                      priceId,

                    'items[0][quantity]':
                      '1',

                    proration_behavior:
                      'create_prorations',

                    'metadata[user_id]':
                      user.id,

                    'metadata[plan]':
                      plan
                  }
                )
            }
          );


        return json(
          {
            success:
              true,

            mode:
              'upgrade',

            plan,

            subscriptionId:
              updated.id,

            status:
              updated.status
          }
        );
      }


      /*
       * NEW SUBSCRIBER
       *
       * Create a Stripe Checkout Session.
       */
      const appUrl =
        (
          Deno.env.get(
            'APP_URL'
          ) ||
          'https://washekfitness.com'
        )
          .replace(
            /\/$/,
            ''
          );


      const values:
        Record<string, string> =
        {
          mode:
            'subscription',

          'line_items[0][price]':
            priceId,

          'line_items[0][quantity]':
            '1',

          /*
           * THIS is now the actual
           * Supabase user ID.
           */
          client_reference_id:
            user.id,

          /*
           * Put the user ID and plan
           * on the Checkout Session.
           */
          'metadata[user_id]':
            user.id,

          'metadata[plan]':
            plan,

          /*
           * Also put them on the
           * Stripe Subscription itself.
           */
          'subscription_data[metadata][user_id]':
            user.id,

          'subscription_data[metadata][plan]':
            plan,

          success_url:
            `${appUrl}/subscription-return?session_id={CHECKOUT_SESSION_ID}`,

          cancel_url:
            `${appUrl}/profile?checkout=cancelled`,

          billing_address_collection:
            'auto',

          allow_promotion_codes:
            'true'
        };


      if (
        profile?.stripe_customer_id
      ) {
        values.customer =
          profile.stripe_customer_id;

      } else {
        values.customer_email =
          profile?.email ||
          user.email ||
          '';
      }


      const session =
        await stripe(
          'checkout/sessions',

          {
            method:
              'POST',

            body:
              formBody(
                values
              )
          }
        );


      return json(
        {
          success:
            true,

          mode:
            'checkout',

          plan,

          sessionId:
            session.id,

          url:
            session.url
        }
      );

    } catch (error) {

      console.error(
        '[CHECKOUT]',
        error
      );


      return json(
        {
          success:
            false,

          error:
            error instanceof Error
              ? error.message
              : 'Unable to start checkout.'
        },

        500
      );
    }
  }
);
