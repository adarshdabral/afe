"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AdminSidebar } from "@/components/AdminSidebar";
import { CredentialsCard } from "@/components/CredentialsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/context/AppContext";
import { createTeacher, type Credentials, type Teacher } from "@/lib/api/teachers";

// Platform-admin-only: create a teacher. On success the server generates a
// temporary password (hashed + stored) and returns it once for the admin to share.
export default function CreateTeacher() {
  const { role } = useApp();
  const isPlatform = role === "platform_admin";

  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    designation: "",
    organization: "",
    specialization: "",
    bio: "",
    profilePhoto: "",
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ teacher: Teacher; credentials: Credentials } | null>(
    null,
  );

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!form.name.trim()) er.name = "Required";
    if (!form.email.trim()) er.email = "Required";
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) er.email = "Invalid email";
    if (form.mobile && (form.mobile.length < 7 || form.mobile.length > 20))
      er.mobile = "7–20 digits";
    if (form.profilePhoto && !/^https?:\/\/\S+$/.test(form.profilePhoto))
      er.profilePhoto = "Enter a valid URL";
    setErrs(er);
    if (Object.keys(er).length) return;

    setLoading(true);
    try {
      const result = await createTeacher({
        name: form.name.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim() || undefined,
        designation: form.designation.trim() || undefined,
        organization: form.organization.trim() || undefined,
        specialization: form.specialization.trim() || undefined,
        bio: form.bio.trim() || undefined,
        profilePhoto: form.profilePhoto.trim() || undefined,
      });
      setCreated(result);
      toast.success(`Teacher "${result.teacher.name}" created.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create teacher";
      setErrs({ form: message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setForm({
      name: "",
      email: "",
      mobile: "",
      designation: "",
      organization: "",
      specialization: "",
      bio: "",
      profilePhoto: "",
    });
    setErrs({});
    setCreated(null);
  };

  return (
    <div className="min-h-screen flex bg-background">
      <AdminSidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
          <Link
            href="/admin/teachers"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to teachers
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Create teacher</h1>
          <p className="text-muted-foreground mt-1">
            The teacher signs in with their email and the generated temporary password.
          </p>

          {!isPlatform ? (
            <div className="mt-6 bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
              <ShieldCheck className="w-10 h-10 text-violet-600 mx-auto mb-3" />
              <p className="font-medium text-foreground">Platform admins only</p>
            </div>
          ) : created ? (
            <div className="mt-6 space-y-4">
              <CredentialsCard credentials={created.credentials} />
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="rounded-xl h-11 flex-1"
                  onClick={reset}
                >
                  Create another
                </Button>
                <Link href={`/admin/teachers/${created.teacher.id}`} className="flex-1">
                  <Button className="w-full rounded-xl h-11 bg-violet-600 hover:bg-violet-700 text-white">
                    Manage teacher
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form
              onSubmit={submit}
              className="mt-6 space-y-4 bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
            >
              <Field label="Full Name" error={errs.name}>
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  className={`mt-1.5 rounded-xl h-11 ${errs.name ? "ring-2 ring-red-500" : ""}`}
                />
              </Field>
              <Field label="Email" error={errs.email}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="Used to sign in"
                  className={`mt-1.5 rounded-xl h-11 ${errs.email ? "ring-2 ring-red-500" : ""}`}
                />
              </Field>
              <Field label="Mobile (optional)" error={errs.mobile}>
                <Input
                  value={form.mobile}
                  onChange={(e) => set("mobile", e.target.value)}
                  className={`mt-1.5 rounded-xl h-11 ${errs.mobile ? "ring-2 ring-red-500" : ""}`}
                />
              </Field>
              <Field label="Designation (optional)" error={errs.designation}>
                <Input
                  value={form.designation}
                  onChange={(e) => set("designation", e.target.value)}
                  placeholder="e.g. Senior Faculty"
                  className="mt-1.5 rounded-xl h-11"
                />
              </Field>
              <Field label="Organization (optional)" error={errs.organization}>
                <Input
                  value={form.organization}
                  onChange={(e) => set("organization", e.target.value)}
                  placeholder="e.g. Doon University"
                  className="mt-1.5 rounded-xl h-11"
                />
              </Field>
              <Field label="Specialization (optional)" error={errs.specialization}>
                <Input
                  value={form.specialization}
                  onChange={(e) => set("specialization", e.target.value)}
                  placeholder="e.g. Machine Learning"
                  className="mt-1.5 rounded-xl h-11"
                />
              </Field>
              <Field label="Profile Photo URL (optional)" error={errs.profilePhoto}>
                <Input
                  value={form.profilePhoto}
                  onChange={(e) => set("profilePhoto", e.target.value)}
                  placeholder="https://…"
                  className={`mt-1.5 rounded-xl h-11 ${errs.profilePhoto ? "ring-2 ring-red-500" : ""}`}
                />
              </Field>
              <Field label="Bio (optional)" error={errs.bio}>
                <textarea
                  value={form.bio}
                  onChange={(e) => set("bio", e.target.value)}
                  rows={3}
                  placeholder="Short introduction shown to students"
                  className="mt-1.5 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground"
                />
              </Field>

              {errs.form && <p className="text-xs text-red-500">{errs.form}</p>}

              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl h-11 bg-violet-600 hover:bg-violet-700 text-white"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Create teacher"
                )}
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
