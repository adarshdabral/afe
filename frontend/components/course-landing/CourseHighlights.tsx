"use client";

// Course-overview metadata from the course record (Admin → Courses → Course details):
// the instructor badge, "Skills you'll gain" / "Tools you'll learn" chips and the
// "Offered by" institution. Each piece renders nothing when its data is empty.

import { useState } from "react";
import { ArrowUpRight, BadgeCheck, Building2, Sparkles, Wrench } from "lucide-react";
import { resolveUploadUrl } from "@/lib/api/uploads";
import { initials, PLATFORM_NAME, type CourseOutline } from "@/lib/course";
import { BrandMark } from "@/components/BrandMark";
import { cn } from "@/lib/utils";

/** Avatar + name + "Instructor" badge (+ credential line when set). */
export function InstructorBadge({ course, href = "#instructor", className }: { course: CourseOutline; href?: string; className?: string }) {
  if (!course.instructor) return null;
  return (
    <a href={href} className={cn("flex items-center gap-3 group min-w-0", className)}>
      <span className="w-10 h-10 shrink-0 rounded-full bg-violet-600 text-white text-[13px] font-semibold flex items-center justify-center">
        {initials(course.instructor)}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[15px] font-semibold text-foreground group-hover:underline">{course.instructor}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-600/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-violet-700 dark:text-violet-300">
            <BadgeCheck className="w-3.5 h-3.5" aria-hidden /> Instructor
          </span>
        </span>
        {course.instructorTitle && <span className="block text-[13px] text-muted-foreground truncate">{course.instructorTitle}</span>}
      </span>
    </a>
  );
}

function ChipGroup({ id, icon: Icon, title, items }: { id: string; icon: typeof Sparkles; title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 id={id} className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
        <Icon className="w-4 h-4 text-violet-600" aria-hidden /> {title}
      </h3>
      <ul aria-labelledby={id} className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item} className="rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-[13px] text-foreground leading-none">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Offered by" — institution logo (or a monogram), name, details and link. */
export function OfferedByCard({ course, className }: { course: CourseOutline; className?: string }) {
  const o = course.offeredBy;
  const [logoFailed, setLogoFailed] = useState(false);
  if (!o.name) return null;
  const body = (
    <>
      {!o.logoUrl && o.name === PLATFORM_NAME ? (
        // Offered by the platform itself → its brand logo (Admin → Branding).
        <BrandMark size="lg" className="shrink-0" />
      ) : o.logoUrl && !logoFailed ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-provided origin (R2 / backend / external)
        <img
          src={resolveUploadUrl(o.logoUrl)}
          alt={`${o.name} logo`}
          className="w-14 h-14 shrink-0 rounded-2xl border border-border bg-white object-contain p-1.5"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <span className="w-14 h-14 shrink-0 rounded-2xl bg-violet-600/10 text-violet-600 flex items-center justify-center" aria-hidden>
          <Building2 className="w-6 h-6" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Offered by</span>
        <span className="mt-0.5 flex items-center gap-1 text-[16px] font-semibold text-foreground tracking-tight">
          {o.name}
          {o.url && <ArrowUpRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />}
        </span>
        {o.description && <span className="mt-0.5 block text-[13px] text-muted-foreground leading-snug">{o.description}</span>}
      </span>
    </>
  );
  const cls = cn("flex items-start gap-4 rounded-3xl border border-border bg-card p-5 md:p-6 shadow-soft", className);
  return o.url ? (
    <a href={o.url} target="_blank" rel="noopener noreferrer" className={cn(cls, "hover:bg-secondary/40 transition-colors")}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Skills + tools chips beside the "Offered by" card. Null when all are empty. */
export function CourseHighlights({ course }: { course: CourseOutline }) {
  const hasChips = course.skills.length > 0 || course.tools.length > 0;
  if (!hasChips && !course.offeredBy.name) return null;
  return (
    <section aria-label="Skills, tools and provider" className="mt-6 grid lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
      {hasChips && (
        <div className="rounded-3xl border border-border bg-card p-5 md:p-7 shadow-soft space-y-6">
          <ChipGroup id="skills-heading" icon={Sparkles} title="Skills you'll gain" items={course.skills} />
          <ChipGroup id="tools-heading" icon={Wrench} title="Tools you'll learn" items={course.tools} />
        </div>
      )}
      <OfferedByCard course={course} className={hasChips ? "" : "lg:col-span-2"} />
    </section>
  );
}
