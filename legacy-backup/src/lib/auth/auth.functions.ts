// Auth RPC surface. Each `.handler` body (and the `*.server.ts` modules it
// imports) is server-only and tree-shaken from the client bundle; the client
// keeps only the typed callable references.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { useAppSession } from "./session.server";
import { authenticate, getUserById } from "./users.server";
import type { SessionPrincipal } from "./access";

export type CurrentUser = SessionPrincipal;

/** Establish a session from an email/username + password. Throws on bad creds. */
export const loginFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ login: z.string().min(1), password: z.string().min(1) }))
  .handler(async ({ data }): Promise<CurrentUser> => {
    const user = await authenticate(data.login, data.password);
    if (!user) throw new Error("Invalid email or password");
    const session = await useAppSession();
    await session.update({ user });
    return user;
  });

/** Tear down the current session. */
export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useAppSession();
  await session.clear();
  return { ok: true };
});

/**
 * Resolve the current user from the session cookie, re-validated against the
 * store so a stale/suspended account can't ride an old cookie. Returns null
 * when unauthenticated.
 */
export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<CurrentUser | null> => {
    const session = await useAppSession();
    const sessionUser = session.data.user;
    if (!sessionUser) return null;
    return await getUserById(sessionUser.id);
  },
);
