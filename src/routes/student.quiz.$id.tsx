import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { quizQuestions } from "@/data/mock";
import { toast } from "sonner";

export const Route = createFileRoute("/student/quiz/$id")({
  head: () => ({ meta: [{ title: "Quiz — AI For Everyone" }] }),
  component: Quiz,
});

function Quiz() {
  const questions = quizQuestions;
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const [time, setTime] = useState(15 * 60);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (submitted) return;
    const t = setInterval(() => {
      setTime((s) => {
        if (s <= 1) { setSubmitted(true); return 0; }
        return s - 1;
      });
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [submitted]);

  const q = questions[idx];
  const answered = (id: string) => {
    const a = answers[id];
    return Array.isArray(a) ? a.length > 0 : !!a;
  };
  const allAnswered = questions.every((qq) => answered(qq.id));
  const progressPct = (Object.keys(answers).length / questions.length) * 100;

  const score = useMemo(() => {
    let s = 0;
    for (const qq of questions) {
      const a = answers[qq.id];
      if (Array.isArray(qq.correctAnswer)) {
        if (Array.isArray(a) && a.length === qq.correctAnswer.length && a.every((x) => (qq.correctAnswer as string[]).includes(x))) s++;
      } else {
        if (typeof a === "string" && a.toLowerCase().trim() === qq.correctAnswer.toLowerCase().trim()) s++;
      }
    }
    return s;
  }, [answers, questions]);

  const pct = Math.round((score / questions.length) * 100);
  const passed = pct >= 70;

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (submitted) {
    const circ = 2 * Math.PI * 60;
    const offset = circ - (pct / 100) * circ;
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto">
          <Link to="/student/dashboard" className="text-sm text-violet-600 inline-flex items-center gap-1 mb-6 hover:underline"><ArrowLeft className="w-4 h-4" /> Back to dashboard</Link>
          <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
            <h1 className="text-2xl font-bold text-foreground mb-6">Quiz Results</h1>
            <div className="relative w-40 h-40 mx-auto">
              <svg className="w-40 h-40 -rotate-90">
                <circle cx="80" cy="80" r="60" stroke="currentColor" strokeWidth="12" fill="none" className="text-gray-100 dark:text-gray-700" />
                <circle cx="80" cy="80" r="60" stroke="#6C63FF" strokeWidth="12" fill="none"
                  strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 1s ease-out" }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-3xl font-bold text-foreground">{score}/{questions.length}</p>
                <p className="text-xs text-muted-foreground">{pct}%</p>
              </div>
            </div>
            <span className={`inline-block mt-4 px-3 py-1 rounded-full text-sm font-medium ${passed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"}`}>
              {passed ? "Passed" : "Try again"}
            </span>
            <p className="text-sm text-muted-foreground mt-2">Time taken: {fmt(elapsed)}</p>
          </div>

          <div className="mt-8 space-y-3">
            {questions.map((qq) => {
              const a = answers[qq.id];
              const correct = Array.isArray(qq.correctAnswer)
                ? Array.isArray(a) && a.length === qq.correctAnswer.length && a.every((x) => (qq.correctAnswer as string[]).includes(x))
                : typeof a === "string" && a.toLowerCase().trim() === qq.correctAnswer.toLowerCase().trim();
              return (
                <div key={qq.id} className="bg-card rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
                  <div className="flex gap-3">
                    {correct ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{qq.question}</p>
                      {!correct && a && (
                        <p className="text-sm mt-2 text-red-600 dark:text-red-400">Your answer: {Array.isArray(a) ? a.join(", ") : a}</p>
                      )}
                      <p className="text-sm mt-1 text-emerald-600 dark:text-emerald-400">Correct: {Array.isArray(qq.correctAnswer) ? qq.correctAnswer.join(", ") : qq.correctAnswer}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex gap-3">
            <Button variant="outline" className="rounded-xl flex-1" onClick={() => { setAnswers({}); setIdx(0); setSubmitted(false); setTime(15*60); setElapsed(0); }}>Retake Quiz</Button>
            <Link to="/student/dashboard" className="flex-1"><Button className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white">Back to Course</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 bg-card border-b border-gray-100 dark:border-gray-700 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/student/dashboard" className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeft className="w-4 h-4" /></Link>
          <h1 className="font-semibold text-foreground flex-1 truncate">Foundations Quiz</h1>
          <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">Q {idx + 1} of {questions.length}</span>
          <span className={`text-sm font-mono ${time < 60 ? "text-red-500" : "text-foreground"}`}>{fmt(time)}</span>
        </div>
        <div className="h-1 bg-gray-100 dark:bg-gray-800">
          <div className="h-full bg-violet-600 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
          <span className="inline-block bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 text-xs font-semibold px-2 py-1 rounded mb-4">Q{idx + 1}</span>
          <h2 className="text-xl font-semibold text-foreground">{q.question}</h2>

          <div className="mt-6 space-y-3">
            {q.type === "mcq" && q.options?.map((o) => (
              <button key={o} onClick={() => setAnswers({ ...answers, [q.id]: o })}
                className={`w-full text-left p-4 border-2 rounded-xl text-sm transition-colors ${
                  answers[q.id] === o ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10" : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}>
                {o}
              </button>
            ))}

            {q.type === "msq" && q.options?.map((o) => {
              const cur = Array.isArray(answers[q.id]) ? answers[q.id] as string[] : [];
              const checked = cur.includes(o);
              return (
                <label key={o} className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer ${
                  checked ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10" : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}>
                  <span className="text-sm">{o}</span>
                  <Checkbox checked={checked} onCheckedChange={(v) => {
                    setAnswers({ ...answers, [q.id]: v ? [...cur, o] : cur.filter((x) => x !== o) });
                  }} />
                </label>
              );
            })}

            {q.type === "truefalse" && (
              <div className="grid grid-cols-2 gap-3">
                {["True", "False"].map((v) => {
                  const sel = answers[q.id] === v;
                  const isTrue = v === "True";
                  return (
                    <button key={v} onClick={() => setAnswers({ ...answers, [q.id]: v })}
                      className={`p-6 rounded-xl text-base font-semibold border-2 transition-colors ${
                        sel
                          ? isTrue ? "bg-emerald-500 text-white border-emerald-500" : "bg-red-500 text-white border-red-500"
                          : `border-gray-200 dark:border-gray-700 hover:${isTrue ? "bg-emerald-50" : "bg-red-50"} dark:hover:bg-gray-800`
                      }`}>
                      {v}
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === "short" && (
              <div>
                <Textarea value={(answers[q.id] as string) || ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value.slice(0, 200) })}
                  className="rounded-xl" placeholder="Type your answer..." />
                <p className="text-xs text-muted-foreground text-right mt-1">{((answers[q.id] as string) || "").length}/200</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-between">
          <Button variant="outline" disabled={idx === 0} onClick={() => setIdx(idx - 1)} className="rounded-xl">Previous</Button>
          {idx === questions.length - 1 ? (
            <Button disabled={!allAnswered} onClick={() => { setSubmitted(true); toast.success("Quiz submitted!"); }} className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white">Submit</Button>
          ) : (
            <Button disabled={!answered(q.id)} onClick={() => setIdx(idx + 1)} className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white">Next</Button>
          )}
        </div>
      </div>
    </div>
  );
}
