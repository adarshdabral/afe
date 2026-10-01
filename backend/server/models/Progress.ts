// Progress model (Progress Tracking). One row per (student, course). Tracks
// completed lessons/modules, best assessment scores, time spent, derived overall
// progress %, last visited lesson, and certificate eligibility.

import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "./defineModel";

export interface AssessmentScore {
  assessmentId: string;
  score: number;
  passed: boolean;
}

export interface ProgressView {
  id: string;
  studentId: string;
  courseId: string;
  completedLessons: string[];
  completedModules: string[];
  assessmentScores: AssessmentScore[];
  timeSpentMinutes: number;
  overallProgress: number;
  lastVisitedLessonId: string | null;
  certificateEligible: boolean;
  createdAt: string;
  updatedAt: string;
}

const progressSchema = new Schema(
  {
    studentId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    completedLessons: { type: [String], default: [] },
    completedModules: { type: [String], default: [] },
    assessmentScores: {
      type: [{ assessmentId: String, score: Number, passed: Boolean, _id: false }],
      default: [],
    },
    timeSpentMinutes: { type: Number, default: 0 },
    overallProgress: { type: Number, default: 0 },
    lastVisitedLessonId: { type: String, default: null },
    certificateEligible: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// One progress record per student per course.
progressSchema.index({ studentId: 1, courseId: 1 }, { unique: true });

export type ProgressSchemaType = InferSchemaType<typeof progressSchema>;
export type ProgressDoc = HydratedDocument<ProgressSchemaType>;

export const Progress = defineModel("Progress", progressSchema);

export function toProgress(doc: ProgressDoc): ProgressView {
  const ts = doc as unknown as { createdAt?: Date; updatedAt?: Date };
  return {
    id: String(doc._id),
    studentId: doc.studentId,
    courseId: doc.courseId,
    completedLessons: doc.completedLessons ?? [],
    completedModules: doc.completedModules ?? [],
    assessmentScores: (doc.assessmentScores ?? []).map((a) => ({
      assessmentId: a.assessmentId ?? "",
      score: a.score ?? 0,
      passed: a.passed === true,
    })),
    timeSpentMinutes: doc.timeSpentMinutes ?? 0,
    overallProgress: doc.overallProgress ?? 0,
    lastVisitedLessonId: doc.lastVisitedLessonId ?? null,
    certificateEligible: doc.certificateEligible === true,
    createdAt: ts.createdAt?.toISOString() ?? new Date(0).toISOString(),
    updatedAt: ts.updatedAt?.toISOString() ?? new Date(0).toISOString(),
  };
}
