"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Phone, Lock, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), password }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.success) {
        if (data?.reason === "pending") setError("Hisobingiz hali tasdiqlanmagan.");
        else if (data?.reason === "blocked") setError("Hisob bloklangan. Admin bilan bog'laning.");
        else if (data?.reason === "error") setError("Tizim xatosi. Birozdan so'ng qayta urinib ko'ring.");
        else setError("Telefon raqam yoki parol noto'g'ri.");
        setLoading(false);
        return;
      }
      router.push(data.role === "admin" ? "/admin" : "/dashboard");
      router.refresh();
    } catch {
      setError("Internet aloqasini tekshiring va qayta urinib ko'ring.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 w-[500px] h-[300px] bg-violet-600/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] bg-primary/[0.06] rounded-full blur-[80px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(262 83% 62%) 1px, transparent 1px), linear-gradient(90deg, hsl(262 83% 62%) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative w-full max-w-sm px-4">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-5">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/40 rounded-2xl blur-2xl scale-110" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-600/30 border border-primary/30 backdrop-blur-sm flex items-center justify-center">
                <span className="text-2xl font-black text-primary">S</span>
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-primary" style={{ textShadow: "0 0 30px hsl(262 83% 62% / 0.5)" }}>
              SELLORA
            </span>
            <span className="text-foreground"> CRM</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 tracking-widest uppercase">Sales Management</p>
        </div>

        {/* Card */}
        <div
          className="bg-card/60 backdrop-blur-2xl border border-primary/10 rounded-2xl p-7 shadow-2xl"
          style={{ boxShadow: "0 0 40px hsl(262 83% 62% / 0.08), 0 20px 40px rgba(0,0,0,0.4)" }}
        >
          <h2 className="text-lg font-bold text-foreground mb-1">Tizimga kirish</h2>
          <p className="text-xs text-muted-foreground mb-5">Hisobingizga kiring</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Telefon raqam
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="tel"
                  inputMode="tel"
                  placeholder="+998 90 123 45 67"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  autoFocus
                  autoComplete="tel"
                  className="bg-background/50 border-primary/20 focus:border-primary/60 h-11 pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Parol
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="bg-background/50 border-primary/20 focus:border-primary/60 h-11 pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPw ? "Parolni yashirish" : "Parolni ko'rsatish"}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 font-bold text-sm mt-2 bg-primary hover:bg-primary/90"
              style={{ boxShadow: "0 0 20px hsl(262 83% 62% / 0.3)" }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Kirilmoqda...
                </>
              ) : (
                "Kirish"
              )}
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-border/30 text-center">
            <span className="text-xs text-muted-foreground">Hisobingiz yo'qmi? </span>
            <Link href="/register" className="text-xs text-primary hover:underline font-semibold">
              Ro'yxatdan o'tish
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground/30 mt-6 tracking-widest">v3.0</p>
      </div>
    </div>
  );
}
