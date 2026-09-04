import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
};

const OPENROUTER_URL =
  'https://openrouter.ai/api/v1/chat/completions';

const MEDIA_BUCKET =
  Deno.env.get('SUPABASE_MEDIA_BUCKET') ||
  'user-media';

/*
 * IMPORTANT:
 *
 * We intentionally use OpenRouter's FREE router for visual requests.
 *
 * openrouter/free automatically selects from currently available
 * free models and filters for capabilities required by the request,
 * including image understanding.
 *
 * This is safer than hard-coding a small list of individual free
 * providers that may all be rate-limited at the same time.
 *
 * We NEVER fall back to a paid model.
 */
const FREE_VISION_MODEL =
  'openrouter/free';

/*
 * Text-only requests remain on OpenRouter's free router too.
 */
const DEFAULT_TEXT_MODEL =
  'openrouter/free';

const ALLOWED_TYPES = new Set([
  'general',
  'structure',
  'microcycle',
  'live_workout',
  'live_workout_adjustment',
  'kael',
  'form_analysis',
  'progress_photo',
  'weekly_update',
  'food_scan',
  'food_barcode',
]);

/*
 * These features contain visual media and therefore require
 * a multimodal model.
 */
const VISUAL_TYPES = new Set([
  'form_analysis',
  'progress_photo',
  'food_scan',
  'food_barcode',
]);

/*
 * Server-side subscription requirements.
 *
 * Live Workout itself remains FREE.
 * Elite is only required for the adjustment flow.
 * Weekly Update remains FREE.
 */
const SERVER_FEATURE_PLANS: Record<string, string> = {
  form_analysis: 'elite',
  progress_photo: 'performance',
  food_scan: 'progress',
  food_barcode: 'progress',
};

const PLAN_HIERARCHY = [
  'free',
  'progress',
  'performance',
  'elite',
];

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
]);

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

/* ============================================================
 * SUPABASE AUTH
 * ============================================================ */

function getSupabaseAnonKey() {
  const publishableKeysRaw =
    Deno.env.get(
      'SUPABASE_PUBLISHABLE_KEYS'
    );

  if (publishableKeysRaw) {
    try {
      const keys =
        JSON.parse(
          publishableKeysRaw
        );

      if (keys?.default) {
        return keys.default;
      }
    } catch {
      // Fall through.
    }
  }

  return (
    Deno.env.get(
      'SUPABASE_ANON_KEY'
    ) || ''
  );
}

function getServiceRoleKey() {
  /*
   * IMPORTANT:
   *
   * This project uses SERVICE_ROLE_KEY.
   * Do not rename it.
   */
  return (
    Deno.env.get(
      'SERVICE_ROLE_KEY'
    ) || ''
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

  const supabaseUrl =
    Deno.env.get(
      'SUPABASE_URL'
    );

  const supabaseKey =
    getSupabaseAnonKey();

  if (
    !supabaseUrl ||
    !supabaseKey
  ) {
    throw new Error(
      'Supabase function authentication is not configured.'
    );
  }

  const client =
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
    data,
    error,
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

/* ============================================================
 * SUBSCRIPTION AUTHORIZATION
 * ============================================================ */

function normalizePlan(
  value: unknown
) {
  const plan =
    String(
      value || 'free'
    )
      .trim()
      .toLowerCase();

  return PLAN_HIERARCHY.includes(
    plan
  )
    ? plan
    : 'free';
}

function hasRequiredPlan(
  userPlan: string,
  requiredPlan: string
) {
  const userIndex =
    PLAN_HIERARCHY.indexOf(
      userPlan
    );

  const requiredIndex =
    PLAN_HIERARCHY.indexOf(
      requiredPlan
    );

  return (
    userIndex >= 0 &&
    requiredIndex >= 0 &&
    userIndex >= requiredIndex
  );
}

async function getUserPlan(
  req: Request,
  user: any
) {
  const authHeader =
    req.headers.get(
      'Authorization'
    );

  const supabaseUrl =
    Deno.env.get(
      'SUPABASE_URL'
    );

  const supabaseKey =
    getSupabaseAnonKey();

  if (
    !authHeader ||
    !supabaseUrl ||
    !supabaseKey
  ) {
    throw new Error(
      'Supabase function authentication is not configured.'
    );
  }

  const client =
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
    data,
    error,
  } =
    await client
      .from('profiles')
      .select(
        'subscription_plan, subscription_status'
      )
      .eq(
        'id',
        user.id
      )
      .maybeSingle();

  if (error) {
    console.error(
      '[AI] PROFILE LOOKUP ERROR',
      {
        userId:
          user.id,
        message:
          error.message,
      }
    );

    throw new Error(
      'Unable to verify subscription status.'
    );
  }

  const status =
    String(
      data?.subscription_status ||
        ''
    ).toLowerCase();

  const plan =
    normalizePlan(
      ACTIVE_SUBSCRIPTION_STATUSES.has(
        status
      )
        ? data?.subscription_plan
        : 'free'
    );

  return {
    plan,
    status,
  };
}

async function enforcePlanAccess(
  req: Request,
  user: any,
  type: string
) {
  /*
   * Live Workout basic AI is FREE.
   *
   * Only the dedicated adjustment flow
   * requires Elite.
   */
  const requiredPlan =
    type ===
    'live_workout_adjustment'
      ? 'elite'
      : SERVER_FEATURE_PLANS[type] ||
        null;

  if (!requiredPlan) {
    return {
      allowed: true,
      plan: null,
      requiredPlan: null,
    };
  }

  const {
    plan,
  } =
    await getUserPlan(
      req,
      user
    );

  if (
    !hasRequiredPlan(
      plan,
      requiredPlan
    )
  ) {
    return {
      allowed: false,
      plan,
      requiredPlan,
    };
  }

  return {
    allowed: true,
    plan,
    requiredPlan,
  };
}

/* ============================================================
 * STORAGE / MEDIA
 * ============================================================ */

function isHttpUrl(
  value: string
) {
  return /^https?:\/\//i.test(
    value
  );
}

