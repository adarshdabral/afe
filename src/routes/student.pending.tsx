import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, CheckCircle2, XCircle, Sparkles, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import { myRegistrationFn } from "@/lib/auth/registration.functions";

export const Route = createFileRoute("/student/pending")({
  head: () => ({ meta: [{ title: "Pending Approval — AI For Everyone" }] }),
  component: PendingApproval,
});

function PendingApproval() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { authUser, logout } = useApp();

  // Poll the workflow so the screen advances the moment a teacher decides.
  const { data } = useQuery({
    queryKey: ["myRegistration"],
    queryFn: () => myRegistrationFn(),
    refetchInterval: 4000,
  });

  const request = data?.request ?? null;
  const status = request?.status ?? "pending";

  useEffect(() => {
    if (status === "approved") {
      // Refresh the session principal (now approved) then enter the course.
      queryClient
        .invalidateQueries({ queryKey: ["currentUser"] })
        .then(() => navigate({ to: "/student/dashboard" }));
    }
  }, [status, queryClient, navigate]);

  const rejected = status === "rejected";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="absolute top-6 left-6 flex items-center gap-2 font-semibold text-foreground">
        <span className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center">
          <Sparkles className="w-4 h-4" />
        </span>
        AI For Everyone
      </div>

      <div className="w-full max-w-md bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
        <div
          className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-5 ${
            rejected ? "bg-red-100 dark:bg-red-500/20" : "bg-amber-100 dark:bg-amber-500/20"
          }`}
        >
          {rejected ? (
            <XCircle className="w-8 h-8 text-red-500" />
          ) : (
            <Clock className="w-8 h-8 text-amber-500" />
          )}
        </div>

        {rejected ? (
          <>
            <h1 className="text-2xl font-bold text-foreground">Registration not approved</h1>
            <p className="text-muted-foreground mt-2">
              {request?.reason
                ? request.reason
                : "Your teacher did not approve this registration request."}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-foreground">Awaiting teacher approval</h1>
            <p className="text-muted-foreground mt-2">
              Hi {authUser?.name?.split(" ")[0] ?? "there"}, your registration has been submitted.
              Course access unlocks as soon as your teacher approves it.
            </p>
          </>
        )}

        {request && (
          <div className="mt-6 text-left text-sm bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 space-y-1.5">
            <Row label="School" value={request.schoolName} />
            <Row label="Teacher" value={request.teacherName} />
            <Row label="Class" value={`Class ${request.className} · Roll ${request.rollNumber}`} />
            <Row
              label="Status"
              value={
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    rejected
                      ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                  }`}
                >
                  {rejected ? "Rejected" : "Pending"}
                </span>
              }
            />
          </div>
        )}

        {!rejected && (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-violet-500" />
            This page updates automatically — no need to refresh.
          </div>
        )}

        <Button variant="outline" onClick={logout} className="mt-6 w-full rounded-xl gap-2">
          <LogOut className="w-4 h-4" /> Sign out
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right">{value}</span>
    </div>
  );
}
