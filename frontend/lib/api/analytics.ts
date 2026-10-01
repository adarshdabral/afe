// Frontend analytics service — replaces the TanStack analytics.functions.ts
// callables with Axios calls to the Express API.

import { api } from "./axios";

export interface SyncInput {
  lessonsCompleted: number;
  lessonsTotal: number;
  modulesCompleted: number;
  modulesTotal: number;
  assessmentsPassed: number;
  avgScorePct: number | null;
  totalTimeSec: number;
  moduleScores: Record<string, number>;
  certificateIssued: boolean;
}

export interface ClassRow {
  name: string;
  students: number;
  avgProgressPct: number;
  avgScorePct: number | null;
  completionRate: number;
}

export interface TeacherAnalytics {
  totalStudents: number;
  completionRate: number;
  avgScorePct: number | null;
  classes: ClassRow[];
  moduleTrend: { moduleId: string; label: string; avgScore: number | null; attempts: number }[];
  roster: {
    name: string;
    className: string;
    progressPct: number;
    avgScorePct: number | null;
    complete: boolean;
  }[];
}

export interface SchoolAnalytics {
  schoolName: string;
  totalStudents: number;
  participationRate: number;
  completionRate: number;
  avgScorePct: number | null;
  avgTimeSec: number;
  certificatesIssued: number;
  classes: ClassRow[];
}

export interface PlatformAnalytics {
  totalSchools: number;
  totalStudents: number;
  certificatesIssued: number;
  completionRate: number;
  avgScorePct: number | null;
  totalLearningHours: number;
  schools: {
    schoolName: string;
    students: number;
    completionRate: number;
    avgScorePct: number | null;
    certificates: number;
  }[];
}

export async function syncMyProgress(input: SyncInput): Promise<{ ok: true }> {
  const { data } = await api.post<{ data: { ok: true } }>("/analytics/progress", input);
  return data.data;
}

export async function teacherAnalytics(): Promise<TeacherAnalytics> {
  const { data } = await api.get<{ data: TeacherAnalytics }>("/analytics/teacher");
  return data.data;
}

export async function schoolAnalytics(schoolName?: string): Promise<SchoolAnalytics> {
  const { data } = await api.get<{ data: SchoolAnalytics }>("/analytics/school", {
    params: schoolName ? { schoolName } : undefined,
  });
  return data.data;
}

export async function platformAnalytics(): Promise<PlatformAnalytics> {
  const { data } = await api.get<{ data: PlatformAnalytics }>("/analytics/platform");
  return data.data;
}
