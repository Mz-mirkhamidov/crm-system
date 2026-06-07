"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { LeadsChart } from "@/components/dashboard/leads-chart";
import { TodayFollowUps, TodayOrders } from "@/components/dashboard/today-list";
import type { FollowUp, Order } from "@/types";
import { format, startOfDay, endOfDay } from "date-fns";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [todayLeads, setTodayLeads] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [todayFollowUps, setTodayFollowUps] = useState<FollowUp[]>([]);
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [chartData, setChartData] = useState<{ date: string; count: number }[]>([]);

  const supabase = createClient();

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();

      const [leadsRes, ordersRes, fuRes, todayOrdRes, chartRes] = await Promise.all([
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", todayStart).lte("created_at", todayEnd),
        supabase.from("orders").select("price").eq("user_id", user.id),
        supabase.from("follow_ups").select("*").eq("user_id", user.id).eq("status", "Kutilmoqda").gte("scheduled_at", todayStart).lte("scheduled_at", todayEnd).order("scheduled_at"),
        supabase.from("orders").select("*").eq("user_id", user.id).eq("order_type", "Keyinroqi").gte("scheduled_at", todayStart).lte("scheduled_at", todayEnd).order("scheduled_at"),
        supabase.from("leads").select("created_at").eq("user_id", user.id).gte("created_at", new Date(Date.now() - 6 * 86400000).toISOString()),
      ]);

      setTodayLeads(leadsRes.count || 0);
      setTotalOrders(ordersRes.data?.length || 0);
      setTotalAmount(ordersRes.data?.reduce((s, o) => s + Number(o.price), 0) || 0);
      setTodayFollowUps((fuRes.data as FollowUp[]) || []);
      setTodayOrders((todayOrdRes.data as Order[]) || []);

      const counts: Record<string, number> = {};
      chartRes.data?.forEach((l) => {
        const day = format(new Date(l.created_at), "yyyy-MM-dd");
        counts[day] = (counts[day] || 0) + 1;
      });
      setChartData(Object.entries(counts).map(([date, count]) => ({ date, count })));
    } catch (e) {
      console.error("Dashboard load error:", e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
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
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {format(new Date(), "dd.MM.yyyy")} — Bugungi ish holati
        </p>
      </div>
      <StatsCards todayLeads={todayLeads} totalOrders={totalOrders} totalAmount={totalAmount} todayCalls={todayFollowUps.length} todayDeadlines={todayOrders.length} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><LeadsChart data={chartData} /></div>
        <TodayFollowUps followUps={todayFollowUps} />
      </div>
      {todayOrders.length > 0 && <TodayOrders orders={todayOrders} />}
    </div>
  );
}
