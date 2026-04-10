import type { DashboardRole } from "@/lib/auth/dashboard-role";

/**
 * Cookie used when auth is bypassed (local dev): picks admin vs moderator UI + API allowlists.
 */
export const BYPASS_ROLE_COOKIE = "lk-bypass-role";

/**
 * When `true`, Supabase login is skipped; `/admin` and `/moderator` are reachable and
 * `/api/admin/*` uses the service role with role from {@link BYPASS_ROLE_COOKIE} (default admin).
 *
 * Set in `.env.local`:
 * - `DASHBOARD_BYPASS_AUTH=true` (server / middleware / API), and/or
 * - `NEXT_PUBLIC_DASHBOARD_BYPASS_AUTH=true` (client login UI)
 *
 * Never enable in production.
 */
export function isDashboardAuthBypassed(): boolean {
  return (
    process.env.DASHBOARD_BYPASS_AUTH === "true" ||
    process.env.NEXT_PUBLIC_DASHBOARD_BYPASS_AUTH === "true"
  );
}

export function parseBypassRole(value: string | undefined): DashboardRole {
  if (value === "moderator") return "moderator";
  return "admin";
}
