"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Lock, CheckCircle2, ClipboardCheck, ArrowRight, Download, MessagesSquare, NotebookPen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LearnSidebar } from "@/components/learn/LearnSidebar";
import { ContentRenderer } from "@/components/learn/ContentRenderer";
import { ModuleProgressSummary } from "@/components/learn/ModuleProgressSummary";
import { ThreadPanel } from "@/components/ForumView";
import { useApp } from "@/context/AppContext";
import { useLearning } from "@/context/LearningContext";
import { pad2 } from "@/lib/course";
import { itemHref, learnSequence, topicIds } from "@/lib/learn";
import { useTopicTimer } from "@/hooks/use-topic-timer";
import { topicDownloadUrl, type DownloadPart, type Topic } from "@/lib/api/courses";
import { prefetchTopic, useLearnCourse, useLearnTopic } from "@/hooks/use-learn-course";

export default function TopicPage() {
  const { slug, topicId } = useParams<{ slug: string; topicId: string }>();
  const router = useRouter();
  // Progress + sequential locking are student concepts; staff preview freely.
  const role = useApp().role;
  const isStudent = role === "student";
  const { completedTopics, isUnlocked, markComplete, recordVisit, addMinutes } = useLearning();
  // Outline (no topic content) for navigation; this topic's content is fetched on its
  // own — the server checks the learning sequence before serving it.
  const { tree, status } = useLearnCourse(slug);
  const { data: topicData, error: bodyError, reload: reloadBody } = useLearnTopic(slug, topicId);
  const [saving, setSaving] = useState(false);

  const nav = useMemo(() => {
    const empty = {
      topic: null as Topic | null,
      moduleTitle: "",
      moduleIndex: -1,
      moduleId: "",
      items: [] as ReturnType<typeof learnSequence>,
      prevId: null as string | null,
      nextId: null as string | null,
      /** The item after this topic in the learning sequence (topic, assignment or assessment). */
      nextItem: null as ReturnType<typeof learnSequence>[number] | null,
    };
    if (!tree) return empty;
    const items = learnSequence(tree);
    const topics = topicIds(tree);
    const owning = tree.modules.find((m) => m.lessons.some((l) => l.topics.some((t) => t.id === topicId)));
    if (!owning) return { ...empty, items };
    const idx = topics.indexOf(topicId);
    const itemIdx = items.findIndex((i) => i.id === topicId);
    return {
      topic: owning.lessons.flatMap((l) => l.topics).find((t) => t.id === topicId) ?? null,
      moduleTitle: owning.title,
      moduleIndex: tree.modules.indexOf(owning),
      moduleId: owning.id,
      items,
      prevId: idx > 0 ? topics[idx - 1] : null,
      nextId: idx >= 0 && idx < topics.length - 1 ? topics[idx + 1] : null,
      nextItem: itemIdx >= 0 ? (items[itemIdx + 1] ?? null) : null,
    };
  }, [tree, topicId]);
  const { topic, moduleTitle, moduleIndex, moduleId, items, prevId, nextId, nextItem } = nav;

  const locked = isStudent && !!topic && !isUnlocked(items, topic.id);

  useEffect(() => {
    if (status === "ready" && topic && !locked) void recordVisit(topic.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, topic?.id, locked]);

  // The server may have refused the content before progress caught up (e.g. the
  // previous item was just completed) — refetch once the sequence says it's open.
  useEffect(() => {
    if (!locked && bodyError?.status === 403) reloadBody();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  // Warm the next topic's content so "Next topic" opens instantly.
  useEffect(() => {
    if (status === "ready" && nextItem?.kind === "topic") prefetchTopic(slug, nextItem.id);
  }, [status, slug, nextItem]);

  // Track active time on this topic → persists to POST /progress/:id/time.
  useTopicTimer(status === "ready" && !!topic && !locked, (minutes) => void addMinutes(minutes));

  if (status === "loading") return <Center><div className="h-64 w-full max-w-3xl bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" /></Center>;
  if (status === "error" || !tree) return <Center><Msg title="Course unavailable" href="/" cta="Back to home" /></Center>;
  if (!topic) return <Center><Msg title="Topic not found" href={`/learn/${slug}`} cta="Course overview" /></Center>;

  const done = completedTopics.has(topic.id);
  const full = topicData?.topic.id === topic.id ? topicData.topic : null;
  const isDiscussion = topic.contentType === "discussion";
  const canDownload = !!full && (role === "teacher" || role === "platform_admin" || full.allowDownload);
  const nextHref = nextItem ? itemHref(slug, nextItem) : null;

  const completeAndContinue = async () => {
    if (!isStudent) {
      if (nextHref) router.push(nextHref);
      return;
    }
    setSaving(true);
    try {
      await markComplete(topic.id);
      // Continue to whatever comes next: a topic, this lesson's assignment, or the
      // module assessment (the module is complete only after it is passed).
      if (nextItem?.kind === "assignment") {
        toast.success("Lesson content complete — now the lesson assignment.");
      } else if (nextItem?.kind === "assessment") {
        toast.success(`Module ${pad2(moduleIndex + 1)} lessons complete — time for the module assessment.`);
      }
      if (nextHref) router.push(nextHref);
      else toast.success("Course content complete! 🎉");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not mark complete");
    } finally {
      setSaving(false);
    }
  };

  const owningModule = tree.modules.find((m) => m.id === moduleId);
  const lockMessage = bodyError?.status === 403 ? bodyError.message : "Complete the previous item to unlock it.";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row gap-6">
        <LearnSidebar tree={tree} sequence={items} activeTopicId={topic.id} />

        <main className="flex-1 min-w-0">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 flex-wrap">
            <Link href={`/learn/${slug}`} className="hover:text-foreground">{tree.title}</Link>
            <span aria-hidden>/</span>
            <Link href={`/learn/${slug}/module/${moduleId}`} className="hover:text-foreground">
              Module {pad2(moduleIndex + 1)} · {moduleTitle}
            </Link>
          </nav>

          {owningModule && <ModuleProgressSummary module={owningModule} className="mb-4 text-[13px]" />}

          <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] font-medium text-violet-600 bg-violet-600/10 rounded-full px-2.5 py-1">
            {isDiscussion && <MessagesSquare className="w-3.5 h-3.5" aria-hidden />}
            {topic.contentType.replace("_", " ")}
          </span>
          <div className="flex items-center gap-2.5 mt-3 mb-6">
            <h1 className="text-3xl md:text-[2.5rem] md:leading-[1.1] font-semibold text-foreground tracking-tight">
              {topic.title}
            </h1>
            {done && <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />}
          </div>

          {locked || bodyError?.status === 403 ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-500/10 p-8 text-center">
              <Lock className="w-8 h-8 text-amber-600 mx-auto mb-2" />
              <p className="font-medium text-foreground">This topic is locked</p>
              <p className="text-sm text-muted-foreground mt-1">{lockMessage}</p>
              {prevId && (
                <Link href={`/learn/${slug}/topic/${prevId}`}>
                  <Button variant="outline" className="rounded-xl mt-4">Go to previous topic</Button>
                </Link>
              )}
            </div>
          ) : (
            <>
              {topic.description && (
                <p className="text-lg text-muted-foreground mb-6 leading-relaxed max-w-[64ch]">
                  {topic.description}
                </p>
              )}
              {/* Immersive reading surface — comfortable measure, generous air. */}
              <article className="bg-card rounded-3xl border border-border shadow-soft p-7 md:p-10 pb-32">
                <div className="max-w-[68ch] text-[1.02rem] leading-[1.75]">
                  {full ? (
                    <>
                      {isDiscussion && <DiscussionBrief topic={full} tree={tree} slug={slug} />}
                      {(!isDiscussion || full.content || full.videoUrl || full.audioUrl || full.documentUrl) && (
                        <div className={isDiscussion ? "mt-8" : undefined}>
                          <ContentRenderer
                            item={full}
                            documentDownload={canDownload ? topicDownloadUrl(slug, full.id, "document") : null}
                          />
                        </div>
                      )}
                    </>
                  ) : bodyError ? (
                    <p className="text-muted-foreground">This topic couldn&apos;t be loaded. Please refresh the page.</p>
                  ) : (
                    <div className="space-y-3" aria-busy="true" aria-label="Loading topic">
                      <div className="skeleton h-5 w-11/12 rounded-lg" />
                      <div className="skeleton h-5 w-10/12 rounded-lg" />
                      <div className="skeleton h-5 w-9/12 rounded-lg" />
                    </div>
                  )}
                </div>
              </article>

              {full && canDownload && <Downloads slug={slug} topic={full} />}

              {isDiscussion && full && (
                <section aria-labelledby="discussion-heading" className="mt-6 rounded-3xl border border-border bg-card shadow-soft p-6 md:p-8">
                  <h2 id="discussion-heading" className="flex items-center gap-2 font-semibold text-foreground">
                    <MessagesSquare className="w-5 h-5 text-violet-600" aria-hidden /> Discussion
                  </h2>
                  {full.discussion.required && (
                    <p className="text-[13px] text-muted-foreground mt-1">Post at least one reply to complete this topic.</p>
                  )}
                  {topicData?.discussionThreadId ? (
                    <ThreadPanel threadId={topicData.discussionThreadId} isStaff={!isStudent} onReplied={() => toast.success("Reply posted.")} />
                  ) : (
                    <p className="text-sm text-muted-foreground mt-3">The discussion thread isn&apos;t available yet.</p>
                  )}
                </section>
              )}

              {nextItem && nextItem.kind !== "topic" && (done || !isStudent) && (
                <Link
                  href={itemHref(slug, nextItem)}
                  className="mt-6 flex items-center gap-4 rounded-3xl border border-violet-600/25 bg-violet-600/[0.05] p-5 hover:bg-violet-600/[0.09] transition-colors"
                >
                  <span className="w-10 h-10 rounded-2xl bg-violet-600 text-white flex items-center justify-center shrink-0">
                    {nextItem.kind === "assignment" ? <NotebookPen className="w-5 h-5" aria-hidden /> : <ClipboardCheck className="w-5 h-5" aria-hidden />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-foreground">
                      {nextItem.kind === "assignment" ? "Lesson assignment" : `Module ${pad2(moduleIndex + 1)} assessment`}
                    </span>
                    <span className="block text-[13px] text-muted-foreground">
                      {nextItem.kind === "assignment" ? "Finish this lesson by completing its assignment." : `Check your understanding of ${moduleTitle}.`}
                    </span>
                  </span>
                  <ArrowRight className="w-5 h-5 text-violet-600 shrink-0" aria-hidden />
                </Link>
              )}

              {/* Sticky topic navigation */}
              <div className="sticky bottom-4 mt-6 z-20">
                <div className="glass rounded-full border border-border shadow-soft px-2 py-2 flex items-center justify-between">
                  {prevId ? (
                    <Link href={`/learn/${slug}/topic/${prevId}`}>
                      <Button variant="ghost" className="rounded-full h-10 px-4">
                        <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                      </Button>
                    </Link>
                  ) : (
                    <span className="px-2" />
                  )}
                  <Button
                    onClick={completeAndContinue}
                    disabled={saving || (!isStudent && !nextHref)}
                    className="rounded-full h-10 px-6 bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
                  >
                    {!isStudent
                      ? nextHref ? "Next" : "End of course"
                      : done ? (nextHref ? "Next" : "Finish") : "Mark complete"}
                    {(nextId || nextHref) && <ChevronRight className="w-4 h-4 ml-1" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/** The discussion's prompt, instructions, guiding questions and related topic. */
function DiscussionBrief({ topic, tree, slug }: { topic: Topic; tree: { modules: { lessons: { topics: { id: string; title: string }[] }[] }[] }; slug: string }) {
  const d = topic.discussion;
  const related = d.relatedTopicId
    ? tree.modules.flatMap((m) => m.lessons.flatMap((l) => l.topics)).find((t) => t.id === d.relatedTopicId)
    : null;
  return (
    <div className="space-y-5">
      {d.prompt && <p className="text-[1.15rem] font-medium text-foreground leading-relaxed">{d.prompt}</p>}
      {d.instructions && <p className="text-[15px] text-muted-foreground leading-relaxed whitespace-pre-line">{d.instructions}</p>}
      {d.questions.length > 0 && (
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground">Questions to consider</p>
          <ol className="mt-2 list-decimal pl-5 space-y-1.5 text-[15px] text-foreground">
            {d.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </div>
      )}
      {related && (
        <p className="text-[14px] text-muted-foreground">
          Related topic:{" "}
          <Link href={`/learn/${slug}/topic/${related.id}`} className="text-violet-600 hover:underline">
            {related.title}
          </Link>
        </p>
      )}
    </div>
  );
}

const PART_LABEL: Record<DownloadPart, string> = {
  text: "Text (.md)",
  video: "Video",
  audio: "Audio",
  document: "Document",
  subtitle: "Subtitles",
};

/** Download buttons for every part the topic has (served via the access-checked endpoint). */
function Downloads({ slug, topic }: { slug: string; topic: Topic }) {
  const parts = (
    [
      ["text", topic.content.trim()],
      ["video", topic.videoUrl],
      ["audio", topic.audioUrl],
      ["document", topic.documentUrl],
      ["subtitle", topic.subtitleUrl],
    ] as [DownloadPart, string][]
  ).filter(([, v]) => !!v && !/youtube\.com|youtu\.be|vimeo\.com/.test(v));
  if (parts.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Downloads">
      <span className="text-[13px] text-muted-foreground mr-1">Download:</span>
      {parts.map(([part]) => (
        <a
          key={part}
          href={topicDownloadUrl(slug, topic.id, part)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-card text-[13px] text-foreground hover:bg-secondary transition-colors"
        >
          <Download className="w-3.5 h-3.5" aria-hidden /> {PART_LABEL[part]}
        </a>
      ))}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-background px-4">{children}</div>;
}
function Msg({ title, href, cta }: { title: string; href: string; cta: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-card p-10 text-center">
      <p className="font-medium text-foreground">{title}</p>
      <Link href={href} className="text-violet-600 underline text-sm mt-2 inline-block">{cta}</Link>
    </div>
  );
}
