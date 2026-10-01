"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Lock, CheckCircle2, ClipboardCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LearnSidebar } from "@/components/learn/LearnSidebar";
import { LessonRenderer } from "@/components/learn/LessonRenderer";
import { useApp } from "@/context/AppContext";
import { useLearning } from "@/context/LearningContext";
import { pad2 } from "@/lib/course";
import { useLessonTimer } from "@/hooks/use-lesson-timer";
import { getPublicCourse, type CourseTree, type Lesson } from "@/lib/api/courses";

export default function LessonPage() {
  const { slug, lessonId } = useParams<{ slug: string; lessonId: string }>();
  const router = useRouter();
  // Progress + sequential locking are student concepts; staff preview freely.
  const isStudent = useApp().role === "student";
  const { load, completedLessons, isUnlocked, markComplete, recordVisit, addMinutes } =
    useLearning();

  const [tree, setTree] = useState<CourseTree | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPublicCourse(slug)
      .then(async (t) => {
        setTree(t);
        await load(t.id);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [slug, load]);

  const { lesson, moduleTitle, moduleIndex, moduleId, assessmentId, isLastInModule, sequence, prevId, nextId } = useMemo(() => {
    if (!tree) return { lesson: null as Lesson | null, moduleTitle: "", moduleIndex: -1, moduleId: "", assessmentId: null as string | null, isLastInModule: false, sequence: [] as string[], prevId: null as string | null, nextId: null as string | null };
    const seq: string[] = [];
    for (const m of tree.modules) for (const l of m.lessons) seq.push(l.id);
    const owning = tree.modules.find((m) => m.lessons.some((l) => l.id === lessonId));
    const les = owning?.lessons.find((l) => l.id === lessonId) ?? null;
    const idx = seq.indexOf(lessonId);
    return {
      lesson: les,
      moduleTitle: owning?.title ?? "",
      moduleIndex: owning ? tree.modules.indexOf(owning) : -1,
      moduleId: owning?.id ?? "",
      assessmentId: owning?.assessmentId ?? null,
      isLastInModule: !!owning && owning.lessons[owning.lessons.length - 1]?.id === lessonId,
      sequence: seq,
      prevId: idx > 0 ? seq[idx - 1] : null,
      nextId: idx >= 0 && idx < seq.length - 1 ? seq[idx + 1] : null,
    };
  }, [tree, lessonId]);

  useEffect(() => {
    if (status === "ready" && lesson) void recordVisit(lesson.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, lesson?.id]);

  // Track active time on this lesson → persists to POST /progress/:id/time.
  useLessonTimer(status === "ready" && !!lesson, (minutes) => void addMinutes(minutes));

  if (status === "loading") return <Center><div className="h-64 w-full max-w-3xl bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" /></Center>;
  if (status === "error" || !tree) return <Center><Msg title="Course unavailable" href="/" cta="Back to home" /></Center>;
  if (!lesson) return <Center><Msg title="Lesson not found" href={`/learn/${slug}`} cta="Course overview" /></Center>;

  const locked = isStudent && !isUnlocked(sequence, lesson.id);
  const done = completedLessons.has(lesson.id);

  const completeAndContinue = async () => {
    if (!isStudent) {
      if (nextId) router.push(`/learn/${slug}/lesson/${nextId}`);
      return;
    }
    setSaving(true);
    try {
      const next = await markComplete(lesson.id);
      const assessmentPassed = next?.progress.assessmentScores.some(
        (a) => a.assessmentId === assessmentId && a.passed,
      );
      // Finished a module's lessons → hand off to its assessment (once, until passed).
      if (isLastInModule && assessmentId && !assessmentPassed && !done) {
        toast.success(`Module ${pad2(moduleIndex + 1)} lessons complete — time for the assessment.`);
        router.push(`/learn/${slug}/assessment/${assessmentId}`);
      } else if (nextId) router.push(`/learn/${slug}/lesson/${nextId}`);
      else toast.success("Course content complete! 🎉");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(msg ?? "Could not mark complete");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row gap-6">
        <LearnSidebar tree={tree} sequence={sequence} activeLessonId={lesson.id} />

        <main className="flex-1 min-w-0">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 flex-wrap">
            <Link href={`/learn/${slug}`} className="hover:text-foreground">{tree.title}</Link>
            <span aria-hidden>/</span>
            <Link href={`/learn/${slug}/module/${moduleId}`} className="hover:text-foreground">
              Module {pad2(moduleIndex + 1)} · {moduleTitle}
            </Link>
          </nav>

          <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] font-medium text-violet-600 bg-violet-600/10 rounded-full px-2.5 py-1">
            {lesson.contentType.replace("_", " ")}
          </span>
          <div className="flex items-center gap-2.5 mt-3 mb-6">
            <h1 className="text-3xl md:text-[2.5rem] md:leading-[1.1] font-semibold text-foreground tracking-tight">
              {lesson.title}
            </h1>
            {done && <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />}
          </div>

          {locked ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-500/10 p-8 text-center">
              <Lock className="w-8 h-8 text-amber-600 mx-auto mb-2" />
              <p className="font-medium text-foreground">This lesson is locked</p>
              <p className="text-sm text-muted-foreground mt-1">
                Complete the previous lesson to unlock it.
              </p>
              {prevId && (
                <Link href={`/learn/${slug}/lesson/${prevId}`}>
                  <Button variant="outline" className="rounded-xl mt-4">Go to previous lesson</Button>
                </Link>
              )}
            </div>
          ) : (
            <>
              {lesson.description && (
                <p className="text-lg text-muted-foreground mb-6 leading-relaxed max-w-[64ch]">
                  {lesson.description}
                </p>
              )}
              {/* Immersive reading surface — comfortable measure, generous air. */}
              <article className="bg-card rounded-3xl border border-border shadow-soft p-7 md:p-10 pb-32">
                <div className="max-w-[68ch] text-[1.02rem] leading-[1.75]">
                  <LessonRenderer lesson={lesson} />
                </div>
              </article>

              {isLastInModule && assessmentId && (done || !isStudent) && (
                <Link
                  href={`/learn/${slug}/assessment/${assessmentId}`}
                  className="mt-6 flex items-center gap-4 rounded-3xl border border-violet-600/25 bg-violet-600/[0.05] p-5 hover:bg-violet-600/[0.09] transition-colors"
                >
                  <span className="w-10 h-10 rounded-2xl bg-violet-600 text-white flex items-center justify-center shrink-0">
                    <ClipboardCheck className="w-5 h-5" aria-hidden />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-foreground">Module {pad2(moduleIndex + 1)} assessment</span>
                    <span className="block text-[13px] text-muted-foreground">Check your understanding of {moduleTitle}.</span>
                  </span>
                  <ArrowRight className="w-5 h-5 text-violet-600 shrink-0" aria-hidden />
                </Link>
              )}

              {/* Sticky frosted lesson navigation */}
              <div className="sticky bottom-4 mt-6 z-20">
                <div className="glass rounded-full border border-border shadow-soft px-2 py-2 flex items-center justify-between">
                  {prevId ? (
                    <Link href={`/learn/${slug}/lesson/${prevId}`}>
                      <Button variant="ghost" className="rounded-full h-10 px-4">
                        <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                      </Button>
                    </Link>
                  ) : (
                    <span className="px-2" />
                  )}
                  <Button
                    onClick={completeAndContinue}
                    disabled={saving || (!isStudent && !nextId)}
                    className="rounded-full h-10 px-6 bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
                  >
                    {!isStudent
                      ? nextId ? "Next lesson" : "End of course"
                      : done ? (nextId ? "Next lesson" : "Finish") : "Mark complete"}
                    {nextId && <ChevronRight className="w-4 h-4 ml-1" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-background px-4">{children}</div>;
}
function Msg({ title, href, cta }: { title: string; href: string; cta: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-card p-10 text-center">
      <p className="font-medium text-foreground">{title}</p>
      <Link href={href} className="text-violet-600 underline text-sm mt-2 inline-block">{cta}</Link>
    </div>
  );
}
