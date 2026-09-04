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
     * Authorization roles must come from the
