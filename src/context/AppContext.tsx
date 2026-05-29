import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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

interface AppContextType {
  currentUser: CurrentUser;
  enrolledCourseIds: string[];
  progress: Record<string, number>;
  certificates: Certificate[];
  notes: Record<string, string>;
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
  const [darkMode, setDarkMode] = useState(false);
  const [pi, setPI] = useState(initialPI);
  const [pc, setPC] = useState(initialPC);
  const [au, setAU] = useState(initialAU);

  // Hydrate from localStorage (client only)
  useEffect(() => {
    try {
      const dm = localStorage.getItem("afe.darkMode");
      if (dm === "1") setDarkMode(true);
      const n = localStorage.getItem("afe.notes");
      if (n) setNotes(JSON.parse(n));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", darkMode);
    try { localStorage.setItem("afe.darkMode", darkMode ? "1" : "0"); } catch { /* ignore */ }
  }, [darkMode]);

  useEffect(() => {
    try { localStorage.setItem("afe.notes", JSON.stringify(notes)); } catch { /* ignore */ }
  }, [notes]);

  const enroll = (courseId: string) => {
    setUser((u) =>
      u.enrolledCourseIds.includes(courseId)
        ? u
        : { ...u, enrolledCourseIds: [...u.enrolledCourseIds, courseId], progress: { ...u.progress, [courseId]: 0 } }
    );
  };

  const updateProgress = (courseId: string, lessonIndex: number, totalLessons: number) => {
    const pct = Math.min(100, Math.round(((lessonIndex + 1) / totalLessons) * 100));
    setUser((u) => ({ ...u, progress: { ...u.progress, [courseId]: Math.max(u.progress[courseId] || 0, pct) } }));
  };

  const completeCourse = (courseId: string) => {
    setUser((u) => ({ ...u, progress: { ...u.progress, [courseId]: 100 }, certificatesEarned: u.certificatesEarned + 1 }));
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
        enrolledCourseIds: user.enrolledCourseIds,
        progress: user.progress,
        certificates: certs,
        notes,
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
