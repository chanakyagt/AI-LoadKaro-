import { type NextRequest, NextResponse } from "next/server";

import { requireDashboardAccess } from "@/lib/auth/dashboard-access";
import {
  createServiceRoleClient,
  hasServiceRoleKey,
  MISSING_SERVICE_ROLE_CODE,
  SERVICE_ROLE_SETUP_MESSAGE,
} from "@/lib/supabase/service-role";

/**
 * POST /api/admin/verification/signed-url
 * Body: { bucket: string, path: string }
 * Returns a short-lived signed URL for private storage objects.
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

  let body: { bucket?: string; path?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bucket = body.bucket ?? "";
  const path = body.path ?? "";
  if (!bucket || !path) {
    return NextResponse.json({ error: "bucket and path are required" }, { status: 400 });
  }

  if (bucket !== "verification-docs") {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 300);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ signedUrl: data.signedUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
