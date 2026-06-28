"use client";

import { useState } from "react";
import { useFollowUps } from "@/lib/data/use-follow-ups";
import { FollowUpModal } from "@/components/shared/follow-up-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AsyncContent } from "@/components/shared/async-content";
import { Loader2, CheckCircle2, Clock, AlertCircle, Bell, Phone, Search, CalendarClock } from "lucide-react";
import { cn, formatDate, isTodayDate, isOverdue, formatPhoneForCall } from "@/lib/utils";
import type { FollowUp } from "@/types";

interface NextTask { sourceId: string; sourceName: string; sourcePhone: string; sourceType: "lead" | "client"; }

export function FollowUpsTable() {
  const { data: followUps, loading, error, refetch, markDone } = useFollowUps();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [nextTask, setNextTask] = useState<NextTask | null>(null);

  async function handleMarkDone(fu: FollowUp) {
    setBusyId(fu.id);
    await markDone(fu.id);
    setBusyId(null);
    // amoCRM behavior: after completing a task, offer to schedule the next one.
    setNextTask({
      sourceId: fu.source_id,
      sourceName: fu.source_name,
      sourcePhone: fu.source_phone,
      sourceType: fu.source_type as "lead" | "client",
    });
  }

  const q = search.trim().toLowerCase();
  const match = (f: FollowUp) => !q || f.source_name?.toLowerCase().includes(q) || f.source_phone?.includes(q);

  const pending = followUps.filter((f) => f.status === "Kutilmoqda" && match(f));
  const overdue = pending.filter((f) => isOverdue(f.scheduled_at) && !isTodayDate(f.scheduled_at))
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const today = pending.filter((f) => isTodayDate(f.scheduled_at))
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const future = pending.filter((f) => !isOverdue(f.scheduled_at) && !isTodayDate(f.scheduled_at))
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const done = followUps.filter((f) => f.status === "Bajarildi" && match(f))
    .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));

  function TaskCard({ fu, tone }: { fu: FollowUp; tone: "overdue" | "today" | "future" | "done" }) {
    const isBusy = busyId === fu.id;
    const border =
      tone === "overdue" ? "border-orange-500/30 bg-orange-500/5" :
      tone === "today" ? "border-red-500/30 bg-red-500/5" :
      tone === "done" ? "border-border bg-secondary/30 opacity-70" :
      "border-border bg-card";
    return (
      <div className={cn("rounded-xl border p-3.5 flex items-center gap-3", border)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{fu.source_name}</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
              {fu.source_type === "lead" ? "Lid" : "Mijoz"}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs">
            <span className={cn("font-mono",
              tone === "today" ? "text-red-400 font-semibold" :
              tone === "overdue" ? "text-orange-400" : "text-muted-foreground")}>
              <CalendarClock className="w-3 h-3 inline mr-1" />{formatDate(fu.scheduled_at)}
            </span>
            <a href={`tel:${formatPhoneForCall(fu.source_phone)}`} className="text-muted-foreground hover:text-primary font-mono inline-flex items-center gap-1">
              <Phone className="w-3 h-3" />{fu.source_phone}
            </a>
          </div>
          {fu.note && <p className="text-xs text-foreground mt-1.5">{fu.note}</p>}
        </div>
        {fu.status === "Kutilmoqda" ? (
          <Button size="sm" variant="outline" disabled={isBusy}
            className="h-8 text-xs gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 flex-shrink-0"
            onClick={() => handleMarkDone(fu)}>
            {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Bajarildi
          </Button>
        ) : (
          <span className="flex items-center gap-1 text-xs text-emerald-400 flex-shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" /> Bajarildi
          </span>
        )}
      </div>
    );
  }

  function Section({ title, icon: Icon, color, tasks, tone }: {
    title: string; icon: typeof Clock; color: string; tasks: FollowUp[]; tone: "overdue" | "today" | "future" | "done";
  }) {
    if (tasks.length === 0) return null;
    return (
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <Icon className={cn("w-4 h-4", color)} />
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <span className={cn("text-xs rounded-full px-2 py-0.5 border", color, "bg-secondary border-border")}>{tasks.length}</span>
        </div>
        <div className="space-y-2">
          {tasks.map((fu) => <TaskCard key={fu.id} fu={fu} tone={tone} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
          <p className="text-xs text-muted-foreground">Kechikkan</p>
          <p className="text-2xl font-bold text-orange-400">{overdue.length}</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
          <p className="text-xs text-muted-foreground">Bugun</p>
          <p className="text-2xl font-bold text-red-400">{today.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Kelajak</p>
          <p className="text-2xl font-bold text-foreground">{future.length}</p>
        </div>
      </div>

      {/* Search + toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Ism yoki telefon..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button size="sm" variant={showDone ? "default" : "outline"} onClick={() => setShowDone((s) => !s)} className="gap-1.5 text-xs">
          <CheckCircle2 className="w-3.5 h-3.5" /> Bajarilganlar ({done.length})
        </Button>
      </div>

      <AsyncContent loading={loading} error={error} data={followUps} onRetry={refetch}
        empty={{ icon: Bell, title: "Vazifalar yo'q" }}>
        {() => (
          <div className="space-y-6">
            {overdue.length + today.length + future.length === 0 && !showDone && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400/60" />
                Barcha vazifalar bajarilgan 🎉
              </div>
            )}
            <Section title="Kechikkan" icon={AlertCircle} color="text-orange-400" tasks={overdue} tone="overdue" />
            <Section title="Bugun" icon={Clock} color="text-red-400" tasks={today} tone="today" />
            <Section title="Kelajak" icon={CalendarClock} color="text-blue-400" tasks={future} tone="future" />
            {showDone && <Section title="Bajarilgan" icon={CheckCircle2} color="text-emerald-400" tasks={done} tone="done" />}
          </div>
        )}
      </AsyncContent>

      {/* Next-task prompt after completing a task */}
      {nextTask && (
        <FollowUpModal
          open={!!nextTask}
          onClose={() => setNextTask(null)}
          sourceId={nextTask.sourceId}
          sourceName={nextTask.sourceName}
          sourcePhone={nextTask.sourcePhone}
          sourceType={nextTask.sourceType}
          onSuccess={() => { setNextTask(null); refetch(); }}
        />
      )}
    </div>
  );
}
