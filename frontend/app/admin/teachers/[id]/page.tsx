"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ShieldCheck, Power, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { AdminSidebar } from "@/components/AdminSidebar";
import { CredentialsCard } from "@/components/CredentialsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/context/AppContext";
import {
  activateTeacher,
  deactivateTeacher,
  getTeacher,
  resetTeacherPassword,
  updateTeacher,
  type Credentials,
  type Teacher,
} from "@/lib/api/teachers";

// Platform-admin-only: view + edit a teacher, toggle active state, reset password.
export default function TeacherDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { role, loadingUser } = useApp();
  const isPlatform = role === "platform_admin";

  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [notFound, setNotFound] = useState(false);
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
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newCreds, setNewCreds] = useState<Credentials | null>(null);

  const hydrate = (t: Teacher) => {
    setTeacher(t);
    setForm({
      name: t.name,
      email: t.email,
      mobile: t.mobile,
      designation: t.designation,
      organization: t.organization,
      specialization: t.specialization,
      bio: t.bio,
      profilePhoto: t.profilePhoto,
    });
  };

  useEffect(() => {
    if (!isPlatform || !id) return;
    getTeacher(id)
      .then(hydrate)
      .catch(() => setNotFound(true));
  }, [isPlatform, id]);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!form.name.trim()) er.name = "Required";
    if (!form.email.trim()) er.email = "Required";
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) er.email = "Invalid email";
    if (form.profilePhoto && !/^https?:\/\/\S+$/.test(form.profilePhoto))
      er.profilePhoto = "Enter a valid URL";
    setErrs(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      const updated = await updateTeacher(id, {
        name: form.name.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        designation: form.designation.trim(),
        organization: form.organization.trim(),
        specialization: form.specialization.trim(),
        bio: form.bio.trim(),
        profilePhoto: form.profilePhoto.trim(),
      });
      hydrate(updated);
      toast.success("Teacher updated.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update teacher";
      setErrs({ form: message });
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!teacher) return;
    setBusy(true);
    try {
      const updated = teacher.active ? await deactivateTeacher(id) : await activateTeacher(id);
      hydrate(updated);
      toast.success(updated.active ? "Teacher activated." : "Teacher deactivated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update status");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    setBusy(true);
    try {
      const result = await resetTeacherPassword(id);
      hydrate(result.teacher);
      setNewCreds(result.credentials);
      toast.success("New temporary password generated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setBusy(false);
    }
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

          {!loadingUser && !isPlatform ? (
            <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
              <ShieldCheck className="w-10 h-10 text-violet-600 mx-auto mb-3" />
              <p className="font-medium text-foreground">Platform admins only</p>
            </div>
          ) : notFound ? (
            <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
              <p className="font-medium text-foreground">Teacher not found</p>
              <p className="text-sm text-muted-foreground mt-1">
                This account may have been removed.
              </p>
            </div>
          ) : !teacher ? (
            <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-3xl font-bold text-foreground">{teacher.name}</h1>
                  <p className="text-muted-foreground mt-1">
                    {teacher.designation || "Teacher"} · joined{" "}
                    {new Date(teacher.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    teacher.active
                      ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300"
                      : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                  }`}
                >
                  {teacher.active ? "Active" : "Inactive"}
                </span>
              </div>

              {newCreds && (
                <div className="mt-6">
                  <CredentialsCard credentials={newCreds} />
                </div>
              )}

              <form
                onSubmit={save}
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
                    className={`mt-1.5 rounded-xl h-11 ${errs.email ? "ring-2 ring-red-500" : ""}`}
                  />
                </Field>
                <Field label="Mobile" error={errs.mobile}>
                  <Input
                    value={form.mobile}
                    onChange={(e) => set("mobile", e.target.value)}
                    className="mt-1.5 rounded-xl h-11"
                  />
                </Field>
                <Field label="Designation" error={errs.designation}>
                  <Input
                    value={form.designation}
                    onChange={(e) => set("designation", e.target.value)}
                    className="mt-1.5 rounded-xl h-11"
                  />
                </Field>
                <Field label="Organization" error={errs.organization}>
                  <Input
                    value={form.organization}
                    onChange={(e) => set("organization", e.target.value)}
                    className="mt-1.5 rounded-xl h-11"
                  />
                </Field>
                <Field label="Specialization" error={errs.specialization}>
                  <Input
                    value={form.specialization}
                    onChange={(e) => set("specialization", e.target.value)}
                    className="mt-1.5 rounded-xl h-11"
                  />
                </Field>
                <Field label="Profile Photo URL" error={errs.profilePhoto}>
                  <Input
                    value={form.profilePhoto}
                    onChange={(e) => set("profilePhoto", e.target.value)}
                    placeholder="https://…"
                    className={`mt-1.5 rounded-xl h-11 ${errs.profilePhoto ? "ring-2 ring-red-500" : ""}`}
                  />
                </Field>
                <Field label="Bio" error={errs.bio}>
                  <textarea
                    value={form.bio}
                    onChange={(e) => set("bio", e.target.value)}
                    rows={3}
                    className="mt-1.5 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground"
                  />
                </Field>

                {errs.form && <p className="text-xs text-red-500">{errs.form}</p>}

                <Button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-xl h-11 bg-violet-600 hover:bg-violet-700 text-white"
                >
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </form>

              <div className="mt-6 bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <h2 className="font-semibold text-foreground mb-1">Account actions</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  A deactivated teacher cannot sign in. Resetting the password issues a new
                  temporary one.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={toggleActive}
                    className="rounded-xl h-11"
                  >
                    <Power className="w-4 h-4 mr-2" />
                    {teacher.active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={resetPassword}
                    className="rounded-xl h-11"
                  >
                    <KeyRound className="w-4 h-4 mr-2" /> Reset password
                  </Button>
                </div>
              </div>
            </>
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
