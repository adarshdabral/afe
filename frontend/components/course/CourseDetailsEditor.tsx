"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateCourse, type Course } from "@/lib/api/courses";
import { uploadFile, uploadErrorMessage } from "@/lib/api/uploads";

/** One chip per line (commas also split), trimmed, blanks and duplicates dropped. */
function parseChips(text: string): string[] {
  return [...new Set(text.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))];
}

function formFrom(c: Course) {
  return {
    instructor: c.instructor ?? "",
    instructorTitle: c.instructorTitle ?? "",
    skills: (c.skills ?? []).join("\n"),
    tools: (c.tools ?? []).join("\n"),
    offeredName: c.offeredBy?.name ?? "",
    offeredDescription: c.offeredBy?.description ?? "",
    offeredUrl: c.offeredBy?.url ?? "",
    offeredLogoUrl: c.offeredBy?.logoUrl ?? "",
  };
}

// Course page metadata: instructor + badge credential, "Skills you'll gain",
// "Tools you'll learn" and "Offered by" — all shown on the public course page.
export function CourseDetailsEditor({ course, onSaved }: { course: Course; onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => formFrom(course));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  useEffect(() => setForm(formFrom(course)), [course]);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      await updateCourse(course.id, {
        instructor: form.instructor.trim(),
        instructorTitle: form.instructorTitle.trim(),
        skills: parseChips(form.skills),
        tools: parseChips(form.tools),
        offeredBy: {
          name: form.offeredName.trim(),
          description: form.offeredDescription.trim(),
          url: form.offeredUrl.trim(),
          logoUrl: form.offeredLogoUrl.trim(),
        },
      });
      toast.success("Course details saved.");
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save course details");
    } finally {
      setBusy(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const res = await uploadFile(file);
      set("offeredLogoUrl", res.url);
      toast.success("Logo uploaded — save to apply.");
    } catch (err) {
      toast.error(uploadErrorMessage(err, "Logo upload failed"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="mb-6 border-b border-border pb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-foreground">Course page details</span>
          <span className="block text-xs text-muted-foreground">Instructor, skills, tools and &ldquo;Offered by&rdquo;</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cd-instructor">Instructor</Label>
            <Input id="cd-instructor" value={form.instructor} onChange={(e) => set("instructor", e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-instructor-title">Instructor credential (badge line)</Label>
            <Input
              id="cd-instructor-title"
              value={form.instructorTitle}
              onChange={(e) => set("instructorTitle", e.target.value)}
              maxLength={200}
              placeholder="e.g. Professor, School of Management"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-skills">Skills you&apos;ll gain (one per line)</Label>
            <Textarea id="cd-skills" rows={5} value={form.skills} onChange={(e) => set("skills", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-tools">Tools you&apos;ll learn (one per line)</Label>
            <Textarea id="cd-tools" rows={5} value={form.tools} onChange={(e) => set("tools", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-offered-name">Offered by — institution</Label>
            <Input id="cd-offered-name" value={form.offeredName} onChange={(e) => set("offeredName", e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-offered-desc">Offered by — department / details</Label>
            <Input id="cd-offered-desc" value={form.offeredDescription} onChange={(e) => set("offeredDescription", e.target.value)} maxLength={2000} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-offered-url">Institution website</Label>
            <Input id="cd-offered-url" type="url" value={form.offeredUrl} onChange={(e) => set("offeredUrl", e.target.value)} placeholder="https://" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-offered-logo">Institution logo URL</Label>
            <div className="flex gap-2">
              <Input id="cd-offered-logo" value={form.offeredLogoUrl} onChange={(e) => set("offeredLogoUrl", e.target.value)} placeholder="https:// or upload" />
              <label className="inline-flex items-center gap-1 shrink-0 h-9 px-3 rounded-md border border-input text-sm cursor-pointer hover:bg-secondary">
                <Upload className="w-4 h-4" aria-hidden /> {uploading ? "Uploading…" : "Upload"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void uploadLogo(f);
                  }}
                />
              </label>
            </div>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button onClick={save} disabled={busy || uploading} className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
              <Save className="w-4 h-4 mr-1" /> {busy ? "Saving…" : "Save details"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
