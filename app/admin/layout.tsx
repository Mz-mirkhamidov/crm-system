"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, LogOut, Zap, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Operator } from "@/lib/session";

const adminNav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/operators", label: "Operatorlar", icon: Users },
  { href: "/admin/all-leads", label: "Barcha lidlar", icon: Search },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Operator | null>(null);

  useEffect(() => {
    let active = true;
    // Identity comes from the server-verified session (`/api/auth/me` → `verifySession`),
    // never a client-decoded cookie. `proxy.ts` already gates this route; this is a
    // defense-in-depth client guard that redirects non-admins once the server responds.
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Operator | null) => {
        if (!active) return;
        setSession(data);
        if (!data || data.role !== "admin") router.push("/login");
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
    // Clear the HttpOnly session cookie on the server, then route to /login.
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed left-0 top-0 h-screen w-60 bg-sidebar border-r border-border flex flex-col z-40">
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">SELLORA</p>
              <p className="text-xs text-orange-400">Admin Panel</p>
            </div>
          </div>
          {session && (
            <div className="mt-3 px-1">
              <p className="text-xs font-semibold text-foreground">{session.name}</p>
              <p className="text-xs text-orange-400">Admin</p>
            </div>
          )}
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {adminNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}
                className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive ? "bg-orange-500/15 text-orange-400 border border-orange-500/20" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>
                <Icon className="w-4 h-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-border">
          <Link href="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-all mb-1">
            <LayoutDashboard className="w-4 h-4" /> Operator paneli
          </Link>
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all w-full">
            <LogOut className="w-4 h-4" /> Chiqish
          </button>
        </div>
      </aside>
      <main className="flex-1 ml-60 p-6 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
