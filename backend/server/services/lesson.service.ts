// Lesson service (Course CMS). Lessons are sequenced by `order` within a module;
// new lessons go to the end. `courseId` is inherited from the parent module.
// Reordering is scoped to a single module.

import { Module } from "../models/Module";
import {
  Lesson,
  toLesson,
  type LessonContentType,
  type LessonView,
} from "../models/Lesson";

export interface CreateLessonInput {
  title: string;
  description?: string;
  contentType: LessonContentType;
  videoUrl?: string;
  documentUrl?: string;
  content?: string;
  estimatedDurationMinutes?: number;
  isPreview?: boolean;
}

/** Create a lesson at the end of its module. Null if the module doesn't exist. */
export async function createLesson(
  moduleId: string,
  input: CreateLessonInput,
): Promise<LessonView | null> {
  const module = await Module.findById(moduleId).catch(() => null);
  if (!module) return null;
  const last = await Lesson.findOne({ moduleId }).sort({ order: -1 });
  const order = last ? (last.order ?? 0) + 1 : 0;
  const doc = await Lesson.create({
    moduleId,
    courseId: module.courseId,
    title: input.title.trim(),
    description: input.description ?? "",
    order,
    contentType: input.contentType,
    videoUrl: input.videoUrl ?? "",
    documentUrl: input.documentUrl ?? "",
    content: input.content ?? "",
    estimatedDurationMinutes: input.estimatedDurationMinutes ?? 0,
    isPreview: input.isPreview ?? false,
  });
  return toLesson(doc);
}

export type UpdateLessonInput = Partial<CreateLessonInput>;

export async function updateLesson(
  lessonId: string,
  patch: UpdateLessonInput,
): Promise<LessonView | null> {
  const doc = await Lesson.findById(lessonId).catch(() => null);
  if (!doc) return null;
  if (patch.title !== undefined) doc.title = patch.title.trim();
  if (patch.description !== undefined) doc.description = patch.description;
  if (patch.contentType !== undefined) doc.contentType = patch.contentType;
  if (patch.videoUrl !== undefined) doc.videoUrl = patch.videoUrl;
  if (patch.documentUrl !== undefined) doc.documentUrl = patch.documentUrl;
  if (patch.content !== undefined) doc.content = patch.content;
  if (patch.estimatedDurationMinutes !== undefined)
    doc.estimatedDurationMinutes = patch.estimatedDurationMinutes;
  if (patch.isPreview !== undefined) doc.isPreview = patch.isPreview;
  await doc.save();
  return toLesson(doc);
}

export async function deleteLesson(lessonId: string): Promise<boolean> {
  const doc = await Lesson.findById(lessonId).catch(() => null);
  if (!doc) return false;
  await doc.deleteOne();
  return true;
}

/** Persist a new lesson order within a module. Only ids in the module are applied. */
export async function reorderLessons(
  moduleId: string,
  orderedIds: string[],
): Promise<LessonView[] | null> {
  const module = await Module.findById(moduleId).catch(() => null);
  if (!module) return null;
  const owned = new Set(
    (await Lesson.find({ moduleId }).select("_id")).map((l) => String(l._id)),
  );
  let order = 0;
  for (const id of orderedIds) {
    if (!owned.has(id)) continue;
    await Lesson.updateOne({ _id: id, moduleId }, { order });
    order += 1;
  }
  const docs = await Lesson.find({ moduleId }).sort({ order: 1, createdAt: 1 });
  return docs.map(toLesson);
}
