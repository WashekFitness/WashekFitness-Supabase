import { supabase } from '@/lib/supabase';

const MEDIA_BUCKET =
  import.meta.env.VITE_SUPABASE_MEDIA_BUCKET ||
  'user-media';

const AI_FUNCTION =
  import.meta.env.VITE_SUPABASE_AI_FUNCTION ||
  'ai-generate';

const EMAIL_FUNCTION =
  import.meta.env.VITE_SUPABASE_EMAIL_FUNCTION ||
  'send-contact-email';


function errorFrom(
  error,
  fallback = 'Supabase request failed.'
) {
  if (!error) {
    return new Error(fallback);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(
    error.message ||
    error.details ||
    error.hint ||
    fallback
  );
}


/*
 * ------------------------------------------------------------
 * AUTH
 * ------------------------------------------------------------
 */

async function requireUser() {
  const {
    data,
    error
  } = await supabase.auth.getUser();

  if (error) {
    throw errorFrom(
      error,
      'Unable to read your login session.'
    );
  }

  if (!data?.user) {
    throw new Error(
      'Your login session is missing. Please sign in again.'
    );
  }

  return data.user;
}


/*
 * ------------------------------------------------------------
 * PROFILE
 * ------------------------------------------------------------
 */

async function getProfile(
  userId
) {
  const {
    data,
    error
  } =
    await supabase
      .from('profiles')
      .select('*')
      .eq(
        'id',
        userId
      )
      .maybeSingle();

  if (error) {
    throw errorFrom(
      error,
      'Unable to load your Washek Fitness profile.'
    );
  }

  /*
   * IMPORTANT:
   *
   * A missing row is NOT treated as a Free account.
   * That was masking the actual problem.
   */
  if (!data) {
    throw new Error(
      'Your Washek Fitness profile could not be found. Your login still exists, but your profile record is missing or inaccessible.'
    );
  }

  return data;
}


function normalizeUser(
  authUser,
  profile
) {
  const firstName =
    profile.first_name ||
    authUser.user_metadata?.first_name ||
    '';

  const lastName =
    profile.last_name ||
    authUser.user_metadata?.last_name ||
    '';

  const fullName =
    profile.full_name ||
    [firstName, lastName]
      .filter(Boolean)
      .join(' ') ||
    authUser.user_metadata?.full_name ||
    authUser.email ||
    'Athlete';

  return {
    id:
      authUser.id,

    email:
      authUser.email,

    role:
      profile.role ||
      authUser.user_metadata?.role ||
      'user',

    ...profile,

    first_name:
      firstName,

    last_name:
      lastName,

    full_name:
      fullName,
  };
}


/*
 * ------------------------------------------------------------
 * CURRENT USER
 * ------------------------------------------------------------
 */

async function currentUser() {
  const user =
    await requireUser();

  const profile =
    await getProfile(
      user.id
    );

  return normalizeUser(
    user,
    profile
  );
}


/*
 * ------------------------------------------------------------
 * FILTERING
 * ------------------------------------------------------------
 */

const ORDER_ALIASES = {
  created_date:
    'created_at',

  updated_date:
    'updated_at',
};


function applyFilters(
  query,
  filters = {},
  userId
) {
  let q =
    query;

  for (
    const [
      key,
      value
    ] of Object.entries(
      filters || {}
    )
  ) {
    if (
      key ===
      'created_by'
    ) {
      continue;
    }

    if (
      value ===
        undefined ||
      value ===
        null
    ) {
      continue;
    }

    if (
      Array.isArray(
        value
      )
    ) {
      q =
        q.in(
          key,
          value
        );
    } else {
      q =
        q.eq(
          key,
          value
        );
    }
  }

  if (userId) {
    q =
      q.eq(
        'user_id',
        userId
      );
  }

  return q;
}


/*
 * ------------------------------------------------------------
 * GENERIC ENTITIES
 * ------------------------------------------------------------
 */

function entity(
  table
) {
  return {

    async list(
      sort = '-created_at',
      limit = 100
    ) {
      const user =
        await requireUser();

      const rawColumn =
        sort.replace(
          /^-/,
          ''
        );

      const column =
        ORDER_ALIASES[
          rawColumn
        ] ||
        rawColumn;

      const ascending =
        !sort.startsWith(
          '-'
        );

      let q =
        supabase
          .from(table)
          .select('*')
          .eq(
            'user_id',
            user.id
          )
          .order(
            column,
            {
              ascending
            }
          );

      if (
        Number.isFinite(
          limit
        )
      ) {
        q =
          q.limit(
            limit
          );
      }

      const {
        data,
        error
      } =
        await q;

      if (error) {
        throw errorFrom(
          error,
          `Unable to load ${table}.`
        );
      }

      return data || [];
    },


    async filter(
      filters = {},
      sort = '-created_at',
      limit = 100
    ) {
      const user =
        await requireUser();

      const rawColumn =
        sort.replace(
          /^-/,
          ''
        );

      const column =
        ORDER_ALIASES[
          rawColumn
        ] ||
        rawColumn;

      const ascending =
        !sort.startsWith(
          '-'
        );

      let q =
        applyFilters(
          supabase
            .from(table)
            .select('*'),
          filters,
          user.id
        ).order(
          column,
          {
            ascending
          }
        );

      if (
        Number.isFinite(
          limit
        )
      ) {
        q =
          q.limit(
            limit
          );
      }

      const {
        data,
        error
      } =
        await q;

      if (error) {
        throw errorFrom(
          error,
          `Unable to load ${table}.`
        );
      }

      return data || [];
    },


    async create(
      payload = {}
    ) {
      const user =
        await requireUser();

      const row = {
        ...payload,
        user_id:
          user.id,
      };

      delete row.created_by;

      const {
        data,
        error
      } =
        await supabase
          .from(table)
          .insert(row)
          .select()
          .single();

      if (error) {
        throw errorFrom(
          error,
          `Unable to create ${table} record.`
        );
      }

      return data;
    },


    async update(
      id,
      payload = {}
    ) {
      const user =
        await requireUser();

      const row = {
        ...payload,
      };

      delete row.user_id;
      delete row.created_by;

      const {
        data,
        error
      } =
        await supabase
          .from(table)
          .update(row)
          .eq(
            'id',
            id
          )
          .eq(
            'user_id',
            user.id
          )
          .select()
          .single();

      if (error) {
        throw errorFrom(
          error,
          `Unable to update ${table} record.`
        );
      }

      return data;
    },


    async delete(
      id
    ) {
      const user =
        await requireUser();

      const {
        error
      } =
        await supabase
          .from(table)
          .delete()
          .eq(
            'id',
            id
          )
          .eq(
            'user_id',
            user.id
          );

      if (error) {
        throw errorFrom(
          error,
          `Unable to delete ${table} record.`
        );
      }

      return true;
    },

  };
}


/*
 * ------------------------------------------------------------
 * STORAGE
 * ------------------------------------------------------------
 *
 * IMPORTANT:
 *
 * The media bucket will be private.
 *
 * Permanent database references should use `path`, NOT
 * `file_url`, because signed URLs expire.
 *
 * `file_url` is still returned from uploadFile for backwards
 * compatibility with existing upload flows. It is a temporary
 * signed URL and should NOT be permanently stored in the DB.
 */


/*
 * Convert an existing media URL into its storage path.
 *
 * This supports:
 *
 * 1. A raw storage path:
 *    user-id/folder/file.jpg
 *
 * 2. An old public Supabase storage URL:
 *    .../storage/v1/object/public/user-media/user-id/...
 *
 * 3. A signed Supabase storage URL:
 *    .../storage/v1/object/sign/user-media/user-id/...
 *
 * This is useful while existing database records are migrated
 * from URLs to storage paths.
 */
function getStoragePath(
  value
) {
  if (!value) {
    return null;
  }

  const raw =
    String(value).trim();

  if (!raw) {
    return null;
  }

  /*
   * Already a storage path.
   */
  if (
    !raw.startsWith(
      'http://'
    ) &&
    !raw.startsWith(
      'https://'
    )
  ) {
    return raw;
  }

  try {
    const url =
      new URL(raw);

    const marker =
      `/storage/v1/object/`;

    const markerIndex =
      url.pathname.indexOf(
        marker
      );

    if (
      markerIndex ===
      -1
    ) {
      return null;
    }

    const afterMarker =
      url.pathname.slice(
        markerIndex +
        marker.length
      );

    /*
     * Supported formats:
     *
     * public/<bucket>/<path>
     * sign/<bucket>/<path>
     * authenticated/<bucket>/<path>
     */
    const parts =
      afterMarker
        .split('/')
        .filter(Boolean);

    if (
      parts.length <
      3
    ) {
      return null;
    }

    const accessType =
      parts.shift();

    if (
      accessType !==
        'public' &&
      accessType !==
        'sign' &&
      accessType !==
        'authenticated'
    ) {
      return null;
    }

    const bucket =
      parts.shift();

    if (
      bucket !==
      MEDIA_BUCKET
    ) {
      return null;
    }

    return decodeURIComponent(
      parts.join('/')
    );
  } catch {
    return null;
  }
}


/*
 * Create a temporary signed URL for a user's media file.
 *
 * The caller should store the storage `path` permanently and
 * request a fresh signed URL whenever the file needs to be
 * displayed or sent to an external AI service.
 */
async function createSignedUrl(
  value,
  expiresIn = 3600
) {
  const path =
    getStoragePath(
      value
    );

  if (!path) {
    throw new Error(
      'A valid media storage path is required.'
    );
  }

  const user =
    await requireUser();

  /*
   * Never allow one authenticated user to request a signed
   * URL for another user's folder.
   */
  const expectedPrefix =
    `${user.id}/`;

  if (
    !path.startsWith(
      expectedPrefix
    )
  ) {
    throw new Error(
      'You do not have permission to access this file.'
    );
  }

  const {
    data,
    error
  } =
    await supabase
      .storage
      .from(
        MEDIA_BUCKET
      )
      .createSignedUrl(
        path,
        expiresIn
      );

  if (error) {
    throw errorFrom(
      error,
      'Unable to create a secure media URL.'
    );
  }

  if (!data?.signedUrl) {
    throw new Error(
      'The media file exists, but a secure URL could not be created.'
    );
  }

  return data.signedUrl;
}


/*
 * Create temporary signed URLs for multiple files.
 *
 * Returns an array in the same order as the supplied values.
 */
async function createSignedUrls(
  values = [],
  expiresIn = 3600
) {
  if (
    !Array.isArray(
      values
    ) ||
    values.length ===
      0
  ) {
    return [];
  }

  const paths =
    values
      .map(
        getStoragePath
      )
      .filter(Boolean);

  if (
    paths.length ===
    0
  ) {
    return [];
  }

  const user =
    await requireUser();

  const expectedPrefix =
    `${user.id}/`;

  for (
    const path of paths
  ) {
    if (
      !path.startsWith(
        expectedPrefix
      )
    ) {
      throw new Error(
        'You do not have permission to access one of these files.'
      );
    }
  }

  const {
    data,
    error
  } =
    await supabase
      .storage
      .from(
        MEDIA_BUCKET
      )
      .createSignedUrls(
        paths,
        expiresIn
      );

  if (error) {
    throw errorFrom(
      error,
      'Unable to create secure media URLs.'
    );
  }

  return (
    data ||
    []
  ).map(
    item =>
      item?.signedUrl ||
      null
  );
}


/*
 * Resolve a media value into a temporary secure URL.
 *
 * If the supplied value is already a valid signed URL, it is
 * returned as-is. Otherwise it is treated as a storage path or
 * old Supabase public URL and converted into a fresh signed URL.
 *
 * This provides backwards compatibility while the rest of the
 * app is migrated from storing URLs to storing paths.
 */
async function resolveMediaUrl(
  value,
  expiresIn = 3600
) {
  if (!value) {
    return null;
  }

  const raw =
    String(value).trim();

  if (!raw) {
    return null;
  }

  /*
   * A currently signed Supabase URL can be reused until it
   * expires. This avoids unnecessary requests during the same
   * operation.
   */
  if (
    raw.startsWith(
      'http://'
    ) ||
    raw.startsWith(
      'https://'
    )
  ) {
    const path =
      getStoragePath(
        raw
      );

    /*
     * If this isn't a Supabase media URL, leave it alone.
     * This keeps the helper safe for unrelated URLs.
     */
    if (!path) {
      return raw;
    }

    /*
     * Existing public URLs must NOT be returned because the
     * bucket is being made private.
     *
     * Existing signed URLs are acceptable temporarily, but
     * generating a fresh signed URL is safer and makes this
     * helper deterministic.
     */
    return createSignedUrl(
      path,
      expiresIn
    );
  }

  return createSignedUrl(
    raw,
    expiresIn
  );
}


/*
 * Upload a file and return both:
 *
 * - path: permanent storage identifier
 * - file_url: temporary signed URL
 *
 * IMPORTANT:
 *
 * Consumers should persist `path` in their database rather
 * than `file_url`.
 */
async function uploadFile(
  input,
  folder = 'uploads'
) {
  const file =
    input?.file ||
    input;

  const actualFolder =
    input?.folder ||
    folder;

  if (!file) {
    throw new Error(
      'No file was provided.'
    );
  }

  const user =
    await requireUser();

  const safeName =
    String(
      file.name ||
      'upload'
    ).replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    );

  const path =
    `${user.id}/${actualFolder}/` +
    `${crypto.randomUUID()}-${safeName}`;

  const {
    error
  } =
    await supabase
      .storage
      .from(
        MEDIA_BUCKET
      )
      .upload(
        path,
        file,
        {
          upsert:
            false,

          contentType:
            file.type ||
            'application/octet-stream',
        }
      );

  if (error) {
    throw errorFrom(
      error,
      'File upload failed.'
    );
  }

  /*
   * The bucket will be private, so never use getPublicUrl().
   *
   * Return a temporary signed URL for existing upload flows.
   */
  const fileUrl =
    await createSignedUrl(
      path,
      3600
    );

  return {
    file_url:
      fileUrl,

    path,
  };
}


