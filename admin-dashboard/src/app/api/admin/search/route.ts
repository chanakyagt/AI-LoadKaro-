import { type NextRequest, NextResponse } from "next/server";

import { requireDashboardAccess } from "@/lib/auth/dashboard-access";
import {
  createServiceRoleClient,
  hasServiceRoleKey,
  MISSING_SERVICE_ROLE_CODE,
  SERVICE_ROLE_SETUP_MESSAGE,
} from "@/lib/supabase/service-role";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SearchResult = {
  type: "user" | "truck" | "load";
  id: string;
  title: string;
  subtitle: string;
};

/**
 * GET /api/admin/search?q=...
 * Searches users (name, phone), trucks (category), loads (truck_category_required)
 * in parallel. Returns up to 5 results per entity type.
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

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const supabase = createServiceRoleClient();
  const isUuid = UUID_RE.test(q);
  const results: SearchResult[] = [];

  try {
    const searches = [];

    // Users: search by name, phone, or exact ID
    searches.push(
      (async () => {
        let uq = supabase
          .from("users")
          .select("id, name, phone, role")
          .limit(5);
        if (isUuid) {
          uq = uq.eq("id", q);
        } else {
          uq = uq.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
        }
        const { data } = await uq;
        (data ?? []).forEach((u) => {
          results.push({
            type: "user",
            id: u.id,
            title: u.name ?? u.phone ?? "—",
            subtitle: `${u.role ?? "user"} · ${u.phone ?? ""}`,
          });
        });
      })()
    );

    // Trucks: search by category or exact ID
    searches.push(
      (async () => {
        let tq = supabase
          .from("trucks")
          .select("id, category, capacity_tons, users!trucks_owner_id_fkey(name)")
          .limit(5);
        if (isUuid) {
          tq = tq.eq("id", q);
        } else {
          tq = tq.ilike("category", `%${q}%`);
        }
        const { data } = await tq;
        (data ?? []).forEach((t) => {
          const owner = (t as Record<string, unknown>).users as { name?: string } | null;
          results.push({
            type: "truck",
            id: t.id,
            title: `${t.category ?? "truck"} · ${t.capacity_tons ?? "—"} tons`,
            subtitle: `Owner: ${owner?.name ?? "—"}`,
          });
        });
      })()
    );

    // Loads: search by category or exact ID
    searches.push(
      (async () => {
        let lq = supabase
          .from("loads")
          .select(
            "id, truck_category_required, status, loading_date, origin:locations!loads_origin_location_id_fkey(city,state), destination:locations!loads_destination_location_id_fkey(city,state)"
          )
          .limit(5);
        if (isUuid) {
          lq = lq.eq("id", q);
        } else {
          lq = lq.ilike("truck_category_required", `%${q}%`);
        }
        const { data } = await lq;
        (data ?? []).forEach((l) => {
          const o = (l as Record<string, unknown>).origin as { city?: string } | null;
          const d = (l as Record<string, unknown>).destination as { city?: string } | null;
          const route = [o?.city, d?.city].filter(Boolean).join(" → ") || "—";
          results.push({
            type: "load",
            id: l.id,
            title: `${l.truck_category_required ?? "load"} · ${l.status ?? ""}`,
            subtitle: `${route} · ${l.loading_date ?? ""}`,
          });
        });
      })()
    );

    await Promise.all(searches);

    return NextResponse.json({ results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Search failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
