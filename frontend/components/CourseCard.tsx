"use client";

import Link from "next/link";
import { Star, Clock, Pencil, Trash2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { categoryBadgeClass } from "@/lib/categoryColor";
import type { Course } from "@/data/mock";
import { useApp } from "@/context/AppContext";

interface Props {
  course: Course;
  variant?: "catalog" | "enrolled" | "instructor";
  status?: "Draft" | "Pending" | "Published" | "Rejected";
  studentCount?: number;
  onDelete?: () => void;
}

const statusColor: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  Published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  Rejected: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
};

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-3.5 h-3.5 ${
            n <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600"
          }`}
        />
      ))}
    </div>
  );
}

export function CourseCard({ course, variant = "catalog", status = "Published", studentCount, onDelete }: Props) {
  const { progress } = useApp();
  const pct = progress[course.id] ?? 0;

  return (
    <div className="group bg-card text-card-foreground rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col transition-all hover:shadow-md hover:-translate-y-0.5 duration-200">
      <Link
        href={variant === "enrolled" ? `/student/learn/${course.id}` : `/courses/${course.id}`}
        className="block relative aspect-video overflow-hidden"
      >
        <div
          className="absolute inset-0 transition-transform duration-300 group-hover:scale-105 flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${course.thumbnailColor}, ${course.thumbnailColor}cc)`,
          }}
        >
          <BookOpen className="w-12 h-12 text-white/40" />
        </div>
        <span
          className={`absolute top-3 left-3 text-xs font-medium px-2.5 py-1 rounded-lg ${categoryBadgeClass(
            course.category
          )}`}
        >
          {course.category}
        </span>
        {variant === "instructor" && (
          <span className={`absolute top-3 right-3 text-xs font-medium px-2.5 py-1 rounded-lg ${statusColor[status]}`}>
            {status}
          </span>
        )}
      </Link>

      <div className="p-5 flex-1 flex flex-col gap-3">
        <h3 className="font-semibold text-foreground line-clamp-2 leading-snug">{course.title}</h3>
        <p className="text-xs text-muted-foreground">{course.instructor.name}</p>

        {variant !== "instructor" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Stars rating={course.rating} />
            <span className="font-medium text-foreground">{course.rating}</span>
            <span>({course.reviewCount.toLocaleString()})</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-foreground">{course.level}</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3" />
            {course.duration}
          </span>
        </div>

        {variant === "enrolled" && (
          <div className="mt-1">
            <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-violet-600 transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">{pct}% complete</p>
          </div>
        )}

        {variant === "instructor" && typeof studentCount === "number" && (
          <p className="text-xs text-muted-foreground">{studentCount.toLocaleString()} students</p>
        )}

        <div className="mt-auto pt-2 flex gap-2">
          {variant === "catalog" && (
            <Link href={`/courses/${course.id}`} className="flex-1">
              <Button className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white">Enroll Free</Button>
            </Link>
          )}
          {variant === "enrolled" && (
            <Link href={`/student/learn/${course.id}`} className="flex-1">
              <Button className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white">Continue</Button>
            </Link>
          )}
          {variant === "instructor" && (
            <>
              <Link href="/instructor/create" className="flex-1">
                <Button variant="outline" size="icon" className="rounded-xl w-full">
                  <Pencil className="w-4 h-4" />
                </Button>
              </Link>
              <Button variant="outline" size="icon" className="rounded-xl text-red-600" onClick={onDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
