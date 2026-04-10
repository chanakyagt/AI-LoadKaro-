import { normalizeRoleKey } from '../config/roleRoutes';
import { supabase } from '../lib/supabase.js';
import { loadUserProfile } from './loadUserProfile.js';

/**
 * After OTP verification:
 * 1) getUser()
 * 2) If register + no row → insert into public.users
 * 3) select profile for UI (name, phone, verification_status)
 *
 * @param {{
 *   mode: 'register' | 'signin';
 *   phoneE164: string;
 *   name?: string;
 *   role?: 'shipper' | 'truck_owner';
 * }} params
 */
export async function syncUserAfterOtp({ mode, phoneE164, name, role }) {
  // 4) Get user from Supabase Auth
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }
  if (!user) {
    throw new Error('No authenticated user after OTP');
  }

  const { data: existing, error: existingError } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  // 5) Insert profile for new registrations only (sign-in expects row to exist)
  if (mode === 'register' && !existing) {
    if (!role) {
      throw new Error('Missing role for new user registration');
    }

    const canonicalRole = normalizeRoleKey(role) || role;

    const insertPayload = {
      id: user.id,
      name: name?.trim() ?? '',
      phone: phoneE164,
      role: canonicalRole,
    };

    const { error: insertError } = await supabase.from('users').insert(insertPayload);

    if (insertError) {
      throw insertError;
    }
  }

  return loadUserProfile();
}
