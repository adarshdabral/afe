"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getRegistrationDirectory,
  registerStudent,
  type School,
  type TeacherDirectoryEntry,
} from "@/lib/api/registrations";
import { signup, type Role } from "@/lib/api/auth";
import { roleHome } from "@/lib/access";

const CLASSES = ["8", "9", "10", "11", "12"] as const;

const ROLES: { value: Role; label: string }[] = [
  { value: "student", label: "Student" },
  { value: "teacher", label: "Teacher" },
  { value: "school_admin", label: "School Admin" },
  { value: "platform_admin", label: "Platform Admin" },
];

const selectClass =
  "mt-1.5 w-full h-11 px-3 rounded-xl border border-input bg-card text-sm text-foreground";

export default function Register() {
  const router = useRouter();
  const [directory, setDirectory] = useState<{
    schools: School[];
    teachers: TeacherDirectoryEntry[];
  } | null>(null);

  useEffect(() => {
    getRegistrationDirectory()
      .then(setDirectory)
      .catch(() => setDirectory({ schools: [], teachers: [] }));
  }, []);

  const [form, setForm] = useState({
    role: "student" as Role,
    name: "",
    className: "",
    rollNumber: "",
    schoolId: "",
    teacherId: "",
    username: "",
    email: "",
    mobile: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const isStudent = form.role === "student";

  const teachers = useMemo(
    () => (directory?.teachers ?? []).filter((t) => t.schoolId === form.schoolId),
    [directory, form.schoolId],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!form.name) er.name = "Required";
    if (!form.password) er.password = "Required";
    else if (form.password.length < 6) er.password = "Min 6 characters";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) er.email = "Invalid email";

    if (isStudent) {
      if (!form.className) er.className = "Select your class";
      if (!form.rollNumber) er.rollNumber = "Required";
      if (!form.schoolId) er.schoolId = "Select your school";
      if (!form.teacherId) er.teacherId = "Select your teacher";
      if (!form.mobile) er.mobile = "Required";
    } else {
      if (!form.email && !form.username) er.username = "Provide an email or username";
      if (form.username && form.username.length < 3) er.username = "Min 3 characters";
    }
    setErrs(er);
    if (Object.keys(er).length) return;

    setLoading(true);
    try {
      if (isStudent) {
        await registerStudent({
          name: form.name,
          className: form.className as (typeof CLASSES)[number],
          rollNumber: form.rollNumber,
          schoolId: form.schoolId,
          teacherId: form.teacherId,
          email: form.email || undefined,
          mobile: form.mobile,
          password: form.password,
        });
        toast.success("Registration submitted — awaiting teacher approval.");
        router.push("/student/pending");
      } else {
        const user = await signup({
          role: form.role,
          name: form.name,
          email: form.email || undefined,
          username: form.username || undefined,
          mobile: form.mobile || undefined,
          password: form.password,
        });
        toast.success("Account created.");
        router.push(roleHome(user.role));
      }
    } catch (err) {
      setLoading(false);
      const message = err instanceof Error ? err.message : "Registration failed";
      setErrs({ form: message });
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="relative hidden md:flex flex-col justify-between p-12 text-white bg-gradient-to-br from-violet-600 to-violet-800 overflow-hidden">
        <Link href="/" className="flex items-center gap-2 font-semibold relative z-10">
          <span className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </span>
          AI For Everyone
        </Link>
        <div className="relative z-10">
          <p className="text-3xl font-bold leading-tight">
            "Register to start your AI literacy journey."
          </p>
          <p className="mt-4 text-white/80">
            Students are approved by their teacher; staff accounts are active right away.
          </p>
        </div>
        <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold text-foreground">
            {isStudent ? "Student Registration" : "Create your account"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isStudent
              ? "Free for school students. Access is granted after your teacher approves."
              : "Choose your role and create an account to get started."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="I am a" error={errs.role}>
              <select
                value={form.role}
                onChange={(e) => set("role", e.target.value as Role)}
                className={selectClass}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Full Name" error={errs.name}>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className={`mt-1.5 rounded-xl h-11 ${errs.name ? "ring-2 ring-red-500" : ""}`}
              />
            </Field>

            {isStudent ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Class" error={errs.className}>
                    <select
                      value={form.className}
                      onChange={(e) => set("className", e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Select</option>
                      {CLASSES.map((c) => (
                        <option key={c} value={c}>
                          Class {c}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Roll Number" error={errs.rollNumber}>
                    <Input
                      value={form.rollNumber}
                      onChange={(e) => set("rollNumber", e.target.value)}
                      className={`mt-1.5 rounded-xl h-11 ${errs.rollNumber ? "ring-2 ring-red-500" : ""}`}
                    />
                  </Field>
                </div>

                <Field label="School" error={errs.schoolId}>
                  <select
                    value={form.schoolId}
                    onChange={(e) => {
                      set("schoolId", e.target.value);
                      set("teacherId", ""); // reset teacher when school changes
                    }}
                    className={selectClass}
                  >
                    <option value="">Select your school</option>
                    {(directory?.schools ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Teacher" error={errs.teacherId}>
                  <select
                    value={form.teacherId}
                    onChange={(e) => set("teacherId", e.target.value)}
                    disabled={!form.schoolId}
                    className={`${selectClass} disabled:opacity-50`}
                  >
                    <option value="">
                      {form.schoolId ? "Select your teacher" : "Select a school first"}
                    </option>
                    {teachers.map((t) => (
                      <option key={`${t.id}-${t.schoolId}`} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Mobile Number" error={errs.mobile}>
                  <Input
                    value={form.mobile}
                    onChange={(e) => set("mobile", e.target.value)}
                    placeholder="Used to sign in"
                    className={`mt-1.5 rounded-xl h-11 ${errs.mobile ? "ring-2 ring-red-500" : ""}`}
                  />
                </Field>

                <Field label="Email (optional)" error={errs.email}>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    className={`mt-1.5 rounded-xl h-11 ${errs.email ? "ring-2 ring-red-500" : ""}`}
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="Username" error={errs.username}>
                  <Input
                    value={form.username}
                    onChange={(e) => set("username", e.target.value)}
                    placeholder="Used to sign in"
                    className={`mt-1.5 rounded-xl h-11 ${errs.username ? "ring-2 ring-red-500" : ""}`}
                  />
                </Field>

                <Field label="Email (optional)" error={errs.email}>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    className={`mt-1.5 rounded-xl h-11 ${errs.email ? "ring-2 ring-red-500" : ""}`}
                  />
                </Field>
              </>
            )}

            <Field label="Password" error={errs.password}>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                className={`mt-1.5 rounded-xl h-11 ${errs.password ? "ring-2 ring-red-500" : ""}`}
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
              ) : isStudent ? (
                "Submit Registration"
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-violet-600 font-medium hover:underline">
              Login
            </Link>
          </p>
        </div>
      </div>
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
