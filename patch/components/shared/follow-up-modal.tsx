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
import { createClient } from "@/lib/supabase/client";
import { OWNER_ID } from "@/lib/auth";
import type { SourceType } from "@/types";
import { Loader2 } from "lucide-react";

interface FollowUpModalProps {
  open: boolean;
  onClose: () => void;
  sourceId: string;
  sourceName: string;
  sourcePhone: string;
  sourceType: SourceType;
  onSuccess: () => void;
}

export function FollowUpModal({
  open,
  onClose,
  sourceId,
  sourceName,
  sourcePhone,
  sourceType,
  onSuccess,
}: FollowUpModalProps) {
  const [scheduledAt, setScheduledAt] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduledAt) return;
    setLoading(true);

    const user = { id: OWNER_ID };

    await supabase.from("follow_ups").insert({
      user_id: user.id,
      source_type: sourceType,
      source_id: sourceId,
      source_name: sourceName,
      source_phone: sourcePhone,
      scheduled_at: scheduledAt,
      note: note || null,
      status: "Kutilmoqda",
    });

    setLoading(false);
    setScheduledAt("");
    setNote("");
    onSuccess();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Follow-up belgilash — {sourceName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Qachon bog'lanish kerak</Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Izoh (nima haqida)</Label>
            <Input
              placeholder="Masalan: narx haqida gaplashish..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
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
