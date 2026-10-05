"use client";

import Link from "next/link";
import { CheckCircle2, Circle, ClipboardCheck, ClipboardList, Lock, MessagesSquare, NotebookPen } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useLearning } from "@/context/LearningContext";
import type { CourseTree, SectionKind } from "@/lib/api/courses";
import { pad2 } from "@/lib/course";
import { learnSequence, moduleLock, type SequenceItem } from "@/lib/learn";

/** The ordered learning items of a tree (topics → assignments → module assessments). */
export function topicSequence(tree: CourseTree): SequenceItem[] {
  return learnSequence(tree);
}

// Left sidebar: Modules → Lessons → Topics (+ each lesson's assignment) and each
// module's assessment, with completion state and the sequence/module locks (the
// backend enforces the same rule). `sequence` is learnSequence(tree).
export function LearnSidebar({
  tree,
  sequence,
  activeTopicId,
  activeItemId,
}: {
  tree: CourseTree;
  sequence: SequenceItem[];
  activeTopicId?: string;
  /** Highlight an assignment/assessment. */
  activeItemId?: string;
  activeSection?: SectionKind;
}) {
  const { completedTopics, isUnlocked, done: doneItems } = useLearning();
  // Sequential locking applies to students; teachers/admins preview freely.
  const isStudent = useApp().role === "student";

  const topics = sequence.filter((i) => i.kind === "topic");
  const total = topics.length;
  const done = topics.filter((i) => completedTopics.has(i.id)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const active = activeTopicId ?? activeItemId;

  const itemClass = (isActive: boolean, enabled = true) =>
    `flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] transition-colors ${
      isActive
        ? "bg-violet-600/10 text-violet-700 dark:text-violet-300 font-medium"
        : enabled
          ? "text-foreground hover:bg-secondary"
          : "text-muted-foreground"
    }`;

  /** One sequence item row (topic, assignment or assessment). */
  const Row = ({ id, href, label, icon: BaseIcon, moduleId, indent = true }: { id: string; href: string; label: string; icon: typeof Circle; moduleId: string; indent?: boolean }) => {
    const isDone = doneItems.has(id);
    const unlocked = !isStudent || isUnlocked(sequence, id, moduleId);
    const Icon = isDone ? CheckCircle2 : unlocked ? BaseIcon : Lock;
    const content = (
      <span className={`${itemClass(id === active, unlocked)} ${indent ? "pl-4" : ""}`}>
        <Icon className={`w-4 h-4 shrink-0 ${isDone ? "text-green-600" : id === active ? "text-violet-600" : ""}`} />
        <span className="truncate">{label}</span>
      </span>
    );
    return unlocked ? <Link href={href}>{content}</Link> : <div title="Complete the previous item to unlock this one">{content}</div>;
  };

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
              are hidden from the left pane for now. */}
          {tree.modules.map((m, mi) => {
            const lock = moduleLock(tree, sequence, doneItems, m);
            const locked = isStudent && !lock.unlocked;
            return (
              <div key={m.id}>
                <Link
                  href={`/learn/${tree.slug}/module/${m.id}`}
                  className="flex items-center gap-1.5 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.05em] hover:text-foreground"
                >
                  {isStudent && lock.complete ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" aria-label="Module completed" />
                  ) : locked ? (
                    <Lock className="w-3.5 h-3.5 shrink-0" aria-label="Module locked" />
                  ) : (
                    <span className="tabular-nums text-violet-600">{pad2(mi + 1)}</span>
                  )}
                  <span className="truncate">{m.title}</span>
                </Link>
                {locked && lock.blockedBy && (
                  <p className="px-2 mt-0.5 text-[11px] text-muted-foreground">Complete Module {lock.blockedBy} to unlock</p>
                )}
                {m.lessons.map((l) => (
                  <div key={l.id} className="mt-1">
                    <p className="px-2.5 pt-1 text-[12px] font-medium text-foreground/80 truncate">{l.title}</p>
                    <ul className="mt-0.5 space-y-0.5">
                      {l.topics.map((t) => (
                        <li key={t.id}>
                          <Row
                            id={t.id}
                            moduleId={m.id}
                            href={`/learn/${tree.slug}/topic/${t.id}`}
                            label={t.title}
                            icon={t.contentType === "discussion" ? MessagesSquare : Circle}
                          />
                        </li>
                      ))}
                      {l.assignment && (
                        <li>
                          <Row
                            id={l.assignment.id}
                            moduleId={m.id}
                            href={`/learn/${tree.slug}/assessment/${l.assignment.id}`}
                            label={`Assignment${l.assignment.isGraded ? " (graded)" : ""}: ${l.assignment.title}`}
                            icon={NotebookPen}
                          />
                        </li>
                      )}
                    </ul>
                  </div>
                ))}
                {m.assessmentId && (
                  <div className="mt-1">
                    <Row id={m.assessmentId} moduleId={m.id} href={`/learn/${tree.slug}/assessment/${m.assessmentId}`} label="Module assessment" icon={ClipboardCheck} indent={false} />
                  </div>
                )}
              </div>
            );
          })}
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
