"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ClipboardList, Eye, EyeOff, NotebookPen, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addQuestion,
  createAssessment,
  deleteAssessment,
  deleteQuestion,
  getLessonAssignment,
  getModuleAssessment,
  publishAssessment,
  reorderQuestions,
  unpublishAssessment,
  updateAssessment,
  updateQuestion,
  QUESTION_TYPES,
  type Assessment,
  type AssessmentConfig,
  type CreateQuestionInput,
  type Question,
  type QuestionType,
} from "@/lib/api/assessments";

const selectClass = "h-10 px-3 rounded-xl border border-input bg-card text-sm text-foreground";
const areaClass = "mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground";

// Assessment Builder — ONE configuration UI for both a module's graded assessment
// (`moduleId`) and a lesson's assignment (`lessonId`): settings (graded/non-graded,
// passing score, time limit + auto-submit, attempt limit, availability window,
// shuffling, required), questions (add / edit / reorder / delete) and publishing.
// Explicit actions (no auto-save). `onChange` lets the parent refresh after edits.
export function AssessmentBuilder({
  moduleId,
  lessonId,
  onChange,
}: {
  moduleId?: string;
  lessonId?: string;
  onChange?: () => void;
}) {
  const isAssignment = !!lessonId;
  const noun = isAssignment ? "assignment" : "assessment";
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    (lessonId ? getLessonAssignment(lessonId) : getModuleAssessment(moduleId!))
      .then((d) => {
        setAssessment(d.assessment);
        setQuestions(d.questions);
      })
      .catch(() => toast.error(`Could not load the ${noun}`))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, [moduleId, lessonId]);

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
      refresh();
      onChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />;

  if (!assessment) {
    const Icon = isAssignment ? NotebookPen : ClipboardList;
    return (
      <div className="text-center py-6">
        <Icon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground mb-3">
          {isAssignment ? "No assignment for this lesson. Assignments are non-graded by default." : "No assessment for this module yet."}
        </p>
        <Button
          disabled={busy}
          onClick={() =>
            run(
              () => createAssessment(lessonId ? { lessonId, title: "Lesson assignment" } : { moduleId: moduleId!, title: "Module Quiz" }),
              `${isAssignment ? "Assignment" : "Assessment"} created.`,
            )
          }
          className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white"
        >
          <Plus className="w-4 h-4 mr-1" /> Create {noun}
        </Button>
      </div>
    );
  }

  const totalMarks = questions.reduce((s, q) => s + (q.marks ?? 0), 0);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= questions.length) return;
    const ids = questions.map((q) => q.id);
    const [m] = ids.splice(from, 1);
    ids.splice(to, 0, m);
    void run(() => reorderQuestions(assessment.id, ids), "Order saved.");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="font-medium text-foreground">{assessment.title}</p>
          <p className="text-xs text-muted-foreground">
            {assessment.isGraded ? `Graded · pass ${assessment.passingScore}%` : "Not graded"}
            {assessment.timeLimitMinutes > 0 ? ` · ${assessment.timeLimitMinutes} min` : " · untimed"}
            {assessment.maxAttempts > 0 ? ` · ${assessment.maxAttempts} attempt${assessment.maxAttempts === 1 ? "" : "s"}` : " · unlimited attempts"}
            {" · "}
            {assessment.isPublished ? "published" : "draft"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg h-8"
            disabled={busy}
            onClick={() =>
              run(
                () => (assessment.isPublished ? unpublishAssessment(assessment.id) : publishAssessment(assessment.id)),
                assessment.isPublished ? "Unpublished." : "Published.",
              )
            }
          >
            {assessment.isPublished ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
            {assessment.isPublished ? "Unpublish" : "Publish"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg h-8 text-red-600"
            disabled={busy}
            onClick={() => {
              if (confirm(`Delete this ${noun}, its questions and all attempts?`)) void run(() => deleteAssessment(assessment.id), "Deleted.");
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <SettingsForm
        key={assessment.updatedAt}
        assessment={assessment}
        isAssignment={isAssignment}
        totalMarks={totalMarks}
        busy={busy}
        onSave={(patch) => run(() => updateAssessment(assessment.id, patch), "Settings saved.")}
      />

      <div>
        <p className="text-sm font-medium text-foreground mb-2">
          Questions <span className="text-muted-foreground font-normal">· {questions.length} · {totalMarks} marks</span>
        </p>
        <ul className="space-y-2">
          {questions.map((q, i) =>
            editing === q.id ? (
              <li key={q.id}>
                <QuestionForm
                  initial={q}
                  busy={busy}
                  submitLabel="Save question"
                  onCancel={() => setEditing(null)}
                  onSubmit={async (input) => {
                    await run(() => updateQuestion(q.id, input), "Question saved.");
                    setEditing(null);
                  }}
                />
              </li>
            ) : (
              <li key={q.id} className="flex items-start gap-2 rounded-xl border border-gray-100 dark:border-gray-700 p-3">
                <span className="text-xs text-muted-foreground mt-0.5">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{q.question}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {q.type} · {q.marks} mark{q.marks === 1 ? "" : "s"}
                    {q.type === "mcq" && q.correctAnswer ? ` · answer: ${q.correctAnswer}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button aria-label="Move up" disabled={busy || i === 0} onClick={() => move(i, i - 1)} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button aria-label="Move down" disabled={busy || i === questions.length - 1} onClick={() => move(i, i + 1)} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button aria-label="Edit question" onClick={() => setEditing(q.id)} className="p-1 text-muted-foreground hover:text-foreground">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => void run(() => deleteQuestion(q.id), "Question removed.")} className="text-[11px] text-red-600 hover:underline ml-1">
                    Delete
                  </button>
                </div>
              </li>
            ),
          )}
          {questions.length === 0 && <p className="text-sm text-muted-foreground">No questions yet — add at least one to publish.</p>}
        </ul>
      </div>

      <QuestionForm busy={busy} submitLabel="Add question" onSubmit={(input) => run(() => addQuestion(assessment.id, input), "Question added.")} />
    </div>
  );
}

/** datetime-local ⇄ ISO helpers (local time in the input, ISO on the wire). */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

function SettingsForm({
  assessment,
  isAssignment,
  totalMarks,
  busy,
  onSave,
}: {
  assessment: Assessment;
  isAssignment: boolean;
  totalMarks: number;
  busy: boolean;
  onSave: (patch: Partial<AssessmentConfig>) => void;
}) {
  const [f, setF] = useState({
    title: assessment.title,
    description: assessment.description,
    instructions: assessment.instructions,
    isGraded: assessment.isGraded,
    isRequired: assessment.isRequired,
    passingScore: assessment.passingScore,
    estimatedDurationMinutes: assessment.estimatedDurationMinutes,
    timeLimitMinutes: assessment.timeLimitMinutes,
    autoSubmitOnTimeout: assessment.autoSubmitOnTimeout,
    maxAttempts: assessment.maxAttempts,
    availableFrom: toLocalInput(assessment.availableFrom),
    availableUntil: toLocalInput(assessment.availableUntil),
    shuffleQuestions: assessment.shuffleQuestions,
    shuffleOptions: assessment.shuffleOptions,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));
  const passingMarks = Math.ceil((f.passingScore / 100) * totalMarks);

  const save = () => {
    if (!f.title.trim()) return toast.error("Title is required");
    if (f.availableFrom && f.availableUntil && new Date(f.availableFrom) >= new Date(f.availableUntil)) {
      return toast.error("The availability end must be after its start");
    }
    onSave({
      ...f,
      title: f.title.trim(),
      availableFrom: fromLocalInput(f.availableFrom),
      availableUntil: fromLocalInput(f.availableUntil),
    });
  };

  const Check = ({ k, label, hint }: { k: "isGraded" | "isRequired" | "autoSubmitOnTimeout" | "shuffleQuestions" | "shuffleOptions"; label: string; hint?: string }) => (
    <label className="flex items-start gap-2 text-sm text-foreground">
      <input type="checkbox" checked={f[k]} onChange={(e) => set(k, e.target.checked)} className="h-4 w-4 mt-0.5 accent-violet-600" />
      <span>
        {label}
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );

  return (
    <details className="rounded-xl border border-border p-4 group" open={!assessment.isPublished}>
      <summary className="cursor-pointer text-sm font-medium text-foreground select-none">Settings</summary>
      <div className="mt-4 space-y-4">
        <div>
          <Label className="text-xs">Title</Label>
          <Input value={f.title} onChange={(e) => set("title", e.target.value)} className="rounded-xl h-10 mt-1" />
        </div>
        <div>
          <Label className="text-xs">Description</Label>
          <textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={2} className={areaClass} />
        </div>
        <div>
          <Label className="text-xs">Instructions (shown before starting)</Label>
          <textarea value={f.instructions} onChange={(e) => set("instructions", e.target.value)} rows={3} className={areaClass} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Check k="isGraded" label="Graded" hint={f.isGraded ? "Students must reach the passing score." : "Submitting completes it (no pass mark)."} />
          {isAssignment && <Check k="isRequired" label="Required to complete the lesson" hint="Optional assignments don't block progress." />}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Maximum marks</Label>
            <p className="h-10 mt-1 flex items-center text-sm text-foreground">{totalMarks} <span className="text-muted-foreground ml-1">(sum of question marks)</span></p>
          </div>
          <div>
            <Label className="text-xs">Passing score (%)</Label>
            <Input type="number" min={0} max={100} disabled={!f.isGraded} value={f.passingScore} onChange={(e) => set("passingScore", Math.min(100, num(e.target.value)))} className="rounded-xl h-10 mt-1" />
          </div>
          <div>
            <Label className="text-xs">Passing marks</Label>
            <p className="h-10 mt-1 flex items-center text-sm text-foreground">{f.isGraded ? `${passingMarks} of ${totalMarks}` : "—"}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Time limit (min, 0 = untimed)</Label>
            <Input type="number" min={0} max={1440} value={f.timeLimitMinutes} onChange={(e) => set("timeLimitMinutes", num(e.target.value))} className="rounded-xl h-10 mt-1" />
          </div>
          <div>
            <Label className="text-xs">Attempt limit (0 = unlimited)</Label>
            <Input type="number" min={0} max={100} value={f.maxAttempts} onChange={(e) => set("maxAttempts", num(e.target.value))} className="rounded-xl h-10 mt-1" />
          </div>
          <div>
            <Label className="text-xs">Estimated time (min)</Label>
            <Input type="number" min={0} max={1000} value={f.estimatedDurationMinutes} onChange={(e) => set("estimatedDurationMinutes", num(e.target.value))} className="rounded-xl h-10 mt-1" />
          </div>
        </div>
        {f.timeLimitMinutes > 0 && (
          <Check k="autoSubmitOnTimeout" label="Auto-submit saved answers when time runs out" hint="Off: an attempt that runs out of time is closed without credit." />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Available from (optional)</Label>
            <Input type="datetime-local" value={f.availableFrom} onChange={(e) => set("availableFrom", e.target.value)} className="rounded-xl h-10 mt-1" />
          </div>
          <div>
            <Label className="text-xs">Available until (optional)</Label>
            <Input type="datetime-local" value={f.availableUntil} onChange={(e) => set("availableUntil", e.target.value)} className="rounded-xl h-10 mt-1" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Check k="shuffleQuestions" label="Shuffle question order" hint="A new order per attempt (kept on resume)." />
          <Check k="shuffleOptions" label="Shuffle answer options" />
        </div>

        <Button size="sm" disabled={busy} onClick={save} className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
          <Save className="w-4 h-4 mr-1" /> Save settings
        </Button>
      </div>
    </details>
  );
}

function QuestionForm({
  initial,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Question;
  busy: boolean;
  submitLabel: string;
  onSubmit: (input: CreateQuestionInput) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const blank = { type: "mcq" as QuestionType, question: "", options: "", correctAnswer: "", explanation: "", marks: 1 };
  const [form, setForm] = useState(
    initial
      ? { type: initial.type, question: initial.question, options: initial.options.join(", "), correctAnswer: initial.correctAnswer, explanation: initial.explanation, marks: initial.marks }
      : blank,
  );
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const isMcq = form.type === "mcq";

  const submit = async () => {
    if (!form.question.trim()) return toast.error("Question text is required");
    const options = isMcq ? form.options.split(",").map((o) => o.trim()).filter(Boolean) : [];
    if (isMcq && options.length < 2) return toast.error("Give at least two options");
    if (isMcq && !options.includes(form.correctAnswer.trim())) return toast.error("The correct answer must be one of the options");
    await onSubmit({
      type: form.type,
      question: form.question.trim(),
      options: isMcq ? options : [],
      correctAnswer: isMcq ? form.correctAnswer.trim() : "",
      explanation: form.explanation.trim(),
      marks: form.marks,
    });
    if (!initial) setForm(blank);
  };

  return (
    <div className="rounded-xl border border-dashed border-input p-3 space-y-3">
      <p className="text-sm font-medium text-foreground">{initial ? "Edit question" : "Add question"}</p>
      <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
        <select value={form.type} onChange={(e) => set("type", e.target.value as QuestionType)} className={selectClass} aria-label="Question type">
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <Input value={form.question} onChange={(e) => set("question", e.target.value)} placeholder="Question text" className="rounded-xl h-10" />
      </div>
      {isMcq && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Options (comma-separated; True, False for true/false)</Label>
            <Input value={form.options} onChange={(e) => set("options", e.target.value)} placeholder="A, B, C" className="rounded-xl h-10 mt-1" />
          </div>
          <div>
            <Label className="text-xs">Correct answer</Label>
            <Input value={form.correctAnswer} onChange={(e) => set("correctAnswer", e.target.value)} placeholder="A" className="rounded-xl h-10 mt-1" />
          </div>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_100px]">
        <Input value={form.explanation} onChange={(e) => set("explanation", e.target.value)} placeholder="Explanation (optional)" className="rounded-xl h-10" />
        <Input type="number" min={0} aria-label="Marks" value={form.marks} onChange={(e) => set("marks", Math.max(0, Number(e.target.value) || 0))} className="rounded-xl h-10" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => void submit()} className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
          {initial ? <Save className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />} {submitLabel}
        </Button>
        {onCancel && (
          <Button size="sm" variant="outline" className="rounded-xl" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
