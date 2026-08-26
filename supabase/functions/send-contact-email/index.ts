```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return json(
      {
        success: false,
        error: 'Method not allowed.',
      },
      405
    );
  }

  try {
    const resendApiKey =
      Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      console.error(
        '[CONTACT EMAIL] RESEND_API_KEY is not configured.'
      );

      return json(
        {
          success: false,
          error:
            'Email service is not configured on the server.',
        },
        500
      );
    }

    const body = await req.json();

    const name =
      typeof body?.name === 'string'
        ? body.name.trim()
        : '';

    const email =
      typeof body?.email === 'string'
        ? body.email.trim()
        : '';

    const message =
      typeof body?.message === 'string'
        ? body.message.trim()
        : '';

    if (!name) {
      return json(
        {
          success: false,
          error: 'Your name is required.',
        },
        400
      );
    }

    if (!email) {
      return json(
        {
          success: false,
          error: 'Your email address is required.',
        },
        400
      );
    }

    if (!message) {
      return json(
        {
          success: false,
          error: 'Your message is required.',
        },
        400
      );
    }

    if (name.length > 200) {
      return json(
        {
          success: false,
          error: 'Name is too long.',
        },
        400
      );
    }

    if (email.length > 320) {
      return json(
        {
          success: false,
          error: 'Email address is too long.',
        },
        400
      );
    }

    if (message.length > 10000) {
      return json(
        {
          success: false,
          error: 'Message is too long.',
        },
        400
      );
    }

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      return json(
        {
          success: false,
          error: 'Please enter a valid email address.',
        },
        400
      );
    }

    const destination =
      Deno.env.get('CONTACT_EMAIL_TO') ||
      'washekfitness@gmail.com';

    const fromAddress =
      Deno.env.get('CONTACT_EMAIL_FROM') ||
      'Washek Fitness <onboarding@resend.dev>';

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeMessage = escapeHtml(message).replace(
      /\n/g,
      '<br />'
    );

    const resendResponse = await fetch(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [destination],
          reply_to: email,
          subject: `New contact message from ${name}`,
          text:
            `New Washek Fitness contact message\n\n` +
            `Name: ${name}\n` +
            `Email: ${email}\n\n` +
            `Message:\n${message}`,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
              <h2>New Washek Fitness Contact Message</h2>

              <p>
                <strong>Name:</strong>
                ${safeName}
              </p>

              <p>
                <strong>Email:</strong>
                ${safeEmail}
              </p>

              <hr />

              <p>
                <strong>Message:</strong>
              </p>

              <p>
                ${safeMessage}
              </p>
            </div>
          `,
        }),
      }
    );

    const resendData =
      await resendResponse.json().catch(() => ({}));

    if (!resendResponse.ok) {
      console.error(
        '[CONTACT EMAIL] Resend error:',
        {
          status: resendResponse.status,
          response: resendData,
        }
      );

      return json(
        {
          success: false,
          error:
            resendData?.message ||
            resendData?.error?.message ||
            'The email service rejected the message.',
        },
        502
      );
    }

    console.log(
      '[CONTACT EMAIL] Email sent successfully:',
      resendData
    );

    return json({
      success: true,
      id: resendData?.id || null,
    });
  } catch (error) {
    console.error(
      '[CONTACT EMAIL] Unexpected error:',
      error
    );

    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to send email.',
      },
      500
    );
  }
});
```
