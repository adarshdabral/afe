"use client";

import Link from "next/link";
import { CheckCircle2, Circle, ClipboardCheck, ClipboardList, Lock } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useLearning } from "@/context/LearningContext";
import type { CourseTree, SectionKind } from "@/lib/api/courses";
import { pad2 } from "@/lib/course";

/** Flat, ordered topic ids (module → lesson → topic) — the progress sequence. */
export function topicSequence(tree: CourseTree): string[] {
  return tree.modules.flatMap((m) => m.lessons.flatMap((l) => l.topics.map((t) => t.id)));
}

// Left sidebar: course sections (Introduction, Overview, Meet the Instructor), then
// Modules → Lessons → Topics with completion state and sequential locking, and each
// module's assessment. `sequence` is the flat ordered topic-id list (topicSequence).
export function LearnSidebar({
  tree,
  sequence,
  activeTopicId,
  activeSection,
}: {
  tree: CourseTree;
  sequence: string[];
  activeTopicId?: string;
  activeSection?: SectionKind;
}) {
  const { completedTopics, isUnlocked, detail } = useLearning();
  // Sequential locking applies to students; teachers/admins preview freely.
  const isStudent = useApp().role === "student";
  const completedModules = new Set(detail?.progress.completedModules ?? []);

  const total = sequence.length;
  const done = sequence.filter((id) => completedTopics.has(id)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const itemClass = (active: boolean, enabled = true) =>
    `flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] transition-colors ${
      active
        ? "bg-violet-600/10 text-violet-700 dark:text-violet-300 font-medium"
        : enabled
          ? "text-foreground hover:bg-secondary"
          : "text-muted-foreground"
    }`;

  return (
    <aside className="w-full lg:w-72 shrink-0">
      <div className="rounded-3xl border border-border bg-card shadow-soft p-3.5 lg:sticky lg:top-6">
        <Link href={`/learn/${tree.slug}`} className="block px-2 pt-1 group">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-violet-600">Course</span>
          <span className="block text-[15px] font-semibold text-foreground truncate tracking-tight group-hover:underline">
            {tree.title}
          </span>
          {tree.instructor && <span className="block text-[12px] text-muted-foreground truncate">with {tree.instructor}</span>}
        </Link>
        {isStudent && (
          <div className="px-2 mt-3 mb-3">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
              <span>
                {done} of {total} topics
              </span>
              <span className="tabular-nums font-medium text-foreground">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full bg-violet-600 transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
        <div className="space-y-3 max-h-[calc(100vh-13rem)] overflow-y-auto pr-0.5">
          {/* Course sections (Course Introduction, Course Overview, Meet the Instructor)
              are hidden from the left pane for now — uncomment to show them again.
          {(tree.sections?.length ?? 0) > 0 && (
            <ul className="space-y-0.5">
              {tree.sections.map((s) => (
                <li key={s.kind}>
                  <Link href={`/learn/${tree.slug}/section/${s.kind}`} className={itemClass(activeSection === s.kind)}>
                    <BookOpen className="w-4 h-4 shrink-0 text-violet-600" aria-hidden />
                    <span className="truncate">{s.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          */}
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
              {m.lessons.map((l) => (
                <div key={l.id} className="mt-1">
                  <p className="px-2.5 pt-1 text-[12px] font-medium text-foreground/80 truncate">{l.title}</p>
                  <ul className="mt-0.5 space-y-0.5">
                    {l.topics.map((t) => {
                      const doneTopic = completedTopics.has(t.id);
                      const unlocked = !isStudent || isUnlocked(sequence, t.id);
                      const active = t.id === activeTopicId;
                      const Icon = doneTopic ? CheckCircle2 : unlocked ? Circle : Lock;
                      const content = (
                        <span className={`${itemClass(active, unlocked)} pl-4`}>
                          <Icon className={`w-4 h-4 shrink-0 ${doneTopic ? "text-green-600" : active ? "text-violet-600" : ""}`} />
                          <span className="truncate">{t.title}</span>
                        </span>
                      );
                      return (
                        <li key={t.id}>
                          {unlocked ? (
                            <Link href={`/learn/${tree.slug}/topic/${t.id}`}>{content}</Link>
                          ) : (
                            <div title="Complete the previous topic to unlock this one">{content}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {m.assessmentId && (
                <Link href={`/learn/${tree.slug}/assessment/${m.assessmentId}`} className={`${itemClass(false)} mt-1 text-muted-foreground`}>
                  <ClipboardCheck className="w-4 h-4 shrink-0" aria-hidden />
                  <span className="truncate">Module assessment</span>
                </Link>
              )}
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
