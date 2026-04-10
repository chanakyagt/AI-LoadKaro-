"use client";

import { CommonDataTable } from "@/components/admin/common-data-table";
import {
  USER_ROLE_OPTIONS,
  USER_VERIFICATION_STATUS_OPTIONS,
} from "@/lib/schema/enums";

export default function AdminUsersPage() {
  return (
    <CommonDataTable
      role="admin"
      title="Users"
      description="Manage all users with search, filters, verification, edits, and deletes."
      tableName="users"
      selectQuery="id,name,phone,role,verification_status,subscription_type,created_at"
      search={{ column: "phone", placeholder: "Search by phone..." }}
      filters={[
        {
          label: "Role",
          column: "role",
          options: USER_ROLE_OPTIONS.map((r) => ({ label: r, value: r })),
        },
        {
          label: "Verification",
          column: "verification_status",
          options: USER_VERIFICATION_STATUS_OPTIONS.map((r) => ({
            label: r,
            value: r,
          })),
        },
      ]}
      defaultSort={{ column: "created_at", ascending: false }}
      columns={[
        { key: "name", label: "name", sortable: true, editable: true, type: "text" },
        { key: "phone", label: "phone", sortable: true, editable: false },
        {
          key: "role",
          label: "role",
          sortable: true,
          editable: true,
          type: "enum",
          enumOptions: [...USER_ROLE_OPTIONS],
        },
        {
          key: "verification_status",
          label: "verification_status",
          sortable: true,
          editable: true,
          type: "enum",
          enumOptions: [...USER_VERIFICATION_STATUS_OPTIONS],
        },
        {
          key: "subscription_type",
          label: "subscription_type",
          sortable: true,
          editable: true,
          type: "text",
        },
        { key: "created_at", label: "created_at", sortable: true, editable: false },
      ]}
      verificationColumn="verification_status"
      verificationDocsEntityType="user"
      allowDelete
      adminOnlyEdit
      useServiceRoleApi
    />
  );
}
