"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle } from "lucide-react";
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
        if (data?.reason === "pending") setError("Hisobingiz tasdiqlanmagan. Admin bilan bog'laning.");
        else if (data?.reason === "blocked") setError("Hisob bloklangan.");
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
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Neon background layers */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 w-[500px] h-[300px] bg-violet-600/8 rounded-full blur-[100px]" />
        <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] bg-primary/6 rounded-full blur-[80px]" />
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "linear-gradient(hsl(262 83% 62%) 1px, transparent 1px), linear-gradient(90deg, hsl(262 83% 62%) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      <div className="relative w-full max-w-sm px-4">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-5">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/40 rounded-2xl blur-2xl scale-110" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-600/30 border border-primary/30 backdrop-blur-sm flex items-center justify-center">
                <span className="text-2xl font-black text-primary">C</span>
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-primary" style={{ textShadow: "0 0 30px hsl(262 83% 62% / 0.5)" }}>CRM</span>
            <span className="text-foreground"> System</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 tracking-widest uppercase">Sales Management</p>
        </div>

        {/* Card */}
        <div className="bg-card/60 backdrop-blur-2xl border border-primary/10 rounded-2xl p-7 shadow-2xl"
          style={{ boxShadow: "0 0 40px hsl(262 83% 62% / 0.08), 0 20px 40px rgba(0,0,0,0.4)" }}>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telefon raqam</label>
              <Input type="text" placeholder="+998901234567" value={phone}
                onChange={(e) => setPhone(e.target.value)} required autoFocus
                className="bg-background/50 border-primary/20 focus:border-primary/60 h-11" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Parol</label>
              <Input type="password" placeholder="••••••••" value={password}
                onChange={(e) => setPassword(e.target.value)} required
                className="bg-background/50 border-primary/20 focus:border-primary/60 h-11" />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span>
              </div>
            )}

            <Button type="submit" disabled={loading}
              className="w-full h-11 font-bold text-sm mt-2 bg-primary hover:bg-primary/90"
              style={{ boxShadow: "0 0 20px hsl(262 83% 62% / 0.3)" }}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Kirish...</> : "Kirish"}
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-border/30 text-center">
            <span className="text-xs text-muted-foreground">Hisob yo'qmi? </span>
            <Link href="/register" className="text-xs text-primary hover:underline font-semibold">Ro'yxatdan o'ting</Link>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground/30 mt-6 tracking-widest">v2.0</p>
      </div>
    </div>
  );
}
