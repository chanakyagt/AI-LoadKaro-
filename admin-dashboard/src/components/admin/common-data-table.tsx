"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { VerificationDocsModal } from "@/components/admin/verification-docs-modal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

type Role = "admin" | "moderator";

type ColumnType = "text" | "enum" | "boolean" | "number";

export type TableColumn = {
  key: string;
  persistKey?: string;
  sortKey?: string;
  label: string;
  sortable?: boolean;
  editable?: boolean;
  type?: ColumnType;
  enumOptions?: string[];
  accessor?: (row: RowData) => string;
  renderCell?: (row: RowData) => ReactNode;
  /** If true, this column is hidden by default but can be toggled on. */
  hiddenByDefault?: boolean;
};

function fieldKey(c: TableColumn): string {
  return c.persistKey ?? c.key;
}

function sortField(c: TableColumn): string {
  return c.sortKey ?? c.persistKey ?? c.key;
}

function coercePayloadValue(
  column: TableColumn,
  raw: string
): string | boolean | number | null {
  const v = raw.trim();
  if (v === "") return null;
  if (column.type === "boolean") return v === "true";
  if (column.type === "number") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return v;
}

type FilterDef = {
  label: string;
  column: string;
  options: { label: string; value: string }[];
};

type RowData = Record<string, unknown>;

type DateFilterDef = {
  label: string;
  column: string;
};

type Props = {
  role: Role;
  title: string;
  description: string;
  tableName: string;
  tableCandidates?: string[];
  selectQuery: string;
  columns: TableColumn[];
  search?: { column: string; placeholder: string };
  filters?: FilterDef[];
  dateFilter?: DateFilterDef;
  defaultSort?: { column: string; ascending?: boolean };
  idField?: string;
  verificationColumn?: string;
  statusCloseColumn?: string;
  closeValue?: string;
  allowDelete?: boolean;
  adminOnlyEdit?: boolean;
  markHandledColumn?: string;
  verificationTriggerStatuses?: string[];
  verificationAlreadyVerifiedMessage?: string;
  verificationRejectedMessage?: string;
  verificationUnavailableMessage?: string;
  useServiceRoleApi?: boolean;
  verificationDocsEntityType?: "user" | "truck";
};

function valueToText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function isHandledResolved(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (s === "false" || s === "f" || s === "0" || s === "no") return false;
    if (s === "true" || s === "t" || s === "1" || s === "yes") return true;
    return false;
  }
  return Boolean(value);
}

function coerceFilterEq(column: string, val: string): string | boolean {
  if (val !== "true" && val !== "false") return val;
  if (column === "is_handled" || column === "gps_available") {
    return val === "true";
  }
  return val;
}

function getNestedValue(row: RowData, key: string): unknown {
  if (key.includes(".")) {
    return key.split(".").reduce<unknown>((acc, part) => {
      if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[part];
      }
      return null;
    }, row);
  }
  return row[key];
}

const STATUS_BADGE_MAP: Record<string, { bg: string; text: string }> = {
  open: { bg: "bg-blue-50 border-blue-200", text: "text-blue-800" },
  available: { bg: "bg-blue-50 border-blue-200", text: "text-blue-800" },
  matched: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800" },
  verified: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800" },
  closed: { bg: "bg-gray-50 border-gray-200", text: "text-gray-600" },
  cancelled: { bg: "bg-red-50 border-red-200", text: "text-red-700" },
  rejected: { bg: "bg-red-50 border-red-200", text: "text-red-700" },
  pending: { bg: "bg-amber-50 border-amber-200", text: "text-amber-800" },
  unverified: { bg: "bg-gray-50 border-gray-200", text: "text-gray-600" },
};

