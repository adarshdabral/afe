"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Eye, EyeOff, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addQuestion,
  createAssessment,
  deleteAssessment,
  deleteQuestion,
  getModuleAssessment,
  publishAssessment,
  unpublishAssessment,
  updateAssessment,
  QUESTION_TYPES,
  type Assessment,
  type Question,
  type QuestionType,
} from "@/lib/api/assessments";

const selectClass = "h-10 px-3 rounded-xl border border-input bg-card text-sm text-foreground";

// Assessment Builder — CMS-integrated. One optional assessment per module, with
// MCQ / reflection / scenario questions. Explicit actions (no auto-save).
// Each module has exactly ONE assessment (tests are per module, not per lesson).
// `onChange` lets the module page refresh its publish checklist after edits.
export function AssessmentBuilder({ moduleId, onChange }: { moduleId: string; onChange?: () => void }) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    setLoading(true);
    getModuleAssessment(moduleId)
      .then((d) => {
        setAssessment(d.assessment);
        setQuestions(d.questions);
      })
      .catch(() => toast.error("Could not load assessment"))
      .finally(() => setLoading(false));
  };
  useEffect(refresh, [moduleId]);

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
    return (
      <div className="text-center py-6">
        <ClipboardList className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground mb-3">No assessment for this module yet.</p>
        <Button
          disabled={busy}
          onClick={() => run(() => createAssessment({ moduleId, title: "Module Quiz" }), "Assessment created.")}
          className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white"
        >
          <Plus className="w-4 h-4 mr-1" /> Create assessment
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="font-medium text-foreground">{assessment.title}</p>
          <p className="text-xs text-muted-foreground">
            Passing score {assessment.passingScore}% · {assessment.isPublished ? "published" : "draft"}
          </p>
          <label className="mt-1.5 inline-flex items-center gap-2 text-xs text-muted-foreground">
            Estimated time
            <Input
              key={`${assessment.id}-${assessment.estimatedDurationMinutes}`}
              type="number"
              min={0}
              max={1000}
              defaultValue={assessment.estimatedDurationMinutes || ""}
              placeholder="0"
              disabled={busy}
              className="h-7 w-20 rounded-lg text-xs"
              onBlur={(e) => {
                const minutes = Math.max(0, Math.min(1000, Math.round(Number(e.target.value) || 0)));
                if (minutes !== (assessment.estimatedDurationMinutes ?? 0))
                  void run(() => updateAssessment(assessment.id, { estimatedDurationMinutes: minutes }), "Estimated time saved.");
              }}
            />
            min
          </label>
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
              if (confirm("Delete this assessment and its questions?"))
                void run(() => deleteAssessment(assessment.id), "Assessment deleted.");
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <ul className="space-y-2">
        {questions.map((q, i) => (
          <li key={q.id} className="flex items-start gap-2 rounded-xl border border-gray-100 dark:border-gray-700 p-3">
            <span className="text-xs text-muted-foreground mt-0.5">{i + 1}.</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">{q.question}</p>
              <p className="text-[11px] text-muted-foreground">
                {q.type} · {q.marks} mark{q.marks === 1 ? "" : "s"}
                {q.type === "mcq" && q.correctAnswer ? ` · answer: ${q.correctAnswer}` : ""}
              </p>
            </div>
            <button
              onClick={() => void run(() => deleteQuestion(q.id), "Question removed.")}
              className="text-[11px] text-red-600 hover:underline"
            >
              Delete
            </button>
          </li>
        ))}
        {questions.length === 0 && <p className="text-sm text-muted-foreground">No questions yet.</p>}
      </ul>

      <AddQuestion assessmentId={assessment.id} onAdded={() => { refresh(); onChange?.(); }} busy={busy} setBusy={setBusy} />
    </div>
  );
}

function AddQuestion({
  assessmentId,
  onAdded,
  busy,
  setBusy,
}: {
  assessmentId: string;
  onAdded: () => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
}) {
  const [form, setForm] = useState({ type: "mcq" as QuestionType, question: "", options: "", correctAnswer: "", explanation: "", marks: 1 });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const isMcq = form.type === "mcq";

  const submit = async () => {
    if (!form.question.trim()) return toast.error("Question text is required");
    setBusy(true);
    try {
      await addQuestion(assessmentId, {
        type: form.type,
        question: form.question.trim(),
        options: isMcq ? form.options.split(",").map((o) => o.trim()).filter(Boolean) : undefined,
        correctAnswer: isMcq ? form.correctAnswer.trim() : undefined,
        explanation: form.explanation.trim() || undefined,
        marks: form.marks,
      });
      setForm({ type: "mcq", question: "", options: "", correctAnswer: "", explanation: "", marks: 1 });
      toast.success("Question added.");
      onAdded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add question");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-input p-3 space-y-3">
      <p className="text-sm font-medium text-foreground">Add question</p>
      <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
        <select value={form.type} onChange={(e) => set("type", e.target.value as QuestionType)} className={selectClass}>
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <Input value={form.question} onChange={(e) => set("question", e.target.value)} placeholder="Question text" className="rounded-xl h-10" />
      </div>
      {isMcq && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Options (comma-separated)</Label>
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
        <Input type="number" min={0} value={form.marks} onChange={(e) => set("marks", Number(e.target.value) || 0)} className="rounded-xl h-10" />
      </div>
      <Button size="sm" disabled={busy} onClick={submit} className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
        <Plus className="w-4 h-4 mr-1" /> Add question
      </Button>
    </div>
  );
}
