"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, Loader2, AlertCircle, Phone, Lock } from "lucide-react";
import { SESSION_COOKIE, hashPassword, encodeSession } from "@/lib/session";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const hash = await hashPassword(password);
      const { data, error: rpcError } = await supabase.rpc("check_login", {
        p_phone: phone.trim(), p_password_hash: hash,
      });
      if (rpcError) { setError("Tizim xatosi. Qaytadan urinib ko'ring."); setLoading(false); return; }
      if (!data?.success) {
        if (data?.reason === "pending") setError("Hisobingiz admin tomonidan tasdiqlanmagan. Biroz kuting.");
        else if (data?.reason === "blocked") setError("Hisobingiz bloklangan. Admin bilan bog'laning.");
        else setError("Noto'g'ri raqam yoki parol");
        setLoading(false); return;
      }
      const session = { id: data.id, name: data.name, phone: data.phone, role: data.role };
      document.cookie = `${SESSION_COOKIE}=${encodeSession(session)}; path=/; max-age=2592000; SameSite=Lax`;
      router.push(data.role === "admin" ? "/admin" : "/dashboard");
      router.refresh();
    } catch { setError("Xatolik yuz berdi."); setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/8 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/3 via-transparent to-transparent" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="bg-card/80 backdrop-blur-xl border border-border/60 rounded-2xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-xl" />
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/30 to-violet-500/20 border border-primary/30 flex items-center justify-center">
                <Zap className="w-7 h-7 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Sellora Plus</h1>
            <p className="text-sm text-muted-foreground mt-1">CRM tizimiga kiring</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-foreground/80">Telefon raqam</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="phone" type="text" placeholder="+998901234567"
                  value={phone} onChange={(e) => setPhone(e.target.value)}
                  required autoFocus className="pl-9" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-foreground/80">Parol</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="password" type="password" placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  required className="pl-9" />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full h-10 text-sm font-semibold" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Kirish...</> : "Kirish"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <span className="text-xs text-muted-foreground">Hisobingiz yo'qmi? </span>
            <Link href="/register" className="text-xs text-primary hover:underline font-medium">
              Ro'yxatdan o'ting
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground/50 mt-6">Sellora Plus CRM v2.0</p>
      </div>
    </div>
  );
}
