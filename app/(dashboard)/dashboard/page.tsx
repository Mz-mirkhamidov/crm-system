"use client";
export const dynamic = "force-dynamic";

import { useMemo } from "react";
import { useLeads } from "@/lib/data/use-leads";
import { useOrders } from "@/lib/data/use-orders";
import { useFollowUps } from "@/lib/data/use-follow-ups";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { WelcomeWidget } from "@/components/dashboard/welcome-widget";
import { LeadsChart } from "@/components/dashboard/leads-chart";
import { TodayFollowUps, TodayOrders } from "@/components/dashboard/today-list";
import { AsyncContent } from "@/components/shared/async-content";
import { getOrderTotal } from "@/lib/utils";
import { format, startOfDay, endOfDay, parseISO } from "date-fns";

export default function DashboardPage() {
  // All reads now go through the typed data-access hooks (Requirement 4.1); each hook
  // surfaces its own load failure via a toast and an error state.
  const leads = useLeads();
  const orders = useOrders();
  const followUps = useFollowUps();

  const loading = leads.loading || orders.loading || followUps.loading;
  const error = leads.error ?? orders.error ?? followUps.error;

  const refetchAll = () => {
    leads.refetch();
    orders.refetch();
    followUps.refetch();
  };

  const derived = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const withinToday = (iso: string | null): boolean => {
      if (!iso) return false;
      const d = parseISO(iso);
      return d >= todayStart && d <= todayEnd;
    };

    const todayLeads = leads.data.filter((l) => withinToday(l.created_at)).length;

    const todayFollowUps = followUps.data
      .filter((f) => f.status === "Kutilmoqda" && withinToday(f.scheduled_at))
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));

    const todayOrders = orders.data
      .filter((o) => o.order_type === "Keyinroqi" && withinToday(o.scheduled_at))
      .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));

    // New leads per day over the last 7 days for the chart.
    const sevenDaysAgo = new Date(Date.now() - 6 * 86_400_000);
    const counts: Record<string, number> = {};
    for (const l of leads.data) {
      const created = parseISO(l.created_at);
      if (created >= startOfDay(sevenDaysAgo)) {
        const day = format(created, "yyyy-MM-dd");
        counts[day] = (counts[day] || 0) + 1;
      }
    }
    const chartData = Object.entries(counts).map(([date, count]) => ({ date, count }));

    return {
      todayLeads,
      totalOrders: orders.data.length,
      totalAmount: getOrderTotal(orders.data),
      todayFollowUps,
      todayOrders,
      chartData,
    };
  }, [leads.data, orders.data, followUps.data]);

  const loadingSkeleton = (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-secondary rounded" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-secondary rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-56 bg-secondary rounded-xl" />
        <div className="h-56 bg-secondary rounded-xl" />
      </div>
    </div>
  );

  return (
    <AsyncContent
      loading={loading}
      error={error}
      // Single sentinel item: the dashboard always has content to show (zeros are valid),
      // so this only toggles between loading / error / data — never the empty branch.
      data={[derived]}
      onRetry={refetchAll}
      loadingFallback={loadingSkeleton}
    >
      {([stats]) => (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{format(new Date(), "dd.MM.yyyy")} — Bugungi ish holati</p>
          </div>
          <WelcomeWidget />
          <StatsCards
            todayLeads={stats.todayLeads}
            totalOrders={stats.totalOrders}
            totalAmount={stats.totalAmount}
            todayCalls={stats.todayFollowUps.length}
            todayDeadlines={stats.todayOrders.length}
          />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2"><LeadsChart data={stats.chartData} /></div>
            <TodayFollowUps followUps={stats.todayFollowUps} />
          </div>
          {stats.todayOrders.length > 0 && <TodayOrders orders={stats.todayOrders} />}
        </div>
      )}
    </AsyncContent>
  );
}
