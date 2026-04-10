"use client";

import { CommonDataTable, type TableColumn } from "@/components/admin/common-data-table";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";

const LEADS_SELECT = [
  "id",
  "load_id",
  "availability_id",
  "interested_by",
  "contacted_party",
  "status",
  "created_at",
  "interested_user:users!interests_interested_by_fkey(name,phone,role)",
  "contacted_user:users!interests_contacted_party_fkey(name,phone,role)",
].join(",");

const STATUS_STYLES: Record<string, string> = {
  interested: "bg-blue-50 text-blue-700 border-blue-200",
  contacted: "bg-amber-50 text-amber-700 border-amber-200",
  matched: "bg-emerald-50 text-emerald-700 border-emerald-200",
  expired: "bg-gray-50 text-gray-600 border-gray-200",
};

export default function AdminLeadsPage() {
  const columns = useMemo<TableColumn[]>(
    () => [
      {
        key: "interested_user_name",
        label: "Interested party",
        sortable: false,
        editable: false,
        renderCell: (row) => {
          const u = row.interested_user as { name?: string; role?: string } | null;
          return (
            <div>
              <div className="text-sm font-medium text-gray-900">{u?.name ?? "—"}</div>
              <div className="text-xs text-gray-500">{u?.role ?? ""}</div>
            </div>
          );
        },
      },
      {
        key: "contacted_user_name",
        label: "Contacted party",
        sortable: false,
        editable: false,
        renderCell: (row) => {
          const u = row.contacted_user as { name?: string; phone?: string; role?: string } | null;
          return (
            <div>
              <div className="text-sm font-medium text-gray-900">{u?.name ?? "—"}</div>
              <div className="text-xs text-gray-500">{u?.phone ?? ""}</div>
            </div>
          );
        },
      },
      {
        key: "type",
        label: "Type",
        sortable: false,
        editable: false,
        renderCell: (row) => {
          if (row.load_id) return <Badge className="border border-blue-200 bg-blue-50 text-blue-700">Load</Badge>;
          if (row.availability_id) return <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">Availability</Badge>;
          return <span className="text-gray-400">—</span>;
        },
      },
      {
        key: "status",
        label: "Status",
        sortKey: "status",
        sortable: true,
        editable: true,
        type: "enum" as const,
        enumOptions: ["interested", "contacted", "matched", "expired"],
        renderCell: (row) => {
          const s = String(row.status ?? "");
          const style = STATUS_STYLES[s] ?? "bg-gray-50 text-gray-600 border-gray-200";
          return <Badge className={`border ${style}`}>{s}</Badge>;
        },
      },
      {
        key: "created_at",
        label: "Date",
        sortKey: "created_at",
        sortable: true,
        editable: false,
        accessor: (row) => {
          const d = row.created_at;
          if (!d) return "—";
          try {
            return new Date(String(d)).toLocaleDateString(undefined, {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });
          } catch {
            return String(d);
          }
        },
      },
    ],
    []
  );

  return (
    <CommonDataTable
      role="admin"
      title="Leads & Interests"
      description="Marketplace interactions — who expressed interest in which load or availability. Update status as you facilitate connections."
      tableName="interests"
      selectQuery={LEADS_SELECT}
      defaultSort={{ column: "created_at", ascending: false }}
      filters={[
        {
          label: "Status",
          column: "status",
          options: [
            { label: "Interested", value: "interested" },
            { label: "Contacted", value: "contacted" },
            { label: "Matched", value: "matched" },
            { label: "Expired", value: "expired" },
          ],
        },
      ]}
      dateFilter={{ label: "Date", column: "created_at" }}
      columns={columns}
      adminOnlyEdit
      useServiceRoleApi
    />
  );
}