function StatusBadge({ value }: { value: string }) {
  const s = value.toLowerCase();
  const style = STATUS_BADGE_MAP[s] ?? { bg: "bg-gray-50 border-gray-200", text: "text-gray-600" };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style.bg} ${style.text}`}
    >
      {value}
    </span>
  );
}

function isStatusLikeColumn(col: TableColumn): boolean {
  const k = col.key.toLowerCase();
  return k === "status" || k.includes("verification_status") || k.includes("_status");
}

function exportToCSV(columns: TableColumn[], rows: RowData[], filename: string) {
  const visibleCols = columns;
  const header = visibleCols.map((c) => c.label).join(",");
  const csvRows = rows.map((row) => {
    return visibleCols
      .map((col) => {
        const raw = col.accessor
          ? col.accessor(row)
          : valueToText(getNestedValue(row, fieldKey(col)));
        const escaped = String(raw).replace(/"/g, '""');
        return `"${escaped}"`;
      })
      .join(",");
  });
  const csv = [header, ...csvRows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function CommonDataTable({
  role,
  title,
  description,
  tableName,
  tableCandidates = [],
  selectQuery,
  columns,
  search,
  filters = [],
  dateFilter,
  defaultSort,
  idField = "id",
  verificationColumn,
  statusCloseColumn,
  closeValue = "closed",
  allowDelete = false,
  adminOnlyEdit = true,
  markHandledColumn,
  verificationTriggerStatuses = ["pending", "unverified"],
  verificationAlreadyVerifiedMessage = "User already verified.",
  verificationRejectedMessage = "This record was rejected.",
  verificationUnavailableMessage = "No verification action is available for this status.",
  useServiceRoleApi = false,
  verificationDocsEntityType,
}: Props) {
  const isAdmin = role === "admin";
  const canEdit = adminOnlyEdit ? isAdmin : true;
  const [rows, setRows] = useState<RowData[]>([]);
  const [docsTarget, setDocsTarget] = useState<RowData | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchInput, setSearchInput] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sortColumn, setSortColumn] = useState(defaultSort?.column ?? idField);
  const [sortAsc, setSortAsc] = useState(defaultSort?.ascending ?? false);

  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    filters.forEach((f) => {
      initial[f.column] = "";
    });
    return initial;
  });

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const [editingCell, setEditingCell] = useState<{
    id: string;
    field: string;
    column: TableColumn;
  } | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const [editModalRow, setEditModalRow] = useState<RowData | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, string>>({});

  const [verifyTarget, setVerifyTarget] = useState<RowData | null>(null);
  const [verificationBlockedMessage, setVerificationBlockedMessage] = useState<
    string | null
  >(null);
  const [editBlockedToast, setEditBlockedToast] = useState<string | null>(null);
  const searchColumn = search?.column ?? "";

  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    const s = new Set<string>();
    columns.forEach((c) => {
      if (c.hiddenByDefault) s.add(c.key);
    });
    return s;
  });
  const [showColPicker, setShowColPicker] = useState(false);

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenCols.has(c.key)),
    [columns, hiddenCols]
  );

  useEffect(() => {
    if (!editBlockedToast) return;
    const t = window.setTimeout(() => setEditBlockedToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [editBlockedToast]);
  const tableCandidatesKey = tableCandidates.join("|");

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearchValue(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedRows(new Set());
    try {
      if (useServiceRoleApi) {
        const params = new URLSearchParams({
          table: tableName,
          select: selectQuery,
          page: String(page),
          pageSize: String(pageSize),
          sortColumn,
          sortAsc: String(sortAsc),
          searchColumn,
          searchValue,
          filters: JSON.stringify(filterValues),
        });
        if (dateFilter && dateFrom) params.set("dateFrom", dateFrom);
        if (dateFilter && dateTo) params.set("dateTo", dateTo);
        if (dateFilter) params.set("dateColumn", dateFilter.column);
        const res = await fetch(`/api/admin/data?${params.toString()}`, {
          credentials: "include",
        });
        const json = (await res.json()) as {
          data?: RowData[];
          count?: number;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(json.error ?? res.statusText);
        }
        setRows(json.data ?? []);
        setTotal(json.count ?? 0);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const buildQuery = (
        activeTable: string,
        opts: {
          withOrder: boolean;
          withSearch: boolean;
          withFilters: boolean;
        }
      ) => {
        let query = supabase
          .from(activeTable)
          .select(selectQuery, { count: "exact" });
        if (opts.withOrder) {
          query = query.order(sortColumn, { ascending: sortAsc });
        }
        if (opts.withSearch && searchColumn && searchValue) {
          query = query.ilike(searchColumn, `%${searchValue}%`);
        }
        if (opts.withFilters) {
          Object.entries(filterValues).forEach(([column, value]) => {
            if (value) query = query.eq(column, coerceFilterEq(column, value));
          });
        }
        if (dateFilter && dateFrom) {
          query = query.gte(dateFilter.column, dateFrom);
        }
        if (dateFilter && dateTo) {
          query = query.lte(dateFilter.column, dateTo);
        }
        return query.range(from, to);
      };

      const candidates = [
        tableName,
        ...tableCandidatesKey.split("|").filter(Boolean),
      ];
      let result: {
        data: RowData[] | null;
        error: { message: string } | null;
        count: number | null;
      } = {
        data: null,
        error: { message: "No table candidates configured." },
        count: null,
      };
      for (const candidate of candidates) {
        result = await buildQuery(candidate, {
          withOrder: true,
          withSearch: true,
          withFilters: true,
        });
        if (!result.error) break;
        result = await buildQuery(candidate, {
          withOrder: false,
          withSearch: true,
          withFilters: true,
        });
        if (!result.error) break;
        result = await buildQuery(candidate, {
          withOrder: false,
          withSearch: false,
          withFilters: true,
        });
        if (!result.error) break;
        result = await buildQuery(candidate, {
          withOrder: false,
          withSearch: false,
          withFilters: false,
        });
        if (!result.error) break;
      }

      const { data, error: qErr, count } = result;
      if (qErr) throw qErr;
      setRows((data as RowData[]) ?? []);
      setTotal(count ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load records.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    tableName,
    tableCandidatesKey,
    selectQuery,
    sortColumn,
    sortAsc,
    searchColumn,
    searchValue,
    filterValues,
    dateFilter,
    dateFrom,
    dateTo,
    useServiceRoleApi,
  ]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  async function patchViaApi(rowId: string, patch: Record<string, unknown>) {
    const res = await fetch("/api/admin/row", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: tableName, id: rowId, idField, patch }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? "Update failed");
  }

  async function deleteViaApi(rowId: string) {
    const res = await fetch("/api/admin/row", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: tableName, id: rowId, idField }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? "Delete failed");
  }

  const editableColumns = useMemo(
    () => columns.filter((c) => c.editable && c.key !== "phone"),
    [columns]
  );

  const openEditModal = (row: RowData) => {
    if (!canEdit) return;
    setEditModalRow(row);
    const draft: Record<string, string> = {};
    editableColumns.forEach((c) => {
      const fk = fieldKey(c);
      const raw = getNestedValue(row, fk);
      if (c.type === "boolean") {
        draft[fk] = raw === true ? "true" : raw === false ? "false" : "";
      } else {
        draft[fk] = valueToText(raw);
        if (draft[fk] === "—") draft[fk] = "";
      }
    });
    setEditDraft(draft);
  };

  const saveEditModal = async () => {
    if (!editModalRow) return;
    const rowId = String(editModalRow[idField] ?? "");
    if (!rowId) return;
    try {
      const payload: Record<string, unknown> = {};
      editableColumns.forEach((c) => {
        const fk = fieldKey(c);
        const raw = editDraft[fk] ?? "";
        payload[fk] = coercePayloadValue(c, String(raw));
      });
      if (useServiceRoleApi) {
        await patchViaApi(rowId, payload);
      } else {
        const supabase = createSupabaseBrowserClient();
        const { error: qErr } = await supabase
          .from(tableName)
          .update(payload as never)
          .eq(idField, rowId);
        if (qErr) throw qErr;
      }
      setEditModalRow(null);
      void fetchRows();
    } catch (e) {
      setEditBlockedToast(e instanceof Error ? e.message : "Failed to save.");
    }
  };

  const startInlineEdit = (row: RowData, column: TableColumn) => {
    if (!canEdit || !column.editable || column.key === "phone") return;
    const id = String(row[idField] ?? "");
    const fk = fieldKey(column);
    setEditingCell({ id, field: fk, column });
    const raw = getNestedValue(row, fk);
    if (column.type === "boolean") {
      setEditingValue(raw === true ? "true" : raw === false ? "false" : "");
    } else if (column.type === "enum") {
      setEditingValue(raw == null || raw === "" ? "" : String(raw));
    } else {
      const current = valueToText(raw);
      setEditingValue(current === "—" ? "" : current);
    }
  };

  const saveInlineEdit = async () => {
    if (!editingCell) return;
    try {
      const val = coercePayloadValue(editingCell.column, editingValue);
      if (useServiceRoleApi) {
        await patchViaApi(editingCell.id, { [editingCell.field]: val });
      } else {
        const supabase = createSupabaseBrowserClient();
        const { error: qErr } = await supabase
          .from(tableName)
          .update({ [editingCell.field]: val } as never)
          .eq(idField, editingCell.id);
        if (qErr) throw qErr;
      }
      setEditingCell(null);
      void fetchRows();
    } catch (e) {
      setEditBlockedToast(
        e instanceof Error ? e.message : "Inline update failed."
      );
    }
  };

  const updateVerification = async (value: "verified" | "rejected") => {
    if (!verifyTarget || !verificationColumn) return;
    try {
      const id = String(verifyTarget[idField] ?? "");
      if (useServiceRoleApi) {
        await patchViaApi(id, { [verificationColumn!]: value });
      } else {
        const supabase = createSupabaseBrowserClient();
        const { error: qErr } = await supabase
          .from(tableName)
          .update({ [verificationColumn]: value } as never)
          .eq(idField, id);
        if (qErr) throw qErr;
      }
      setVerifyTarget(null);
      void fetchRows();
    } catch (e) {
      setEditBlockedToast(
        e instanceof Error ? e.message : "Verification update failed."
      );
    }
  };

  const closeRow = async (row: RowData) => {
    if (!statusCloseColumn) return;
    try {
      const id = String(row[idField] ?? "");
      if (useServiceRoleApi) {
        await patchViaApi(id, { [statusCloseColumn]: closeValue });
      } else {
        const supabase = createSupabaseBrowserClient();
        const { error: qErr } = await supabase
          .from(tableName)
          .update({ [statusCloseColumn]: closeValue } as never)
          .eq(idField, id);
        if (qErr) throw qErr;
      }
      void fetchRows();
    } catch (e) {
      setEditBlockedToast(
        e instanceof Error ? e.message : "Close action failed."
      );
    }
  };

  const markHandled = async (row: RowData) => {
    if (!markHandledColumn) return;
    try {
      const id = String(row[idField] ?? "");
      if (useServiceRoleApi) {
        await patchViaApi(id, { [markHandledColumn]: true });
      } else {
        const supabase = createSupabaseBrowserClient();
        const { error: qErr } = await supabase
          .from(tableName)
          .update({ [markHandledColumn]: true } as never)
          .eq(idField, id);
        if (qErr) throw qErr;
      }
      void fetchRows();
    } catch (e) {
      setEditBlockedToast(
        e instanceof Error ? e.message : "Could not mark as handled."
      );
    }
  };

  const deleteRow = async (row: RowData) => {
    if (!allowDelete || !isAdmin) return;
    if (!window.confirm("Delete this record?")) return;
    try {
      const id = String(row[idField] ?? "");
      if (useServiceRoleApi) {
        await deleteViaApi(id);
      } else {
        const supabase = createSupabaseBrowserClient();
        const { error: qErr } = await supabase
          .from(tableName)
          .delete()
          .eq(idField, id);
        if (qErr) throw qErr;
      }
      void fetchRows();
    } catch (e) {
      setEditBlockedToast(
        e instanceof Error ? e.message : "Delete failed."
      );
    }
  };

  const bulkDelete = async () => {
    if (!allowDelete || !isAdmin || selectedRows.size === 0) return;
    if (
      !window.confirm(`Delete ${selectedRows.size} selected record(s)?`)
    )
      return;
    try {
      for (const id of selectedRows) {
        if (useServiceRoleApi) {
          await deleteViaApi(id);
        } else {
          const supabase = createSupabaseBrowserClient();
          await supabase.from(tableName).delete().eq(idField, id);
        }
      }
      setSelectedRows(new Set());
      void fetchRows();
    } catch (e) {
      setEditBlockedToast(
        e instanceof Error ? e.message : "Bulk delete failed."
      );
    }
  };

  const toggleRow = (id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedRows.size === rows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(rows.map((r) => String(r[idField] ?? ""))));
    }
  };

  return (
    <div className="relative space-y-4">
      {editBlockedToast ? (
        <div
          className="pointer-events-none fixed bottom-6 left-1/2 z-100 max-w-md -translate-x-1/2 rounded-lg border border-[#e5e7eb] bg-[#111827] px-4 py-2.5 text-center text-sm text-white shadow-lg"
          role="status"
        >
          {editBlockedToast}
        </div>
      ) : null}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">{title}</h1>
          <p className="text-sm text-[#6b7280]">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-[#e5e7eb] text-xs"
            onClick={() => exportToCSV(visibleColumns, rows, tableName)}
            disabled={rows.length === 0}
          >
            Export CSV
          </Button>
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="border-[#e5e7eb] text-xs"
              onClick={() => setShowColPicker((v) => !v)}
            >
              Columns
            </Button>
            {showColPicker && (
              <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-[#e5e7eb] bg-white p-2 shadow-lg">
                {columns.map((c) => (
                  <label
                    key={c.key}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-[#f3f4f6]"
                  >
                    <input
                      type="checkbox"
                      checked={!hiddenCols.has(c.key)}
                      onChange={() => {
                        setHiddenCols((prev) => {
                          const next = new Set(prev);
                          if (next.has(c.key)) next.delete(c.key);
                          else next.add(c.key);
                          return next;
                        });
                      }}
                      className="accent-[#111827]"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        {search ? (
          <div className="w-full max-w-xs space-y-1">
            <Label className="text-xs text-[#6b7280]">Search</Label>
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={search.placeholder}
              className="h-9 border-[#e5e7eb] bg-white text-sm"
            />
          </div>
        ) : null}
        {filters.map((filter) => (
          <div key={filter.column} className="space-y-1">
            <Label className="text-xs text-[#6b7280]">{filter.label}</Label>
            <select
              value={filterValues[filter.column] ?? ""}
              onChange={(e) => {
                setFilterValues((prev) => ({
                  ...prev,
                  [filter.column]: e.target.value,
                }));
                setPage(1);
              }}
              className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-2.5 text-sm"
            >
              <option value="">All</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ))}
        {dateFilter && (
          <>
            <div className="space-y-1">
              <Label className="text-xs text-[#6b7280]">
                {dateFilter.label} from
              </Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-40 border-[#e5e7eb] bg-white text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-[#6b7280]">
                {dateFilter.label} to
              </Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-40 border-[#e5e7eb] bg-white text-sm"
              />
            </div>
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-9 text-xs text-[#6b7280]"
          onClick={() => {
            setSearchInput("");
            setFilterValues(() => {
              const r: Record<string, string> = {};
              filters.forEach((f) => (r[f.column] = ""));
              return r;
            });
            setDateFrom("");
            setDateTo("");
            setPage(1);
          }}
        >
          Clear filters
        </Button>
      </div>

      {/* Bulk actions */}
      {selectedRows.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-4 py-2">
          <span className="text-sm font-medium text-[#374151]">
            {selectedRows.size} selected
          </span>
          {allowDelete && isAdmin && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => void bulkDelete()}
            >
              Delete selected
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedRows(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {error ? (
        <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
          {error}
        </div>
      ) : null}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[#e5e7eb] bg-[#f9fafb]">
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selectedRows.size === rows.length}
                    onChange={toggleAll}
                    className="accent-[#111827]"
                  />
                </TableHead>
                {visibleColumns.map((column) => (
                  <TableHead
                    key={column.key}
                    className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]"
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-left"
                        onClick={() => {
                          const sf = sortField(column);
                          if (sortColumn === sf) {
                            setSortAsc((s) => !s);
                          } else {
                            setSortColumn(sf);
                            setSortAsc(true);
                          }
                        }}
                      >
                        {column.label}
                        {sortColumn === sortField(column)
                          ? sortAsc
                            ? " ↑"
                            : " ↓"
                          : ""}
                      </button>
                    ) : (
                      column.label
                    )}
                  </TableHead>
                ))}
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={visibleColumns.length + 2}
                    className="py-12 text-center"
                  >
                    <div className="flex items-center justify-center gap-2 text-[#6b7280]">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#e5e7eb] border-t-[#111827]" />
                      Loading…
                    </div>
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={visibleColumns.length + 2}
                    className="py-12 text-center text-[#9ca3af]"
                  >
                    No records found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const rowId = String(row[idField] ?? "");
                  const isSelected = selectedRows.has(rowId);
                  return (
                    <TableRow
                      key={rowId}
                      className={`border-[#e5e7eb] ${isSelected ? "bg-[#eff6ff]" : ""}`}
                    >
                      <TableCell className="w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(rowId)}
                          className="accent-[#111827]"
                        />
                      </TableCell>
                      {visibleColumns.map((column) => {
                        const fk = fieldKey(column);
                        const rawValue = getNestedValue(row, fk);
                        const text = column.accessor
                          ? column.accessor(row)
                          : valueToText(rawValue);
                        const isEditing =
                          editingCell?.id === rowId &&
                          editingCell?.field === fk;
                        const enumOpts = column.enumOptions ?? [];
                        const cellLocked =
                          !column.editable ||
                          column.key === "phone" ||
                          !canEdit;
                        const singleClickOpensEditor =
                          !cellLocked &&
                          ((column.type === "enum" && enumOpts.length > 0) ||
                            column.type === "boolean");

                        const shouldBadge =
                          !isEditing &&
                          !column.renderCell &&
                          isStatusLikeColumn(column) &&
                          text !== "—";

                        return (
                          <TableCell
                            key={column.key}
                            className={`text-sm ${
                              column.editable &&
                              canEdit &&
                              column.key !== "phone"
                                ? "cursor-pointer"
                                : "cursor-default"
                            }`}
                            onClick={() => {
                              if (isEditing) return;
                              if (cellLocked) {
                                setEditBlockedToast(
                                  "This field can't be edited."
                                );
                                return;
                              }
                              if (singleClickOpensEditor) {
                                startInlineEdit(row, column);
                              }
                            }}
                            onDoubleClick={() => {
                              if (isEditing) return;
                              if (cellLocked) return;
                              if (
                                column.type === "enum" ||
                                column.type === "boolean"
                              )
                                return;
                              startInlineEdit(row, column);
                            }}
                          >
                            {isEditing ? (
                              column.type === "enum" ? (
                                <select
                                  autoFocus
                                  value={editingValue}
                                  onChange={(e) =>
                                    setEditingValue(e.target.value)
                                  }
                                  onBlur={() => void saveInlineEdit()}
                                  className="h-8 rounded border border-[#e5e7eb] px-2 text-sm"
                                >
                                  <option value="">—</option>
                                  {enumOpts.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              ) : column.type === "boolean" ? (
                                <select
                                  autoFocus
                                  value={editingValue}
                                  onChange={(e) =>
                                    setEditingValue(e.target.value)
                                  }
                                  onBlur={() => void saveInlineEdit()}
                                  className="h-8 rounded border border-[#e5e7eb] px-2 text-sm"
                                >
                                  <option value="">—</option>
                                  <option value="true">true</option>
                                  <option value="false">false</option>
                                </select>
                              ) : (
                                <Input
                                  autoFocus
                                  type={
                                    column.type === "number" ? "number" : "text"
                                  }
                                  value={editingValue}
                                  onChange={(e) =>
                                    setEditingValue(e.target.value)
                                  }
                                  onBlur={() => void saveInlineEdit()}
                                  className="h-8 border-[#e5e7eb]"
                                />
                              )
                            ) : column.renderCell ? (
                              column.renderCell(row)
                            ) : shouldBadge ? (
                              <StatusBadge value={text} />
                            ) : (
                              text
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {canEdit ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => openEditModal(row)}
                            >
                              Edit
                            </Button>
                          ) : null}
                          {verificationColumn
                            ? (() => {
                                const raw = row[verificationColumn!];
                                const norm = String(raw ?? "")
                                  .trim()
                                  .toLowerCase();
                                const triggers =
                                  verificationTriggerStatuses.map((s) =>
                                    s.toLowerCase()
                                  );
                                if (triggers.includes(norm)) {
                                  return (
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => setVerifyTarget(row)}
                                    >
                                      Verify
                                    </Button>
                                  );
                                }
                                if (norm === "verified") {
                                  return (
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      className="h-7 text-xs opacity-60"
                                      onClick={() =>
                                        setVerificationBlockedMessage(
                                          verificationAlreadyVerifiedMessage
                                        )
                                      }
                                    >
                                      Verify
                                    </Button>
                                  );
                                }
                                if (norm === "rejected") {
                                  return (
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      className="h-7 text-xs opacity-60"
                                      onClick={() =>
                                        setVerificationBlockedMessage(
                                          verificationRejectedMessage
                                        )
                                      }
                                    >
                                      Verify
                                    </Button>
                                  );
                                }
                                return (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="h-7 text-xs opacity-60"
                                    onClick={() =>
                                      setVerificationBlockedMessage(
                                        verificationUnavailableMessage
                                      )
                                    }
                                  >
                                    Verify
                                  </Button>
                                );
                              })()
                            : null}
                          {statusCloseColumn &&
                          valueToText(row[statusCloseColumn]).toLowerCase() !==
                            closeValue ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 text-xs"
                              onClick={() => void closeRow(row)}
                            >
                              Close
                            </Button>
                          ) : null}
                          {markHandledColumn &&
                          !isHandledResolved(row[markHandledColumn]) ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 text-xs"
                              onClick={() => void markHandled(row)}
                            >
                              Mark handled
                            </Button>
                          ) : null}
                          {verificationDocsEntityType ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => setDocsTarget(row)}
                            >
                              Documents
                            </Button>
                          ) : null}
                          {allowDelete && isAdmin ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 text-xs"
                              onClick={() => void deleteRow(row)}
                            >
                              Delete
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-[#6b7280]">
            Page {page} of {totalPages} · {total.toLocaleString()} rows
          </p>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-8 rounded-lg border border-[#e5e7eb] bg-white px-2 text-xs"
          >
            {PAGE_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s} / page
              </option>
            ))}
          </select>
        </div>
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

      {/* Edit modal */}
      <Dialog
        open={!!editModalRow}
        onOpenChange={(open) => !open && setEditModalRow(null)}
      >
        <DialogContent className="bg-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit record</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            {editModalRow
              ? editableColumns.map((column) => {
                  const fk = fieldKey(column);
                  return (
                    <div key={column.key} className="space-y-1">
                      <Label>{column.label}</Label>
                      {column.type === "enum" ? (
                        <select
                          value={editDraft[fk] ?? ""}
                          onChange={(e) =>
                            setEditDraft((prev) => ({
                              ...prev,
                              [fk]: e.target.value,
                            }))
                          }
                          className="h-8 w-full rounded-lg border border-[#e5e7eb] bg-white px-2.5 text-sm"
                        >
                          <option value="">—</option>
                          {(column.enumOptions ?? []).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : column.type === "boolean" ? (
                        <select
                          value={editDraft[fk] ?? ""}
                          onChange={(e) =>
                            setEditDraft((prev) => ({
                              ...prev,
                              [fk]: e.target.value,
                            }))
                          }
                          className="h-8 w-full rounded-lg border border-[#e5e7eb] bg-white px-2.5 text-sm"
                        >
                          <option value="">—</option>
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : (
                        <Input
                          type={column.type === "number" ? "number" : "text"}
                          value={editDraft[fk] ?? ""}
                          onChange={(e) =>
                            setEditDraft((prev) => ({
                              ...prev,
                              [fk]: e.target.value,
                            }))
                          }
                          className="border-[#e5e7eb]"
                        />
                      )}
                    </div>
                  );
                })
              : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalRow(null)}>
              Cancel
            </Button>
            <Button onClick={() => void saveEditModal()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify modal */}
      <Dialog
        open={!!verifyTarget}
        onOpenChange={(open) => !open && setVerifyTarget(null)}
      >
        <DialogContent className="bg-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Verify record</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#6b7280]">
            Choose approval outcome for this pending verification.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void updateVerification("rejected")}
            >
              Reject
            </Button>
            <Button onClick={() => void updateVerification("verified")}>
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verification blocked info */}
      <Dialog
        open={verificationBlockedMessage !== null}
        onOpenChange={(open) => !open && setVerificationBlockedMessage(null)}
      >
        <DialogContent className="bg-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Verification</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#6b7280]">
            {verificationBlockedMessage}
          </p>
          <DialogFooter>
            <Button
              type="button"
              className="bg-[#111827] text-white"
              onClick={() => setVerificationBlockedMessage(null)}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Docs modal */}
      {verificationDocsEntityType && (
        <VerificationDocsModal
          open={!!docsTarget}
          onClose={() => setDocsTarget(null)}
          entityType={verificationDocsEntityType}
          entityId={String(docsTarget?.[idField] ?? "")}
          onDecisionMade={() => {
            setDocsTarget(null);
            void fetchRows();
          }}
        />
      )}
    </div>
  );
}
