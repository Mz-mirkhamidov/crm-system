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
import { OrderModal } from "@/components/shared/order-modal";
import { PersonDetailModal } from "@/components/shared/detail-modal";
import { FollowUpModal } from "@/components/shared/follow-up-modal";
import { AsyncContent } from "@/components/shared/async-content";
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
  MessageSquare,
  Users,
} from "lucide-react";
import { cn, formatDate, formatPrice, getProductColor } from "@/lib/utils";
import { LocationSelect } from "@/components/shared/location-select";
import type { Client, Order } from "@/types";

export function ClientsTable() {
  const { data: clients, loading, error, refetch, remove, loadClientOrders } = useClients();
  const operator = useOperator();
  const operatorId = operator?.id || "";

  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clientOrders, setClientOrders] = useState<Record<string, Order[]>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [detailClient, setDetailClient] = useState<Client | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [orderClient, setOrderClient] = useState<Client | null>(null);
  const [followUpClient, setFollowUpClient] = useState<Client | null>(null);

  const q = search.toLowerCase();
  const filtered = search
    ? clients.filter((c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q))
    : clients;

  async function loadOrdersFor(clientId: string) {
    if (clientOrders[clientId]) return;
    const orders = await loadClientOrders(clientId);
    setClientOrders((prev) => ({ ...prev, [clientId]: orders }));
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await remove(id);
    setDeletingId(null);
  }

  function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); }
    else { setExpandedId(id); loadOrdersFor(id); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Ism yoki telefon..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
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
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Ism</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Telefon</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Manzil</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">Qo'shilgan</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((client) => {
                  const isDeleting = deletingId === client.id;
                  return (
                    <Fragment key={client.id}>
                      <tr className="border-b border-border hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => setDetailClient(client)}>
                        <td className="px-4 py-3 font-medium">{client.name}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{client.phone}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">{client.address}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">{formatDate(client.created_at)}</td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-400 hover:bg-green-500/10" title="Zakaz" disabled={isDeleting} onClick={() => setOrderClient(client)}>
                              <ShoppingCart className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-400 hover:bg-blue-500/10" title="Follow-up" disabled={isDeleting} onClick={() => setFollowUpClient(client)}>
                              <Bell className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={isDeleting} onClick={() => setEditClient(client)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:bg-red-500/10" disabled={isDeleting}>
                                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Mijozni o'chirish</AlertDialogTitle>
                                  <AlertDialogDescription>{client.name} ni o'chirmoqchimisiz?</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Bekor</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(client.id)}>O'chirish</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <button className="p-1 text-muted-foreground" onClick={() => toggleExpand(client.id)}>
                              {expandedId === client.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === client.id && (
                        <tr className="bg-secondary/20">
                          <td colSpan={5} className="px-4 py-4">
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
  const [comment, setComment] = useState(client?.comment || "");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = { name, phone, address: address || null, comment: comment || null };
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
