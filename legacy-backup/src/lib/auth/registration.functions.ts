// Registration workflow RPC surface (FR-01 / FR-02). Handler bodies and their
// `*.server.ts` imports are server-only and tree-shaken from the client bundle.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Aliased: this is a request-scoped server utility, not a React hook (the `use`
// prefix would otherwise trip react-hooks/rules-of-hooks in the helpers below).
import { useAppSession as resolveSession } from "./session.server";
import {
  createRegistration,
  decideRegistration,
  getDirectory,
  getStudentRegistration,
  listPendingForTeacher,
  type Notification,
  type RegistrationRequest,
  type School,
  type TeacherDirectoryEntry,
} from "./registrations.server";
import type { CurrentUser } from "./auth.functions";

async function requireRole(roles: CurrentUser["role"][]): Promise<CurrentUser> {
  const session = await resolveSession();
  const user = session.data.user;
  if (!user || !roles.includes(user.role)) throw new Error("Not authorized.");
  return user;
}

/** Schools + teachers for the registration form's "Teacher Selection". */
export const getRegistrationDirectoryFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ schools: School[]; teachers: TeacherDirectoryEntry[] }> => getDirectory(),
);

const registerSchema = z.object({
  name: z.string().min(1),
  className: z.enum(["8", "9", "10", "11", "12"]),
  rollNumber: z.string().min(1),
  schoolId: z.string().min(1),
  teacherId: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  mobile: z.string().min(7).max(20),
  password: z.string().min(6),
});

/** FR-01: submit a school-linked registration; establishes a pending session. */
export const registerStudentFn = createServerFn({ method: "POST" })
  .inputValidator(registerSchema)
  .handler(async ({ data }): Promise<CurrentUser> => {
    const { principal } = await createRegistration({
      name: data.name,
      className: data.className,
      rollNumber: data.rollNumber,
      schoolId: data.schoolId,
      teacherId: data.teacherId,
      email: data.email || undefined,
      mobile: data.mobile,
      password: data.password,
    });
    const session = await resolveSession();
    await session.update({ user: principal });
    return principal;
  });

/** Student polls their own request status + notifications (pending screen). */
export const myRegistrationFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ request: RegistrationRequest | null; notifications: Notification[] }> => {
    const user = await requireRole(["student"]);
    return getStudentRegistration(user.id);
  },
);

/** FR-02: pending requests for the signed-in teacher's school(s). */
export const pendingRegistrationsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<RegistrationRequest[]> => {
    const teacher = await requireRole(["teacher", "platform_admin"]);
    return listPendingForTeacher(teacher.id);
  },
);

const decideSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().max(500).optional(),
});

/** FR-02: approve or reject a registration request. */
export const decideRegistrationFn = createServerFn({ method: "POST" })
  .inputValidator(decideSchema)
  .handler(async ({ data }): Promise<RegistrationRequest> => {
    const teacher = await requireRole(["teacher", "platform_admin"]);
    return decideRegistration({
      requestId: data.requestId,
      teacherUserId: teacher.id,
      decision: data.decision,
      reason: data.reason,
    });
  });
