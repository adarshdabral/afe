import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, XCircle, Lightbulb, PenLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { wordCount } from "@/components/LessonContentView";
import { useApp } from "@/context/AppContext";
import { AI_COURSE } from "@/data/curriculum";
import {
  getAssessment,
  gradeAssessment,
  isAnswered,
  type AnswerMap,
  type AssessmentResult,
} from "@/data/assessments";

export const Route = createFileRoute("/student/assessment/$moduleId")({
  head: () => ({ meta: [{ title: "Module Assessment — AI For Everyone" }] }),
  loader: ({ params }) => {
    const module = AI_COURSE.modules.find((m) => m.id === params.moduleId);
    const assessment = getAssessment(params.moduleId);
    if (!module || !assessment) throw notFound();
    return { module, assessment };
  },
  component: AssessmentPage,
});

function AssessmentPage() {
  const { module, assessment } = Route.useLoaderData();
  const navigate = useNavigate();
  const { saveAssessmentResult } = useApp();

  const [answers, setAnswers] = useState<AnswerMap>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);

  const setChoice = (qid: string, choiceIndex: number) =>
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], choiceIndex } }));
  const setText = (qid: string, text: string) =>
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], text } }));

  const allAnswered = assessment.questions.every((q) => isAnswered(q, answers[q.id]));

  const submit = () => {
    const graded = {
      ...gradeAssessment(assessment, answers),
      submittedAt: new Date().toISOString(),
    };
    saveAssessmentResult(graded);
    setResult(graded);
    toast.success(graded.passed ? "Passed! 🎉" : "Submitted — review your answers.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => {
    setAnswers({});
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-card border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            to="/student/curriculum"
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-semibold text-foreground truncate">{assessment.title}</h1>
            <p className="text-xs text-muted-foreground">Pass mark: {assessment.passPercentage}%</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {result && (
          <ResultSummary
            result={result}
            onRetake={reset}
            onDone={() => navigate({ to: "/student/curriculum" })}
          />
        )}

        <div className="space-y-4">
          {assessment.questions.map((q, i) => {
            const qr = result?.perQuestion.find((p) => p.questionId === q.id);
            const locked = !!result;
            return (
              <div
                key={q.id}
                className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 px-2 py-1 rounded">
                    Q{i + 1} ·{" "}
                    {q.type === "mcq"
                      ? "Multiple choice"
                      : q.type === "scenario"
                        ? "Scenario"
                        : "Reflection"}
                  </span>
                  {qr &&
                    q.type !== "reflection" &&
                    (qr.correct ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    ))}
                  {qr && q.type === "reflection" && (
                    <span
                      className={`text-xs font-medium ${qr.earned ? "text-emerald-600" : "text-amber-600"}`}
                    >
                      {qr.earned ? "Completed" : "Incomplete"}
                    </span>
                  )}
                </div>

                {q.type === "scenario" && (
                  <div className="mb-3 rounded-xl border-l-4 border-violet-500 bg-violet-50 dark:bg-violet-500/10 p-3 text-sm text-foreground">
                    {q.scenario}
                  </div>
                )}

                {q.type === "reflection" ? (
                  <ReflectionField
                    prompt={q.prompt}
                    minWords={q.minWords}
                    value={answers[q.id]?.text ?? ""}
                    locked={locked}
                    onChange={(t) => setText(q.id, t)}
                  />
                ) : (
                  <>
                    <p className="font-medium text-foreground">{q.question}</p>
                    <div className="mt-3 space-y-2">
                      {q.options.map((opt, oi) => {
                        const picked = answers[q.id]?.choiceIndex === oi;
                        const isAnswer = oi === q.answerIndex;
                        const showState = locked && (isAnswer || picked);
                        return (
                          <button
                            key={opt}
                            disabled={locked}
                            onClick={() => setChoice(q.id, oi)}
                            className={`w-full text-left p-3 rounded-xl border-2 text-sm transition-colors flex items-center justify-between ${
                              showState && isAnswer
                                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10"
                                : showState && picked
                                  ? "border-red-500 bg-red-50 dark:bg-red-500/10"
                                  : picked
                                    ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10"
                                    : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                            }`}
                          >
                            <span>{opt}</span>
                            {showState && isAnswer && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            )}
                            {showState && picked && !isAnswer && (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {locked && (
                      <p className="mt-3 text-sm text-muted-foreground flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                        {q.explanation}
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {!result && (
          <div className="mt-6">
            <Button
              onClick={submit}
              disabled={!allAnswered}
              className="w-full rounded-xl h-11 bg-violet-600 hover:bg-violet-700 text-white"
            >
              Submit assessment
            </Button>
            {!allAnswered && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Answer every question (reflections need the minimum words) to submit.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ReflectionField({
  prompt,
  minWords,
  value,
  locked,
  onChange,
}: {
  prompt: string;
  minWords: number;
  value: string;
  locked: boolean;
  onChange: (t: string) => void;
}) {
  const count = wordCount(value);
  const enough = count >= minWords;
  return (
    <div>
      <p className="font-medium text-foreground flex items-center gap-2">
        <PenLine className="w-4 h-4 text-violet-500" /> {prompt}
      </p>
      <Textarea
        value={value}
        disabled={locked}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write your response…"
        className="mt-3 rounded-xl min-h-32"
      />
      <p
        className={`text-xs text-right mt-1 ${enough ? "text-emerald-600" : "text-muted-foreground"}`}
      >
        {count} / {minWords} words {enough ? "✓" : ""}
      </p>
    </div>
  );
}

function ResultSummary({
  result,
  onRetake,
  onDone,
}: {
  result: AssessmentResult;
  onRetake: () => void;
  onDone: () => void;
}) {
  const circ = 2 * Math.PI * 52;
  const offset = circ - (result.scorePct / 100) * circ;
  return (
    <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6 text-center">
      <div className="relative w-32 h-32 mx-auto">
        <svg className="w-32 h-32 -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="52"
            stroke="currentColor"
            strokeWidth="10"
            fill="none"
            className="text-gray-100 dark:text-gray-700"
          />
          <circle
            cx="64"
            cy="64"
            r="52"
            stroke={result.passed ? "#10b981" : "#ef4444"}
            strokeWidth="10"
            fill="none"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-bold text-foreground">{result.scorePct}%</p>
          <p className="text-xs text-muted-foreground">
            {result.earned}/{result.total}
          </p>
        </div>
      </div>
      <span
        className={`inline-block mt-4 px-3 py-1 rounded-full text-sm font-medium ${
          result.passed
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
            : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
        }`}
      >
        {result.passed ? "Passed" : `Not passed — need ${result.passPercentage}%`}
      </span>
      <div className="mt-5 flex gap-3 justify-center">
        <Button variant="outline" className="rounded-xl" onClick={onRetake}>
          Retake
        </Button>
        <Button
          className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white"
          onClick={onDone}
        >
          Back to course
        </Button>
      </div>
    </div>
  );
}
