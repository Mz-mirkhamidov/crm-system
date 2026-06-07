"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { hashPassword } from "@/lib/session";
import { Plus, Loader2, ShieldOff, ShieldCheck, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatDate } from "@/lib/utils";

interface Operator {
  id: string; phone: string; name: string; role: string; is_active: boolean; created_at: string;
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
    const { data } = await supabase.from("operators").select("*").order("created_at");
    setOperators((data as Operator[]) || []);
    setLoading(false);
  }

  async function addOperator(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const hash = await hashPassword(form.password);
    const { error: err } = await supabase.from("operators").insert({
      phone: form.phone.trim(), name: form.name.trim(), password: hash, role: form.role, is_active: true,
    });
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false);
    setForm({ phone: "", name: "", password: "", role: "operator" });
    setAddOpen(false);
    loadOperators();
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from("operators").update({ is_active: !current }).eq("id", id);
    setOperators((prev) => prev.map((o) => o.id === id ? { ...o, is_active: !current } : o));
  }

  async function deleteOperator(id: string) {
    await supabase.from("operators").delete().eq("id", id);
    setOperators((prev) => prev.filter((o) => o.id !== id));
  }

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

      {loading ? (
        <p className="text-muted-foreground text-sm">Yuklanmoqda...</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            {/* Pending approvals alert */}
            {operators.filter(o => o.is_active === false || (o as any).status === 'pending').length > 0 && (
              <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl text-sm text-orange-400">
                ⏳ Tasdiqlash kutayotganlar bor — jadvalda ko'ring
              </div>
            )}
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Ism</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Telefon</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Rol</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Qo'shilgan</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Holat</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {operators.map((op) => (
                <tr key={op.id} className="border-b border-border hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{op.name}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{op.phone}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${op.role === "admin" ? "bg-orange-500/20 text-orange-400 border-orange-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"}`}>
                      {op.role === "admin" ? "Admin" : "Operator"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(op.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${op.is_active ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}>
                      {op.is_active ? "Faol" : "Bloklangan"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-8 w-8"
                        title={op.is_active ? "Bloklash" : "Faollashtirish"}
                        onClick={() => toggleActive(op.id, op.is_active)}>
                        {op.is_active ? <ShieldOff className="w-3.5 h-3.5 text-orange-400" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:bg-red-500/10">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Operatorni o'chirish</AlertDialogTitle>
                            <AlertDialogDescription>{op.name} ni o'chirmoqchimisiz? Barcha ma'lumotlari saqlanadi.</AlertDialogDescription>
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
      )}

      {/* Add operator modal */}
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
                <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+998901234567" required />
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
