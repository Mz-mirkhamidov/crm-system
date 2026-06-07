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
import { Loader2, CheckSquare, Square, Minus, Plus, ShoppingBag } from "lucide-react";
import { cn, getProductColor } from "@/lib/utils";

interface SelectedItem { product: ProductType; qty: number; }

interface OrderModalProps {
  open: boolean; onClose: () => void;
  sourceId: string; sourceName: string; sourceType: SourceType;
  onSuccess: () => void;
}

export function OrderModal({ open, onClose, sourceId, sourceName, sourceType, onSuccess }: OrderModalProps) {
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [totalPrice, setTotalPrice] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("Hozirgi");
  const [scheduledAt, setScheduledAt] = useState("");
  const [comment, setComment] = useState("");
  const [step, setStep] = useState<"products" | "price">("products");
  const [loading, setLoading] = useState(false);
  const operator = useOperator();
  const operatorId = operator?.id || "";
  const supabase = createClient();

  function toggleProduct(product: ProductType) {
    setItems((prev) => {
      const exists = prev.find((p) => p.product === product);
      if (exists) return prev.filter((p) => p.product !== product);
      return [...prev, { product, qty: 1 }];
    });
  }

  function setQty(product: ProductType, delta: number) {
    setItems((prev) => prev.map((p) => p.product === product
      ? { ...p, qty: Math.max(1, p.qty + delta) }
      : p
    ));
  }

  function getProductSummary() {
    return items.map((i) => `${i.product} (${i.qty} ta)`).join(", ");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!totalPrice) return;
    setLoading(true);

    const productStr = getProductSummary();
    const totalQty = items.reduce((s, i) => s + i.qty, 0);

    const { error } = await supabase.from("orders").insert({
      user_id: operatorId, operator_id: operatorId,
      source_type: sourceType, source_id: sourceId, source_name: sourceName,
      product: productStr,
      price: parseFloat(totalPrice),
      quantity: totalQty,
      order_type: orderType, comment: comment || null,
      scheduled_at: orderType === "Keyinroqi" && scheduledAt ? scheduledAt : null,
    });

    if (error) { alert("Xato: " + error.message); setLoading(false); return; }

    if (sourceType === "lead") {
      await supabase.from("leads").update({ status: "Buyurtma berilgan" }).eq("id", sourceId);
    }

    setLoading(false); resetForm(); onSuccess(); onClose();
  }

  function resetForm() {
    setItems([]); setTotalPrice(""); setOrderType("Hozirgi");
    setScheduledAt(""); setComment(""); setStep("products");
  }

  return (
    <Dialog open={open} onOpenChange={() => { resetForm(); onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-primary" />
            Yangi zakaz — {sourceName}
          </DialogTitle>
        </DialogHeader>

        {step === "products" ? (
          // STEP 1: Select products + quantities
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Mahsulot va miqdorini tanlang:</p>
            {PRODUCTS.map((product) => {
              const item = items.find((i) => i.product === product);
              const isSelected = !!item;
              return (
                <div key={product} className={cn("rounded-xl border transition-all", isSelected ? "border-primary/40 bg-primary/5" : "border-border")}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button type="button" onClick={() => toggleProduct(product)} className="flex-shrink-0">
                      {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    <span className={cn("text-sm px-2.5 py-0.5 rounded-full flex-1", getProductColor(product))}>{product}</span>
                    {isSelected && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button type="button" onClick={() => setQty(product, -1)}
                          className="w-6 h-6 rounded-full bg-secondary border border-border flex items-center justify-center hover:bg-accent transition-colors">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-sm font-bold text-foreground">{item.qty}</span>
                        <button type="button" onClick={() => setQty(product, 1)}
                          className="w-6 h-6 rounded-full bg-secondary border border-border flex items-center justify-center hover:bg-accent transition-colors">
                          <Plus className="w-3 h-3" />
                        </button>
                        <span className="text-xs text-muted-foreground w-6">ta</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {items.length > 0 && (
              <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 text-xs text-primary">
                ✓ {getProductSummary()}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { resetForm(); onClose(); }} className="flex-1">Bekor</Button>
              <Button type="button" disabled={items.length === 0} onClick={() => setStep("price")} className="flex-1">
                Narx belgilash →
              </Button>
            </div>
          </div>
        ) : (
          // STEP 2: Set total price + order type
          <form onSubmit={handleSave} className="space-y-4">
            {/* Summary */}
            <div className="bg-secondary/50 border border-border rounded-xl px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Tanlangan mahsulotlar:</p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((i) => (
                  <span key={i.product} className={cn("text-xs px-2.5 py-1 rounded-full", getProductColor(i.product))}>
                    {i.product} × {i.qty}
                  </span>
                ))}
              </div>
            </div>

            {/* Total price */}
            <div className="space-y-1.5">
              <Label>Umumiy narx (so'm) *</Label>
              <Input
                type="number" placeholder="Masalan: 450000"
                value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)}
                required autoFocus className="text-lg font-semibold"
              />
              {totalPrice && (
                <p className="text-xs text-right text-primary font-semibold">
                  {new Intl.NumberFormat("uz-UZ").format(parseFloat(totalPrice))} so'm
                </p>
              )}
            </div>

            {/* Order type */}
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
              <Button type="button" variant="outline" onClick={() => setStep("products")} className="flex-1">← Orqaga</Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Saqlash"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
