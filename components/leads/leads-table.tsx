"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { OrderModal } from "@/components/shared/order-modal";
import { FollowUpModal } from "@/components/shared/follow-up-modal";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ShoppingCart,
  Bell,
  Loader2,
  ChevronDown,
  ChevronUp,
  Phone,
  MapPin,
  MessageSquare,
  Clock,
} from "lucide-react";
import {
  cn,
  formatDate,
  formatPrice,
  getStatusColor,
  getProductColor,
} from "@/lib/utils";
import type { Lead, LeadStatus } from "@/types";
import { LEAD_STATUSES, DEFAULT_TAGS } from "@/types";

export function LeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filtered, setFiltered] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [tags, setTags] = useState<string[]>(DEFAULT_TAGS);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [leadOrders, setLeadOrders] = useState<Record<string, any[]>>({});

  // Modals
  const [addOpen, setAddOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [orderLead, setOrderLead] = useState<Lead | null>(null);
  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadLeads();
  }, []);

  useEffect(() => {
    let f = leads;
    if (search) {
      const q = search.toLowerCase();
      f = f.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.phone.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== "all") f = f.filter((l) => l.status === filterStatus);
    if (filterTag !== "all") f = f.filter((l) => l.tag === filterTag);
    setFiltered(f);
  }, [search, filterStatus, filterTag, leads]);

  async function loadLeads() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("leads")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setLeads((data as Lead[]) || []);
    } catch (e) {
      console.error("loadLeads error:", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadLeadOrders(leadId: string) {
    if (leadOrders[leadId]) return;
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("source_id", leadId)
      .eq("source_type", "lead")
      .order("created_at", { ascending: false });
    setLeadOrders((prev) => ({ ...prev, [leadId]: data || [] }));
  }

  async function deleteLead(id: string) {
    await supabase.from("leads").delete().eq("id", id);
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      loadLeadOrders(id);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Ism yoki telefon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Holat" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha holatlar</SelectItem>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterTag} onValueChange={setFilterTag}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Teg" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha teglar</SelectItem>
            {tags.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={() => setAddOpen(true)} size="sm">
          <Plus className="w-4 h-4" /> Yangi lid
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Yuklanmoqda...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Lidlar topilmadi
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Ism</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Telefon</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Teg</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Holat</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">Qo'shilgan</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <>
                  <tr
                    key={lead.id}
                    className="border-b border-border hover:bg-secondary/30 transition-colors cursor-pointer"
                    onClick={() => toggleExpand(lead.id)}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {lead.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {lead.phone}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {lead.tag && (
                        <span className="text-xs bg-secondary border border-border rounded-full px-2 py-0.5">
                          {lead.tag}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full border", getStatusColor(lead.status))}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                      {formatDate(lead.created_at)}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-green-400 hover:text-green-300 hover:bg-green-500/10"
                          title="Zakaz berdi"
                          onClick={() => setOrderLead(lead)}
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                          title="Follow-up"
                          onClick={() => setFollowUpLead(lead)}
                        >
                          <Bell className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => setEditLead(lead)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Lidni o'chirish</AlertDialogTitle>
                              <AlertDialogDescription>
                                {lead.name} lidini o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Bekor</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteLead(lead.id)}>
                                O'chirish
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <button className="p-1 text-muted-foreground">
                          {expandedId === lead.id ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded row */}
                  {expandedId === lead.id && (
                    <tr key={`${lead.id}-expand`} className="bg-secondary/20">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Details */}
                          <div className="space-y-2">
                            {lead.address && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <MapPin className="w-3.5 h-3.5" />
                                {lead.address}
                              </div>
                            )}
                            {lead.comment && (
                              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                                <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                {lead.comment}
                              </div>
                            )}
                          </div>

                          {/* Order history */}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">Zakaz tarixi</p>
                            {leadOrders[lead.id] === undefined ? (
                              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            ) : leadOrders[lead.id].length === 0 ? (
                              <p className="text-xs text-muted-foreground">Zakazlar yo'q</p>
                            ) : (
                              <div className="space-y-1.5">
                                {leadOrders[lead.id].map((o: any) => (
                                  <div key={o.id} className="flex items-center gap-2 text-xs">
                                    <span className={cn("px-1.5 py-0.5 rounded-full", getProductColor(o.product))}>
                                      {o.product}
                                    </span>
                                    <span className="text-foreground">{formatPrice(o.price)}</span>
                                    <span className="text-muted-foreground ml-auto">{formatDate(o.created_at)}</span>
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      <LeadFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={loadLeads}
        tags={tags}
        onAddTag={(t) => setTags((prev) => prev.includes(t) ? prev : [...prev, t])}
      />

      {/* Edit Modal */}
      {editLead && (
        <LeadFormModal
          open={!!editLead}
          onClose={() => setEditLead(null)}
          onSuccess={loadLeads}
          tags={tags}
          onAddTag={(t) => setTags((prev) => prev.includes(t) ? prev : [...prev, t])}
          lead={editLead}
        />
      )}

      {/* Order Modal */}
      {orderLead && (
        <OrderModal
          open={!!orderLead}
          onClose={() => setOrderLead(null)}
          sourceId={orderLead.id}
          sourceName={orderLead.name}
          sourceType="lead"
          onSuccess={loadLeads}
        />
      )}

      {/* Follow-up Modal */}
      {followUpLead && (
        <FollowUpModal
          open={!!followUpLead}
          onClose={() => setFollowUpLead(null)}
          sourceId={followUpLead.id}
          sourceName={followUpLead.name}
          sourcePhone={followUpLead.phone}
          sourceType="lead"
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}

// ------- Lead Form Modal -------
interface LeadFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tags: string[];
  onAddTag: (tag: string) => void;
  lead?: Lead;
}

function LeadFormModal({ open, onClose, onSuccess, tags, onAddTag, lead }: LeadFormModalProps) {
  const [name, setName] = useState(lead?.name || "");
  const [phone, setPhone] = useState(lead?.phone || "");
  const [address, setAddress] = useState(lead?.address || "");
  const [tag, setTag] = useState(lead?.tag || "");
  const [status, setStatus] = useState<LeadStatus>(lead?.status || "Yangi");
  const [comment, setComment] = useState(lead?.comment || "");
  const [newTag, setNewTag] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      user_id: user.id,
      name,
      phone,
      address: address || null,
      tag: tag || null,
      status,
      comment: comment || null,
    };

    if (lead) {
      await supabase.from("leads").update(payload).eq("id", lead.id);
    } else {
      await supabase.from("leads").insert(payload);
    }

    setLoading(false);
    onSuccess();
    onClose();
  }

  function handleAddTag() {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      onAddTag(newTag.trim());
      setTag(newTag.trim());
      setNewTag("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{lead ? "Lidni tahrirlash" : "Yangi lid"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ism *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="To'liq ism" required />
            </div>
            <div className="space-y-1.5">
              <Label>Telefon *</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998901234567" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Manzil</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Shahar / tuman" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Teg</Label>
              <Select value={tag} onValueChange={setTag}>
                <SelectTrigger>
                  <SelectValue placeholder="Tanlash" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {tags.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-1 mt-1">
                <Input
                  placeholder="+ Yangi teg"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className="h-7 text-xs"
                />
                <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={handleAddTag}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Holat</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as LeadStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Kommentariya</Label>
            <textarea
              className="flex w-full rounded-md border border-input bg-input px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none min-h-[70px]"
              placeholder="Erkin yozuv..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
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
