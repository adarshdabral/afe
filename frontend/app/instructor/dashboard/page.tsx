"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, CheckCircle2, Activity, ClipboardCheck, TrendingUp } from "lucide-react";
import { InstructorSidebar } from "@/components/InstructorSidebar";
import { teacherAnalytics, type TeacherAnalytics } from "@/lib/api/analytics";

// Teacher dashboard — student progress, completion rates, and assessment trends
// across the teacher's assigned students. Real analytics API, no mock data.
export default function InstructorDashboard() {
  const [data, setData] = useState<TeacherAnalytics | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    teacherAnalytics().then(setData).catch(() => setError(true));
  }, []);

  const stats = [
    { icon: Users, label: "Students", value: data?.totalStudents ?? "—" },
    { icon: CheckCircle2, label: "Completion", value: data ? `${data.completionRate}%` : "—" },
    { icon: Activity, label: "Avg. score", value: data?.avgScorePct == null ? "—" : `${data.avgScorePct}%` },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      <InstructorSidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <header className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Teaching overview</h1>
              <p className="text-muted-foreground mt-1">Progress across your students.</p>
            </div>
            <Link
              href="/instructor/approvals"
              className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:underline"
            >
              <ClipboardCheck className="w-4 h-4" /> Approvals
            </Link>
          </header>

          {error ? (
            <div className="bg-card rounded-2xl border border-gray-100 dark:border-gray-700 p-10 text-center text-sm text-muted-foreground">
              Couldn&apos;t load analytics.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-8">
                {stats.map((s) => (
                  <div key={s.label} className="bg-card rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
                    <s.icon className="w-5 h-5 text-violet-600" />
                    <p className="text-2xl font-bold text-foreground mt-2">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              <section className="bg-card rounded-2xl border border-gray-100 dark:border-gray-700 p-6 mb-6">
                <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Assessment trends
                </h2>
                {!data ? (
                  <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                ) : data.moduleTrend.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No assessment data yet.</p>
                ) : (
                  <div className="space-y-3">
                    {data.moduleTrend.map((m) => (
                      <div key={m.moduleId}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-foreground">{m.label}</span>
                          <span className="text-muted-foreground">
                            {m.avgScore == null ? "—" : `${m.avgScore}%`} · {m.attempts} attempts
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                          <div className="h-full bg-violet-600" style={{ width: `${m.avgScore ?? 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="bg-card rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
                <h2 className="font-semibold text-foreground mb-4">Student roster</h2>
                {!data ? (
                  <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                ) : data.roster.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No students yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-gray-100 dark:border-gray-700">
                          <th className="py-2 font-medium">Student</th>
                          <th className="py-2 font-medium">Class</th>
                          <th className="py-2 font-medium">Progress</th>
                          <th className="py-2 font-medium">Avg. score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.roster.map((r, i) => (
                          <tr key={i} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                            <td className="py-2 text-foreground">{r.name}</td>
                            <td className="py-2 text-muted-foreground">{r.className}</td>
                            <td className="py-2 text-muted-foreground">{r.progressPct}%</td>
                            <td className="py-2 text-muted-foreground">{r.avgScorePct == null ? "—" : `${r.avgScorePct}%`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
