// Frontend registration service — replaces the TanStack registration.functions.ts
// callables with Axios calls to the Express API.

import { api } from "./axios";
import type { CurrentUser } from "./auth";

export type RegistrationStatus = "pending" | "approved" | "rejected";

export interface School {
  id: string;
  name: string;
}

export interface TeacherDirectoryEntry {
  id: string;
  name: string;
  schoolId: string;
}

export interface RegistrationRequest {
  id: string;
  studentUserId: string;
  studentName: string;
  className: string;
  rollNumber: string;
  schoolId: string;
  schoolName: string;
  teacherId: string;
  teacherName: string;
  email: string;
  mobile: string;
  status: RegistrationStatus;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  reason?: string;
}

export interface Notification {
  id: string;
  type: "registration_pending" | "registration_approved" | "registration_rejected";
  message: string;
  createdAt: string;
  read: boolean;
}

export interface RegisterInput {
  name: string;
  className: "8" | "9" | "10" | "11" | "12";
  rollNumber: string;
  schoolId: string;
  teacherId: string;
  email?: string;
  mobile: string;
  password: string;
}

export interface DecideInput {
  requestId: string;
  decision: "approved" | "rejected";
  reason?: string;
}

export async function getRegistrationDirectory(): Promise<{
  schools: School[];
  teachers: TeacherDirectoryEntry[];
}> {
  const { data } = await api.get<{ data: { schools: School[]; teachers: TeacherDirectoryEntry[] } }>(
    "/registrations/directory",
  );
  return data.data;
}

export async function registerStudent(input: RegisterInput): Promise<CurrentUser> {
  const { data } = await api.post<{ data: CurrentUser }>("/registrations", input);
  return data.data;
}

export async function myRegistration(): Promise<{
  request: RegistrationRequest | null;
  notifications: Notification[];
}> {
  const { data } = await api.get<{
    data: { request: RegistrationRequest | null; notifications: Notification[] };
  }>("/registrations/mine");
  return data.data;
}

export async function pendingRegistrations(): Promise<RegistrationRequest[]> {
  const { data } = await api.get<{ data: RegistrationRequest[] }>("/registrations/pending");
  return data.data;
}

export async function decideRegistration(input: DecideInput): Promise<RegistrationRequest> {
  const { data } = await api.post<{ data: RegistrationRequest }>(
    `/registrations/${encodeURIComponent(input.requestId)}/decide`,
    { decision: input.decision, reason: input.reason },
  );
  return data.data;
}
