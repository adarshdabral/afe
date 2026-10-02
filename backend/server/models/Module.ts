// Module model (Course CMS). A module belongs to exactly one course and is
// sequenced by `order` (ascending). Deleting a module cascades to its lessons and their topics
// (see module.service). `isPublished` gates a module from the public course tree.
//
// Every module carries a description and its learning objectives, and is assessed
// by exactly ONE module-level assessment (Assessment.moduleId is unique — tests are
// per module, never per lesson). A module can only be published once all three are
// in place (see moduleReadiness in module.service).

import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "./defineModel";

export interface ModuleView {
  id: string;
  courseId: string;
  title: string;
  description: string;
  /** What a learner will be able to do after the module. */
  learningObjectives: string[];
  order: number;
  estimatedDurationMinutes: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

const moduleSchema = new Schema(
  {
    courseId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    learningObjectives: { type: [String], default: [] },
    order: { type: Number, required: true, default: 0, index: true },
    estimatedDurationMinutes: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type ModuleSchemaType = InferSchemaType<typeof moduleSchema>;
export type ModuleDoc = HydratedDocument<ModuleSchemaType>;

export const Module = defineModel("Module", moduleSchema);

export function toModule(doc: ModuleDoc): ModuleView {
  const ts = doc as unknown as { createdAt?: Date; updatedAt?: Date };
  return {
    id: String(doc._id),
    courseId: doc.courseId,
    title: doc.title,
    description: doc.description ?? "",
    learningObjectives: [...(doc.learningObjectives ?? [])],
    order: doc.order ?? 0,
    estimatedDurationMinutes: doc.estimatedDurationMinutes ?? 0,
    isPublished: doc.isPublished === true,
    createdAt: ts.createdAt?.toISOString() ?? new Date(0).toISOString(),
    updatedAt: ts.updatedAt?.toISOString() ?? new Date(0).toISOString(),
  };
}
