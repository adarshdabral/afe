"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GraduationCap,
  Activity,
  MessageSquare,
  BookOpen,
  Award,
  Settings,
  Sparkles,
  LogOut,
} from "lucide-react";
import { useApp } from "@/context/AppContext";

const links = [
  { to: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/courses", label: "Courses", icon: BookOpen },
  { to: "/student/certificates", label: "Certificates", icon: Award },
  { to: "/student/forum", label: "Forum", icon: MessageSquare },
] as const;

function initials(name?: string): string {
  if (!name) return "AS";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "AS";
}

export function StudentSidebar() {
  const { authUser, logout } = useApp();
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-border bg-card">
        <div className="px-5 h-16 flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-[10px] bg-violet-600 text-white flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4" />
          </span>
          <span className="font-semibold text-foreground tracking-tight">AI For Everyone</span>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {links.map((l, i) => {
            const active = pathname === l.to;
            const Icon = l.icon;
            return (
              <Link
                key={i}
                href={l.to}
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
          <div className="w-9 h-9 rounded-full bg-violet-600 text-white flex items-center justify-center text-[13px] font-semibold shrink-0">
            {initials(authUser?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-foreground truncate">
              {authUser?.name ?? "Student"}
            </div>
            <div className="text-[11px] text-muted-foreground">Student</div>
          </div>
          <button
            onClick={logout}
            aria-label="Sign out"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-card hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="glass lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border flex justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {links.map((l, i) => {
          const active = pathname === l.to;
          const Icon = l.icon;
          return (
            <Link
              key={i}
              href={l.to}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] transition-colors ${
                active ? "text-violet-600 font-medium" : "text-muted-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{l.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
