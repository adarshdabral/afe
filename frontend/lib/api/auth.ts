// Frontend auth service — replaces the TanStack `auth.functions.ts` callables
// (loginFn / logoutFn / getCurrentUserFn) with Axios calls to the API (backend app, via the /api rewrite).

import { api } from "./axios";

export type Role = "student" | "teacher" | "platform_admin";
export type RegistrationStatus = "pending" | "approved" | "rejected";

export interface CurrentUser {
  id: string;
  role: Role;
  name: string;
  email: string;
  registrationStatus?: RegistrationStatus;
  /** Only meaningful for teachers; whether the account may sign in. */
  active?: boolean;
}

export interface LoginInput {
  login: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email?: string;
  mobile: string;
  password: string;
}

/** Establish a session from email/username + password. Throws on bad creds. */
export async function login(input: LoginInput): Promise<CurrentUser> {
  const { data } = await api.post<{ data: CurrentUser }>("/auth/login", input);
  return data.data;
}

/** Create a pending student account and establish a session. */
export async function register(input: RegisterInput): Promise<CurrentUser> {
  const { data } = await api.post<{ data: CurrentUser }>("/auth/register", input);
  return data.data;
}

/** Resolve the current user from the session cookie. Returns null when signed out. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const { data } = await api.get<{ data: CurrentUser | null }>("/auth/me");
    return data.data;
  } catch {
    return null;
  }
}

/** Tear down the current session. */
export async function logout(): Promise<void> {
  await api.post("/auth/logout");
}
