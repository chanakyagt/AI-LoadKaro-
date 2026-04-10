"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type LogEntry = {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  update_record: { label: "Updated", color: "bg-blue-50 text-blue-700 border-blue-200" },
  delete_record: { label: "Deleted", color: "bg-red-50 text-red-700 border-red-200" },
  verify_user: { label: "Verified user", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  reject_user: { label: "Rejected user", color: "bg-red-50 text-red-700 border-red-200" },
  verify_truck: { label: "Verified truck", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  reject_truck: { label: "Rejected truck", color: "bg-red-50 text-red-700 border-red-200" },
  mark_alert_handled: { label: "Handled alert", color: "bg-amber-50 text-amber-700 border-amber-200" },
  close_record: { label: "Closed", color: "bg-gray-50 text-gray-600 border-gray-200" },
  create_moderator: { label: "Added moderator", color: "bg-purple-50 text-purple-700 border-purple-200" },
  review_verification: { label: "Reviewed docs", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
};

const ACTIONS = Object.keys(ACTION_LABELS);
const ENTITY_TYPES = ["users", "trucks", "loads", "availabilities", "admin_alerts", "user", "truck"];

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function shortId(id: string | null): string {
  if (!id) return "—";
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
}

function detailsSummary(details: Record<string, unknown>): string {
  const fields = details.fields as Record<string, unknown> | undefined;
  if (fields) {
    const keys = Object.keys(fields);
    if (keys.length <= 3) return keys.join(", ");
    return `${keys.slice(0, 3).join(", ")} +${keys.length - 3}`;
  }
  const decision = details.decision as string | undefined;
  if (decision) return `Decision: ${decision}`;
  const name = details.name as string | undefined;
  if (name) return name;
  return "";
}

export default function AdminActivityLogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const pageSize = 25;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Record<string, string> = {};
      if (actionFilter) filters.action = actionFilter;
      if (entityFilter) filters.entity_type = entityFilter;

      const params = new URLSearchParams({
        table: "audit_log",
        select: "*",
        page: String(page),
        pageSize: String(pageSize),
        sortColumn: "created_at",
        sortAsc: "false",
        filters: JSON.stringify(filters),
      });
      if (dateFrom) {
        params.set("dateColumn", "created_at");
        params.set("dateFrom", dateFrom);
      }
      if (dateTo) {
        params.set("dateColumn", "created_at");
        params.set("dateTo", dateTo);
      }

      const res = await fetch(`/api/admin/data?${params.toString()}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setLogs(json.data ?? []);
      setTotal(json.count ?? 0);
    } catch {
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, entityFilter, dateFrom, dateTo]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">Activity Log</h1>
        <p className="text-sm text-[#6b7280]">
          Audit trail of all admin and moderator actions — verifications,
          edits, deletions, and more.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-[#6b7280]">Action</Label>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-2.5 text-sm"
          >
            <option value="">All actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABELS[a]?.label ?? a}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-[#6b7280]">Entity</Label>
          <select
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-2.5 text-sm"
          >
            <option value="">All entities</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-[#6b7280]">From</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="h-9 w-40 border-[#e5e7eb] text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-[#6b7280]">To</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="h-9 w-40 border-[#e5e7eb] text-sm"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 text-xs text-[#6b7280]"
          onClick={() => {
            setActionFilter("");
            setEntityFilter("");
            setDateFrom("");
            setDateTo("");
            setPage(1);
          }}
        >
          Clear
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
        <Table>
          <TableHeader>
            <TableRow className="border-[#e5e7eb] bg-[#f9fafb]">
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">
                When
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">
                Action
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">
                Entity
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">
                Entity ID
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">
                Actor
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">
                Details
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-[#6b7280]">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#e5e7eb] border-t-[#111827]" />
                    Loading…
                  </div>
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-[#9ca3af]"
                >
                  No activity recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => {
                const style = ACTION_LABELS[log.action] ?? {
                  label: log.action,
                  color: "bg-gray-50 text-gray-600 border-gray-200",
                };
                return (
                  <TableRow key={log.id} className="border-[#e5e7eb]">
                    <TableCell className="whitespace-nowrap text-sm text-[#6b7280]">
                      {formatDate(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge className={`border ${style.color}`}>
                        {style.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-[#374151]">
                      {log.entity_type}
                    </TableCell>
                    <TableCell
                      className="font-mono text-xs text-[#6b7280]"
                      title={log.entity_id ?? ""}
                    >
                      {shortId(log.entity_id)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="font-medium text-[#374151]">
                        {log.actor_role ?? "system"}
                      </span>
                      <br />
                      <span className="font-mono text-[10px] text-[#9ca3af]">
                        {shortId(log.actor_id)}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-[#6b7280]">
                      {detailsSummary(log.details)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#6b7280]">
          Page {page} of {totalPages} · {total.toLocaleString()} entries
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
