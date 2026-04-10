import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { DashboardRole } from "@/lib/auth/dashboard-role";
import { isDashboardAuthBypassed } from "@/lib/auth/bypass";

function supabasePublicEnv() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_KEY?.trim() ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim() ||
    "";
  return { url, key };
}

export async function middleware(request: NextRequest) {
  if (isDashboardAuthBypassed()) {
    return NextResponse.next();
  }

  const { url: supabaseUrl, key: supabaseAnonKey } = supabasePublicEnv();

  let supabaseResponse = NextResponse.next({ request });

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  let role: DashboardRole | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const r = String((profile as { role?: string } | null)?.role ?? "");
    if (r === "admin" || r === "moderator") role = r;
  }

  if (pathname.startsWith("/admin")) {
    if (!user || role !== "admin") {
      const u = new URL("/login", request.url);
      u.searchParams.set("next", pathname);
      return NextResponse.redirect(u);
    }
  }

  if (pathname.startsWith("/moderator")) {
    if (!user || role !== "moderator") {
      const u = new URL("/login", request.url);
      u.searchParams.set("next", pathname);
      return NextResponse.redirect(u);
    }
  }

  if (pathname === "/login" && user && role) {
    const next = request.nextUrl.searchParams.get("next");
    const safe =
      next?.startsWith("/admin/") || next?.startsWith("/moderator/")
        ? next
        : null;
    const dest =
      safe ?? (role === "admin" ? "/admin/dashboard" : "/moderator/dashboard");
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/moderator/:path*",
    "/login",
    "/api/admin/:path*",
  ],
};
