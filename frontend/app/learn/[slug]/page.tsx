"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PlayCircle, Award, ClipboardList, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLearning } from "@/context/LearningContext";
import { getPublicCourse, type CourseTree } from "@/lib/api/courses";

export default function LearnOverview() {
  const { slug } = useParams<{ slug: string }>();
  const { load, detail, completedLessons, overallProgress, certificateEligible } = useLearning();
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

  const resumeId = useMemo(() => {
    if (!tree) return null;
    const seq = tree.modules.flatMap((m) => m.lessons.map((l) => l.id));
    return detail?.nextLessonId ?? detail?.progress.lastVisitedLessonId ?? seq[0] ?? null;
  }, [tree, detail]);

  if (status === "loading")
    return <Wrap><div className="h-48 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" /></Wrap>;
  if (status === "error" || !tree)
    return <Wrap><Card><p className="font-medium text-foreground">Course unavailable</p><Link href="/courses" className="text-violet-600 underline text-sm">Back to catalog</Link></Card></Wrap>;

  return (
    <Wrap>
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">{tree.title}</h1>
        <p className="text-muted-foreground mt-1">{tree.shortDescription}</p>
      </header>

      <div className="bg-card rounded-2xl border border-gray-100 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Your progress</span>
          <span className="text-sm text-muted-foreground">{overallProgress}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div className="h-full bg-violet-600" style={{ width: `${overallProgress}%` }} />
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4">
          {resumeId && (
            <Link href={`/learn/${slug}/lesson/${resumeId}`}>
              <Button className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
                <PlayCircle className="w-4 h-4 mr-2" />
                {overallProgress > 0 ? "Resume" : "Start"} learning
              </Button>
            </Link>
          )}
          {certificateEligible && (
            <span className="inline-flex items-center gap-1.5 text-sm text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-500/20 px-3 py-1.5 rounded-xl">
              <Award className="w-4 h-4" /> Certificate eligible
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {tree.modules.map((m, i) => (
          <section key={m.id} className="bg-card rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
            <h2 className="font-semibold text-foreground mb-3">
              {i + 1}. {m.title}
            </h2>
            <ul className="space-y-1">
              {m.lessons.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/learn/${slug}/lesson/${l.id}`}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    {completedLessons.has(l.id) ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-muted-foreground/40" />
                    )}
                    <span className="text-foreground">{l.title}</span>
                    <span className="text-[10px] uppercase text-violet-500 ml-auto">
                      {l.contentType.replace("_", " ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {m.assessmentId && (
              <Link
                href={`/learn/${slug}/assessment/${m.assessmentId}`}
                className="inline-flex items-center gap-1.5 mt-3 text-sm text-violet-600 hover:underline"
              >
                <ClipboardList className="w-4 h-4" /> Take module quiz
              </Link>
            )}
          </section>
        ))}
      </div>
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">{children}</div>
    </div>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-card p-10 text-center space-y-2">{children}</div>;
}
