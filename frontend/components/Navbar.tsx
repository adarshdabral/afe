"use client";

import Link from "next/link";
import { Sparkles, Sun, Moon, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { roleHome } from "@/lib/access";
import { FLAGSHIP_SLUG, PLATFORM_NAME } from "@/lib/course";
import { useCourseCta } from "@/components/course-landing/CourseCta";

// Public navigation for the single-course product. Signed-in users get a link to
// their own role home (never another role's surface) instead of "Sign in".
const NAV = [
  { href: `/courses/${FLAGSHIP_SLUG}`, label: "Course" },
  { href: "/#curriculum", label: "Curriculum" },
  { href: "/#instructor", label: "Instructor" },
  { href: "/#certificate", label: "Certificate" },
];

export function Navbar() {
  const { darkMode, toggleDarkMode, authUser, loadingUser } = useApp();
  const cta = useCourseCta(FLAGSHIP_SLUG);
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const account = authUser
    ? { href: roleHome(authUser.role), label: "My dashboard" }
    : { href: "/login", label: "Sign in" };

  return (
    <header
      className={`glass sticky top-0 z-40 w-full transition-colors duration-300 ${
        scrolled || open ? "border-b border-border/70" : "border-b border-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 text-foreground min-w-0" aria-label={`${PLATFORM_NAME} —  Demystifying AI for Everyone home`}>
          <span className="w-8 h-8 rounded-[10px] bg-violet-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <Sparkles className="w-4 h-4" aria-hidden />
          </span>
          <span className="font-semibold tracking-tight text-[15px]">{PLATFORM_NAME}</span>
          <span className="hidden sm:inline h-4 w-px bg-border" aria-hidden />
          <span className="hidden sm:inline text-[14px] text-muted-foreground truncate"> Demystifying AI for Everyone</span>
        </Link>

        <nav aria-label="Main" className="hidden lg:flex items-center gap-7">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-[14px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={toggleDarkMode}
            className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
          {!loadingUser && (
            <>
              <Link
                href={account.href}
                className="hidden sm:inline-flex items-center h-10 px-4 rounded-full text-[14px] text-foreground hover:bg-secondary transition-colors"
              >
                {account.label}
              </Link>
              <Link
                href={cta.href}
                className="hidden sm:inline-flex items-center h-10 px-5 rounded-full text-[14px] font-medium bg-violet-600 hover:bg-violet-700 text-white shadow-sm transition-colors"
              >
                {cta.label}
              </Link>
            </>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            className="lg:hidden w-10 h-10 rounded-full flex items-center justify-center text-foreground hover:bg-secondary transition-colors"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Main" className="lg:hidden border-t border-border/70 px-4 sm:px-6 pb-5 pt-2">
          <ul className="max-w-6xl mx-auto">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center h-12 text-[16px] text-foreground border-b border-border/60"
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="max-w-6xl mx-auto mt-4 grid grid-cols-2 gap-2 sm:hidden">
            <Link
              href={account.href}
              className="inline-flex items-center justify-center h-12 rounded-full border border-border bg-card text-[15px] text-foreground"
            >
              {account.label}
            </Link>
            <Link
              href={cta.href}
              className="inline-flex items-center justify-center h-12 rounded-full bg-violet-600 text-white text-[15px] font-medium"
            >
              {cta.label}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
