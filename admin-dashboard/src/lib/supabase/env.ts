/**
 * Resolves Supabase URL + anon key for the admin dashboard.
 *
 * Accepts the same names as LoadKaro (Expo): EXPO_PUBLIC_SUPABASE_URL,
 * EXPO_PUBLIC_SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_KEY.
 *
 * Next.js normally only exposes NEXT_PUBLIC_* to the browser; `next.config.ts`
 * maps Expo-style vars so one `.env` can match the mobile app.
 */
export function getSupabaseEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_KEY?.trim();

  if (!url || !key) {
    throw new Error(
      "Missing Supabase URL or anon key. Add to admin-dashboard/.env.local: " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY " +
        "(or use the same EXPO_PUBLIC_* names as LoadKaro — see next.config.ts)."
    );
  }

  return { url, key };
}
