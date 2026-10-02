"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { AdminSidebar } from "@/components/AdminSidebar";
import { ContentEditor, validateContent, type ContentValue } from "@/components/course/ContentEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/context/AppContext";
import { adminGetCourse, updateSection, SECTION_KINDS, type CourseSection, type SectionKind } from "@/lib/api/courses";

export default function CourseSectionEditor() {
  const { courseId, kind } = useParams<{ courseId: string; kind: string }>();
  const { role, loadingUser } = useApp();
  const isPlatform = role === "platform_admin";
  const validKind = SECTION_KINDS.includes(kind as SectionKind) ? (kind as SectionKind) : null;
  const [section, setSection] = useState<CourseSection | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState<ContentValue>({ contentType: "rich_text" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isPlatform || !validKind) return;
    adminGetCourse(courseId).then((tree) => {
      const current = tree.sections.find((item) => item.kind === validKind) ?? null;
      setSection(current);
      setTitle(current?.title ?? "");
      setDescription(current?.description ?? "");
      setContent({
        contentType: current?.contentType ?? "rich_text",
        content: current?.content ?? "",
        audioUrl: current?.audioUrl ?? "",
        documentUrl: current?.documentUrl ?? "",
        videoUrl: current?.videoUrl ?? "",
        subtitleUrl: current?.subtitleUrl ?? "",
      });
    }).catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Could not load course section");
    }).finally(() => setLoading(false));
  }, [courseId, isPlatform, validKind]);

  const save = async () => {
    if (!validKind) return;
    const errors = validateContent(content);
    if (!title.trim()) errors.title = "A title is required";
    if (Object.keys(errors).length) {
      toast.error(Object.values(errors)[0]);
      return;
    }
    setSaving(true);
    try {
      const saved = await updateSection(courseId, validKind, { title: title.trim(), description, ...content });
      setSection(saved);
      toast.success("Course section saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save course section");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <AdminSidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <Link href={`/admin/courses/${courseId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5">
            <ArrowLeft className="w-4 h-4" /> Back to course
          </Link>
          {!loadingUser && !isPlatform ? <p className="text-muted-foreground">Platform admins only.</p> : !validKind ? <p className="text-muted-foreground">Course section not found.</p> : loading ? <div className="skeleton h-40 rounded-xl" /> : section ? (
            <>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{section.kind}</p>
              <h1 className="text-2xl font-semibold text-foreground mb-6">Edit course section</h1>
              <section className="border-y border-border py-5 space-y-4">
                <div>
                  <Label htmlFor="section-title">Title</Label>
                  <Input id="section-title" value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 h-10" />
                </div>
                <div>
                  <Label htmlFor="section-description">Description</Label>
                  <textarea id="section-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground" />
                </div>
                <ContentEditor value={content} onChange={(patch) => setContent((current) => ({ ...current, ...patch }))} />
                <Button onClick={save} disabled={saving} className="h-10 bg-violet-600 text-white hover:bg-violet-700">
                  <Save className="w-4 h-4 mr-2" /> {saving ? "Saving…" : "Save section"}
                </Button>
              </section>
            </>
          ) : <p className="text-muted-foreground">This section has not been created for the course.</p>}
        </div>
      </main>
    </div>
  );
}
