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
import { CourseDetailsEditor } from "@/components/course/CourseDetailsEditor";
import { Reorderable, move } from "@/components/course/Reorderable";
import { useApp } from "@/context/AppContext";
import {
  adminGetCourse,
  archiveCourse,
  createModule,
  deleteCourse,
  deleteModule,
  publishCourse,
  reorderModules,
  unpublishCourse,
  updateModule,
  type CourseTree,
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
    setSelectedModuleId(id);
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

      <section className="mb-4 border-y border-border py-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Course sections</h2>
        <div className="flex flex-wrap gap-2">
          {tree.sections.map((section) => (
            <Link
              key={section.kind}
              href={`/admin/courses/${courseId}/sections/${section.kind}`}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-secondary"
            >
              {section.title}
              <span className="text-xs text-muted-foreground">Edit</span>
            </Link>
          ))}
        </div>
      </section>

      <CourseDetailsEditor course={tree} onSaved={() => void refresh()} />

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
                    {(() => {
                      const r = tree.modules.find((x) => x.id === m.id)?.readiness;
                      if (!r) return null;
                      return r.ready ? (
                        <span className="mt-0.5 inline-block text-[10px] font-medium text-green-700 dark:text-green-400">
                          ✓ description · objectives · assessment
                        </span>
                      ) : (
                        <span className="mt-0.5 block text-[10px] font-medium text-amber-700 dark:text-amber-400">
                          Needs {r.missing.join(", ")}
                        </span>
                      );
                    })()}
                  </button>
                  <div className="flex gap-1 mt-1">
                    <MiniBtn onClick={() => renameModule(m)}>Rename</MiniBtn>
                    <MiniBtn
                      onClick={() => toggleModulePublish(m)}
                      disabled={!m.isPublished && tree.modules.find((x) => x.id === m.id)?.readiness?.ready === false}
                      title={
                        !m.isPublished && tree.modules.find((x) => x.id === m.id)?.readiness?.ready === false
                          ? "Add a description, learning objectives and a published assessment first (Open the module)"
                          : undefined
                      }
                    >
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

        {/* Right: summary of the selected module */}
        <section className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          {!selectedModuleId ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Select a module to see its lesson and topic structure.
            </p>
          ) : (
            <>
              {(() => {
                const selected = tree.modules.find((m) => m.id === selectedModuleId);
                return selected ? (
                  <>
                    <h2 className="font-semibold text-foreground">{selected.title}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{selected.lessons.length} lessons · {selected.lessons.reduce((sum, lesson) => sum + lesson.topics.length, 0)} topics</p>
                    <ol className="mt-4 divide-y divide-border">
                      {selected.lessons.map((lesson) => (
                        <li key={lesson.id} className="py-3">
                          <p className="text-sm font-medium text-foreground">{lesson.title}</p>
                          <p className="text-xs text-muted-foreground">{lesson.topics.length} topics</p>
                        </li>
                      ))}
                    </ol>
                    <Link href={`/admin/courses/${courseId}/modules/${selected.id}`} className="mt-4 inline-flex items-center gap-1 text-sm text-violet-600 hover:underline">
                      Edit lessons and topics <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </>
                ) : null;
              })()}
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

function MiniBtn({
  onClick,
  children,
  disabled,
  title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="text-[11px] px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}