function isDataUrl(
  value: string
) {
  return /^data:/i.test(
    value
  );
}

function looksLikeVideoUrl(
  value: string
) {
  return /\.(mp4|mpeg|mov|webm|m4v)(\?|$)/i.test(
    value
  );
}

async function resolveStoragePath(
  rawValue: string,
  userId: string
) {
  const value =
    String(
      rawValue || ''
    ).trim();

  if (!value) {
    throw new Error(
      'Empty media path.'
    );
  }

  /*
   * Already usable URLs/data URLs
   * do not need conversion.
   */
  if (
    isHttpUrl(value) ||
    isDataUrl(value)
  ) {
    return value;
  }

  let path = value;

  /*
   * Normalize a possible Supabase
   * Storage URL.
   */
  const objectMarker =
    '/storage/v1/object/';

  const markerIndex =
    path.indexOf(
      objectMarker
    );

  if (markerIndex >= 0) {
    const afterMarker =
      path.slice(
        markerIndex +
          objectMarker.length
      );

    const parts =
      afterMarker.split('/');

    if (
      parts.length >= 2
    ) {
      parts.shift();

      const bucket =
        parts.shift();

      if (
        bucket ===
          MEDIA_BUCKET &&
        parts.length > 0
      ) {
        path =
          decodeURIComponent(
            parts.join('/')
          );
      }
    }
  }

  /*
   * Security:
   *
   * Uploaded media must belong to
   * the authenticated user.
   */
  const expectedPrefix =
    `${userId}/`;

  if (
    !path.startsWith(
      expectedPrefix
    )
  ) {
    throw new Error(
      'The requested media does not belong to the authenticated user.'
    );
  }

  const serviceRoleKey =
    getServiceRoleKey();

  const supabaseUrl =
    Deno.env.get(
      'SUPABASE_URL'
    );

  if (
    !serviceRoleKey ||
    !supabaseUrl
  ) {
    throw new Error(
      'SERVICE_ROLE_KEY is not configured for private media access.'
    );
  }

  const admin =
    createClient(
      supabaseUrl,
      serviceRoleKey
    );

  const {
    data,
    error,
  } =
    await admin.storage
      .from(
        MEDIA_BUCKET
      )
      .createSignedUrl(
        path,
        3600
      );

  if (
    error ||
    !data?.signedUrl
  ) {
    console.error(
      '[AI] STORAGE SIGNED URL ERROR',
      {
        path,
        bucket:
          MEDIA_BUCKET,
        message:
          error?.message ||
          'No signed URL returned.',
      }
    );

    throw new Error(
      `Unable to access uploaded media: ${
        error?.message ||
        'signed URL could not be created.'
      }`
    );
  }

  return data.signedUrl;
}

