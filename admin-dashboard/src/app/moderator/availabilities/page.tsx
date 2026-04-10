"use client";

import { CommonDataTable } from "@/components/admin/common-data-table";
import { AVAILABILITY_STATUS_OPTIONS } from "@/lib/schema/enums";

const AVAIL_SELECT = [
  "id",
  "owner_id",
  "truck_id",
  "origin_location_id",
  "destination_location_id",
  "current_location",
  "available_from",
  "available_till",
  "expected_rate",
  "status",
  "created_at",
  "users!availabilities_owner_id_fkey(name)",
  "trucks!availabilities_truck_id_fkey(category,variant_id,truck_variants(display_name))",
  "origin:locations!availabilities_origin_location_id_fkey(city,state)",
  "destination:locations!availabilities_destination_location_id_fkey(city,state)",
].join(",");

function formatTruck(row: Record<string, unknown>): string {
  const t = row.trucks as {
    category?: string;
    truck_variants?: { display_name?: string | null };
  } | null;
  const cat = t?.category;
  const vn = t?.truck_variants?.display_name;
  if (cat && vn) return `${cat} · ${vn}`;
  if (cat) return String(cat);
  return "—";
}

function formatRoute(row: Record<string, unknown>): string {
  const o = row.origin as { city?: string; state?: string } | null | undefined;
  const d = row.destination as { city?: string; state?: string } | null | undefined;
  const a = [o?.city, o?.state].filter(Boolean).join(", ");
  const b = [d?.city, d?.state].filter(Boolean).join(", ");
  if (a && b) return `${a} → ${b}`;
  if (row.current_location) return String(row.current_location);
  if (a) return `${a} → …`;
  if (b) return `… → ${b}`;
  return "—";
}

function formatDateRange(row: Record<string, unknown>): string {
  const from = row.available_from;
  const till = row.available_till;
  if (from && till) return `${String(from)} – ${String(till)}`;
  if (from) return String(from);
  return "—";
}

export default function ModeratorAvailabilitiesPage() {
  return (
    <CommonDataTable
      role="moderator"
      title="Availabilities"
      description="Truck availability postings with route, dates, and rates."
      tableName="availabilities"
      selectQuery={AVAIL_SELECT}
      search={{ column: "current_location", placeholder: "Search current location…" }}
      defaultSort={{ column: "available_from", ascending: false }}
      dateFilter={{ label: "Available from", column: "available_from" }}
      filters={[
        {
          label: "Status",
          column: "status",
          options: AVAILABILITY_STATUS_OPTIONS.map((s) => ({ label: s, value: s })),
        },
      ]}
      columns={[
        {
          key: "truck_display",
          label: "Truck",
          sortable: false,
          editable: false,
          accessor: formatTruck,
        },
        {
          key: "owner_display",
          label: "Owner",
          sortable: false,
          editable: false,
          accessor: (row) => {
            const u = row.users as { name?: string | null } | null;
            return u?.name ?? "—";
          },
        },
        {
          key: "route_display",
          label: "Route",
          sortable: false,
          editable: false,
          accessor: formatRoute,
        },
        {
          key: "available_from",
          label: "Dates",
          sortKey: "available_from",
          sortable: true,
          editable: false,
          accessor: formatDateRange,
        },
        {
          key: "expected_rate",
          label: "Rate",
          sortKey: "expected_rate",
          sortable: true,
          editable: false,
          accessor: (row) =>
            row.expected_rate != null
              ? `₹${Number(row.expected_rate).toLocaleString()}`
              : "—",
        },
        {
          key: "status",
          label: "Status",
          sortKey: "status",
          sortable: true,
          editable: false,
          type: "enum",
          enumOptions: [...AVAILABILITY_STATUS_OPTIONS],
        },
      ]}
      statusCloseColumn="status"
      closeValue="closed"
      adminOnlyEdit
      useServiceRoleApi
    />
  );
}
