import { StatsGrid } from "@/components/dashboard/stats-grid";
import { fetchDashboardStats } from "@/lib/supabase/queries/stats";

export default async function ModeratorDashboardPage() {
  let stats = null;
  let error: string | null = null;
  try {
    stats = await fetchDashboardStats();
  } catch (e) {
    error =
      e instanceof Error
        ? e.message
        : "Could not load stats. Check Supabase env and RLS policies.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">Dashboard</h1>
        <p className="text-sm text-[#6b7280]">
          Same overview as admin — approve / view only; destructive actions are
          disabled in this role.
        </p>
      </div>
      <StatsGrid stats={stats} error={error} basePath="/moderator" />
    </div>
  );
}