/*
 * ------------------------------------------------------------
 * AI
 * ------------------------------------------------------------
 */

async function invokeAI({
  prompt,
  file_urls = [],
  model = null,
  response_json_schema = null,
  schema = null,
  type = 'general',
} = {}) {

  /*
   * Get the current authenticated session first.
   * supabase-js will send the JWT when invoking the function.
   */

  await requireUser();

  const {
    data,
    error
  } =
    await supabase
      .functions
      .invoke(
        AI_FUNCTION,
        {
          body: {
            type,
            prompt,
            file_urls,
            model,
            schema:
              schema ||
              response_json_schema ||
              null,
          },
        }
      );

  if (error) {
    throw errorFrom(
      error,
      'AI generation failed.'
    );
  }

  if (
    data?.success ===
    false
  ) {
    const err =
      new Error(
        data.error ||
        'AI generation failed.'
      );

    err.code =
      data.error_code ||
      null;

    err.status =
      data.status ||
      null;

    throw err;
  }

  const result =
    data?.result ??
    data;

  if (
    result == null
  ) {
    throw new Error(
      'AI generation returned no result.'
    );
  }

  return result;
}


/*
 * ------------------------------------------------------------
 * EMAIL
 * ------------------------------------------------------------
 */

async function sendEmail({
  name,
  email,
  message,
} = {}) {

  const cleanName =
    typeof name ===
    'string'
      ? name.trim()
      : '';

  const cleanEmail =
    typeof email ===
    'string'
      ? email.trim()
      : '';

  const cleanMessage =
    typeof message ===
    'string'
      ? message.trim()
      : '';

  if (!cleanName) {
    throw new Error(
      'Your name is required.'
    );
  }

  if (!cleanEmail) {
    throw new Error(
      'Your email address is required.'
    );
  }

  if (!cleanMessage) {
    throw new Error(
      'Your message is required.'
    );
  }

  await requireUser();

  const {
    data,
    error
  } =
    await supabase
      .functions
      .invoke(
        EMAIL_FUNCTION,
        {
          body: {
            name:
              cleanName,

            email:
              cleanEmail,

            message:
              cleanMessage,
          },
        }
      );

  if (error) {
    throw errorFrom(
      error,
      'Email could not be sent.'
    );
  }

  if (
    data?.success ===
    false
  ) {
    throw new Error(
      data.error ||
      'Email could not be sent.'
    );
  }

  return data;
}


