"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PlayCircle, Clock, BarChart3, ListChecks, Sparkles } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { getPublicCourse, type CourseTree } from "@/lib/api/courses";

// Public course detail — published courses only (API scopes by role). Links into
// the learning engine at /learn/[slug].
export default function CourseDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [tree, setTree] = useState<CourseTree | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  useEffect(() => {
    getPublicCourse(slug)
      .then((t) => {
        setTree(t);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [slug]);

  const lessonCount = tree?.modules.reduce((s, m) => s + m.lessons.length, 0) ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-5 sm:px-6 py-12 animate-fade-up">
        {status === "loading" ? (
          <div className="skeleton h-72 rounded-3xl" />
        ) : status === "error" || !tree ? (
          <div className="rounded-3xl border border-border bg-card p-14 text-center shadow-soft">
            <p className="font-semibold text-foreground">We couldn&apos;t find that course</p>
            <p className="text-sm text-muted-foreground mt-1.5">
              It may be unpublished or no longer available.
            </p>
            <Link
              href="/courses"
              className="text-violet-600 font-medium text-sm mt-4 inline-block hover:underline"
            >
              Back to catalog
            </Link>
          </div>
        ) : (
          <>
            <div className="rounded-3xl overflow-hidden border border-border shadow-soft">
              <div className="h-44 bg-secondary flex items-center justify-center relative overflow-hidden">
                {tree.bannerImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tree.bannerImage} alt={tree.title} className="w-full h-full object-cover" />
                ) : (
                  <>
                    <div
                      aria-hidden
                      className="absolute inset-0 opacity-70"
                      style={{
                        background:
                          "radial-gradient(130% 130% at 15% 0%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 60%)",
                      }}
                    />
                    <Sparkles className="w-10 h-10 text-violet-600/70 relative" />
                  </>
                )}
              </div>
              <div className="p-7 bg-card">
                <h1 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
                  {tree.title}
                </h1>
                {tree.instructor && (
                  <p className="text-sm text-violet-600 font-medium mt-1">
                    Instructor: {tree.instructor}
                  </p>
                )}
                <p className="text-muted-foreground mt-2">
                  {tree.shortDescription || tree.description || "No description yet."}
                </p>
                <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1 capitalize">
                    <BarChart3 className="w-4 h-4" /> {tree.level}
                  </span>
                  <span className="flex items-center gap-1">
                    <ListChecks className="w-4 h-4" /> {tree.modules.length} modules · {lessonCount} lessons
                  </span>
                  {tree.estimatedDurationMinutes > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" /> {tree.estimatedDurationMinutes} min
                    </span>
                  )}
                </div>
                <Link href={`/learn/${tree.slug}`}>
                  <Button className="mt-6 rounded-full h-12 px-6 bg-violet-600 hover:bg-violet-700 text-white shadow-sm">
                    <PlayCircle className="w-5 h-5 mr-2" /> Start learning
                  </Button>
                </Link>
              </div>
            </div>

            {tree.description && (
              <section className="mt-6 bg-card rounded-3xl border border-border p-7 shadow-soft">
                <h2 className="text-lg font-semibold text-foreground mb-3 tracking-tight">About this course</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{tree.description}</p>
              </section>
            )}

            {tree.learningObjectives.length > 0 && (
              <section className="mt-6 bg-card rounded-3xl border border-border p-7 shadow-soft">
                <h2 className="text-lg font-semibold text-foreground mb-3 tracking-tight">What you'll learn</h2>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  {tree.learningObjectives.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-6 bg-card rounded-3xl border border-border p-7 shadow-soft">
              <h2 className="text-lg font-semibold text-foreground mb-4 tracking-tight">Curriculum</h2>
              <div className="space-y-2.5">
                {tree.modules.map((m, i) => (
                  <div key={m.id} className="rounded-2xl border border-border p-4">
                    <div className="flex items-center gap-3">
                      <span className="shrink-0 w-7 h-7 rounded-full bg-violet-600/10 text-violet-600 text-[13px] font-semibold flex items-center justify-center tabular-nums">
                        {i + 1}
                      </span>
                      <p className="text-[15px] font-medium text-foreground">{m.title}</p>
                      <span className="ml-auto text-[12px] text-muted-foreground">
                        {m.lessons.length} {m.lessons.length === 1 ? "lesson" : "lessons"}
                      </span>
                    </div>
                    <ul className="mt-2.5 pl-10 text-[13px] text-muted-foreground space-y-1.5">
                      {m.lessons.map((l) => (
                        <li key={l.id} className="flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-muted-foreground/60" />
                          {l.title}
                          <span className="text-[10px] uppercase tracking-wide text-violet-600">
                            {l.contentType.replace("_", " ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {tree.modules.length === 0 && (
                  <p className="text-sm text-muted-foreground">Curriculum coming soon.</p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