async function resolveAllMedia(
  fileUrls: unknown[],
  userId: string
) {
  if (
    !Array.isArray(
      fileUrls
    )
  ) {
    return [];
  }

  /*
   * Hard safety limit.
   */
  const limited =
    fileUrls
      .slice(0, 8)
      .map(
        (value) =>
          String(
            value || ''
          ).trim()
      )
      .filter(Boolean);

  const resolved: string[] =
    [];

  for (
    const value of limited
  ) {
    const resolvedUrl =
      await resolveStoragePath(
        value,
        userId
      );

    resolved.push(
      resolvedUrl
    );
  }

  return resolved;
}

/* ============================================================
 * OPENROUTER MESSAGE BUILDING
 * ============================================================ */

function buildMessageContent(
  prompt: string,
  fileUrls: string[]
) {
  if (
    !fileUrls?.length
  ) {
    return prompt;
  }

  const content:
    Array<
      Record<string, unknown>
    > = [
    {
      type: 'text',
      text: prompt,
    },
  ];

  for (
    const rawUrl of fileUrls
  ) {
    const url =
      String(
        rawUrl || ''
      ).trim();

    if (!url) {
      continue;
    }

    const lower =
      url.toLowerCase();

    /*
     * Data URLs.
     */
    if (
      lower.startsWith(
        'data:video/'
      )
    ) {
      content.push({
        type: 'video_url',
        video_url: {
          url,
        },
      });

      continue;
    }

    if (
      lower.startsWith(
        'data:image/'
      )
    ) {
      content.push({
        type: 'image_url',
        image_url: {
          url,
        },
      });

      continue;
    }

    /*
     * Hosted video.
     */
    if (
      looksLikeVideoUrl(
        lower
      )
    ) {
      content.push({
        type: 'video_url',
        video_url: {
          url,
        },
      });

      continue;
    }

    /*
     * Supabase signed image URLs do not
     * reliably preserve file extensions,
     * so unknown hosted media is treated
     * as an image.
     */
    content.push({
      type: 'image_url',
      image_url: {
        url,
      },
    });
  }

  return content;
}

/* ============================================================
 * RESPONSE PARSING
 * ============================================================ */

function extractText(
  responseJson: any
) {
  const message =
    responseJson
      ?.choices?.[0]
      ?.message;

  const content =
    message?.content;

  if (
    typeof content ===
    'string'
  ) {
    return content.trim();
  }

  if (
    Array.isArray(content)
  ) {
    return content
      .map(
        (part) => {
          if (
            typeof part ===
            'string'
          ) {
            return part;
          }

          return (
            part?.text ||
            part?.content ||
            ''
          );
        }
      )
      .join('')
      .trim();
  }

  return '';
}

function stripMarkdownCodeFence(
  value: string
) {
  return value
    .replace(
      /^```(?:json)?\s*/i,
      ''
    )
    .replace(
      /\s*```$/,
      ''
    )
    .trim();
}

function tryParseJson(
  value: string
) {
  const cleaned =
    stripMarkdownCodeFence(
      value
    );

  try {
    return JSON.parse(
      cleaned
    );
  } catch {
    const firstBrace =
      cleaned.indexOf(
        '{'
      );

    const lastBrace =
      cleaned.lastIndexOf(
        '}'
      );

    if (
      firstBrace >= 0 &&
      lastBrace > firstBrace
    ) {
      try {
        return JSON.parse(
          cleaned.slice(
            firstBrace,
            lastBrace + 1
          )
        );
      } catch {
        return null;
      }
    }

    return null;
  }
}

/* ============================================================
 * MODEL SELECTION
 * ============================================================ */

function getModelsForRequest(
  type: string,
  hasMedia: boolean
) {
  /*
   * Both visual and text requests use
   * OpenRouter's free router.
   *
   * For visual requests, OpenRouter filters
   * the free pool to models that support the
   * supplied image/video input.
   */
  if (
    hasMedia ||
    VISUAL_TYPES.has(type)
  ) {
    return [
      FREE_VISION_MODEL,
    ];
  }

  return [
    DEFAULT_TEXT_MODEL,
  ];
}

/* ============================================================
 * OPENROUTER ERROR HELPERS
 * ============================================================ */

function getErrorMessage(
  raw: any,
  fallback: string
) {
  const message =
    raw?.error?.message ||
    raw?.message ||
    raw?.error;

  if (
    typeof message ===
    'string'
  ) {
    return message;
  }

  return fallback;
}

function shouldRetryStatus(
  status: number
) {
  return (
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

/*
 * Wait briefly before retrying the free router.
 *
 * This is intentionally short because we don't
 * want a user request hanging for a long time.
 */
function sleep(
  milliseconds: number
) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds
      )
  );
}

/* ============================================================
 * OPENROUTER REQUEST
 * ============================================================ */

