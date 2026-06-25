"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Phone, Lock, User, Eye, EyeOff, Zap } from "lucide-react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("Parol kamida 6 ta belgidan iborat bo'lishi kerak.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), name: name.trim(), password }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.success) {
        if (data?.reason === "exists") setError("Bu telefon raqam allaqachon ro'yxatdan o'tgan.");
        else if (data?.reason === "invalid_phone") setError("Telefon raqamni to'g'ri kiriting: +998 XX XXX XX XX");
        else if (data?.reason === "error") setError("Tizim xatosi. Birozdan so'ng qayta urinib ko'ring.");
        else setError("Ro'yxatdan o'tishda xatolik. Maydonlarni tekshiring.");
        setLoading(false);
        return;
      }
      // Open registration is immediately active — go straight into the app.
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Internet aloqasini tekshiring va qayta urinib ko'ring.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-500/[0.07] rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="bg-card/70 backdrop-blur-xl border border-border/60 rounded-2xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-7">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-xl" />
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/30 to-violet-500/20 border border-primary/30 flex items-center justify-center">
                <Zap className="w-7 h-7 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Ro'yxatdan o'tish</h1>
            <p className="text-sm text-muted-foreground mt-1">Bir daqiqada hisob yarating</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Ism va familiya
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="To'liq ism"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className="pl-9 h-11"
                />
              </div>
            </div>

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
                  autoComplete="tel"
                  className="pl-9 h-11"
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
                  placeholder="Kamida 6 ta belgi"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="pl-9 pr-10 h-11"
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

            <Button type="submit" className="w-full h-11 font-bold" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Yaratilmoqda...
                </>
              ) : (
                "Ro'yxatdan o'tish"
              )}
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-border/30 text-center">
            <span className="text-xs text-muted-foreground">Hisobingiz bormi? </span>
            <Link href="/login" className="text-xs text-primary hover:underline font-semibold">
              Kirish
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
