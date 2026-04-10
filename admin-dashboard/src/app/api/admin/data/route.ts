import { type NextRequest, NextResponse } from "next/server";

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
  "locations",
  "truck_variants",
  "verification_submissions",
  "verification_documents",
  "audit_log",
  "interests",
]);

const ADMIN_ONLY_TABLES = new Set(["admin_alerts"]);

/** PostgREST select: columns, commas, embeds, spaces */
const SELECT_SAFE = /^[\w\-,.*! ():]+$/;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function coerceFilterValue(column: string, val: string): string | boolean {
  if (val !== "true" && val !== "false") return val;
  if (column === "is_handled" || column === "gps_available") {
    return val === "true";
  }
  return val;
}

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
  const table = searchParams.get("table") ?? "";
  if (!ALLOWED_TABLES.has(table)) {
    return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  }

  if (ADMIN_ONLY_TABLES.has(table) && access.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const selectRaw = (searchParams.get("select") ?? "*").trim();
  if (selectRaw.length > 8000 || !SELECT_SAFE.test(selectRaw)) {
    return NextResponse.json({ error: "Invalid select parameter" }, { status: 400 });
  }

  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || "25")));
  const sortColumn = (searchParams.get("sortColumn") || "id").trim();
  if (!/^[\w]+$/.test(sortColumn)) {
    return NextResponse.json({ error: "Invalid sort column" }, { status: 400 });
  }
  const sortAsc = searchParams.get("sortAsc") !== "false";
  const searchColumn = (searchParams.get("searchColumn") || "").trim();
  const searchValue = searchParams.get("searchValue") || "";
  const filtersRaw = searchParams.get("filters") || "{}";
  let filterValues: Record<string, string> = {};
  try {
    filterValues = JSON.parse(filtersRaw) as Record<string, string>;
  } catch {
    return NextResponse.json({ error: "Invalid filters JSON" }, { status: 400 });
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const supabase = createServiceRoleClient();
    let q = supabase.from(table).select(selectRaw, { count: "exact" });
    q = q.order(sortColumn, { ascending: sortAsc });
    if (searchColumn && searchValue.trim()) {
      const raw = searchValue.trim();
      if (UUID_RE.test(raw)) {
        q = q.eq(searchColumn, raw);
      } else {
        q = q.ilike(searchColumn, `%${raw}%`);
      }
    }
    Object.entries(filterValues).forEach(([col, val]) => {
      if (val) q = q.eq(col, coerceFilterValue(col, val));
    });
    const dateColumn = (searchParams.get("dateColumn") || "").trim();
    const dateFrom = (searchParams.get("dateFrom") || "").trim();
    const dateTo = (searchParams.get("dateTo") || "").trim();
    if (dateColumn && /^[\w]+$/.test(dateColumn)) {
      if (dateFrom) q = q.gte(dateColumn, dateFrom);
      if (dateTo) q = q.lte(dateColumn, dateTo);
    }
    const { data, error, count } = await q.range(from, to);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ data: data ?? [], count: count ?? 0 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
