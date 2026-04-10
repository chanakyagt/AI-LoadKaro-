"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BYPASS_ROLE_COOKIE } from "@/lib/auth/bypass";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7;

function setBypassRoleCookie(role: "admin" | "moderator") {
  document.cookie = `${BYPASS_ROLE_COOKIE}=${role}; path=/; max-age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
}

function go(path: string) {
  window.setTimeout(() => window.location.assign(path), 0);
}

export default function LoginPage() {
  const bypass =
    process.env.NEXT_PUBLIC_DASHBOARD_BYPASS_AUTH === "true";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    const e = email.trim();
    if (!e || !password) {
      setError("Enter email and password.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: signErr } = await supabase.auth.signInWithPassword({
        email: e,
        password,
      });
      if (signErr) {
        setError(signErr.message);
        return;
      }
      const user = data.user;
      if (!user) {
        setError("Sign-in failed.");
        return;
      }

      const { data: profile, error: profileErr } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr) {
        setError(profileErr.message);
        await supabase.auth.signOut();
        return;
      }

      const role = String((profile as { role?: string } | null)?.role ?? "");
      if (role !== "admin" && role !== "moderator") {
        await supabase.auth.signOut();
        setError("This account is not authorized for LoadKaro Admin.");
        return;
      }

      const dest = role === "admin" ? "/admin/dashboard" : "/moderator/dashboard";
      window.location.assign(dest);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f9fafb] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#e5e7eb] bg-white p-8 shadow-sm">
        <h1 className="text-center text-xl font-bold text-[#111827]">
          LoadKaro Admin
        </h1>
        <p className="mt-2 text-center text-sm text-[#6b7280]">
          {bypass
            ? "Dev mode: auth bypass is on — open the dashboard without Supabase login."
            : "Sign in with your dashboard account (Supabase Auth)."}
        </p>

        {bypass ? (
          <div className="mt-8 space-y-3">
            <Button
              type="button"
              className="w-full bg-[#111827] text-white hover:bg-[#111827]/90"
              onClick={() => {
                setBypassRoleCookie("admin");
                go("/admin/dashboard");
              }}
            >
              Open admin dashboard
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full border-[#e5e7eb] text-[#374151]"
              onClick={() => {
                setBypassRoleCookie("moderator");
                go("/moderator/dashboard");
              }}
            >
              Open moderator dashboard
            </Button>
            <p className="pt-4 text-center text-xs text-[#9ca3af]">
              Or use email/password below when you have accounts set up.
            </p>
          </div>
        ) : null}

        <form
          className={`${bypass ? "mt-6 border-t border-[#e5e7eb] pt-6" : "mt-8"} space-y-6`}
          onSubmit={(e) => {
            e.preventDefault();
            void handleLogin();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[#374151]">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-[#e5e7eb] bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-[#374151]">
              Password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-[#e5e7eb] bg-white"
            />
          </div>
          {error ? (
            <p className="text-sm text-[#991b1b]" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#111827] text-white hover:bg-[#111827]/90"
          >
            {loading ? "Signing in…" : "Sign in with Supabase"}
          </Button>
        </form>
      </div>
    </div>
  );
}
