import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getSupabaseKey() {
  const publishableKeysRaw = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (publishableKeysRaw) {
    try {
      const keys = JSON.parse(publishableKeysRaw);
      if (keys?.default) return keys.default;
    } catch {}
  }
  return Deno.env.get('SUPABASE_ANON_KEY') || '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header.');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = getSupabaseKey();
    if (!supabaseUrl || !supabaseKey) throw new Error('Supabase authentication is not configured.');

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error('Not authenticated.');

    const { name, email, message } = await req.json();
    if (!name || !email || !message) {
      return json({ success: false, error: 'Name, email, and message are required.' }, 400);
    }

    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (serviceRole) {
      const admin = createClient(supabaseUrl, serviceRole);
      const { error } = await admin.from('contact_messages').insert({
        user_id: authData.user.id,
        name: String(name).trim(),
        email: String(email).trim(),
        message: String(message).trim(),
      });
      if (error) console.error('[CONTACT] Could not save message:', error);
    } else {
      const { error } = await supabase.from('contact_messages').insert({
        user_id: authData.user.id,
        name: String(name).trim(),
        email: String(email).trim(),
        message: String(message).trim(),
      });
      if (error) console.error('[CONTACT] Could not save message:', error);
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const to = Deno.env.get('CONTACT_TO_EMAIL') || 'washekfitness@gmail.com';

    if (!resendKey) {
      return json({
        success: true,
        queued: true,
        message: 'Message saved. Configure RESEND_API_KEY to send email notifications.',
      });
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('CONTACT_FROM_EMAIL') || 'Washek Fitness <onboarding@resend.dev>',
        to: [to],
        reply_to: String(email).trim(),
        subject: `New message from ${String(name).trim()}`,
        text: `Name: ${String(name).trim()}\nEmail: ${String(email).trim()}\n\nMessage:\n${String(message).trim()}`,
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json({ success: false, error: result?.message || 'Email provider rejected the message.' }, 502);
    }

    return json({ success: true, id: result?.id });
  } catch (error) {
    console.error('[CONTACT] Error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unable to send message.',
    }, 500);
  }
});
