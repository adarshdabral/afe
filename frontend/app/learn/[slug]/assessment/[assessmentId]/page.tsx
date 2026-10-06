"use client";

// One page for module assessments AND lesson assignments. Attempts are timed by the
// SERVER: "Start" creates (or resumes) an attempt whose deadline the server stores;
// answers autosave to it; the countdown below only mirrors that deadline (corrected
// for clock skew) and auto-submits at zero. A refresh/navigation resumes the same
// attempt with its saved answers. A late submit is refused by the server, which
// submits the saved answers instead — that result is shown too.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle, Award, Lock, Timer, NotebookPen, ClipboardCheck, CloudCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import { useLearning } from "@/context/LearningContext";
import { itemHref } from "@/lib/learn";
import {
  getAssessment,
  saveAnswers,
  startAttempt,
  submitAttempt,
  submitResultFromError,
  type Assessment,
  type AttemptState,
  type PublicQuestion,
  type SubmitResult,
} from "@/lib/api/assessments";

type Answers = Record<string, string>;
const toList = (answers: Answers, questions: PublicQuestion[]) =>
  questions.map((q) => ({ questionId: q.id, answer: answers[q.id] ?? "" }));
const statusOf = (err: unknown) => (err as { response?: { status?: number } })?.response?.status ?? null;

