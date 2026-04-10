import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createSupabaseServerAuthClient } from "@/lib/supabase/server-auth";

export type DashboardRole = "admin" | "moderator";

export async function getDashboardRoleForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<DashboardRole | null> {
  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  const r = String((data as { role?: string }).role ?? "");
  if (r === "admin" || r === "moderator") return r;
  return null;
}

export type DashboardAuthOk = {
  ok: true;
  user: User;
  role: DashboardRole;
  supabase: Awaited<ReturnType<typeof createSupabaseServerAuthClient>>;
};

export type DashboardAuthFail = { ok: false; response: NextResponse };

/**
 * Validates Supabase session + `public.users.role` in { admin, moderator }.
 * Requires RLS (or equivalent) to allow authenticated users to read their own `users` row.
 */
export async function requireDashboardAuth(): Promise<DashboardAuthOk | DashboardAuthFail> {
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

  return { ok: true, user, role, supabase };
}
