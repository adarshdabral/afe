import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, BookOpen, PlusCircle, Users, Bell, Settings, Sparkles, Menu, X } from "lucide-react";
import { useState } from "react";

const links = [
  { to: "/instructor/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/instructor/dashboard", label: "My Courses", icon: BookOpen },
  { to: "/instructor/create", label: "Create Course", icon: PlusCircle },
  { to: "/instructor/dashboard", label: "Students", icon: Users },
  { to: "/instructor/dashboard", label: "Announcements", icon: Bell },
  { to: "#", label: "Settings", icon: Settings },
] as const;

export function InstructorSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const SidebarBody = () => (
    <div className="flex flex-col h-full">
      <div className="px-6 h-16 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800">
        <span className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center">
          <Sparkles className="w-4 h-4" />
        </span>
        <span className="font-semibold text-foreground">Instructor</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map((l, i) => {
          const active = l.to !== "#" && pathname === l.to;
          const Icon = l.icon;
          return (
            <Link
              key={i}
              to={l.to}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors border-l-2 ${
                active
                  ? "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-600"
                  : "text-muted-foreground hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-foreground border-transparent"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{l.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-100 dark:border-gray-800 p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center text-sm font-semibold">
          PS
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">Dr. Priya Sharma</div>
          <span className="text-xs bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded">
            Instructor
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <SidebarBody />
      </aside>

      <button
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex items-center justify-center"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-900">
            <button
              className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => setOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarBody />
          </div>
        </div>
      )}
    </>
  );
}