async function callOpenRouter(
  apiKey: string,
  model: string,
  type: string,
  prompt: string,
  fileUrls: string[]
) {
  const hasMedia =
    fileUrls.length > 0;

  const content =
    buildMessageContent(
      prompt,
      fileUrls
    );

  const payload:
    Record<string, unknown> = {
    model,

    messages: [
      {
        role: 'user',
        content,
      },
    ],

    stream: false,

    temperature: 0.2,

    max_tokens:
      type === 'microcycle'
        ? 6500
        : type === 'structure'
          ? 2500
          : type ===
              'form_analysis'
            ? 3000
            : type ===
                'food_scan'
              ? 2500
              : type ===
                  'progress_photo'
                ? 2500
                : 4000,

    /*
     * Tell OpenRouter it is allowed to use
     * alternative providers.
     *
     * We still remain on the FREE model.
     */
    provider: {
      allow_fallbacks: true,
    },
  };

  /*
   * Do not send response_format for visual
   * requests because free multimodal providers
   * have inconsistent structured-output support.
   *
   * JSON is requested in the prompt and parsed
   * after the response.
   */
  if (!hasMedia) {
    // Text-only requests intentionally remain
    // provider-compatible without forcing a schema.
  }

  console.log(
    '[AI] Trying OpenRouter free router',
    {
      type,
      model,
      mediaCount:
        fileUrls.length,
    }
  );

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      45000
    );

  let response:
    Response;

  try {
    response =
      await fetch(
        OPENROUTER_URL,
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${apiKey}`,

            'Content-Type':
              'application/json',

            'HTTP-Referer':
              Deno.env.get(
                'OPENROUTER_SITE_URL'
              ) ||
              'https://washekfitness.com',

            'X-OpenRouter-Title':
              Deno.env.get(
                'OPENROUTER_SITE_NAME'
              ) ||
              'Washek Fitness',
          },

          body:
            JSON.stringify(
              payload
            ),

          signal:
            controller.signal,
        }
      );
  } catch (
    error
  ) {
    const aborted =
      (error as any)
        ?.name ===
      'AbortError';

    const timeoutError =
      new Error(
        aborted
          ? 'OpenRouter request timed out.'
          : error instanceof Error
            ? error.message
            : 'OpenRouter request failed.'
      );

    (
      timeoutError as any
    ).status =
      aborted
        ? 504
        : 502;

    throw timeoutError;
  } finally {
    clearTimeout(
      timeout
    );
  }

  const raw =
    await response
      .json()
      .catch(
        () => ({})
      );

  if (!response.ok) {
    console.error(
      '[AI] OpenRouter error:',
      {
        type,
        model,
        status:
          response.status,
        error: raw,
      }
    );

    const error =
      new Error(
        getErrorMessage(
          raw,
          `OpenRouter request failed with status ${response.status}.`
        )
      );

    (
      error as any
    ).status =
      response.status;

    (
      error as any
    ).raw =
      raw;

    throw error;
  }

  const outputText =
    extractText(
      raw
    );

  if (!outputText) {
    const error =
      new Error(
        'OpenRouter returned no assistant content.'
      );

    (
      error as any
    ).status =
      502;

    throw error;
  }

  console.log(
    '[AI] OpenRouter success',
    {
      type,
      model:
        raw?.model ||
        model,
      usage:
        raw?.usage ||
        null,
    }
  );

  return {
    outputText,

    model:
      raw?.model ||
      model,

    usage:
      raw?.usage ||
      null,
  };
}

/* ============================================================
 * MAIN FUNCTION
 * ============================================================ */

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
            corsHeaders,
        }
      );
    }

    try {
      const user =
        await requireUser(
          req
        );

      const body =
        await req.json();

      const type =
        String(
          body?.type ||
            'general'
        );

      const prompt =
        String(
          body?.prompt ||
            ''
        ).trim();

      const rawFileUrls =
        Array.isArray(
          body?.file_urls
        )
          ? body.file_urls
          : [];

      if (
        !ALLOWED_TYPES.has(
          type
        )
      ) {
        return json(
          {
            success:
              false,

            error:
              `Unsupported AI request type: ${type}`,
          },
          400
        );
      }

      if (!prompt) {
        return json(
          {
            success:
              false,

            error:
              'Missing prompt.',
          },
          400
        );
      }

      /* --------------------------------------------------------
       * PLAN ACCESS
       * ------------------------------------------------------ */

      const access =
        await enforcePlanAccess(
          req,
          user,
          type
        );

      if (
        !access.allowed
      ) {
        console.warn(
          '[AI] PLAN DENIED',
          {
            userId:
              user.id,

            type,

            currentPlan:
              access.plan,

            requiredPlan:
              access.requiredPlan,
          }
        );

        return json(
          {
            success:
              false,

            error:
              `This AI feature requires the ${access.requiredPlan} plan.`,

            error_code:
              'FEATURE_REQUIRES_PLAN',

            current_plan:
              access.plan,

            required_plan:
              access.requiredPlan,

            type,
          },
          403
        );
      }

      /* --------------------------------------------------------
       * OPENROUTER KEY
       * ------------------------------------------------------ */

      const apiKey =
        Deno.env.get(
          'OPENROUTER_API_KEY'
        );

      if (!apiKey) {
        return json(
          {
            success:
              false,

            error:
              'OPENROUTER_API_KEY is not configured in Supabase.',
          },
          500
        );
      }

      /* --------------------------------------------------------
       * RESOLVE PRIVATE MEDIA
       * ------------------------------------------------------ */

      let fileUrls:
        string[] = [];

      if (
        rawFileUrls.length
      ) {
        try {
          fileUrls =
            await resolveAllMedia(
              rawFileUrls,
              user.id
            );
        } catch (
          mediaError
        ) {
          console.error(
            '[AI] MEDIA RESOLUTION ERROR',
            {
              userId:
                user.id,

              type,

              error:
                mediaError,
            }
          );

          return json(
            {
              success:
                false,

              error:
                mediaError instanceof
                Error
                  ? mediaError.message
                  : 'Unable to access uploaded media.',

              error_code:
                'MEDIA_ACCESS_ERROR',
            },
            400
          );
        }
      }

      const hasMedia =
        fileUrls.length >
        0;

      /* --------------------------------------------------------
       * MODEL
       * ------------------------------------------------------ */

      const models =
        getModelsForRequest(
          type,
          hasMedia
        );

      const failures:
        Array<
          Record<string, unknown>
        > = [];

      /*
       * Because openrouter/free is itself
       * a router, retrying it gives OpenRouter
       * another opportunity to select an
       * available free endpoint.
       */
      const MAX_ATTEMPTS =
        hasMedia
          ? 3
          : 2;

      for (
        let attempt = 0;
        attempt <
        MAX_ATTEMPTS;
        attempt++
      ) {
        for (
          const model of models
        ) {
          try {
            const result =
              await callOpenRouter(
                apiKey,
                model,
                type,
                prompt,
                fileUrls
              );

            /*
             * Visual features expect JSON.
             * Parse it ourselves because we
             * deliberately don't force
             * response_format on free
             * multimodal providers.
             */
            const parsed =
              hasMedia
                ? tryParseJson(
                    result.outputText
                  )
                : null;

            return json(
              {
                success:
                  true,

                result:
                  parsed ??
                  result.outputText,

                type,

                model:
                  result.model,

                usage:
                  result.usage,
              },
              200
            );
          } catch (
            error
          ) {
            const status =
              Number(
                (error as any)
                  ?.status ||
                  0
              );

            const message =
              error instanceof
              Error
                ? error.message
                : 'Unknown OpenRouter error.';

            failures.push(
              {
                attempt:
                  attempt + 1,

                model,

                status,

                message,
              }
            );

            console.warn(
              '[AI] Free model attempt failed',
              {
                type,
                attempt:
                  attempt + 1,
                model,
                status,
                message,
              }
            );

            /*
             * Permanent request errors should
             * not be retried repeatedly.
             */
            if (
              status &&
              !shouldRetryStatus(
                status
              )
            ) {
              break;
            }
          }
        }

        /*
         * Brief pause before giving the
         * free router another opportunity.
         */
        if (
          attempt <
          MAX_ATTEMPTS - 1
        ) {
          await sleep(
            750
          );
        }
      }

      console.error(
        '[AI] All free OpenRouter attempts failed',
        {
          type,

          userId:
            user.id,

          failures,
        }
      );

      return json(
        {
          success:
            false,

          error:
            'The free AI vision service is temporarily unavailable. Please try again shortly.',

          error_code:
            'FREE_AI_UNAVAILABLE',

          type,

          attempts:
            failures,
        },
        503
      );
    } catch (
      error
    ) {
      console.error(
        '[AI] Edge function error:',
        error
      );

      return json(
        {
          success:
            false,

          error:
            error instanceof
            Error
              ? error.message
              : 'AI request failed.',
        },
        500
      );
    }
  }
);
