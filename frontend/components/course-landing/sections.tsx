// Presentational sections of the Demystifying AI for Everyone course landing. Every value is
// derived from the real course outline (see lib/course.ts) — nothing invented.

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Award,
  BadgeCheck,
  BarChart3,
  Building2,
  BookOpenText,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Layers,
  QrCode,
  ShieldCheck,
  Download,
  Fingerprint,
  FileText,
  Footprints,
} from "lucide-react";
import {
  assessmentCount,
  contentFormats,
  contentSection,
  initials,
  learningOutcomes,
  lessonCount,
  topicCount,
  levelLabel,
  type CourseOutline,
} from "@/lib/course";
import { CourseCta } from "./CourseCta";
import { VerifyCertificateForm } from "./VerifyCertificateForm";
import { ContentRenderer } from "@/components/learn/ContentRenderer";
import { resolveUploadUrl } from "@/lib/api/uploads";

export function SectionHeading({
  eyebrow,
  title,
  children,
  id,
  center,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  id?: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "text-center max-w-2xl mx-auto" : "max-w-2xl"}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-violet-600">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-3xl md:text-[2.5rem] md:leading-[1.1] font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {children && <p className="mt-3 text-[16px] md:text-lg text-muted-foreground leading-relaxed">{children}</p>}
    </div>
  );
}

// ── Course facts ──────────────────────────────────────────────────────────────

