// The learning SEQUENCE — single source of truth for what a student may open or
// complete next. Kept IDENTICAL in backend/server/shared/sequence.ts and
// frontend/lib/sequence.ts (like access.ts): if you change one, change the other.
//
// Per module, in order:
//   for each lesson: its topics (in order), then its REQUIRED assignment (if any)
//   then the module's graded assessment (if any)
// Rule: an item is unlocked when it is the first item, is already complete, or the
// item before it is complete. A module is unlocked when its first item is, and is
// complete when every item in it is complete — so Module N+1 opens only after
// Module N's topics, required assignments and assessment are all done.
//
// Completion inputs are per student: completed topic ids + passed assessment ids
// (a non-graded assignment counts as passed once submitted).

export type SequenceItemKind = "topic" | "assignment" | "assessment";

export interface SequenceItem {
  /** Topic id or assessment id. */
  id: string;
  kind: SequenceItemKind;
  moduleId: string;
  lessonId: string | null;
}

export interface SequenceInput {
  id: string;
  /** Published module assessment id (null if none). */
  assessmentId: string | null;
  lessons: {
    id: string;
    topics: { id: string }[];
    /** Published lesson assignment (null if none). */
    assignment: { id: string; isRequired: boolean } | null;
  }[];
}

export function buildSequence(modules: SequenceInput[]): SequenceItem[] {
  const items: SequenceItem[] = [];
  for (const m of modules) {
    for (const l of m.lessons) {
      for (const t of l.topics) items.push({ id: t.id, kind: "topic", moduleId: m.id, lessonId: l.id });
      if (l.assignment?.isRequired) items.push({ id: l.assignment.id, kind: "assignment", moduleId: m.id, lessonId: l.id });
    }
    if (m.assessmentId) items.push({ id: m.assessmentId, kind: "assessment", moduleId: m.id, lessonId: null });
  }
  return items;
}

/** Everything the student has finished: completed topics + passed assessments/assignments. */
export function doneSet(completedTopics: Iterable<string>, passedAssessmentIds: Iterable<string>): Set<string> {
  return new Set([...completedTopics, ...passedAssessmentIds]);
}

/** May the student open / complete this item? Items not in the sequence (e.g. an
 *  optional assignment) follow their module: unlocked when the module is. */
export function isItemUnlocked(seq: SequenceItem[], done: Set<string>, id: string, moduleIdHint?: string): boolean {
  const idx = seq.findIndex((i) => i.id === id);
  if (idx === -1) return moduleIdHint ? isModuleUnlocked(seq, done, moduleIdHint) : true;
  if (idx === 0 || done.has(id)) return true;
  return done.has(seq[idx - 1].id);
}

export function isModuleUnlocked(seq: SequenceItem[], done: Set<string>, moduleId: string): boolean {
  const first = seq.findIndex((i) => i.moduleId === moduleId);
  if (first === -1) return true; // a module with no items has nothing to gate
  return isItemUnlocked(seq, done, seq[first].id);
}

export function isModuleComplete(seq: SequenceItem[], done: Set<string>, moduleId: string): boolean {
  const items = seq.filter((i) => i.moduleId === moduleId);
  return items.length > 0 && items.every((i) => done.has(i.id));
}

/** First item not yet complete (null = all done). */
export function nextItem(seq: SequenceItem[], done: Set<string>): SequenceItem | null {
  return seq.find((i) => !done.has(i.id)) ?? null;
}
