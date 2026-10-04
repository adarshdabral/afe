"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ClipboardList, CheckCircle2, PlayCircle, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LearnSidebar } from "@/components/learn/LearnSidebar";
import { ModuleProgressSummary } from "@/components/learn/ModuleProgressSummary";
import { useApp } from "@/context/AppContext";
import { useLearning } from "@/context/LearningContext";
import { pad2 } from "@/lib/course";
import { getPublicCourse, type CourseTree } from "@/lib/api/courses";

export default function ModuleOverview() {
  const { slug, moduleId } = useParams<{ slug: string; moduleId: string }>();
  const { load, completedTopics, isUnlocked, detail } = useLearning();
  const isStudent = useApp().role === "student";
  const [tree, setTree] = useState<CourseTree | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  useEffect(() => {
    getPublicCourse(slug)
      .then(async (t) => {
        setTree(t);
        await load(t.id);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [slug, load]);

  const sequence = useMemo(
    () => (tree ? tree.modules.flatMap((m) => m.lessons.flatMap((lesson) => lesson.topics.map((topic) => topic.id))) : []),
    [tree],
  );
  const mod = tree?.modules.find((m) => m.id === moduleId) ?? null;
  const moduleIndex = tree && mod ? tree.modules.indexOf(mod) : -1;
  const score = mod?.assessmentId
    ? detail?.progress.assessmentScores.find((a) => a.assessmentId === mod.assessmentId)
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row gap-6">
        {tree && <LearnSidebar tree={tree} sequence={sequence} />}
        <main className="flex-1 min-w-0">
          <Link href={`/learn/${slug}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" /> Course overview
          </Link>
          {status === "loading" ? (
            <div className="skeleton h-40 rounded-3xl" />
          ) : !mod ? (
            <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-soft">
              <p className="font-medium text-foreground">Module not found</p>
            </div>
          ) : (
            <>
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-violet-600">
                Module {pad2(moduleIndex + 1)} of {tree?.modules.length}
              </p>
              <h1 className="mt-1.5 text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-2">{mod.title}</h1>
              <ModuleProgressSummary module={mod} className="mb-4" />
              {mod.description && <p className="text-[16px] text-muted-foreground leading-relaxed mb-6 max-w-2xl">{mod.description}</p>}
              {(mod.learningObjectives?.length ?? 0) > 0 && (
                <section aria-labelledby="objectives" className="mb-6 rounded-3xl border border-border bg-card shadow-soft p-5 md:p-6">
                  <h2 id="objectives" className="flex items-center gap-2 font-semibold text-foreground">
                    <Target className="w-4 h-4 text-violet-600" aria-hidden /> What you&apos;ll learn
                  </h2>
                  <p className="text-[13px] text-muted-foreground mt-0.5">By the end of this module, you will be able to:</p>
                  <ul className="mt-3 space-y-2">
                    {mod.learningObjectives.map((o, i) => (
                      <li key={i} className="flex gap-2.5 text-[15px] text-foreground leading-relaxed">
                        <CheckCircle2 className="w-4 h-4 text-violet-600 shrink-0 mt-1" aria-hidden />
                        {o}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <h2 className="font-semibold text-foreground mb-2">Learning content</h2>
              <div className="bg-card rounded-3xl border border-border shadow-soft divide-y divide-border overflow-hidden">
                {mod.lessons.map((lesson) => (
                  <section key={lesson.id} className="px-5 py-4">
                    <h3 className="font-medium text-foreground">{lesson.title}</h3>
                    {lesson.description && <p className="text-xs text-muted-foreground mt-1">{lesson.description}</p>}
                    <ul className="mt-2 divide-y divide-border">
                      {lesson.topics.map((topic) => {
                        const unlocked = !isStudent || isUnlocked(sequence, topic.id);
                        const done = completedTopics.has(topic.id);
                        return (
                          <li key={topic.id} className="flex items-center gap-3 py-3">
                            {done ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <span className="w-4 h-4 rounded-full border border-muted-foreground/40" />}
                            <span className="text-sm text-foreground flex-1 truncate">{topic.title}</span>
                            {unlocked ? (
                              <Link href={`/learn/${slug}/topic/${topic.id}`}>
                                <Button size="sm" variant="outline" className="rounded-lg h-8">
                                  <PlayCircle className="w-4 h-4 mr-1" /> Open
                                </Button>
                              </Link>
                            ) : <span className="text-xs text-muted-foreground" title="Complete the previous topic to unlock">Locked</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
              {mod.assessmentId && (
                <h2 className="font-semibold text-foreground mt-8">Module assessment</h2>
              )}
              {mod.assessmentId && (
                <p className="text-[13px] text-muted-foreground mt-0.5">One test covering this whole module.</p>
              )}
              {mod.assessmentId && (
                <Link href={`/learn/${slug}/assessment/${mod.assessmentId}`}>
                  <Button className="rounded-full h-11 px-5 mt-3 bg-violet-600 hover:bg-violet-700 text-white">
                    <ClipboardList className="w-4 h-4 mr-2" />
                    {score ? (score.passed ? `Assessment passed · ${score.score}%` : `Retake assessment · best ${score.score}%`) : "Take the module assessment"}
                  </Button>
                </Link>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
