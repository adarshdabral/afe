"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  BookOpen,
  Award,
  ClipboardCheck,
  BarChart2,
  Settings,
  Sparkles,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { useApp } from "@/context/AppContext";

const links = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/teachers", label: "Teachers", icon: UserPlus },
  { to: "/admin/courses", label: "Courses", icon: BookOpen },
  { to: "/admin/certificates", label: "Certificates", icon: Award },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart2 },
] as const;

function initials(name?: string): string {
  if (!name) return "AD";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "AD";
}

export function AdminSidebar() {
  const pathname = usePathname();
  const { authUser, logout } = useApp();
  const [open, setOpen] = useState(false);

  const Body = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 h-16 flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-[10px] bg-violet-600 text-white flex items-center justify-center shadow-sm">
          <Sparkles className="w-4 h-4" />
        </span>
        <span className="font-semibold text-foreground tracking-tight">Admin</span>
      </div>
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {links.map((l, i) => {
          const active = pathname === l.to;
          const Icon = l.icon;
          return (
            <Link
              key={i}
              href={l.to}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[14px] transition-colors ${
                active
                  ? "bg-violet-600/10 text-violet-700 dark:text-violet-300 font-medium"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className={`w-[18px] h-[18px] ${active ? "text-violet-600" : ""}`} />
              <span>{l.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="m-3 rounded-2xl bg-secondary/60 p-2.5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center text-[13px] font-semibold shrink-0">
          {initials(authUser?.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-foreground truncate">
            {authUser?.name ?? "Administrator"}
          </div>
          <div className="text-[11px] text-muted-foreground">Platform admin</div>
        </div>
        <button
          onClick={logout}
          aria-label="Sign out"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-card hover:text-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-border bg-card">
        <Body />
      </aside>
      <button
        className="glass lg:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-xl border border-border flex items-center justify-center shadow-soft"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 animate-fade-in">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-card border-r border-border shadow-soft">
            <button
              className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              onClick={() => setOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
            <Body />
          </div>
        </div>
      )}
    </>
  );
}
