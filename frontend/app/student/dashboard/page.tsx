"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Award,
  Clock,
  PlayCircle,
  CheckCircle2,
  Layers,
  ClipboardCheck,
  Target,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { StudentSidebar } from "@/components/StudentSidebar";
import { useApp } from "@/context/AppContext";
import { listMyProgress, type Progress } from "@/lib/api/progress";
import { listPublicCourses, getPublicCourse, type Course, type CourseTree } from "@/lib/api/courses";
import { myCertificates, type Certificate } from "@/lib/api/certificates";
import { FLAGSHIP_SLUG, pad2 } from "@/lib/course";
import { formatDuration } from "@/lib/progress";

// Student dashboard — built around the platform's flagship course.
// Data: the progress, course and certificate APIs (role-scoped to published
// content). Any other published course is listed compactly so nothing is hidden.
export default function StudentDashboard() {
  const { authUser } = useApp();
  const [tree, setTree] = useState<CourseTree | null>(null);
  const [others, setOthers] = useState<Course[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "empty">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, list, c] = await Promise.all([
          listMyProgress(),
          listPublicCourses({ pageSize: 100 }),
          myCertificates().catch(() => [] as Certificate[]),
        ]);
        const flagshipSlug = list.courses.some((x) => x.slug === FLAGSHIP_SLUG)
          ? FLAGSHIP_SLUG
          : list.courses[0]?.slug;
        if (!flagshipSlug) {
          if (!cancelled) setStatus("empty");
          return;
        }
        const t = await getPublicCourse(flagshipSlug, "outline");
        if (cancelled) return;
        setProgress(p);
        setCerts(c);
        setTree(t);
        setOthers(list.courses.filter((x) => x.id !== t.id));
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = authUser?.name?.split(/\s+/)[0];

  return (
    <div className="min-h-screen flex bg-background">
      <StudentSidebar />
      <main className="flex-1 min-w-0 pb-24 lg:pb-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10 animate-fade-up">
          <header className="mb-8">
            <h1 className="text-[2rem] md:text-[2.25rem] font-semibold text-foreground tracking-tight">
              {firstName ? `Welcome back, ${firstName}` : "Your learning"}
            </h1>
            <p className="text-muted-foreground mt-1.5">Pick up where you left off.</p>
          </header>

          {status === "loading" ? (
            <div className="space-y-4">
              <div className="skeleton h-64 rounded-3xl" />
              <div className="skeleton h-28 rounded-3xl" />
            </div>
          ) : status === "error" ? (
            <Empty>We couldn&apos;t load your course. Please refresh.</Empty>
          ) : status === "empty" || !tree ? (
            <Empty>The course isn&apos;t published yet. Check back soon.</Empty>
          ) : (
            <CourseHome
              tree={tree}
              progress={progress.find((p) => p.courseId === tree.id)}
              certificate={certs.find((c) => c.courseId === tree.id && c.status === "active")}
            />
          )}

          {others.length > 0 && (
            <section className="mt-12">
              <h2 className="text-[15px] font-semibold text-foreground mb-3">Also available</h2>
              <ul className="rounded-3xl border border-border bg-card shadow-soft divide-y divide-border overflow-hidden">
                {others.map((c) => (
                  <li key={c.id}>
                    <Link href={`/learn/${c.slug}`} className="flex items-center gap-3 px-5 py-4 hover:bg-secondary/60 transition-colors">
                      <span className="flex-1 min-w-0 truncate text-[14px] text-foreground">{c.title}</span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

function CourseHome({
  tree,
  progress,
  certificate,
}: {
  tree: CourseTree;
  progress?: Progress;
  certificate?: Certificate;
}) {
  const sequence = useMemo(() => tree.modules.flatMap((module, moduleIndex) => module.lessons.flatMap((lesson) => lesson.topics.map((topic) => ({ ...topic, moduleIndex, lessonTitle: lesson.title })))), [tree]);
  const completed = new Set(progress?.completedTopics ?? []);
  const doneModules = new Set(progress?.completedModules ?? []);
  const scores = new Map((progress?.assessmentScores ?? []).map((a) => [a.assessmentId, a]));
  const assessmentModules = tree.modules.filter((m) => m.assessmentId);
  const passed = assessmentModules.filter((m) => scores.get(m.assessmentId!)?.passed).length;
  const attemptedScores = [...scores.values()].map((s) => s.score);
  const avgScore = attemptedScores.length ? Math.round(attemptedScores.reduce((a, b) => a + b, 0) / attemptedScores.length) : null;
  const pct = progress?.overallProgress ?? 0;

  // Current topic: first incomplete topic in sequence (sequential unlocking).
  const next = sequence.find((topic) => !completed.has(topic.id));
  const started = completed.size > 0;
  const allTopicsDone = sequence.length > 0 && !next;
  const pendingAssessment = assessmentModules.find((m) => !scores.get(m.assessmentId!)?.passed);

  const cta = next
    ? { href: `/learn/${tree.slug}/topic/${next.id}`, label: started ? "Continue learning" : "Start the course" }
    : pendingAssessment
      ? { href: `/learn/${tree.slug}/assessment/${pendingAssessment.assessmentId}`, label: "Take the next assessment" }
      : { href: `/learn/${tree.slug}`, label: "Review the course" };

  const stats = [
    { icon: Layers, label: "Modules completed", value: `${doneModules.size}/${tree.modules.length}` },
    ...(assessmentModules.length
      ? [{ icon: ClipboardCheck, label: "Assessments passed", value: `${passed}/${assessmentModules.length}` }]
      : []),
    { icon: Target, label: "Avg. assessment score", value: avgScore === null ? "—" : `${avgScore}%` },
    { icon: Clock, label: "Time spent", value: formatDuration((progress?.timeSpentMinutes ?? 0) * 60) },
  ];

  return (
    <>
      {/* Course hero card */}
      <section aria-labelledby="course-title" className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
        <div aria-hidden className="absolute inset-0 bg-grid opacity-60 pointer-events-none" />
        <div className="relative p-6 md:p-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-violet-600">Your course</p>
          <h2 id="course-title" className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            {tree.title}
          </h2>
          {tree.instructor && <p className="text-[14px] text-muted-foreground mt-1">with {tree.instructor}</p>}

          <div className="mt-6 flex items-center gap-3">
            <div
              className="h-2 flex-1 rounded-full bg-secondary overflow-hidden"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Course progress"
            >
              <div className="h-full rounded-full bg-violet-600 transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[15px] font-semibold text-foreground tabular-nums w-12 text-right">{pct}%</span>
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {completed.size} of {sequence.length} topics complete
          </p>

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <Link
              href={cta.href}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-[15px] font-medium shadow-sm transition-colors shrink-0"
            >
              <PlayCircle className="w-5 h-5" aria-hidden /> {cta.label}
            </Link>
            {next && (
              <p className="text-[14px] text-muted-foreground min-w-0">
                {started ? "Up next" : "First topic"}: {" "}
                <span className="text-foreground">
                  Module {pad2(next.moduleIndex + 1)} · {next.lessonTitle} · {next.title}
                </span>
              </p>
            )}
            {allTopicsDone && pendingAssessment && (
              <p className="text-[14px] text-muted-foreground">All topics complete — pass the remaining assessments to finish.</p>
            )}
          </div>
        </div>
      </section>

      {/* Stats */}
      <dl className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-card rounded-3xl border border-border p-5 shadow-soft">
            <s.icon className="w-[18px] h-[18px] text-violet-600" aria-hidden />
            <dt className="sr-only">{s.label}</dt>
            <dd className="text-[1.6rem] font-semibold text-foreground mt-3 tracking-tight tabular-nums">{s.value}</dd>
            <dd aria-hidden className="text-[13px] text-muted-foreground mt-0.5">{s.label}</dd>
          </div>
        ))}
      </dl>

      {/* Certificate status */}
      <section
        aria-label="Certificate status"
        className={`mt-4 rounded-3xl border p-6 flex flex-col sm:flex-row sm:items-center gap-4 ${
          certificate || progress?.certificateEligible ? "border-green-600/25 bg-green-600/[0.06]" : "border-border bg-card shadow-soft"
        }`}
      >
        <Award className={`w-7 h-7 shrink-0 ${certificate ? "text-green-600" : "text-violet-600"}`} aria-hidden />
        <div className="flex-1 text-[14px]">
          {certificate ? (
            <>
              <p className="font-semibold text-foreground">Certificate earned</p>
              <p className="text-muted-foreground">
                ID <span className="font-mono text-foreground">{certificate.certificateId}</span> · issued{" "}
                {new Date(certificate.issueDate).toLocaleDateString()}
              </p>
            </>
          ) : progress?.certificateEligible ? (
            <>
              <p className="font-semibold text-foreground">You&apos;re eligible for your certificate</p>
              <p className="text-muted-foreground">Open your Certificates page to claim and download it.</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-foreground">Certificate of Completion</p>
              <p className="text-muted-foreground">
                Complete all {sequence.length} topics
                {assessmentModules.length ? ` and pass all ${assessmentModules.length} module assessments` : ""} to earn it
                — it&apos;s issued automatically.
              </p>
            </>
          )}
        </div>
        {certificate ? (
          <div className="flex gap-2 shrink-0">
            <Link
              href={`/certificate/verify/${encodeURIComponent(certificate.certificateId)}`}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-border bg-card text-[14px] text-foreground hover:bg-secondary"
            >
              <ShieldCheck className="w-4 h-4 text-green-600" aria-hidden /> Verify
            </Link>
            <Link
              href="/student/certificates"
              className="inline-flex items-center h-10 px-4 rounded-full bg-green-600 hover:bg-green-700 text-white text-[14px] font-medium"
            >
              View
            </Link>
          </div>
        ) : progress?.certificateEligible ? (
          <Link
            href="/student/certificates"
            className="inline-flex items-center h-10 px-4 rounded-full bg-green-600 hover:bg-green-700 text-white text-[14px] font-medium shrink-0"
          >
            Certificates
          </Link>
        ) : null}
      </section>

      {/* Modules */}
      <section className="mt-10" aria-labelledby="modules-heading">
        <div className="flex items-center justify-between mb-3">
          <h2 id="modules-heading" className="text-lg font-semibold text-foreground tracking-tight">Modules</h2>
          <Link href={`/learn/${tree.slug}`} className="text-[13px] text-violet-600 hover:underline">
            Course overview
          </Link>
        </div>
        <ol className="rounded-3xl border border-border bg-card shadow-soft divide-y divide-border overflow-hidden">
          {tree.modules.map((m, i) => {
            const done = doneModules.has(m.id);
            const score = m.assessmentId ? scores.get(m.assessmentId) : undefined;
            return (
              <li key={m.id}>
                <Link
                  href={`/learn/${tree.slug}/module/${m.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-secondary/60 transition-colors"
                >
                  <span
                    className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold tabular-nums ${
                      done ? "bg-green-600/10 text-green-600" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {done ? <CheckCircle2 className="w-4 h-4" aria-label="Completed" /> : pad2(i + 1)}
                  </span>
                  <span className="text-[14px] text-foreground flex-1 min-w-0 truncate">{m.title}</span>
                  {score && (
                    <span
                      className={`shrink-0 text-[12px] font-medium rounded-full px-2.5 py-0.5 ${
                        score.passed ? "bg-green-600/10 text-green-700 dark:text-green-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {score.passed ? "Passed" : "Retake"} · {score.score}%
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-3xl border border-border p-10 text-center text-sm text-muted-foreground shadow-soft">
      {children}
    </div>
  );
}
