import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  BYPASS_ROLE_COOKIE,
  isDashboardAuthBypassed,
  parseBypassRole,
} from "@/lib/auth/bypass";
import {
  getDashboardRoleForUser,
  type DashboardRole,
} from "@/lib/auth/dashboard-role";
import { createSupabaseServerAuthClient } from "@/lib/supabase/server-auth";

async function getBypassRoleFromCookies(): Promise<DashboardRole> {
  const jar = await cookies();
  return parseBypassRole(jar.get(BYPASS_ROLE_COOKIE)?.value);
}

export type DashboardAccess =
  | {
      ok: true;
      bypass: boolean;
      role: DashboardRole;
      /** Set when not bypassing; used for `handled_by` etc. */
      userId: string | null;
    }
  | { ok: false; response: NextResponse };

/**
 * Supabase session + `public.users.role`, or bypass mode (no login) for local dev.
 */
export async function requireDashboardAccess(): Promise<DashboardAccess> {
  if (isDashboardAuthBypassed()) {
    const role = await getBypassRoleFromCookies();
    return { ok: true, bypass: true, role, userId: null };
  }

  const supabase = await createSupabaseServerAuthClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const role = await getDashboardRoleForUser(supabase, user.id);
  if (!role) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden: dashboard role not assigned" },
        { status: 403 }
      ),
    };
  }

  return { ok: true, bypass: false, role, userId: user.id };
}
