"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/context/AppContext";
import { createCourse, COURSE_LEVELS, type CourseLevel } from "@/lib/api/courses";

const inputClass = "mt-1.5 rounded-xl h-11";
const selectClass =
  "mt-1.5 w-full h-11 px-3 rounded-xl border border-input bg-card text-sm text-foreground";

const schema = z.object({
  title: z.string().trim().min(1, "Required").max(200),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]*$/i, "Letters, numbers, hyphens only")
    .max(160),
  shortDescription: z.string().max(500),
  description: z.string().max(50000),
});

export default function CreateCourse() {
  const router = useRouter();
  const { role } = useApp();
  const isPlatform = role === "platform_admin";

  const [form, setForm] = useState({
    title: "",
    slug: "",
    shortDescription: "",
    description: "",
    level: "beginner" as CourseLevel,
    tags: "",
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const er: Record<string, string> = {};
      for (const i of parsed.error.issues) er[String(i.path[0])] = i.message;
      setErrs(er);
      return;
    }
    setErrs({});
    setLoading(true);
    try {
      const course = await createCourse({
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        shortDescription: form.shortDescription || undefined,
        description: form.description || undefined,
        level: form.level,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      toast.success("Course created.");
      router.push(`/admin/courses/${course.id}`);
    } catch (err) {
      setLoading(false);
      const message = err instanceof Error ? err.message : "Could not create course";
      setErrs({ form: message });
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <AdminSidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
          <Link
            href="/admin/courses"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to courses
          </Link>
          <h1 className="text-3xl font-bold text-foreground">New course</h1>
          <p className="text-muted-foreground mt-1">
            Courses start as a draft. You can add modules and lessons after creating it.
          </p>

          {!isPlatform ? (
            <div className="mt-6 bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
              <ShieldCheck className="w-10 h-10 text-violet-600 mx-auto mb-3" />
              <p className="font-medium text-foreground">Platform admins only</p>
            </div>
          ) : (
            <form
              onSubmit={submit}
              className="mt-6 space-y-4 bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
            >
              <Field label="Title" error={errs.title}>
                <Input
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  className={`${inputClass} ${errs.title ? "ring-2 ring-red-500" : ""}`}
                />
              </Field>
              <Field label="Slug (optional — derived from title)" error={errs.slug}>
                <Input
                  value={form.slug}
                  onChange={(e) => set("slug", e.target.value)}
                  placeholder="intro-to-ai"
                  className={`${inputClass} ${errs.slug ? "ring-2 ring-red-500" : ""}`}
                />
              </Field>
              <Field label="Short description" error={errs.shortDescription}>
                <Input
                  value={form.shortDescription}
                  onChange={(e) => set("shortDescription", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  rows={4}
                  className="mt-1.5 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Level">
                  <select
                    value={form.level}
                    onChange={(e) => set("level", e.target.value as CourseLevel)}
                    className={selectClass}
                  >
                    {COURSE_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Tags (comma-separated)">
                  <Input
                    value={form.tags}
                    onChange={(e) => set("tags", e.target.value)}
                    placeholder="ai, ml"
                    className={inputClass}
                  />
                </Field>
              </div>

              {errs.form && <p className="text-xs text-red-500">{errs.form}</p>}

              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl h-11 bg-violet-600 hover:bg-violet-700 text-white"
              >
                {loading ? "Creating…" : "Create course"}
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
