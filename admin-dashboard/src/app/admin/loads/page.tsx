"use client";

import { CommonDataTable } from "@/components/admin/common-data-table";
import {
  TRUCK_CATEGORY_OPTIONS,
  LOAD_PAYMENT_TYPE_OPTIONS,
  LOAD_STATUS_OPTIONS,
} from "@/lib/schema/enums";

const LOADS_SELECT = [
  "id",
  "posted_by",
  "origin_location_id",
  "destination_location_id",
  "loading_date",
  "truck_category_required",
  "capacity_required",
  "payment_type",
  "advance_percentage",
  "rate_optional",
  "status",
  "created_at",
  "updated_at",
  "users!loads_posted_by_fkey(name)",
  "origin:locations!loads_origin_location_id_fkey(city,state)",
  "destination:locations!loads_destination_location_id_fkey(city,state)",
].join(",");

function formatRoute(row: Record<string, unknown>): string {
  const o = row.origin as { city?: string; state?: string } | null | undefined;
  const d = row.destination as { city?: string; state?: string } | null | undefined;
  const a = [o?.city, o?.state].filter(Boolean).join(", ");
  const b = [d?.city, d?.state].filter(Boolean).join(", ");
  if (a && b) return `${a} → ${b}`;
  if (a) return `${a} → …`;
  if (b) return `… → ${b}`;
  return "—";
}

function daysAgo(dateStr: unknown): string {
  if (!dateStr) return "";
  const d = new Date(String(dateStr));
  if (Number.isNaN(d.getTime())) return "";
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff === 0) return "today";
  if (diff === 1) return "1d ago";
  return `${diff}d ago`;
}

export default function AdminLoadsPage() {
  return (
    <CommonDataTable
      role="admin"
      title="Loads"
      description="All load postings with route, capacity, payment details, and poster info."
      tableName="loads"
      selectQuery={LOADS_SELECT}
      search={{ column: "truck_category_required", placeholder: "Search by truck category…" }}
      defaultSort={{ column: "loading_date", ascending: false }}
      dateFilter={{ label: "Loading date", column: "loading_date" }}
      filters={[
        {
          label: "Status",
          column: "status",
          options: LOAD_STATUS_OPTIONS.map((s) => ({ label: s, value: s })),
        },
        {
          label: "Payment",
          column: "payment_type",
          options: LOAD_PAYMENT_TYPE_OPTIONS.map((s) => ({ label: s, value: s })),
        },
      ]}
      columns={[
        {
          key: "route",
          label: "Route",
          sortable: false,
          editable: false,
          accessor: (row) => formatRoute(row),
        },
        {
          key: "loading_date",
          label: "Loading date",
          sortKey: "loading_date",
          sortable: true,
          editable: true,
          type: "text",
        },
        {
          key: "truck_category_required",
          label: "Category",
          sortKey: "truck_category_required",
          sortable: true,
          editable: true,
          type: "enum",
          enumOptions: [...TRUCK_CATEGORY_OPTIONS],
        },
        {
          key: "capacity_required",
          label: "Capacity",
          sortKey: "capacity_required",
          sortable: true,
          editable: true,
          type: "number",
          accessor: (row) =>
            row.capacity_required != null
              ? `${row.capacity_required} tons`
              : "—",
        },
        {
          key: "payment_type",
          label: "Payment",
          sortKey: "payment_type",
          sortable: true,
          editable: true,
          type: "enum",
          enumOptions: [...LOAD_PAYMENT_TYPE_OPTIONS],
        },
        {
          key: "advance_percentage",
          label: "Advance %",
          sortKey: "advance_percentage",
          sortable: true,
          editable: true,
          type: "number",
          accessor: (row) =>
            row.advance_percentage != null
              ? `${row.advance_percentage}%`
              : "—",
          hiddenByDefault: true,
        },
        {
          key: "rate_optional",
          label: "Rate",
          sortKey: "rate_optional",
          sortable: true,
          editable: true,
          type: "number",
          accessor: (row) =>
            row.rate_optional != null
              ? `₹${Number(row.rate_optional).toLocaleString()}`
              : "—",
        },
        {
          key: "status",
          label: "Status",
          sortKey: "status",
          sortable: true,
          editable: true,
          type: "enum",
          enumOptions: [...LOAD_STATUS_OPTIONS],
        },
        {
          key: "posted_by_name",
          label: "Posted by",
          sortable: false,
          editable: false,
          accessor: (row) => {
            const u = row.users as { name?: string | null } | null;
            return u?.name ?? "—";
          },
        },
        {
          key: "created_at",
          label: "Age",
          sortKey: "created_at",
          sortable: true,
          editable: false,
          accessor: (row) => daysAgo(row.created_at),
          hiddenByDefault: true,
        },
      ]}
      statusCloseColumn="status"
      closeValue="closed"
      allowDelete
      adminOnlyEdit
      useServiceRoleApi
    />
  );
}
