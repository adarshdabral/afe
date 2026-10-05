// Lesson service (Course CMS). A Lesson is a CONTAINER for Topics inside a Module:
// it has a name and optional description, is sequenced by `order` within its
// module (new lessons go to the end), and inherits `courseId` from the module.
// Deleting a lesson deletes its topics. Reordering is scoped to one module.

import { Module } from "../models/Module";
import { Lesson, toLesson, type LessonView } from "../models/Lesson";
import { deleteAssessmentsWhere } from "./assessment.service";
import { Topic } from "../models/Topic";

export interface CreateLessonInput {
  title: string;
  description?: string;
}
export type UpdateLessonInput = Partial<CreateLessonInput>;

/** Create a lesson at the end of its module. Null if the module doesn't exist. */
export async function createLesson(moduleId: string, input: CreateLessonInput): Promise<LessonView | null> {
  const module = await Module.findById(moduleId).catch(() => null);
  if (!module) return null;
  const last = await Lesson.findOne({ moduleId }).sort({ order: -1 });
  const doc = await Lesson.create({
    moduleId,
    courseId: module.courseId,
    title: input.title.trim(),
    description: input.description ?? "",
    order: last ? (last.order ?? 0) + 1 : 0,
  });
  return toLesson(doc);
}

export async function updateLesson(lessonId: string, patch: UpdateLessonInput): Promise<LessonView | null> {
  const doc = await Lesson.findById(lessonId).catch(() => null);
  if (!doc) return null;
  if (patch.title !== undefined) doc.title = patch.title.trim();
  if (patch.description !== undefined) doc.description = patch.description;
  await doc.save();
  return toLesson(doc);
}

/** Delete a lesson and its topics. */
export async function deleteLesson(lessonId: string): Promise<boolean> {
  const doc = await Lesson.findById(lessonId).catch(() => null);
  if (!doc) return false;
  await Topic.deleteMany({ lessonId });
  await deleteAssessmentsWhere({ lessonId }); // its assignment, questions and attempts
  await doc.deleteOne();
  return true;
}

/** Persist a new lesson order within a module. Only ids in the module are applied. */
export async function reorderLessons(moduleId: string, orderedIds: string[]): Promise<LessonView[] | null> {
  const module = await Module.findById(moduleId).catch(() => null);
  if (!module) return null;
  const owned = new Set((await Lesson.find({ moduleId }).select("_id")).map((l) => String(l._id)));
  let order = 0;
  for (const id of orderedIds) {
    if (!owned.has(id)) continue;
    await Lesson.updateOne({ _id: id, moduleId }, { order });
    order += 1;
  }
  const docs = await Lesson.find({ moduleId }).sort({ order: 1, createdAt: 1 });
  return docs.map(toLesson);
}
