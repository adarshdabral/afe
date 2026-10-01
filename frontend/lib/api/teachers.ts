// Frontend teacher-management service — Axios calls to the platform-admin-only
// /api/admin/teachers resource. Mirrors backend/src/services/teacher.service.ts.

import { api } from "./axios";

export interface Teacher {
  id: string;
  name: string;
  email: string;
  mobile: string;
  designation: string;
  organization: string;
  specialization: string;
  bio: string;
  profilePhoto: string;
  active: boolean;
  createdAt: string;
}

/** Plaintext credentials returned once, on create / password reset. */
export interface Credentials {
  loginId: string;
  temporaryPassword: string;
}

export type TeacherStatusFilter = "all" | "active" | "inactive";

export interface ListTeachersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: TeacherStatusFilter;
}

export interface ListTeachersResult {
  teachers: Teacher[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateTeacherInput {
  name: string;
  email: string;
  mobile?: string;
  designation?: string;
  organization?: string;
  specialization?: string;
  bio?: string;
  profilePhoto?: string;
}

export type UpdateTeacherInput = Partial<CreateTeacherInput>;

export async function listTeachers(params: ListTeachersParams): Promise<ListTeachersResult> {
  const { data } = await api.get<{ data: ListTeachersResult }>("/admin/teachers", { params });
  return data.data;
}

export async function getTeacher(id: string): Promise<Teacher> {
  const { data } = await api.get<{ data: Teacher }>(`/admin/teachers/${encodeURIComponent(id)}`);
  return data.data;
}

export async function createTeacher(
  input: CreateTeacherInput,
): Promise<{ teacher: Teacher; credentials: Credentials }> {
  const { data } = await api.post<{ data: { teacher: Teacher; credentials: Credentials } }>(
    "/admin/teachers",
    input,
  );
  return data.data;
}

export async function updateTeacher(id: string, patch: UpdateTeacherInput): Promise<Teacher> {
  const { data } = await api.patch<{ data: Teacher }>(
    `/admin/teachers/${encodeURIComponent(id)}`,
    patch,
  );
  return data.data;
}

export async function activateTeacher(id: string): Promise<Teacher> {
  const { data } = await api.post<{ data: Teacher }>(
    `/admin/teachers/${encodeURIComponent(id)}/activate`,
  );
  return data.data;
}

export async function deactivateTeacher(id: string): Promise<Teacher> {
  const { data } = await api.post<{ data: Teacher }>(
    `/admin/teachers/${encodeURIComponent(id)}/deactivate`,
  );
  return data.data;
}

export async function resetTeacherPassword(
  id: string,
): Promise<{ teacher: Teacher; credentials: Credentials }> {
  const { data } = await api.post<{ data: { teacher: Teacher; credentials: Credentials } }>(
    `/admin/teachers/${encodeURIComponent(id)}/reset-password`,
  );
  return data.data;
}
