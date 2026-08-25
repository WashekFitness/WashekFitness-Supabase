import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
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
          'application/json',
      },
    }
  );
}

function getSupabaseKey() {
  const publishableKeysRaw =
    Deno.env.get(
      'SUPABASE_PUBLISHABLE_KEYS'
    );

  if (publishableKeysRaw) {
    try {
      const keys =
        JSON.parse(publishableKeysRaw);

      if (keys?.default) {
        return keys.default;
      }
    } catch {
      // Fall through to legacy anon key.
    }
  }

  return (
    Deno.env.get(
      'SUPABASE_ANON_KEY'
    ) || ''
  );
}

function cleanString(
  value: unknown
) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function isValidEmail(
  email: string
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    const authHeader =
      req.headers.get(
        'Authorization'
      );

    if (!authHeader) {
      return json(
        {
          success: false,
          error:
            'Missing authorization header.',
        },
        401
      );
    }

    const supabaseUrl =
      Deno.env.get(
        'SUPABASE_URL'
      );

    const supabaseKey =
      getSupabaseKey();

    if (!supabaseUrl || !supabaseKey) {
      return json(
        {
          success: false,
          error:
            'Supabase authentication is not configured.',
        },
        500
      );
    }

    const supabase =
      createClient(
        supabaseUrl,
        supabaseKey,
        {
          global: {
            headers: {
              Authorization:
                authHeader,
            },
          },
        }
      );

    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();

    if (
      authError ||
      !authData?.user
    ) {
      return json(
        {
          success: false,
          error: 'Not authenticated.',
        },
        401
      );
    }

    let body: Record<
      string,
      unknown
    > = {};

    try {
      body = await req.json();
    } catch {
      return json(
        {
          success: false,
          error:
            'Invalid JSON request body.',
        },
        400
      );
    }

    const name = cleanString(
      body.name
    );

    const email = cleanString(
      body.email
    );

    const message = cleanString(
      body.message
    );

    if (!name || !email || !message) {
      return json(
        {
          success: false,
          error:
            'Name, email, and message are required.',
        },
        400
      );
    }

    if (!isValidEmail(email)) {
      return json(
        {
          success: false,
          error:
            'Please provide a valid email address.',
        },
        400
      );
    }

    /*
     * Save the contact message first.
     *
     * This means the message isn't lost even if Resend is temporarily
     * unavailable or has not been configured yet.
     */
    const serviceRole =
      Deno.env.get(
        'SUPABASE_SERVICE_ROLE_KEY'
      );

    if (serviceRole) {
      const admin =
        createClient(
          supabaseUrl,
          serviceRole
        );

      const {
        error: insertError,
      } = await admin
        .from('contact_messages')
        .insert({
          user_id:
            authData.user.id,
          name,
          email,
          message,
        });

      if (insertError) {
        console.error(
          '[CONTACT] Could not save message:',
          insertError
        );
      }
    } else {
      const {
        error: insertError,
      } = await supabase
        .from('contact_messages')
        .insert({
          user_id:
            authData.user.id,
          name,
          email,
          message,
        });

      if (insertError) {
        console.error(
          '[CONTACT] Could not save message:',
          insertError
        );
      }
    }

    /*
     * Email notification.
     */
    const resendKey =
      Deno.env.get(
        'RESEND_API_KEY'
      );

    const to =
      Deno.env.get(
        'CONTACT_TO_EMAIL'
      ) ||
      'washekfitness@gmail.com';

    /*
     * No Resend key is not a frontend failure.
     * The message was successfully accepted and stored.
     */
    if (!resendKey) {
      console.warn(
        '[CONTACT] RESEND_API_KEY is not configured. Message was saved but no email was sent.'
      );

      return json({
        success: true,
        queued: true,
        message:
          'Message saved successfully. Email notifications are not configured yet.',
      });
    }

    const from =
      Deno.env.get(
        'CONTACT_FROM_EMAIL'
      ) ||
      'Washek Fitness <onboarding@resend.dev>';

    const resendResponse =
      await fetch(
        'https://api.resend.com/emails',
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${resendKey}`,
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            from,

            to: [to],

            reply_to: email,

            subject:
              `New message from ${name}`,

            text:
              `Name: ${name}\n` +
              `Email: ${email}\n\n` +
              `Message:\n${message}`,
          }),
        }
      );

    const resendResult =
      await resendResponse
        .json()
        .catch(() => ({}));

    if (!resendResponse.ok) {
      console.error(
        '[CONTACT] Resend rejected email:',
        {
          status:
            resendResponse.status,
          result:
            resendResult,
        }
      );

      return json(
        {
          success: false,
          error:
            resendResult?.message ||
            resendResult?.error ||
            `Email provider rejected the message (${resendResponse.status}).`,
        },
        502
      );
    }

    return json({
      success: true,
      queued: false,
      id: resendResult?.id || null,
    });
  } catch (error) {
    console.error(
      '[CONTACT] Edge function error:',
      error
    );

    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to send message.',
      },
      500
    );
  }
});
