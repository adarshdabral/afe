import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
  currentUser as initialUser,
  certificates as initialCerts,
  pendingInstructors as initialPI,
  pendingCourses as initialPC,
  adminUsers as initialAU,
  courses,
  type CurrentUser,
  type Certificate,
  type PendingInstructor,
  type PendingCourse,
  type AdminUser,
} from "@/data/mock";
import {
  getCurrentUserFn,
  logoutFn,
  type CurrentUser as AuthUser,
} from "@/lib/auth/auth.functions";
import type { Role } from "@/lib/auth/access";
import type { AssessmentResult } from "@/data/assessments";

interface AppContextType {
  currentUser: CurrentUser;
  /** Authenticated session identity (null when signed out). */
  authUser: AuthUser | null;
  role: Role | null;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  enrolledCourseIds: string[];
  progress: Record<string, number>;
  certificates: Certificate[];
  notes: Record<string, string>;
  /** Course-engine state: completed curriculum lessons + saved reflections. */
  completedLessons: Record<string, boolean>;
  reflections: Record<string, string>;
  completeLesson: (lessonId: string) => void;
  saveReflection: (lessonId: string, text: string) => void;
  /** Best assessment result per module (FR-07 score storage / FR-08 tracking). */
  assessmentScores: Record<string, AssessmentResult>;
  saveAssessmentResult: (result: AssessmentResult) => void;
  /** Active learning time per lesson, in seconds (FR-08 time spent). */
  timeSpent: Record<string, number>;
  addTimeSpent: (lessonId: string, seconds: number) => void;
  darkMode: boolean;
  pendingInstructors: PendingInstructor[];
  pendingCourses: PendingCourse[];
  adminUsers: AdminUser[];
  enroll: (courseId: string) => void;
  updateProgress: (courseId: string, lessonIndex: number, totalLessons: number) => void;
  completeCourse: (courseId: string) => void;
  saveNote: (lessonId: string, text: string) => void;
  toggleDarkMode: () => void;
  approveInstructor: (id: string) => void;
  rejectInstructor: (id: string) => void;
  approveCourse: (id: string) => void;
  rejectCourse: (id: string) => void;
  suspendUser: (id: string) => void;
  activateUser: (id: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser>(initialUser);
  const [certs, setCerts] = useState<Certificate[]>(initialCerts);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [completedLessons, setCompletedLessons] = useState<Record<string, boolean>>({});
  const [reflections, setReflections] = useState<Record<string, string>>({});
  const [assessmentScores, setAssessmentScores] = useState<Record<string, AssessmentResult>>({});
  const [timeSpent, setTimeSpent] = useState<Record<string, number>>({});
  const [darkMode, setDarkMode] = useState(false);
  const [pi, setPI] = useState(initialPI);
  const [pc, setPC] = useState(initialPC);
  const [au, setAU] = useState(initialAU);

  // Session identity — seeded by the root beforeLoad under the same query key.
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: authUser = null } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => getCurrentUserFn(),
    staleTime: 60_000,
  });

  const logout = async () => {
    await logoutFn();
    await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    await router.navigate({ to: "/login" });
  };

  // Hydrate from localStorage (client only)
  useEffect(() => {
    try {
      const dm = localStorage.getItem("afe.darkMode");
      if (dm === "1") setDarkMode(true);
      const n = localStorage.getItem("afe.notes");
      if (n) setNotes(JSON.parse(n));
      const cl = localStorage.getItem("afe.completedLessons");
      if (cl) setCompletedLessons(JSON.parse(cl));
      const rf = localStorage.getItem("afe.reflections");
      if (rf) setReflections(JSON.parse(rf));
      const as = localStorage.getItem("afe.assessmentScores");
      if (as) setAssessmentScores(JSON.parse(as));
      const ts = localStorage.getItem("afe.timeSpent");
      if (ts) setTimeSpent(JSON.parse(ts));
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

  useEffect(() => {
    try {
      localStorage.setItem("afe.notes", JSON.stringify(notes));
    } catch {
      /* ignore */
    }
  }, [notes]);

  useEffect(() => {
    try {
      localStorage.setItem("afe.completedLessons", JSON.stringify(completedLessons));
    } catch {
      /* ignore */
    }
  }, [completedLessons]);

  useEffect(() => {
    try {
      localStorage.setItem("afe.reflections", JSON.stringify(reflections));
    } catch {
      /* ignore */
    }
  }, [reflections]);

  useEffect(() => {
    try {
      localStorage.setItem("afe.assessmentScores", JSON.stringify(assessmentScores));
    } catch {
      /* ignore */
    }
  }, [assessmentScores]);

  useEffect(() => {
    try {
      localStorage.setItem("afe.timeSpent", JSON.stringify(timeSpent));
    } catch {
      /* ignore */
    }
  }, [timeSpent]);

  const enroll = (courseId: string) => {
    setUser((u) =>
      u.enrolledCourseIds.includes(courseId)
        ? u
        : {
            ...u,
            enrolledCourseIds: [...u.enrolledCourseIds, courseId],
            progress: { ...u.progress, [courseId]: 0 },
          },
    );
  };

  const updateProgress = (courseId: string, lessonIndex: number, totalLessons: number) => {
    const pct = Math.min(100, Math.round(((lessonIndex + 1) / totalLessons) * 100));
    setUser((u) => ({
      ...u,
      progress: { ...u.progress, [courseId]: Math.max(u.progress[courseId] || 0, pct) },
    }));
  };

  const completeCourse = (courseId: string) => {
    setUser((u) => ({
      ...u,
      progress: { ...u.progress, [courseId]: 100 },
      certificatesEarned: u.certificatesEarned + 1,
    }));
    const course = courses.find((c) => c.id === courseId);
    if (course && !certs.find((c) => c.courseId === courseId)) {
      setCerts((prev) => [
        ...prev,
        {
          id: `cert-${courseId}-${Date.now()}`,
          courseId,
          courseTitle: course.title,
          issuedDate: new Date().toISOString().slice(0, 10),
          verificationId: `AFE-CERT-${Math.random().toString(36).slice(2, 6).toUpperCase()}-2026`,
        },
      ]);
    }
  };

  const saveNote = (lessonId: string, text: string) =>
    setNotes((n) => ({ ...n, [lessonId]: text }));

  const completeLesson = (lessonId: string) =>
    setCompletedLessons((m) => (m[lessonId] ? m : { ...m, [lessonId]: true }));

  const saveReflection = (lessonId: string, text: string) =>
    setReflections((r) => ({ ...r, [lessonId]: text }));

  // Keep the best attempt per module so a pass is never lost on a weaker retake.
  const saveAssessmentResult = (result: AssessmentResult) =>
    setAssessmentScores((m) => {
      const prev = m[result.moduleId];
      return prev && prev.scorePct >= result.scorePct ? m : { ...m, [result.moduleId]: result };
    });

  const addTimeSpent = (lessonId: string, seconds: number) => {
    if (seconds <= 0) return;
    setTimeSpent((t) => ({ ...t, [lessonId]: (t[lessonId] ?? 0) + seconds }));
  };

  const toggleDarkMode = () => setDarkMode((d) => !d);

  const approveInstructor = (id: string) => setPI((arr) => arr.filter((x) => x.id !== id));
  const rejectInstructor = (id: string) => setPI((arr) => arr.filter((x) => x.id !== id));
  const approveCourse = (id: string) => setPC((arr) => arr.filter((x) => x.id !== id));
  const rejectCourse = (id: string) => setPC((arr) => arr.filter((x) => x.id !== id));
  const suspendUser = (id: string) =>
    setAU((arr) => arr.map((u) => (u.id === id ? { ...u, status: "suspended" } : u)));
  const activateUser = (id: string) =>
    setAU((arr) => arr.map((u) => (u.id === id ? { ...u, status: "active" } : u)));

  return (
    <AppContext.Provider
      value={{
        currentUser: user,
        authUser,
        role: authUser?.role ?? null,
        isAuthenticated: !!authUser,
        logout,
        enrolledCourseIds: user.enrolledCourseIds,
        progress: user.progress,
        certificates: certs,
        notes,
        completedLessons,
        reflections,
        completeLesson,
        saveReflection,
        assessmentScores,
        saveAssessmentResult,
        timeSpent,
        addTimeSpent,
        darkMode,
        pendingInstructors: pi,
        pendingCourses: pc,
        adminUsers: au,
        enroll,
        updateProgress,
        completeCourse,
        saveNote,
        toggleDarkMode,
        approveInstructor,
        rejectInstructor,
        approveCourse,
        rejectCourse,
        suspendUser,
        activateUser,
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
