"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VerificationDocsModal } from "@/components/admin/verification-docs-modal";

type PendingEntity = {
  id: string;
  entityType: "user" | "truck";
  name: string;
  detail: string;
  submittedAt: string;
  daysWaiting: number;
};

function daysFromNow(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function ModeratorVerificationsPage() {
  const [items, setItems] = useState<PendingEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docsTarget, setDocsTarget] = useState<PendingEntity | null>(null);
  const [tab, setTab] = useState<"all" | "user" | "truck">("all");

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, trucksRes] = await Promise.all([
        fetch(
          `/api/admin/data?table=users&select=id,name,phone,role,verification_status,created_at&pageSize=100&sortColumn=created_at&sortAsc=false&filters=${encodeURIComponent(JSON.stringify({ verification_status: "pending" }))}`,
          { credentials: "include" }
        ),
        fetch(
          `/api/admin/data?table=trucks&select=id,owner_id,category,verification_status,created_at,users!trucks_owner_id_fkey(name)&pageSize=100&sortColumn=created_at&sortAsc=false&filters=${encodeURIComponent(JSON.stringify({ verification_status: "pending" }))}`,
          { credentials: "include" }
        ),
      ]);

      const users = usersRes.ok ? ((await usersRes.json()) as { data: Record<string, unknown>[] }).data : [];
      const trucks = trucksRes.ok ? ((await trucksRes.json()) as { data: Record<string, unknown>[] }).data : [];

      const result: PendingEntity[] = [];

      users.forEach((u) => {
        result.push({
          id: String(u.id),
          entityType: "user",
          name: String(u.name ?? "—"),
          detail: `${u.role ?? "user"} · ${u.phone ?? "no phone"}`,
          submittedAt: String(u.created_at ?? ""),
          daysWaiting: daysFromNow(String(u.created_at ?? "")),
        });
      });

      trucks.forEach((t) => {
        const owner = t.users as { name?: string } | null;
        result.push({
          id: String(t.id),
          entityType: "truck",
          name: owner?.name ?? "—",
          detail: `${t.category ?? "truck"}`,
          submittedAt: String(t.created_at ?? ""),
          daysWaiting: daysFromNow(String(t.created_at ?? "")),
        });
      });

      result.sort((a, b) => b.daysWaiting - a.daysWaiting);
      setItems(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchPending(); }, [fetchPending]);

  const filtered = tab === "all" ? items : items.filter((i) => i.entityType === tab);
  const userCount = items.filter((i) => i.entityType === "user").length;
  const truckCount = items.filter((i) => i.entityType === "truck").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">Verification Queue</h1>
        <p className="text-sm text-[#6b7280]">Pending verifications for review.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-[#e5e7eb] bg-white shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-[#6b7280]">Total pending</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold tabular-nums text-[#111827]">{items.length}</p></CardContent>
        </Card>
        <Card className="border-[#e5e7eb] bg-white shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-[#6b7280]">Users</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold tabular-nums text-amber-600">{userCount}</p></CardContent>
        </Card>
        <Card className="border-[#e5e7eb] bg-white shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-[#6b7280]">Trucks</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold tabular-nums text-blue-600">{truckCount}</p></CardContent>
        </Card>
      </div>

      <div className="flex gap-1 rounded-lg border border-[#e5e7eb] bg-[#f3f4f6] p-1">
        {(["all", "user", "truck"] as const).map((t) => (
          <button key={t} className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${tab === t ? "bg-white text-[#111827] shadow-sm" : "text-[#6b7280] hover:text-[#111827]"}`} onClick={() => setTab(t)}>
            {t === "all" ? `All (${items.length})` : t === "user" ? `Users (${userCount})` : `Trucks (${truckCount})`}
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
        <Table>
          <TableHeader>
            <TableRow className="border-[#e5e7eb] bg-[#f9fafb]">
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">Type</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">Name</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">Detail</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">Submitted</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">Waiting</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="py-12 text-center"><div className="flex items-center justify-center gap-2 text-[#6b7280]"><div className="h-4 w-4 animate-spin rounded-full border-2 border-[#e5e7eb] border-t-[#111827]" />Loading…</div></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-12 text-center text-[#9ca3af]">No pending verifications.</TableCell></TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow key={`${item.entityType}-${item.id}`} className="border-[#e5e7eb]">
                  <TableCell><Badge className={item.entityType === "user" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-200 bg-blue-50 text-blue-800"}>{item.entityType === "user" ? "User" : "Truck"}</Badge></TableCell>
                  <TableCell className="font-medium text-[#111827]">{item.name}</TableCell>
                  <TableCell className="text-sm text-[#6b7280]">{item.detail}</TableCell>
                  <TableCell className="text-sm text-[#6b7280]">{formatDate(item.submittedAt)}</TableCell>
                  <TableCell><span className={`text-sm font-semibold ${item.daysWaiting >= 3 ? "text-red-600" : item.daysWaiting >= 1 ? "text-amber-600" : "text-[#374151]"}`}>{item.daysWaiting === 0 ? "Today" : `${item.daysWaiting}d`}</span></TableCell>
                  <TableCell><Button size="sm" className="h-7 text-xs" onClick={() => setDocsTarget(item)}>Review</Button></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {docsTarget && (
        <VerificationDocsModal open={!!docsTarget} onClose={() => setDocsTarget(null)} entityType={docsTarget.entityType} entityId={docsTarget.id} onDecisionMade={() => { setDocsTarget(null); void fetchPending(); }} />
      )}
    </div>
  );
}
