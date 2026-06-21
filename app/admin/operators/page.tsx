"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Loader2, ShieldOff, ShieldCheck, Trash2, Clock, CheckCircle2, XCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Operator {
  id: string; phone: string; name: string; role: string;
  is_active: boolean; status: string; created_at: string;
}

export default function OperatorsPage() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ phone: "", name: "", password: "", role: "operator" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  useEffect(() => { loadOperators(); }, []);

  async function loadOperators() {
    const { data } = await supabase.from("operators").select("*").order("is_active").order("created_at");
    setOperators((data as Operator[]) || []);
    setLoading(false);
  }

  async function approveOperator(id: string) {
    await supabase.from("operators").update({ is_active: true, status: "active" }).eq("id", id);
    setOperators((prev) => prev.map((o) => o.id === id ? { ...o, is_active: true, status: "active" } : o));
  }

  async function rejectOperator(id: string) {
    await supabase.from("operators").delete().eq("id", id);
    setOperators((prev) => prev.filter((o) => o.id !== id));
  }

  async function blockOperator(id: string) {
    await supabase.from("operators").update({ is_active: false, status: "blocked" }).eq("id", id);
    setOperators((prev) => prev.map((o) => o.id === id ? { ...o, is_active: false, status: "blocked" } : o));
  }

  async function unblockOperator(id: string) {
    await supabase.from("operators").update({ is_active: true, status: "active" }).eq("id", id);
    setOperators((prev) => prev.map((o) => o.id === id ? { ...o, is_active: true, status: "active" } : o));
  }

  async function deleteOperator(id: string) {
    await supabase.from("operators").delete().eq("id", id);
    setOperators((prev) => prev.filter((o) => o.id !== id));
  }

  async function addOperator(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    // Submit the RAW password over HTTPS to the server route, which verifies the admin
    // session and stores a bcrypt hash (per-user salt) via the `admin_create_operator`
    // RPC. No password is hashed in the browser.
    const res = await fetch("/api/operators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: form.phone.trim(),
        name: form.name.trim(),
        password: form.password,
        role: form.role,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!data?.success) {
      setError(data?.reason === "exists" ? "Bu telefon raqam allaqachon mavjud." : (data?.reason || "Xatolik yuz berdi."));
      setSaving(false); return;
    }
    setSaving(false);
    setForm({ phone: "", name: "", password: "", role: "operator" });
    setAddOpen(false);
    loadOperators();
  }

  const pending = operators.filter((o) => !o.is_active && o.status !== "blocked");
  const active = operators.filter((o) => o.is_active);
  const blocked = operators.filter((o) => !o.is_active && o.status === "blocked");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Operatorlar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Foydalanuvchilarni boshqarish</p>
        </div>
        <Button onClick={() => setAddOpen(true)} size="sm">
          <Plus className="w-4 h-4" /> Yangi operator
        </Button>
      </div>

      {loading ? <p className="text-muted-foreground text-sm">Yuklanmoqda...</p> : (
        <div className="space-y-6">

          {/* PENDING */}
          {pending.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-orange-400" />
                <h2 className="text-sm font-semibold text-foreground">Tasdiqlash kutilmoqda</h2>
                <span className="bg-orange-500/20 text-orange-400 text-xs rounded-full px-2 py-0.5 border border-orange-500/30 animate-pulse">
                  {pending.length} ta
                </span>
              </div>
              <div className="rounded-xl border border-orange-500/20 overflow-hidden bg-orange-500/5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-orange-500/10 bg-orange-500/10">
                      <th className="text-left px-4 py-3 text-orange-300 font-medium">Ism</th>
                      <th className="text-left px-4 py-3 text-orange-300 font-medium">Telefon</th>
                      <th className="text-left px-4 py-3 text-orange-300 font-medium">Sana</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((op) => (
                      <tr key={op.id} className="border-b border-orange-500/10">
                        <td className="px-4 py-3 font-medium text-foreground">{op.name}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{op.phone}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(op.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-end">
                            <Button size="sm" className="h-8 text-xs gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white"
                              onClick={() => approveOperator(op.id)}>
                              <CheckCircle2 className="w-3.5 h-3.5" /> Tasdiqlash
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10"
                              onClick={() => rejectOperator(op.id)}>
                              <XCircle className="w-3.5 h-3.5" /> Rad etish
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ACTIVE */}
          {active.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3">Faol operatorlar ({active.length})</h2>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Ism</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Telefon</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Rol</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Qo'shilgan</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.map((op) => (
                      <tr key={op.id} className="border-b border-border hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{op.name}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{op.phone}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${op.role === "admin" ? "bg-orange-500/20 text-orange-400 border-orange-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"}`}>
                            {op.role === "admin" ? "Admin" : "Operator"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(op.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-orange-400 hover:bg-orange-500/10"
                              title="Bloklash" onClick={() => blockOperator(op.id)}>
                              <ShieldOff className="w-3.5 h-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:bg-red-500/10">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>O'chirish</AlertDialogTitle>
                                  <AlertDialogDescription>{op.name} ni o'chirmoqchimisiz?</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Bekor</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteOperator(op.id)}>O'chirish</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* BLOCKED */}
          {blocked.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Bloklangan ({blocked.length})</h2>
              <div className="rounded-xl border border-border overflow-hidden opacity-60">
                <table className="w-full text-sm">
                  <tbody>
                    {blocked.map((op) => (
                      <tr key={op.id} className="border-b border-border">
                        <td className="px-4 py-3 font-medium">{op.name}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{op.phone}</td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => unblockOperator(op.id)}>
                            <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Faollashtirish
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Yangi operator qo'shish</DialogTitle></DialogHeader>
          <form onSubmit={addOperator} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ism *</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="To'liq ism" required />
              </div>
              <div className="space-y-1.5">
                <Label>Telefon *</Label>
                <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+998..." required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Parol *</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="Kamida 6 belgi" required minLength={6} />
              </div>
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-input px-3 py-1 text-sm">
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)} className="flex-1">Bekor</Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Qo'shish"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
