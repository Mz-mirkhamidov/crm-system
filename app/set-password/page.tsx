"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import type { Operator } from "@/lib/session";

export default function SetPasswordPage() {
  const router = useRouter();
  const [me, setMe] = useState<Operator | null>(null);
  const [checking, setChecking] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Operator | null) => {
        if (!active) return;
        if (!data) {
          router.replace("/login");
          return;
        }
        if (!data.mustChangePassword) {
          router.replace(data.role === "admin" ? "/admin" : "/dashboard");
          return;
        }
        setMe(data);
        setChecking(false);
      })
      .catch(() => active && router.replace("/login"));
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError("Parol kamida 6 ta belgidan iborat bo'lishi kerak.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Parollar mos kelmadi.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/profile/set-initial-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json().catch(() => null);
      if (data?.success) {
        router.replace(data.role === "admin" ? "/admin" : "/dashboard");
        router.refresh();
      } else if (data?.reason === "weak") {
        setError("Parol juda qisqa.");
        setLoading(false);
      } else {
        setError("Xatolik yuz berdi. Qayta urinib ko'ring.");
        setLoading(false);
      }
    } catch {
      setError("Internet aloqasini tekshiring.");
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-4">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 w-[500px] h-[300px] bg-violet-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-600/30 border border-primary/30 items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Parolingizni o'rnating</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Xush kelibsiz, {me?.name}! Davom etishdan oldin yangi, faqat o'zingizga ma'lum
            parol yarating.
          </p>
        </div>

        <div
          className="bg-card/60 backdrop-blur-2xl border border-primary/10 rounded-2xl p-7 shadow-2xl"
          style={{ boxShadow: "0 0 40px hsl(262 83% 62% / 0.08), 0 20px 40px rgba(0,0,0,0.4)" }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Yangi parol
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPw ? "text" : "password"}
                  placeholder="Kamida 6 ta belgi"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
                  className="bg-background/50 border-primary/20 focus:border-primary/60 h-11 pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPw ? "Yashirish" : "Ko'rsatish"}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Parolni tasdiqlang
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPw ? "text" : "password"}
                  placeholder="Qaytadan kiriting"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="bg-background/50 border-primary/20 focus:border-primary/60 h-11 pl-9"
                />
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
              className="w-full h-11 font-bold text-sm bg-primary hover:bg-primary/90"
              style={{ boxShadow: "0 0 20px hsl(262 83% 62% / 0.3)" }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Saqlanmoqda...
                </>
              ) : (
                "Saqlash va davom etish"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
