import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "@/lib/supabase/env";

/** Browser Supabase client — use in Client Components only (cookie-backed session). */
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;
  const { url, key } = getSupabaseEnv();
  browserClient = createBrowserClient(url, key);
  return browserClient;
}
