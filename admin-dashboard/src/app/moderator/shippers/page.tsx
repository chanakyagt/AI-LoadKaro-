"use client";

import { CommonDataTable } from "@/components/admin/common-data-table";
import { USER_VERIFICATION_STATUS_OPTIONS } from "@/lib/schema/enums";

export default function ModeratorShippersPage() {
  return (
    <CommonDataTable
      role="moderator"
      title="Shippers"
      description="Shipper accounts — view, filter, verify, and review documents."
      tableName="users"
      selectQuery="id,name,phone,role,verification_status,subscription_type,created_at"
      search={{ column: "phone", placeholder: "Search by phone…" }}
      filters={[
        {
          label: "Verification",
          column: "verification_status",
          options: USER_VERIFICATION_STATUS_OPTIONS.map((v) => ({
            label: v,
            value: v,
          })),
        },
        {
          label: "Role",
          column: "role",
          options: [{ label: "shipper", value: "shipper" }],
        },
      ]}
      defaultSort={{ column: "created_at", ascending: false }}
      columns={[
        { key: "name", label: "Name", sortable: true, editable: false },
        { key: "phone", label: "Phone", sortable: true, editable: false },
        {
          key: "verification_status",
          label: "Verification",
          sortKey: "verification_status",
          sortable: true,
          editable: false,
          type: "enum",
          enumOptions: [...USER_VERIFICATION_STATUS_OPTIONS],
        },
        {
          key: "subscription_type",
          label: "Subscription",
          sortable: true,
          editable: false,
        },
        {
          key: "created_at",
          label: "Joined",
          sortKey: "created_at",
          sortable: true,
          editable: false,
        },
      ]}
      verificationColumn="verification_status"
      verificationDocsEntityType="user"
      adminOnlyEdit
      useServiceRoleApi
    />
  );
}
