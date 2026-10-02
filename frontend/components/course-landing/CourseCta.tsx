"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { listMyProgress } from "@/lib/api/progress";
import { FLAGSHIP_SLUG } from "@/lib/course";
import { cn } from "@/lib/utils";

export interface CourseCtaTarget {
  href: string;
  label: string;
}

/**
 * Where "Start learning" goes for the current visitor. Uses the existing auth +
 * learning routes only (there is no separate enrollment model):
 *  - anonymous            → /register
 *  - student, not approved → /student/pending (mirrors guardRedirect)
 *  - student, approved     → /learn/[slug] ("Continue" once progress exists)
 *  - teacher / admin       → /learn/[slug] as a course preview
 */
export function useCourseCta(slug: string = FLAGSHIP_SLUG, courseId?: string): CourseCtaTarget {
  const { authUser } = useApp();
  const [started, setStarted] = useState(false);
  const approvedStudent = authUser?.role === "student" && authUser.registrationStatus === "approved";

  useEffect(() => {
    if (!approvedStudent || !courseId) return;
    let cancelled = false;
    listMyProgress()
      .then((ps) => {
        if (!cancelled)
          setStarted(ps.some((p) => p.courseId === courseId && p.completedTopics.length > 0));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [approvedStudent, courseId]);

  if (!authUser) return { href: "/register", label: "Start learning" };
  if (authUser.role === "student") {
    if (!approvedStudent) return { href: "/student/pending", label: "Check registration status" };
    return { href: `/learn/${slug}`, label: started ? "Continue learning" : "Start learning" };
  }
  return { href: `/learn/${slug}`, label: "Preview the course" };
}

/** The primary, auth-aware course CTA. */
export function CourseCta({
  slug,
  courseId,
  size = "lg",
  className,
}: {
  slug?: string;
  courseId?: string;
  size?: "md" | "lg";
  className?: string;
}) {
  const { href, label } = useCourseCta(slug, courseId);
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 text-white font-medium shadow-sm transition-colors hover:bg-violet-700",
        size === "lg" ? "h-12 px-7 text-[15px]" : "h-11 px-5 text-[14px]",
        className,
      )}
    >
      {label}
      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
