"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ClipboardList, CheckCircle2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LearnSidebar } from "@/components/learn/LearnSidebar";
import { useLearning } from "@/context/LearningContext";
import { getPublicCourse, type CourseTree } from "@/lib/api/courses";

export default function ModuleOverview() {
  const { slug, moduleId } = useParams<{ slug: string; moduleId: string }>();
  const { load, completedLessons, isUnlocked } = useLearning();
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row gap-6">
        {tree && <LearnSidebar tree={tree} sequence={sequence} />}
        <main className="flex-1 min-w-0">
          <Link href={`/learn/${slug}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" /> Course overview
          </Link>
          {status === "loading" ? (
            <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ) : !module ? (
            <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-card p-10 text-center">
              <p className="font-medium text-foreground">Module not found</p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-foreground mb-1">{module.title}</h1>
              {module.description && <p className="text-sm text-muted-foreground mb-4">{module.description}</p>}
              <div className="bg-card rounded-2xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
                {module.lessons.map((l) => {
                  const unlocked = isUnlocked(sequence, l.id);
                  return (
                    <div key={l.id} className="flex items-center gap-3 p-3">
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
                        <span className="text-xs text-muted-foreground">Locked</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {module.assessmentId && (
                <Link href={`/learn/${slug}/assessment/${module.assessmentId}`}>
                  <Button className="rounded-xl mt-4 bg-violet-600 hover:bg-violet-700 text-white">
                    <ClipboardList className="w-4 h-4 mr-2" /> Take module quiz
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
