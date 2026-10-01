"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LessonEditor } from "@/components/course/LessonEditor";
import { AssessmentBuilder } from "@/components/course/AssessmentBuilder";
import { Reorderable, move } from "@/components/course/Reorderable";
import { useApp } from "@/context/AppContext";
import {
  adminGetCourse,
  createLesson,
  deleteLesson,
  reorderLessons,
  updateLesson,
  updateModule,
  type CreateLessonInput,
  type Lesson,
  type ModuleWithLessons,
} from "@/lib/api/courses";

export default function ModuleEditor() {
  const params = useParams<{ courseId: string; moduleId: string }>();
  const { courseId, moduleId } = params;
  const { role, loadingUser } = useApp();
  const isPlatform = role === "platform_admin";

  const [module, setModule] = useState<ModuleWithLessons | null>(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [form, setForm] = useState({ title: "", description: "", estimatedDurationMinutes: 0, isPublished: false });
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonDirty, setLessonDirty] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | "new" | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const tree = await adminGetCourse(courseId);
      const m = tree.modules.find((x) => x.id === moduleId);
      if (!m) {
        setStatus("error");
        return;
      }
      setCourseTitle(tree.title);
      setModule(m);
      setForm({
        title: m.title,
        description: m.description,
        estimatedDurationMinutes: m.estimatedDurationMinutes,
        isPublished: m.isPublished,
      });
      setLessons(m.lessons);
      setLessonDirty(false);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [courseId, moduleId]);

  useEffect(() => {
    if (isPlatform) void refresh();
  }, [isPlatform, refresh]);

  const saveModule = async () => {
    setBusy(true);
    try {
      await updateModule(moduleId, {
        title: form.title.trim(),
        description: form.description,
        estimatedDurationMinutes: form.estimatedDurationMinutes,
        isPublished: form.isPublished,
      });
      toast.success("Module saved.");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save module");
    } finally {
      setBusy(false);
    }
  };

  const saveLessonOrder = async () => {
    setBusy(true);
    try {
      await reorderLessons(moduleId, lessons.map((l) => l.id));
      toast.success("Lesson order saved.");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save order");
    } finally {
      setBusy(false);
    }
  };

  const saveLesson = async (input: CreateLessonInput) => {
    setBusy(true);
    try {
      if (editingLesson && editingLesson !== "new") await updateLesson(editingLesson.id, input);
      else await createLesson(moduleId, input);
      setEditingLesson(null);
      toast.success("Lesson saved.");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const removeLesson = async (l: Lesson) => {
    if (!confirm(`Delete "${l.title}"?`)) return;
    setBusy(true);
    try {
      await deleteLesson(l.id);
      toast.success("Lesson deleted.");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="min-h-screen flex bg-background">
      <AdminSidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <Link
            href={`/admin/courses/${courseId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to builder
          </Link>

          {!loadingUser && !isPlatform ? (
            <p className="text-muted-foreground">Platform admins only.</p>
          ) : status === "loading" ? (
            <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ) : status === "error" || !module ? (
            <div className="bg-card rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center">
              <p className="font-medium text-foreground">Module not found</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{courseTitle}</p>
              <h1 className="text-2xl font-bold text-foreground mb-4">Edit module</h1>

              <section className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => set("title", e.target.value)} className="mt-1.5 rounded-xl h-10" />
                </div>
                <div>
                  <Label>Description</Label>
                  <textarea
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    rows={3}
                    className="mt-1.5 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Estimated duration (min)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.estimatedDurationMinutes}
                      onChange={(e) => set("estimatedDurationMinutes", Number(e.target.value) || 0)}
                      className="mt-1.5 rounded-xl h-10"
                    />
                  </div>
                  <label className="flex items-center gap-2 mt-7 text-sm text-foreground">
                    <input type="checkbox" checked={form.isPublished} onChange={(e) => set("isPublished", e.target.checked)} className="h-4 w-4" />
                    Published (visible to students)
                  </label>
                </div>
                <Button onClick={saveModule} disabled={busy} className="rounded-xl h-10 bg-violet-600 hover:bg-violet-700 text-white">
                  <Save className="w-4 h-4 mr-1" /> Save module
                </Button>
              </section>

              <section className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 mt-6">
                {editingLesson ? (
                  <>
                    <h2 className="font-semibold text-foreground mb-4">
                      {editingLesson === "new" ? "New lesson" : "Edit lesson"}
                    </h2>
                    <LessonEditor
                      lesson={editingLesson === "new" ? undefined : editingLesson}
                      onSave={saveLesson}
                      onCancel={() => setEditingLesson(null)}
                      saving={busy}
                    />
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-semibold text-foreground">Lessons</h2>
                      <div className="flex gap-2">
                        {lessonDirty && (
                          <Button size="sm" className="h-8 rounded-lg bg-violet-600 hover:bg-violet-700 text-white" disabled={busy} onClick={saveLessonOrder}>
                            <Save className="w-3.5 h-3.5 mr-1" /> Save order
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => setEditingLesson("new")}>
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add lesson
                        </Button>
                      </div>
                    </div>
                    {lessons.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-8 text-center">No lessons yet.</p>
                    ) : (
                      <Reorderable
                        items={lessons}
                        onMove={(from, to) => {
                          setLessons((l) => move(l, from, to));
                          setLessonDirty(true);
                        }}
                        renderItem={(l) => (
                          <div className="flex items-center gap-3 p-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">{l.title}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {l.contentType.replace("_", " ")}
                                {l.isPreview ? " · preview" : ""}
                              </p>
                            </div>
                            <button onClick={() => setEditingLesson(l)} className="text-[11px] px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground">
                              Edit
                            </button>
                            <button onClick={() => removeLesson(l)} className="text-[11px] px-1.5 py-0.5 rounded text-red-600 hover:underline">
                              Delete
                            </button>
                          </div>
                        )}
                      />
                    )}
                  </>
                )}
              </section>

              <section className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 mt-6">
                <h2 className="font-semibold text-foreground mb-3">Assessment</h2>
                <AssessmentBuilder moduleId={moduleId} />
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
