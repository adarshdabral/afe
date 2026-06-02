import { createFileRoute, Link } from "@tanstack/react-router";
import {
  PlayCircle,
  FileText,
  Image as ImageIcon,
  Sparkles,
  PenLine,
  BookOpenCheck,
  CheckCircle2,
  Circle,
  ArrowRight,
  Award,
  ClipboardCheck,
} from "lucide-react";
import { StudentSidebar } from "@/components/StudentSidebar";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useApp } from "@/context/AppContext";
import {
  AI_COURSE,
  courseStats,
  moduleProgress,
  firstIncompleteLessonId,
  type ContentKind,
} from "@/data/curriculum";

export const Route = createFileRoute("/student/curriculum")({
  head: () => ({ meta: [{ title: "My Course — AI For Everyone" }] }),
  component: Curriculum,
});

const kindIcon: Record<ContentKind, typeof PlayCircle> = {
  video: PlayCircle,
  pdf: FileText,
  infographic: ImageIcon,
  interactive: Sparkles,
  case_study: BookOpenCheck,
  reflection: PenLine,
};

function Curriculum() {
  const { completedLessons, assessmentScores } = useApp();
  const stats = courseStats(completedLessons);
  const continueId = firstIncompleteLessonId(completedLessons);
  const courseComplete = stats.pct === 100;

  return (
    <div className="min-h-screen flex bg-background">
      <StudentSidebar />
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <header className="mb-8">
            <p className="text-sm text-violet-600 font-medium">Course</p>
            <h1 className="text-3xl font-bold text-foreground mt-1">{AI_COURSE.title}</h1>
            <p className="text-muted-foreground mt-1">{AI_COURSE.subtitle}</p>
          </header>

          {/* Progress summary (FR-04) */}
          <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="grid grid-cols-3 gap-6">
                <Stat label="Overall" value={`${stats.pct}%`} />
                <Stat label="Modules" value={`${stats.modulesCompleted}/${stats.modulesTotal}`} />
                <Stat label="Lessons" value={`${stats.lessonsCompleted}/${stats.lessonsTotal}`} />
              </div>
              <Link to="/student/lesson/$lessonId" params={{ lessonId: continueId }}>
                <Button className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white gap-1">
                  {stats.lessonsCompleted === 0 ? "Start course" : "Continue"}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
            <div className="mt-5 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-600 transition-all duration-500"
                style={{ width: `${stats.pct}%` }}
              />
            </div>
            {courseComplete && (
              <Link
                to="/student/certificate"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400"
              >
                <Award className="w-4 h-4" /> Course complete — view your certificate
              </Link>
            )}
          </div>

          {/* Module structure */}
          <Accordion
            type="multiple"
            defaultValue={[`m-${continueId.split("-")[0]}`]}
            className="space-y-3"
          >
            {AI_COURSE.modules.map((m) => {
              const mp = moduleProgress(m, completedLessons);
              return (
                <AccordionItem
                  key={m.id}
                  value={`m-${m.id}`}
                  className="bg-card rounded-2xl border border-gray-100 dark:border-gray-700 px-5"
                >
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-4 flex-1 pr-4 text-left">
                      <span
                        className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-sm font-semibold ${
                          mp.pct === 100
                            ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
                            : "bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300"
                        }`}
                      >
                        {mp.pct === 100 ? <CheckCircle2 className="w-5 h-5" /> : m.order}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground">{m.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.description}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {mp.done}/{mp.total}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pb-2 space-y-1">
                      {m.lessons.map((l) => {
                        const Icon = kindIcon[l.content.kind];
                        const done = !!completedLessons[l.id];
                        return (
                          <Link
                            key={l.id}
                            to="/student/lesson/$lessonId"
                            params={{ lessonId: l.id }}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            {done ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            ) : (
                              <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
                            )}
                            <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="flex-1 text-sm text-foreground truncate">
                              {l.title}
                            </span>
                            <span className="text-xs text-muted-foreground capitalize">
                              {l.content.kind.replace("_", " ")}
                            </span>
                            <span className="text-xs text-muted-foreground">{l.durationMin}m</span>
                          </Link>
                        );
                      })}

                      {/* Module assessment (FR-07) */}
                      {(() => {
                        const res = assessmentScores[m.id];
                        return (
                          <Link
                            to="/student/assessment/$moduleId"
                            params={{ moduleId: m.id }}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            <ClipboardCheck
                              className={`w-4 h-4 shrink-0 ${
                                res?.passed ? "text-emerald-500" : "text-violet-500"
                              }`}
                            />
                            <span className="flex-1 text-sm font-medium text-foreground truncate">
                              Module Assessment
                            </span>
                            {res ? (
                              <span
                                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                  res.passed
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                                    : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                                }`}
                              >
                                {res.scorePct}% {res.passed ? "Passed" : "Retry"}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Not started</span>
                            )}
                          </Link>
                        );
                      })()}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
