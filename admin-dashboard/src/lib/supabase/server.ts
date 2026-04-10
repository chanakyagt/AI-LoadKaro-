import { createClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "@/lib/supabase/env";

/** Server / RSC Supabase client — use in Server Components & route handlers. */
export function createSupabaseServerClient() {
  const { url, key } = getSupabaseEnv();
  return createClient(url, key);
}
