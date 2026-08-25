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
  if (!error) return new Error(fallback);

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

async function requireUser() {
  const { data, error } =
    await supabase.auth.getUser();

  if (error) {
    throw errorFrom(
      error,
      'Unable to read the signed-in user.'
    );
  }

  if (!data?.user) {
    throw new Error(
      'You must be signed in to do that.'
    );
  }

  return data.user;
}

async function getProfile(userId) {
  const { data, error } =
    await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

  if (error) {
    throw errorFrom(
      error,
      'Unable to load your profile.'
    );
  }

  return data || {};
}

function normalizeUser(authUser, profile) {
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
    id: authUser.id,
    email: authUser.email,
    role:
      profile.role ||
      authUser.user_metadata?.role ||
      'user',
    ...profile,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
  };
}

async function currentUser() {
  const { data, error } =
    await supabase.auth.getUser();

  if (error) {
    throw errorFrom(
      error,
      'Unable to read authentication state.'
    );
  }

  if (!data?.user) {
    throw new Error('Not authenticated.');
  }

  return normalizeUser(
    data.user,
    await getProfile(data.user.id)
  );
}

const ORDER_ALIASES = {
  created_date: 'created_at',
  updated_date: 'updated_at',
};

function applyFilters(
  query,
  filters = {},
  userId
) {
  let q = query;

  for (const [key, value] of Object.entries(
    filters || {}
  )) {
    if (key === 'created_by') {
      continue;
    }

    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      q = q.in(key, value);
    } else {
      q = q.eq(key, value);
    }
  }

  if (userId) {
    q = q.eq('user_id', userId);
  }

  return q;
}

function entity(table) {
  return {
    async list(
      sort = '-created_at',
      limit = 100
    ) {
      const user = await requireUser();

      const rawColumn = sort.replace(/^-/, '');

      const column =
        ORDER_ALIASES[rawColumn] ||
        rawColumn;

      const ascending = !sort.startsWith('-');

      let q = supabase
        .from(table)
        .select('*')
        .eq('user_id', user.id)
        .order(column, { ascending });

      if (Number.isFinite(limit)) {
        q = q.limit(limit);
      }

      const { data, error } = await q;

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
      const user = await requireUser();

      const rawColumn = sort.replace(/^-/, '');

      const column =
        ORDER_ALIASES[rawColumn] ||
        rawColumn;

      const ascending = !sort.startsWith('-');

      let q = applyFilters(
        supabase
          .from(table)
          .select('*'),
        filters,
        user.id
      ).order(column, { ascending });

      if (Number.isFinite(limit)) {
        q = q.limit(limit);
      }

      const { data, error } = await q;

      if (error) {
        throw errorFrom(
          error,
          `Unable to load ${table}.`
        );
      }

      return data || [];
    },

    async create(payload = {}) {
      const user = await requireUser();

      const row = {
        ...payload,
        user_id: user.id,
      };

      delete row.created_by;

      const { data, error } =
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

    async update(id, payload = {}) {
      const user = await requireUser();

      const row = {
        ...payload,
      };

      delete row.user_id;
      delete row.created_by;

      const { data, error } =
        await supabase
          .from(table)
          .update(row)
          .eq('id', id)
          .eq('user_id', user.id)
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

    async delete(id) {
      const user = await requireUser();

      const { error } =
        await supabase
          .from(table)
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);

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

async function uploadFile(
  input,
  folder = 'uploads'
) {
  const file = input?.file || input;
  const actualFolder =
    input?.folder || folder;

  if (!file) {
    throw new Error('No file was provided.');
  }

  const user = await requireUser();

  const safeName = file.name.replace(
    /[^a-zA-Z0-9._-]/g,
    '_'
  );

  const path =
    `${user.id}/${actualFolder}/` +
    `${crypto.randomUUID()}-${safeName}`;

  const { error } =
    await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, file, {
        upsert: false,
        contentType:
          file.type ||
          'application/octet-stream',
      });

  if (error) {
    throw errorFrom(
      error,
      'File upload failed.'
    );
  }

  const { data } =
    supabase.storage
      .from(MEDIA_BUCKET)
      .getPublicUrl(path);

  if (!data?.publicUrl) {
    throw new Error(
      'The file uploaded, but no public URL was returned.'
    );
  }

  return {
    file_url: data.publicUrl,
    path,
  };
}

async function invokeAI({
  prompt,
  file_urls = [],
  model = null,
  response_json_schema = null,
  schema = null,
  type = 'general',
} = {}) {
  const { data, error } =
    await supabase.functions.invoke(
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

  const result =
    data?.result ?? data;

  if (result == null) {
    throw new Error(
      'AI generation returned no result.'
    );
  }

  if (result?.success === false) {
    throw new Error(
      result.error ||
      'AI generation failed.'
    );
  }

  return result;
}

async function sendEmail({
  name,
  email,
  message,
} = {}) {
  const cleanName =
    typeof name === 'string'
      ? name.trim()
      : '';

  const cleanEmail =
    typeof email === 'string'
      ? email.trim()
      : '';

  const cleanMessage =
    typeof message === 'string'
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

  const { data, error } =
    await supabase.functions.invoke(
      EMAIL_FUNCTION,
      {
        body: {
          name: cleanName,
          email: cleanEmail,
          message: cleanMessage,
        },
      }
    );

  if (error) {
    throw errorFrom(
      error,
      'Email could not be sent.'
    );
  }

  if (data?.success === false) {
    throw new Error(
      data.error ||
      'Email could not be sent.'
    );
  }

  return data;
}

export const supabaseApi = {
  auth: {
    me: currentUser,

    updateMe: async (patch) => {
      const user = await requireUser();

      const profilePatch = {
        ...patch,
        id: user.id,
      };

      const { data, error } =
        await supabase
          .from('profiles')
          .upsert(
            profilePatch,
            { onConflict: 'id' }
          )
          .select()
          .single();

      if (error) {
        throw errorFrom(
          error,
          'Unable to update your profile.'
        );
      }

      return normalizeUser(
        user,
        data || {}
      );
    },

    logout: async () => {
      const { error } =
        await supabase.auth.signOut();

      if (error) {
        throw errorFrom(
          error,
          'Unable to sign out.'
        );
      }
    },

    redirectToLogin: () => {
      window.location.assign('/login');
    },
  },

  entities: {
    WorkoutProgram:
      entity('workout_programs'),

    WorkoutLog:
      entity('workout_logs'),

    NutritionEntry:
      entity('nutrition_entries'),

    ProgressPhoto:
      entity('progress_photos'),

    MovementBaseline:
      entity('movement_baselines'),

    FormAnalysis:
      entity('form_analyses'),

    KaelMessage:
      entity('kael_messages'),
  },

  storage: {
    uploadFile,
  },

  ai: {
    invoke: invokeAI,
  },

  email: {
    send: sendEmail,
  },
};

export {
  requireUser,
  currentUser,
};
