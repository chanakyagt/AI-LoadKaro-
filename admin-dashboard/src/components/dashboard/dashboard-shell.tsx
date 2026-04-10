"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { GlobalSearch } from "@/components/dashboard/global-search";
import type { DashboardRole } from "@/lib/auth/dashboard-role";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type NavItem = {
  segment: string;
  label: string;
  badge?: number;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const ADMIN_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [{ segment: "dashboard", label: "Dashboard" }],
  },
  {
    title: "Operations",
    items: [
      { segment: "loads", label: "Loads" },
      { segment: "availabilities", label: "Availabilities" },
      { segment: "leads", label: "Leads" },
      { segment: "alerts", label: "Alerts" },
    ],
  },
  {
    title: "Users & Vehicles",
    items: [
      { segment: "users", label: "Users" },
      { segment: "shippers", label: "Shippers" },
      { segment: "truck-owners", label: "Truck Owners" },
      { segment: "trucks", label: "Trucks" },
    ],
  },
  {
    title: "Verification",
    items: [{ segment: "verifications", label: "Verification Queue" }],
  },
  {
    title: "Settings",
    items: [
      { segment: "add-moderator", label: "Add Moderator" },
      { segment: "activity-log", label: "Activity Log" },
    ],
  },
];

const MODERATOR_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [{ segment: "dashboard", label: "Dashboard" }],
  },
  {
    title: "Operations",
    items: [
      { segment: "loads", label: "Loads" },
      { segment: "availabilities", label: "Availabilities" },
    ],
  },
  {
    title: "Users & Vehicles",
    items: [
      { segment: "users", label: "Users" },
      { segment: "shippers", label: "Shippers" },
      { segment: "truck-owners", label: "Truck Owners" },
      { segment: "trucks", label: "Trucks" },
    ],
  },
  {
    title: "Verification",
    items: [{ segment: "verifications", label: "Verification Queue" }],
  },
];

function usePendingCounts() {
  const [counts, setCounts] = useState<{ alerts: number; verifications: number }>({
    alerts: 0,
    verifications: 0,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const [alertRes, userRes, truckRes] = await Promise.all([
          supabase
            .from("admin_alerts")
            .select("*", { count: "exact", head: true })
            .eq("is_handled", false),
          supabase
            .from("users")
            .select("*", { count: "exact", head: true })
            .eq("verification_status", "pending"),
          supabase
            .from("trucks")
            .select("*", { count: "exact", head: true })
            .eq("verification_status", "pending"),
        ]);
        if (!cancelled) {
          setCounts({
            alerts: alertRes.count ?? 0,
            verifications: (userRes.count ?? 0) + (truckRes.count ?? 0),
          });
        }
      } catch {
        // silent
      }
    };
    void load();
    const interval = setInterval(() => void load(), 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return counts;
}

type Props = {
  role: DashboardRole;
  children: React.ReactNode;
};

export function DashboardShell({ role, children }: Props) {
  const pathname = usePathname();
  const base = role === "admin" ? "/admin" : "/moderator";
  const sections = role === "admin" ? ADMIN_SECTIONS : MODERATOR_SECTIONS;
  const counts = usePendingCounts();

  const badgeMap: Record<string, number> = {
    alerts: counts.alerts,
    verifications: counts.verifications,
  };

  const breadcrumb = (() => {
    const rel = pathname.replace(base, "").replace(/^\//, "");
    if (!rel || rel === "dashboard") return null;
    const parts = rel.split("/");
    return parts.map((p) =>
      p
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    );
  })();

  const onLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.assign("/login");
  };

  return (
    <div className="flex min-h-screen bg-[#f9fafb] text-[#111827]">
      <aside className="flex w-60 flex-col border-r border-[#e5e7eb] bg-white">
        <div className="border-b border-[#e5e7eb] px-4 py-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
            LoadKaro
          </p>
          <p className="text-lg font-bold text-[#111827]">
            {role === "admin" ? "Admin" : "Moderator"}
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {sections.map((section, si) => (
            <div key={section.title}>
              {si > 0 && <Separator className="my-2" />}
              <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-[#9ca3af]">
                {section.title}
              </p>
              {section.items.map((item) => {
                const href = `${base}/${item.segment}`;
                const active =
                  pathname === href ||
                  (item.segment !== "dashboard" && pathname.startsWith(href));
                const badge = badgeMap[item.segment] ?? 0;
                return (
                  <Link
                    key={item.segment}
                    href={href}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-[#111827] text-white"
                        : "text-[#374151] hover:bg-[#f3f4f6]"
                    )}
                  >
                    <span>{item.label}</span>
                    {badge > 0 && (
                      <span
                        className={cn(
                          "ml-2 min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold leading-none",
                          active
                            ? "bg-white/20 text-white"
                            : "bg-red-100 text-red-700"
                        )}
                      >
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <Separator />
        <div className="p-3">
          <Button
            type="button"
            variant="outline"
            className="w-full border-[#e5e7eb] text-[#374151]"
            onClick={onLogout}
          >
            Log out
          </Button>
        </div>
      </aside>
      <main className="min-h-screen flex-1 overflow-y-auto p-8">
        <div className="mb-6">
          <GlobalSearch basePath={base} />
        </div>
        {breadcrumb && (
          <div className="mb-4 flex items-center gap-1.5 text-sm text-[#9ca3af]">
            <Link href={`${base}/dashboard`} className="hover:text-[#374151]">
              Dashboard
            </Link>
            {breadcrumb.map((part, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span>/</span>
                <span className={i === breadcrumb.length - 1 ? "font-medium text-[#111827]" : ""}>
                  {part}
                </span>
              </span>
            ))}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
