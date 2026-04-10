import { supabase } from '../lib/supabase.js';

/**
 * Loads `public.users` for the current Supabase Auth user.
 */
export async function loadUserProfile() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data: profile, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    throw error;
  }

  return profile;
}
