"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ClipboardList, CheckCircle2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LearnSidebar } from "@/components/learn/LearnSidebar";
import { useApp } from "@/context/AppContext";
import { useLearning } from "@/context/LearningContext";
import { pad2 } from "@/lib/course";
import { getPublicCourse, type CourseTree } from "@/lib/api/courses";

export default function ModuleOverview() {
  const { slug, moduleId } = useParams<{ slug: string; moduleId: string }>();
  const { load, completedLessons, isUnlocked, detail } = useLearning();
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
    () => (tree ? tree.modules.flatMap((m) => m.lessons.map((l) => l.id)) : []),
    [tree],
  );
  const module = tree?.modules.find((m) => m.id === moduleId) ?? null;
  const moduleIndex = tree && module ? tree.modules.indexOf(module) : -1;
  const score = module?.assessmentId
    ? detail?.progress.assessmentScores.find((a) => a.assessmentId === module.assessmentId)
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
          ) : !module ? (
            <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-soft">
              <p className="font-medium text-foreground">Module not found</p>
            </div>
          ) : (
            <>
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-violet-600">
                Module {pad2(moduleIndex + 1)} of {tree?.modules.length}
              </p>
              <h1 className="mt-1.5 text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-2">{module.title}</h1>
              {module.description && <p className="text-[16px] text-muted-foreground leading-relaxed mb-6 max-w-2xl">{module.description}</p>}
              <div className="bg-card rounded-3xl border border-border shadow-soft divide-y divide-border overflow-hidden">
                {module.lessons.map((l) => {
                  const unlocked = !isStudent || isUnlocked(sequence, l.id);
                  return (
                    <div key={l.id} className="flex items-center gap-3 px-5 py-4">
                      {completedLessons.has(l.id) ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <span className="w-4 h-4 rounded-full border border-muted-foreground/40" />
                      )}
                      <span className="text-sm text-foreground flex-1 truncate">{l.title}</span>
                      {unlocked ? (
                        <Link href={`/learn/${slug}/lesson/${l.id}`}>
                          <Button size="sm" variant="outline" className="rounded-lg h-8">
                            <PlayCircle className="w-4 h-4 mr-1" /> Open
                          </Button>
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground" title="Complete the previous lesson to unlock">Locked</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {module.assessmentId && (
                <Link href={`/learn/${slug}/assessment/${module.assessmentId}`}>
                  <Button className="rounded-full h-11 px-5 mt-5 bg-violet-600 hover:bg-violet-700 text-white">
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
