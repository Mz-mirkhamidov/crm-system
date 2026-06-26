"use client";

import { useState, Fragment } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useOperator } from "@/lib/useOperator";
import { useClients } from "@/lib/data/use-clients";
import { insertClient, updateClient } from "@/lib/data/repository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrderModal } from "@/components/shared/order-modal";
import { PersonDetailModal } from "@/components/shared/detail-modal";
import { FollowUpModal } from "@/components/shared/follow-up-modal";
import { AsyncContent } from "@/components/shared/async-content";
import {
  Plus,
  Search,
  Pencil,
  ShoppingCart,
  Bell,
  Loader2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Users,
  Clock,
} from "lucide-react";
import { cn, formatDate, formatPrice, getProductColor, getClientStaleness } from "@/lib/utils";
import { LocationSelect } from "@/components/shared/location-select";
import { DEFAULT_TAGS } from "@/types";
import type { Client, Order } from "@/types";

/**
 * Pure filter used by the clients table (exported for property testing — design Property 9).
 * Search matches name/phone; a non-"all" tag value keeps only exact-tag matches, while
 * "all" disables the tag filter.
 */
export function filterClients(clients: Client[], search: string, tag: string): Client[] {
  const q = search.trim().toLowerCase();
  return clients.filter((c) => {
    const matchesSearch =
      q === "" || c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q);
    const matchesTag = tag === "all" || c.tag === tag;
    return matchesSearch && matchesTag;
  });
}

