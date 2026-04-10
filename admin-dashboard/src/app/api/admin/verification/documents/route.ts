import { type NextRequest, NextResponse } from "next/server";

import { requireDashboardAccess } from "@/lib/auth/dashboard-access";
import {
  createServiceRoleClient,
  hasServiceRoleKey,
  MISSING_SERVICE_ROLE_CODE,
  SERVICE_ROLE_SETUP_MESSAGE,
} from "@/lib/supabase/service-role";

/**
 * GET /api/admin/verification/documents?submission_id=...
 * Returns document rows for a specific submission.
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

  const submissionId = request.nextUrl.searchParams.get("submission_id") ?? "";
  if (!submissionId) {
    return NextResponse.json({ error: "submission_id is required" }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("verification_documents")
      .select("*")
      .eq("submission_id", submissionId)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
