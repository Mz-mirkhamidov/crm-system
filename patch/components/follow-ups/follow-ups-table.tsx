"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { OWNER_ID } from "@/lib/auth";
import { Button } from "@/components/ui/button";
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
import { Trash2, Loader2, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { cn, formatDate, isTodayDate, isOverdue } from "@/lib/utils";
import type { FollowUp } from "@/types";

export function FollowUpsTable() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");

  const supabase = createClient();

  useEffect(() => { loadFollowUps(); }, []);

  async function loadFollowUps() {
    try {
      const user = { id: OWNER_ID };
    const { data } = await supabase
        .from("follow_ups").select("*").eq("user_id", user.id).order("scheduled_at", { ascending: true });
      setFollowUps((data as FollowUp[]) || []);
    } catch (e) {
      console.error("loadFollowUps error:", e);
    } finally {
      setLoading(false);
    }
  }

  async function markDone(id: string) {
    await supabase.from("follow_ups").update({ status: "Bajarildi" }).eq("id", id);
    setFollowUps((prev) => prev.map((f) => f.id === id ? { ...f, status: "Bajarildi" } : f));
  }

  async function deleteFollowUp(id: string) {
    await supabase.from("follow_ups").delete().eq("id", id);
    setFollowUps((prev) => prev.filter((f) => f.id !== id));
  }

  const filtered = filterStatus === "all"
    ? followUps
    : followUps.filter((f) => f.status === filterStatus);

  const todayCount = followUps.filter((f) => f.status === "Kutilmoqda" && isTodayDate(f.scheduled_at)).length;
  const overdueCount = followUps.filter((f) => f.status === "Kutilmoqda" && isOverdue(f.scheduled_at) && !isTodayDate(f.scheduled_at)).length;

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {todayCount > 0 && (
          <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5 text-sm text-red-400">
            <Clock className="w-3.5 h-3.5" />
            Bugun: {todayCount} ta
          </div>
        )}
        {overdueCount > 0 && (
          <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-1.5 text-sm text-orange-400">
            <AlertCircle className="w-3.5 h-3.5" />
            Kechikkan: {overdueCount} ta
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Holat" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha holatlar</SelectItem>
            <SelectItem value="Kutilmoqda">Kutilmoqda</SelectItem>
            <SelectItem value="Bajarildi">Bajarildi</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Yuklanmoqda...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Follow-uplar topilmadi</div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Ism</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Telefon</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Sana</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Izoh</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Holat</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((fu) => {
                const today = isTodayDate(fu.scheduled_at);
                const overdue = fu.status === "Kutilmoqda" && isOverdue(fu.scheduled_at) && !today;
                return (
                  <tr
                    key={fu.id}
                    className={cn(
                      "border-b border-border hover:bg-secondary/30 transition-colors",
                      today && fu.status === "Kutilmoqda" && "bg-red-500/5",
                      overdue && "bg-orange-500/5"
                    )}
                  >
                    <td className="px-4 py-3 font-medium">{fu.source_name}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{fu.source_phone}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "text-xs font-mono",
                        today && fu.status === "Kutilmoqda" ? "text-red-400 font-semibold" :
                        overdue ? "text-orange-400" : "text-muted-foreground"
                      )}>
                        {formatDate(fu.scheduled_at)}
                        {today && fu.status === "Kutilmoqda" && " 🔴"}
                        {overdue && " ⚠️"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell max-w-xs truncate">
                      {fu.note}
                    </td>
                    <td className="px-4 py-3">
                      {fu.status === "Bajarildi" ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Bajarildi
                        </span>
                      ) : (
                        <span className="text-xs text-yellow-400">Kutilmoqda</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {fu.status === "Kutilmoqda" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-emerald-400 hover:bg-emerald-500/10 px-2"
                            onClick={() => markDone(fu.id)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Bajarildi
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:bg-red-500/10">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Follow-upni o'chirish</AlertDialogTitle>
                              <AlertDialogDescription>{fu.source_name} uchun follow-upni o'chirmoqchimisiz?</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Bekor</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteFollowUp(fu.id)}>O'chirish</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
