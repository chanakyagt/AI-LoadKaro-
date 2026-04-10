import { type NextRequest, NextResponse } from "next/server";

import { requireDashboardAccess } from "@/lib/auth/dashboard-access";
import {
  createServiceRoleClient,
  hasServiceRoleKey,
  MISSING_SERVICE_ROLE_CODE,
  SERVICE_ROLE_SETUP_MESSAGE,
} from "@/lib/supabase/service-role";

/**
 * GET /api/admin/verification/submissions
 * Query params:
 *   entity_type  - "user" | "truck" (required)
 *   entity_id    - filter to a specific entity (optional)
 *   status       - "submitted" | "reviewed" (optional, defaults to all)
 */
export async function GET(request: NextRequest) {
  const access = await requireDashboardAccess();
  if (!access.ok) return access.response;

  if (!hasServiceRoleKey()) {
    return NextResponse.json(
      { error: SERVICE_ROLE_SETUP_MESSAGE, code: MISSING_SERVICE_ROLE_CODE },
      { status: 503 }
    );
  }

  const { searchParams } = request.nextUrl;
  const entityType = searchParams.get("entity_type") ?? "";
  if (!["user", "truck"].includes(entityType)) {
    return NextResponse.json({ error: "entity_type must be user or truck" }, { status: 400 });
  }

  const entityId = searchParams.get("entity_id") ?? "";
  const status = searchParams.get("status") ?? "";

  try {
    const supabase = createServiceRoleClient();
    let q = supabase
      .from("verification_submissions")
      .select("*")
      .eq("entity_type", entityType)
      .order("created_at", { ascending: false });

    if (entityId) q = q.eq("entity_id", entityId);
    if (status) q = q.eq("status", status);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
