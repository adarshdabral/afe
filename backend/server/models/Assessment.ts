// Assessment model (Assessment Engine) — one model for BOTH:
//   kind "module" — the graded module assessment (exactly one per module), and
//   kind "lesson" — a lesson assignment (at most one per lesson; non-graded by default).
// Both share the same configuration (timer, attempts, availability, shuffling…),
// questions (Question model) and attempts (Attempt model). Only platform admins
// create/edit/publish; students attempt when published. Documents created before
// `kind` existed are module assessments (see migrations/assessment-kinds.ts).

import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "./defineModel";
import { invalidateOnWrite } from "../cache/content-cache";
import { importFieldsSchema, indexImportKey, toImportFields, type ImportFieldsView } from "./importFields";

export const DEFAULT_PASSING_SCORE = 60;
export const ASSESSMENT_KINDS = ["module", "lesson"] as const;
export type AssessmentKind = (typeof ASSESSMENT_KINDS)[number];
/** Mongo filter for module assessments (legacy docs have no `kind`). */
export const MODULE_KIND = { kind: { $ne: "lesson" } } as const;

export interface AssessmentView extends ImportFieldsView {
  id: string;
  kind: AssessmentKind;
  moduleId: string;
  /** Lesson assignments only (null for module assessments). */
  lessonId: string | null;
  courseId: string;
  title: string;
  description: string;
  /** Shown before the student starts. */
  instructions: string;
  /** Graded → must reach `passingScore` to complete. Non-graded → submitting completes it. */
  isGraded: boolean;
  /** Lesson assignments: must be completed before the lesson counts as complete. */
  isRequired: boolean;
  passingScore: number;
  /** Expected time to complete, in minutes (0 = not estimated). */
  estimatedDurationMinutes: number;
  /** Countdown per attempt, in minutes (0 = untimed). Enforced by the server. */
  timeLimitMinutes: number;
  /** Max submitted attempts per student (0 = unlimited). */
  maxAttempts: number;
  /** Optional availability window (ISO strings, null = open). */
  availableFrom: string | null;
  availableUntil: string | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  /** When time runs out, submit the saved answers automatically. */
  autoSubmitOnTimeout: boolean;
  isPublished: boolean;
  /** Lesson assignments: position among the lesson's topics (same scale as Topic.order;
   *  null = after all topics). Several assignments per lesson are allowed. */
  order: number | null;
  /** Grading category this counts towards (Course.gradingWeights; admin-only). */
  gradeCategory: string;
  createdAt: string;
  updatedAt: string;
}

const assessmentSchema = new Schema(
  {
    kind: { type: String, enum: ASSESSMENT_KINDS, default: "module" },
    moduleId: { type: String, required: true, index: true },
    lessonId: { type: String, default: null },
    courseId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    instructions: { type: String, default: "" },
    isGraded: { type: Boolean, default: true },
    isRequired: { type: Boolean, default: true },
    passingScore: { type: Number, default: DEFAULT_PASSING_SCORE, min: 0, max: 100 },
    estimatedDurationMinutes: { type: Number, default: 0, min: 0 },
    timeLimitMinutes: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 0, min: 0 },
    availableFrom: { type: Date, default: null },
    availableUntil: { type: Date, default: null },
    shuffleQuestions: { type: Boolean, default: false },
    shuffleOptions: { type: Boolean, default: false },
    autoSubmitOnTimeout: { type: Boolean, default: true },
    isPublished: { type: Boolean, default: false },
    order: { type: Number, default: null },
    gradeCategory: { type: String, default: "" },
    ...importFieldsSchema,
  },
  { timestamps: true },
);
indexImportKey(assessmentSchema);
// One module assessment per module; lessons may have several assignments.
assessmentSchema.index(
  { moduleId: 1 },
  { unique: true, partialFilterExpression: { kind: "module" }, name: "module_assessment_unique" },
);
assessmentSchema.index({ lessonId: 1 });

export type AssessmentSchemaType = InferSchemaType<typeof assessmentSchema>;
export type AssessmentDoc = HydratedDocument<AssessmentSchemaType>;

invalidateOnWrite(assessmentSchema); // course content is cached (server/cache/content-cache.ts)

export const Assessment = defineModel("Assessment", assessmentSchema);

const iso = (d: unknown): string | null => (d ? new Date(d as Date).toISOString() : null);

export function toAssessment(doc: AssessmentDoc): AssessmentView {
  const ts = doc as unknown as { createdAt?: Date; updatedAt?: Date };
  const kind = (doc.kind as AssessmentKind) ?? "module";
  return {
    id: String(doc._id),
    kind,
    moduleId: doc.moduleId,
    lessonId: doc.lessonId ?? null,
    courseId: doc.courseId,
    title: doc.title,
    description: doc.description ?? "",
    instructions: doc.instructions ?? "",
    isGraded: doc.isGraded ?? true,
    isRequired: doc.isRequired ?? true,
    passingScore: doc.passingScore ?? DEFAULT_PASSING_SCORE,
    estimatedDurationMinutes: doc.estimatedDurationMinutes ?? 0,
    timeLimitMinutes: doc.timeLimitMinutes ?? 0,
    maxAttempts: doc.maxAttempts ?? 0,
    availableFrom: iso(doc.availableFrom),
    availableUntil: iso(doc.availableUntil),
    shuffleQuestions: doc.shuffleQuestions === true,
    shuffleOptions: doc.shuffleOptions === true,
    autoSubmitOnTimeout: doc.autoSubmitOnTimeout ?? true,
    isPublished: doc.isPublished === true,
    order: typeof doc.order === "number" ? doc.order : null,
    gradeCategory: doc.gradeCategory ?? "",
    ...toImportFields(doc),
    createdAt: ts.createdAt?.toISOString() ?? new Date(0).toISOString(),
    updatedAt: ts.updatedAt?.toISOString() ?? new Date(0).toISOString(),
  };
}
