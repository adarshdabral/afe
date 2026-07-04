"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, ChevronLeft, ChevronRight, ShieldCheck, BookOpen } from "lucide-react";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/AppContext";
import { CourseStatusBadge } from "@/components/course/CourseStatusBadge";
import {
  adminListCourses,
  COURSE_STATUSES,
  type CourseListResult,
  type CourseStatus,
} from "@/lib/api/courses";

const PAGE_SIZE = 10;
const selectClass = "h-11 px-3 rounded-xl border border-input bg-card text-sm text-foreground";

export default function CoursesList() {
  const { role } = useApp();
  const isPlatform = role === "platform_admin";

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CourseStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CourseListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    if (!isPlatform) return;
    setLoading(true);
    setError(false);
    adminListCourses({ page, pageSize: PAGE_SIZE, search: search.trim() || undefined, status })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [isPlatform, page, search, status]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  if (!isPlatform) {
    return (
      <Shell>
        <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
          <ShieldCheck className="w-10 h-10 text-violet-600 mx-auto mb-3" />
          <p className="font-medium text-foreground">Platform admins only</p>
          <p className="text-sm text-muted-foreground mt-1">
            Only a platform admin can manage course content.
          </p>
        </div>
      </Shell>
    );
  }

  const courses = data?.courses ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <Shell>
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Courses</h1>
          <p className="text-muted-foreground mt-1">{data?.total ?? 0} courses in the catalog.</p>
        </div>
        <Link href="/admin/courses/create">
          <Button className="rounded-xl h-11 bg-violet-600 hover:bg-violet-700 text-white">
            <Plus className="w-4 h-4 mr-2" /> New course
          </Button>
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, tags…"
            className="rounded-xl h-11 pl-9"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as CourseStatus | "all")}
          className={selectClass}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          {COURSE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-gray-100 dark:border-gray-700">
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Level</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <RowMessage>Could not load courses. <button onClick={load} className="text-violet-600 underline">Retry</button></RowMessage>
              ) : loading && courses.length === 0 ? (
                <RowMessage>Loading…</RowMessage>
              ) : courses.length === 0 ? (
                <RowMessage>
                  <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  No courses match your filters.
                </RowMessage>
              ) : (
                courses.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{c.title}</div>
                      <div className="text-xs text-muted-foreground">/{c.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <CourseStatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{c.level}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(c.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/courses/${c.id}`}
                        className="text-violet-600 font-medium hover:underline"
                      >
                        Open builder
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-muted-foreground">
          Page {data?.page ?? 1} of {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-xl h-9"
            disabled={(data?.page ?? 1) <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </Button>
          <Button
            variant="outline"
            className="rounded-xl h-9"
            disabled={(data?.page ?? 1) >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background">
      <AdminSidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">{children}</div>
      </main>
    </div>
  );
}

function RowMessage({ children }: { children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}
