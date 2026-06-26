"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, UserCheck, ShoppingCart, Bell, LogOut, Zap, Search, User, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOperator } from "@/lib/useOperator";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Lidlar", icon: Users },
  { href: "/clients", label: "Mijozlar", icon: UserCheck },
  { href: "/orders", label: "Zakazlar", icon: ShoppingCart },
  { href: "/follow-ups", label: "Follow-ups", icon: Bell },
  { href: "/search", label: "Global qidiruv", icon: Search },
  { href: "/profile", label: "Profil", icon: User },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const operator = useOperator();
  const opName = operator?.name ?? "";
  const opRole = operator?.role ?? "";
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 h-14 z-50 flex items-center justify-between px-4 bg-sidebar border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-bold text-foreground tracking-wide">SELLORA</span>
        </div>
        <button onClick={() => setOpen(true)} aria-label="Menyu" className="p-2 rounded-lg hover:bg-secondary text-foreground">
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Overlay (mobile) */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar / drawer */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen w-60 bg-sidebar border-r border-border flex flex-col z-50 transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground tracking-wide">SELLORA</p>
                <p className="text-xs text-muted-foreground">CRM Plus</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="md:hidden p-1.5 rounded-lg hover:bg-secondary text-muted-foreground" aria-label="Yopish">
              <X className="w-4 h-4" />
            </button>
          </div>
          {opName && (
            <div className="mt-3 px-1">
              <p className="text-xs font-semibold text-foreground truncate">{opName}</p>
              <p className="text-xs text-muted-foreground">{opRole === "admin" ? "Admin" : "Operator"}</p>
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive ? "bg-primary/15 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>
                <Icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-primary" : "")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-border">
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all w-full">
            <LogOut className="w-4 h-4" /> Chiqish
          </button>
        </div>
      </aside>
    </>
  );
}
