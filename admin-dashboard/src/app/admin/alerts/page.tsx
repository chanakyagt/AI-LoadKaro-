"use client";

import { useMemo } from "react";

import { CommonDataTable, type TableColumn } from "@/components/admin/common-data-table";
import { Badge } from "@/components/ui/badge";

type CityState = { city?: string | null; state?: string | null };

function isHandledFlag(v: unknown): boolean {
  if (v === true) return true;
  if (v === false || v == null) return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "false" || s === "0") return false;
    if (s === "true" || s === "1") return true;
  }
  return Boolean(v);
}

function formatAlertWhen(v: unknown): string {
  if (v == null || v === "") return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCityState(v: unknown): string {
  const loc = v as CityState | null | undefined;
  const city = loc?.city?.trim?.() ? String(loc.city).trim() : "";
  const state = loc?.state?.trim?.() ? String(loc.state).trim() : "";
  const parts = [city, state].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

function shortId(id: string): string {
  const s = id.trim();
  if (!s) return "";
  if (s.length <= 14) return s;
  return `${s.slice(0, 8)}…${s.slice(-6)}`;
}

function HandledByCell({ value }: { value: unknown }) {
  const id = value == null || value === "" ? "" : String(value).trim();
  if (!id) {
    return <span className="text-[#9ca3af]">—</span>;
  }
  return (
    <span
      className="inline-flex max-w-42 items-center rounded-lg border border-[#d1d5db] bg-[#f3f4f6] px-2 py-1 text-[11px] leading-none text-[#6b7280] shadow-sm"
      style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
      title={id}
    >
      {shortId(id)}
    </span>
  );
}

export default function AdminAlertsPage() {
  const selectQuery = useMemo(() => {
    // Embed load details so we can show shipper + route instead of a raw UUID.
    // NOTE: FK name is expected to be the default `admin_alerts_load_id_fkey`.
    const loadEmbed = [
      "posted_by",
      "users!loads_posted_by_fkey(name)",
      "origin:locations!loads_origin_location_id_fkey(city,state)",
      "destination:locations!loads_destination_location_id_fkey(city,state)",
    ].join(",");
    return `id,load_id,created_at,is_handled,handled_at,handled_by,load:loads!admin_alerts_load_id_fkey(${loadEmbed})`;
  }, []);

  const columns = useMemo<TableColumn[]>(
    () => [
      {
        key: "shipper",
        label: "Shipper",
        sortable: false,
        editable: false,
        renderCell: (row) => {
          const load = row.load as
            | {
                posted_by?: string | null;
                users?: { name?: string | null } | null;
                origin?: CityState | null;
              }
            | null
            | undefined;
          const name = load?.users?.name?.trim?.()
            ? String(load?.users?.name).trim()
            : load?.posted_by
              ? String(load.posted_by)
              : "—";
          const loc = formatCityState(load?.origin);
          return (
            <div className="min-w-48">
              <div className="text-sm font-medium text-[#111827]">{name}</div>
              <div className="text-xs text-[#6b7280]">{loc}</div>
            </div>
          );
        },
      },
      {
        key: "route",
        label: "From → To",
        sortable: false,
        editable: false,
        renderCell: (row) => {
          const load = row.load as
            | { origin?: CityState | null; destination?: CityState | null }
            | null
            | undefined;
          const from = formatCityState(load?.origin);
          const to = formatCityState(load?.destination);
          return (
            <span className="text-sm text-[#374151]">
              {from} → {to}
            </span>
          );
        },
      },
      {
        key: "created_at",
        label: "Raised",
        sortKey: "created_at",
        sortable: true,
        editable: false,
        renderCell: (row) => (
          <span className="text-sm text-[#374151]">{formatAlertWhen(row.created_at)}</span>
        ),
      },
      {
        key: "is_handled",
        label: "Status",
        sortKey: "is_handled",
        sortable: true,
        editable: false,
        renderCell: (row) =>
          isHandledFlag(row.is_handled) ? (
            <Badge className="border-0 bg-emerald-100 font-medium text-emerald-900 hover:bg-emerald-100">
              Handled
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 font-medium text-amber-950"
            >
              Needs review
            </Badge>
          ),
      },
      {
        key: "handled_at",
        label: "Handled at",
        sortKey: "handled_at",
        sortable: true,
        editable: false,
        renderCell: (row) => (
          <span className="text-sm text-[#6b7280]">{formatAlertWhen(row.handled_at)}</span>
        ),
      },
      {
        key: "handled_by",
        label: "Handled by",
        sortKey: "handled_by",
        sortable: true,
        editable: false,
        renderCell: (row) => <HandledByCell value={row.handled_by} />,
      },
    ],
    []
  );

  return (
    <div className="mx-auto max-w-6xl">
      <CommonDataTable
        role="admin"
        title="Alerts"
        description="Load-related alerts from your system. Review each row and mark it handled when you are done."
        tableName="admin_alerts"
        selectQuery={selectQuery}
        search={{ column: "load_id", placeholder: "Search by load ID…" }}
        filters={[
          {
            label: "Status",
            column: "is_handled",
            options: [
              { label: "Handled", value: "true" },
              { label: "Unhandled", value: "false" },
            ],
          },
        ]}
        defaultSort={{ column: "created_at", ascending: false }}
        columns={columns}
        markHandledColumn="is_handled"
        adminOnlyEdit
        useServiceRoleApi
      />
    </div>
  );
}
