import { type NextRequest, NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit";
import { filterPatchByAllowlist } from "@/lib/admin/patch-allowlist";
import { requireDashboardAccess } from "@/lib/auth/dashboard-access";
import {
  createServiceRoleClient,
  hasServiceRoleKey,
  MISSING_SERVICE_ROLE_CODE,
  SERVICE_ROLE_SETUP_MESSAGE,
} from "@/lib/supabase/service-role";

const ALLOWED_TABLES = new Set([
  "loads",
  "availabilities",
  "trucks",
  "users",
  "admin_alerts",
  "interests",
]);

const ADMIN_ONLY_TABLES = new Set(["admin_alerts"]);

async function requireServiceRole() {
  if (!hasServiceRoleKey()) {
    return NextResponse.json(
      { error: SERVICE_ROLE_SETUP_MESSAGE, code: MISSING_SERVICE_ROLE_CODE },
      { status: 503 }
    );
  }
  return null;
}

function deriveAction(
  table: string,
  patch: Record<string, unknown>
): string {
  if (table === "admin_alerts" && patch.is_handled === true)
    return "mark_alert_handled";
  if (
    (table === "users" || table === "trucks") &&
    typeof patch.verification_status === "string"
  ) {
    const v = patch.verification_status as string;
    if (v === "verified") return `verify_${table === "users" ? "user" : "truck"}`;
    if (v === "rejected") return `reject_${table === "users" ? "user" : "truck"}`;
  }
  if (patch.status === "closed") return "close_record";
  return "update_record";
}

export async function PATCH(request: NextRequest) {
  const access = await requireDashboardAccess();
  if (!access.ok) return access.response;

  const denied = await requireServiceRole();
  if (denied) return denied;

  let body: {
    table?: string;
    id?: string;
    idField?: string;
    patch?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const table = body.table ?? "";
  const id = body.id ?? "";
  const idField = body.idField ?? "id";
  const patch = body.patch ?? {};

  if (!ALLOWED_TABLES.has(table) || !id || typeof patch !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (ADMIN_ONLY_TABLES.has(table) && access.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let sanitized = filterPatchByAllowlist(table, access.role, patch);
  if (!sanitized) {
    return NextResponse.json(
      { error: "No allowed fields to update" },
      { status: 400 }
    );
  }

  if (table === "admin_alerts" && sanitized.is_handled === true) {
    sanitized = {
      ...sanitized,
      handled_at: new Date().toISOString(),
      ...(access.userId ? { handled_by: access.userId } : {}),
    };
  }

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from(table)
      .update(sanitized)
      .eq(idField, id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });

    void writeAuditLog({
      actorId: access.userId,
      actorRole: access.role,
      action: deriveAction(table, sanitized) as never,
      entityType: table,
      entityId: id,
      details: { fields: sanitized },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const access = await requireDashboardAccess();
  if (!access.ok) return access.response;

  if (access.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const denied = await requireServiceRole();
  if (denied) return denied;

  let body: { table?: string; id?: string; idField?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const table = body.table ?? "";
  const id = body.id ?? "";
  const idField = body.idField ?? "id";

  if (!ALLOWED_TABLES.has(table) || !id) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (ADMIN_ONLY_TABLES.has(table)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from(table)
      .delete()
      .eq(idField, id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });

    void writeAuditLog({
      actorId: access.userId,
      actorRole: access.role,
      action: "delete_record",
      entityType: table,
      entityId: id,
      details: {},
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
