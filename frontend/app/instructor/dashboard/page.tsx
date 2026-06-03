"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, BookOpen, TrendingUp, Star, PlusCircle, Bell, HelpCircle, Pencil, Trash2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { InstructorSidebar } from "@/components/InstructorSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { adminStats, courses, qna } from "@/data/mock";
import { toast } from "sonner";

const months = ["Dec", "Jan", "Feb", "Mar", "Apr", "May"];
const initialRows = [
  { id: "1", course: courses[0], status: "Published" as const, students: 12480, rating: 4.9 },
  { id: "2", course: courses[1], status: "Published" as const, students: 7200, rating: 4.8 },
  { id: "8", course: courses[7], status: "Pending" as const, students: 0, rating: 0 },
  { id: "9", course: courses[8], status: "Draft" as const, students: 0, rating: 0 },
];

const statusColor: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  Published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  Rejected: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
};

export default function InstructorDashboard() {
  const [rows, setRows] = useState(initialRows);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");

  const data = adminStats.revenuePerMonth.map((v, i) => ({ month: months[i], revenue: v }));
  const stats = [
    { icon: Users, label: "Total Students", value: "1,284" },
    { icon: BookOpen, label: "Active Courses", value: "6" },
    { icon: TrendingUp, label: "Total Revenue", value: "₹48,200" },
    { icon: Star, label: "Avg Rating", value: "4.7" },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      <InstructorSidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <h1 className="text-3xl font-bold text-foreground mb-6">Welcome, Dr Sudhanshu Joshi</h1>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((s) => (
              <div key={s.label} className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300 flex items-center justify-center">
                  <s.icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold text-foreground mt-3">{s.value}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8">
            <h2 className="font-semibold text-foreground mb-4">Revenue — Last 6 Months</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }} />
                  <Line type="monotone" dataKey="revenue" stroke="#6C63FF" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">My Courses</h2>
              <Link href="/instructor/create"><Button className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white"><PlusCircle className="w-4 h-4" /> Create New Course</Button></Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 text-left text-muted-foreground">
                    <th className="py-3 font-medium">Course</th>
                    <th className="py-3 font-medium">Status</th>
                    <th className="py-3 font-medium">Students</th>
                    <th className="py-3 font-medium">Rating</th>
                    <th className="py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800">
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg shrink-0" style={{ background: r.course.thumbnailColor }} />
                          <p className="font-medium text-foreground truncate max-w-xs">{r.course.title}</p>
                        </div>
                      </td>
                      <td className="py-3"><span className={`text-xs px-2 py-1 rounded font-medium ${statusColor[r.status]}`}>{r.status}</span></td>
                      <td className="py-3 text-foreground">{r.students.toLocaleString()}</td>
                      <td className="py-3 text-foreground">{r.rating > 0 ? r.rating : "—"}</td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          <Link href="/instructor/create"><Button variant="ghost" size="icon" className="rounded-xl"><Pencil className="w-4 h-4" /></Button></Link>
                          <Button variant="ghost" size="icon" className="rounded-xl text-red-600"
                            onClick={() => { if (confirm("Delete this course?")) { setRows(rows.filter((x) => x.id !== r.id)); toast.success("Course deleted"); } }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="font-semibold text-foreground mb-4">Recent Activity</h2>
              <ul className="space-y-3">
                {["Ananya R.", "Rohan S.", "Maya L.", "Karim B.", "Priya V."].map((n, i) => (
                  <li key={n} className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-semibold">{n.split(" ").map((x) => x[0]).join("")}</div>
                    <p className="flex-1 text-foreground"><span className="font-medium">{n}</span> enrolled in <span className="text-violet-600">{courses[i % 3].title}</span></p>
                    <span className="text-xs text-muted-foreground">{i + 1}h ago</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="font-semibold text-foreground mb-4">Quick Actions</h2>
              <div className="grid grid-cols-3 gap-3">
                <Link href="/instructor/create" className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <PlusCircle className="w-5 h-5 text-violet-600" />
                  <span className="text-xs text-foreground text-center">Create Course</span>
                </Link>
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <Bell className="w-5 h-5 text-violet-600" />
                      <span className="text-xs text-foreground">Announce</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl">
                    <DialogHeader><DialogTitle>Post Announcement</DialogTitle></DialogHeader>
                    <Input placeholder="Title" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} className="rounded-xl" />
                    <Textarea placeholder="Body" value={annBody} onChange={(e) => setAnnBody(e.target.value)} className="rounded-xl" />
                    <Button onClick={() => { setAnnTitle(""); setAnnBody(""); toast.success("Announcement posted!"); }} className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white">Publish</Button>
                  </DialogContent>
                </Dialog>
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <HelpCircle className="w-5 h-5 text-violet-600" />
                      <span className="text-xs text-foreground">Questions</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Student Questions</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      {qna.map((q) => (
                        <div key={q.id} className="border border-gray-100 dark:border-gray-700 rounded-xl p-3">
                          <p className="text-xs text-muted-foreground">{q.askedBy} • {q.timestamp}</p>
                          <p className="text-sm text-foreground mt-1">{q.question}</p>
                        </div>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
