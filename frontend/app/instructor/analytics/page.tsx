"use client";

import { useEffect, useState } from "react";
import { Users, Target, Activity, CheckCircle2 } from "lucide-react";
import { InstructorSidebar } from "@/components/InstructorSidebar";
import { teacherAnalytics, type TeacherAnalytics as TeacherAnalyticsData } from "@/lib/api/analytics";

export default function TeacherAnalytics() {
  const [data, setData] = useState<TeacherAnalyticsData | undefined>(undefined);

  useEffect(() => {
    let active = true;
    teacherAnalytics()
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        /* leave loading state */
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen flex bg-background">
      <InstructorSidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Class Analytics</h1>
            <p className="text-muted-foreground mt-1">
              Performance, completion, and assessment trends for your classes.
            </p>
          </header>

          {!data ? (
            <Skeleton />
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <Stat icon={Users} label="Students" value={`${data.totalStudents}`} />
                <Stat
                  icon={CheckCircle2}
                  label="Completion rate"
                  value={`${data.completionRate}%`}
                />
                <Stat
                  icon={Activity}
                  label="Avg. score"
                  value={data.avgScorePct === null ? "—" : `${data.avgScorePct}%`}
                />
                <Stat icon={Target} label="Classes" value={`${data.classes.length}`} />
              </div>

              <Panel title="Class performance">
                <div className="space-y-4">
                  {data.classes.map((c) => (
                    <div key={c.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-foreground">{c.name}</span>
                        <span className="text-muted-foreground">
                          {c.students} students · {c.completionRate}% complete ·{" "}
                          {c.avgScorePct === null ? "—" : `${c.avgScorePct}%`} avg
                        </span>
                      </div>
                      <BarTrack pct={c.avgProgressPct} />
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Assessment trend (avg score by module)">
                <div className="flex items-end gap-2 h-40">
                  {data.moduleTrend.map((m) => (
                    <div
                      key={m.moduleId}
                      className="flex-1 flex flex-col items-center justify-end gap-1"
                    >
                      <span className="text-[10px] text-muted-foreground">
                        {m.avgScore === null ? "—" : `${m.avgScore}%`}
                      </span>
                      <div
                        className="w-full rounded-t bg-violet-600"
                        style={{ height: `${m.avgScore ?? 0}%` }}
                        title={`${m.attempts} attempts`}
                      />
                      <span className="text-[10px] text-muted-foreground">{m.label}</span>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Students">
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {data.roster.map((r) => (
                    <div key={r.name} className="py-2.5 flex items-center gap-3 text-sm">
                      <span className="flex-1 min-w-0 truncate text-foreground">{r.name}</span>
                      <span className="text-xs text-muted-foreground w-16">
                        Class {r.className}
                      </span>
                      <div className="w-28">
                        <BarTrack pct={r.progressPct} />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {r.avgScorePct === null ? "—" : `${r.avgScorePct}%`}
                      </span>
                      {r.complete ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <span className="w-4" />
                      )}
                    </div>
                  ))}
                </div>
              </Panel>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
      <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300 flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-foreground mt-3">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
      <h2 className="font-semibold text-foreground mb-4">{title}</h2>
      {children}
    </section>
  );
}

function BarTrack({ pct }: { pct: number }) {
  return (
    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
      <div className="h-full bg-violet-600" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
      ))}
    </div>
  );
}
