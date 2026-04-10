import { type NextRequest, NextResponse } from "next/server";

import { requireDashboardAccess } from "@/lib/auth/dashboard-access";
import {
  createServiceRoleClient,
  hasServiceRoleKey,
  MISSING_SERVICE_ROLE_CODE,
  SERVICE_ROLE_SETUP_MESSAGE,
} from "@/lib/supabase/service-role";

const PHONE_RE = /^\+\d{10,15}$/;

/**
 * POST /api/admin/moderator/send-otp
 * Body: { phone: string }
 *
 * Sends an OTP to the given phone number via Supabase Auth.
 * Only admins can call this.
 */
export async function POST(request: NextRequest) {
  const access = await requireDashboardAccess();
  if (!access.ok) return access.response;

  if (access.role !== "admin") {
    return NextResponse.json({ error: "Only admins can add moderators." }, { status: 403 });
  }

  if (!hasServiceRoleKey()) {
    return NextResponse.json(
      { error: SERVICE_ROLE_SETUP_MESSAGE, code: MISSING_SERVICE_ROLE_CODE },
      { status: 503 }
    );
  }

  let body: { phone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const phone = (body.phone ?? "").trim();
  if (!PHONE_RE.test(phone)) {
    return NextResponse.json(
      { error: "Phone must be in international format, e.g. +919876543210" },
      { status: 400 }
    );
  }

  try {
    const supabase = createServiceRoleClient();

    // Check if user already exists with this phone
    const { data: existing } = await supabase
      .from("users")
      .select("id, role")
      .eq("phone", phone)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `A user with this phone already exists (role: ${existing.role}).` },
        { status: 409 }
      );
    }

    // Send OTP via Supabase Auth (signInWithOtp creates the auth user if needed)
    const { error: otpErr } = await supabase.auth.signInWithOtp({ phone });

    if (otpErr) {
      return NextResponse.json({ error: otpErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message: "OTP sent to " + phone });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
