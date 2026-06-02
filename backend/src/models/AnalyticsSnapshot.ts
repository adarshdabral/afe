// AnalyticsSnapshot model (SRS FR-12) — Mongo-backed replacement for the
// in-memory `snapshots` map in src/lib/analytics/analytics.server.ts. One
// progress snapshot per student; aggregated into role-scoped analytics.

import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

export interface StudentSnapshot {
  studentUserId: string;
  studentName: string;
  schoolId: string;
  schoolName: string;
  className: string;
  lessonsCompleted: number;
  lessonsTotal: number;
  modulesCompleted: number;
  modulesTotal: number;
  assessmentsPassed: number;
  avgScorePct: number | null;
  totalTimeSec: number;
  moduleScores: Record<string, number>; // scorePct per attempted module
  certificateIssued: boolean;
  updatedAt: string;
}

const analyticsSnapshotSchema = new Schema(
  {
    studentUserId: { type: String, required: true, unique: true, index: true },
    studentName: { type: String, required: true },
    schoolId: { type: String, required: true, index: true },
    schoolName: { type: String, required: true },
    className: { type: String, required: true },
    lessonsCompleted: { type: Number, required: true },
    lessonsTotal: { type: Number, required: true },
    modulesCompleted: { type: Number, required: true },
    modulesTotal: { type: Number, required: true },
    assessmentsPassed: { type: Number, required: true },
    avgScorePct: { type: Number, default: null },
    totalTimeSec: { type: Number, required: true },
    moduleScores: { type: Map, of: Number, default: {} },
    certificateIssued: { type: Boolean, default: false },
    updatedAt: { type: String, required: true },
  },
  { timestamps: false },
);

export type AnalyticsSnapshotSchemaType = InferSchemaType<typeof analyticsSnapshotSchema>;
export type AnalyticsSnapshotDoc = HydratedDocument<AnalyticsSnapshotSchemaType>;

export const AnalyticsSnapshot = model("AnalyticsSnapshot", analyticsSnapshotSchema);

/** Project a stored snapshot to a plain StudentSnapshot (moduleScores as Record). */
export function toSnapshot(doc: AnalyticsSnapshotDoc): StudentSnapshot {
  const moduleScores: Record<string, number> = {};
  const raw = doc.moduleScores as unknown as Map<string, number> | Record<string, number> | undefined;
  if (raw instanceof Map) {
    for (const [k, v] of raw.entries()) moduleScores[k] = v;
  } else if (raw) {
    for (const [k, v] of Object.entries(raw)) moduleScores[k] = v as number;
  }
  return {
    studentUserId: doc.studentUserId,
    studentName: doc.studentName,
    schoolId: doc.schoolId,
    schoolName: doc.schoolName,
    className: doc.className,
    lessonsCompleted: doc.lessonsCompleted,
    lessonsTotal: doc.lessonsTotal,
    modulesCompleted: doc.modulesCompleted,
    modulesTotal: doc.modulesTotal,
    assessmentsPassed: doc.assessmentsPassed,
    avgScorePct: doc.avgScorePct ?? null,
    totalTimeSec: doc.totalTimeSec,
    moduleScores,
    certificateIssued: !!doc.certificateIssued,
    updatedAt: doc.updatedAt,
  };
}
