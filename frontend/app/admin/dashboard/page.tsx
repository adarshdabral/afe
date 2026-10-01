"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Users, BarChart2, Award, CheckCircle2, Building2 } from "lucide-react";
import { AdminSidebar } from "@/components/AdminSidebar";
import { platformAnalytics, type PlatformAnalytics } from "@/lib/api/analytics";

// Admin dashboard — real platform analytics + quick links. No mock data.
export default function AdminDashboard() {
  const [data, setData] = useState<PlatformAnalytics | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    platformAnalytics().then(setData).catch(() => setError(true));
  }, []);

  const stats = [
    { icon: Building2, label: "Schools", value: data?.totalSchools ?? "—" },
    { icon: Users, label: "Students", value: data?.totalStudents ?? "—" },
    { icon: Award, label: "Certificates", value: data?.certificatesIssued ?? "—" },
    { icon: CheckCircle2, label: "Completion", value: data ? `${data.completionRate}%` : "—" },
  ];
  const links = [
    { href: "/admin/courses", label: "Course CMS", icon: BookOpen, desc: "Create & publish courses" },
    { href: "/admin/teachers", label: "Teachers", icon: Users, desc: "Provision teacher accounts" },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart2, desc: "National adoption & outcomes" },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      <AdminSidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-10 animate-fade-up">
          <header className="mb-8">
            <h1 className="text-[2.25rem] font-semibold text-foreground tracking-tight">
              Platform overview
            </h1>
            <p className="text-muted-foreground mt-1.5">
              Manage content and staff, and monitor adoption.
            </p>
          </header>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            {stats.map((s) => (
              <div
                key={s.label}
                className="bg-card rounded-3xl border border-border p-5 shadow-soft elevate"
              >
                <div className="w-9 h-9 rounded-xl bg-violet-600/10 text-violet-600 flex items-center justify-center">
                  <s.icon className="w-[18px] h-[18px]" />
                </div>
                <p className="text-[1.75rem] font-semibold text-foreground mt-4 tracking-tight tabular-nums">
                  {error ? "—" : s.value}
                </p>
                <p className="text-[13px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="group bg-card rounded-3xl border border-border p-6 shadow-soft elevate"
              >
                <div className="w-11 h-11 rounded-2xl bg-violet-600/10 text-violet-600 flex items-center justify-center transition-colors group-hover:bg-violet-600 group-hover:text-white">
                  <l.icon className="w-5 h-5" />
                </div>
                <p className="font-semibold text-foreground mt-4">{l.label}</p>
                <p className="text-[13px] text-muted-foreground mt-0.5">{l.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
