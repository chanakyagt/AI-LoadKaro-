import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default function ModeratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell role="moderator">{children}</DashboardShell>;
}
