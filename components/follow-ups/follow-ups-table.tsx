"use client";

import { useState } from "react";
import { useFollowUps } from "@/lib/data/use-follow-ups";
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
import { AsyncContent } from "@/components/shared/async-content";
import { Trash2, Loader2, CheckCircle2, Clock, AlertCircle, Bell } from "lucide-react";
import { cn, formatDate, isTodayDate, isOverdue } from "@/lib/utils";

export function FollowUpsTable() {
  const { data: followUps, loading, error, refetch, remove, markDone } = useFollowUps();

  const [filterStatus, setFilterStatus] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleMarkDone(id: string) {
    setBusyId(id);
    await markDone(id);
    setBusyId(null);
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    await remove(id);
    setBusyId(null);
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

      <AsyncContent
        loading={loading}
        error={error}
        data={filtered}
        onRetry={refetch}
        empty={{ icon: Bell, title: "Follow-uplar topilmadi" }}
      >
        {(rows) => (
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
                {rows.map((fu) => {
                  const today = isTodayDate(fu.scheduled_at);
                  const overdue = fu.status === "Kutilmoqda" && isOverdue(fu.scheduled_at) && !today;
                  const isBusy = busyId === fu.id;
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
                              disabled={isBusy}
                              onClick={() => handleMarkDone(fu.id)}
                            >
                              {isBusy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />} Bajarildi
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:bg-red-500/10" disabled={isBusy}>
                                {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Follow-upni o'chirish</AlertDialogTitle>
                                <AlertDialogDescription>{fu.source_name} uchun follow-upni o'chirmoqchimisiz?</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Bekor</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(fu.id)}>O'chirish</AlertDialogAction>
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
      </AsyncContent>
    </div>
  );
}
