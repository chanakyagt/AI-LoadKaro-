import { type NextRequest, NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit";
import { requireDashboardAccess } from "@/lib/auth/dashboard-access";
import {
  createServiceRoleClient,
  hasServiceRoleKey,
  MISSING_SERVICE_ROLE_CODE,
  SERVICE_ROLE_SETUP_MESSAGE,
} from "@/lib/supabase/service-role";

/**
 * POST /api/admin/verification/decision
 * Body: {
 *   entity_type: "user" | "truck",
 *   entity_id: string,
 *   submission_id: string,
 *   decision: "verified" | "rejected",
 *   reason?: string
 * }
 */
export async function POST(request: NextRequest) {
  const access = await requireDashboardAccess();
  if (!access.ok) return access.response;

  if (!hasServiceRoleKey()) {
    return NextResponse.json(
      { error: SERVICE_ROLE_SETUP_MESSAGE, code: MISSING_SERVICE_ROLE_CODE },
      { status: 503 }
    );
  }

  let body: {
    entity_type?: string;
    entity_id?: string;
    submission_id?: string;
    decision?: string;
    reason?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const entityType = body.entity_type ?? "";
  const entityId = body.entity_id ?? "";
  const submissionId = body.submission_id ?? "";
  const decision = body.decision ?? "";
  const reason = body.reason ?? "";

  if (!["user", "truck"].includes(entityType)) {
    return NextResponse.json({ error: "entity_type must be user or truck" }, { status: 400 });
  }
  if (!entityId || !submissionId) {
    return NextResponse.json({ error: "entity_id and submission_id are required" }, { status: 400 });
  }
  if (!["verified", "rejected"].includes(decision)) {
    return NextResponse.json({ error: "decision must be verified or rejected" }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();

    // 1. Update entity verification_status
    const table = entityType === "user" ? "users" : "trucks";
    const { error: statusErr } = await supabase
      .from(table)
      .update({ verification_status: decision })
      .eq("id", entityId);

    if (statusErr) {
      return NextResponse.json({ error: statusErr.message }, { status: 400 });
    }

    // 2. Mark submission as reviewed
    const { error: subErr } = await supabase
      .from("verification_submissions")
      .update({
        status: "reviewed",
        review_decision: decision,
        reviewed_at: new Date().toISOString(),
        ...(access.userId ? { reviewed_by: access.userId } : {}),
        ...(reason ? { rejection_reason: reason } : {}),
      })
      .eq("id", submissionId);

    if (subErr) {
      return NextResponse.json({ error: subErr.message }, { status: 400 });
    }

    void writeAuditLog({
      actorId: access.userId,
      actorRole: access.role,
      action: "review_verification",
      entityType,
      entityId,
      details: { decision, submissionId, reason: reason || undefined },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
