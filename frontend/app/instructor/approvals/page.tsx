"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, ChevronLeft, ChevronRight, Check, X, Inbox } from "lucide-react";
import { toast } from "sonner";
import { InstructorSidebar } from "@/components/InstructorSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/AppContext";
import {
  registrationQueue,
  decideRegistration,
  type QueueResult,
  type RegistrationRequest,
  type StatusFilter,
} from "@/lib/api/registrations";

const PAGE_SIZE = 8;
const TABS: { value: StatusFilter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

// Teacher approval queue (also reachable by platform admins, who see every
// request). Guarded by ROUTE_ACCESS["/instructor"] in middleware; API enforces
// the role + teacher ownership.
export default function Approvals() {
  const { role } = useApp();
  const isStaff = role === "teacher" || role === "platform_admin";

  const [tab, setTab] = useState<StatusFilter>("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<QueueResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!isStaff) return;
    setLoading(true);
    registrationQueue({ status: tab, page, pageSize: PAGE_SIZE, search: search.trim() || undefined })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [isStaff, tab, page, search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [tab, search]);

  const decide = async (req: RegistrationRequest, decision: "approved" | "rejected") => {
    setActingId(req.id);
    try {
      const reason =
        decision === "rejected"
          ? window.prompt(`Reason for rejecting ${req.studentName}? (optional)`) ?? undefined
          : undefined;
      await decideRegistration({ requestId: req.id, decision, reason });
      toast.success(`${req.studentName} ${decision}.`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActingId(null);
    }
  };

  if (!isStaff) {
    return (
      <Shell>
        <p className="text-muted-foreground">You do not have access to this page.</p>
      </Shell>
    );
  }

  const requests = data?.requests ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <Shell>
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Student Approvals</h1>
        <p className="text-muted-foreground mt-1">
          Review and decide registrations {role === "teacher" ? "assigned to you" : "across all teachers"}.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
              tab === t.value
                ? "bg-violet-600 text-white"
                : "bg-card border border-gray-200 dark:border-gray-700 text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, roll, school…"
            className="rounded-xl h-10 pl-9"
          />
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        {loading && requests.length === 0 ? (
          <Empty>Loading…</Empty>
        ) : requests.length === 0 ? (
          <Empty>
            <Inbox className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            No {tab === "all" ? "" : tab} registrations.
          </Empty>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {requests.map((r) => (
              <li key={r.id} className="p-4 flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{r.studentName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {r.email || r.mobile} · {r.schoolName || "—"}
                  </p>
                  {role !== "teacher" && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Assigned to {r.teacherName}
                    </p>
                  )}
                </div>
                <StatusPill status={r.status} />
                {r.status === "pending" ? (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      disabled={actingId === r.id}
                      onClick={() => decide(r, "approved")}
                      className="rounded-lg h-9 bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Check className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actingId === r.id}
                      onClick={() => decide(r, "rejected")}
                      className="rounded-lg h-9"
                    >
                      <X className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {r.status === "rejected" && r.reason ? r.reason : "Decided"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-muted-foreground">
          {data?.total ?? 0} total · page {data?.page ?? 1} of {totalPages}
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
      <InstructorSidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">{children}</div>
      </main>
    </div>
  );
}

function StatusPill({ status }: { status: RegistrationRequest["status"] }) {
  const map = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    approved: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  } as const;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${map[status]}`}>{status}</span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="p-12 text-center text-muted-foreground">{children}</div>;
}
