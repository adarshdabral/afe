"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ContentRenderer } from "@/components/learn/ContentRenderer";
import { LearnSidebar, topicSequence } from "@/components/learn/LearnSidebar";
import { useLearnCourse } from "@/hooks/use-learn-course";
import { SECTION_KINDS, type SectionKind } from "@/lib/api/courses";

export default function CourseSectionPage() {
  const { slug, kind } = useParams<{ slug: string; kind: string }>();
  const sectionKind = SECTION_KINDS.includes(kind as SectionKind) ? kind as SectionKind : null;
  // Sections keep their content in the outline (only topic bodies are omitted).
  const { tree, status } = useLearnCourse(slug);

  const section = tree?.sections.find((item) => item.kind === sectionKind);
  if (status === "loading") return <Center><div className="skeleton h-64 w-full max-w-3xl rounded-xl" /></Center>;
  if (status === "error" || !tree) return <Center><Message title="Course unavailable" href={`/learn/${slug}`} label="Course overview" /></Center>;
  if (!sectionKind || !section) return <Center><Message title="Course section not found" href={`/learn/${slug}`} label="Course overview" /></Center>;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row gap-6">
        <LearnSidebar tree={tree} sequence={topicSequence(tree)} activeSection={section.kind} />
        <main className="flex-1 min-w-0">
          <Link href={`/learn/${slug}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5">
            <ArrowLeft className="w-4 h-4" /> Course overview
          </Link>
          <p className="text-xs uppercase tracking-wide text-violet-600">Course section</p>
          <h1 className="mt-1 text-3xl font-semibold text-foreground">{section.title}</h1>
          {section.description && <p className="mt-3 max-w-2xl text-muted-foreground leading-relaxed">{section.description}</p>}
          <article className="mt-6 rounded-xl border border-border bg-card p-5 md:p-8">
            <ContentRenderer item={section} />
          </article>
        </main>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-background px-4">{children}</div>;
}

function Message({ title, href, label }: { title: string; href: string; label: string }) {
  return <div className="rounded-xl border border-border bg-card p-8 text-center">
    <p className="font-medium text-foreground">{title}</p>
    <Link href={href} className="mt-2 inline-block text-sm text-violet-600 underline">{label}</Link>
  </div>;
}
