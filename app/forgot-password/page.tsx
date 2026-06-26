"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Phone, KeyRound, CheckCircle2, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.rpc("app_request_password_reset", { p_phone: phone.trim() });
    } catch {
      // Always show the same generic result (don't reveal whether the phone exists).
    }
    setLoading(false);
    setDone(true);
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
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Parolni tiklash</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Telefon raqamingizni kiriting — so'rovingiz adminga yuboriladi.
          </p>
        </div>

        <div
          className="bg-card/60 backdrop-blur-2xl border border-primary/10 rounded-2xl p-7 shadow-2xl"
          style={{ boxShadow: "0 0 40px hsl(262 83% 62% / 0.08), 0 20px 40px rgba(0,0,0,0.4)" }}
        >
          {done ? (
            <div className="text-center py-2">
              <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="text-sm text-foreground font-medium mb-1">So'rovingiz qabul qilindi</p>
              <p className="text-xs text-muted-foreground mb-5">
                Agar bu raqam tizimda bo'lsa, admin parolingizni tiklab beradi va sizga
                vaqtinchalik parol beradi. Keyin o'z parolingizni o'rnatasiz.
              </p>
              <Link href="/login">
                <Button variant="outline" className="w-full gap-2">
                  <ArrowLeft className="w-4 h-4" /> Loginga qaytish
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                    className="bg-background/50 border-primary/20 focus:border-primary/60 h-11 pl-9"
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading}
                className="w-full h-11 font-bold text-sm bg-primary hover:bg-primary/90"
                style={{ boxShadow: "0 0 20px hsl(262 83% 62% / 0.3)" }}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Yuborilmoqda...</> : "So'rov yuborish"}
              </Button>
              <div className="text-center pt-1">
                <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground">
                  Loginga qaytish
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
