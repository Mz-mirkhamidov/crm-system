"use client";

import { useState, Fragment } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useOperator } from "@/lib/useOperator";
import { useLeads } from "@/lib/data/use-leads";
import { useClients } from "@/lib/data/use-clients";
import { insertLead, updateLead, type DuplicateMatch } from "@/lib/data/repository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OrderModal } from "@/components/shared/order-modal";
import { FollowUpModal } from "@/components/shared/follow-up-modal";
import { PersonDetailModal } from "@/components/shared/detail-modal";
import { AsyncContent } from "@/components/shared/async-content";
import { Plus, Search, Pencil, ShoppingCart, Bell, Loader2, ChevronDown, ChevronUp, Phone, MapPin, MessageSquare, Package, Clock, AlertCircle, Users, UserCheck, List, LayoutGrid } from "lucide-react";
import { cn, formatPrice, getStatusColor, getProductColor, formatPhoneForCall, applyFilters, getInitials, getLeadAge } from "@/lib/utils";
import { LocationSelect } from "@/components/shared/location-select";
import type { Lead, LeadStatus, Order } from "@/types";
import { LEAD_STATUSES, DEFAULT_TAGS } from "@/types";

const avatarColors = [
  "bg-violet-500/20 text-violet-400", "bg-blue-500/20 text-blue-400",
  "bg-emerald-500/20 text-emerald-400", "bg-orange-500/20 text-orange-400",
  "bg-pink-500/20 text-pink-400",
];

