"use client";

import { useEffect, useState } from "react";
import { Building2, Users, Award, CheckCircle2, Activity, Clock } from "lucide-react";
import { AdminSidebar } from "@/components/AdminSidebar";
import { useApp } from "@/context/AppContext";
import {
  platformAnalytics,
  schoolAnalytics,
  type PlatformAnalytics,
  type SchoolAnalytics,
} from "@/lib/api/analytics";
import { formatDuration } from "@/lib/progress";

export default function AdminAnalytics() {
  const { role } = useApp();
  const isPlatform = role === "platform_admin";

  return (
    <div className="min-h-screen flex bg-background">
      <AdminSidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          {isPlatform ? <PlatformView /> : <SchoolView />}
        </div>
      </main>
    </div>
  );
}

function PlatformView() {
  const [data, setData] = useState<PlatformAnalytics | undefined>(undefined);

  useEffect(() => {
    let active = true;
    platformAnalytics()
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
    <>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">National Analytics</h1>
        <p className="text-muted-foreground mt-1">Adoption and outcomes across all schools.</p>
      </header>
      {!data ? (
        <Skeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Stat icon={Building2} label="Schools" value={`${data.totalSchools}`} />
            <Stat icon={Users} label="Students" value={`${data.totalStudents}`} />
            <Stat icon={Award} label="Certificates" value={`${data.certificatesIssued}`} />
            <Stat icon={CheckCircle2} label="Completion rate" value={`${data.completionRate}%`} />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-8">
            <Stat
              icon={Activity}
              label="Avg. score"
              value={data.avgScorePct === null ? "—" : `${data.avgScorePct}%`}
            />
            <Stat icon={Clock} label="Learning hours" value={`${data.totalLearningHours}h`} />
          </div>
          <Panel title="Schools">
            <div className="space-y-4">
              {data.schools.map((s) => (
                <div key={s.schoolName}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-foreground">{s.schoolName}</span>
                    <span className="text-muted-foreground">
                      {s.students} students · {s.certificates} certs ·{" "}
                      {s.avgScorePct === null ? "—" : `${s.avgScorePct}%`} avg
                    </span>
                  </div>
                  <BarTrack pct={s.completionRate} />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {s.completionRate}% completion
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </>
  );
}

function SchoolView() {
  const [data, setData] = useState<SchoolAnalytics | undefined>(undefined);

  useEffect(() => {
    let active = true;
    schoolAnalytics()
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
    <>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">School Analytics</h1>
        <p className="text-muted-foreground mt-1">{data?.schoolName ?? "Your school"}</p>
      </header>
      {!data ? (
        <Skeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Stat icon={Users} label="Students" value={`${data.totalStudents}`} />
            <Stat icon={Activity} label="Participation" value={`${data.participationRate}%`} />
            <Stat icon={CheckCircle2} label="Completion rate" value={`${data.completionRate}%`} />
            <Stat icon={Clock} label="Avg. time" value={formatDuration(data.avgTimeSec)} />
          </div>
          <Panel title="Classes">
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
          <p className="text-xs text-muted-foreground">
            {data.certificatesIssued} certificates issued.
          </p>
        </>
      )}
    </>
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
