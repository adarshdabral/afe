"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { CourseReviews, StarRow } from "@/components/CourseReviews";
import { ContentRenderer } from "@/components/learn/ContentRenderer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { listReviews, type RatingAggregate } from "@/lib/api/reviews";
import { contentSection, levelLabel, type CourseOutline } from "@/lib/course";
import { CourseHighlights, InstructorBadge } from "./CourseHighlights";
import { CourseCta } from "./CourseCta";
import { CurriculumPreview } from "./CurriculumPreview";
import {
  AssessmentWeights,
  CertificateSection,
  CourseFacts,
  courseFaq,
  FinalCta,
  InstructorSection,
  LearningOutcomes,
  SectionHeading,
} from "./sections";
import { useCourseOutline } from "./useCourseOutline";

const SECTIONS = [
  { id: "introduction", label: "Introduction" },
  { id: "overview", label: "Overview" },
  { id: "curriculum", label: "Curriculum" },
  { id: "instructor", label: "Instructor" },
  { id: "certificate", label: "Certificate" },
  { id: "reviews", label: "Reviews" },
  { id: "faq", label: "FAQ" },
];

/** In-page nav entries for the sections this course actually renders. */
function visibleSections(course: CourseOutline) {
  const shown: Record<string, boolean> = {
    introduction: !!contentSection(course, "introduction") || !!course.description.trim(),
    overview: !!contentSection(course, "overview"),
    instructor: !!course.instructor,
  };
  return SECTIONS.filter((s) => shown[s.id] ?? true);
}

