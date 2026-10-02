// Module service (Course CMS). Modules are sequenced by `order`; new modules go
// to the end. Deleting a module cascades to its lessons and their topics. Reordering is scoped to
// a single course (ids that don't belong are ignored).

import { Course } from "../models/Course";
import { Module, toModule, type ModuleView } from "../models/Module";
import { Lesson } from "../models/Lesson";
import { Topic } from "../models/Topic";
import { Assessment } from "../models/Assessment";
import { Question } from "../models/Question";
import { HttpError } from "../http/errors";

// ---- Readiness: what a module needs before it can be published ----
export interface ModuleReadiness {
  hasDescription: boolean;
  hasObjectives: boolean;
  hasAssessment: boolean;
  assessmentPublished: boolean;
  questionCount: number;
  ready: boolean;
  /** Human-readable list of what's missing (empty when ready). */
  missing: string[];
}

export function readinessFrom(
  m: { description?: string | null; learningObjectives?: string[] | null },
  assessment: { isPublished: boolean; questionCount: number } | null,
): ModuleReadiness {
  const hasDescription = !!m.description?.trim();
  const hasObjectives = (m.learningObjectives ?? []).some((o) => o.trim());
  const hasAssessment = !!assessment;
  const assessmentPublished = !!assessment?.isPublished;
  const questionCount = assessment?.questionCount ?? 0;
  const missing: string[] = [];
  if (!hasDescription) missing.push("a module description");
  if (!hasObjectives) missing.push("at least one learning objective");
  if (!hasAssessment) missing.push("a module assessment");
  else {
    if (questionCount === 0) missing.push("questions in the module assessment");
    if (!assessmentPublished) missing.push("a published module assessment");
  }
  return { hasDescription, hasObjectives, hasAssessment, assessmentPublished, questionCount, ready: missing.length === 0, missing };
}

/** Readiness for one module (looks up its assessment + question count). */
export async function moduleReadiness(m: {
  _id?: unknown;
  id?: string;
  description?: string | null;
  learningObjectives?: string[] | null;
}): Promise<ModuleReadiness> {
  const moduleId = m.id ?? String(m._id);
  const a = await Assessment.findOne({ moduleId });
  const questionCount = a ? await Question.countDocuments({ assessmentId: String(a._id) }) : 0;
  return readinessFrom(m, a ? { isPublished: a.isPublished === true, questionCount } : null);
}

function notReady(r: ModuleReadiness): HttpError {
  return new HttpError(409, `This module can't be published yet. It still needs ${r.missing.join(", ")}.`);
}

async function courseExists(courseId: string): Promise<boolean> {
  const c = await Course.findOne({ _id: courseId, deletedAt: null }).catch(() => null);
  return !!c;
}

export interface CreateModuleInput {
  title: string;
  description?: string;
  learningObjectives?: string[];
  estimatedDurationMinutes?: number;
  isPublished?: boolean;
}

/** Create a module at the end of the course's module list. Null if no course. */
export async function createModule(
  courseId: string,
  input: CreateModuleInput,
): Promise<ModuleView | null> {
  if (!(await courseExists(courseId))) return null;
  // A brand-new module has no assessment yet, so it can never start out published.
  if (input.isPublished) {
    throw notReady(readinessFrom(input, null));
  }
  const last = await Module.findOne({ courseId }).sort({ order: -1 });
  const order = last ? (last.order ?? 0) + 1 : 0;
  const doc = await Module.create({
    courseId,
    title: input.title.trim(),
    description: input.description ?? "",
    learningObjectives: input.learningObjectives ?? [],
    order,
    estimatedDurationMinutes: input.estimatedDurationMinutes ?? 0,
    isPublished: input.isPublished ?? false,
  });
  return toModule(doc);
}

export type UpdateModuleInput = Partial<CreateModuleInput>;

export async function updateModule(
  moduleId: string,
  patch: UpdateModuleInput,
): Promise<ModuleView | null> {
  const doc = await Module.findById(moduleId).catch(() => null);
  if (!doc) return null;
  if (patch.title !== undefined) doc.title = patch.title.trim();
  if (patch.description !== undefined) doc.description = patch.description;
  if (patch.learningObjectives !== undefined) doc.set("learningObjectives", patch.learningObjectives);
  if (patch.estimatedDurationMinutes !== undefined)
    doc.estimatedDurationMinutes = patch.estimatedDurationMinutes;
  if (patch.isPublished !== undefined) doc.isPublished = patch.isPublished;
  if (doc.isPublished) {
    // Publishing requires the module to be complete.
    if (patch.isPublished === true) {
      const r = await moduleReadiness(doc);
      if (!r.ready) throw notReady(r);
    }
    // A published module can't LOSE its description or objectives. Adding or
    // improving them is always allowed — including on older modules that were
    // published before objectives existed.
    if (patch.description !== undefined && !doc.description?.trim()) {
      throw new HttpError(409, "A published module needs a description. Hide the module first to remove it.");
    }
    if (patch.learningObjectives !== undefined && !(doc.learningObjectives ?? []).some((o) => o.trim())) {
      throw new HttpError(409, "A published module needs at least one learning objective. Hide the module first to remove them.");
    }
  }
  await doc.save();
  return toModule(doc);
}

/** Delete a module and cascade-delete its lessons + topics. Returns false if not found. */
export async function deleteModule(moduleId: string): Promise<boolean> {
  const doc = await Module.findById(moduleId).catch(() => null);
  if (!doc) return false;
  await Topic.deleteMany({ moduleId });
  await Lesson.deleteMany({ moduleId });
  await doc.deleteOne();
  return true;
}

/** Persist a new module order for a course. Only ids in the course are applied. */
export async function reorderModules(
  courseId: string,
  orderedIds: string[],
): Promise<ModuleView[] | null> {
  if (!(await courseExists(courseId))) return null;
  const owned = new Set(
    (await Module.find({ courseId }).select("_id")).map((m) => String(m._id)),
  );
  let order = 0;
  for (const id of orderedIds) {
    if (!owned.has(id)) continue;
    await Module.updateOne({ _id: id, courseId }, { order });
    order += 1;
  }
  const docs = await Module.find({ courseId }).sort({ order: 1, createdAt: 1 });
  return docs.map(toModule);
}
