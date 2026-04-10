"use client";

import { CommonDataTable } from "@/components/admin/common-data-table";
import {
  USER_ROLE_OPTIONS,
  USER_VERIFICATION_STATUS_OPTIONS,
} from "@/lib/schema/enums";

export default function ModeratorUsersPage() {
  return (
    <CommonDataTable
      role="moderator"
      title="Users"
      description="Moderate users, search by phone, and process verification actions."
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
        { key: "name", label: "name", sortable: true, editable: false },
        { key: "phone", label: "phone", sortable: true, editable: false },
        {
          key: "role",
          label: "role",
          sortable: true,
          editable: false,
          type: "enum",
          enumOptions: [...USER_ROLE_OPTIONS],
        },
        {
          key: "verification_status",
          label: "verification_status",
          sortable: true,
          editable: false,
          type: "enum",
          enumOptions: [...USER_VERIFICATION_STATUS_OPTIONS],
        },
        { key: "subscription_type", label: "subscription_type", sortable: true, editable: false },
        { key: "created_at", label: "created_at", sortable: true, editable: false },
      ]}
      verificationColumn="verification_status"
      verificationDocsEntityType="user"
      adminOnlyEdit
      useServiceRoleApi
    />
  );
}
