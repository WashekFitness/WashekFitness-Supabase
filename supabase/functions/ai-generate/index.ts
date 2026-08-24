import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_MODEL = 'openrouter/auto';
const ALLOWED_TYPES = new Set([
  'general',
  'structure',
  'microcycle',
  'live_workout',
  'kael',
  'form_analysis',
  'progress_photo',
  'weekly_update',
  'food_scan',
  'food_barcode',
]);

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
    } catch {
      // Fall through to the legacy anon key below.
    }
  }

  return Deno.env.get('SUPABASE_ANON_KEY') || '';
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing authorization header.');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = getSupabaseKey();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase function authentication is not configured.');
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Not authenticated.');
  return data.user;
}

function buildMessageContent(prompt: string, fileUrls: string[]) {
  if (!fileUrls?.length) return prompt;

  const content: Array<Record<string, unknown>> = [
    { type: 'text', text: prompt },
  ];

  for (const rawUrl of fileUrls) {
    const url = String(rawUrl);
    const lower = url.toLowerCase();

    if (/\.(mp4|mpeg|mov|webm|m4v)(\?|$)/i.test(lower)) {
      content.push({
        type: 'video_url',
        video_url: { url },
      });
      continue;
    }

    if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(lower)) {
      content.push({
        type: 'image_url',
        image_url: { url },
      });
      continue;
    }

    content.push({
      type: 'text',
      text: `Additional file URL: ${url}`,
    });
  }

  return content;
}

function extractText(responseJson: any) {
  const message = responseJson?.choices?.[0]?.message;
  const content = message?.content;

  if (typeof content === 'string') return content.trim();

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        return part?.text || part?.content || '';
      })
      .join('')
      .trim();
  }

  return '';
}

function stripMarkdownCodeFence(value: string) {
  return value
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function getErrorMessage(raw: any, fallback: string) {
  return raw?.error?.message || raw?.message || raw?.error || fallback;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const user = await requireUser(req);
    const body = await req.json();

    const type = String(body?.type || 'general');
    const prompt = String(body?.prompt || '').trim();
    const schema = body?.schema || null;
    const fileUrls = Array.isArray(body?.file_urls) ? body.file_urls : [];

    if (!ALLOWED_TYPES.has(type)) {
      return json({
        success: false,
        error: `Unsupported AI request type: ${type}`,
      }, 400);
    }

    if (!prompt) {
      return json({ success: false, error: 'Missing prompt.' }, 400);
    }

    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) {
      return json({
        success: false,
        error: 'OPENROUTER_API_KEY is not configured in Supabase.',
      }, 500);
    }

    // IMPORTANT: the browser cannot choose the model. Every AI request uses
    // OpenRouter Auto Router, so OpenRouter decides which capable model/provider
    // handles the request. A server-side override is intentionally not accepted
    // from the client.
    const model = Deno.env.get('OPENROUTER_MODEL') || DEFAULT_MODEL;

    const payload: Record<string, unknown> = {
      model,
      messages: [{
        role: 'user',
        content: buildMessageContent(prompt, fileUrls),
      }],
      stream: false,
      temperature: 0.2,
      max_tokens: 12000,
    };

    if (schema) {
      payload.response_format = {
        type: 'json_schema',
        json_schema: {
          name: `washek_fitness_${type.replace(/[^a-z0-9_]/gi, '_')}`,
          strict: true,
          schema,
        },
      };

      payload.provider = {
        require_parameters: true,
      };

      // Helps repair harmless JSON formatting failures for non-streaming
      // structured responses. Strict JSON Schema remains the primary contract.
      payload.plugins = [
        { id: 'response-healing' },
      ];
    }

    // The current Auto Router accepts cost_tier; keep an optional server-side
    // setting so you can control budget without changing frontend code.
    const costTier = Deno.env.get('OPENROUTER_COST_TIER');
    if (costTier && ['low', 'medium', 'high', 'xhigh', 'max'].includes(costTier)) {
      payload.plugins = [
        ...(Array.isArray(payload.plugins) ? payload.plugins : []),
        {
          id: 'auto-router',
          cost_tier: costTier,
        },
      ];
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': Deno.env.get('OPENROUTER_SITE_URL') || 'https://washekfitness.com',
        'X-OpenRouter-Title': Deno.env.get('OPENROUTER_SITE_NAME') || 'Washek Fitness',
      },
      body: JSON.stringify(payload),
    });

    const raw = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[AI] OpenRouter error:', {
        type,
        status: response.status,
        error: raw,
        userId: user.id,
      });

      return json({
        success: false,
        error: getErrorMessage(raw, `OpenRouter request failed with status ${response.status}.`),
      }, response.status);
    }

    const outputText = extractText(raw);

    if (!outputText) {
      console.error('[AI] OpenRouter returned no assistant content:', { type, raw });
      return json({
        success: false,
        error: 'OpenRouter returned no output.',
      }, 502);
    }

    if (schema) {
      try {
        const parsed = JSON.parse(stripMarkdownCodeFence(outputText));

        return json({
          success: true,
          result: parsed,
          type,
          model: raw?.model || model,
          usage: raw?.usage || null,
        });
      } catch {
        console.error('[AI] Expected JSON but received:', {
          type,
          output: outputText.slice(0, 4000),
        });

        return json({
          success: false,
          error: 'OpenRouter returned invalid structured data.',
          raw_output: outputText.slice(0, 2000),
          model: raw?.model || model,
        }, 502);
      }
    }

    return json({
      success: true,
      result: outputText,
      type,
      model: raw?.model || model,
      usage: raw?.usage || null,
    });
  } catch (error) {
    console.error('[AI] Edge function error:', error);

    return json({
      success: false,
      error: error instanceof Error ? error.message : 'AI request failed.',
    }, 500);
  }
});
