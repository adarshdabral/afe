"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, UserPlus, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/AppContext";
import {
  listTeachers,
  type ListTeachersResult,
  type TeacherStatusFilter,
} from "@/lib/api/teachers";

const PAGE_SIZE = 10;
const selectClass =
  "h-11 px-3 rounded-xl border border-input bg-card text-sm text-foreground";

// Platform-admin-only teacher directory: search, status filter, pagination. The
// API enforces requireRole("platform_admin"); this page also gates the UI.
export default function TeachersList() {
  const { role, loadingUser } = useApp();
  const isPlatform = role === "platform_admin";

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TeacherStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListTeachersResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!isPlatform) return;
    setLoading(true);
    listTeachers({ page, pageSize: PAGE_SIZE, search: search.trim() || undefined, status })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [isPlatform, page, search, status]);

  // Debounce search / refetch on any query change.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Reset to page 1 whenever the filters change.
  useEffect(() => {
    setPage(1);
  }, [search, status]);

  if (!loadingUser && !isPlatform) {
    return (
      <Shell>
        <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
          <ShieldCheck className="w-10 h-10 text-violet-600 mx-auto mb-3" />
          <p className="font-medium text-foreground">Platform admins only</p>
          <p className="text-sm text-muted-foreground mt-1">
            Only a platform admin can manage teacher accounts.
          </p>
        </div>
      </Shell>
    );
  }

  const teachers = data?.teachers ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <Shell>
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Teachers</h1>
          <p className="text-muted-foreground mt-1">
            {total} teacher{total === 1 ? "" : "s"} · created and managed by platform admins.
          </p>
        </div>
        <Link href="/admin/teachers/create">
          <Button className="rounded-xl h-11 bg-violet-600 hover:bg-violet-700 text-white">
            <UserPlus className="w-4 h-4 mr-2" /> Create teacher
          </Button>
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, mobile, designation…"
            className="rounded-xl h-11 pl-9"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TeacherStatusFilter)}
          className={selectClass}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-gray-100 dark:border-gray-700">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Designation</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && teachers.length === 0 ? (
                <RowMessage>Loading…</RowMessage>
              ) : teachers.length === 0 ? (
                <RowMessage>No teachers match your filters.</RowMessage>
              ) : (
                teachers.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{t.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.designation || "—"}</td>
                    <td className="px-4 py-3">
                      <StatusPill active={t.active} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/teachers/${t.id}`}
                        className="text-violet-600 font-medium hover:underline"
                      >
                        Manage
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

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full ${
        active
          ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300"
          : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
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
