import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Activity,
  Clock,
  GraduationCap,
  Target,
  CheckCircle2,
  Circle,
  ClipboardCheck,
} from "lucide-react";
import { StudentSidebar } from "@/components/StudentSidebar";
import { useApp } from "@/context/AppContext";
import { buildCourseProgress, formatDuration } from "@/lib/progress";
import { syncMyProgressFn } from "@/lib/analytics/analytics.functions";

export const Route = createFileRoute("/student/progress")({
  head: () => ({ meta: [{ title: "My Progress — AI For Everyone" }] }),
  component: ProgressPage,
});

function ProgressPage() {
  const { completedLessons, timeSpent, assessmentScores } = useApp();
  const p = buildCourseProgress({ completedLessons, timeSpent, assessmentScores });

  // FR-12: push a progress snapshot so it surfaces in teacher/school/platform analytics.
  useEffect(() => {
    syncMyProgressFn({
      data: {
        lessonsCompleted: p.lessonsCompleted,
        lessonsTotal: p.lessonsTotal,
        modulesCompleted: p.modulesCompleted,
        modulesTotal: p.modulesTotal,
        assessmentsPassed: p.assessmentsPassed,
        avgScorePct: p.avgScorePct,
        totalTimeSec: p.totalTimeSec,
        moduleScores: Object.fromEntries(
          Object.entries(assessmentScores).map(([k, v]) => [k, v.scorePct]),
        ),
        certificateIssued: p.modulesCompleted === p.modulesTotal,
      },
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.lessonsCompleted, p.modulesCompleted, p.assessmentsPassed, p.totalTimeSec, p.avgScorePct]);

  const stats = [
    { icon: Target, label: "Overall", value: `${p.overallPct}%` },
    {
      icon: GraduationCap,
      label: "Modules complete",
      value: `${p.modulesCompleted}/${p.modulesTotal}`,
    },
    { icon: Clock, label: "Time spent", value: formatDuration(p.totalTimeSec) },
    {
      icon: Activity,
      label: "Avg. score",
      value: p.avgScorePct === null ? "—" : `${p.avgScorePct}%`,
    },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      <StudentSidebar />
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">My Progress</h1>
            <p className="text-muted-foreground mt-1">
              Track your module completion, time spent, and assessment results.
            </p>
          </header>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((s) => (
              <div
                key={s.label}
                className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5"
              >
                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300 flex items-center justify-center">
                  <s.icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold text-foreground mt-3">{s.value}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold text-foreground">Module breakdown</h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {p.modules.map((m) => (
                <div
                  key={m.module.id}
                  className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  <div className="flex items-center gap-3 sm:w-1/2 min-w-0">
                    {m.complete ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {m.module.order}. {m.module.title}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 w-28 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-violet-600"
                            style={{ width: `${m.lessonPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {m.lessonsDone}/{m.lessonsTotal} lessons
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground sm:w-28">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDuration(m.timeSpentSec)}
                  </div>

                  <div className="flex items-center gap-3 sm:ml-auto">
                    {m.assessment ? (
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          m.assessment.passed
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                        }`}
                      >
                        Assessment {m.assessment.scorePct}%
                      </span>
                    ) : (
                      <Link
                        to="/student/assessment/$moduleId"
                        params={{ moduleId: m.module.id }}
                        className="text-xs font-medium text-violet-600 hover:underline inline-flex items-center gap-1"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" /> Take assessment
                      </Link>
                    )}
                    <Link
                      to="/student/lesson/$lessonId"
                      params={{ lessonId: m.module.lessons[0].id }}
                      className="text-xs font-medium text-violet-600 hover:underline"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            {p.assessmentsPassed}/{p.modulesTotal} module assessments passed · time is counted only
            while a lesson is open and visible.
          </p>
        </div>
      </main>
    </div>
  );
}
