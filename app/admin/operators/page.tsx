"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Loader2, ShieldOff, ShieldCheck, Trash2, KeyRound, Search, AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { formatPhone } from "@/lib/phone";

interface Operator {
  id: string; phone: string; name: string; role: string;
  is_active: boolean; status: string; created_at: string; reset_requested?: boolean;
}

export default function OperatorsPage() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ phone: "", name: "", password: "", role: "operator" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [resetFor, setResetFor] = useState<Operator | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetting, setResetting] = useState(false);
  const supabase = createClient();
  const toast = useToast();

  useEffect(() => { loadOperators(); }, []);

  async function loadOperators() {
    const { data } = await supabase.from("operators").select("*").order("is_active").order("created_at");
    setOperators((data as Operator[]) || []);
    setLoading(false);
  }

  async function deleteOperator(id: string) {
    const { data, error } = await supabase.rpc("app_admin_delete_operator", { p_id: id });
    if (error || !data?.success) {
      toast.error(data?.reason === "self" ? "O'zingizni o'chira olmaysiz." : "O'chirishda xatolik.");
      return;
    }
    setOperators((prev) => prev.filter((o) => o.id !== id));
    toast.success("Operator o'chirildi.");
  }

  async function setBlock(id: string, blocked: boolean) {
    const { data, error } = await supabase.rpc("app_admin_set_block", { p_id: id, p_blocked: blocked });
    if (error || !data?.success) {
      toast.error(data?.reason === "self" ? "O'zingizni bloklay olmaysiz." : "Amalda xatolik.");
      return;
    }
    setOperators((prev) => prev.map((o) => o.id === id
      ? { ...o, is_active: !blocked, status: blocked ? "blocked" : "active" } : o));
    toast.success(blocked ? "Operator bloklandi." : "Operator faollashtirildi.");
  }

  async function doResetPassword() {
    if (!resetFor) return;
    if (resetPw.length < 6) { toast.error("Parol kamida 6 ta belgi bo'lishi kerak."); return; }
    setResetting(true);
    const { data, error } = await supabase.rpc("app_admin_reset_password", { p_id: resetFor.id, p_password: resetPw });
    setResetting(false);
    if (error || !data?.success) { toast.error("Parolni tiklashda xatolik."); return; }
    toast.success(`${resetFor.name} uchun parol tiklandi. Keyingi kirishda yangilashi so'raladi.`);
    setResetFor(null); setResetPw("");
  }

  async function addOperator(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const res = await fetch("/api/operators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: form.phone.trim(), name: form.name.trim(), password: form.password, role: form.role }),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!data?.success) {
      setError(data?.reason === "exists" ? "Bu telefon raqam allaqachon mavjud."
        : data?.reason === "invalid_phone" ? "Telefon raqam noto'g'ri."
        : "Xatolik yuz berdi.");
      return;
    }
    setForm({ phone: "", name: "", password: "", role: "operator" });
    setAddOpen(false);
    toast.success("Yangi operator qo'shildi.");
    loadOperators();
  }

  const q = search.trim().toLowerCase();
  const visible = operators.filter((o) =>
    !q || o.name.toLowerCase().includes(q) || o.phone.includes(q));
  const active = visible.filter((o) => o.is_active)
    .sort((a, b) => Number(b.reset_requested) - Number(a.reset_requested));
  const blocked = visible.filter((o) => !o.is_active);
  const resetCount = operators.filter((o) => o.reset_requested).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Operatorlar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Foydalanuvchilarni boshqarish ({operators.length})</p>
        </div>
        <Button onClick={() => setAddOpen(true)} size="sm">
          <Plus className="w-4 h-4" /> Yangi operator
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Ism yoki telefon bo'yicha qidirish..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>


      {resetCount > 0 && (
        <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-lg px-4 py-2.5 text-sm text-orange-300">
          <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />
          <span><span className="font-bold">{resetCount} ta operator</span> parolni tiklashni so'ragan — pastdagi 🔑 tugma orqali yangi vaqtinchalik parol bering.</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-6">
          {/* ACTIVE */}
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Faol operatorlar ({active.length})</h2>
            <div className="rounded-xl border border-border overflow-x-auto">
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
                      <td className="px-4 py-3 font-medium">
                        <span className="inline-flex items-center gap-2">{op.name}
                          {op.reset_requested && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                              <KeyRound className="w-3 h-3" /> tiklash
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{formatPhone(op.phone)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${op.role === "admin" ? "bg-orange-500/20 text-orange-400 border-orange-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"}`}>
                          {op.role === "admin" ? "Admin" : "Operator"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(op.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-violet-400 hover:bg-violet-500/10"
                            title="Parolni tiklash" onClick={() => { setResetFor(op); setResetPw(""); }}>
                            <KeyRound className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-orange-400 hover:bg-orange-500/10"
                            title="Bloklash" onClick={() => setBlock(op.id, true)}>
                            <ShieldOff className="w-3.5 h-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:bg-red-500/10" title="O'chirish">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Operatorni o'chirish</AlertDialogTitle>
                                <AlertDialogDescription>{op.name} ni butunlay o'chirmoqchimisiz? Bu amalni orqaga qaytarib bo'lmaydi.</AlertDialogDescription>
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
                  {active.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">Operator topilmadi</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* BLOCKED */}
          {blocked.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Bloklangan ({blocked.length})</h2>
              <div className="rounded-xl border border-border overflow-x-auto opacity-70">
                <table className="w-full text-sm">
                  <tbody>
                    {blocked.map((op) => (
                      <tr key={op.id} className="border-b border-border">
                        <td className="px-4 py-3 font-medium">{op.name}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{formatPhone(op.phone)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => setBlock(op.id, false)}>
                            <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Faollashtirish
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:bg-red-500/10 ml-1">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Operatorni o'chirish</AlertDialogTitle>
                                <AlertDialogDescription>{op.name} ni butunlay o'chirmoqchimisiz?</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Bekor</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteOperator(op.id)}>O'chirish</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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

      {/* Reset password modal */}
      <Dialog open={!!resetFor} onOpenChange={(o) => !o && setResetFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Parolni tiklash — {resetFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Yangi vaqtinchalik parol *</Label>
              <Input type="text" value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="Kamida 6 belgi" minLength={6} />
              <p className="text-xs text-muted-foreground">Operator keyingi kirishda o'z parolini o'rnatishi so'raladi.</p>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setResetFor(null)} className="flex-1">Bekor</Button>
              <Button type="button" disabled={resetting} onClick={doResetPassword} className="flex-1">
                {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Tiklash"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
