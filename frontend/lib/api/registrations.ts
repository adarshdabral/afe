// Frontend registration service — Axios calls to the registration API (backend app, via the /api rewrite).
// There is no School entity (schoolName is free-text informational data) and no
// teacher selection: every new student is auto-assigned to the default teacher.

import { api } from "./axios";
import type { CurrentUser } from "./auth";

export type RegistrationStatus = "pending" | "approved" | "rejected";
export type StatusFilter = RegistrationStatus | "all";

export interface RegistrationRequest {
  id: string;
  studentUserId: string;
  studentName: string;
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
  fullName: string;
  email: string;
  password: string;
  mobileNumber: string;
  schoolName: string;
}

export interface QueueParams {
  status?: StatusFilter;
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface QueueResult {
  requests: RegistrationRequest[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DecideInput {
  requestId: string;
  decision: "approved" | "rejected";
  reason?: string;
}

/** Self-register a student and establish a session (auto-assigned to the default teacher). */
export async function registerStudent(input: RegisterInput): Promise<CurrentUser> {
  const { data } = await api.post<{ data: CurrentUser }>("/registrations", input);
  return data.data;
}

/** Current student's request status + notifications. */
export async function myRegistration(): Promise<{
  request: RegistrationRequest | null;
  notifications: Notification[];
}> {
  const { data } = await api.get<{
    data: { request: RegistrationRequest | null; notifications: Notification[] };
  }>("/registrations/mine");
  return data.data;
}

/** Registration queue — teacher sees own assigned requests, platform admin sees all. */
export async function registrationQueue(params: QueueParams): Promise<QueueResult> {
  const { data } = await api.get<{ data: QueueResult }>("/registrations/queue", { params });
  return data.data;
}

export async function decideRegistration(input: DecideInput): Promise<RegistrationRequest> {
  const { data } = await api.post<{ data: RegistrationRequest }>(
    `/registrations/${encodeURIComponent(input.requestId)}/decide`,
    { decision: input.decision, reason: input.reason },
  );
  return data.data;
}
