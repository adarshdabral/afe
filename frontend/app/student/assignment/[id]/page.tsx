"use client";

import { useRef, useState } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import { Calendar, Upload, FileText, X, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { assignments as mockAssignments, courses, type Assignment } from "@/data/mock";

export default function AssignmentPage() {
  const id = useParams<{ id: string }>().id;
  const initial = mockAssignments.find((x) => x.id === id);
  if (!initial) notFound();

  const [assignment, setAssignment] = useState<Assignment>(initial);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const course = courses.find((c) => c.id === assignment.courseId);
  const due = new Date(assignment.dueDate);
  const daysLeft = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const overdue = daysLeft < 0;
  const urgent = daysLeft >= 0 && daysLeft < 3;

  const submit = () => {
    if (!file) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setAssignment({ ...assignment, status: "submitted", submittedFile: file.name });
      toast.success("Assignment submitted!");
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <Link href="/student/dashboard" className="text-sm text-violet-600 hover:underline">← Back to dashboard</Link>
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">{course?.title}</p>
          <h1 className="text-3xl font-bold text-foreground mt-1">{assignment.title}</h1>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" /> Due {assignment.dueDate}
          </span>
          {assignment.status === "pending" && (
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${overdue ? "bg-red-100 text-red-700 dark:bg-red-500/20" : urgent ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20" : "bg-gray-100 dark:bg-gray-800 text-foreground"}`}>
              {overdue ? "Overdue" : `${daysLeft}d left`}
            </span>
          )}
          <span className="text-xs px-2 py-1 rounded-full font-medium bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300">
            {assignment.maxMarks} marks
          </span>
        </div>

        <div className="mt-6 bg-card rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="font-semibold text-foreground">Instructions</h2>
          <p className="mt-2 text-sm text-foreground">{assignment.description}</p>
        </div>

        {assignment.status === "pending" && (
          <>
            <div onClick={() => inputRef.current?.click()}
              className="mt-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-16 text-center cursor-pointer hover:border-violet-400 transition-colors">
              <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
              <p className="mt-4 text-sm text-foreground">Drag & drop or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">Any file type accepted</p>
              <input ref={inputRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            {file && (
              <div className="mt-3 flex items-center justify-between p-3 bg-card border border-gray-100 dark:border-gray-700 rounded-xl">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-5 h-5 text-violet-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <button onClick={() => setFile(null)} className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center"><X className="w-4 h-4" /></button>
              </div>
            )}
            <Button disabled={!file || loading} onClick={submit} className="mt-6 w-full rounded-xl h-11 bg-violet-600 hover:bg-violet-700 text-white">
              {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Submit Assignment"}
            </Button>
          </>
        )}

        {assignment.status === "submitted" && (
          <div className="mt-6 space-y-4">
            <div className="bg-card border border-gray-100 dark:border-gray-700 rounded-2xl p-5 flex items-center gap-4">
              <FileText className="w-10 h-10 text-violet-600" />
              <div className="flex-1">
                <p className="font-medium text-foreground">{assignment.submittedFile}</p>
                <p className="text-xs text-muted-foreground">Submitted today</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 font-medium">Under Review</span>
            </div>
            <div className="bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 rounded-2xl p-5">
              <p className="text-sm text-foreground">Your assignment is being reviewed. We'll notify you once feedback is ready.</p>
            </div>
          </div>
        )}

        {assignment.status === "graded" && (
          <div className="mt-6 space-y-4">
            <div className="bg-card border border-gray-100 dark:border-gray-700 rounded-2xl p-5 flex items-center gap-4">
              <FileText className="w-10 h-10 text-violet-600" />
              <div className="flex-1">
                <p className="font-medium text-foreground">{assignment.submittedFile}</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 font-medium">Graded</span>
            </div>
            <div className="bg-card border border-gray-100 dark:border-gray-700 rounded-2xl p-6">
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold text-foreground">{assignment.grade}</span>
                <span className="text-muted-foreground">/ {assignment.maxMarks}</span>
              </div>
              <div className="mt-3 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-violet-600" style={{ width: `${assignment.grade}%` }} />
              </div>
            </div>
            <div className="bg-card border border-gray-100 dark:border-gray-700 rounded-2xl p-6">
              <Quote className="w-6 h-6 text-violet-600" />
              <p className="mt-3 text-foreground italic">{assignment.feedback}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
