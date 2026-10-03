"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  PlayCircle,
  BookOpen,
  Award,
  ClipboardCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  Eye,
  LayoutDashboard,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useLearning } from "@/context/LearningContext";
import { getPublicCourse, type CourseTree } from "@/lib/api/courses";
import { roleHome } from "@/lib/access";
import { pad2 } from "@/lib/course";
import { describeRemaining, remainingWork } from "@/lib/progress";

// The " Demystifying AI for Everyone learning experience" home: course header, progress,
// resume point, certificate status and the module map. Sequential locking and
// completion state come from LearningContext (server-backed progress API).
export default function LearnOverview() {
  const { slug } = useParams<{ slug: string }>();
  const { authUser } = useApp();
  const { load, detail, completedTopics, overallProgress, certificateEligible, isUnlocked } = useLearning();
  const [tree, setTree] = useState<CourseTree | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const isStudent = authUser?.role === "student";

  useEffect(() => {
    getPublicCourse(slug)
      .then(async (t) => {
        setTree(t);
        await load(t.id);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [slug, load]);

  const sequence = useMemo(() => (tree ? tree.modules.flatMap((module) => module.lessons.flatMap((lesson) => lesson.topics.map((topic) => topic.id))) : []), [tree]);
  const topicById = useMemo(() => {
    const map = new Map<string, { title: string; lessonTitle: string; moduleIndex: number }>();
    tree?.modules.forEach((module, moduleIndex) => module.lessons.forEach((lesson) => lesson.topics.forEach((topic) => map.set(topic.id, { title: topic.title, lessonTitle: lesson.title, moduleIndex }))));
    return map;
  }, [tree]);

  const resumeId = detail?.nextTopicId ?? detail?.progress.lastVisitedTopicId ?? sequence[0] ?? null;
  const resume = resumeId ? topicById.get(resumeId) : undefined;
  const scores = new Map((detail?.progress.assessmentScores ?? []).map((a) => [a.assessmentId, a]));
  const completedModules = new Set(detail?.progress.completedModules ?? []);
  const assessments = tree?.modules.filter((m) => m.assessmentId) ?? [];
  const passed = assessments.filter((m) => scores.get(m.assessmentId!)?.passed).length;
  // Students see what's LEFT; staff previewing the course see the totals.
  const work = remainingWork(
    tree?.modules ?? [],
    isStudent ? completedTopics : new Set(),
    new Set(isStudent ? [...scores.values()].filter((a) => a.passed).map((a) => a.assessmentId) : []),
  );
  const allTopicsDone = sequence.length > 0 && sequence.every((id) => completedTopics.has(id));

  if (status === "loading")
    return (
      <Wrap>
        <div className="skeleton h-56 rounded-3xl" />
        <div className="skeleton h-96 rounded-3xl mt-6" />
      </Wrap>
    );
  if (status === "error" || !tree)
    return (
      <Wrap>
        <div className="rounded-3xl border border-border bg-card p-12 text-center shadow-soft">
          <p className="font-semibold text-foreground">Course unavailable</p>
          <Link href="/" className="text-violet-600 hover:underline text-sm mt-2 inline-block">
            Back to home
          </Link>
        </div>
      </Wrap>
    );

  return (
    <Wrap>
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <Link href={`/courses/${tree.slug}`} className="text-[13px] text-muted-foreground hover:text-foreground">
          Course page
        </Link>
        {authUser && (
          <Link
            href={roleHome(authUser.role)}
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
          >
            <LayoutDashboard className="w-4 h-4" aria-hidden /> Dashboard
          </Link>
        )}
      </div>

      {/* Course header */}
      <header className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
        <div aria-hidden className="absolute inset-0 bg-grid opacity-70 pointer-events-none" />
        <div className="relative p-6 md:p-10">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-violet-600">
            {isStudent ? "Your learning" : "Course preview"}
          </p>
          <h1 className="mt-2 text-3xl md:text-5xl font-semibold tracking-tight text-foreground">{tree.title}</h1>
          {tree.instructor && <p className="mt-2 text-[15px] text-muted-foreground">with {tree.instructor}</p>}

          {isStudent ? (
            <>
              <div className="mt-8 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[13px] text-muted-foreground">Course progress</p>
                  <p className="text-4xl font-semibold tabular-nums tracking-tight text-foreground">{overallProgress}%</p>
                </div>
                <dl className="hidden sm:flex gap-8 text-right">
                  <Stat label="Topics" value={`${completedTopics.size}/${sequence.length}`} />
                  <Stat label="Modules" value={`${completedModules.size}/${tree.modules.length}`} />
                  {assessments.length > 0 && <Stat label="Assessments passed" value={`${passed}/${assessments.length}`} />}
                </dl>
              </div>
              <div
                className="mt-3 h-2 rounded-full bg-secondary overflow-hidden"
                role="progressbar"
                aria-valuenow={overallProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Course progress"
              >
                <div className="h-full rounded-full bg-violet-600 transition-[width] duration-700" style={{ width: `${overallProgress}%` }} />
              </div>
              <dl className="sm:hidden mt-4 grid grid-cols-3 gap-2">
                <Stat label="Topics" value={`${completedTopics.size}/${sequence.length}`} />
                <Stat label="Modules" value={`${completedModules.size}/${tree.modules.length}`} />
                {assessments.length > 0 && <Stat label="Passed" value={`${passed}/${assessments.length}`} />}
              </dl>

              <RemainingStats work={work} suffix="left" />

              <div className="mt-8 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                {resumeId && !allTopicsDone && (
                  <Link
                    href={`/learn/${slug}/topic/${resumeId}`}
                    className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-[15px] font-medium shadow-sm transition-colors"
                  >
                    <PlayCircle className="w-5 h-5" aria-hidden />
                    {completedTopics.size > 0 ? "Continue learning" : "Start the course"}
                  </Link>
                )}
                {resume && !allTopicsDone && (
                  <p className="text-[14px] text-muted-foreground min-w-0">
                    {completedTopics.size > 0 ? "Up next" : "First topic"}: {" "}
                    <span className="text-foreground">
                      Module {pad2(resume.moduleIndex + 1)} · {resume.lessonTitle} · {resume.title}
                    </span>
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
            <div className="mt-6 flex items-start gap-3 rounded-2xl bg-secondary/70 p-4 max-w-2xl">
              <Eye className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" aria-hidden />
              <p className="text-[14px] text-foreground leading-relaxed">
                You&apos;re viewing the course as {authUser?.role === "teacher" ? "a teacher" : "an administrator"}.
                Progress, sequential locking and certificates apply to student accounts only.
              </p>
            </div>
            <RemainingStats work={work} suffix="" />
            </>
          )}
        </div>

        {isStudent && <CertificateStatus eligible={certificateEligible} allTopicsDone={allTopicsDone} passed={passed} total={assessments.length} />}
      </header>

      {/* Module map */}
      <h2 className="mt-12 mb-4 text-xl font-semibold tracking-tight text-foreground">Modules</h2>
      <ol className="space-y-3">
        {tree.modules.map((m, i) => {
          const done = completedModules.has(m.id);
          const firstTopic = m.lessons[0]?.topics[0];
          const open = !isStudent || !firstTopic || isUnlocked(sequence, firstTopic.id);
          const topics = m.lessons.flatMap((lesson) => lesson.topics);
          const topicsDone = topics.filter((topic) => completedTopics.has(topic.id)).length;
          const score = m.assessmentId ? scores.get(m.assessmentId) : undefined;
          return (
            <li key={m.id} className={`rounded-3xl border bg-card p-5 md:p-6 shadow-soft ${done ? "border-green-600/30" : "border-border"}`}>
              <div className="flex items-start gap-4">
                <span
                  className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-semibold tabular-nums ${
                    done ? "bg-green-600/10 text-green-600" : open ? "bg-violet-600/10 text-violet-600" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {done ? <CheckCircle2 className="w-5 h-5" aria-label="Completed" /> : open ? pad2(i + 1) : <Lock className="w-4 h-4" aria-label="Locked" />}
                </span>
                <div className="flex-1 min-w-0">
                  <Link href={`/learn/${slug}/module/${m.id}`} className="font-semibold text-foreground hover:underline">
                    {m.title}
                  </Link>
                  {m.description && <p className="mt-1 text-[14px] text-muted-foreground leading-relaxed">{m.description}</p>}
                  <ul className="mt-3 space-y-3">
                    {m.lessons.map((lesson) => (
                      <li key={lesson.id}>
                        <p className="text-xs font-semibold text-muted-foreground">{lesson.title}</p>
                        <ul className="mt-1 space-y-0.5">
                          {lesson.topics.map((topic) => {
                            const topicDone = completedTopics.has(topic.id);
                            const unlocked = !isStudent || isUnlocked(sequence, topic.id);
                            const Icon = topicDone ? CheckCircle2 : unlocked ? PlayCircle : Lock;
                            const row = <span className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 -mx-2.5 text-[14px] ${unlocked ? "text-foreground hover:bg-secondary" : "text-muted-foreground"}`}>
                              <Icon className={`w-4 h-4 shrink-0 ${topicDone ? "text-green-600" : unlocked ? "text-violet-600" : ""}`} aria-hidden />
                              <span className="truncate">{topic.title}</span>
                            </span>;
                            return <li key={topic.id}>{unlocked ? <Link href={`/learn/${slug}/topic/${topic.id}`}>{row}</Link> : <div title="Complete the previous topic to unlock">{row}</div>}</li>;
                          })}
                        </ul>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
                    {isStudent && (
                      <span className="text-muted-foreground">
                        {topicsDone}/{topics.length} topics
                      </span>
                    )}
                    {m.assessmentId && (
                      <Link
                        href={`/learn/${slug}/assessment/${m.assessmentId}`}
                        className="inline-flex items-center gap-1.5 font-medium text-violet-600 hover:underline"
                      >
                        <ClipboardCheck className="w-4 h-4" aria-hidden />
                        {score ? (score.passed ? `Assessment passed · ${score.score}%` : `Retake assessment · best ${score.score}%`) : "Take the module assessment"}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Wrap>
  );
}

function CertificateStatus({
  eligible,
  allTopicsDone,
  passed,
  total,
}: {
  eligible: boolean;
  allTopicsDone: boolean;
  passed: number;
  total: number;
}) {
  return (
    <div className={`relative border-t px-6 md:px-10 py-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 ${eligible ? "border-green-600/20 bg-green-600/[0.06]" : "border-border bg-secondary/40"}`}>
      <Award className={`w-6 h-6 shrink-0 ${eligible ? "text-green-600" : "text-violet-600"}`} aria-hidden />
      <div className="flex-1 text-[14px]">
        {eligible ? (
          <>
            <p className="font-medium text-foreground">You&apos;ve completed the course — your certificate is ready.</p>
            <p className="text-muted-foreground">It has a unique ID and a QR code anyone can use to verify it.</p>
          </>
        ) : (
          <>
            <p className="font-medium text-foreground">Certificate of Completion</p>
            <p className="text-muted-foreground">
              {allTopicsDone
                ? `All topics complete. Pass the remaining ${total - passed} module ${total - passed === 1 ? "assessment" : "assessments"} to earn it.`
                : `Complete every topic${total ? ` and pass all ${total} module assessments` : ""} — it's issued automatically.`}
            </p>
          </>
        )}
      </div>
      {eligible && (
        <Link
          href="/student/certificates"
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-green-600 hover:bg-green-700 text-white text-[14px] font-medium shrink-0"
        >
          View certificate <ArrowRight className="w-4 h-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

/** "46 min of videos left · 1h 20m of readings left · 1 graded assessment left". */
function RemainingStats({ work, suffix }: { work: ReturnType<typeof remainingWork>; suffix: string }) {
  const items: { icon: typeof PlayCircle; text: string }[] = [];
  if (work.videos.count > 0) items.push({ icon: PlayCircle, text: describeRemaining("video", work.videos, suffix) });
  if (work.readings.count > 0) items.push({ icon: BookOpen, text: describeRemaining("reading", work.readings, suffix) });
  if (work.gradedAssessments > 0)
    items.push({
      icon: ClipboardCheck,
      text: `${work.gradedAssessments} graded ${work.gradedAssessments === 1 ? "assessment" : "assessments"}${suffix ? ` ${suffix}` : ""}`,
    });
  if (items.length === 0) return null;
  return (
    <ul className="mt-5 flex flex-col sm:flex-row sm:flex-wrap gap-x-6 gap-y-2" aria-label="Remaining in this course">
      {items.map((i) => (
        <li key={i.text} className="inline-flex items-center gap-2 text-[14px] text-foreground">
          <i.icon className="w-4 h-4 text-violet-600 shrink-0" aria-hidden />
          {i.text}
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="text-[17px] font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-10 animate-fade-up">{children}</div>
    </div>
  );
}
