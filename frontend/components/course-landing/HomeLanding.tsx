"use client";

import Link from "next/link";
import { Award, Footprints, Layers } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { initials, PLATFORM_NAME, type CourseOutline } from "@/lib/course";
import { CourseCta } from "./CourseCta";
import { CurriculumPreview } from "./CurriculumPreview";
import { HeroVisual } from "./HeroVisual";
import { ReviewsHighlight } from "./ReviewsHighlight";
import {
  CertificateSection,
  CourseFacts,
  FinalCta,
  InstructorSection,
  LearningOutcomes,
  SectionHeading,
} from "./sections";
import { useCourseOutline } from "./useCourseOutline";

/** `/` — the landing page for the platform's one course. */
export function HomeLanding({ slug, initial }: { slug: string; initial: CourseOutline | null }) {
  const { status, course } = useCourseOutline(slug, initial);
  const title =  " Demystifying AI for Everyone";

  return (
    <div className="min-h-screen bg-background overflow-x-clip">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section aria-labelledby="hero-title" className="relative">
        <div aria-hidden className="absolute inset-0 bg-grid pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-16 md:pt-24 md:pb-24 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-10 items-center">
          <div className="animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[12px] font-medium text-muted-foreground shadow-soft">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-600" aria-hidden />
              {PLATFORM_NAME} presents
            </p>
            <h1
              id="hero-title"
              className="mt-6 text-[2.75rem] leading-[1.02] sm:text-6xl md:text-7xl font-semibold tracking-[-0.035em] text-foreground"
            >
              {title}
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl">
              Understand artificial intelligence, its applications, opportunities and impact —
              without needing a technical background.
            </p>

            {course?.instructor && (
              <div className="mt-7 flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-violet-600 text-white text-[13px] font-semibold flex items-center justify-center">
                  {initials(course.instructor)}
                </span>
                <p className="text-[15px] text-foreground">
                  By <span className="font-semibold">{course.instructor}</span>
                </p>
              </div>
            )}

            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <CourseCta slug={slug} courseId={course?.id} />
              <Link
                href={`/courses/${slug}`}
                className="inline-flex items-center justify-center h-12 px-7 rounded-full border border-border bg-card text-[15px] font-medium text-foreground hover:bg-secondary transition-colors"
              >
                Explore the course
              </Link>
            </div>

            {course && (
              <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-muted-foreground">
                <li className="inline-flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-violet-600" aria-hidden /> {course.modules.length} modules
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-violet-600" aria-hidden /> Certificate of completion
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <Footprints className="w-4 h-4 text-violet-600" aria-hidden /> Self-paced
                </li>
              </ul>
            )}
          </div>

          <div className="animate-fade-up [animation-delay:120ms] max-w-[340px] sm:max-w-[420px] lg:max-w-none mx-auto w-full">
            <HeroVisual firstModuleTitle={course?.modules[0]?.title} moduleCount={course?.modules.length ?? 0} />
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {status === "loading" ? (
          <div className="space-y-6 pb-24" aria-busy="true" aria-label="Loading course">
            <div className="skeleton h-40 rounded-3xl" />
            <div className="skeleton h-80 rounded-3xl" />
          </div>
        ) : !course ? (
          <div className="mb-24 rounded-3xl border border-border bg-card p-10 md:p-14 text-center shadow-soft">
            <p className="font-semibold text-foreground">The course is being prepared</p>
            <p className="text-[15px] text-muted-foreground mt-1.5">
              {title} will be available here soon. Please check back shortly.
            </p>
          </div>
        ) : (
          <>
            <section aria-label="Course at a glance">
              <CourseFacts course={course} />
            </section>

            <LearningOutcomes course={course} />

            <section aria-labelledby="curriculum-heading" id="curriculum" className="py-20 md:py-24 border-t border-border">
              <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-14">
                <div className="lg:sticky lg:top-24 self-start">
                  <SectionHeading id="curriculum-heading" eyebrow="Course curriculum" title={`${course.modules.length} modules, one complete picture of AI`}>
                    {course.shortDescription}
                  </SectionHeading>
                  <div className="mt-8 hidden lg:block">
                    <CourseCta slug={slug} courseId={course.id} size="md" />
                  </div>
                </div>
                <CurriculumPreview course={course} />
              </div>
            </section>

            <div className="border-t border-border">
              <InstructorSection course={course} />
            </div>
            <div className="border-t border-border">
              <CertificateSection course={course} />
            </div>
            <ReviewsHighlight courseId={course.id} slug={slug} />
            <FinalCta course={course} />
          </>
        )}
      </div>
    </div>
  );
}
