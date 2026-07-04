"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, GraduationCap, Award, Clock, Activity, PlayCircle } from "lucide-react";
import { StudentSidebar } from "@/components/StudentSidebar";
import { Button } from "@/components/ui/button";
import { listMyProgress, type Progress } from "@/lib/api/progress";
import { listPublicCourses, type Course } from "@/lib/api/courses";
import { formatDuration } from "@/lib/progress";

// Student dashboard — enrolled/started courses, completion, quiz scores, time,
// and certificate eligibility. All from the Mongo progress + course APIs.
export default function StudentDashboard() {
  const [progress, setProgress] = useState<Progress[] | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([listMyProgress(), listPublicCourses({ pageSize: 50 })])
      .then(([p, c]) => {
        setProgress(p);
        setCourses(c.courses);
      })
      .catch(() => setError(true));
  }, []);

  const courseById = new Map(courses.map((c) => [c.id, c]));
  const started = progress ?? [];
  const totalModules = started.reduce((s, p) => s + p.completedModules.length, 0);
  const totalMinutes = started.reduce((s, p) => s + p.timeSpentMinutes, 0);
  const certificates = started.filter((p) => p.certificateEligible).length;
  const quizScores = started.flatMap((p) => p.assessmentScores);
  const avgQuiz = quizScores.length
    ? Math.round(quizScores.reduce((s, a) => s + a.score, 0) / quizScores.length)
    : null;

  const stats = [
    { icon: BookOpen, label: "Courses started", value: started.length },
    { icon: GraduationCap, label: "Modules completed", value: totalModules },
    { icon: Activity, label: "Avg. quiz score", value: avgQuiz === null ? "—" : `${avgQuiz}%` },
    { icon: Clock, label: "Time spent", value: formatDuration(totalMinutes * 60) },
    { icon: Award, label: "Certificates", value: certificates },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      <StudentSidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-10 animate-fade-up">
          <header className="mb-8">
            <h1 className="text-[2.25rem] font-semibold text-foreground tracking-tight">
              Your learning
            </h1>
            <p className="text-muted-foreground mt-1.5">Track your progress at a glance.</p>
          </header>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-10">
            {stats.map((s) => (
              <div
                key={s.label}
                className="bg-card rounded-3xl border border-border p-5 shadow-soft elevate"
              >
                <div className="w-9 h-9 rounded-xl bg-violet-600/10 text-violet-600 flex items-center justify-center">
                  <s.icon className="w-[18px] h-[18px]" />
                </div>
                <p className="text-[1.75rem] font-semibold text-foreground mt-4 tracking-tight tabular-nums">
                  {s.value}
                </p>
                <p className="text-[13px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground tracking-tight">In progress</h2>
            <Link href="/courses" className="text-[13px] text-violet-600 hover:underline">
              Browse catalog
            </Link>
          </div>

          {error ? (
            <Empty>We couldn&apos;t load your progress. Please refresh.</Empty>
          ) : progress === null ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="skeleton h-[92px] rounded-3xl" />
              ))}
            </div>
          ) : started.length === 0 ? (
            <Empty>
              You haven&apos;t started the course yet.{" "}
              <Link href="/courses" className="text-violet-600 font-medium hover:underline">
                Start learning
              </Link>
              .
            </Empty>
          ) : (
            <div className="space-y-3">
              {started.map((p) => {
                const c = courseById.get(p.courseId);
                return (
                  <div
                    key={p.id}
                    className="bg-card rounded-3xl border border-border p-6 shadow-soft elevate"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {c?.title ?? "Course"}
                        </p>
                        <p className="text-[13px] text-muted-foreground mt-0.5">
                          {p.completedLessons.length} lessons · {p.completedModules.length} modules ·{" "}
                          {formatDuration(p.timeSpentMinutes * 60)}
                          {p.certificateEligible && " · certificate ready"}
                        </p>
                      </div>
                      {c && (
                        <Link href={`/learn/${c.slug}`}>
                          <Button
                            size="sm"
                            className="rounded-full h-9 px-4 bg-violet-600 hover:bg-violet-700 text-white shrink-0 shadow-sm"
                          >
                            <PlayCircle className="w-4 h-4 mr-1.5" /> Resume
                          </Button>
                        </Link>
                      )}
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-violet-600 transition-[width] duration-700 ease-out"
                          style={{ width: `${p.overallProgress}%` }}
                        />
                      </div>
                      <span className="text-[13px] font-medium text-foreground tabular-nums w-9 text-right">
                        {p.overallProgress}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl border border-gray-100 dark:border-gray-700 p-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
