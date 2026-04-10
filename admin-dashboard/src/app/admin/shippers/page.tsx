"use client";

import { CommonDataTable } from "@/components/admin/common-data-table";
import {
  USER_ROLE_OPTIONS,
  USER_VERIFICATION_STATUS_OPTIONS,
} from "@/lib/schema/enums";

export default function AdminShippersPage() {
  return (
    <CommonDataTable
      role="admin"
      title="Shippers"
      description="Shipper accounts — search, filter, verify, review documents, edit, and delete."
      tableName="users"
      selectQuery="id,name,phone,role,verification_status,subscription_type,created_at"
      search={{ column: "phone", placeholder: "Search by phone…" }}
      dateFilter={{ label: "Joined", column: "created_at" }}
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
        {
          key: "name",
          label: "Name",
          sortable: true,
          editable: true,
          type: "text",
        },
        {
          key: "phone",
          label: "Phone",
          sortable: true,
          editable: false,
        },
        {
          key: "role",
          label: "Role",
          sortable: true,
          editable: true,
          type: "enum",
          enumOptions: [...USER_ROLE_OPTIONS],
        },
        {
          key: "verification_status",
          label: "Verification",
          sortKey: "verification_status",
          sortable: true,
          editable: true,
          type: "enum",
          enumOptions: [...USER_VERIFICATION_STATUS_OPTIONS],
        },
        {
          key: "subscription_type",
          label: "Subscription",
          sortable: true,
          editable: true,
          type: "text",
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
      allowDelete
      adminOnlyEdit
      useServiceRoleApi
    />
  );
}
