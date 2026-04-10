"use client";

import { CommonDataTable } from "@/components/admin/common-data-table";
import {
  TRUCK_CATEGORY_OPTIONS,
  TRUCK_PERMIT_TYPE_OPTIONS,
  TRUCK_VERIFICATION_STATUS_OPTIONS,
} from "@/lib/schema/enums";

const TRUCK_SELECT = [
  "id",
  "category",
  "variant_id",
  "capacity_tons",
  "gps_available",
  "permit_type",
  "owner_id",
  "verification_status",
  "created_at",
  "updated_at",
  "truck_variants(display_name)",
  "users!trucks_owner_id_fkey(name)",
].join(",");

export default function AdminTrucksPage() {
  return (
    <CommonDataTable
      role="admin"
      title="Trucks"
      description="Trucks joined to variant display names and owner names (read from your schema)."
      tableName="trucks"
      selectQuery={TRUCK_SELECT}
      search={{ column: "category", placeholder: "Search by category…" }}
      defaultSort={{ column: "created_at", ascending: false }}
      verificationTriggerStatuses={["unverified"]}
      columns={[
        {
          key: "category",
          label: "category",
          sortable: true,
          editable: true,
          type: "enum",
          enumOptions: [...TRUCK_CATEGORY_OPTIONS],
        },
        {
          key: "variant",
          label: "variant",
          persistKey: "variant_id",
          sortKey: "variant_id",
          sortable: true,
          editable: true,
          accessor: (row) => {
            const tv = row.truck_variants as { display_name?: string } | null;
            const name = tv?.display_name;
            return name ?? String(row.variant_id ?? "—");
          },
        },
        {
          key: "capacity_tons",
          label: "capacity",
          sortable: true,
          editable: true,
          type: "number",
        },
        {
          key: "gps_available",
          label: "gps",
          sortKey: "gps_available",
          sortable: true,
          editable: true,
          type: "boolean",
          accessor: (row) =>
            row.gps_available === true ? "Yes" : row.gps_available === false ? "No" : "—",
        },
        {
          key: "permit_type",
          label: "permit",
          sortable: true,
          editable: true,
          type: "enum",
          enumOptions: [...TRUCK_PERMIT_TYPE_OPTIONS],
        },
        {
          key: "owner_name",
          label: "owner_name",
          sortable: false,
          editable: false,
          accessor: (row) => {
            const u = row.users as { name?: string | null } | null;
            return u?.name ?? String(row.owner_id ?? "—");
          },
        },
        {
          key: "verification_status",
          label: "verification_status",
          sortKey: "verification_status",
          sortable: true,
          editable: true,
          type: "enum",
          enumOptions: [...TRUCK_VERIFICATION_STATUS_OPTIONS],
        },
      ]}
      verificationColumn="verification_status"
      verificationDocsEntityType="truck"
      allowDelete
      adminOnlyEdit
      useServiceRoleApi
    />
  );
}
