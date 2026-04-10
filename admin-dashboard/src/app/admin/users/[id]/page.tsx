"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
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

type UserProfile = {
  id: string;
  name: string | null;
  phone: string | null;
  role: string | null;
  verification_status: string | null;
  subscription_type: string | null;
  created_at: string | null;
};

type TruckRow = {
  id: string;
  category: string;
  capacity_tons: number | null;
  verification_status: string;
  truck_variants?: { display_name?: string } | null;
};

type LoadRow = {
  id: string;
  truck_category_required: string;
  status: string;
  loading_date: string;
  origin?: { city?: string } | null;
  destination?: { city?: string } | null;
};

type AuditRow = {
  id: string;
  action: string;
  entity_type: string;
  details: Record<string, unknown>;
  created_at: string;
};

type SubmissionRow = {
  id: string;
  status: string;
  review_decision: string | null;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  unverified: "bg-gray-50 text-gray-600 border-gray-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  open: "bg-blue-50 text-blue-700 border-blue-200",
  matched: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-gray-50 text-gray-600 border-gray-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

function StatusBadge({ value }: { value: string }) {
  const c = STATUS_COLORS[value.toLowerCase()] ?? "bg-gray-50 text-gray-600 border-gray-200";
  return <Badge className={`border ${c}`}>{value}</Badge>;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [trucks, setTrucks] = useState<TruckRow[]>([]);
  const [loads, setLoads] = useState<LoadRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [docsOpen, setDocsOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const [userRes, trucksRes, loadsRes, subsRes, auditRes] = await Promise.all([
      fetchJson<{ data: UserProfile[] }>(
        `/api/admin/data?table=users&select=id,name,phone,role,verification_status,subscription_type,created_at&pageSize=1&filters=${encodeURIComponent(JSON.stringify({}))}&sortColumn=id&sortAsc=true&searchColumn=id&searchValue=${id}`
      ),
      fetchJson<{ data: TruckRow[] }>(
        `/api/admin/data?table=trucks&select=id,category,capacity_tons,verification_status,truck_variants(display_name)&pageSize=50&sortColumn=created_at&sortAsc=false&filters=${encodeURIComponent(JSON.stringify({ owner_id: id }))}&searchColumn=&searchValue=`
      ),
      fetchJson<{ data: LoadRow[] }>(
        `/api/admin/data?table=loads&select=id,truck_category_required,status,loading_date,origin:locations!loads_origin_location_id_fkey(city),destination:locations!loads_destination_location_id_fkey(city)&pageSize=20&sortColumn=created_at&sortAsc=false&filters=${encodeURIComponent(JSON.stringify({ posted_by: id }))}&searchColumn=&searchValue=`
      ),
      fetchJson<{ data: SubmissionRow[] }>(
        `/api/admin/verification/submissions?entity_type=user&entity_id=${id}`
      ),
      fetchJson<{ data: AuditRow[] }>(
        `/api/admin/data?table=audit_log&select=id,action,entity_type,details,created_at&pageSize=20&sortColumn=created_at&sortAsc=false&filters=${encodeURIComponent(JSON.stringify({ entity_id: id }))}&searchColumn=&searchValue=`
      ),
    ]);

    setUser(userRes?.data?.[0] ?? null);
    setTrucks(trucksRes?.data ?? []);
    setLoads(loadsRes?.data ?? []);
    setSubmissions(subsRes?.data ?? []);
    setAuditLogs(auditRes?.data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#e5e7eb] border-t-[#111827]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-20 text-center text-[#6b7280]">
        User not found.{" "}
        <Link href="/admin/users" className="text-[#111827] underline">
          Back to Users
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">
            {user.name ?? "Unnamed user"}
          </h1>
          <p className="mt-1 text-sm text-[#6b7280]">
            {user.phone ?? "—"} · {user.role ?? "—"} · Joined{" "}
            {formatDate(user.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge value={user.verification_status ?? "unverified"} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDocsOpen(true)}
          >
            Documents
          </Button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-[#e5e7eb]">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase text-[#9ca3af]">Role</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold capitalize">{user.role ?? "—"}</p>
          </CardContent>
        </Card>
        <Card className="border-[#e5e7eb]">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase text-[#9ca3af]">Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold capitalize">{user.subscription_type ?? "—"}</p>
          </CardContent>
        </Card>
        <Card className="border-[#e5e7eb]">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase text-[#9ca3af]">Trucks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{trucks.length}</p>
          </CardContent>
        </Card>
        <Card className="border-[#e5e7eb]">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase text-[#9ca3af]">Loads posted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{loads.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Trucks */}
      {trucks.length > 0 && (
        <Card className="border-[#e5e7eb]">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[#374151]">
              Trucks ({trucks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#f9fafb]">
                  <TableHead className="text-xs uppercase text-[#6b7280]">Category</TableHead>
                  <TableHead className="text-xs uppercase text-[#6b7280]">Variant</TableHead>
                  <TableHead className="text-xs uppercase text-[#6b7280]">Capacity</TableHead>
                  <TableHead className="text-xs uppercase text-[#6b7280]">Verification</TableHead>
                  <TableHead className="text-xs uppercase text-[#6b7280]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trucks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{t.category}</TableCell>
                    <TableCell className="text-sm">
                      {t.truck_variants?.display_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {t.capacity_tons ?? "—"} tons
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={t.verification_status} />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/trucks/${t.id}`}
                        className="text-sm font-medium text-[#111827] underline"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Loads */}
      {loads.length > 0 && (
        <Card className="border-[#e5e7eb]">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[#374151]">
              Loads ({loads.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#f9fafb]">
                  <TableHead className="text-xs uppercase text-[#6b7280]">Category</TableHead>
                  <TableHead className="text-xs uppercase text-[#6b7280]">Route</TableHead>
                  <TableHead className="text-xs uppercase text-[#6b7280]">Date</TableHead>
                  <TableHead className="text-xs uppercase text-[#6b7280]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loads.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm">{l.truck_category_required}</TableCell>
                    <TableCell className="text-sm">
                      {[l.origin?.city, l.destination?.city]
                        .filter(Boolean)
                        .join(" → ") || "—"}
                    </TableCell>
                    <TableCell className="text-sm">{l.loading_date}</TableCell>
                    <TableCell>
                      <StatusBadge value={l.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Verification history */}
      {submissions.length > 0 && (
        <Card className="border-[#e5e7eb]">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[#374151]">
              Verification submissions ({submissions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#f9fafb]">
                  <TableHead className="text-xs uppercase text-[#6b7280]">Date</TableHead>
                  <TableHead className="text-xs uppercase text-[#6b7280]">Status</TableHead>
                  <TableHead className="text-xs uppercase text-[#6b7280]">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm">{formatDate(s.created_at)}</TableCell>
                    <TableCell className="text-sm">{s.status}</TableCell>
                    <TableCell>
                      {s.review_decision ? (
                        <StatusBadge value={s.review_decision} />
                      ) : (
                        <span className="text-sm text-[#9ca3af]">Pending</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Audit log */}
      {auditLogs.length > 0 && (
        <Card className="border-[#e5e7eb]">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[#374151]">
              Activity history
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#f9fafb]">
                  <TableHead className="text-xs uppercase text-[#6b7280]">Date</TableHead>
                  <TableHead className="text-xs uppercase text-[#6b7280]">Action</TableHead>
                  <TableHead className="text-xs uppercase text-[#6b7280]">Entity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm text-[#6b7280]">
                      {formatDate(a.created_at)}
                    </TableCell>
                    <TableCell className="text-sm">{a.action.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-sm text-[#6b7280]">{a.entity_type}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <VerificationDocsModal
        open={docsOpen}
        onClose={() => setDocsOpen(false)}
        entityType="user"
        entityId={id}
        onDecisionMade={() => {
          setDocsOpen(false);
          void load();
        }}
      />
    </div>
  );
}
