"use client";

import { useMemo, useState } from "react";
import { Users, BookOpen, GraduationCap, Award, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { adminStats } from "@/data/mock";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";

export default function Admin() {
  const { pendingInstructors, pendingCourses, adminUsers, approveInstructor, rejectInstructor, approveCourse, rejectCourse, suspendUser, activateUser } = useApp();
  const [tab, setTab] = useState<"inst" | "course">("inst");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const data = adminStats.signupsPerDay.map((v, i) => ({ day: `D${i + 1}`, signups: v }));
  const filteredUsers = useMemo(() => adminUsers.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())), [adminUsers, search]);
  const perPage = 5;
  const pages = Math.max(1, Math.ceil(filteredUsers.length / perPage));
  const pageUsers = filteredUsers.slice((page - 1) * perPage, page * perPage);

  const stats = [
    { icon: Users, label: "Total Users", value: adminStats.totalUsers.toLocaleString(), trend: "+12%" },
    { icon: BookOpen, label: "Total Courses", value: adminStats.totalCourses.toLocaleString(), trend: "+8%" },
    { icon: GraduationCap, label: "Enrollments", value: adminStats.totalEnrollments.toLocaleString(), trend: "+23%" },
    { icon: Award, label: "Certificates", value: adminStats.certificatesIssued.toLocaleString(), trend: "+15%" },
  ];

  const roleBadge: Record<string, string> = {
    student: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
    instructor: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
    admin: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  };

  return (
    <div className="min-h-screen flex bg-background">
      <AdminSidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <h1 className="text-3xl font-bold text-foreground mb-6">Admin Dashboard</h1>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((s) => (
              <div key={s.label} className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/20 text-violet-600 flex items-center justify-center">
                    <s.icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-emerald-600 inline-flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" /> {s.trend}
                  </span>
                </div>
                <p className="text-2xl font-bold text-foreground mt-3">{s.value}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8">
            <h2 className="font-semibold text-foreground mb-4">New Signups — Last 14 Days</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <Tooltip contentStyle={{ borderRadius: 12 }} />
                  <Bar dataKey="signups" fill="#6C63FF" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8">
            <h2 className="font-semibold text-foreground mb-4">Pending Approvals</h2>
            <div className="flex gap-2 border-b border-gray-100 dark:border-gray-700 mb-4">
              <button onClick={() => setTab("inst")} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === "inst" ? "border-violet-600 text-violet-600" : "border-transparent text-muted-foreground"}`}>
                Instructor Applications ({pendingInstructors.length})
              </button>
              <button onClick={() => setTab("course")} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === "course" ? "border-violet-600 text-violet-600" : "border-transparent text-muted-foreground"}`}>
                Course Reviews ({pendingCourses.length})
              </button>
            </div>

            {tab === "inst" && (
              pendingInstructors.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No pending applications.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-muted-foreground border-b border-gray-100 dark:border-gray-700">
                      <th className="py-2 font-medium">Name</th><th className="py-2 font-medium">Email</th><th className="py-2 font-medium">Applied</th><th className="py-2 font-medium">Expertise</th><th className="py-2 font-medium">Actions</th>
                    </tr></thead>
                    <tbody>
                      {pendingInstructors.map((p) => (
                        <tr key={p.id} className="border-b border-gray-50 dark:border-gray-800">
                          <td className="py-3 text-foreground">{p.name}</td>
                          <td className="py-3 text-muted-foreground">{p.email}</td>
                          <td className="py-3 text-muted-foreground">{p.appliedOn}</td>
                          <td className="py-3 text-foreground">{p.expertise}</td>
                          <td className="py-3"><div className="flex gap-2">
                            <Button size="sm" onClick={() => { approveInstructor(p.id); toast.success("Instructor approved"); }} className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white">Approve</Button>
                            <Button size="sm" variant="outline" onClick={() => { rejectInstructor(p.id); toast.success("Application rejected"); }} className="rounded-xl text-red-600 border-red-300">Reject</Button>
                          </div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {tab === "course" && (
              pendingCourses.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No pending courses.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-muted-foreground border-b border-gray-100 dark:border-gray-700">
                      <th className="py-2 font-medium">Course</th><th className="py-2 font-medium">Instructor</th><th className="py-2 font-medium">Submitted</th><th className="py-2 font-medium">Actions</th>
                    </tr></thead>
                    <tbody>
                      {pendingCourses.map((c) => (
                        <tr key={c.id} className="border-b border-gray-50 dark:border-gray-800">
                          <td className="py-3"><div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg" style={{ background: c.thumbnailColor }} />
                            <p className="font-medium text-foreground">{c.title}</p>
                          </div></td>
                          <td className="py-3 text-foreground">{c.instructorName}</td>
                          <td className="py-3 text-muted-foreground">{c.submittedOn}</td>
                          <td className="py-3"><div className="flex gap-2">
                            <Button size="sm" onClick={() => { approveCourse(c.id); toast.success("Course published"); }} className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white">Approve</Button>
                            <Button size="sm" variant="outline" onClick={() => setRejectId(c.id)} className="rounded-xl text-red-600 border-red-300">Reject</Button>
                          </div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>

          <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">All Users</h2>
              <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search users..." className="rounded-xl w-64" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground border-b border-gray-100 dark:border-gray-700">
                  <th className="py-2 font-medium">User</th><th className="py-2 font-medium">Role</th><th className="py-2 font-medium">Joined</th><th className="py-2 font-medium">Status</th><th className="py-2 font-medium">Actions</th>
                </tr></thead>
                <tbody>
                  {pageUsers.map((u) => (
                    <tr key={u.id} className="border-b border-gray-50 dark:border-gray-800">
                      <td className="py-3"><div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-semibold">{u.name.split(" ").map((x) => x[0]).join("").slice(0,2)}</div>
                        <div><p className="font-medium text-foreground">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></div>
                      </div></td>
                      <td className="py-3"><span className={`text-xs px-2 py-1 rounded font-medium capitalize ${roleBadge[u.role]}`}>{u.role}</span></td>
                      <td className="py-3 text-muted-foreground">{u.joinedDate}</td>
                      <td className="py-3"><span className="inline-flex items-center gap-1.5 text-xs">
                        <span className={`w-2 h-2 rounded-full ${u.status === "active" ? "bg-emerald-500" : "bg-red-500"}`} />
                        <span className="capitalize text-foreground">{u.status}</span>
                      </span></td>
                      <td className="py-3">
                        {u.status === "active"
                          ? <Button size="sm" variant="outline" onClick={() => { suspendUser(u.id); toast.success("User suspended"); }} className="rounded-xl text-red-600 border-red-300">Suspend</Button>
                          : <Button size="sm" onClick={() => { activateUser(u.id); toast.success("User activated"); }} className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white">Activate</Button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded-xl">Prev</Button>
                <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
                <Button variant="outline" size="sm" disabled={page === pages} onClick={() => setPage(page + 1)} className="rounded-xl">Next</Button>
              </div>
            )}
          </div>
        </div>

        <Dialog open={!!rejectId} onOpenChange={(o) => !o && setRejectId(null)}>
          <DialogContent className="rounded-2xl">
            <DialogHeader><DialogTitle>Reject Course</DialogTitle></DialogHeader>
            <Textarea placeholder="Reason for rejection..." value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-xl" />
            <Button onClick={() => { if (rejectId) { rejectCourse(rejectId); toast.success("Course rejected"); } setRejectId(null); setReason(""); }} className="rounded-xl bg-red-500 hover:bg-red-600 text-white">Confirm Reject</Button>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