/*
 * ------------------------------------------------------------
 * EXPORTED API
 * ------------------------------------------------------------
 */

export const supabaseApi = {

  auth: {

    me:
      currentUser,


    /*
     * IMPORTANT:
     *
     * updateMe ONLY updates the authenticated user's existing
     * profile. It will NOT create a replacement profile and
     * will NOT overwrite subscription fields.
     */
    updateMe:
      async (
        patch
      ) => {

        const user =
          await requireUser();

        const safePatch = {
          ...patch,
        };

        /*
         * NEVER allow profile editing to alter these fields.
         * Stripe is the authority for subscription state.
         */
        delete safePatch.id;
        delete safePatch.user_id;

        delete safePatch.subscription_plan;
        delete safePatch.subscription_status;
        delete safePatch.stripe_customer_id;
        delete safePatch.stripe_subscription_id;
        delete safePatch.stripe_price_id;
        delete safePatch.subscription_cancelled_at;
        delete safePatch.subscription_updated_at;

        const {
          data,
          error
        } =
          await supabase
            .from('profiles')
            .update(
              safePatch
            )
            .eq(
              'id',
              user.id
            )
            .select()
            .single();

        if (error) {
          throw errorFrom(
            error,
            'Unable to update your profile.'
          );
        }

        if (!data) {
          throw new Error(
            'Your profile could not be found.'
          );
        }

        return normalizeUser(
          user,
          data
        );
      },


    logout:
      async () => {

        const {
          error
        } =
          await supabase
            .auth
            .signOut();

        if (error) {
          throw errorFrom(
            error,
            'Unable to sign out.'
          );
        }
      },


    redirectToLogin:
      () => {
        window.location.assign(
          '/login'
        );
      },

  },


  entities: {

    WorkoutProgram:
      entity(
        'workout_programs'
      ),

    WorkoutLog:
      entity(
        'workout_logs'
      ),

    NutritionEntry:
      entity(
        'nutrition_entries'
      ),

    ProgressPhoto:
      entity(
        'progress_photos'
      ),

    MovementBaseline:
      entity(
        'movement_baselines'
      ),

    FormAnalysis:
      entity(
        'form_analyses'
      ),

    KaelMessage:
      entity(
        'kael_messages'
      ),

  },


  storage: {
    uploadFile,
    createSignedUrl,
    createSignedUrls,
    resolveMediaUrl,
    getStoragePath,
  },


  ai: {
    invoke:
      invokeAI,
  },


  email: {
    send:
      sendEmail,
  },

};


export {
  requireUser,
  currentUser,
};
