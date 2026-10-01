"use client";

// AppContext — global app state: the authenticated session identity and the
// dark-mode UI preference. All learning/course state now lives in
// LearningContext (server-backed) and the Mongo-backed CMS APIs. There is no
// mock course content here.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  getCurrentUser,
  logout as logoutRequest,
  type CurrentUser as AuthUser,
  type Role,
} from "@/lib/api/auth";

interface AppContextType {
  authUser: AuthUser | null;
  role: Role | null;
  isAuthenticated: boolean;
  loadingUser: boolean;
  /** Set the session identity directly (e.g. from a login/register response) so
   *  the app knows the role immediately — no page refresh needed. */
  setSession: (user: AuthUser | null) => void;
  /** Re-fetch the session from the server (`/auth/me`) and update state. */
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then(setAuthUser)
      .catch(() => setAuthUser(null))
      .finally(() => setLoadingUser(false));
  }, []);

  const refresh = async () => {
    setLoadingUser(true);
    try {
      setAuthUser(await getCurrentUser());
    } catch {
      setAuthUser(null);
    } finally {
      setLoadingUser(false);
    }
  };

  useEffect(() => {
    try {
      if (localStorage.getItem("afe.darkMode") === "1") setDarkMode(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", darkMode);
    try {
      localStorage.setItem("afe.darkMode", darkMode ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [darkMode]);

  const logout = async () => {
    await logoutRequest();
    setAuthUser(null);
    router.push("/login");
  };

  return (
    <AppContext.Provider
      value={{
        authUser,
        role: authUser?.role ?? null,
        isAuthenticated: !!authUser,
        loadingUser,
        setSession: setAuthUser,
        refresh,
        logout,
        darkMode,
        toggleDarkMode: () => setDarkMode((d) => !d),
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
