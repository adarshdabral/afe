"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, Circle, Eye, EyeOff, NotebookPen, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TopicEditor } from "@/components/course/TopicEditor";
import { AssessmentBuilder, NeedsContentBadge } from "@/components/course/AssessmentBuilder";
import { createAssessment } from "@/lib/api/assessments";
import { orderedLessonRows } from "@/lib/learn";
import { ObjectivesEditor } from "@/components/course/ObjectivesEditor";
import { Reorderable, move } from "@/components/course/Reorderable";
import { useApp } from "@/context/AppContext";
import {
  adminGetCourse,
  createLesson,
  createTopic,
  deleteLesson,
  deleteTopic,
  reorderLessonItems,
  reorderLessons,
  updateLesson,
  updateTopic,
  updateModule,
  type Lesson,
  type ModuleWithLessons,
  type Topic,
} from "@/lib/api/courses";

export default function ModuleEditor() {
  const params = useParams<{ courseId: string; moduleId: string }>();
  const { courseId, moduleId } = params;
  const { role, loadingUser } = useApp();
  const isPlatform = role === "platform_admin";

  const [module, setModule] = useState<ModuleWithLessons | null>(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [form, setForm] = useState({ title: "", description: "", learningObjectives: [] as string[], estimatedDurationMinutes: 0 });
  const [lessons, setLessons] = useState<ModuleWithLessons["lessons"]>([]);
  const [lessonDirty, setLessonDirty] = useState(false);
  const [editingTopic, setEditingTopic] = useState<{ lessonId: string; topic?: Topic } | null>(null);
  /** The lesson whose assignment panel is open. */
  const [openAssignment, setOpenAssignment] = useState<string | null>(null);
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
        learningObjectives: m.learningObjectives ?? [],
        estimatedDurationMinutes: m.estimatedDurationMinutes,
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
        learningObjectives: form.learningObjectives.map((o) => o.trim()).filter(Boolean),
        estimatedDurationMinutes: form.estimatedDurationMinutes,
      });
      toast.success("Module saved.");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save module");
    } finally {
      setBusy(false);
    }
  };

  /** Publish / hide. Publishing is refused by the API until the module is complete. */
  const togglePublish = async () => {
    if (!module) return;
    setBusy(true);
    try {
      await updateModule(moduleId, { isPublished: !module.isPublished });
      toast.success(module.isPublished ? "Module hidden from students." : "Module published.");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change visibility");
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

  const saveLesson = async (lesson?: Lesson) => {
    const title = prompt(lesson ? "Lesson name" : "New lesson name", lesson?.title ?? "");
    if (title == null || !title.trim()) return;
    const description = prompt("Optional lesson description", lesson?.description ?? "");
    if (description == null) return;
    setBusy(true);
    try {
      if (lesson) await updateLesson(lesson.id, { title: title.trim(), description });
      else await createLesson(moduleId, { title: title.trim(), description });
      toast.success("Lesson saved.");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save lesson");
    } finally {
      setBusy(false);
    }
  };

  const saveTopic = async (lessonId: string, topic: Topic | undefined, input: Parameters<typeof createTopic>[1]) => {
    setBusy(true);
    try {
      if (topic) await updateTopic(topic.id, input);
      else await createTopic(lessonId, input);
      setEditingTopic(null);
      toast.success("Topic saved.");
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

              <PublishPanel module={module} busy={busy} onToggle={togglePublish} />

              <section className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 space-y-4 mt-6">
                <div>
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => set("title", e.target.value)} className="mt-1.5 rounded-xl h-10" />
                </div>
                <div>
                  <Label>
                    Module description <span className="text-red-500">*</span>
                  </Label>
                  <textarea
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    rows={3}
                    placeholder="What this module covers and why it matters"
                    className="mt-1.5 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground"
                  />
                </div>
                <div>
                  <Label>
                    Learning objectives <span className="text-red-500">*</span>
                  </Label>
                  <p className="text-[12px] text-muted-foreground mt-0.5 mb-2">
                    What learners will be able to do after this module — at least one.
                  </p>
                  <ObjectivesEditor value={form.learningObjectives} onChange={(v) => set("learningObjectives", v)} />
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
                </div>
                <Button onClick={saveModule} disabled={busy} className="rounded-xl h-10 bg-violet-600 hover:bg-violet-700 text-white">
                  <Save className="w-4 h-4 mr-1" /> Save module
                </Button>
              </section>

              <section className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 mt-6">
                {editingTopic ? (
                  <>
                    <h2 className="font-semibold text-foreground mb-4">
                      {editingTopic.topic ? "Edit topic" : "New topic"}
                    </h2>
                    <TopicEditor
                      relatedOptions={lessons.flatMap((l) => l.topics.map((t) => ({ id: t.id, title: t.title })))}
                      topic={editingTopic.topic}
                      onSave={(input) => saveTopic(editingTopic.lessonId, editingTopic.topic, input)}
                      onCancel={() => setEditingTopic(null)}
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
                        <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => void saveLesson()}>
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
                        renderItem={(lesson) => (
                          <article className="p-3 border-b border-border last:border-0">
                            <div className="flex items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">{lesson.title}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {lesson.topics.length} topics · {lesson.assignments.length} assignment{lesson.assignments.length === 1 ? "" : "s"}
                                </p>
                              </div>
                              <button onClick={() => void saveLesson(lesson)} className="text-xs text-muted-foreground hover:text-foreground">Rename</button>
                              <button onClick={() => removeLesson(lesson)} className="text-xs text-red-600 hover:underline">Delete</button>
                              <Button size="sm" variant="outline" className="h-8" onClick={() => setEditingTopic({ lessonId: lesson.id })}>
                                <Plus className="w-3.5 h-3.5 mr-1" /> Add topic
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={async () => {
                                  try {
                                    const a = await createAssessment({ lessonId: lesson.id, title: "Lesson assignment" });
                                    toast.success("Assignment added at the end of the lesson.");
                                    setOpenAssignment(a.id);
                                    await refresh();
                                  } catch (err) {
                                    toast.error(err instanceof Error ? err.message : "Could not add assignment");
                                  }
                                }}
                              >
                                <NotebookPen className="w-3.5 h-3.5 mr-1" /> Add assignment
                              </Button>
                            </div>
                            <LessonItemsEditor
                              lesson={lesson}
                              openAssignment={openAssignment}
                              setOpenAssignment={setOpenAssignment}
                              onEditTopic={(topic) => setEditingTopic({ lessonId: lesson.id, topic })}
                              onChanged={refresh}
                            />
                          </article>
                        )}
                      />
                    )}
                  </>
                )}
              </section>

              <section className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 mt-6">
                <h2 className="font-semibold text-foreground">
                  Graded module assessment <span className="text-[12px] font-normal text-muted-foreground">(optional)</span>
                </h2>
                <p className="text-[12px] text-muted-foreground mt-0.5 mb-3">
                  One test for the whole module. When published, learners take it after every lesson (and required assignment), and passing it completes the module and unlocks the next one.
                </p>
                <AssessmentBuilder moduleId={moduleId} onChange={() => void refresh()} />
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/** Publish checklist: description + objectives are required; the module assessment is
 *  optional (shown for information — if published, students must pass it). */
