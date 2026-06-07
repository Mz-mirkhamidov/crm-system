"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, UserCheck, ShoppingCart, Bell, LogOut, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { SESSION_COOKIE } from "@/lib/auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Lidlar", icon: Users },
  { href: "/clients", label: "Mijozlar", icon: UserCheck },
  { href: "/orders", label: "Zakazlar", icon: ShoppingCart },
  { href: "/follow-ups", label: "Follow-ups", icon: Bell },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-sidebar border-r border-border flex flex-col z-40">
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground tracking-wide">SELLORA</p>
            <p className="text-xs text-muted-foreground">CRM Plus</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150", isActive ? "bg-primary/15 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>
              <Icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-primary" : "")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t border-border">
        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 w-full">
          <LogOut className="w-4 h-4" />
          Chiqish
        </button>
      </div>
    </aside>
  );
}
