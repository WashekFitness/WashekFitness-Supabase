// supabase/functions/ai-generate/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_MODEL = 'openrouter/free';
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
      // fall through
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
  const content: Array<Record<string, unknown>> = [{ type: 'text', text: prompt }];

  for (const rawUrl of fileUrls) {
    const url = String(rawUrl);
    const lower = url.toLowerCase();

    if (/\.(mp4|mpeg|mov|webm|m4v)(\?|$)/i.test(lower)) {
      content.push({ type: 'video_url', video_url: { url } });
      continue;
    }
    if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(lower)) {
      content.push({ type: 'image_url', image_url: { url } });
      continue;
    }
    content.push({ type: 'text', text: `Additional file URL: ${url}` });
  }

  return content;
}

function extractText(responseJson: any) {
  const message = responseJson?.choices?.[0]?.message;
  const content = message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : part?.text || part?.content || ''))
      .join('')
      .trim();
  }
  return '';
}

function stripMarkdownCodeFence(value: string) {
  return value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function getErrorMessage(raw: any, fallback: string) {
  return raw?.error?.message || raw?.message || raw?.error || fallback;
}

/* Retry and timeout configuration */
const DEFAULT_OPENROUTER_ATTEMPTS = Number(Deno.env.get('OPENROUTER_ATTEMPTS') || '3');
const DEFAULT_OPENROUTER_ATTEMPT_TIMEOUT_MS = Number(Deno.env.get('OPENROUTER_ATTEMPT_TIMEOUT_MS') || '40000'); // 40s
const OPENROUTER_BACKOFF_MS = Number(Deno.env.get('OPENROUTER_BACKOFF_MS') || '1200');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const user = await requireUser(req);
    const body = await req.json();

    const type = String(body?.type || 'general');
    const prompt = String(body?.prompt || '').trim();
    const schema = body?.schema || null;
    const fileUrls = Array.isArray(body?.file_urls) ? body.file_urls : [];

    if (!ALLOWED_TYPES.has(type)) {
      return json({ success: false, error: `Unsupported AI request type: ${type}` }, 400);
    }
    if (!prompt) {
      return json({ success: false, error: 'Missing prompt.' }, 400);
    }

    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) {
      return json({ success: false, error: 'OPENROUTER_API_KEY is not configured in Supabase.' }, 500);
    }

    const configuredModel = Deno.env.get('OPENROUTER_MODEL') || DEFAULT_MODEL;
    const model = configuredModel === 'openrouter/free' ? configuredModel : DEFAULT_MODEL;

    let maxTokens = 3000;
    if (type === 'microcycle') maxTokens = 3000;
    else if (type === 'structure') maxTokens = 1500;
    else if (type === 'general') maxTokens = 2000;

    const payload: Record<string, unknown> = {
      model,
      messages: [{ role: 'user', content: buildMessageContent(prompt, fileUrls) }],
      stream: false,
      temperature: 0.2,
      max_tokens: maxTokens,
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
      payload.provider = { require_parameters: true };
      payload.plugins = [{ id: 'response-healing' }];
    }

    let finalRaw: any = null;
    let finalOk = false;
    let attempt = 0;

    for (attempt = 1; attempt <= DEFAULT_OPENROUTER_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_OPENROUTER_ATTEMPT_TIMEOUT_MS);

      try {
        console.log('[AI] OpenRouter attempt', attempt, { type, userId: user?.id });
        const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': Deno.env.get('OPENROUTER_SITE_URL') || 'https://washekfitness.com',
            'X-OpenRouter-Title': Deno.env.get('OPENROUTER_SITE_NAME') || 'Washek Fitness',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        try {
          finalRaw = await resp.json().catch(() => ({ raw_text: 'non-json' }));
        } catch {
          finalRaw = { raw_parse_error: 'parse failed' };
        }

        if (resp.ok) {
          finalOk = true;
          break;
        }

        // Retry on 5xx or 429
        if (resp.status >= 500 || resp.status === 429) {
          console.warn('[AI] OpenRouter transient status, will retry', { status: resp.status, attempt, type, userId: user?.id });
        } else {
          console.error('[AI] OpenRouter returned non-retryable error', { status: resp.status, raw: finalRaw, type, userId: user?.id });
          return json({ success: false, error: getErrorMessage(finalRaw, `OpenRouter returned status ${resp.status}.`), status: resp.status }, resp.status);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        if (err && (err.name === 'AbortError' || String(err).toLowerCase().includes('aborted'))) {
          console.warn('[AI] OpenRouter attempt aborted (timeout)', { attempt, timeoutMs: DEFAULT_OPENROUTER_ATTEMPT_TIMEOUT_MS, type, userId: user?.id });
        } else {
          console.error('[AI] OpenRouter fetch error', { err: String(err), attempt, type, userId: user?.id });
        }
      }

      if (attempt < DEFAULT_OPENROUTER_ATTEMPTS) {
        const backoff = OPENROUTER_BACKOFF_MS * Math.pow(2, attempt - 1);
        await new Promise((res) => setTimeout(res, backoff));
      }
    }

    if (!finalOk) {
      console.error('[AI] OpenRouter failed after attempts', { attempts: attempt - 1, type, userId: user?.id, last_raw: finalRaw });
      return json({
        success: false,
        error: 'OpenRouter did not produce a successful response after retries.',
        code: 'openrouter_transient',
        attempts: attempt - 1,
        last_raw: typeof finalRaw === 'string' ? finalRaw : (finalRaw || null),
      }, 502);
    }

    const outputText = extractText(finalRaw);
    if (!outputText) {
      console.error('[AI] OpenRouter returned no assistant content:', { type, finalRaw, userId: user?.id });
      return json({ success: false, error: 'OpenRouter returned no output.' }, 502);
    }

    if (schema) {
      try {
        const parsed = JSON.parse(stripMarkdownCodeFence(outputText));
        return json({ success: true, result: parsed, type, model: finalRaw?.model || model, usage: finalRaw?.usage || null });
      } catch (parseErr) {
        console.error('[AI] Expected JSON but received invalid JSON for structured response', { type, parseErr: String(parseErr), outputSnippet: (outputText || '').slice(0, 4000), userId: user?.id });
        return json({ success: false, error: 'OpenRouter returned invalid structured data.', raw_output: outputText.slice(0, 2000), model: finalRaw?.model || model }, 502);
      }
    }

    return json({ success: true, result: outputText, type, model: finalRaw?.model || model, usage: finalRaw?.usage || null });
  } catch (error) {
    console.error('[AI] Edge function error:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'AI request failed.' }, 500);
  }
});