export default function AssessmentPage() {
  const { slug, assessmentId } = useParams<{ slug: string; assessmentId: string }>();
  const isStudent = useApp().role === "student";
  const { load, certificateEligible, detail } = useLearning();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [state, setState] = useState<AttemptState | null>(null);
  const [status, setStatus] = useState<"loading" | "locked" | "error" | "ready">("loading");
  const [lockMessage, setLockMessage] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<(SubmitResult & { expired?: boolean }) | null>(null);
  /** serverNow − clientNow, so the countdown follows the server's clock. */
  const skew = useRef(0);

  const apply = useCallback((d: { assessment: Assessment; questions: PublicQuestion[]; state: AttemptState }) => {
    setAssessment(d.assessment);
    setQuestions(d.questions);
    setState(d.state);
    skew.current = Date.parse(d.state.serverNow) - Date.now();
    if (d.state.active) setAnswers(Object.fromEntries(d.state.active.answers.map((a) => [a.questionId, a.answer])));
  }, []);

  useEffect(() => {
    getAssessment(assessmentId)
      .then((d) => {
        apply(d);
        setStatus("ready");
        if (isStudent) void load(d.assessment.courseId);
      })
      .catch((err) => {
        if (statusOf(err) === 403) {
          setLockMessage(err instanceof Error ? err.message : "Complete the previous items first.");
          setStatus("locked");
        } else setStatus("error");
      });
  }, [assessmentId, apply, isStudent, load]);

  const active = state?.active ?? null;
  const label = assessment?.kind === "lesson" ? "assignment" : "assessment";

  // ── Autosave (debounced; flushed when the tab is hidden or closed) ─────────
  const dirty = useRef(false);
  const latest = useRef({ answers, questions, activeId: active?.id ?? null });
  latest.current = { answers, questions, activeId: active?.id ?? null };
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const flush = useCallback(async () => {
    const { answers: a, questions: qs, activeId } = latest.current;
    if (!dirty.current || !activeId) return;
    dirty.current = false;
    try {
      const r = await saveAnswers(assessmentId, activeId, toList(a, qs));
      setSavedAt(r.savedAt);
    } catch (err) {
      if (statusOf(err) === 409) void refreshAfterExpiry();
      else dirty.current = true; // retry on the next change / flush
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => void flush(), 1200);
    return () => clearTimeout(t);
  }, [answers, flush]);
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      void flush();
    };
  }, [flush]);

  const setAnswer = (questionId: string, value: string) => {
    dirty.current = true;
    setAnswers((a) => ({ ...a, [questionId]: value }));
  };

  /** The server closed the attempt (time up): show what it submitted. */
  const refreshAfterExpiry = useCallback(async () => {
    try {
      const d = await getAssessment(assessmentId);
      apply(d);
      if (assessment) await load(assessment.courseId, { force: true });
      toast.message("Time is up — your saved answers were submitted.");
    } catch {
      /* keep the current view */
    }
  }, [assessmentId, apply, assessment, load]);

  const start = async () => {
    setBusy(true);
    try {
      const d = await startAttempt(assessmentId);
      apply(d);
      setResult(null);
      if (!d.state.active) setAnswers({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not start the ${label}`);
    } finally {
      setBusy(false);
    }
  };

  const submit = useCallback(
    /** `timedOut`: fired by the countdown at zero (the result then says so). */
    async (timedOut = false) => {
      if (busy) return; // a submit in flight also covers the timeout
      setBusy(true);
      dirty.current = false;
      try {
        const res = await submitAttempt(assessmentId, toList(latest.current.answers, latest.current.questions));
        setResult({ ...res, expired: timedOut });
        toast[res.attempt.passed ? "success" : "message"](
          assessment?.isGraded === false
            ? "Submitted — this assignment is complete."
            : res.attempt.passed
              ? `Passed with ${res.attempt.score}%`
              : `Scored ${res.attempt.score}% — keep going`,
        );
      } catch (err) {
        const serverSubmitted = submitResultFromError(err);
        if (serverSubmitted) {
          setResult({ ...serverSubmitted, expired: true });
          toast.message("Time was up — your saved answers were submitted.");
        } else {
          toast.error(err instanceof Error ? err.message : "Could not submit");
        }
      } finally {
        setBusy(false);
        try {
          const d = await getAssessment(assessmentId);
          setState(d.state);
          if (d.assessment) await load(d.assessment.courseId, { force: true }); // progress + certificate + unlocks
        } catch {
          /* non-fatal */
        }
      }
    },
    [assessmentId, assessment, busy, load],
  );

  // ── Countdown (mirrors the server deadline; auto-submits at zero) ─────────
  const deadline = active?.deadline ? Date.parse(active.deadline) : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [deadline]);
  const remainingMs = deadline ? deadline - (now + skew.current) : null;
  const autoFired = useRef<string | null>(null);
  useEffect(() => {
    if (remainingMs === null || remainingMs > 0 || !active || autoFired.current === active.id) return;
    autoFired.current = active.id;
    void submit(true); // time is up: send what the student has (the server enforces the deadline)
  }, [remainingMs, active, submit]);

  const nextHref = detail?.nextItem && detail.nextItem.id !== assessmentId ? itemHref(slug, detail.nextItem) : `/learn/${slug}`;

  return (
    <div className="min-h-screen bg-background">
      {remainingMs !== null && active && !result && <TimerBar remainingMs={remainingMs} savedAt={savedAt} />}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Link href={`/learn/${slug}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Course overview
        </Link>

        {status === "loading" ? (
          <div className="skeleton h-72 rounded-3xl" />
        ) : status === "locked" ? (
          <div className="rounded-3xl border border-amber-300 bg-amber-50 dark:bg-amber-500/10 p-10 text-center">
            <Lock className="w-8 h-8 text-amber-600 mx-auto mb-2" />
            <p className="font-semibold text-foreground">This is locked</p>
            <p className="text-sm text-muted-foreground mt-1.5">{lockMessage}</p>
          </div>
        ) : status === "error" || !assessment || !state ? (
          <div className="rounded-3xl border border-border bg-card p-12 text-center shadow-soft">
            <p className="font-semibold text-foreground">This isn&apos;t available yet</p>
            <p className="text-sm text-muted-foreground mt-1.5">It may not be published. Head back to the course and try again shortly.</p>
          </div>
        ) : result ? (
          <ResultView
            result={result}
            assessment={assessment}
            questions={questions}
            state={state}
            certificateEligible={certificateEligible}
            nextHref={nextHref}
            onRetry={() => void start()}
          />
        ) : !isStudent ? (
          <>
            <Header assessment={assessment} state={null} />
            <p className="mt-6 rounded-2xl bg-secondary/70 p-4 text-[14px] text-foreground">
              Staff preview — attempts, timers and grading apply to student accounts.
            </p>
            <QuestionList questions={questions} answers={{}} onChange={() => {}} disabled />
          </>
        ) : active ? (
          <div className="animate-fade-up">
            <Header assessment={assessment} state={state} />
            <QuestionList questions={questions} answers={answers} onChange={setAnswer} disabled={busy} />
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button onClick={() => void submit()} disabled={busy} className="rounded-full h-12 px-7 bg-violet-600 hover:bg-violet-700 text-white shadow-sm">
                {busy ? "Submitting…" : `Submit ${label}`}
              </Button>
              {savedAt && (
                <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <CloudCheck className="w-4 h-4" aria-hidden /> Answers saved
                </span>
              )}
            </div>
          </div>
        ) : (
          <Intro assessment={assessment} state={state} busy={busy} onStart={() => void start()} nextHref={nextHref} />
        )}
      </div>
    </div>
  );
}

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Sticky countdown. Turns amber under 2 minutes, red under 30 seconds. */
function TimerBar({ remainingMs, savedAt }: { remainingMs: number; savedAt: string | null }) {
  const tone = remainingMs <= 30_000 ? "bg-red-600 text-white" : remainingMs <= 120_000 ? "bg-amber-500 text-white" : "bg-card text-foreground";
  return (
    <div className={`sticky top-0 z-30 border-b border-border shadow-soft ${tone}`} role="timer" aria-live="off">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-[14px] font-medium">
          <Timer className="w-4 h-4" aria-hidden /> Time left
        </span>
        <span className="font-mono text-lg tabular-nums font-semibold" aria-label={`Time left ${fmtClock(remainingMs)}`}>
          {fmtClock(remainingMs)}
        </span>
        <span className="hidden sm:inline text-[12px] opacity-80">{savedAt ? "Answers autosaved" : "Answers autosave as you go"}</span>
      </div>
    </div>
  );
}

function Header({ assessment, state }: { assessment: Assessment; state: AttemptState | null }) {
  const Icon = assessment.kind === "lesson" ? NotebookPen : ClipboardCheck;
  const chips = [
    assessment.kind === "lesson" ? "Lesson assignment" : "Module assessment",
    assessment.isGraded ? `Graded · pass ${assessment.passingScore}%` : "Not graded",
    assessment.timeLimitMinutes > 0 ? `${assessment.timeLimitMinutes} min time limit` : "Untimed",
    state && state.maxAttempts > 0 ? `Attempts ${state.submittedAttempts}/${state.maxAttempts}` : null,
  ].filter(Boolean) as string[];
  return (
    <>
      <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-violet-600">
        <Icon className="w-4 h-4" aria-hidden /> {chips[0]}
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-foreground tracking-tight">{assessment.title}</h1>
      {assessment.description && <p className="text-muted-foreground mt-2 leading-relaxed">{assessment.description}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {chips.slice(1).map((c) => (
          <span key={c} className="inline-flex items-center text-[12px] font-medium text-muted-foreground bg-secondary rounded-full px-3 py-1">
            {c}
          </span>
        ))}
      </div>
    </>
  );
}

function Intro({
  assessment,
  state,
  busy,
  onStart,
  nextHref,
}: {
  assessment: Assessment;
  state: AttemptState;
  busy: boolean;
  onStart: () => void;
  nextHref: string;
}) {
  const completed = !!state.best?.passed;
  const outOfAttempts = state.attemptsRemaining === 0;
  return (
    <div className="animate-fade-up">
      <Header assessment={assessment} state={state} />
      {assessment.instructions && (
        <div className="mt-6 rounded-3xl border border-border bg-card shadow-soft p-6">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground">Instructions</p>
          <p className="mt-2 text-[15px] text-foreground leading-relaxed whitespace-pre-line">{assessment.instructions}</p>
        </div>
      )}
      {state.best && (
        <p className={`mt-6 inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-[14px] ${completed ? "bg-green-600/10 text-green-700 dark:text-green-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>
          {completed ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {assessment.isGraded ? `Best score ${state.best.score}% — ${completed ? "passed" : "not passed yet"}` : "Submitted — complete"}
        </p>
      )}
      {!state.available ? (
        <p className="mt-6 rounded-2xl bg-secondary/70 p-4 text-[14px] text-foreground">Not available. {state.availabilityMessage}</p>
      ) : outOfAttempts ? (
        <p className="mt-6 rounded-2xl bg-secondary/70 p-4 text-[14px] text-foreground">You have used all {state.maxAttempts} attempts.</p>
      ) : (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={onStart} disabled={busy} className="rounded-full h-12 px-7 bg-violet-600 hover:bg-violet-700 text-white shadow-sm">
            {busy ? "Starting…" : state.submittedAttempts > 0 ? "Start a new attempt" : `Start${assessment.timeLimitMinutes > 0 ? " — the timer begins" : ""}`}
          </Button>
          {state.attemptsRemaining !== null && (
            <span className="text-[13px] text-muted-foreground">
              {state.attemptsRemaining} attempt{state.attemptsRemaining === 1 ? "" : "s"} left
            </span>
          )}
        </div>
      )}
      {completed && (
        <Link href={nextHref} className="mt-4 inline-block text-[14px] font-medium text-violet-600 hover:underline">
          Continue the course →
        </Link>
      )}
    </div>
  );
}

function QuestionList({
  questions,
  answers,
  onChange,
  disabled,
}: {
  questions: PublicQuestion[];
  answers: Answers;
  onChange: (questionId: string, value: string) => void;
  disabled?: boolean;
}) {
  if (questions.length === 0) return <p className="text-sm text-muted-foreground mt-6">No questions yet.</p>;
  return (
    <div className="mt-8 space-y-4">
      {questions.map((q, i) => (
        <div key={q.id} className="bg-card rounded-3xl border border-border p-6 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="shrink-0 w-7 h-7 rounded-full bg-violet-600/10 text-violet-600 text-[13px] font-semibold flex items-center justify-center tabular-nums mt-0.5">
              {i + 1}
            </span>
            <p className="font-medium text-foreground leading-snug pt-0.5">
              {q.question}{" "}
              <span className="text-[12px] font-normal text-muted-foreground">
                ({q.marks} mark{q.marks === 1 ? "" : "s"})
              </span>
            </p>
          </div>
          {q.type === "mcq" ? (
            <div className="mt-4 space-y-2 pl-10" role="radiogroup">
              {q.options.map((opt, oi) => {
                const selected = answers[q.id] === opt;
                return (
                  <label
                    key={opt}
                    className={`flex items-center gap-3 text-[14px] cursor-pointer rounded-2xl border px-4 py-3 transition-colors ${
                      selected ? "border-violet-600 bg-violet-600/[0.06] text-foreground" : "border-border hover:bg-secondary text-foreground"
                    }`}
                  >
                    <span className={`shrink-0 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors ${selected ? "border-violet-600" : "border-muted-foreground/40"}`}>
                      {selected && <span className="w-2.5 h-2.5 rounded-full bg-violet-600" />}
                    </span>
                    <input type="radio" name={q.id} className="sr-only" checked={selected} disabled={disabled} onChange={() => onChange(q.id, opt)} />
                    <span className="font-semibold text-muted-foreground tabular-nums">{"ABCDEFGHIJ"[oi]}.</span>
                    {opt}
                  </label>
                );
              })}
            </div>
          ) : (
            <textarea
              value={answers[q.id] ?? ""}
              onChange={(e) => onChange(q.id, e.target.value)}
              disabled={disabled}
              rows={4}
              placeholder="Write your response"
              className="mt-4 ml-10 w-[calc(100%-2.5rem)] rounded-2xl border border-input bg-secondary/50 px-4 py-3 text-[14px] text-foreground focus-visible:bg-card transition-colors"
            />
          )}
        </div>
      ))}
    </div>
  );
}

function ResultView({
  result,
  assessment,
  questions,
  state,
  certificateEligible,
  nextHref,
  onRetry,
}: {
  result: SubmitResult & { expired?: boolean };
  assessment: Assessment;
  questions: PublicQuestion[];
  state: AttemptState;
  certificateEligible: boolean;
  nextHref: string;
  onRetry: () => void;
}) {
  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const graded = assessment.isGraded;
  const passed = result.attempt.passed;
  const canRetry = state.available && state.attemptsRemaining !== 0;
  return (
    <div className="animate-fade-up">
      <div className="rounded-3xl border border-border bg-card shadow-soft p-10 text-center">
        <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${passed ? "bg-green-600/10" : "bg-amber-500/10"}`}>
          {passed ? <Award className="w-8 h-8 text-green-600" /> : <XCircle className="w-8 h-8 text-amber-600" />}
        </div>
        {graded ? (
          <p className="text-5xl font-semibold text-foreground mt-5 tracking-tight tabular-nums">{result.attempt.score}%</p>
        ) : (
          <p className="text-3xl font-semibold text-foreground mt-5 tracking-tight">Submitted</p>
        )}
        <p className="text-[15px] text-muted-foreground mt-1.5">
          {!graded
            ? "This assignment isn't graded — submitting it completes it."
            : passed
              ? "You passed — nicely done."
              : `You need ${assessment.passingScore}% to pass.${canRetry ? " Try again." : ""}`}
        </p>
        {(result.expired || result.attempt.autoSubmitted) && (
          <p className="mt-3 text-[13px] text-amber-700 dark:text-amber-400">Time ran out — your answers were submitted automatically.</p>
        )}
        {passed && (
          <Link
            href={nextHref}
            className="mt-6 inline-flex items-center justify-center h-11 px-6 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-[14px] font-medium shadow-sm"
          >
            Continue the course
          </Link>
        )}
      </div>

      {passed && certificateEligible && (
        <div className="mt-4 rounded-3xl border border-green-600/25 bg-green-600/[0.06] p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <Award className="w-7 h-7 text-green-600 shrink-0" aria-hidden />
          <div className="flex-1">
            <p className="font-semibold text-foreground">You&apos;ve completed the course</p>
            <p className="text-[14px] text-muted-foreground">
              Your Certificate of Completion has been issued — download it or share its verification link.
            </p>
          </div>
          <Link
            href="/student/certificates"
            className="inline-flex items-center justify-center h-10 px-5 rounded-full bg-green-600 hover:bg-green-700 text-white text-[14px] font-medium shrink-0"
          >
            View certificate
          </Link>
        </div>
      )}

      <h2 className="font-semibold text-foreground mt-8 mb-3 text-lg tracking-tight">Review</h2>
      <div className="space-y-3">
        {result.review.map((r) => {
          const q = byId.get(r.questionId);
          return (
            <div key={r.questionId} className="bg-card rounded-3xl border border-border p-5 shadow-soft">
              <div className="flex items-start gap-2.5">
                {r.correct ? <CheckCircle2 className="w-[18px] h-[18px] text-green-600 mt-0.5 shrink-0" /> : <XCircle className="w-[18px] h-[18px] text-red-500 mt-0.5 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-foreground leading-snug">{q?.question}</p>
                  <p className="text-[13px] text-muted-foreground mt-1.5">Your answer: {r.yourAnswer || "—"}</p>
                  {q?.type === "mcq" && !r.correct && <p className="text-[13px] text-green-700 dark:text-green-300 mt-0.5">Correct: {r.correctAnswer}</p>}
                  {r.explanation && <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">{r.explanation}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 mt-8">
        {canRetry && (
          <Button variant="outline" className="rounded-full h-11 px-5 bg-card" onClick={onRetry}>
            Try again{state.attemptsRemaining !== null ? ` (${state.attemptsRemaining} left)` : ""}
          </Button>
        )}
        <Link href={nextHref}>
          <Button className="rounded-full h-11 px-5 bg-violet-600 hover:bg-violet-700 text-white shadow-sm">
            {passed ? "Continue" : "Back to course"}
          </Button>
        </Link>
      </div>
    </div>
  );
}