export function CourseFacts({ course }: { course: CourseOutline }) {
  const lessons = lessonCount(course);
  const assessments = assessmentCount(course);
  const formats = contentFormats(course);

  const facts: { icon: typeof Layers; title: string; detail: string; href?: string }[] = [
    {
      icon: Layers,
      title: `${course.modules.length} modules`,
      detail: `${lessons} lesson groups, ${topicCount(course)} topics unlocked in sequence`,
    },
    ...(assessments > 0
      ? [{ icon: ClipboardCheck, title: `${assessments} assessments`, detail: "One per module, scored instantly" }]
      : []),
    { icon: Award, title: "Certificate", detail: "Of completion, publicly verifiable" },
    { icon: Footprints, title: "Self-paced", detail: "Learn on your own schedule" },
    { icon: BarChart3, title: `${levelLabel(course.level)} level`, detail: course.prerequisites.length ? `Prerequisites: ${course.prerequisites.join(", ")}` : "No prerequisites listed" },
    ...(formats.length
      ? [{ icon: BookOpenText, title: formats[0], detail: formats.length > 1 ? `Plus ${formats.slice(1).join(", ").toLowerCase()}` : "Structured, readable chapters" }]
      : []),
    // Fixed by the programme design (5 modules × 6 hours), not summed from topic estimates.
    { icon: Clock, title: "30 hours", detail: "5 modules × 6 hours of learning" },
    ...(course.syllabusUrl
      ? [{ icon: FileText, title: "Syllabus", detail: "Click here to download the syllabus", href: syllabusHref(course.syllabusUrl) }]
      : []),
  ];

  return (
    <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px overflow-hidden rounded-3xl border border-border bg-border shadow-soft">
      {facts.map((f, i) => (
        <li key={f.title} className={`bg-card ${i === facts.length - 1 ? lastSpan(facts.length) : ""}`}>
          {f.href ? (
            <a href={f.href} target="_blank" rel="noopener noreferrer" className="group block h-full p-5 md:p-6 hover:bg-secondary/40 transition-colors">
              <FactBody f={f} />
            </a>
          ) : (
            <div className="p-5 md:p-6">
              <FactBody f={f} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function FactBody({ f }: { f: { icon: typeof Layers; title: string; detail: string; href?: string } }) {
  return (
    <>
      <f.icon className="w-5 h-5 text-violet-600" aria-hidden />
      <p className="mt-3 font-semibold text-foreground tracking-tight">{f.title}</p>
      <p className={`mt-0.5 text-[13px] leading-snug ${f.href ? "text-violet-600 group-hover:underline" : "text-muted-foreground"}`}>{f.detail}</p>
    </>
  );
}

/** Backend-stored uploads (`/api/uploads/…`) get `?download=` so they save as a
 *  file; R2 / external URLs open in a new tab. */
function syllabusHref(url: string): string {
  const resolved = resolveUploadUrl(url);
  return url.startsWith("/api/uploads/") ? `${resolved}?download=syllabus.pdf` : resolved;
}

/** Let the last fact fill its row so the grid never shows an empty cell
 *  (2 cols mobile, 3 md, 4 lg). Static class names for Tailwind's scanner. */
function lastSpan(n: number): string {
  const base = ["", "col-span-2"][n % 2];
  const md = ["md:col-span-1", "md:col-span-3", "md:col-span-2"][n % 3];
  const lg = ["lg:col-span-1", "lg:col-span-4", "lg:col-span-3", "lg:col-span-2"][n % 4];
  return `${base} ${md} ${lg}`;
}

// ── What you'll learn ─────────────────────────────────────────────────────────

export function LearningOutcomes({ course }: { course: CourseOutline }) {
  const outcomes = learningOutcomes(course);
  if (outcomes.length === 0) return null;
  const fromCourse = course.learningObjectives.length > 0;
  return (
    <section aria-labelledby="learn-heading" className="py-20 md:py-24">
      <SectionHeading id="learn-heading" eyebrow="Learning outcomes" title="What you'll learn">
        {fromCourse ? "By the end of the course, you will be able to:" : "Each outcome below comes straight from a module of the course."}
      </SectionHeading>
      <ul className="mt-10 grid md:grid-cols-2 gap-x-10 gap-y-5">
        {outcomes.map((o, i) => (
          <li key={i} className="flex gap-3.5">
            <CheckCircle2 className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" aria-hidden />
            <OutcomeText text={o} />
          </li>
        ))}
      </ul>
      {course.tags.length > 0 && (
        <div className="mt-10 flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-muted-foreground mr-1">Topics:</span>
          {course.tags.map((t) => (
            <span key={t} className="rounded-full border border-border bg-card px-3 py-1 text-[13px] text-foreground">
              {t.replace(/-/g, " ")}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

/** "Heading: explanation" → the heading in bold, then the explanation. */
function OutcomeText({ text }: { text: string }) {
  const i = text.indexOf(":");
  if (i <= 0 || i > 80) return <span className="text-[15px] text-foreground leading-relaxed">{text}</span>;
  return (
    <span className="text-[15px] text-foreground leading-relaxed">
      <span className="font-semibold">{text.slice(0, i)}:</span>
      {text.slice(i + 1)}
    </span>
  );
}

// ── Instructor ────────────────────────────────────────────────────────────────

export function InstructorSection({ course }: { course: CourseOutline }) {
  if (!course.instructor) return null;
  const instructorSection = contentSection(course, "instructor");
  const first = course.modules[0]?.title;
  const last = course.modules[course.modules.length - 1]?.title;
  return (
    <section aria-labelledby="instructor-heading" id="instructor" className="py-20 md:py-24">
      <div className="rounded-3xl border border-border bg-card shadow-soft p-7 md:p-12 grid md:grid-cols-[auto_1fr] gap-8 md:gap-12 items-center">
        <div className="relative w-28 h-28 md:w-36 md:h-36">
          <div className="absolute inset-0 rounded-full bg-violet-600" />
          <div className="absolute -inset-2 rounded-full border border-violet-600/30" />
          <span className="absolute inset-0 flex items-center justify-center text-white text-3xl md:text-4xl font-semibold tracking-tight">
            {initials(course.instructor)}
          </span>
        </div>
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-violet-600">Your instructor</p>
          <h2 id="instructor-heading" className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
            {course.instructor}
          </h2>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-600/10 px-2.5 py-1 text-[12px] font-semibold text-violet-700 dark:text-violet-300">
              <BadgeCheck className="w-3.5 h-3.5" aria-hidden /> Course instructor
            </span>
            <span>{course.instructorTitle || course.title}</span>
          </p>
          {course.offeredBy.name && (
            <p className="mt-2 flex items-center gap-1.5 text-[14px] text-muted-foreground">
              <Building2 className="w-4 h-4 shrink-0" aria-hidden />
              {[course.offeredBy.description, course.offeredBy.name].filter(Boolean).join(", ")}
            </p>
          )}
          {first && last && course.modules.length > 1 && (
            <p className="mt-5 text-[16px] text-foreground leading-relaxed max-w-2xl">
              {course.instructor} leads all {course.modules.length} modules of {course.title} — from{" "}
              <span className="font-medium">{first}</span> through <span className="font-medium">{last}</span>.
            </p>
          )}
          {instructorSection?.description && <p className="mt-4 text-[15px] text-muted-foreground leading-relaxed max-w-2xl">{instructorSection.description}</p>}
          {instructorSection && <div className="mt-5 max-w-2xl"><ContentRenderer item={instructorSection} /></div>}
        </div>
      </div>
    </section>
  );
}

// ── How you're assessed (course grading weights) ──────────────────────────────

export function AssessmentWeights({ course }: { course: CourseOutline }) {
  const weights = course.gradingWeights.filter((w) => w.category);
  if (weights.length === 0) return null;
  return (
    <section aria-labelledby="assessed-heading" id="assessment" className="py-20 md:py-24">
      <SectionHeading id="assessed-heading" eyebrow="Assessment" title="How you're assessed">
        Each part of the course contributes to your overall result.
      </SectionHeading>
      <ul className="mt-8 grid sm:grid-cols-2 gap-3 max-w-3xl">
        {weights.map((w) => (
          <li key={w.category} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
            <span className="shrink-0 w-14 text-2xl font-semibold tabular-nums text-violet-600">{w.weight}%</span>
            <span className="text-[15px] text-foreground leading-snug">{w.category}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Certificate ───────────────────────────────────────────────────────────────

export function CertificateSection({ course }: { course: CourseOutline }) {
  const assessments = assessmentCount(course);
  const points = [
    {
      icon: CheckCircle2,
      title: "Issued automatically",
      text: `Complete every topic${assessments ? " and pass every module assessment" : ""} — your certificate is issued the moment you're eligible.`,
    },
    { icon: Fingerprint, title: "Unique certificate ID", text: "Every certificate carries its own ID, recorded on the platform." },
    { icon: QrCode, title: "QR verification", text: "A QR code on the certificate opens its public verification page." },
    { icon: Download, title: "Downloadable PDF", text: "Download your certificate as a PDF from your Certificates page." },
  ];
  return (
    <section aria-labelledby="certificate-heading" id="certificate" className="py-20 md:py-24">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div>
          <SectionHeading id="certificate-heading" eyebrow="Certificate" title="Earn your Certificate of Completion">
            Finish {course.title} and receive a certificate anyone can verify.
          </SectionHeading>
          <ul className="mt-8 grid sm:grid-cols-2 gap-6">
            {points.map((p) => (
              <li key={p.title}>
                <p.icon className="w-5 h-5 text-violet-600" aria-hidden />
                <p className="mt-2 font-medium text-foreground">{p.title}</p>
                <p className="mt-1 text-[14px] text-muted-foreground leading-relaxed">{p.text}</p>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <VerifyCertificateForm />
          </div>
        </div>

        {/* Illustrative certificate — shows the layout, never a real record. */}
        <figure aria-label="Illustration of the certificate layout" className="relative">
          <div className="absolute -inset-4 rounded-[2rem] bg-violet-600/[0.06] -rotate-2" aria-hidden />
          <div className="relative rounded-3xl border border-border bg-card shadow-soft p-7 md:p-10">
            <div className="rounded-2xl border border-violet-600/25 p-6 md:p-8">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-600">
                  Certificate of Completion
                </span>
                <ShieldCheck className="w-5 h-5 text-violet-600" aria-hidden />
              </div>
              <p className="mt-8 text-[13px] text-muted-foreground">This certifies that</p>
              <p className="mt-1 text-2xl font-semibold text-foreground tracking-tight">Your name</p>
              <p className="mt-4 text-[13px] text-muted-foreground">has completed</p>
              <p className="mt-1 text-xl font-semibold text-foreground tracking-tight">{course.title}</p>
              {course.instructor && (
                <p className="mt-1 text-[13px] text-muted-foreground">with {course.instructor}</p>
              )}
              <div className="mt-8 flex items-end justify-between gap-4">
                <div className="text-[11px] text-muted-foreground">
                  <p className="uppercase tracking-[0.1em]">Certificate ID</p>
                  <p className="mt-0.5 font-mono text-foreground">AFE-····-········</p>
                </div>
                <div className="grid grid-cols-5 gap-[3px] p-2 rounded-lg border border-border" aria-hidden>
                  {Array.from({ length: 25 }, (_, i) => (
                    <span
                      key={i}
                      className={`w-[6px] h-[6px] rounded-[1px] ${[0, 1, 3, 5, 6, 8, 12, 14, 16, 18, 19, 21, 23, 24].includes(i) ? "bg-foreground/80" : "bg-transparent"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <figcaption className="sr-only">Sample layout; your certificate shows your name and a unique ID.</figcaption>
        </figure>
      </div>
    </section>
  );
}

// ── FAQ (course detail) — grounded in actual platform behaviour ────────────────

export function courseFaq(course: CourseOutline): { q: string; a: string }[] {
  const assessments = assessmentCount(course);
  const faq: { q: string; a: string }[] = [
    {
      q: "How is the course structured?",
      a: `${course.title} has ${course.modules.length} modules, ${lessonCount(course)} lesson groups and ${topicCount(course)} topics${
        assessments ? `, with an assessment at the end of ${assessments === course.modules.length ? "each module" : `${assessments} modules`}` : ""
      }. Topics unlock in sequence throughout the course.`,
    },
  ];
  if (course.level === "beginner")
    faq.push({
      q: "Do I need a technical background?",
      a: `The course is set at beginner level${course.prerequisites.length ? `; the listed prerequisites are: ${course.prerequisites.join(", ")}.` : " and lists no prerequisites."}`,
    });
  if (assessments)
    faq.push({
      q: "How do the assessments work?",
      a: "Multiple-choice and true/false questions are scored the moment you submit; written scenario and reflection answers count when you respond. You pass when your score meets the assessment's passing mark, and you can try again if you don't.",
    });
  faq.push(
    {
      q: "How do I earn the certificate?",
      a: `Complete every topic${assessments ? " and pass every module assessment" : ""}. The certificate is issued automatically, and you can download it as a PDF from your Certificates page.`,
    },
    {
      q: "How can someone verify my certificate?",
      a: "Each certificate has a unique ID and a QR code. Anyone can enter the ID — or scan the code — to open its public verification page, which shows whether it is valid or has been revoked.",
    },
    {
      q: "How do I get started?",
      a: "Create a student account and choose your teacher. Depending on platform settings, your teacher may need to approve your registration before you can begin.",
    },
  );
  return faq;
}

// ── Final CTA ─────────────────────────────────────────────────────────────────

export function FinalCta({ course }: { course: CourseOutline }) {
  return (
    <section className="py-20 md:py-24">
      <div className="relative overflow-hidden rounded-3xl bg-foreground text-background px-7 py-14 md:px-14 md:py-20 text-center">
        <div
          aria-hidden
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[640px] h-[420px] rounded-full blur-3xl opacity-60"
          style={{ background: "radial-gradient(closest-side, var(--primary), transparent)" }}
        />
        <div className="relative">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">Start {course.title} today</h2>
          <p className="mt-4 text-[16px] md:text-lg opacity-75 max-w-xl mx-auto">
            {course.modules.length} modules{course.instructor ? ` with ${course.instructor}` : ""}, at your own pace — ending in a certificate you can verify.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <CourseCta slug={course.slug} courseId={course.id} />
            <Link
              href={`/courses/${course.slug}#curriculum`}
              className="inline-flex items-center justify-center h-12 px-7 rounded-full border border-current/25 text-[15px] font-medium hover:bg-background/10 transition-colors"
            >
              View the curriculum
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
