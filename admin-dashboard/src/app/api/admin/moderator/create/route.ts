import { type NextRequest, NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit";
import { requireDashboardAccess } from "@/lib/auth/dashboard-access";
import {
  createServiceRoleClient,
  hasServiceRoleKey,
  MISSING_SERVICE_ROLE_CODE,
  SERVICE_ROLE_SETUP_MESSAGE,
} from "@/lib/supabase/service-role";

const PHONE_RE = /^\+\d{10,15}$/;

/**
 * POST /api/admin/moderator/create
 * Body: { phone: string, otp: string, name: string }
 *
 * 1. Verifies the OTP via Supabase Auth
 * 2. Creates/upserts the public.users row with role = moderator
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

  let body: { phone?: string; otp?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const phone = (body.phone ?? "").trim();
  const otp = (body.otp ?? "").trim();
  const name = (body.name ?? "").trim();

  if (!PHONE_RE.test(phone)) {
    return NextResponse.json(
      { error: "Phone must be in international format, e.g. +919876543210" },
      { status: 400 }
    );
  }
  if (!otp || otp.length < 4) {
    return NextResponse.json({ error: "Enter the OTP sent to the phone." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();

    // Verify OTP
    const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: "sms",
    });

    if (verifyErr) {
      return NextResponse.json({ error: verifyErr.message }, { status: 400 });
    }

    const authUser = verifyData.user;
    if (!authUser?.id) {
      return NextResponse.json({ error: "OTP verification failed — no user returned." }, { status: 400 });
    }

    // Check if users row already exists (e.g. from mobile signup)
    const { data: existing } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", authUser.id)
      .maybeSingle();

    if (existing) {
      // Update role to moderator
      const { error: updErr } = await supabase
        .from("users")
        .update({ role: "moderator", name })
        .eq("id", authUser.id);

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 400 });
      }

      return NextResponse.json({
        ok: true,
        message: `User upgraded to moderator: ${name} (${phone})`,
        userId: authUser.id,
      });
    }

    // Insert new users row
    const { error: insertErr } = await supabase.from("users").insert({
      id: authUser.id,
      name,
      phone,
      role: "moderator",
      verification_status: "verified",
    });

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 400 });
    }

    void writeAuditLog({
      actorId: access.userId,
      actorRole: access.role,
      action: "create_moderator",
      entityType: "user",
      entityId: authUser.id,
      details: { name, phone },
    });

    return NextResponse.json({
      ok: true,
      message: `Moderator created: ${name} (${phone})`,
      userId: authUser.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
