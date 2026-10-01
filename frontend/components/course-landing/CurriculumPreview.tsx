"use client";

import { BookOpenText, ClipboardCheck, Clock } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { formatMinutes, lessonCount, moduleMinutes, pad2, type CourseOutline } from "@/lib/course";

const TYPE_LABEL: Record<string, string> = {
  rich_text: "Reading",
  case_study: "Case study",
  pdf: "PDF",
};

/** Public curriculum: every module with its lessons and assessment — titles only,
 *  never lesson bodies (those stay behind /learn). */
export function CurriculumPreview({ course, defaultOpen = true }: { course: CourseOutline; defaultOpen?: boolean }) {
  const lessons = lessonCount(course);
  if (course.modules.length === 0)
    return <p className="text-muted-foreground">The curriculum is being prepared.</p>;

  return (
    <div>
      <p className="text-[14px] text-muted-foreground mb-4">
        {course.modules.length} modules · {lessons} {lessons === 1 ? "lesson" : "lessons"}
      </p>
      <Accordion
        type="multiple"
        defaultValue={defaultOpen ? [course.modules[0].id] : []}
        className="rounded-3xl border border-border bg-card shadow-soft overflow-hidden"
      >
        {course.modules.map((m, i) => {
          const minutes = moduleMinutes(m);
          return (
            <AccordionItem key={m.id} value={m.id} className="border-border last:border-b-0">
              <AccordionTrigger className="px-5 md:px-7 py-5 gap-4 hover:no-underline hover:bg-secondary/50 transition-colors">
                <span className="flex items-start gap-4 md:gap-6 min-w-0">
                  <span className="shrink-0 font-mono text-[13px] text-violet-600 pt-0.5 tabular-nums">
                    {pad2(i + 1)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] md:text-base font-semibold text-foreground leading-snug">
                      {m.title}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] font-normal text-muted-foreground">
                      <span>
                        {m.lessons.length} {m.lessons.length === 1 ? "lesson" : "lessons"}
                      </span>
                      {m.hasAssessment && <span>· Assessment</span>}
                      {minutes > 0 && <span>· {formatMinutes(minutes)}</span>}
                    </span>
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-5 md:px-7 pb-6">
                <div className="pl-[2.1rem] md:pl-[2.6rem]">
                  {m.description && (
                    <p className="text-[14px] text-muted-foreground leading-relaxed max-w-2xl">{m.description}</p>
                  )}
                  <ul className="mt-4 space-y-2">
                    {m.lessons.map((l) => (
                      <li key={l.id} className="flex items-center gap-3 text-[14px] text-foreground">
                        <BookOpenText className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
                        <span className="flex-1 min-w-0">{l.title}</span>
                        <span className="shrink-0 text-[12px] text-muted-foreground">
                          {TYPE_LABEL[l.contentType] ?? l.contentType.replace("_", " ")}
                          {l.estimatedDurationMinutes > 0 && (
                            <span className="hidden sm:inline"> · {formatMinutes(l.estimatedDurationMinutes)}</span>
                          )}
                        </span>
                      </li>
                    ))}
                    {m.hasAssessment && (
                      <li className="flex items-center gap-3 text-[14px] text-foreground">
                        <ClipboardCheck className="w-4 h-4 text-violet-600 shrink-0" aria-hidden />
                        <span className="flex-1">Module assessment</span>
                        <span className="shrink-0 text-[12px] text-muted-foreground">Graded</span>
                      </li>
                    )}
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Clock className="w-3.5 h-3.5" aria-hidden /> Times are estimates — learn at your own pace.
      </p>
    </div>
  );
}
