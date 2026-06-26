"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, ShoppingCart, UserCheck, TrendingUp } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface OpStat {
  id: string; name: string; phone: string; is_active: boolean;
  leads: number; clients: number; orders: number; revenue: number;
}

export default function AdminPage() {
  const [stats, setStats] = useState<OpStat[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    const { data: operators } = await supabase.from("operators").select("*").order("created_at");
    if (!operators) { setLoading(false); return; }

    const statsData = await Promise.all(operators.map(async (op) => {
      const [{ count: leads }, { count: clients }, { data: orders }] = await Promise.all([
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("operator_id", op.id),
        supabase.from("clients").select("*", { count: "exact", head: true }).eq("operator_id", op.id),
        supabase.from("orders").select("price").eq("operator_id", op.id),
      ]);
      const revenue = orders?.reduce((s, o) => s + Number(o.price), 0) || 0;
      return { id: op.id, name: op.name, phone: op.phone, is_active: op.is_active, leads: leads || 0, clients: clients || 0, orders: orders?.length || 0, revenue };
    }));

    setStats(statsData);
    setLoading(false);
  }

  const totals = stats.reduce((acc, s) => ({
    leads: acc.leads + s.leads,
    clients: acc.clients + s.clients,
    orders: acc.orders + s.orders,
    revenue: acc.revenue + s.revenue,
  }), { leads: 0, clients: 0, orders: 0, revenue: 0 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Barcha operatorlar statistikasi</p>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Jami lidlar", value: totals.leads, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
          { label: "Jami mijozlar", value: totals.clients, icon: UserCheck, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
          { label: "Jami zakazlar", value: totals.orders, icon: ShoppingCart, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
          { label: "Jami daromad", value: formatPrice(totals.revenue), icon: TrendingUp, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`bg-card border rounded-xl p-5 ${card.bg}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Operators table */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Operatorlar ({stats.length})</h2>
        {loading ? (
          <p className="text-muted-foreground text-sm">Yuklanmoqda...</p>
        ) : (
          <div className="rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Operator</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Telefon</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Lidlar</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Mijozlar</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Zakazlar</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Daromad</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Holat</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.id} className="border-b border-border hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{s.phone}</td>
                    <td className="px-4 py-3 text-blue-400 font-semibold">{s.leads}</td>
                    <td className="px-4 py-3 text-emerald-400 font-semibold">{s.clients}</td>
                    <td className="px-4 py-3 text-violet-400 font-semibold">{s.orders}</td>
                    <td className="px-4 py-3 text-orange-400 font-semibold text-xs">{formatPrice(s.revenue)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${s.is_active ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}>
                        {s.is_active ? "Faol" : "Bloklangan"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
