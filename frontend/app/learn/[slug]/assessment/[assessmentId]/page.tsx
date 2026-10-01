"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle, Award } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLearning } from "@/context/LearningContext";
import {
  getAssessment,
  submitAttempt,
  type Assessment,
  type GradedAnswer,
  type PublicQuestion,
} from "@/lib/api/assessments";

export default function AssessmentPage() {
  const { slug, assessmentId } = useParams<{ slug: string; assessmentId: string }>();
  const { load, certificateEligible } = useLearning();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; passed: boolean; review: GradedAnswer[] } | null>(null);

  useEffect(() => {
    getAssessment(assessmentId)
      .then((d) => {
        setAssessment(d.assessment);
        setQuestions(d.questions);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [assessmentId]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await submitAttempt(
        assessmentId,
        questions.map((q) => ({ questionId: q.id, answer: answers[q.id] ?? "" })),
      );
      setResult({ score: res.attempt.score, passed: res.attempt.passed, review: res.review });
      if (assessment) await load(assessment.courseId); // refresh progress + certificate state
      toast[res.attempt.passed ? "success" : "message"](
        res.attempt.passed ? `Passed with ${res.attempt.score}%` : `Scored ${res.attempt.score}% — keep going`,
      );
    } catch {
      toast.error("Could not submit attempt");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Link href={`/learn/${slug}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Course overview
        </Link>

        {status === "loading" ? (
          <div className="skeleton h-72 rounded-3xl" />
        ) : status === "error" || !assessment ? (
          <div className="rounded-3xl border border-border bg-card p-12 text-center shadow-soft">
            <p className="font-semibold text-foreground">This quiz isn&apos;t available yet</p>
            <p className="text-sm text-muted-foreground mt-1.5">
              It may not be published. Head back to the course and try again shortly.
            </p>
          </div>
        ) : result ? (
          <ResultView result={result} questions={questions} passingScore={assessment.passingScore} slug={slug} certificateEligible={certificateEligible} onRetry={() => { setResult(null); setAnswers({}); }} />
        ) : (
          <div className="animate-fade-up">
            <h1 className="text-3xl font-semibold text-foreground tracking-tight">{assessment.title}</h1>
            {assessment.description && (
              <p className="text-muted-foreground mt-2 leading-relaxed">{assessment.description}</p>
            )}
            <span className="inline-flex items-center gap-1.5 mt-3 text-[12px] font-medium text-muted-foreground bg-secondary rounded-full px-3 py-1">
              Passing score {assessment.passingScore}%
            </span>

            {questions.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-6">This quiz has no questions yet.</p>
            ) : (
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
                      <div className="mt-4 space-y-2 pl-10">
                        {q.options.map((opt) => {
                          const selected = answers[q.id] === opt;
                          return (
                            <label
                              key={opt}
                              className={`flex items-center gap-3 text-[14px] cursor-pointer rounded-2xl border px-4 py-3 transition-colors ${
                                selected
                                  ? "border-violet-600 bg-violet-600/[0.06] text-foreground"
                                  : "border-border hover:bg-secondary text-foreground"
                              }`}
                            >
                              <span
                                className={`shrink-0 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors ${
                                  selected ? "border-violet-600" : "border-muted-foreground/40"
                                }`}
                              >
                                {selected && <span className="w-2.5 h-2.5 rounded-full bg-violet-600" />}
                              </span>
                              <input
                                type="radio"
                                name={q.id}
                                className="sr-only"
                                checked={selected}
                                onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                              />
                              {opt}
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <textarea
                        value={answers[q.id] ?? ""}
                        onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                        rows={4}
                        placeholder="Write your response"
                        className="mt-4 ml-10 w-[calc(100%-2.5rem)] rounded-2xl border border-input bg-secondary/50 px-4 py-3 text-[14px] text-foreground focus-visible:bg-card transition-colors"
                      />
                    )}
                  </div>
                ))}
                <Button
                  onClick={submit}
                  disabled={submitting}
                  className="rounded-full h-12 px-7 bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
                >
                  {submitting ? "Submitting…" : "Submit answers"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultView({
  result,
  questions,
  passingScore,
  slug,
  certificateEligible,
  onRetry,
}: {
  result: { score: number; passed: boolean; review: GradedAnswer[] };
  questions: PublicQuestion[];
  passingScore: number;
  slug: string;
  certificateEligible: boolean;
  onRetry: () => void;
}) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  return (
    <div className="animate-fade-up">
      <div className="rounded-3xl border border-border bg-card shadow-soft p-10 text-center">
        <div
          className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${
            result.passed ? "bg-green-600/10" : "bg-amber-500/10"
          }`}
        >
          {result.passed ? (
            <Award className="w-8 h-8 text-green-600" />
          ) : (
            <XCircle className="w-8 h-8 text-amber-600" />
          )}
        </div>
        <p className="text-5xl font-semibold text-foreground mt-5 tracking-tight tabular-nums">
          {result.score}%
        </p>
        <p className="text-[15px] text-muted-foreground mt-1.5">
          {result.passed ? "You passed — nicely done." : `You need ${passingScore}% to pass. Try again.`}
        </p>
        {result.passed && (
          <Link
            href={`/learn/${slug}`}
            className="mt-6 inline-flex items-center justify-center h-11 px-6 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-[14px] font-medium shadow-sm"
          >
            Continue the course
          </Link>
        )}
      </div>

      {result.passed && certificateEligible && (
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
                {r.correct ? (
                  <CheckCircle2 className="w-[18px] h-[18px] text-green-600 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="w-[18px] h-[18px] text-red-500 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-foreground leading-snug">{q?.question}</p>
                  <p className="text-[13px] text-muted-foreground mt-1.5">
                    Your answer: {r.yourAnswer || "—"}
                  </p>
                  {q?.type === "mcq" && !r.correct && (
                    <p className="text-[13px] text-green-700 dark:text-green-300 mt-0.5">
                      Correct: {r.correctAnswer}
                    </p>
                  )}
                  {r.explanation && (
                    <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
                      {r.explanation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 mt-8">
        <Button variant="outline" className="rounded-full h-11 px-5 bg-card" onClick={onRetry}>
          Try again
        </Button>
        <Link href={`/learn/${slug}`}>
          <Button className="rounded-full h-11 px-5 bg-violet-600 hover:bg-violet-700 text-white shadow-sm">
            Back to course
          </Button>
        </Link>
      </div>
    </div>
  );
}
