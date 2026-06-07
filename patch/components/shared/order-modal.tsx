"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { OWNER_ID } from "@/lib/auth";
import { PRODUCTS, type SourceType, type ProductType, type OrderType } from "@/types";
import { Loader2 } from "lucide-react";

interface OrderModalProps {
  open: boolean;
  onClose: () => void;
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;
  onSuccess: () => void;
}

export function OrderModal({
  open,
  onClose,
  sourceId,
  sourceName,
  sourceType,
  onSuccess,
}: OrderModalProps) {
  const [product, setProduct] = useState<ProductType>("AJR Sedan");
  const [price, setPrice] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("Hozirgi");
  const [scheduledAt, setScheduledAt] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!price) return;
    setLoading(true);

    const user = { id: OWNER_ID };

    const payload: any = {
      user_id: user.id,
      source_type: sourceType,
      source_id: sourceId,
      source_name: sourceName,
      product,
      price: parseFloat(price),
      order_type: orderType,
      comment: comment || null,
      scheduled_at: orderType === "Keyinroqi" && scheduledAt ? scheduledAt : null,
    };

    await supabase.from("orders").insert(payload);

    // Update lead status if from lead
    if (sourceType === "lead") {
      await supabase
        .from("leads")
        .update({ status: "Buyurtma berilgan" })
        .eq("id", sourceId);
    }

    setLoading(false);
    resetForm();
    onSuccess();
    onClose();
  }

  function resetForm() {
    setProduct("AJR Sedan");
    setPrice("");
    setOrderType("Hozirgi");
    setScheduledAt("");
    setComment("");
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yangi zakaz — {sourceName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Mahsulot</Label>
            <Select value={product} onValueChange={(v) => setProduct(v as ProductType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCTS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Narx (so'm)</Label>
            <Input
              type="number"
              placeholder="150000"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Zakaz turi</Label>
            <Select value={orderType} onValueChange={(v) => setOrderType(v as OrderType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Hozirgi">Hozirgi</SelectItem>
                <SelectItem value="Keyinroqi">Keyinroqi</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {orderType === "Keyinroqi" && (
            <div className="space-y-1.5">
              <Label>Rejalashtirilgan sana va soat</Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required={orderType === "Keyinroqi"}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Kommentariya (ixtiyoriy)</Label>
            <Input
              placeholder="Qo'shimcha ma'lumot..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Bekor
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Saqlash"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
