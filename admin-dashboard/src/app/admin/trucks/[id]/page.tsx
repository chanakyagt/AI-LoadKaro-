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

type TruckProfile = {
  id: string;
  category: string;
  capacity_tons: number | null;
  permit_type: string | null;
  gps_available: boolean;
  axle_count: number | null;
  wheel_count: number | null;
  internal_length: number | null;
  internal_width: number | null;
  internal_height: number | null;
  verification_status: string;
  created_at: string;
  truck_variants?: { display_name?: string } | null;
  users?: { id?: string; name?: string; phone?: string } | null;
};

type AvailRow = {
  id: string;
  available_from: string;
  available_till: string | null;
  status: string;
  expected_rate: number | null;
  origin?: { city?: string; state?: string } | null;
  destination?: { city?: string; state?: string } | null;
};

type SubmissionRow = {
  id: string;
  status: string;
  review_decision: string | null;
  created_at: string;
};

type AuditRow = {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  unverified: "bg-gray-50 text-gray-600 border-gray-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  available: "bg-blue-50 text-blue-700 border-blue-200",
  closed: "bg-gray-50 text-gray-600 border-gray-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

function SBadge({ value }: { value: string }) {
  const c = STATUS_COLORS[value.toLowerCase()] ?? "bg-gray-50 text-gray-600 border-gray-200";
  return <Badge className={`border ${c}`}>{value}</Badge>;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
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

export default function TruckDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [truck, setTruck] = useState<TruckProfile | null>(null);
  const [avails, setAvails] = useState<AvailRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [docsOpen, setDocsOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const selectTruck = [
      "id", "category", "capacity_tons", "permit_type", "gps_available",
      "axle_count", "wheel_count", "internal_length", "internal_width", "internal_height",
      "verification_status", "created_at",
      "truck_variants(display_name)",
      "users!trucks_owner_id_fkey(id,name,phone)",
    ].join(",");

    const [truckRes, availRes, subsRes, auditRes] = await Promise.all([
      fetchJson<{ data: TruckProfile[] }>(
        `/api/admin/data?table=trucks&select=${encodeURIComponent(selectTruck)}&pageSize=1&sortColumn=id&sortAsc=true&searchColumn=id&searchValue=${id}&filters=${encodeURIComponent("{}")}`
      ),
      fetchJson<{ data: AvailRow[] }>(
        `/api/admin/data?table=availabilities&select=${encodeURIComponent("id,available_from,available_till,status,expected_rate,origin:locations!availabilities_origin_location_id_fkey(city,state),destination:locations!availabilities_destination_location_id_fkey(city,state)")}&pageSize=50&sortColumn=available_from&sortAsc=false&filters=${encodeURIComponent(JSON.stringify({ truck_id: id }))}&searchColumn=&searchValue=`
      ),
      fetchJson<{ data: SubmissionRow[] }>(
        `/api/admin/verification/submissions?entity_type=truck&entity_id=${id}`
      ),
      fetchJson<{ data: AuditRow[] }>(
        `/api/admin/data?table=audit_log&select=id,action,entity_type,created_at&pageSize=20&sortColumn=created_at&sortAsc=false&filters=${encodeURIComponent(JSON.stringify({ entity_id: id }))}&searchColumn=&searchValue=`
      ),
    ]);

    setTruck(truckRes?.data?.[0] ?? null);
    setAvails(availRes?.data ?? []);
    setSubmissions(subsRes?.data ?? []);
    setAuditLogs(auditRes?.data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#e5e7eb] border-t-[#111827]" />
      </div>
    );
  }

  if (!truck) {
    return (
      <div className="py-20 text-center text-[#6b7280]">
        Truck not found.{" "}
        <Link href="/admin/trucks" className="text-[#111827] underline">Back to Trucks</Link>
      </div>
    );
  }

  const owner = truck.users;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">
            {truck.category} · {truck.truck_variants?.display_name ?? "—"}
          </h1>
          <p className="mt-1 text-sm text-[#6b7280]">
            {truck.capacity_tons ?? "—"} tons · {truck.permit_type ?? "—"} · Added{" "}
            {formatDate(truck.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SBadge value={truck.verification_status} />
          <Button size="sm" variant="outline" onClick={() => setDocsOpen(true)}>
            Documents
          </Button>
        </div>
      </div>

      {/* Specs + Owner */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-[#e5e7eb]">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[#374151]">
              Specifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-[#9ca3af]">Category</dt>
                <dd className="font-medium">{truck.category}</dd>
              </div>
              <div>
                <dt className="text-[#9ca3af]">Variant</dt>
                <dd className="font-medium">{truck.truck_variants?.display_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[#9ca3af]">Capacity</dt>
                <dd className="font-medium">{truck.capacity_tons ?? "—"} tons</dd>
              </div>
              <div>
                <dt className="text-[#9ca3af]">Permit</dt>
                <dd className="font-medium">{truck.permit_type ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[#9ca3af]">GPS</dt>
                <dd className="font-medium">{truck.gps_available ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-[#9ca3af]">Axles / Wheels</dt>
                <dd className="font-medium">
                  {truck.axle_count ?? "—"} / {truck.wheel_count ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[#9ca3af]">Internal (L×W×H)</dt>
                <dd className="font-medium">
                  {[truck.internal_length, truck.internal_width, truck.internal_height]
                    .map((v) => (v != null ? String(v) : "—"))
                    .join(" × ")}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="border-[#e5e7eb]">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[#374151]">
              Owner
            </CardTitle>
          </CardHeader>
          <CardContent>
            {owner ? (
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-[#9ca3af]">Name:</span>{" "}
                  <Link
                    href={`/admin/users/${owner.id}`}
                    className="font-medium text-[#111827] underline"
                  >
                    {owner.name ?? "—"}
                  </Link>
                </p>
                <p>
                  <span className="text-[#9ca3af]">Phone:</span>{" "}
                  <span className="font-medium">{owner.phone ?? "—"}</span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-[#9ca3af]">Owner info not available.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Availabilities */}
      {avails.length > 0 && (
        <Card className="border-[#e5e7eb]">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[#374151]">
              Availabilities ({avails.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#f9fafb]">
                  <TableHead className="text-xs uppercase text-[#6b7280]">Route</TableHead>
                  <TableHead className="text-xs uppercase text-[#6b7280]">Dates</TableHead>
                  <TableHead className="text-xs uppercase text-[#6b7280]">Rate</TableHead>
                  <TableHead className="text-xs uppercase text-[#6b7280]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {avails.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm">
                      {[a.origin?.city, a.destination?.city].filter(Boolean).join(" → ") || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {a.available_from}{a.available_till ? ` – ${a.available_till}` : ""}
                    </TableCell>
                    <TableCell className="text-sm">
                      {a.expected_rate != null ? `₹${Number(a.expected_rate).toLocaleString()}` : "—"}
                    </TableCell>
                    <TableCell>
                      <SBadge value={a.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Verification submissions */}
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
                      {s.review_decision ? <SBadge value={s.review_decision} /> : <span className="text-sm text-[#9ca3af]">Pending</span>}
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
            <CardTitle className="text-sm font-semibold text-[#374151]">Activity history</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#f9fafb]">
                  <TableHead className="text-xs uppercase text-[#6b7280]">Date</TableHead>
                  <TableHead className="text-xs uppercase text-[#6b7280]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm text-[#6b7280]">{formatDate(a.created_at)}</TableCell>
                    <TableCell className="text-sm">{a.action.replace(/_/g, " ")}</TableCell>
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
        entityType="truck"
        entityId={id}
        onDecisionMade={() => { setDocsOpen(false); void loadData(); }}
      />
    </div>
  );
}
