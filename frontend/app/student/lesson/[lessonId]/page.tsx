"use client";

import { useState } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Menu, X, CheckCircle2, Circle, ArrowLeft } from "lucide-react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LessonContentView, wordCount } from "@/components/LessonContentView";
import { useApp } from "@/context/AppContext";
import { useLessonTimer } from "@/hooks/use-lesson-timer";
import { AI_COURSE, findLessonContext } from "@/data/curriculum";

export default function LessonPlayer() {
  const lessonId = useParams<{ lessonId: string }>().lessonId;
  const ctx = findLessonContext(lessonId);
  if (!ctx) notFound();

  const { lesson, module, prevId, nextId, index, total } = ctx;
  const router = useRouter();
  const { completedLessons, completeLesson, reflections } = useApp();
  const [mobileNav, setMobileNav] = useState(false);

  useLessonTimer(lesson.id); // FR-08: track active time on this lesson

  const done = !!completedLessons[lesson.id];

  // Reflection lessons require enough words before they can be completed.
  const canComplete =
    lesson.content.kind !== "reflection" ||
    wordCount(reflections[lesson.id] ?? "") >= lesson.content.minWords;

  const goto = (id: string) => router.push(`/student/lesson/${id}`);

  const markComplete = () => {
    completeLesson(lesson.id);
    if (nextId) {
      toast.success("Lesson complete!");
      goto(nextId);
    } else {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      toast.success("Course complete! 🎉");
      router.push("/student/curriculum");
    }
  };

  const Nav = () => (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      <div className="px-4 h-14 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
        <Link
          href="/student/curriculum"
          className="text-sm font-medium flex items-center gap-1 text-foreground hover:text-violet-600"
        >
          <ArrowLeft className="w-4 h-4" /> Course
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {AI_COURSE.modules.map((m) => (
          <details key={m.id} open={m.id === module.id} className="mb-1">
            <summary className="px-3 py-2 text-sm font-medium cursor-pointer flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
              <span className="truncate">
                {m.order}. {m.title}
              </span>
            </summary>
            <div className="mt-1 ml-1 space-y-0.5">
              {m.lessons.map((l) => {
                const active = l.id === lesson.id;
                const lDone = !!completedLessons[l.id];
                return (
                  <button
                    key={l.id}
                    onClick={() => {
                      goto(l.id);
                      setMobileNav(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs ${
                      active
                        ? "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800 text-foreground"
                    }`}
                  >
                    {lDone ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 shrink-0" />
                    )}
                    <span className="flex-1 truncate">{l.title}</span>
                  </button>
                );
              })}
            </div>
          </details>
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <div className="hidden md:flex w-80 shrink-0 border-r border-gray-100 dark:border-gray-800">
        <Nav />
      </div>

      {mobileNav && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNav(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw]">
            <button
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => setMobileNav(false)}
            >
              <X className="w-4 h-4" />
            </button>
            <Nav />
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="h-14 border-b border-gray-100 dark:border-gray-800 px-4 flex items-center gap-2">
          <button
            className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => setMobileNav(true)}
          >
            <Menu className="w-4 h-4" />
          </button>
          <p className="text-sm text-muted-foreground flex-1 truncate">
            {module.title} · Lesson {index + 1} of {total}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={!prevId}
            onClick={() => prevId && goto(prevId)}
            className="rounded-xl"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!nextId}
            onClick={() => nextId && goto(nextId)}
            className="rounded-xl"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-violet-600 dark:text-violet-300">
                {lesson.content.kind.replace("_", " ")} · {lesson.durationMin} min
              </p>
              <h1 className="text-2xl font-bold text-foreground mt-1">{lesson.title}</h1>
            </div>

            <LessonContentView content={lesson.content} lessonId={lesson.id} />

            <div className="sticky bottom-0 bg-background pt-4 pb-4 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3">
              <Button
                onClick={markComplete}
                disabled={!canComplete}
                className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 text-white"
              >
                {done ? "Completed — " : ""}
                {nextId ? "Mark complete & continue" : "Finish course"}
              </Button>
            </div>
            {!canComplete && (
              <p className="text-xs text-muted-foreground text-center -mt-2">
                Write at least the suggested number of words to complete this reflection.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
