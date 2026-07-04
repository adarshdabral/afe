"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, BookOpen, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/Navbar";
import { listPublicCourses, type Course, type CourseListResult } from "@/lib/api/courses";

// Public course catalog — published courses only (the API scopes by role).
export default function Catalog() {
  const [search, setSearch] = useState("");
  const [data, setData] = useState<CourseListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    listPublicCourses({ search: search.trim() || undefined, pageSize: 24 })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-12 animate-fade-up">
        <header className="mb-8">
          <h1 className="text-[2.5rem] leading-tight font-semibold text-foreground tracking-tight">
            Course catalog
          </h1>
          <p className="text-lg text-muted-foreground mt-1.5">
            Explore the course and start learning.
          </p>
        </header>

        <div className="relative max-w-md mb-8">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses"
            className="rounded-full h-11 pl-10 bg-card border-border shadow-soft"
          />
        </div>

        {error ? (
          <State icon={BookOpen} title="We couldn't load the catalog">
            <button onClick={load} className="text-violet-600 font-medium hover:underline">
              Try again
            </button>
          </State>
        ) : loading && !data ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton h-52 rounded-3xl" />
            ))}
          </div>
        ) : (data?.courses.length ?? 0) === 0 ? (
          <State icon={BookOpen} title="No courses yet">
            <span className="text-muted-foreground">New courses will appear here soon.</span>
          </State>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data!.courses.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CourseCard({ course }: { course: Course }) {
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group block rounded-3xl border border-border bg-card overflow-hidden shadow-soft elevate"
    >
      <div className="h-32 bg-secondary flex items-center justify-center relative overflow-hidden">
        {course.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
        ) : (
          <>
            <div
              aria-hidden
              className="absolute inset-0 opacity-60"
              style={{
                background:
                  "radial-gradient(120% 120% at 20% 0%, color-mix(in srgb, var(--primary) 14%, transparent), transparent 60%)",
              }}
            />
            <Sparkles className="w-8 h-8 text-violet-600/70 relative transition-transform duration-300 group-hover:scale-110" />
          </>
        )}
      </div>
      <div className="p-5">
        <span className="text-[11px] uppercase tracking-[0.06em] text-violet-600 font-semibold capitalize">
          {course.level}
        </span>
        <h3 className="font-semibold text-foreground mt-1.5 line-clamp-2 leading-snug">
          {course.title}
        </h3>
        <p className="text-[13px] text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
          {course.shortDescription || "Start learning at your own pace."}
        </p>
        {course.instructor && (
          <p className="text-[12px] text-muted-foreground mt-3 pt-3 border-t border-border">
            {course.instructor}
          </p>
        )}
      </div>
    </Link>
  );
}

function State({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof BookOpen;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-14 text-center shadow-soft">
      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
        <Icon className="w-7 h-7 text-muted-foreground" />
      </div>
      <p className="font-semibold text-foreground">{title}</p>
      <div className="mt-1.5 text-sm">{children}</div>
    </div>
  );
}
