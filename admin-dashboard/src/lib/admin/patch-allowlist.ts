import type { DashboardRole } from "@/lib/auth/dashboard-role";

/** Columns the UI may PATCH per table; anything else is dropped (then rejected if empty). */
const PATCH_BY_TABLE: Record<string, Record<DashboardRole, Set<string>>> = {
  users: {
    admin: new Set(["name", "role", "verification_status", "subscription_type"]),
    moderator: new Set(["verification_status"]),
  },
  loads: {
    admin: new Set([
      "loading_date",
      "truck_category_required",
      "capacity_required",
      "payment_type",
      "advance_percentage",
      "rate_optional",
      "status",
      "origin_location_id",
      "destination_location_id",
    ]),
    moderator: new Set(["status"]),
  },
  trucks: {
    admin: new Set([
      "category",
      "variant_id",
      "capacity_tons",
      "gps_available",
      "permit_type",
      "verification_status",
    ]),
    moderator: new Set(["verification_status"]),
  },
  availabilities: {
    admin: new Set([
      "available_from",
      "available_till",
      "expected_rate",
      "status",
      "current_location",
      "preferred_destination_1",
      "preferred_destination_2",
      "origin_location_id",
      "destination_location_id",
    ]),
    moderator: new Set(["status"]),
  },
  admin_alerts: {
    admin: new Set(["is_handled"]),
    moderator: new Set([]),
  },
  interests: {
    admin: new Set(["status"]),
    moderator: new Set(["status"]),
  },
};

const SENSITIVE = new Set(["phone", "email"]);

export function filterPatchByAllowlist(
  table: string,
  role: DashboardRole,
  patch: Record<string, unknown>
): Record<string, unknown> | null {
  const allowed = PATCH_BY_TABLE[table]?.[role];
  if (!allowed) return null;

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(patch)) {
    if (SENSITIVE.has(key)) continue;
    if (!allowed.has(key)) continue;
    out[key] = val;
  }
  if (Object.keys(out).length === 0) return null;
  return out;
}
