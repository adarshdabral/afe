import { useState } from "react";
import {
  PlayCircle,
  FileText,
  Download,
  Image as ImageIcon,
  Lightbulb,
  CheckCircle2,
  XCircle,
  PenLine,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/context/AppContext";
import type {
  CaseStudyContent,
  InfographicContent,
  InteractiveContent,
  LessonContent,
  PdfContent,
  ReflectionContent,
  VideoContent,
} from "@/data/curriculum";

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Renders any lesson content type. `lessonId` is needed to persist reflections. */
export function LessonContentView({
  content,
  lessonId,
}: {
  content: LessonContent;
  lessonId: string;
}) {
  switch (content.kind) {
    case "video":
      return <VideoView c={content} />;
    case "pdf":
      return <PdfView c={content} />;
    case "infographic":
      return <InfographicView c={content} />;
    case "interactive":
      return <InteractiveView c={content} />;
    case "case_study":
      return <CaseStudyView c={content} />;
    case "reflection":
      return <ReflectionView c={content} lessonId={lessonId} />;
  }
}

function VideoView({ c }: { c: VideoContent }) {
  return (
    <div className="space-y-5">
      <div className="aspect-video bg-gray-900 rounded-2xl relative overflow-hidden flex items-center justify-center">
        <PlayCircle className="w-20 h-20 text-white/90" strokeWidth={1} />
      </div>
      <p className="text-foreground">{c.summary}</p>
      <div>
        <h4 className="font-semibold text-foreground mb-2">Key points</h4>
        <ul className="space-y-1.5 text-sm text-foreground list-disc pl-5">
          {c.keyPoints.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PdfView({ c }: { c: PdfContent }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between p-4 bg-card border border-gray-100 dark:border-gray-700 rounded-2xl">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-red-100 dark:bg-red-500/20 text-red-600 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">{c.fileName}</p>
            <p className="text-xs text-muted-foreground">PDF · {c.pages} pages</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl gap-1"
          onClick={() =>
            toast("Sample notes — PDF download wires to object storage in production.")
          }
        >
          <Download className="w-4 h-4" /> Download
        </Button>
      </div>
      <p className="text-foreground">{c.summary}</p>
      <div>
        <h4 className="font-semibold text-foreground mb-2">In these notes</h4>
        <ul className="space-y-1.5 text-sm text-foreground list-disc pl-5">
          {c.sections.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function InfographicView({ c }: { c: InfographicContent }) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-6 bg-gradient-to-br from-violet-600 to-violet-800 text-white">
        <div className="flex items-center gap-2 text-white/80 text-sm">
          <ImageIcon className="w-4 h-4" /> Infographic
        </div>
        <p className="mt-2 text-lg font-semibold">{c.caption}</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {c.facts.map((f, i) => (
          <div
            key={f}
            className="flex gap-3 p-4 bg-card border border-gray-100 dark:border-gray-700 rounded-xl"
          >
            <span className="w-7 h-7 shrink-0 rounded-lg bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300 flex items-center justify-center text-xs font-semibold">
              {i + 1}
            </span>
            <p className="text-sm text-foreground">{f}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function InteractiveView({ c }: { c: InteractiveContent }) {
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [picked, setPicked] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-violet-600 dark:text-violet-300">
        <Sparkles className="w-4 h-4" /> Interactive activity
      </div>
      <p className="text-foreground">{c.intro}</p>

      <div className="grid sm:grid-cols-3 gap-3">
        {c.cards.map((card, i) => (
          <button
            key={card.term}
            onClick={() => setRevealed((r) => ({ ...r, [i]: !r[i] }))}
            className="text-left p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-card hover:border-violet-300 dark:hover:border-violet-500/40 transition-colors min-h-28"
          >
            <p className="font-medium text-foreground">{card.term}</p>
            {revealed[i] ? (
              <p className="text-sm text-muted-foreground mt-2">{card.detail}</p>
            ) : (
              <p className="text-xs text-violet-600 dark:text-violet-300 mt-2">Tap to reveal</p>
            )}
          </button>
        ))}
      </div>

      {c.check && (
        <div className="bg-card border border-gray-100 dark:border-gray-700 rounded-2xl p-5">
          <p className="font-medium text-foreground flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" /> Knowledge check
          </p>
          <p className="text-sm text-foreground mt-2">{c.check.question}</p>
          <div className="mt-3 space-y-2">
            {c.check.options.map((opt, i) => {
              const isPicked = picked === i;
              const isCorrect = i === c.check!.answerIndex;
              const show = picked !== null;
              return (
                <button
                  key={opt}
                  onClick={() => setPicked(i)}
                  disabled={show}
                  className={`w-full text-left p-3 rounded-xl border-2 text-sm transition-colors flex items-center justify-between ${
                    show && isCorrect
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10"
                      : show && isPicked
                        ? "border-red-500 bg-red-50 dark:bg-red-500/10"
                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <span>{opt}</span>
                  {show && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  {show && isPicked && !isCorrect && <XCircle className="w-4 h-4 text-red-500" />}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <p className="text-sm text-muted-foreground mt-3">{c.check.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}

function CaseStudyView({ c }: { c: CaseStudyContent }) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border-l-4 border-violet-500 bg-violet-50 dark:bg-violet-500/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">
          Case study
        </p>
        <p className="mt-1 text-foreground font-medium">{c.scenario}</p>
      </div>
      <p className="text-foreground">{c.background}</p>
      <div>
        <h4 className="font-semibold text-foreground mb-2">Discuss</h4>
        <ol className="space-y-2 text-sm text-foreground list-decimal pl-5">
          {c.questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function ReflectionView({ c, lessonId }: { c: ReflectionContent; lessonId: string }) {
  const { reflections, saveReflection } = useApp();
  const value = reflections[lessonId] ?? "";
  const count = wordCount(value);
  const enough = count >= c.minWords;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-violet-600 dark:text-violet-300">
        <PenLine className="w-4 h-4" /> Reflection exercise
      </div>
      <p className="text-foreground font-medium">{c.prompt}</p>
      <p className="text-sm text-muted-foreground">{c.guidance}</p>
      <Textarea
        value={value}
        onChange={(e) => saveReflection(lessonId, e.target.value)}
        placeholder="Write your reflection…"
        className="rounded-xl min-h-40"
      />
      <p className={`text-xs text-right ${enough ? "text-emerald-600" : "text-muted-foreground"}`}>
        {count} / {c.minWords} words {enough ? "✓" : ""}
      </p>
    </div>
  );
}
