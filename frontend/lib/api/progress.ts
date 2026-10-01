// Frontend Progress Tracking service — the only place axios is called for
// progress. Mirrors backend/server/services/progress.service.ts.

import { api } from "./axios";

export interface AssessmentScore {
  assessmentId: string;
  score: number;
  passed: boolean;
}

export interface Progress {
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

export interface ProgressDetail {
  progress: Progress;
  totalLessons: number;
  nextLessonId: string | null;
}

export async function getCourseProgress(courseId: string): Promise<ProgressDetail> {
  const { data } = await api.get<{ data: ProgressDetail }>(`/progress/${courseId}`);
  return data.data;
}

export async function listMyProgress(): Promise<Progress[]> {
  const { data } = await api.get<{ data: Progress[] }>("/progress");
  return data.data;
}

export async function completeLesson(
  courseId: string,
  lessonId: string,
): Promise<ProgressDetail> {
  const { data } = await api.post<{ data: ProgressDetail }>(
    `/progress/${courseId}/lessons/${lessonId}/complete`,
  );
  return data.data;
}

export async function markVisited(courseId: string, lessonId: string): Promise<ProgressDetail> {
  const { data } = await api.post<{ data: ProgressDetail }>(`/progress/${courseId}/visit`, {
    lessonId,
  });
  return data.data;
}

export async function addTime(courseId: string, minutes: number): Promise<ProgressDetail> {
  const { data } = await api.post<{ data: ProgressDetail }>(`/progress/${courseId}/time`, {
    minutes,
  });
  return data.data;
}
