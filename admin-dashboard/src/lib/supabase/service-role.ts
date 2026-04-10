import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Server-only client with the service role key — bypasses RLS.
 * Use only in Route Handlers / Server Actions, never in client bundles.
 */
export function createServiceRoleClient(): SupabaseClient {
  const { url } = getSupabaseEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to admin-dashboard/.env.local so the admin API can list all rows (RLS requires a logged-in user for anon clients)."
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasServiceRoleKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/** Use in Route Handlers when the key is absent (avoid 500 from thrown Error). */
export const SERVICE_ROLE_SETUP_MESSAGE =
  "Add SUPABASE_SERVICE_ROLE_KEY to admin-dashboard/.env.local (Supabase → Project Settings → API → service_role secret). Restart the dev server after saving.";

export const MISSING_SERVICE_ROLE_CODE = "MISSING_SERVICE_ROLE_KEY" as const;
