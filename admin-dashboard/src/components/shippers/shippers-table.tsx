"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  createColumnHelper,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  ROLE_OPTIONS,
  VERIFICATION_OPTIONS,
  type UserRow,
} from "@/types/users";

export const PAGE_SIZE = 25;

type Variant = "admin" | "moderator";

type Props = {
  variant: Variant;
};

const columnHelper = createColumnHelper<UserRow>();

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function ShippersTable({ variant }: Props) {
  const isAdmin = variant === "admin";
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [draft, setDraft] = useState<Partial<UserRow>>({});
  const [saving, setSaving] = useState(false);

  const [approveTarget, setApproveTarget] = useState<UserRow | null>(null);
  const [approveInfoMessage, setApproveInfoMessage] = useState<string | null>(null);
  const [docsTarget, setDocsTarget] = useState<UserRow | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let q = supabase
        .from("users")
        .select("*", { count: "exact" })
        .eq("role", "shipper")
        .order("created_at", { ascending: false });

      if (pendingOnly) {
        q = q.eq("verification_status", "pending");
      }
      if (debouncedSearch) {
        q = q.ilike("phone", `%${debouncedSearch}%`);
      }

      const { data, error, count } = await q.range(from, to);
      if (error) {
        setLoadError(error.message);
        setRows([]);
        setTotal(0);
        return;
      }
      setRows((data as UserRow[]) ?? []);
      setTotal(count ?? 0);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pendingOnly, debouncedSearch]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const openEdit = useCallback((row: UserRow) => {
    setEditing(row);
    setDraft({
      name: row.name,
      role: row.role,
      verification_status: row.verification_status,
      subscription: row.subscription,
    });
    setEditOpen(true);
  }, []);

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("users")
        .update({
          name: draft.name ?? null,
          role: draft.role ?? null,
          verification_status: draft.verification_status ?? null,
          subscription: draft.subscription ?? null,
        } as never)
        .eq("id", editing.id);
      if (error) {
        alert(error.message);
        return;
      }
      setEditOpen(false);
      void fetchRows();
    } finally {
      setSaving(false);
    }
  };

  const confirmApprove = async () => {
    if (!approveTarget) return;
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("users")
        .update({ verification_status: "verified" } as never)
        .eq("id", approveTarget.id);
      if (error) {
        alert(error.message);
        return;
      }
      setApproveTarget(null);
      void fetchRows();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Approve failed");
    }
  };

  const columns = useMemo(() => {
    return [
      columnHelper.accessor("name", {
        header: "Name",
        cell: (ctx) => ctx.getValue() ?? "—",
      }),
      columnHelper.accessor("phone", {
        header: "Phone",
        cell: (ctx) => ctx.getValue() ?? "—",
      }),
      columnHelper.accessor("role", {
        header: "Role",
        cell: (ctx) => ctx.getValue() ?? "—",
      }),
      columnHelper.accessor("verification_status", {
        header: "Verification Status",
        cell: (ctx) => ctx.getValue() ?? "—",
      }),
      columnHelper.accessor("subscription", {
        header: "Subscription",
        cell: (ctx) => ctx.getValue() ?? "—",
      }),
      columnHelper.accessor("created_at", {
        header: "Created At",
        cell: (ctx) => formatDate(ctx.getValue()),
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const r = row.original;
          const v = String(r.verification_status ?? "").toLowerCase();
          const pending = v === "pending";
          const verified = v === "verified";
          const rejected = v === "rejected";
          return (
            <div className="flex flex-wrap gap-2">
              {isAdmin ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-[#6b7280] text-[#374151]"
                  onClick={() => openEdit(r)}
                >
                  Edit
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-[#6b7280] text-[#374151]"
                onClick={() => setDocsTarget(r)}
              >
                Documents
              </Button>
              {pending ? (
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#111827] text-white hover:bg-[#111827]/90"
                  onClick={() => setApproveTarget(r)}
                >
                  APPROVE
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="opacity-60"
                  onClick={() =>
                    setApproveInfoMessage(
                      verified
                        ? "User already verified."
                        : rejected
                          ? "This record was rejected."
                          : "Only pending requests can be approved here."
                    )
                  }
                >
                  APPROVE
                </Button>
              )}
            </div>
          );
        },
      }),
    ] as ColumnDef<UserRow>[];
  }, [isAdmin, openEdit]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Label htmlFor="search-phone" className="text-[#374151]">
            Search by phone
          </Label>
          <Input
            id="search-phone"
            placeholder="Search by phone…"
            className="max-w-md border-[#e5e7eb] bg-white"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <p className="text-xs text-[#9ca3af]">
            Filters the list with a partial phone match.
          </p>
        </div>
        <Button
          type="button"
          variant={pendingOnly ? "default" : "outline"}
          className={
            pendingOnly
              ? "bg-[#111827] text-white"
              : "border-[#6b7280] text-[#374151]"
          }
          onClick={() => {
            setPendingOnly((p) => !p);
            setPage(1);
          }}
        >
          Pending verification
        </Button>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
          {loadError}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-[#e5e7eb] bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="border-[#e5e7eb] hover:bg-[#f9fafb]">
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="text-[#374151]">
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={table.getAllColumns().length}
                  className="py-10 text-center text-[#6b7280]"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={table.getAllColumns().length}
                  className="py-10 text-center text-[#6b7280]"
                >
                  No shippers found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-[#e5e7eb] hover:bg-[#f9fafb]"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-[#374151]">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-[#6b7280]">
          Page {page} of {totalPages} · {total} rows
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-[#e5e7eb]"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-[#e5e7eb]"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="border-[#e5e7eb] bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#111827]">Edit shipper</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="flex flex-col gap-4 py-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={draft.name ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  className="border-[#e5e7eb]"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone (read-only)</Label>
                <Input
                  value={editing.phone ?? ""}
                  disabled
                  className="border-[#e5e7eb] bg-[#f3f4f6] text-[#6b7280]"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-[#e5e7eb] bg-white px-3 text-sm text-[#111827]"
                  value={draft.role ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, role: e.target.value }))
                  }
                >
                  <option value="">—</option>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Verification status</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-[#e5e7eb] bg-white px-3 text-sm text-[#111827]"
                  value={draft.verification_status ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      verification_status: e.target.value,
                    }))
                  }
                >
                  <option value="">—</option>
                  {VERIFICATION_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Subscription</Label>
                <Input
                  value={draft.subscription ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, subscription: e.target.value }))
                  }
                  className="border-[#e5e7eb]"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#111827] text-white hover:bg-[#111827]/90"
              disabled={saving}
              onClick={() => void saveEdit()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={approveInfoMessage !== null}
        onOpenChange={(open) => !open && setApproveInfoMessage(null)}
      >
        <DialogContent className="border-[#e5e7eb] bg-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#111827]">Verification</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#6b7280]">{approveInfoMessage}</p>
          <DialogFooter>
            <Button
              type="button"
              className="bg-[#111827] text-white hover:bg-[#111827]/90"
              onClick={() => setApproveInfoMessage(null)}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!approveTarget}
        onOpenChange={(open) => {
          if (!open) setApproveTarget(null);
        }}
      >
        <AlertDialogContent className="border-[#e5e7eb] bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#111827]">
              Verify user?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Set verification status to <strong>verified</strong> for{" "}
              {approveTarget?.name ?? approveTarget?.phone ?? "this user"}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#111827] text-white hover:bg-[#111827]/90"
              onClick={() => void confirmApprove()}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <VerificationDocsModal
        open={!!docsTarget}
        onClose={() => setDocsTarget(null)}
        entityType="user"
        entityId={docsTarget?.id ?? ""}
        onDecisionMade={() => {
          setDocsTarget(null);
          void fetchRows();
        }}
      />
    </div>
  );
}
