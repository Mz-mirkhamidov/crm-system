"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { OWNER_ID } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Loader2, Search, Clock } from "lucide-react";
import {
  cn,
  formatDate,
  formatPrice,
  getProductColor,
  isTodayDate,
} from "@/lib/utils";
import type { Order } from "@/types";
import { PRODUCTS } from "@/types";

export function OrdersTable() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filtered, setFiltered] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProduct, setFilterProduct] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");

  const supabase = createClient();

  useEffect(() => { loadOrders(); }, []);
  useEffect(() => {
    let f = orders;
    if (search) {
      const q = search.toLowerCase();
      f = f.filter((o) => o.source_name?.toLowerCase().includes(q));
    }
    if (filterProduct !== "all") f = f.filter((o) => o.product === filterProduct);
    if (filterType !== "all") f = f.filter((o) => o.order_type === filterType);
    setFiltered(f);
  }, [orders, search, filterProduct, filterType]);

  async function loadOrders() {
    try {
      const user = { id: OWNER_ID };
    const { data } = await supabase
        .from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setOrders((data as Order[]) || []);
    } catch (e) {
      console.error("loadOrders error:", e);
    } finally {
      setLoading(false);
    }
  }

  async function deleteOrder(id: string) {
    await supabase.from("orders").delete().eq("id", id);
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }

  const upcoming = filtered.filter((o) => o.order_type === "Keyinroqi");
  const current = filtered.filter((o) => o.order_type === "Hozirgi");

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Mijoz ismi..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterProduct} onValueChange={setFilterProduct}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Mahsulot" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha mahsulotlar</SelectItem>
            {PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Tur" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Hammasi</SelectItem>
            <SelectItem value="Hozirgi">Hozirgi</SelectItem>
            <SelectItem value="Keyinroqi">Keyinroqi</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Yuklanmoqda...
        </div>
      ) : (
        <>
          {/* Upcoming orders */}
          {(filterType === "all" || filterType === "Keyinroqi") && upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-400" />
                Keyinroqi zakazlar
                <span className="bg-orange-500/20 text-orange-400 text-xs rounded-full px-2 py-0.5 border border-orange-500/30">
                  {upcoming.length}
                </span>
              </h2>
              <OrdersGrid orders={upcoming} onDelete={deleteOrder} showScheduled />
            </div>
          )}

          {/* Current orders */}
          {(filterType === "all" || filterType === "Hozirgi") && (
            <div>
              {filterType === "all" && (
                <h2 className="text-sm font-semibold text-foreground mb-3">
                  Barcha zakazlar
                </h2>
              )}
              {current.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">Zakazlar topilmadi</div>
              ) : (
                <OrdersGrid orders={current} onDelete={deleteOrder} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OrdersGrid({ orders, onDelete, showScheduled }: { orders: Order[]; onDelete: (id: string) => void; showScheduled?: boolean }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/50">
            <th className="text-left px-4 py-3 text-muted-foreground font-medium">Mijoz</th>
            <th className="text-left px-4 py-3 text-muted-foreground font-medium">Mahsulot</th>
            <th className="text-left px-4 py-3 text-muted-foreground font-medium">Narx</th>
            <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Manba</th>
            {showScheduled && <th className="text-left px-4 py-3 text-muted-foreground font-medium">Sana</th>}
            <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">Yaratilgan</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const isToday = order.scheduled_at ? isTodayDate(order.scheduled_at) : false;
            return (
              <tr key={order.id} className={cn("border-b border-border hover:bg-secondary/30 transition-colors", isToday && "bg-orange-500/5")}>
                <td className="px-4 py-3 font-medium">{order.source_name}</td>
                <td className="px-4 py-3">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", getProductColor(order.product))}>
                    {order.product}
                  </span>
                </td>
                <td className="px-4 py-3 text-foreground font-medium">{formatPrice(order.price)}</td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-xs bg-secondary border border-border rounded-full px-2 py-0.5 text-muted-foreground capitalize">
                    {order.source_type}
                  </span>
                </td>
                {showScheduled && (
                  <td className="px-4 py-3">
                    {order.scheduled_at && (
                      <span className={cn("text-xs font-mono", isToday ? "text-orange-400 font-semibold" : "text-muted-foreground")}>
                        {formatDate(order.scheduled_at)}
                        {isToday && " 🔔"}
                      </span>
                    )}
                  </td>
                )}
                <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                  {formatDate(order.created_at)}
                </td>
                <td className="px-4 py-3">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:bg-red-500/10">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Zakazni o'chirish</AlertDialogTitle>
                        <AlertDialogDescription>Bu zakazni o'chirmoqchimisiz?</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Bekor</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(order.id)}>O'chirish</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
