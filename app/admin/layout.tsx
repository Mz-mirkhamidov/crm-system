"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Users, LogOut, Zap, Search, User, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Operator } from "@/lib/session";
import { ToastProvider } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";

const adminNav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/operators", label: "Operatorlar", icon: Users },
  { href: "/admin/all-leads", label: "Barcha lidlar", icon: Search },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Operator | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Operator | null) => {
        if (!active) return;
        setSession(data);
        if (!data) { router.push("/login"); return; }
        if (data.mustChangePassword) { router.push("/set-password"); return; }
        if (data.role !== "admin") router.push("/login");
      })
      .catch(() => {
        if (!active) return;
        router.push("/login");
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background">
        {/* Mobile top bar */}
        <header className="md:hidden fixed top-0 inset-x-0 h-14 z-50 flex items-center justify-between px-4 bg-sidebar border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-orange-400" />
            </div>
            <span className="text-sm font-bold text-foreground">SELLORA <span className="text-orange-400">Admin</span></span>
          </div>
          <button onClick={() => setOpen(true)} aria-label="Menyu" className="p-2 rounded-lg hover:bg-secondary text-foreground">
            <Menu className="w-5 h-5" />
          </button>
        </header>

        {open && (
          <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
        )}

        <aside
          className={cn(
            "fixed left-0 top-0 h-screen w-60 bg-sidebar border-r border-border flex flex-col z-50 transition-transform duration-300",
            open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          <div className="px-6 py-5 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">SELLORA</p>
                  <p className="text-xs text-orange-400">Admin Panel</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="md:hidden p-1.5 rounded-lg hover:bg-secondary text-muted-foreground" aria-label="Yopish">
                <X className="w-4 h-4" />
              </button>
            </div>
            {session && (
              <div className="mt-3 px-1">
                <p className="text-xs font-semibold text-foreground">{session.name}</p>
                <p className="text-xs text-orange-400">Admin</p>
              </div>
            )}
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {adminNav.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                  className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    isActive ? "bg-orange-500/15 text-orange-400 border border-orange-500/20" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>
                  <Icon className="w-4 h-4" /> {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="px-3 py-4 border-t border-border">
            <Link href="/profile" onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-all mb-1">
              <User className="w-4 h-4" /> Profil
            </Link>
            <Link href="/dashboard" onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-all mb-1">
              <LayoutDashboard className="w-4 h-4" /> Operator paneli
            </Link>
            <button onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all w-full">
              <LogOut className="w-4 h-4" /> Chiqish
            </button>
          </div>
        </aside>

        <main className="md:ml-60 min-h-screen pt-14 md:pt-0">
          <div className="p-4 sm:p-6 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
      <Toaster />
    </ToastProvider>
  );
}
