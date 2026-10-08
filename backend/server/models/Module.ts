// Module model (Course CMS). A module belongs to exactly one course and is
// sequenced by `order` (ascending). Deleting a module cascades to its lessons and their topics
// (see module.service). `isPublished` gates a module from the public course tree.
//
// Every module carries a description and its learning objectives (both required to
// publish — see moduleReadiness in module.service). It may have ONE module-level
// assessment (optional); when published, students must pass it to complete the module.

import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "./defineModel";
import { importFieldsSchema, indexImportKey, toImportFields, type ImportFieldsView } from "./importFields";
import { invalidateOnWrite } from "../cache/content-cache";

export interface ModuleView extends ImportFieldsView {
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
    ...importFieldsSchema,
  },
  { timestamps: true },
);

// Course tree + progress sequence read a whole course sorted by order.
moduleSchema.index({ courseId: 1, order: 1 });
indexImportKey(moduleSchema);

export type ModuleSchemaType = InferSchemaType<typeof moduleSchema>;
export type ModuleDoc = HydratedDocument<ModuleSchemaType>;

invalidateOnWrite(moduleSchema); // course content is cached (server/cache/content-cache.ts)

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
    ...toImportFields(doc),
    createdAt: ts.createdAt?.toISOString() ?? new Date(0).toISOString(),
    updatedAt: ts.updatedAt?.toISOString() ?? new Date(0).toISOString(),
  };
}
