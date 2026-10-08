// The learning SEQUENCE — single source of truth for what a student may open or
// complete next. Kept IDENTICAL in backend/server/shared/sequence.ts and
// frontend/lib/sequence.ts (like access.ts): if you change one, change the other.
//
// Per module, in order:
//   for each lesson: its topics and REQUIRED assignments, interleaved by `order`
//     (an assignment without a position comes after the lesson's topics)
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
    /** Visible topics, in order (`order` = position within the lesson). */
    topics: { id: string; order?: number }[];
    /** Published lesson assignments; `order` on the same scale as topics (null = at the end). */
    assignments: { id: string; isRequired: boolean; order: number | null }[];
  }[];
}

/** A lesson's topics and assignments merged by position (ties: topics first). */
export function lessonItems(lesson: SequenceInput["lessons"][number]): { id: string; kind: "topic" | "assignment"; isRequired: boolean }[] {
  const rows = [
    ...lesson.topics.map((t, i) => ({ id: t.id, kind: "topic" as const, isRequired: true, pos: t.order ?? i, tie: 0, seq: i })),
    ...lesson.assignments.map((a, i) => ({ id: a.id, kind: "assignment" as const, isRequired: a.isRequired, pos: a.order ?? Number.POSITIVE_INFINITY, tie: 1, seq: i })),
  ];
  rows.sort((x, y) => x.pos - y.pos || x.tie - y.tie || x.seq - y.seq);
  return rows.map(({ id, kind, isRequired }) => ({ id, kind, isRequired }));
}

export function buildSequence(modules: SequenceInput[]): SequenceItem[] {
  const items: SequenceItem[] = [];
  for (const m of modules) {
    for (const l of m.lessons) {
      for (const it of lessonItems(l)) {
        if (it.kind === "assignment" && !it.isRequired) continue; // optional: not gating
        items.push({ id: it.id, kind: it.kind, moduleId: m.id, lessonId: l.id });
      }
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
