import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, BookOpen, Compass, Award, Settings, Sparkles } from "lucide-react";
import { useApp } from "@/context/AppContext";

const links = [
  { to: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/courses", label: "My Courses", icon: BookOpen },
  { to: "/courses", label: "Explore", icon: Compass },
  { to: "/student/certificates", label: "Certificates", icon: Award },
  { to: "#", label: "Settings", icon: Settings },
] as const;

export function StudentSidebar() {
  const { currentUser } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="px-6 h-16 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800">
          <span className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </span>
          <span className="font-semibold text-foreground">AI For Everyone</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {links.map((l, i) => {
            const active = l.to !== "#" && pathname === l.to;
            const Icon = l.icon;
            return (
              <Link
                key={i}
                to={l.to}
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
            AS
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground truncate">{currentUser.name}</div>
            <span className="text-xs bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded">
              Student
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex justify-around py-2">
        {links.map((l, i) => {
          const active = l.to !== "#" && pathname === l.to;
          const Icon = l.icon;
          return (
            <Link
              key={i}
              to={l.to}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs ${
                active ? "text-violet-600" : "text-muted-foreground"
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
