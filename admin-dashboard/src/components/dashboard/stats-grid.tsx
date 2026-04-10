import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardStats } from "@/lib/supabase/queries/stats";

type Props = {
  stats: DashboardStats | null;
  error?: string | null;
  basePath?: string;
};

function KpiCard({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: number;
  href?: string;
  accent?: string;
}) {
  const inner = (
    <Card className="border-[#e5e7eb] bg-white shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold tabular-nums ${accent ?? "text-[#111827]"}`}>
          {value.toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}

function BreakdownBar({
  title,
  data,
  colors,
}: {
  title: string;
  data: Record<string, number>;
  colors: Record<string, string>;
}) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  return (
    <Card className="border-[#e5e7eb] bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#374151]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex h-3 overflow-hidden rounded-full bg-[#f3f4f6]">
          {Object.entries(data).map(([key, count]) => {
            const pct = (count / total) * 100;
            if (pct === 0) return null;
            return (
              <div
                key={key}
                className={`${colors[key] ?? "bg-gray-400"}`}
                style={{ width: `${pct}%` }}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(data).map(([key, count]) => (
            <div key={key} className="flex items-center gap-1.5 text-xs text-[#6b7280]">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors[key] ?? "bg-gray-400"}`} />
              <span className="capitalize">{key.replace(/_/g, " ")}</span>
              <span className="font-semibold text-[#374151]">{count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const ROLE_COLORS: Record<string, string> = {
  shipper: "bg-blue-500",
  truck_owner: "bg-emerald-500",
  broker: "bg-purple-500",
  admin: "bg-[#111827]",
  moderator: "bg-amber-500",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500",
  matched: "bg-emerald-500",
  cancelled: "bg-red-500",
  closed: "bg-gray-400",
};

export function StatsGrid({ stats, error, basePath = "/admin" }: Props) {
  if (error) {
    return (
      <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
        {error}
      </div>
    );
  }
  if (!stats) {
    return (
      <p className="text-sm text-[#6b7280]">
        Configure <code className="rounded bg-[#f3f4f6] px-1">.env.local</code>{" "}
        with Supabase keys to load stats.
      </p>
    );
  }

  const pendingTotal =
    stats.pendingUserVerifications + stats.pendingTruckVerifications;

  return (
    <div className="space-y-6">
      {/* Primary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Users" value={stats.totalUsers} href={`${basePath}/users`} />
        <KpiCard label="Total Trucks" value={stats.totalTrucks} href={`${basePath}/trucks`} />
        <KpiCard label="Total Loads" value={stats.totalLoads} href={`${basePath}/loads`} />
        <KpiCard
          label="Total Availabilities"
          value={stats.totalAvailabilities}
          href={`${basePath}/availabilities`}
        />
      </div>

      {/* Operational KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Open Loads"
          value={stats.openLoads}
          accent="text-blue-600"
          href={`${basePath}/loads`}
        />
        <KpiCard
          label="Active Availabilities"
          value={stats.activeAvailabilities}
          accent="text-emerald-600"
          href={`${basePath}/availabilities`}
        />
        <KpiCard
          label="Pending Verifications"
          value={pendingTotal}
          accent={pendingTotal > 0 ? "text-amber-600" : undefined}
          href={`${basePath}/verifications`}
        />
        <KpiCard
          label="Unhandled Alerts"
          value={stats.unhandledAlerts}
          accent={stats.unhandledAlerts > 0 ? "text-red-600" : undefined}
          href={`${basePath}/alerts`}
        />
      </div>

      {/* Breakdowns */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownBar
          title="Users by role"
          data={stats.usersByRole}
          colors={ROLE_COLORS}
        />
        <BreakdownBar
          title="Loads by status"
          data={stats.loadsByStatus}
          colors={STATUS_COLORS}
        />
      </div>
    </div>
  );
}
