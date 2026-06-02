import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, Inbox, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { InstructorSidebar } from "@/components/InstructorSidebar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { decideRegistrationFn, pendingRegistrationsFn } from "@/lib/auth/registration.functions";

export const Route = createFileRoute("/instructor/approvals")({
  head: () => ({ meta: [{ title: "Student Approvals — AI For Everyone" }] }),
  component: Approvals,
});

function Approvals() {
  const queryClient = useQueryClient();
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["pendingRegistrations"],
    queryFn: () => pendingRegistrationsFn(),
    refetchInterval: 8000,
  });

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["pendingRegistrations"] });

  const approve = async (id: string) => {
    setBusyId(id);
    try {
      await decideRegistrationFn({ data: { requestId: id, decision: "approved" } });
      toast.success("Student approved — access granted.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not approve");
    } finally {
      setBusyId(null);
    }
  };

  const confirmReject = async () => {
    if (!rejectId) return;
    setBusyId(rejectId);
    try {
      await decideRegistrationFn({
        data: { requestId: rejectId, decision: "rejected", reason: reason.trim() || undefined },
      });
      toast.success("Registration rejected.");
      setRejectId(null);
      setReason("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reject");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <InstructorSidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Student Approvals</h1>
            <p className="text-muted-foreground mt-1">
              Verify and approve registration requests from students in your school.
            </p>
          </header>

          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-24 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse"
                />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="bg-card rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
              <Inbox className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600" />
              <h3 className="mt-4 font-semibold text-foreground">No pending requests</h3>
              <p className="text-sm text-muted-foreground mt-1">
                New student registrations will appear here for your approval.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  <div className="w-11 h-11 rounded-full bg-violet-600 text-white flex items-center justify-center shrink-0">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{r.studentName}</p>
                    <p className="text-sm text-muted-foreground">
                      {r.schoolName} · Class {r.className} · Roll {r.rollNumber}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.mobile}
                      {r.email ? ` · ${r.email}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      onClick={() => approve(r.id)}
                      disabled={busyId === r.id}
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                    >
                      <Check className="w-4 h-4" /> Approve
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRejectId(r.id);
                        setReason("");
                      }}
                      disabled={busyId === r.id}
                      className="rounded-xl text-red-600 gap-1"
                    >
                      <X className="w-4 h-4" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Dialog open={!!rejectId} onOpenChange={(open) => !open && setRejectId(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Reject registration</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Optionally tell the student why. They'll see this on their status screen.
          </p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="rounded-xl"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" className="rounded-xl" onClick={() => setRejectId(null)}>
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmReject}
              disabled={!!busyId}
            >
              Reject
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
