"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { FLAGSHIP_SLUG, PLATFORM_NAME } from "@/lib/course";

const ATTRIBUTION =
  "Developed by: Centre of Excellence in Logistics & Supply Chain Management, Doon University under financial aid by UCOST, Government of Uttarakhand";

/** Public pages get the full product footer; app surfaces (dashboards, the
 *  course player) keep the compact institutional attribution line. */
function isPublic(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/courses") ||
    pathname.startsWith("/certificate") ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password"
  );
}

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Learn",
    links: [
      { href: `/courses/${FLAGSHIP_SLUG}`, label: "Course overview" },
      { href: `/courses/${FLAGSHIP_SLUG}#curriculum`, label: "Curriculum" },
      { href: "/#certificate", label: "Certificate" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/register", label: "Create account" },
    ],
  },
  {
    title: "Platform",
    links: [{ href: "/certificate/verify", label: "Verify a certificate" }],
  },
];

export function Footer() {
  const pathname = usePathname() ?? "/";

  if (!isPublic(pathname)) {
    return (
      <footer className="border-t border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <p className="text-center text-xs text-muted-foreground leading-relaxed">{ATTRIBUTION}</p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-border bg-card">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2.5 text-foreground">
            <span className="w-8 h-8 rounded-[10px] bg-violet-600 text-white flex items-center justify-center">
              <Sparkles className="w-4 h-4" aria-hidden />
            </span>
            <span className="font-semibold tracking-tight">{PLATFORM_NAME}</span>
          </Link>
          <p className="mt-4 text-[15px] font-medium text-foreground"> Demystifying AI for Everyone</p>
          <p className="mt-1 text-[14px] text-muted-foreground leading-relaxed max-w-xs">
            A self-paced course on artificial intelligence with Dr. Sudhanshu Joshi — ending in a
            verifiable certificate.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="text-[13px] font-semibold text-foreground">{col.title}</p>
            <ul className="mt-3 space-y-1">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="inline-flex items-center min-h-9 text-[14px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">{ATTRIBUTION}</p>
          <p className="text-xs text-muted-foreground shrink-0">
            © {new Date().getFullYear()} {PLATFORM_NAME}
          </p>
        </div>
      </div>
    </footer>
  );
}
