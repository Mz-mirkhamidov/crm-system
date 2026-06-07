"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, Loader2, AlertCircle, CheckCircle2, Phone, Lock, User } from "lucide-react";
import { hashPassword } from "@/lib/session";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { setError("Parol kamida 6 ta belgidan iborat bo'lishi kerak"); return; }
    setLoading(true); setError("");
    try {
      const hash = await hashPassword(password);
      const { data, error: rpcError } = await supabase.rpc("register_operator", {
        p_phone: phone.trim(), p_name: name.trim(), p_password_hash: hash,
      });
      if (rpcError) { setError("Tizim xatosi. Qaytadan urinib ko'ring."); setLoading(false); return; }
      if (!data?.success) {
        if (data?.reason === "exists") setError("Bu telefon raqam allaqachon ro'yxatdan o'tgan.");
        else setError("Ro'yxatdan o'tishda xatolik.");
        setLoading(false); return;
      }
      setSuccess(true);
    } catch { setError("Xatolik yuz berdi."); }
    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Ariza qabul qilindi!</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Ro'yxatdan o'tish arizangiz admin tomonidan ko'rib chiqiladi. Tasdiqlangandan so'ng tizimga kirishingiz mumkin bo'ladi.
          </p>
          <Link href="/login">
            <Button className="w-full">Loginga qaytish</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/8 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="bg-card/80 backdrop-blur-xl border border-border/60 rounded-2xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-xl" />
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/30 to-violet-500/20 border border-primary/30 flex items-center justify-center">
                <Zap className="w-7 h-7 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Ro'yxatdan o'tish</h1>
            <p className="text-sm text-muted-foreground mt-1">Admin tasdiqlashi kerak bo'ladi</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Ism va familiya</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="To'liq ism" value={name} onChange={(e) => setName(e.target.value)} required className="pl-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Telefon raqam</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="+998901234567" value={phone} onChange={(e) => setPhone(e.target.value)} required className="pl-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Parol</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="password" placeholder="Kamida 6 belgi" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="pl-9" />
              </div>
            </div>
            {error && (
              <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span>
              </div>
            )}
            <Button type="submit" className="w-full h-10" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Yuborilmoqda...</> : "Ariza yuborish"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <span className="text-xs text-muted-foreground">Hisobingiz bormi? </span>
            <Link href="/login" className="text-xs text-primary hover:underline font-medium">Kirish</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
