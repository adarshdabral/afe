// Module service (Course CMS). Modules are sequenced by `order`; new modules go
// to the end. Deleting a module cascades to its lessons. Reordering is scoped to
// a single course (ids that don't belong are ignored).

import { Course } from "../models/Course";
import { Module, toModule, type ModuleView } from "../models/Module";
import { Lesson } from "../models/Lesson";

async function courseExists(courseId: string): Promise<boolean> {
  const c = await Course.findOne({ _id: courseId, deletedAt: null }).catch(() => null);
  return !!c;
}

export interface CreateModuleInput {
  title: string;
  description?: string;
  estimatedDurationMinutes?: number;
  isPublished?: boolean;
}

/** Create a module at the end of the course's module list. Null if no course. */
export async function createModule(
  courseId: string,
  input: CreateModuleInput,
): Promise<ModuleView | null> {
  if (!(await courseExists(courseId))) return null;
  const last = await Module.findOne({ courseId }).sort({ order: -1 });
  const order = last ? (last.order ?? 0) + 1 : 0;
  const doc = await Module.create({
    courseId,
    title: input.title.trim(),
    description: input.description ?? "",
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
  if (patch.estimatedDurationMinutes !== undefined)
    doc.estimatedDurationMinutes = patch.estimatedDurationMinutes;
  if (patch.isPublished !== undefined) doc.isPublished = patch.isPublished;
  await doc.save();
  return toModule(doc);
}

/** Delete a module and cascade-delete its lessons. Returns false if not found. */
export async function deleteModule(moduleId: string): Promise<boolean> {
  const doc = await Module.findById(moduleId).catch(() => null);
  if (!doc) return false;
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
