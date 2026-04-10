import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleKey } from "@/lib/supabase/service-role";

export type DashboardStats = {
  totalUsers: number;
  totalTrucks: number;
  totalLoads: number;
  totalAvailabilities: number;
  openLoads: number;
  activeAvailabilities: number;
  pendingUserVerifications: number;
  pendingTruckVerifications: number;
  unhandledAlerts: number;
  usersByRole: Record<string, number>;
  loadsByStatus: Record<string, number>;
};

function getClient() {
  return hasServiceRoleKey()
    ? createServiceRoleClient()
    : createSupabaseServerClient();
}

async function countTable(
  table: string,
  filter?: { column: string; value: string }
): Promise<number> {
  const supabase = getClient();
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  if (filter) {
    q = q.eq(filter.column, filter.value);
  }
  const { count, error } = await q;
  if (error) {
    console.warn(`[stats] count ${table}`, error.message);
    return 0;
  }
  return count ?? 0;
}

async function countByColumn(
  table: string,
  column: string,
  values: string[]
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  await Promise.all(
    values.map(async (v) => {
      result[v] = await countTable(table, { column, value: v });
    })
  );
  return result;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  try {
    const [
      totalUsers,
      totalTrucks,
      totalLoads,
      totalAvailabilities,
      openLoads,
      activeAvailabilities,
      pendingUserVerifications,
      pendingTruckVerifications,
      unhandledAlerts,
      usersByRole,
      loadsByStatus,
    ] = await Promise.all([
      countTable("users"),
      countTable("trucks"),
      countTable("loads"),
      countTable("availabilities"),
      countTable("loads", { column: "status", value: "open" }),
      countTable("availabilities", { column: "status", value: "available" }),
      countTable("users", { column: "verification_status", value: "pending" }),
      countTable("trucks", { column: "verification_status", value: "pending" }),
      countTable("admin_alerts", { column: "is_handled", value: "false" }),
      countByColumn("users", "role", [
        "shipper",
        "truck_owner",
        "broker",
        "admin",
        "moderator",
      ]),
      countByColumn("loads", "status", [
        "open",
        "matched",
        "cancelled",
        "closed",
      ]),
    ]);

    return {
      totalUsers,
      totalTrucks,
      totalLoads,
      totalAvailabilities,
      openLoads,
      activeAvailabilities,
      pendingUserVerifications,
      pendingTruckVerifications,
      unhandledAlerts,
      usersByRole,
      loadsByStatus,
    };
  } catch (e) {
    console.warn("[stats]", e instanceof Error ? e.message : e);
    return {
      totalUsers: 0,
      totalTrucks: 0,
      totalLoads: 0,
      totalAvailabilities: 0,
      openLoads: 0,
      activeAvailabilities: 0,
      pendingUserVerifications: 0,
      pendingTruckVerifications: 0,
      unhandledAlerts: 0,
      usersByRole: {},
      loadsByStatus: {},
    };
  }
}
