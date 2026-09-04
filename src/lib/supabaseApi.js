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

    /*
     * Authorization roles must come from the database profile.
     * Auth user metadata is client-controlled profile data and
     * must never be used as an authorization fallback.
     */
    role:
      profile.role ||
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
        'authenticated
