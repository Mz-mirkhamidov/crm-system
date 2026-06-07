"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOperator } from "@/lib/useOperator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { OrderModal } from "@/components/shared/order-modal";
import { FollowUpModal } from "@/components/shared/follow-up-modal";
import { PersonDetailModal } from "@/components/shared/detail-modal";
import { Plus, Search, Pencil, Trash2, ShoppingCart, Bell, Loader2, ChevronDown, ChevronUp, Phone, MapPin, MessageSquare, Package, Clock, AlertCircle } from "lucide-react";
import { cn, formatDate, formatPrice, getStatusColor, getProductColor, formatPhoneForCall } from "@/lib/utils";
import { LocationSelect } from "@/components/shared/location-select";
import type { Lead, LeadStatus } from "@/types";
import { LEAD_STATUSES, DEFAULT_TAGS } from "@/types";

// Lid yoshi hisoblash
function getLeadAge(createdAt: string) {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  if (days === 0) return { days, label: "Bugun", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
  if (days === 1) return { days, label: "Kecha", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
  if (days <= 4) return { days, label: `${days}k`, color: "text-blue-400 bg-blue-500/10 border-blue-500/30" };
  if (days <= 9) return { days, label: `${days}k`, color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" };
  return { days, label: `${days}k`, color: "text-red-400 bg-red-500/10 border-red-500/30" };
}

export function LeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filtered, setFiltered] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [filterAge, setFilterAge] = useState("all"); // sovib qolgan filter
  const [tags, setTags] = useState<string[]>(DEFAULT_TAGS);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [leadOrders, setLeadOrders] = useState<Record<string, any[]>>({});
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({});
  const [detailLead, setDetailLead] = useState<Lead | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [orderLead, setOrderLead] = useState<Lead | null>(null);
  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);

  const operator = useOperator();
  const operatorId = operator?.id || "";
  const supabase = createClient();

  useEffect(() => { if (operatorId) loadLeads(); }, [operatorId]);

  useEffect(() => {
    let f = leads;
    if (search) {
      const q = search.toLowerCase();
      f = f.filter((l) => l.name.toLowerCase().includes(q) || l.phone.toLowerCase().includes(q));
    }
    if (filterStatus !== "all") f = f.filter((l) => l.status === filterStatus);
    if (filterTag !== "all") f = f.filter((l) => l.tag === filterTag);
    // Sovib qolgan filter
    if (filterAge !== "all") {
      const days = parseInt(filterAge);
      f = f.filter((l) => {
        const age = Math.floor((Date.now() - new Date(l.created_at).getTime()) / 86400000);
        const notClosed = l.status !== "Buyurtma berilgan" && l.status !== "Rad etildi";
        return age >= days && notClosed;
      });
    }
    setFiltered(f);
  }, [search, filterStatus, filterTag, filterAge, leads]);

  async function loadLeads() {
    try {
      if (!operatorId) return;
      const { data } = await supabase.from("leads").select("*").eq("user_id", operatorId).order("created_at", { ascending: false });
      const list = (data as Lead[]) || [];
      setLeads(list);
      if (list.length > 0) {
        const { data: orders } = await supabase.from("orders").select("source_id").eq("user_id", operatorId).eq("source_type", "lead");
        const counts: Record<string, number> = {};
        orders?.forEach((o) => { counts[o.source_id] = (counts[o.source_id] || 0) + 1; });
        setOrderCounts(counts);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function loadLeadOrders(leadId: string) {
    if (leadOrders[leadId]) return;
    const { data } = await supabase.from("orders").select("*").eq("source_id", leadId).eq("source_type", "lead").order("created_at", { ascending: false });
    setLeadOrders((prev) => ({ ...prev, [leadId]: data || [] }));
  }

  async function deleteLead(id: string) {
    await supabase.from("leads").delete().eq("id", id);
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }

  function toggleExpand(id: string) {
    if (expandedId === id) setExpandedId(null);
    else { setExpandedId(id); loadLeadOrders(id); }
  }

  function getInitials(name: string) {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  }

  const avatarColors = [
    "bg-violet-500/20 text-violet-400", "bg-blue-500/20 text-blue-400",
    "bg-emerald-500/20 text-emerald-400", "bg-orange-500/20 text-orange-400",
    "bg-pink-500/20 text-pink-400",
  ];

  // Sovib qolgan count
  const coldCounts = {
    "3": leads.filter((l) => { const d = Math.floor((Date.now() - new Date(l.created_at).getTime()) / 86400000); return d >= 3 && l.status !== "Buyurtma berilgan" && l.status !== "Rad etildi"; }).length,
    "7": leads.filter((l) => { const d = Math.floor((Date.now() - new Date(l.created_at).getTime()) / 86400000); return d >= 7 && l.status !== "Buyurtma berilgan" && l.status !== "Rad etildi"; }).length,
    "14": leads.filter((l) => { const d = Math.floor((Date.now() - new Date(l.created_at).getTime()) / 86400000); return d >= 14 && l.status !== "Buyurtma berilgan" && l.status !== "Rad etildi"; }).length,
  };

  return (
    <div className="space-y-4">
      {/* Sovib qolgan alert */}
      {coldCounts["7"] > 0 && filterAge === "all" && (
        <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-lg px-4 py-2.5 text-sm">
          <Clock className="w-4 h-4 text-orange-400 flex-shrink-0" />
          <span className="text-orange-300">
            <span className="font-bold">{coldCounts["7"]} ta lid</span> 7+ kun bog'lanilmagan — sovib qolishi mumkin
          </span>
          <Button size="sm" variant="ghost" className="ml-auto text-xs h-7 text-orange-400 hover:bg-orange-500/10 px-2"
            onClick={() => setFilterAge("7")}>
            Ko'rsatish
          </Button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Ism yoki telefon..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Holat" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha holatlar</SelectItem>
            {LEAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterTag} onValueChange={setFilterTag}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Teg" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha teglar</SelectItem>
            {tags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Sovib qolgan filter */}
        <Select value={filterAge} onValueChange={setFilterAge}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Faollik" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barchasi</SelectItem>
            <SelectItem value="3">❄️ 3+ kun ({coldCounts["3"]})</SelectItem>
            <SelectItem value="7">🥶 7+ kun ({coldCounts["7"]})</SelectItem>
            <SelectItem value="14">💀 14+ kun ({coldCounts["14"]})</SelectItem>
          </SelectContent>
        </Select>


        <Button onClick={() => setAddOpen(true)} size="sm">
          <Plus className="w-4 h-4" /> Yangi lid
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Yuklanmoqda...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Lidlar topilmadi</div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
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
              {filtered.map((lead, idx) => {
                const age = getLeadAge(lead.created_at);
                return (
                  <>
                    <tr key={lead.id} className="border-b border-border hover:bg-secondary/30 transition-colors cursor-pointer"
                      onClick={() => setDetailLead(lead)}>

                      {/* Avatar + Info */}
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

                      <td className="px-4 py-3">
                        <span className={cn("text-xs px-2.5 py-1 rounded-full border font-medium", getStatusColor(lead.status))}>
                          {lead.status}
                        </span>
                      </td>

                      {/* Lid yoshi */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full border font-mono font-semibold", age.color)}>
                          {age.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          <Button size="sm" variant="ghost"
                            className="h-8 px-2 text-xs text-emerald-400 hover:bg-emerald-500/10 gap-1"
                            onClick={() => setOrderLead(lead)}>
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span className="hidden xl:inline">Zakaz</span>
                          </Button>
                          <Button size="sm" variant="ghost"
                            className="h-8 px-2 text-xs text-blue-400 hover:bg-blue-500/10 gap-1"
                            onClick={() => setFollowUpLead(lead)}>
                            <Bell className="w-3.5 h-3.5" />
                            <span className="hidden xl:inline">Eslatma</span>
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditLead(lead)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:bg-red-500/10">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Lidni o'chirish</AlertDialogTitle>
                                <AlertDialogDescription>{lead.name} ni o'chirmoqchimisiz?</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Bekor</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteLead(lead.id)}>O'chirish</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <button className="p-1 text-muted-foreground ml-1">
                            {expandedId === lead.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded */}
                    {expandedId === lead.id && (
                      <tr key={`${lead.id}-exp`} className="bg-secondary/10 border-b border-border">
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
                                  {leadOrders[lead.id].map((o: any) => (
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
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <LeadFormModal open={addOpen} onClose={() => setAddOpen(false)} onSuccess={loadLeads} tags={tags} onAddTag={(t) => setTags((p) => p.includes(t) ? p : [...p, t])} operatorId={operatorId} />
      {editLead && <LeadFormModal open={!!editLead} onClose={() => setEditLead(null)} onSuccess={loadLeads} tags={tags} onAddTag={(t) => setTags((p) => p.includes(t) ? p : [...p, t])} lead={editLead} operatorId={operatorId} />}
      {orderLead && <OrderModal open={!!orderLead} onClose={() => setOrderLead(null)} sourceId={orderLead.id} sourceName={orderLead.name} sourceType="lead" onSuccess={loadLeads} />}
      {followUpLead && <FollowUpModal open={!!followUpLead} onClose={() => setFollowUpLead(null)} sourceId={followUpLead.id} sourceName={followUpLead.name} sourcePhone={followUpLead.phone} sourceType="lead" onSuccess={() => {}} />}
      <PersonDetailModal
        open={!!detailLead}
        onClose={() => setDetailLead(null)}
        person={detailLead}
        sourceType="lead"
        onRefresh={loadLeads}
      />
    </div>
  );
}

// ---- Lead Form Modal ----
interface LeadFormModalProps {
  open: boolean; onClose: () => void; onSuccess: () => void;
  tags: string[]; onAddTag: (tag: string) => void; lead?: Lead; operatorId: string;
}

function LeadFormModal({ open, onClose, onSuccess, tags, onAddTag, lead, operatorId }: LeadFormModalProps) {
  const [name, setName] = useState(lead?.name || "");
  const [phone, setPhone] = useState(lead?.phone || "");
  const [address, setAddress] = useState(lead?.address || "");
  const [tag, setTag] = useState(lead?.tag || "none");
  const [status, setStatus] = useState<LeadStatus>(lead?.status || "Yangi");
  const [comment, setComment] = useState(lead?.comment || "");
  const [loading, setLoading] = useState(false);
  const [duplicate, setDuplicate] = useState<{ name: string; type: string } | null>(null);
  const supabase = createClient();

  // Dublikat tekshiruv
  async function checkDuplicate(p: string) {
    if (p.length < 9) { setDuplicate(null); return; }
    const { data: l } = await supabase.from("leads").select("name").eq("phone", p).eq("user_id", operatorId).neq("id", lead?.id || "00000000-0000-0000-0000-000000000000").limit(1);
    if (l && l.length > 0) { setDuplicate({ name: l[0].name, type: "lid" }); return; }
    const { data: c } = await supabase.from("clients").select("name").eq("phone", p).eq("user_id", operatorId).limit(1);
    if (c && c.length > 0) { setDuplicate({ name: c[0].name, type: "mijoz" }); return; }
    setDuplicate(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const payload = {
      user_id: operatorId, name, phone,
      address: address || null,
      tag: tag === "none" ? null : tag || null,
      status, comment: comment || null,
    };
    if (lead) {
      const { error } = await supabase.from("leads").update(payload).eq("id", lead.id);
      if (error) { alert("Xato: " + error.message); setLoading(false); return; }
    } else {
      const { error } = await supabase.from("leads").insert(payload);
      if (error) { alert("Xato: " + error.message); setLoading(false); return; }
    }
    setLoading(false); onSuccess(); onClose();
  }



  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{lead ? "Lidni tahrirlash" : "Yangi lid qo'shish"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ism *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="To'liq ism" required />
            </div>
            <div className="space-y-1.5">
              <Label>Telefon *</Label>
              <Input
                value={phone}
                onChange={(e) => { setPhone(e.target.value); checkDuplicate(e.target.value); }}
                placeholder="+998901234567" required
              />
              {/* Dublikat ogohlantirish */}
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
              placeholder="Erkin yozuv..." value={comment} onChange={(e) => setComment(e.target.value)}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Bekor</Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : lead ? "Yangilash" : "Qo'shish"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