function PublishPanel({ module, busy, onToggle }: { module: ModuleWithLessons; busy: boolean; onToggle: () => void }) {
  const r = module.readiness;
  const items = [
    { ok: !!r?.hasDescription, label: "Module description" },
    { ok: !!r?.hasObjectives, label: "At least one learning objective" },
  ];
  const assessmentNote = !r?.hasAssessment
    ? "No module assessment — optional. The module completes once its lessons are done."
    : r.assessmentPublished
      ? `Module assessment published (${r.questionCount} question${r.questionCount === 1 ? "" : "s"}) — students must pass it to complete the module.`
      : "Module assessment is a draft — students won't see it until it's published (optional).";
  const ready = !!r?.ready;
  return (
    <section
      className={`rounded-2xl border p-5 ${
        module.isPublished
          ? "border-green-600/30 bg-green-600/[0.05]"
          : ready
            ? "border-violet-600/30 bg-violet-600/[0.04]"
            : "border-amber-500/30 bg-amber-500/[0.05]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">
            {module.isPublished ? "Published — visible to students" : ready ? "Ready to publish" : "Not ready to publish"}
          </p>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            A module needs a description and at least one learning objective. Lesson assignments and the module assessment are optional.
          </p>
        </div>
        <Button
          onClick={onToggle}
          disabled={busy || (!module.isPublished && !ready)}
          title={!module.isPublished && !ready ? `Still needed: ${r?.missing.join(", ")}` : undefined}
          className={`rounded-xl h-10 ${module.isPublished ? "" : "bg-violet-600 hover:bg-violet-700 text-white"}`}
          variant={module.isPublished ? "outline" : "default"}
        >
          {module.isPublished ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
          {module.isPublished ? "Hide module" : "Publish module"}
        </Button>
      </div>
      <ul className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {items.map((i) => (
          <li key={i.label} className={`flex items-center gap-2 text-[13px] ${i.ok ? "text-foreground" : "text-muted-foreground"}`}>
            {i.ok ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> : <Circle className="w-4 h-4 shrink-0" />}
            {i.label}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-muted-foreground">{assessmentNote}</p>
    </section>
  );
}

/**
 * A lesson's topics AND assignments in their real order (drafts included), with
 * move up/down (one combined order), edit/delete, and each assignment's builder
 * inline. Draft topics and "needs content" items are flagged (admin-only).
 */
function LessonItemsEditor({
  lesson,
  openAssignment,
  setOpenAssignment,
  onEditTopic,
  onChanged,
}: {
  lesson: ModuleWithLessons["lessons"][number];
  openAssignment: string | null;
  setOpenAssignment: (id: string | null) => void;
  onEditTopic: (topic: Topic) => void;
  onChanged: () => Promise<void>;
}) {
  const rows = orderedLessonRows(lesson, true);
  const [busy, setBusy] = useState(false);
  if (rows.length === 0) return <p className="text-[12px] text-muted-foreground pl-3 mt-2">No topics or assignments yet.</p>;

  const moveRow = async (from: number, to: number) => {
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setBusy(true);
    try {
      await reorderLessonItems(
        lesson.id,
        next.map((r) => (r.kind === "topic" ? { kind: "topic" as const, id: r.topic.id } : { kind: "assignment" as const, id: r.assignment.id })),
      );
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reorder");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ul className="mt-2 space-y-1">
      {rows.map((row, i) => {
        const id = row.kind === "topic" ? row.topic.id : row.assignment.id;
        const arrows = (
          <span className="flex items-center shrink-0">
            <button aria-label="Move up" disabled={busy || i === 0} onClick={() => void moveRow(i, i - 1)} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button aria-label="Move down" disabled={busy || i === rows.length - 1} onClick={() => void moveRow(i, i + 1)} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </span>
        );
        if (row.kind === "topic") {
          const topic = row.topic;
          return (
            <li key={id} className="flex items-center gap-2 py-1.5 pl-3 rounded-lg hover:bg-secondary/40">
              {arrows}
              <span className="text-sm text-foreground flex-1 min-w-0">
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="truncate">{topic.title}</span>
                  {topic.isPublished === false && <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">Draft · hidden from students</span>}
                  {topic.contentStatus === "needs_content" && <NeedsContentBadge note={topic.adminNote} />}
                </span>
                {topic.adminNote && <span className="block text-[11px] text-muted-foreground whitespace-pre-line">{topic.adminNote}</span>}
              </span>
              <span className="text-[11px] text-muted-foreground shrink-0">
                {topic.contentType.replace("_", " ")}
                {topic.contentType === "discussion" && topic.discussion?.required ? " · required" : ""}
              </span>
              <button onClick={() => onEditTopic(topic)} className="text-xs text-muted-foreground hover:text-foreground">Edit</button>
              <button
                onClick={async () => {
                  if (!confirm(`Delete topic “${topic.title}”?`)) return;
                  await deleteTopic(topic.id);
                  await onChanged();
                }}
                className="text-xs text-red-600 hover:underline"
              >
                Delete
              </button>
            </li>
          );
        }
        const a = row.assignment;
        const open = openAssignment === a.id;
        return (
          <li key={id} className="rounded-xl border border-border bg-secondary/40 pl-3 pr-2 py-2">
            <div className="flex items-center gap-2">
              {arrows}
              <NotebookPen className="w-4 h-4 text-violet-600 shrink-0" aria-hidden />
              <span className="text-sm text-foreground flex-1 min-w-0">
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="truncate">Assignment: {a.title}</span>
                  {a.contentStatus === "needs_content" && <NeedsContentBadge note={a.adminNote} />}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {a.isGraded ? "graded" : "not graded"}
                  {a.isRequired ? " · required" : " · optional"}
                  {a.isPublished ? " · published" : " · draft"}
                </span>
              </span>
              <button onClick={() => setOpenAssignment(open ? null : a.id)} className="text-xs text-violet-600 hover:underline shrink-0">
                {open ? "Close" : "Edit"}
              </button>
            </div>
            {open && (
              <div className="mt-3 border-t border-border pt-3">
                <AssessmentBuilder assessmentId={a.id} onChange={() => void onChanged()} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
