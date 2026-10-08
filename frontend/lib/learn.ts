// Learner-side wrappers around the shared learning sequence (lib/sequence.ts, the
// mirror of backend/server/shared/sequence.ts): build it from a course tree and
// describe each module's lock state. The backend enforces the same rule on every
// content/attempt endpoint — this only drives what the UI shows.

import type { AssignmentSummary, CourseTree, LessonWithTopics, ModuleWithLessons, Topic } from "@/lib/api/courses";
import {
  buildSequence,
  isItemUnlocked,
  isModuleComplete,
  isModuleUnlocked,
  lessonItems,
  type SequenceItem,
} from "@/lib/sequence";

export type { SequenceItem } from "@/lib/sequence";

/** The ordered items of a (learner-visible) course tree. */
export function learnSequence(tree: CourseTree): SequenceItem[] {
  return buildSequence(
    tree.modules.map((m) => ({
      id: m.id,
      assessmentId: m.assessmentId,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        topics: l.topics.filter((t) => t.isPublished !== false).map((t) => ({ id: t.id, order: t.order })),
        assignments: l.assignments.filter((a) => a.isPublished).map((a) => ({ id: a.id, isRequired: a.isRequired, order: a.order })),
      })),
    })),
  );
}

/** Ordered topic ids only (prev/next topic navigation). */
export function topicIds(tree: CourseTree): string[] {
  return tree.modules.flatMap((m) => m.lessons.flatMap((l) => l.topics.map((t) => t.id)));
}

export interface ModuleLock {
  unlocked: boolean;
  complete: boolean;
  /** 1-based number of the module that must be completed first (when locked). */
  blockedBy: number | null;
}

export function moduleLock(tree: CourseTree, seq: SequenceItem[], done: Set<string>, module: ModuleWithLessons): ModuleLock {
  const unlocked = isModuleUnlocked(seq, done, module.id);
  const idx = tree.modules.findIndex((m) => m.id === module.id);
  return { unlocked, complete: isModuleComplete(seq, done, module.id), blockedBy: unlocked || idx <= 0 ? null : idx };
}

export { isItemUnlocked };

/** The learn route for an item. */
export function itemHref(slug: string, item: { id: string; kind: SequenceItem["kind"] }): string {
  return item.kind === "topic" ? `/learn/${slug}/topic/${item.id}` : `/learn/${slug}/assessment/${item.id}`;
}

export type LessonRow = { kind: "topic"; topic: Topic } | { kind: "assignment"; assignment: AssignmentSummary };

/**
 * A lesson's topics and assignments in their real order (the order the learning
 * sequence uses). `includeDrafts` (admin) also lists draft topics and unpublished
 * assignments; learners only get what is published.
 */
export function orderedLessonRows(lesson: LessonWithTopics, includeDrafts = false): LessonRow[] {
  const topics = includeDrafts ? lesson.topics : lesson.topics.filter((t) => t.isPublished !== false);
  const assignments = includeDrafts ? lesson.assignments : lesson.assignments.filter((a) => a.isPublished);
  const byId = new Map<string, LessonRow>([
    ...topics.map((t) => [t.id, { kind: "topic", topic: t }] as [string, LessonRow]),
    ...assignments.map((a) => [a.id, { kind: "assignment", assignment: a }] as [string, LessonRow]),
  ]);
  return lessonItems({
    id: lesson.id,
    topics: topics.map((t) => ({ id: t.id, order: t.order })),
    assignments: assignments.map((a) => ({ id: a.id, isRequired: true, order: a.order })),
  }).map((it) => byId.get(it.id)!);
}