export function LeadsTable() {
  const { data: leads, loading, error, refetch, loadLeadOrders, checkDuplicate, orderCounts } = useLeads();
  const { convert, refetch: refetchClients } = useClients();
  const operator = useOperator();
  const operatorId = operator?.id || "";
  const toast = useToast();

  const [view, setView] = useState<"table" | "board">("table");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [filterAge, setFilterAge] = useState("all");
  const [tags, setTags] = useState<string[]>(DEFAULT_TAGS);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [leadOrders, setLeadOrders] = useState<Record<string, Order[]>>({});
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [orderLead, setOrderLead] = useState<Lead | null>(null);
  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);

  const filtered = applyFilters(leads, { search, status: view === "board" ? "all" : filterStatus, tag: filterTag, age: filterAge });

  async function loadOrdersFor(leadId: string) {
    if (leadOrders[leadId]) return;
    const orders = await loadLeadOrders(leadId);
    setLeadOrders((prev) => ({ ...prev, [leadId]: orders }));
  }

  async function handleConvert(lead: Lead) {
    setConvertingId(lead.id);
    const client = await convert(lead);
    setConvertingId(null);
    if (client) { refetch(); refetchClients(); }
  }

  // One-click status change (used by the inline select and the Kanban drag-drop).
  async function changeStatus(lead: Lead, newStatus: LeadStatus) {
    if (lead.status === newStatus) return;
    setSavingStatusId(lead.id);
    const res = await updateLead(lead.id, { status: newStatus });
    setSavingStatusId(null);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(`Holat: ${newStatus}`);
    refetch();
  }

  function isConverted(lead: Lead) {
    return !!lead.converted_client_id || lead.status === "Mijozga aylandi";
  }

  function toggleExpand(id: string) {
    if (expandedId === id) setExpandedId(null);
    else { setExpandedId(id); loadOrdersFor(id); }
  }

  const coldCounts = {
    "3": leads.filter((l) => { const d = Math.floor((Date.now() - new Date(l.created_at).getTime()) / 86400000); return d >= 3 && l.status !== "Buyurtma berilgan" && l.status !== "Rad etildi"; }).length,
    "7": leads.filter((l) => { const d = Math.floor((Date.now() - new Date(l.created_at).getTime()) / 86400000); return d >= 7 && l.status !== "Buyurtma berilgan" && l.status !== "Rad etildi"; }).length,
    "14": leads.filter((l) => { const d = Math.floor((Date.now() - new Date(l.created_at).getTime()) / 86400000); return d >= 14 && l.status !== "Buyurtma berilgan" && l.status !== "Rad etildi"; }).length,
  };

  return (
    <div className="space-y-4">
      {coldCounts["7"] > 0 && filterAge === "all" && (
        <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-lg px-4 py-2.5 text-sm">
          <Clock className="w-4 h-4 text-orange-400 flex-shrink-0" />
          <span className="text-orange-300">
            <span className="font-bold">{coldCounts["7"]} ta lid</span> 7+ kun bog'lanilmagan — sovib qolishi mumkin
          </span>
          <Button size="sm" variant="ghost" className="ml-auto text-xs h-7 text-orange-400 hover:bg-orange-500/10 px-2"
            onClick={() => setFilterAge("7")}>Ko'rsatish</Button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* View toggle */}
        <div className="flex bg-secondary/50 rounded-lg p-0.5">
          <button onClick={() => setView("table")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              view === "table" ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground")}>
            <List className="w-3.5 h-3.5" /> Jadval
          </button>
          <button onClick={() => setView("board")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              view === "board" ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground")}>
            <LayoutGrid className="w-3.5 h-3.5" /> Doska
          </button>
        </div>

        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Ism yoki telefon..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <Select value={filterTag} onValueChange={setFilterTag}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Teg" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha teglar</SelectItem>
            {tags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterAge} onValueChange={setFilterAge}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Faollik" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barchasi</SelectItem>
            <SelectItem value="3">❄️ 3+ kun ({coldCounts["3"]})</SelectItem>
            <SelectItem value="7">🥶 7+ kun ({coldCounts["7"]})</SelectItem>
            <SelectItem value="14">💀 14+ kun ({coldCounts["14"]})</SelectItem>
          </SelectContent>
        </Select>

        {/* Status filter only shown in table view */}
        {view === "table" && (
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Holat" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha holatlar</SelectItem>
              {LEAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Button onClick={() => setAddOpen(true)} size="sm"><Plus className="w-4 h-4" /> Yangi lid</Button>
      </div>

      {/* Content */}
      <AsyncContent loading={loading} error={error} data={filtered} onRetry={refetch}
        empty={{ icon: Users, title: "Lidlar topilmadi" }}>
        {(rows) => view === "board" ? (
          /* ---- KANBAN BOARD ---- */
          <div className="flex gap-3 overflow-x-auto pb-2">
            {LEAD_STATUSES.map((col) => {
              const colLeads = rows.filter((l) => l.status === col);
              return (
                <div key={col}
                  onDragOver={(e) => { e.preventDefault(); setDragOverCol(col); }}
                  onDragLeave={() => setDragOverCol((c) => (c === col ? null : c))}
                  onDrop={() => {
                    const lead = rows.find((l) => l.id === dragId);
                    if (lead) changeStatus(lead, col);
                    setDragId(null); setDragOverCol(null);
                  }}
                  className={cn("flex-shrink-0 w-72 rounded-xl border bg-secondary/20 transition-colors",
                    dragOverCol === col ? "border-primary/50 bg-primary/5" : "border-border")}>
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-border sticky top-0">
                    <span className={cn("text-xs px-2.5 py-1 rounded-full border font-medium", getStatusColor(col))}>{col}</span>
                    <span className="text-xs text-muted-foreground font-semibold">{colLeads.length}</span>
                  </div>
                  <div className="p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-260px)] overflow-y-auto">
                    {colLeads.map((lead, idx) => {
                      const age = getLeadAge(lead.created_at);
                      return (
                        <div key={lead.id} draggable
                          onDragStart={() => setDragId(lead.id)}
                          onDragEnd={() => { setDragId(null); setDragOverCol(null); }}
                          onClick={() => setDetailLead(lead)}
                          className={cn("rounded-lg border border-border bg-card p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 transition-all",
                            dragId === lead.id ? "opacity-50" : "")}>
                          <div className="flex items-center gap-2">
                            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0", avatarColors[idx % avatarColors.length])}>
                              {getInitials(lead.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-foreground truncate leading-tight">{lead.name}</p>
                              <p className="text-xs text-muted-foreground font-mono truncate">{lead.phone}</p>
                            </div>
                            {savingStatusId === lead.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
                          </div>
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {lead.tag && <span className="text-[10px] bg-secondary border border-border rounded-full px-2 py-0.5">{lead.tag}</span>}
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-mono font-semibold", age.color)}>{age.label}</span>
                            {orderCounts[lead.id] > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full px-1.5 py-0.5">
                                <Package className="w-2.5 h-2.5" />{orderCounts[lead.id]}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-emerald-400 hover:bg-emerald-500/10 flex-1" onClick={() => setOrderLead(lead)}>
                              <ShoppingCart className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-blue-400 hover:bg-blue-500/10 flex-1" onClick={() => setFollowUpLead(lead)}>
                              <Bell className="w-3 h-3" />
                            </Button>
                            <a href={`tel:${formatPhoneForCall(lead.phone)}`} className="flex-1">
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-foreground hover:bg-secondary w-full">
                                <Phone className="w-3 h-3" />
                              </Button>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                    {colLeads.length === 0 && (
                      <p className="text-center text-xs text-muted-foreground py-6">Bo'sh</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ---- TABLE ---- */
          <div className="rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Mijoz</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Teg</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Holat</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">Yoshi</th>
                  <th className="px-4 py-3 text-right text-muted-foreground font-medium">Harakatlar</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((lead, idx) => {
                  const age = getLeadAge(lead.created_at);
                  const converted = isConverted(lead);
                  const isConverting = convertingId === lead.id;
                  return (
                    <Fragment key={lead.id}>
                      <tr className="border-b border-border hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => setDetailLead(lead)}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0", avatarColors[idx % avatarColors.length])}>
                              {getInitials(lead.name)}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground leading-tight">{lead.name}</p>
                              <a href={`tel:${formatPhoneForCall(lead.phone)}`} onClick={(e) => e.stopPropagation()}
                                className="text-xs text-muted-foreground hover:text-primary font-mono flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3" />{lead.phone}
                              </a>
                            </div>
                            {orderCounts[lead.id] > 0 && (
                              <span className="flex items-center gap-1 text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full px-2 py-0.5">
                                <Package className="w-3 h-3" />{orderCounts[lead.id]}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 hidden md:table-cell">
                          {lead.tag && <span className="text-xs bg-secondary border border-border rounded-full px-2.5 py-1">{lead.tag}</span>}
                        </td>

                        {/* Inline status change */}
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          {converted ? (
                            <span className={cn("text-xs px-2.5 py-1 rounded-full border font-medium", getStatusColor(lead.status))}>{lead.status}</span>
                          ) : (
                            <Select value={lead.status} onValueChange={(v) => changeStatus(lead, v as LeadStatus)}>
                              <SelectTrigger className="h-auto w-auto gap-1 border-0 bg-transparent p-0 shadow-none focus:ring-0 hover:opacity-80">
                                <span className={cn("text-xs px-2.5 py-1 rounded-full border font-medium flex items-center gap-1", getStatusColor(lead.status))}>
                                  {savingStatusId === lead.id && <Loader2 className="w-3 h-3 animate-spin" />}
                                  {lead.status}
                                </span>
                              </SelectTrigger>
                              <SelectContent>
                                {LEAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </td>

                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full border font-mono font-semibold", age.color)}>{age.label}</span>
                        </td>

                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end">
                            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-emerald-400 hover:bg-emerald-500/10 gap-1" onClick={() => setOrderLead(lead)}>
                              <ShoppingCart className="w-3.5 h-3.5" /><span className="hidden xl:inline">Zakaz</span>
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-blue-400 hover:bg-blue-500/10 gap-1" onClick={() => setFollowUpLead(lead)}>
                              <Bell className="w-3.5 h-3.5" /><span className="hidden xl:inline">Eslatma</span>
                            </Button>
                            <Button size="sm" variant="ghost" disabled={converted || isConverting}
                              className="h-8 px-2 text-xs text-purple-400 hover:bg-purple-500/10 gap-1" title="Mijozga aylantirish"
                              onClick={() => handleConvert(lead)}>
                              {isConverting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                              <span className="hidden xl:inline">Mijoz</span>
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditLead(lead)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <button className="p-1 text-muted-foreground ml-1" onClick={() => toggleExpand(lead.id)}>
                              {expandedId === lead.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {expandedId === lead.id && (
                        <tr className="bg-secondary/10 border-b border-border">
                          <td colSpan={5} className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ma'lumotlar</p>
                                {lead.address && (
                                  <div className="flex items-start gap-2 text-xs text-foreground">
                                    <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />{lead.address}
                                  </div>
                                )}
                                {lead.comment && (
                                  <div className="flex items-start gap-2 text-xs text-foreground">
                                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                    <span className="whitespace-pre-wrap">{lead.comment}</span>
                                  </div>
                                )}
                                {!lead.address && !lead.comment && <p className="text-xs text-muted-foreground">Qo'shimcha ma'lumot yo'q</p>}
                              </div>
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tez harakatlar</p>
                                <div className="flex flex-col gap-2">
                                  <Button size="sm" variant="outline" className="justify-start gap-2 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                                    onClick={() => { setExpandedId(null); setOrderLead(lead); }}>
                                    <ShoppingCart className="w-3.5 h-3.5" /> Zakaz qo'shish
                                  </Button>
                                  <Button size="sm" variant="outline" className="justify-start gap-2 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                    onClick={() => { setExpandedId(null); setFollowUpLead(lead); }}>
                                    <Bell className="w-3.5 h-3.5" /> Eslatma belgilash
                                  </Button>
                                  <a href={`tel:${formatPhoneForCall(lead.phone)}`}>
                                    <Button size="sm" variant="outline" className="justify-start gap-2 text-xs w-full border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                                      <Phone className="w-3.5 h-3.5" /> Qo'ng'iroq qilish
                                    </Button>
                                  </a>
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Zakaz tarixi</p>
                                {leadOrders[lead.id] === undefined ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                ) : leadOrders[lead.id].length === 0 ? (
                                  <p className="text-xs text-muted-foreground">Zakazlar yo'q</p>
                                ) : (
                                  <div className="space-y-2">
                                    {leadOrders[lead.id].map((o) => (
                                      <div key={o.id} className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
                                        <span className={cn("text-xs px-2 py-0.5 rounded-full", getProductColor(o.product))}>{o.product}</span>
                                        <span className="text-xs font-semibold text-foreground ml-auto">{formatPrice(o.price)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AsyncContent>

      {/* Modals */}
      <LeadFormModal open={addOpen} onClose={() => setAddOpen(false)} onSuccess={refetch} tags={tags} onAddTag={(t) => setTags((p) => p.includes(t) ? p : [...p, t])} operatorId={operatorId} checkDuplicate={checkDuplicate} />
      {editLead && <LeadFormModal open={!!editLead} onClose={() => setEditLead(null)} onSuccess={refetch} tags={tags} onAddTag={(t) => setTags((p) => p.includes(t) ? p : [...p, t])} lead={editLead} operatorId={operatorId} checkDuplicate={checkDuplicate} />}
      {orderLead && <OrderModal open={!!orderLead} onClose={() => setOrderLead(null)} sourceId={orderLead.id} sourceName={orderLead.name} sourceType="lead" onSuccess={refetch} />}
      {followUpLead && <FollowUpModal open={!!followUpLead} onClose={() => setFollowUpLead(null)} sourceId={followUpLead.id} sourceName={followUpLead.name} sourcePhone={followUpLead.phone} sourceType="lead" onSuccess={() => {}} />}
      <PersonDetailModal open={!!detailLead} onClose={() => setDetailLead(null)} person={detailLead} sourceType="lead" onRefresh={refetch} />
    </div>
  );
}

// ---- Lead Form Modal ----
interface LeadFormModalProps {
  open: boolean; onClose: () => void; onSuccess: () => void;
  tags: string[]; onAddTag: (tag: string) => void; lead?: Lead; operatorId: string;
  checkDuplicate: (phone: string, excludeId?: string) => Promise<DuplicateMatch | null>;
}

function LeadFormModal({ open, onClose, onSuccess, tags, lead, operatorId, checkDuplicate }: LeadFormModalProps) {
  const [name, setName] = useState(lead?.name || "");
  const [phone, setPhone] = useState(lead?.phone || "");
  const [address, setAddress] = useState(lead?.address || "");
  const [tag, setTag] = useState(lead?.tag || "none");
  const [status, setStatus] = useState<LeadStatus>(lead?.status || "Yangi");
  const [comment, setComment] = useState(lead?.comment || "");
  const [saving, setSaving] = useState(false);
  const [duplicate, setDuplicate] = useState<{ name: string; type: string } | null>(null);
  const toast = useToast();

  async function runDuplicateCheck(p: string) {
    if (p.length < 9) { setDuplicate(null); return; }
    const match = await checkDuplicate(p, lead?.id);
    setDuplicate(match);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = { name, phone, address: address || null, tag: tag === "none" ? null : tag || null, status, comment: comment || null };
    const result = lead ? await updateLead(lead.id, payload) : await insertLead(operatorId, payload);
    setSaving(false);
    if (!result.ok) { toast.error(result.error); return; }
    toast.success(lead ? "Lid yangilandi" : "Lid qo'shildi");
    onSuccess();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{lead ? "Lidni tahrirlash" : "Yangi lid qo'shish"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ism *</Label>
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="To'liq ism" required />
            </div>
            <div className="space-y-1.5">
              <Label>Telefon *</Label>
              <Input value={phone} onChange={(e) => { setPhone(e.target.value); runDuplicateCheck(e.target.value); }} placeholder="+998901234567" required />
              {duplicate && (
                <div className="flex items-center gap-1.5 text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-md px-2 py-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  Bu raqam bazada bor: <span className="font-bold">{duplicate.name}</span> ({duplicate.type})
                </div>
              )}
            </div>
          </div>
          <LocationSelect value={address} onChange={setAddress} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Teg</Label>
              <Select value={tag} onValueChange={setTag}>
                <SelectTrigger><SelectValue placeholder="Tanlash" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {tags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Holat</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as LeadStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Kommentariya</Label>
            <textarea
              className="flex w-full rounded-md border border-input bg-input px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none min-h-[80px]"
              placeholder="Erkin yozuv..." value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Bekor</Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : lead ? "Yangilash" : "Qo'shish"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
