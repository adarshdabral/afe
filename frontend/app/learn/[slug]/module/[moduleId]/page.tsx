"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ClipboardList, CheckCircle2, Lock, MessagesSquare, NotebookPen, PlayCircle, Target, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LearnSidebar } from "@/components/learn/LearnSidebar";
import { ModuleProgressSummary } from "@/components/learn/ModuleProgressSummary";
import { useApp } from "@/context/AppContext";
import { useLearning } from "@/context/LearningContext";
import { pad2 } from "@/lib/course";
import { learnSequence, moduleLock, orderedLessonRows } from "@/lib/learn";
import { useLearnCourse } from "@/hooks/use-learn-course";

export default function ModuleOverview() {
  const { slug, moduleId } = useParams<{ slug: string; moduleId: string }>();
  const { completedTopics, isUnlocked, detail, done } = useLearning();
  const isStudent = useApp().role === "student";
  const { tree, status } = useLearnCourse(slug);

  const sequence = useMemo(() => (tree ? learnSequence(tree) : []), [tree]);
  const mod = tree?.modules.find((m) => m.id === moduleId) ?? null;
  const moduleIndex = tree && mod ? tree.modules.indexOf(mod) : -1;
  const lock = tree && mod ? moduleLock(tree, sequence, done, mod) : null;
  const locked = isStudent && !!lock && !lock.unlocked;
  const score = mod?.assessmentId
    ? detail?.progress.assessmentScores.find((a) => a.assessmentId === mod.assessmentId)
    : undefined;
  const assessmentOpen = !!mod?.assessmentId && (!isStudent || isUnlocked(sequence, mod.assessmentId, mod.id));

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
              {locked && (
                <div className="mb-6 flex items-start gap-3 rounded-3xl border border-amber-500/30 bg-amber-500/[0.06] p-5">
                  <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
                  <div>
                    <p className="font-medium text-foreground">This module is locked</p>
                    <p className="text-[14px] text-muted-foreground mt-0.5">
                      Complete Module {lock?.blockedBy ?? moduleIndex} — its lessons, assignments and graded assessment — to unlock it.
                    </p>
                  </div>
                </div>
              )}
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
                      {orderedLessonRows(lesson).map((row) => {
                        if (row.kind === "topic") {
                          const topic = row.topic;
                          const unlocked = !isStudent || isUnlocked(sequence, topic.id);
                          const topicDone = completedTopics.has(topic.id);
                          return (
                            <li key={topic.id} className="flex items-center gap-3 py-3">
                              {topicDone ? (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                              ) : topic.contentType === "discussion" ? (
                                <MessagesSquare className="w-4 h-4 text-muted-foreground" aria-label="Discussion" />
                              ) : (
                                <span className="w-4 h-4 rounded-full border border-muted-foreground/40" />
                              )}
                              <span className="text-sm text-foreground flex-1 truncate">{topic.title}</span>
                              {unlocked ? (
                                <Link href={`/learn/${slug}/topic/${topic.id}`}>
                                  <Button size="sm" variant="outline" className="rounded-lg h-8">
                                    <PlayCircle className="w-4 h-4 mr-1" /> Open
                                  </Button>
                                </Link>
                              ) : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Complete the previous item to unlock"><Lock className="w-3.5 h-3.5" /> Locked</span>}
                            </li>
                          );
                        }
                        const a = row.assignment;
                        const aDone = done.has(a.id);
                        const unlocked = !isStudent || isUnlocked(sequence, a.id, mod.id);
                        return (
                          <li key={a.id} className="flex items-center gap-3 py-3">
                            {aDone ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <NotebookPen className="w-4 h-4 text-violet-600" aria-hidden />}
                            <span className="text-sm text-foreground flex-1 min-w-0">
                              <span className="block truncate">Assignment: {a.title}</span>
                              <span className="block text-[12px] text-muted-foreground">
                                {a.isGraded ? "Graded" : "Not graded"}
                                {a.isRequired ? " · required to finish the lesson" : " · optional"}
                                {a.timeLimitMinutes > 0 && <> · <Timer className="inline w-3 h-3 -mt-0.5" /> {a.timeLimitMinutes} min</>}
                              </span>
                            </span>
                            {unlocked ? (
                              <Link href={`/learn/${slug}/assessment/${a.id}`}>
                                <Button size="sm" variant="outline" className="rounded-lg h-8">
                                  {aDone ? "Review" : "Open"}
                                </Button>
                              </Link>
                            ) : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Complete the previous item to unlock"><Lock className="w-3.5 h-3.5" /> Locked</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
              {mod.assessmentId && (
                <>
                  <h2 className="font-semibold text-foreground mt-8">Module assessment</h2>
                  <p className="text-[13px] text-muted-foreground mt-0.5">
                    One graded test covering this whole module
                    {mod.assessmentTimeLimitMinutes > 0 ? ` · timed: ${mod.assessmentTimeLimitMinutes} min` : ""}. Passing it completes the module
                    {tree && moduleIndex < tree.modules.length - 1 ? " and unlocks the next one" : ""}.
                  </p>
                  {assessmentOpen ? (
                    <Link href={`/learn/${slug}/assessment/${mod.assessmentId}`}>
                      <Button className="rounded-full h-11 px-5 mt-3 bg-violet-600 hover:bg-violet-700 text-white">
                        <ClipboardList className="w-4 h-4 mr-2" />
                        {score ? (score.passed ? `Assessment passed · ${score.score}%` : `Retake assessment · best ${score.score}%`) : "Take the module assessment"}
                      </Button>
                    </Link>
                  ) : (
                    <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-[13px] text-muted-foreground">
                      <Lock className="w-4 h-4" aria-hidden /> Complete every lesson and required assignment above to unlock it
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
