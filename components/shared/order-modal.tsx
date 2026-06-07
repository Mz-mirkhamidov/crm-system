"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useOperator } from "@/lib/useOperator";
import { PRODUCTS, type SourceType, type ProductType, type OrderType } from "@/types";
import { Loader2, CheckSquare, Square } from "lucide-react";
import { cn, getProductColor } from "@/lib/utils";

interface SelectedProduct { product: ProductType; price: string; }

interface OrderModalProps {
  open: boolean; onClose: () => void;
  sourceId: string; sourceName: string; sourceType: SourceType;
  onSuccess: () => void;
}

export function OrderModal({ open, onClose, sourceId, sourceName, sourceType, onSuccess }: OrderModalProps) {
  const [selected, setSelected] = useState<SelectedProduct[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("Hozirgi");
  const [scheduledAt, setScheduledAt] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const operator = useOperator();
  const operatorId = operator?.id || "";
  const supabase = createClient();

  function toggleProduct(product: ProductType) {
    setSelected((prev) => {
      const exists = prev.find((p) => p.product === product);
      if (exists) return prev.filter((p) => p.product !== product);
      return [...prev, { product, price: "" }];
    });
  }

  function setPrice(product: ProductType, price: string) {
    setSelected((prev) => prev.map((p) => p.product === product ? { ...p, price } : p));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.length === 0) { alert("Kamida 1 ta mahsulot tanlang"); return; }
    if (selected.some((p) => !p.price)) { alert("Barcha tanlangan mahsulotlar narxini kiriting"); return; }
    setLoading(true);

    for (const item of selected) {
      const { error } = await supabase.from("orders").insert({
        user_id: operatorId, operator_id: operatorId,
        source_type: sourceType, source_id: sourceId, source_name: sourceName,
        product: item.product, price: parseFloat(item.price),
        order_type: orderType, comment: comment || null,
        scheduled_at: orderType === "Keyinroqi" && scheduledAt ? scheduledAt : null,
      });
      if (error) { alert("Xato: " + error.message); setLoading(false); return; }
    }

    if (sourceType === "lead") {
      await supabase.from("leads").update({ status: "Buyurtma berilgan" }).eq("id", sourceId);
    }

    setLoading(false); resetForm(); onSuccess(); onClose();
  }

  function resetForm() {
    setSelected([]); setOrderType("Hozirgi"); setScheduledAt(""); setComment("");
  }

  const total = selected.reduce((s, p) => s + (parseFloat(p.price) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={() => { resetForm(); onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Yangi zakaz — {sourceName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Mahsulotlar <span className="text-muted-foreground font-normal text-xs">(bir nechta tanlash mumkin)</span></Label>
            <div className="space-y-2">
              {PRODUCTS.map((product) => {
                const isSelected = selected.some((p) => p.product === product);
                const item = selected.find((p) => p.product === product);
                return (
                  <div key={product} className={cn("rounded-lg border transition-all", isSelected ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/30")}>
                    <button type="button" className="w-full flex items-center gap-3 px-3 py-2.5 text-left" onClick={() => toggleProduct(product)}>
                      {isSelected ? <CheckSquare className="w-4 h-4 text-primary flex-shrink-0" /> : <Square className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                      <span className={cn("text-sm px-2 py-0.5 rounded-full", getProductColor(product))}>{product}</span>
                    </button>
                    {isSelected && (
                      <div className="px-3 pb-3">
                        <Input type="number" placeholder="Narx (so'm)" value={item?.price || ""}
                          onChange={(e) => setPrice(product, e.target.value)} className="h-8 text-sm" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {total > 0 && (
              <p className="text-xs text-right text-primary font-semibold">
                Jami: {new Intl.NumberFormat("uz-UZ").format(total)} so'm
                {selected.length > 1 && ` · ${selected.length} ta mahsulot`}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Zakaz turi</Label>
            <Select value={orderType} onValueChange={(v) => setOrderType(v as OrderType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Hozirgi">Hozirgi</SelectItem>
                <SelectItem value="Keyinroqi">Keyinroqi</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {orderType === "Keyinroqi" && (
            <div className="space-y-1.5">
              <Label>Rejalashtirilgan sana</Label>
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Kommentariya (ixtiyoriy)</Label>
            <Input placeholder="Qo'shimcha ma'lumot..." value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { resetForm(); onClose(); }} className="flex-1">Bekor</Button>
            <Button type="submit" disabled={loading || selected.length === 0} className="flex-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Saqlash${selected.length > 1 ? ` (${selected.length})` : ""}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
