"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useOperator } from "@/lib/useOperator";
import { formatPhone } from "@/lib/phone";
import { User, Phone, ShieldCheck, Loader2, Save, KeyRound, Eye, EyeOff } from "lucide-react";

export default function ProfilePage() {
  const operator = useOperator();
  const toast = useToast();
  const router = useRouter();

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    if (operator?.name) setName(operator.name);
  }, [operator?.name]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error("Ism kamida 2 ta belgidan iborat bo'lishi kerak.");
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch("/api/profile/name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (data?.success) {
        toast.success("Ism saqlandi.");
        router.refresh();
      } else {
        toast.error("Saqlashda xatolik. Qayta urinib ko'ring.");
      }
    } catch {
      toast.error("Internet aloqasini tekshiring.");
    }
    setSavingName(false);
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Yangi parollar mos kelmadi.");
      return;
    }
    setSavingPw(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => null);
      if (data?.success) {
        toast.success("Parol muvaffaqiyatli o'zgartirildi.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else if (data?.reason === "wrong_current") {
        toast.error("Joriy parol noto'g'ri.");
      } else if (data?.reason === "weak") {
        toast.error("Yangi parol juda qisqa.");
      } else if (data?.reason === "same") {
        toast.error("Yangi parol eskisidan farq qilishi kerak.");
      } else {
        toast.error("Parolni o'zgartirishda xatolik.");
      }
    } catch {
      toast.error("Internet aloqasini tekshiring.");
    }
    setSavingPw(false);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mening profilim</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Shaxsiy ma'lumotlaringiz va parolingizni boshqaring
        </p>
      </div>

      {/* Identity summary */}
      <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/30 to-violet-500/20 border border-primary/30 flex items-center justify-center">
          <span className="text-xl font-black text-primary">
            {(operator?.name || "?").charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-foreground truncate">{operator?.name || "—"}</p>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" /> {operator ? formatPhone(operator.phone) : "—"}
            </span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              {operator?.role === "admin" ? "Admin" : "Operator"}
            </span>
          </div>
        </div>
      </div>

      {/* Edit profile */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Shaxsiy ma'lumotlar</h2>
        </div>
        <form onSubmit={saveName} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Ism va familiya</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="To'liq ism"
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Telefon raqam</Label>
            <Input
              value={operator ? formatPhone(operator.phone) : ""}
              disabled
              className="h-11 opacity-70"
            />
            <p className="text-xs text-muted-foreground">
              Telefon raqam kirish identifikatori — uni o'zgartirib bo'lmaydi.
            </p>
          </div>
          <Button type="submit" disabled={savingName} className="h-10">
            {savingName ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Saqlanmoqda...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" /> Saqlash
              </>
            )}
          </Button>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Parolni o'zgartirish</h2>
        </div>
        <form onSubmit={savePassword} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Joriy parol</Label>
            <Input
              type={showPw ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="h-11"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Yangi parol</Label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Kamida 6 ta belgi"
                  autoComplete="new-password"
                  className="h-11 pr-10"
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
              <Label>Yangi parolni tasdiqlang</Label>
              <Input
                type={showPw ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Qaytadan kiriting"
                autoComplete="new-password"
                className="h-11"
              />
            </div>
          </div>
          <Button type="submit" disabled={savingPw} className="h-10">
            {savingPw ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> O'zgartirilmoqda...
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4 mr-2" /> Parolni yangilash
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