/** `/courses/[slug]` — the full public course page. */
export function CourseDetailView({ slug, initial }: { slug: string; initial: CourseOutline | null }) {
  const { status, course } = useCourseOutline(slug, initial);
  const [rating, setRating] = useState<RatingAggregate | null>(null);

  useEffect(() => {
    if (!course) return;
    listReviews(course.id)
      .then((r) => setRating(r.aggregate))
      .catch(() => setRating(null));
  }, [course]);

  return (
    <div className="min-h-screen bg-background overflow-x-clip">
      <Navbar />
      {status === "loading" ? (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 space-y-6" aria-busy="true" aria-label="Loading course">
          <div className="skeleton h-64 rounded-3xl" />
          <div className="skeleton h-40 rounded-3xl" />
        </div>
      ) : !course ? (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="rounded-3xl border border-border bg-card p-10 md:p-14 text-center shadow-soft">
            <h1 className="font-semibold text-foreground">We couldn&apos;t find that course</h1>
            <p className="text-sm text-muted-foreground mt-1.5">It may be unpublished or no longer available.</p>
            <Link href="/" className="text-violet-600 font-medium text-sm mt-4 inline-block hover:underline">
              Go to the home page
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* ── Header ─────────────────────────────────────────────────── */}
          <header className="relative border-b border-border">
            <div aria-hidden className="absolute inset-0 bg-grid pointer-events-none" />
            <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-14 md:pb-20">
              <nav aria-label="Breadcrumb" className="text-[13px] text-muted-foreground">
                <ol className="flex items-center gap-1.5 flex-wrap">
                  <li>
                    <Link href="/" className="hover:text-foreground">Home</Link>
                  </li>
                  <li aria-hidden><ChevronRight className="w-3.5 h-3.5" /></li>
                  <li aria-current="page" className="text-foreground">{course.title}</li>
                </ol>
              </nav>

              <div className="mt-10">
                <div className="animate-fade-up max-w-3xl">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-violet-600">
                    {levelLabel(course.level)} course
                  </p>
                  <h1 className="mt-3 text-[2.5rem] leading-[1.05] sm:text-5xl md:text-6xl font-semibold tracking-[-0.03em] text-foreground">
                    {course.title}
                  </h1>
                  {course.shortDescription && (
                    <p className="mt-5 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl">
                      {course.shortDescription}
                    </p>
                  )}
                  <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
                    <InstructorBadge course={course} />
                    {rating && rating.totalReviews > 0 && (
                      <a href="#reviews" className="flex items-center gap-2 text-[14px] text-foreground hover:underline">
                        <span className="font-semibold tabular-nums">{rating.averageRating.toFixed(1)}</span>
                        <StarRow rating={rating.averageRating} />
                        <span className="text-muted-foreground">
                          ({rating.totalReviews.toLocaleString()} {rating.totalReviews === 1 ? "review" : "reviews"})
                        </span>
                      </a>
                    )}
                  </div>
                  <div className="mt-9 flex flex-col sm:flex-row gap-3">
                    <CourseCta slug={course.slug} courseId={course.id} />
                    <a
                      href="#curriculum"
                      className="inline-flex items-center justify-center h-12 px-7 rounded-full border border-border bg-card text-[15px] font-medium text-foreground hover:bg-secondary transition-colors"
                    >
                      View curriculum
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* ── In-page section nav ───────────────────────────────────────── */}
          <nav aria-label="Course sections" className="glass sticky top-16 z-30 border-b border-border/70">
            <ul className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto [scrollbar-width:none]">
              {visibleSections(course).map((s) => (
                <li key={s.id} className="shrink-0">
                  <a
                    href={`#${s.id}`}
                    className="inline-flex items-center h-12 px-3 text-[14px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <section aria-label="Course at a glance" className="pt-12">
              <CourseFacts course={course} />
              <CourseHighlights course={course} />
            </section>

            {(() => {
              // Course sections are auto-created empty — only render them when they have content.
              const introduction = contentSection(course, "introduction");
              return introduction ? (
                <section id="introduction" aria-labelledby="introduction-heading" className="py-16 md:py-20 border-t border-border">
                  <SectionHeading id="introduction-heading" eyebrow="Introduction" title={introduction.title}>
                    {introduction.description}
                  </SectionHeading>
                  <div className="mt-7 max-w-3xl"><ContentRenderer item={introduction} /></div>
                </section>
              ) : course.description.trim() ? (
                <section id="introduction" aria-labelledby="introduction-heading" className="py-16 md:py-20 border-t border-border">
                  <SectionHeading id="introduction-heading" eyebrow="Introduction" title="About this course" />
                  <p className="mt-5 text-[16px] md:text-[17px] text-foreground leading-[1.75] max-w-3xl whitespace-pre-line">{course.description}</p>
                </section>
              ) : null;
            })()}

            {(() => {
              const overview = contentSection(course, "overview");
              return overview ? (
                <section id="overview" aria-labelledby="overview-heading" className="py-16 md:py-20 border-t border-border">
                  <SectionHeading id="overview-heading" eyebrow="Course overview" title={overview.title}>
                    {overview.description}
                  </SectionHeading>
                  <div className="mt-7 max-w-3xl"><ContentRenderer item={overview} /></div>
                </section>
              ) : null;
            })()}

            <div id="outcomes">
              <LearningOutcomes course={course} />
            </div>

            <section id="curriculum" aria-labelledby="curriculum-heading" className="py-20 md:py-24 border-t border-border">
              <SectionHeading id="curriculum-heading" eyebrow="Course curriculum" title="Everything in the course">
                Expand a module to see its lessons and assessment.
              </SectionHeading>
              <div className="mt-10">
                <CurriculumPreview course={course} />
              </div>
            </section>

            {course.gradingWeights.length > 0 && (
              <div className="border-t border-border">
                <AssessmentWeights course={course} />
              </div>
            )}
            <div className="border-t border-border">
              <InstructorSection course={course} />
            </div>
            <div className="border-t border-border">
              <CertificateSection course={course} />
            </div>

            <section id="reviews" aria-labelledby="reviews-heading" className="py-20 md:py-24 border-t border-border">
              <SectionHeading id="reviews-heading" eyebrow="Reviews" title="Learner reviews">
                Ratings and reviews from signed-in learners.
              </SectionHeading>
              <div className="mt-10 max-w-3xl">
                <CourseReviews courseId={course.id} />
              </div>
            </section>

            <section id="faq" aria-labelledby="faq-heading" className="py-20 md:py-24 border-t border-border">
              <SectionHeading id="faq-heading" eyebrow="FAQ" title="Frequently asked questions" />
              <Accordion type="single" collapsible className="mt-10 max-w-3xl border-t border-border">
                {courseFaq(course).map((f, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="border-border">
                    <AccordionTrigger className="py-5 text-[16px] font-medium text-foreground hover:no-underline">
                      {f.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-[15px] text-muted-foreground leading-relaxed pb-5 pr-8">
                      {f.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>

            <FinalCta course={course} />
          </div>
        </>
      )}
    </div>
  );
}
