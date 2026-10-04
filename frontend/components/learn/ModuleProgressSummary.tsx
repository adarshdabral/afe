"use client";

import { CheckCircle2, ClipboardCheck, Clock, PlayCircle } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useLearning } from "@/context/LearningContext";
import type { ModuleWithLessons } from "@/lib/api/courses";
import { formatHm, moduleRemaining } from "@/lib/progress";
import { cn } from "@/lib/utils";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * "2 graded assignments left · 4 lessons left · 1h 25m left" for one module,
 * computed live from the module's content and the signed-in student's progress
 * (LearningContext) — so it changes as they complete topics or pass the
 * assessment. Staff previewing the course see the module's totals instead.
 */
export function ModuleProgressSummary({ module, className }: { module: ModuleWithLessons; className?: string }) {
  const isStudent = useApp().role === "student";
  const { detail } = useLearning();
  // Wait for the student's progress before showing numbers (avoids a flash of "all left").
  if (isStudent && !detail) return <div className={cn("skeleton h-6 w-72 max-w-full rounded-full", className)} aria-hidden />;

  const passed = new Set((detail?.progress.assessmentScores ?? []).filter((a) => a.passed).map((a) => a.assessmentId));
  const r = moduleRemaining(module, new Set(isStudent ? (detail?.progress.completedTopics ?? []) : []), isStudent ? passed : new Set());

  if (isStudent && r.gradedLeft === 0 && r.lessonsLeft === 0 && (r.totalLessons > 0 || r.totalGraded > 0)) {
    return (
      <p className={cn("inline-flex items-center gap-2 text-[14px] font-medium text-green-700 dark:text-green-500", className)}>
        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden /> Module complete
      </p>
    );
  }

  const graded = isStudent ? r.gradedLeft : r.totalGraded;
  const lessons = isStudent ? r.lessonsLeft : r.totalLessons;
  const minutes = isStudent ? r.minutesLeft : r.totalMinutes;
  const suffix = isStudent ? " left" : "";
  const items: { key: string; icon: typeof Clock; text: string }[] = [];
  if (r.totalGraded > 0)
    items.push({ key: "graded", icon: ClipboardCheck, text: `${plural(graded, "graded assignment", "graded assignments")}${suffix}` });
  if (r.totalLessons > 0) items.push({ key: "lessons", icon: PlayCircle, text: `${plural(lessons, "lesson", "lessons")}${suffix}` });
  if (minutes > 0) items.push({ key: "time", icon: Clock, text: `${formatHm(minutes)}${suffix}` });
  if (items.length === 0) return null;

  return (
    <ul
      className={cn("flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[14px] text-foreground", className)}
      aria-label={isStudent ? "Remaining in this module" : "In this module"}
    >
      {items.map((item, i) => (
        <li key={item.key} className="inline-flex items-center gap-1.5">
          {i > 0 && <span aria-hidden className="text-muted-foreground mr-0.5">·</span>}
          <item.icon className="w-4 h-4 text-violet-600 shrink-0" aria-hidden />
          <span className="tabular-nums">{item.text}</span>
        </li>
      ))}
    </ul>
  );
}
