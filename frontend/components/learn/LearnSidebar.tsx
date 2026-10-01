"use client";

import Link from "next/link";
import { CheckCircle2, Circle, Lock, ClipboardList, ClipboardCheck } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useLearning } from "@/context/LearningContext";
import type { CourseTree } from "@/lib/api/courses";
import { pad2 } from "@/lib/course";

// Left sidebar: modules → lessons with completion state and sequential locking.
// `sequence` is the flat ordered lessonId list used to decide unlock state.
export function LearnSidebar({
  tree,
  sequence,
  activeLessonId,
}: {
  tree: CourseTree;
  sequence: string[];
  activeLessonId?: string;
}) {
  const { completedLessons, isUnlocked, detail } = useLearning();
  // Sequential locking applies to students; teachers/admins preview freely.
  const isStudent = useApp().role === "student";
  const completedModules = new Set(detail?.progress.completedModules ?? []);

  const total = sequence.length;
  const done = completedLessons.size;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <aside className="w-full lg:w-72 shrink-0">
      <div className="rounded-3xl border border-border bg-card shadow-soft p-3.5 lg:sticky lg:top-6">
        <Link href={`/learn/${tree.slug}`} className="block px-2 pt-1 group">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-violet-600">
            Course
          </span>
          <span className="block text-[15px] font-semibold text-foreground truncate tracking-tight group-hover:underline">
            {tree.title}
          </span>
          {tree.instructor && (
            <span className="block text-[12px] text-muted-foreground truncate">with {tree.instructor}</span>
          )}
        </Link>
        {/* Overall progress */}
        {isStudent && (
        <div className="px-2 mt-3 mb-3">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
            <span>
              {done} of {total} lessons
            </span>
            <span className="tabular-nums font-medium text-foreground">{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-violet-600 transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        )}
        <div className="space-y-3 max-h-[calc(100vh-13rem)] overflow-y-auto pr-0.5">
          {tree.modules.map((m, mi) => (
            <div key={m.id}>
              <Link
                href={`/learn/${tree.slug}/module/${m.id}`}
                className="flex items-center gap-1.5 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.05em] hover:text-foreground"
              >
                {completedModules.has(m.id) ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" aria-label="Module completed" />
                ) : (
                  <span className="tabular-nums text-violet-600">{pad2(mi + 1)}</span>
                )}
                <span className="truncate">{m.title}</span>
              </Link>
              <ul className="mt-1 space-y-0.5">
                {m.lessons.map((l) => {
                  const doneLesson = completedLessons.has(l.id);
                  const unlocked = !isStudent || isUnlocked(sequence, l.id);
                  const active = l.id === activeLessonId;
                  const Icon = doneLesson ? CheckCircle2 : unlocked ? Circle : Lock;
                  const content = (
                    <span
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] transition-colors ${
                        active
                          ? "bg-violet-600/10 text-violet-700 dark:text-violet-300 font-medium"
                          : unlocked
                            ? "text-foreground hover:bg-secondary"
                            : "text-muted-foreground"
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${doneLesson ? "text-green-600" : active ? "text-violet-600" : ""}`}
                      />
                      <span className="truncate">{l.title}</span>
                    </span>
                  );
                  return (
                    <li key={l.id}>
                      {unlocked ? (
                        <Link href={`/learn/${tree.slug}/lesson/${l.id}`}>{content}</Link>
                      ) : (
                        <div title="Complete the previous lesson to unlock this one">{content}</div>
                      )}
                    </li>
                  );
                })}
                {m.assessmentId && (
                  <li>
                    <Link
                      href={`/learn/${tree.slug}/assessment/${m.assessmentId}`}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                    >
                      <ClipboardCheck className="w-4 h-4 shrink-0" aria-hidden />
                      <span className="truncate">Module assessment</span>
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
        <Link
          href={`/learn/${tree.slug}`}
          className="mt-3 flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[13px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <ClipboardList className="w-4 h-4" /> Course overview
        </Link>
      </div>
    </aside>
  );
}
