"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2 } from "lucide-react";
import { cn, formatDate, getStatusColor } from "@/lib/utils";

export default function AllLeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterOp, setFilterOp] = useState("all");
  const supabase = createClient();

  useEffect(() => { loadAll(); }, []);
  useEffect(() => {
    let f = leads;
    if (search) { const q = search.toLowerCase(); f = f.filter((l) => l.name.toLowerCase().includes(q) || l.phone.includes(q)); }
    if (filterOp !== "all") f = f.filter((l) => l.operator_id === filterOp);
    setFiltered(f);
  }, [search, filterOp, leads]);

  async function loadAll() {
    const [{ data: leadsData }, { data: opsData }] = await Promise.all([
      supabase.from("leads").select("*, operator_id").order("created_at", { ascending: false }),
      supabase.from("operators").select("id, name"),
    ]);
    const opMap: Record<string, string> = {};
    opsData?.forEach((o) => { opMap[o.id] = o.name; });
    const enriched = (leadsData || []).map((l) => ({ ...l, operator_name: opMap[l.operator_id] || "—" }));
    setLeads(enriched);
    setOperators(opsData || []);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Barcha lidlar</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Barcha operatorlarning lidlari</p>
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Ism yoki telefon..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterOp} onValueChange={setFilterOp}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Operator" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha operatorlar</SelectItem>
            {operators.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Ism</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Telefon</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Holat</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Operator</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Sana</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-b border-border hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{l.name}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{l.phone}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full border", getStatusColor(l.status))}>{l.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">{l.operator_name}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">Lidlar topilmadi</div>
          )}
        </div>
      )}
    </div>
  );
}
