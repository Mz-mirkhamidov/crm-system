"use client";

import { useState } from "react";
import { useOrders } from "@/lib/data/use-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PersonDetailModal } from "@/components/shared/detail-modal";
import { AsyncContent } from "@/components/shared/async-content";
import { Trash2, Loader2, Search, Clock, CheckCheck, ChevronRight, ShoppingCart } from "lucide-react";
import { cn, formatDate, formatPrice, isTodayDate, getOrderTotal } from "@/lib/utils";
import type { Order, Lead, Client } from "@/types";

type Tab = "hozirgi" | "keyinroqi";

export function OrdersTable() {
  const { data: orders, loading, error, refetch, remove, confirm, loadSource } = useOrders();

  const [activeTab, setActiveTab] = useState<Tab>("hozirgi");
  const [search, setSearch] = useState("");
  const [detailPerson, setDetailPerson] = useState<Lead | Client | null>(null);
  const [detailType, setDetailType] = useState<"lead" | "client">("lead");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setBusyId(id);
    await remove(id);
    setBusyId(null);
  }

  async function handleConfirm(id: string) {
    setBusyId(id);
    await confirm(id);
    setBusyId(null);
    setActiveTab("hozirgi");
  }

  async function openDetail(order: Order) {
    const person = await loadSource(order);
    if (person) {
      setDetailPerson(person);
      setDetailType(order.source_type as "lead" | "client");
    }
  }

  const upcoming = orders.filter((o) => o.order_type === "Keyinroqi");
  const confirmed = orders.filter((o) => o.order_type === "Hozirgi");

  const filteredUpcoming = search ? upcoming.filter((o) => o.source_name?.toLowerCase().includes(search.toLowerCase())) : upcoming;
  const filteredConfirmed = search ? confirmed.filter((o) => o.source_name?.toLowerCase().includes(search.toLowerCase())) : confirmed;

  const confirmedTotal = getOrderTotal(filteredConfirmed);

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Mijoz ismi bo'yicha..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab("hozirgi")}
          className={cn("flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all",
            activeTab === "hozirgi" ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground"
          )}>
          <ShoppingCart className="w-4 h-4" />
          Zakazlar
          {filteredConfirmed.length > 0 && (
            <span className="bg-primary/20 text-primary text-xs rounded-full px-2 py-0.5">{filteredConfirmed.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("keyinroqi")}
          className={cn("flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all",
            activeTab === "keyinroqi" ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground"
          )}>
          <Clock className="w-4 h-4" />
          Keyinroqi
          {filteredUpcoming.length > 0 && (
            <span className={cn("text-xs rounded-full px-2 py-0.5",
              activeTab === "keyinroqi" ? "bg-orange-500/20 text-orange-400" : "bg-orange-500/20 text-orange-400"
            )}>{filteredUpcoming.length}</span>
          )}
        </button>
      </div>

      {activeTab === "hozirgi" ? (
        // ---- CONFIRMED ORDERS ----
        <AsyncContent
          loading={loading}
          error={error}
          data={filteredConfirmed}
          onRetry={refetch}
          empty={{ icon: ShoppingCart, title: "Zakazlar yo'q" }}
        >
          {(rows) => (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">
                  {rows.length} ta zakaz
                </p>
                <p className="text-sm font-semibold text-primary">{formatPrice(confirmedTotal)}</p>
              </div>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Mijoz</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Mahsulot</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Narx</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Manba</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">Sana</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((order) => {
                      const isBusy = busyId === order.id;
                      return (
                        <tr key={order.id} className="border-b border-border hover:bg-secondary/30 transition-colors">
                          <td className="px-4 py-3">
                            <button className="font-medium text-foreground hover:text-primary flex items-center gap-1 text-left" onClick={() => openDetail(order)}>
                              {order.source_name}<ChevronRight className="w-3 h-3 opacity-40" />
                            </button>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px] truncate">{order.product}</td>
                          <td className="px-4 py-3 font-semibold text-foreground">{formatPrice(order.price)}</td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="text-xs bg-secondary border border-border rounded-full px-2 py-0.5 text-muted-foreground">
                              {order.source_type === "lead" ? "Lid" : "Mijoz"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">{formatDate(order.created_at)}</td>
                          <td className="px-4 py-3">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:bg-red-500/10" disabled={isBusy}>
                                  {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Zakazni o'chirish</AlertDialogTitle>
                                  <AlertDialogDescription>Bu zakazni o'chirmoqchimisiz?</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Bekor</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(order.id)}>O'chirish</AlertDialogAction>
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
            </div>
          )}
        </AsyncContent>
      ) : (
        // ---- UPCOMING ORDERS ----
        <div>
          <p className="text-xs text-muted-foreground mb-3">
            Tasdiqlangan zahoti "Zakazlar" bo'limiga o'tadi
          </p>
          <AsyncContent
            loading={loading}
            error={error}
            data={filteredUpcoming}
            onRetry={refetch}
            empty={{ icon: Clock, title: "Keyinroqi zakazlar yo'q" }}
          >
            {(rows) => (
              <div className="space-y-3">
                {rows.map((order) => {
                  const today = order.scheduled_at ? isTodayDate(order.scheduled_at) : false;
                  const isBusy = busyId === order.id;
                  return (
                    <div key={order.id} className={cn(
                      "rounded-xl border p-4 flex items-center gap-4 transition-all",
                      today ? "bg-orange-500/10 border-orange-500/30" : "bg-card border-border"
                    )}>
                      <div className="flex-1 min-w-0">
                        <button className="font-semibold text-foreground hover:text-primary flex items-center gap-1 text-left" onClick={() => openDetail(order)}>
                          {order.source_name}<ChevronRight className="w-3 h-3 opacity-40" />
                        </button>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{order.product}</p>
                        <p className="text-sm font-semibold text-primary mt-1">{formatPrice(order.price)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {order.scheduled_at && (
                          <p className={cn("text-xs font-mono mb-2", today ? "text-orange-400 font-bold" : "text-muted-foreground")}>
                            {formatDate(order.scheduled_at)}
                            {today && <span className="ml-1">🔴 Bugun!</span>}
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline"
                            className="h-7 text-xs gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                            disabled={isBusy}
                            onClick={() => handleConfirm(order.id)}>
                            {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />} Tasdiqlash
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:bg-red-500/10" disabled={isBusy}>
                                {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Zakazni o'chirish</AlertDialogTitle>
                                <AlertDialogDescription>Bu zakazni o'chirmoqchimisiz?</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Bekor</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(order.id)}>O'chirish</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </AsyncContent>
        </div>
      )}

      <PersonDetailModal open={!!detailPerson} onClose={() => setDetailPerson(null)} person={detailPerson} sourceType={detailType} onRefresh={refetch} />
    </div>
  );
}
