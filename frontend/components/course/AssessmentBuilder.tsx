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
                    {q.type === "mcq" && q.correctAnswer ? ` · answer: ${answerLabel(q)}` : ""}
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

/** Option letters: A, B, C, … (the API allows up to 10 options). */
export const OPTION_LETTERS = "ABCDEFGHIJ".split("");
const MAX_OPTIONS = OPTION_LETTERS.length;
const MIN_OPTIONS = 2;
const DEFAULT_OPTIONS = 4; // A–D

/** "B · Narrow" for the admin question list. */
export function answerLabel(q: Pick<Question, "options" | "correctAnswer">): string {
  const i = q.options.indexOf(q.correctAnswer);
  return i >= 0 ? `${OPTION_LETTERS[i]} · ${q.correctAnswer}` : q.correctAnswer;
}

/**
 * Question editor. MCQ: the question, then option rows labelled A, B, C, D (add more
 * with "Add option", up to J); the admin picks the correct LETTER. The API stores
 * the chosen option's text as the answer key (that is what students submit).
 */
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
  const fresh = () => ({
    type: "mcq" as QuestionType,
    question: "",
    options: Array.from({ length: DEFAULT_OPTIONS }, () => ""),
    correct: -1,
    explanation: "",
    marks: 1,
  });
  const [form, setForm] = useState(() => {
    if (!initial) return fresh();
    const options = initial.type === "mcq" && initial.options.length ? [...initial.options] : fresh().options;
    return {
      type: initial.type,
      question: initial.question,
      options,
      correct: initial.type === "mcq" ? options.indexOf(initial.correctAnswer) : -1,
      explanation: initial.explanation,
      marks: initial.marks,
    };
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const isMcq = form.type === "mcq";

  const setOption = (i: number, v: string) => setForm((f) => ({ ...f, options: f.options.map((o, j) => (j === i ? v : o)) }));
  const addOption = () => setForm((f) => (f.options.length >= MAX_OPTIONS ? f : { ...f, options: [...f.options, ""] }));
  const removeOption = (i: number) =>
    setForm((f) => {
      if (f.options.length <= MIN_OPTIONS) return f;
      const correct = f.correct === i ? -1 : f.correct > i ? f.correct - 1 : f.correct;
      return { ...f, options: f.options.filter((_, j) => j !== i), correct };
    });
  const useTrueFalse = () => setForm((f) => ({ ...f, options: ["True", "False"], correct: -1 }));

  const submit = async () => {
    if (!form.question.trim()) return toast.error("Question text is required");
    let options: string[] = [];
    let correctAnswer = "";
    if (isMcq) {
      options = form.options.map((o) => o.trim());
      const blankAt = options.findIndex((o) => !o);
      if (blankAt >= 0) return toast.error(`Option ${OPTION_LETTERS[blankAt]} is empty — fill it in or remove it`);
      if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return toast.error("Options must all be different");
      if (form.correct < 0 || form.correct >= options.length) return toast.error("Select the correct answer (A, B, C…)");
      correctAnswer = options[form.correct];
    }
    await onSubmit({
      type: form.type,
      question: form.question.trim(),
      options,
      correctAnswer,
      explanation: form.explanation.trim(),
      marks: form.marks,
    });
    if (!initial) setForm(fresh());
  };

  return (
    <div className="rounded-xl border border-dashed border-input p-3 space-y-3">
      <p className="text-sm font-medium text-foreground">{initial ? "Edit question" : "Add question"}</p>

      <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
        <select value={form.type} onChange={(e) => set("type", e.target.value as QuestionType)} className={selectClass} aria-label="Question type">
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t === "mcq" ? "Multiple choice" : t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
        <div>
          <Label className="text-xs sr-only">Question</Label>
          <textarea
            value={form.question}
            onChange={(e) => set("question", e.target.value)}
            rows={2}
            placeholder="Question"
            aria-label="Question"
            className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground"
          />
        </div>
      </div>

      {isMcq && (
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-foreground mb-1">
            Options <span className="font-normal text-muted-foreground">— select the correct answer</span>
          </legend>
          {form.options.map((opt, i) => {
            const letter = OPTION_LETTERS[i];
            const isCorrect = form.correct === i;
            return (
              <div key={i} className="flex items-center gap-2">
                <label
                  className={`shrink-0 w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-semibold cursor-pointer transition-colors ${
                    isCorrect ? "border-green-600 bg-green-600 text-white" : "border-input text-muted-foreground hover:border-violet-600 hover:text-violet-600"
                  }`}
                  title={`Mark ${letter} as the correct answer`}
                >
                  <input
                    type="radio"
                    name={`correct-${initial?.id ?? "new"}`}
                    className="sr-only"
                    checked={isCorrect}
                    onChange={() => set("correct", i)}
                    aria-label={`Option ${letter} is correct`}
                  />
                  {letter}
                </label>
                <Input
                  value={opt}
                  onChange={(e) => setOption(i, e.target.value)}
                  placeholder={`Option ${letter}`}
                  aria-label={`Option ${letter}`}
                  className={`rounded-xl h-10 flex-1 ${isCorrect ? "ring-1 ring-green-600/50" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  disabled={form.options.length <= MIN_OPTIONS}
                  aria-label={`Remove option ${letter}`}
                  className="shrink-0 p-2 text-muted-foreground hover:text-red-600 disabled:opacity-30 disabled:hover:text-muted-foreground"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button type="button" size="sm" variant="outline" className="rounded-xl h-8" onClick={addOption} disabled={form.options.length >= MAX_OPTIONS}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add option
            </Button>
            <button type="button" onClick={useTrueFalse} className="text-xs text-violet-600 hover:underline">
              Use True / False
            </button>
            <span className="text-xs text-muted-foreground">
              {form.correct >= 0 ? `Correct answer: ${OPTION_LETTERS[form.correct]}` : "No correct answer selected yet"}
            </span>
          </div>
        </fieldset>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
        <Input value={form.explanation} onChange={(e) => set("explanation", e.target.value)} placeholder="Explanation shown after submitting (optional)" className="rounded-xl h-10" />
        <div className="flex items-center gap-2">
          <Label className="text-xs shrink-0">Marks</Label>
          <Input type="number" min={0} aria-label="Marks" value={form.marks} onChange={(e) => set("marks", Math.max(0, Number(e.target.value) || 0))} className="rounded-xl h-10" />
        </div>
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
