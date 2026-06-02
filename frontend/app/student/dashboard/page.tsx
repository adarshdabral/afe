"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, GraduationCap, Award, Clock, Activity, AlertCircle } from "lucide-react";
import { StudentSidebar } from "@/components/StudentSidebar";
import { CourseCard } from "@/components/CourseCard";
import { courses, assignments } from "@/data/mock";
import { useApp } from "@/context/AppContext";

export default function Dashboard() {
  const { currentUser, enrolledCourseIds, progress } = useApp();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"In Progress" | "Completed" | "Wishlist">("In Progress");

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, []);

  const enrolled = courses.filter((c) => enrolledCourseIds.includes(c.id));
  const inProgress = enrolled.filter((c) => (progress[c.id] ?? 0) < 100);
  const completed = enrolled.filter((c) => (progress[c.id] ?? 0) >= 100);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const tabCourses = tab === "In Progress" ? inProgress : tab === "Completed" ? completed : [];
  const pendingAssignments = assignments.filter((a) => a.status === "pending");

  const stats = [
    { icon: BookOpen, label: "Enrolled", value: enrolled.length },
    { icon: GraduationCap, label: "Lessons Completed", value: 47 },
    { icon: Award, label: "Certificates", value: currentUser.certificatesEarned },
    { icon: Clock, label: "Hours Learned", value: currentUser.hoursLearned },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      <StudentSidebar />
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Welcome back, Aarav 👋</h1>
            <p className="text-muted-foreground mt-1">{today}</p>
          </header>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {stats.map((s) => (
              <div key={s.label} className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
                {loading ? (
                  <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300 flex items-center justify-center">
                      <s.icon className="w-5 h-5" />
                    </div>
                    <p className="text-2xl font-bold text-foreground mt-3">{s.value}</p>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                  </>
                )}
              </div>
            ))}
          </div>

          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">Continue Learning</h2>
              <Link href="/courses" className="text-sm text-violet-600 hover:underline">View All</Link>
            </div>
            {inProgress.length === 0 ? (
              <EmptyState text="No courses in progress." />
            ) : (
              <div className="grid sm:grid-cols-2 gap-6">
                {inProgress.slice(0, 2).map((c) => <CourseCard key={c.id} course={c} variant="enrolled" />)}
              </div>
            )}
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-4">My Courses</h2>
            <div className="flex gap-2 border-b border-gray-100 dark:border-gray-700 mb-6">
              {(["In Progress", "Completed", "Wishlist"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    tab === t ? "border-violet-600 text-violet-600" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}>
                  {t}
                </button>
              ))}
            </div>
            {tabCourses.length === 0 ? (
              <EmptyState text={tab === "Wishlist" ? "Your wishlist is empty." : tab === "Completed" ? "No completed courses yet." : "Nothing in progress."} />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {tabCourses.map((c) => <CourseCard key={c.id} course={c} variant="enrolled" />)}
              </div>
            )}
          </section>

          <div className="grid lg:grid-cols-2 gap-6">
            <section className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-violet-600" />
                <h2 className="font-semibold text-foreground">Recent Activity</h2>
              </div>
              <ul className="space-y-3 border-l-2 border-violet-100 dark:border-violet-500/20 pl-4">
                {[
                  { text: "Completed lesson", course: "AI For Everyone", time: "2h ago" },
                  { text: "Started quiz", course: "Deep Learning with PyTorch", time: "5h ago" },
                  { text: "Submitted assignment", course: "Modern React", time: "1d ago" },
                  { text: "Enrolled in", course: "Data Science with Python", time: "2d ago" },
                  { text: "Earned certificate", course: "TypeScript in Depth", time: "3d ago" },
                  { text: "Posted question in", course: "AI For Everyone", time: "5d ago" },
                ].map((a, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-foreground">{a.text}</span>{" "}
                    <span className="text-violet-600 font-medium">{a.course}</span>{" "}
                    <span className="text-muted-foreground text-xs">• {a.time}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-violet-600" />
                <h2 className="font-semibold text-foreground">Upcoming Deadlines</h2>
              </div>
              {pendingAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming deadlines.</p>
              ) : (
                <ul className="space-y-3">
                  {pendingAssignments.map((a) => {
                    const due = new Date(a.dueDate);
                    const daysLeft = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    const urgent = daysLeft < 2;
                    const courseTitle = courses.find((c) => c.id === a.courseId)?.title;
                    return (
                      <li key={a.id} className="flex justify-between items-start gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800">
                        <div className="min-w-0">
                          <Link href={`/student/assignment/${a.id}`} className="font-medium text-sm text-foreground hover:text-violet-600 block truncate">{a.title}</Link>
                          <p className="text-xs text-muted-foreground">{courseTitle}</p>
                        </div>
                        <span className={`text-xs whitespace-nowrap ${urgent ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                          {urgent ? "Due soon" : `${daysLeft}d left`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="bg-card rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
      <p className="text-muted-foreground text-sm">{text}</p>
    </div>
  );
}
