"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Save, Eye, EyeOff, Archive, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CourseStatusBadge } from "@/components/course/CourseStatusBadge";
import { LessonEditor } from "@/components/course/LessonEditor";
import { Reorderable, move } from "@/components/course/Reorderable";
import { useApp } from "@/context/AppContext";
import {
  adminGetCourse,
  archiveCourse,
  createLesson,
  createModule,
  deleteCourse,
  deleteLesson,
  deleteModule,
  publishCourse,
  reorderLessons,
  reorderModules,
  unpublishCourse,
  updateLesson,
  updateModule,
  type CourseTree,
  type CreateLessonInput,
  type Lesson,
  type Module,
} from "@/lib/api/courses";

export default function CourseBuilder() {
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;
  const router = useRouter();
  const { role, loadingUser } = useApp();
  const isPlatform = role === "platform_admin";

  const [tree, setTree] = useState<CourseTree | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  const [modules, setModules] = useState<Module[]>([]);
  const [moduleDirty, setModuleDirty] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonDirty, setLessonDirty] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");

  const refresh = useCallback(
    async (keepSelection = true) => {
      try {
        const t = await adminGetCourse(courseId);
        setTree(t);
        setModules(t.modules);
        setModuleDirty(false);
        const nextSelected =
          keepSelection && t.modules.some((m) => m.id === selectedModuleId)
            ? selectedModuleId
            : (t.modules[0]?.id ?? null);
        setSelectedModuleId(nextSelected);
        const sel = t.modules.find((m) => m.id === nextSelected);
        setLessons(sel?.lessons ?? []);
        setLessonDirty(false);
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    },
    [courseId, selectedModuleId],
  );

  useEffect(() => {
    if (isPlatform) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlatform, courseId]);

  const selectModule = (id: string) => {
    if (lessonDirty && !confirm("Discard unsaved lesson order?")) return;
    setSelectedModuleId(id);
    setEditingLesson(null);
    const sel = modules.find((m) => m.id === id) ?? tree?.modules.find((m) => m.id === id);
    setLessons((sel as Module & { lessons?: Lesson[] })?.lessons ?? tree?.modules.find((m) => m.id === id)?.lessons ?? []);
    setLessonDirty(false);
  };

  // --- course status actions ---
  const runCourse = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  // --- modules ---
  const addModule = async () => {
    if (!newModuleTitle.trim()) return;
    setBusy(true);
    try {
      await createModule(courseId, { title: newModuleTitle.trim() });
      setNewModuleTitle("");
      toast.success("Module added.");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add module");
    } finally {
      setBusy(false);
    }
  };

  const saveModuleOrder = () =>
    runCourse(() => reorderModules(courseId, modules.map((m) => m.id)), "Module order saved.");

  const renameModule = async (m: Module) => {
    const title = prompt("Module title", m.title);
    if (title == null || !title.trim()) return;
    await runCourse(() => updateModule(m.id, { title: title.trim() }), "Module renamed.");
  };

  const toggleModulePublish = (m: Module) =>
    runCourse(
      () => updateModule(m.id, { isPublished: !m.isPublished }),
      m.isPublished ? "Module hidden." : "Module published.",
    );

  const removeModule = (m: Module) => {
    if (!confirm(`Delete "${m.title}" and its lessons?`)) return;
    void runCourse(() => deleteModule(m.id), "Module deleted.");
  };

  // --- lessons ---
  const saveLessonOrder = () =>
    runCourse(
      () => reorderLessons(selectedModuleId!, lessons.map((l) => l.id)),
      "Lesson order saved.",
    );

  const saveLesson = async (input: CreateLessonInput) => {
    if (!selectedModuleId) return;
    setBusy(true);
    try {
      if (editingLesson && editingLesson !== "new") {
        await updateLesson(editingLesson.id, input);
      } else {
        await createLesson(selectedModuleId, input);
      }
      setEditingLesson(null);
      toast.success("Lesson saved.");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const removeLesson = (l: Lesson) => {
    if (!confirm(`Delete lesson "${l.title}"?`)) return;
    void runCourse(() => deleteLesson(l.id), "Lesson deleted.");
  };

  if (!loadingUser && !isPlatform) {
    return (
      <Shell>
        <p className="text-muted-foreground">Platform admins only.</p>
      </Shell>
    );
  }
  if (status === "loading") {
    return (
      <Shell>
        <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
      </Shell>
    );
  }
  if (status === "error" || !tree) {
    return (
      <Shell>
        <div className="bg-card rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center">
          <p className="font-medium text-foreground">Course not found</p>
          <button onClick={() => refresh()} className="text-violet-600 underline text-sm mt-2">
            Retry
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Link
        href="/admin/courses"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to courses
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground truncate">{tree.title}</h1>
            <CourseStatusBadge status={tree.status} />
          </div>
          <p className="text-sm text-muted-foreground">/{tree.slug}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tree.status === "published" ? (
            <Button variant="outline" className="rounded-xl h-9" disabled={busy} onClick={() => runCourse(() => unpublishCourse(courseId), "Unpublished.")}>
              <EyeOff className="w-4 h-4 mr-1" /> Unpublish
            </Button>
          ) : (
            <Button className="rounded-xl h-9 bg-green-600 hover:bg-green-700 text-white" disabled={busy} onClick={() => runCourse(() => publishCourse(courseId), "Published.")}>
              <Eye className="w-4 h-4 mr-1" /> Publish
            </Button>
          )}
          <Button variant="outline" className="rounded-xl h-9" disabled={busy || tree.status === "archived"} onClick={() => runCourse(() => archiveCourse(courseId), "Archived.")}>
            <Archive className="w-4 h-4 mr-1" /> Archive
          </Button>
          <Button
            variant="outline"
            className="rounded-xl h-9 text-red-600"
            disabled={busy}
            onClick={() => {
              if (confirm("Soft-delete this course?"))
                void runCourse(async () => {
                  await deleteCourse(courseId);
                  router.push("/admin/courses");
                }, "Course deleted.");
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Left: modules */}
        <section className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground">Modules</h2>
            {moduleDirty && (
              <Button size="sm" className="h-8 rounded-lg bg-violet-600 hover:bg-violet-700 text-white" disabled={busy} onClick={saveModuleOrder}>
                <Save className="w-3.5 h-3.5 mr-1" /> Save order
              </Button>
            )}
          </div>

          {modules.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No modules yet.</p>
          ) : (
            <Reorderable
              items={modules}
              onMove={(from, to) => {
                setModules((m) => move(m, from, to));
                setModuleDirty(true);
              }}
              renderItem={(m) => (
                <div
                  className={`p-2 ${selectedModuleId === m.id ? "bg-violet-50 dark:bg-violet-500/10 rounded-lg" : ""}`}
                >
                  <button onClick={() => selectModule(m.id)} className="block w-full text-left">
                    <span className="text-sm font-medium text-foreground">{m.title}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {m.isPublished ? "published" : "hidden"} ·{" "}
                      {tree.modules.find((x) => x.id === m.id)?.lessons.length ?? 0} lessons
                    </span>
                  </button>
                  <div className="flex gap-1 mt-1">
                    <MiniBtn onClick={() => renameModule(m)}>Rename</MiniBtn>
                    <MiniBtn onClick={() => toggleModulePublish(m)}>
                      {m.isPublished ? "Hide" : "Publish"}
                    </MiniBtn>
                    <Link href={`/admin/courses/${courseId}/modules/${m.id}`} className="text-[11px] px-1.5 py-0.5 rounded text-violet-600 hover:underline inline-flex items-center gap-0.5">
                      Open <ExternalLink className="w-3 h-3" />
                    </Link>
                    <button onClick={() => removeModule(m)} className="text-[11px] px-1.5 py-0.5 rounded text-red-600 hover:underline ml-auto">
                      Delete
                    </button>
                  </div>
                </div>
              )}
            />
          )}

          <div className="mt-3 flex gap-2">
            <Input
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
              placeholder="New module title"
              className="rounded-xl h-9"
              onKeyDown={(e) => e.key === "Enter" && addModule()}
            />
            <Button size="sm" className="h-9 rounded-xl" variant="outline" disabled={busy} onClick={addModule}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </section>

        {/* Right: lessons of selected module */}
        <section className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          {!selectedModuleId ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Select a module to manage its lessons.
            </p>
          ) : editingLesson ? (
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
                  <Button size="sm" className="h-8 rounded-lg" variant="outline" onClick={() => setEditingLesson("new")}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add lesson
                  </Button>
                </div>
              </div>

              {lessons.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No lessons in this module yet.
                </p>
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
                      <MiniBtn onClick={() => setEditingLesson(l)}>Edit</MiniBtn>
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
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background">
      <AdminSidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</div>
      </main>
    </div>
  );
}

function MiniBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="text-[11px] px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      {children}
    </button>
  );
}
