"use client";

import { useState, useEffect } from "react";
import { useOperator } from "@/lib/useOperator";
import { useToast } from "@/components/ui/use-toast";
import { listOrdersForSource, listFollowUpsForSource } from "@/lib/data/repository";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OrderModal } from "@/components/shared/order-modal";
import { FollowUpModal } from "@/components/shared/follow-up-modal";
import { AsyncContent } from "@/components/shared/async-content";
import {
  Phone, MapPin, MessageSquare, ShoppingCart, Bell,
  Clock, CheckCircle2, Package, Loader2, Calendar,
} from "lucide-react";
import { cn, formatDate, formatPrice, getStatusColor, getProductColor, formatPhoneForCall, getOrderTotal } from "@/lib/utils";
import type { Lead, Client, Order, FollowUp, SourceType } from "@/types";

interface PersonDetailModalProps {
  open: boolean;
  onClose: () => void;
  person: Lead | Client | null;
  sourceType: SourceType;
  onRefresh?: () => void;
}

export function PersonDetailModal({ open, onClose, person, sourceType, onRefresh }: PersonDetailModalProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const operator = useOperator();
  const operatorId = operator?.id || "";
  const toast = useToast();

  useEffect(() => {
    if (open && person) loadDetails();
  }, [open, person?.id]);

  async function loadDetails() {
    if (!person) return;
    setLoading(true);
    setError(null);
    const [ordersRes, fuRes] = await Promise.all([
      listOrdersForSource(operatorId, person.id, sourceType),
      listFollowUpsForSource(operatorId, person.id, sourceType),
    ]);
    if (!ordersRes.ok || !fuRes.ok) {
      const message = !ordersRes.ok ? ordersRes.error : (fuRes as { ok: false; error: string }).error;
      setError(message);
      toast.error(message);
      setLoading(false);
      return;
    }
    setOrders(ordersRes.data);
    setFollowUps(fuRes.data);
    setLoading(false);
  }

  if (!person) return null;

  const isLead = sourceType === "lead";
  const lead = isLead ? (person as Lead) : null;

  const totalAmount = getOrderTotal(orders);
  const pendingFU = followUps.filter((f) => f.status === "Kutilmoqda").length;

  const compactLoading = (
    <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <DialogHeader>
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xl font-bold text-primary flex-shrink-0">
                {person.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl">{person.name}</DialogTitle>
                <a href={`tel:${formatPhoneForCall(person.phone)}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mt-1 w-fit">
                  <Phone className="w-3.5 h-3.5" />
                  {person.phone}
                </a>
                <div className="flex items-center flex-wrap gap-2 mt-2">
                  {isLead && lead?.tag && (
                    <span className="text-xs bg-secondary border border-border rounded-full px-2.5 py-0.5">{lead.tag}</span>
                  )}
                  {isLead && lead?.status && (
                    <span className={cn("text-xs px-2.5 py-0.5 rounded-full border font-medium", getStatusColor(lead.status))}>
                      {lead.status}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{formatDate(person.created_at)}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-3 flex-shrink-0">
                <div className="text-center">
                  <p className="text-lg font-bold text-primary">{orders.length}</p>
                  <p className="text-xs text-muted-foreground">Zakaz</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-orange-400">{pendingFU}</p>
                  <p className="text-xs text-muted-foreground">Kutilmoqda</p>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {/* Info */}
            {(person.address || person.comment) && (
              <div className="bg-secondary/50 rounded-xl p-4 space-y-2.5">
                {person.address && (
                  <div className="flex items-start gap-2.5 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span>{person.address}</span>
                  </div>
                )}
                {person.comment && (
                  <div className="flex items-start gap-2.5 text-sm">
                    <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="whitespace-pre-wrap">{person.comment}</span>
                  </div>
                )}
              </div>
            )}

            {/* Orders */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Package className="w-4 h-4 text-purple-400" />
                  Zakazlar
                  {orders.length > 0 && (
                    <span className="text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full px-2 py-0.5">
                      {orders.length} ta • {formatPrice(totalAmount)}
                    </span>
                  )}
                </h3>
                <Button size="sm" variant="outline"
                  className="h-7 text-xs gap-1 border-green-500/30 text-green-400 hover:bg-green-500/10"
                  onClick={() => setOrderModalOpen(true)}>
                  <ShoppingCart className="w-3 h-3" /> Zakaz qo'shish
                </Button>
              </div>
              <AsyncContent
                loading={loading}
                error={error}
                data={orders}
                onRetry={loadDetails}
                loadingFallback={compactLoading}
                empty={{ title: "Hali zakaz yo'q" }}
              >
                {(rows) => (
                  <div className="space-y-2">
                    {rows.map((o) => (
                      <div key={o.id} className="flex items-center gap-3 bg-secondary/50 border border-border rounded-lg px-4 py-3">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full flex-shrink-0", getProductColor(o.product))}>
                          {o.product}
                        </span>
                        <span className="text-sm font-semibold text-foreground">{formatPrice(o.price)}</span>
                        {o.order_type === "Keyinroqi" && o.scheduled_at && (
                          <span className="flex items-center gap-1 text-xs text-orange-400 ml-auto">
                            <Calendar className="w-3 h-3" />
                            {formatDate(o.scheduled_at)}
                          </span>
                        )}
                        {o.order_type === "Hozirgi" && (
                          <span className="ml-auto text-xs text-muted-foreground">{formatDate(o.created_at)}</span>
                        )}
                        {o.comment && (
                          <span className="text-xs text-muted-foreground truncate max-w-[120px]">{o.comment}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </AsyncContent>
            </div>

            {/* Follow-ups */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Bell className="w-4 h-4 text-blue-400" />
                  Eslatmalar
                  {pendingFU > 0 && (
                    <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-2 py-0.5">
                      {pendingFU} kutilmoqda
                    </span>
                  )}
                </h3>
                <Button size="sm" variant="outline"
                  className="h-7 text-xs gap-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                  onClick={() => setFollowUpModalOpen(true)}>
                  <Bell className="w-3 h-3" /> Eslatma qo'shish
                </Button>
              </div>
              <AsyncContent
                loading={loading}
                error={error}
                data={followUps}
                onRetry={loadDetails}
                loadingFallback={compactLoading}
                empty={{ title: "Eslatmalar yo'q" }}
              >
                {(rows) => (
                  <div className="space-y-2">
                    {rows.map((f) => (
                      <div key={f.id} className={cn(
                        "flex items-start gap-3 rounded-lg px-4 py-3 border",
                        f.status === "Bajarildi" ? "bg-secondary/30 border-border opacity-60" : "bg-secondary/50 border-border"
                      )}>
                        {f.status === "Bajarildi"
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                          : <Clock className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground">{formatDate(f.scheduled_at)}</p>
                          {f.note && <p className="text-sm text-foreground mt-0.5">{f.note}</p>}
                        </div>
                        <span className={cn("text-xs flex-shrink-0", f.status === "Bajarildi" ? "text-emerald-400" : "text-orange-400")}>
                          {f.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </AsyncContent>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2 border-t border-border">
              <a href={`tel:${formatPhoneForCall(person.phone)}`} className="flex-1">
                <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" /> Qo'ng'iroq
                </Button>
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {orderModalOpen && (
        <OrderModal open={orderModalOpen} onClose={() => setOrderModalOpen(false)}
          sourceId={person.id} sourceName={person.name} sourceType={sourceType}
          onSuccess={() => { loadDetails(); onRefresh?.(); }}
        />
      )}
      {followUpModalOpen && (
        <FollowUpModal open={followUpModalOpen} onClose={() => setFollowUpModalOpen(false)}
          sourceId={person.id} sourceName={person.name} sourcePhone={person.phone}
          sourceType={sourceType} onSuccess={loadDetails}
        />
      )}
    </>
  );
}