export function ClientsTable() {
  // NOTE: `remove` is intentionally NOT destructured — clients are non-destructive from the
  // UI (Requirement 1, design Property 8). The capability stays in the data layer for
  // non-UI/back-compat callers only.
  const { data: clients, loading, error, refetch, loadClientOrders } = useClients();
  const operator = useOperator();
  const operatorId = operator?.id || "";

  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clientOrders, setClientOrders] = useState<Record<string, Order[]>>({});

  const [detailClient, setDetailClient] = useState<Client | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [orderClient, setOrderClient] = useState<Client | null>(null);
  const [followUpClient, setFollowUpClient] = useState<Client | null>(null);

  // Tag filter options: DEFAULT_TAGS plus any tag present in the loaded clients (Req 4.2).
  const tagOptions = Array.from(
    new Set<string>([
      ...DEFAULT_TAGS,
      ...clients.map((c) => c.tag).filter((t): t is string => !!t),
    ])
  );

  const filtered = filterClients(clients, search, filterTag);
  const staleCount = clients.filter((c) => getClientStaleness(c).stale).length;

  async function loadOrdersFor(clientId: string) {
    if (clientOrders[clientId]) return;
    const orders = await loadClientOrders(clientId);
    setClientOrders((prev) => ({ ...prev, [clientId]: orders }));
  }

  function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); }
    else { setExpandedId(id); loadOrdersFor(id); }
  }

  return (
    <div className="space-y-4">
      {/* Needs-attention banner — mirrors the leads cold banner (Req 6.4). */}
      {staleCount > 0 && (
        <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-lg px-4 py-2.5 text-sm">
          <Clock className="w-4 h-4 text-orange-400 flex-shrink-0" />
          <span className="text-orange-300">
            <span className="font-bold">{staleCount} ta mijoz</span> 7+ kun aloqasiz — e'tibor talab qiladi
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Ism yoki telefon..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <Select value={filterTag} onValueChange={setFilterTag}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Teg" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha teglar</SelectItem>
            {tagOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <Button onClick={() => setAddOpen(true)} size="sm">
          <Plus className="w-4 h-4" /> Yangi mijoz
        </Button>
      </div>

      <AsyncContent
        loading={loading}
        error={error}
        data={filtered}
        onRetry={refetch}
        empty={{ icon: Users, title: "Mijozlar topilmadi" }}
      >
        {(rows) => (
          <div className="rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Ism</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Telefon</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Teg</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Faollik</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">Manzil</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((client) => {
                  const staleness = getClientStaleness(client);
                  return (
                    <Fragment key={client.id}>
                      <tr className="border-b border-border hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => setDetailClient(client)}>
                        <td className="px-4 py-3 font-medium">{client.name}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{client.phone}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {client.tag && <span className="text-xs bg-secondary border border-border rounded-full px-2.5 py-1">{client.tag}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", staleness.color)}>
                            {staleness.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">{client.address}</td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-400 hover:bg-green-500/10" title="Zakaz" onClick={() => setOrderClient(client)}>
                              <ShoppingCart className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-400 hover:bg-blue-500/10" title="Follow-up" onClick={() => setFollowUpClient(client)}>
                              <Bell className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Tahrirlash" onClick={() => setEditClient(client)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <button className="p-1 text-muted-foreground" onClick={() => toggleExpand(client.id)}>
                              {expandedId === client.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === client.id && (
                        <tr className="bg-secondary/20">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                {client.comment && (
                                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                                    <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                    {client.comment}
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">Zakaz tarixi</p>
                                {clientOrders[client.id] === undefined ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                  : clientOrders[client.id].length === 0 ? <p className="text-xs text-muted-foreground">Zakazlar yo'q</p>
                                  : <div className="space-y-1.5">
                                    {clientOrders[client.id].map((o) => (
                                      <div key={o.id} className="flex items-center gap-2 text-xs">
                                        <span className={cn("px-1.5 py-0.5 rounded-full", getProductColor(o.product))}>{o.product}</span>
                                        <span className="text-foreground">{formatPrice(o.price)}</span>
                                        <span className="text-muted-foreground ml-auto">{formatDate(o.created_at)}</span>
                                      </div>
                                    ))}
                                  </div>
                                }
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

      <ClientFormModal open={addOpen} onClose={() => setAddOpen(false)} onSuccess={refetch} operatorId={operatorId} />
      {editClient && <ClientFormModal open={!!editClient} onClose={() => setEditClient(null)} onSuccess={refetch} client={editClient} operatorId={operatorId} />}
      {orderClient && <OrderModal open={!!orderClient} onClose={() => setOrderClient(null)} sourceId={orderClient.id} sourceName={orderClient.name} sourceType="client" onSuccess={refetch} />}
      {followUpClient && <FollowUpModal open={!!followUpClient} onClose={() => setFollowUpClient(null)} sourceId={followUpClient.id} sourceName={followUpClient.name} sourcePhone={followUpClient.phone} sourceType="client" onSuccess={() => {}} />}
      <PersonDetailModal
        open={!!detailClient}
        onClose={() => setDetailClient(null)}
        person={detailClient}
        sourceType="client"
        onRefresh={refetch}
      />
    </div>
  );
}

function ClientFormModal({ open, onClose, onSuccess, client, operatorId }: { open: boolean; onClose: () => void; onSuccess: () => void; client?: Client; operatorId: string }) {
  const [name, setName] = useState(client?.name || "");
  const [phone, setPhone] = useState(client?.phone || "");
  const [address, setAddress] = useState(client?.address || "");
  const [tag, setTag] = useState(client?.tag || "none");
  const [comment, setComment] = useState(client?.comment || "");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  // Tag options: DEFAULT_TAGS plus the client's current tag if it isn't a preset.
  const tagOptions = Array.from(
    new Set<string>([...DEFAULT_TAGS, ...(client?.tag ? [client.tag] : [])])
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    // `tag` is now part of the required ClientInput shape, so it must be included in the
    // insert/update payload (fixes the prior type error).
    const payload = {
      name,
      phone,
      address: address || null,
      tag: tag === "none" ? null : tag,
      comment: comment || null,
    };
    const result = client
      ? await updateClient(client.id, payload)
      : await insertClient(operatorId, payload);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(client ? "Mijoz yangilandi" : "Mijoz qo'shildi");
    onSuccess();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{client ? "Mijozni tahrirlash" : "Yangi mijoz"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ism *</Label>
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} required placeholder="To'liq ism" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefon *</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+998..." />
            </div>
          </div>
          <LocationSelect value={address} onChange={setAddress} />
          <div className="space-y-1.5">
            <Label>Teg</Label>
            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger><SelectValue placeholder="Tanlash" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {tagOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Kommentariya</Label>
            <textarea className="flex w-full rounded-md border border-input bg-input px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none min-h-[70px]" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tarix, eslatma..." />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Bekor</Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : client ? "Yangilash" : "Qo'shish"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
