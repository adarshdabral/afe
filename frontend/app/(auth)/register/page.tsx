"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerStudent } from "@/lib/api/registrations";

// zod schema mirrors the backend registerSchema. No class / roll number, and no
// teacher selection — every student is auto-assigned to the default teacher.
const schema = z.object({
  fullName: z.string().trim().min(1, "Required").max(120),
  email: z.string().trim().min(1, "Required").email("Invalid email"),
  password: z.string().min(6, "Min 6 characters"),
  mobileNumber: z.string().trim().min(7, "Enter a valid number").max(20),
  schoolName: z.string().trim().min(1, "Required").max(160),
});

export default function Register() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    mobileNumber: "",
    schoolName: "",
  });
  const [loading, setLoading] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const er: Record<string, string> = {};
      for (const issue of parsed.error.issues) er[String(issue.path[0])] = issue.message;
      setErrs(er);
      return;
    }
    setErrs({});
    setLoading(true);
    try {
      const user = await registerStudent(parsed.data);
      if (user.registrationStatus === "approved") {
        toast.success("Welcome! Your account is ready.");
        router.push("/student/dashboard");
      } else {
        toast.success("Registration submitted — awaiting teacher approval.");
        router.push("/student/pending");
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
      <div
        className="relative hidden md:flex flex-col justify-between p-12 text-white overflow-hidden"
        style={{ background: "#0a0a0f" }}
      >
        <div
          aria-hidden
          className="absolute -bottom-24 -right-24 w-[28rem] h-[28rem] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in srgb, var(--primary) 55%, transparent), transparent)",
          }}
        />
        <div
          aria-hidden
          className="absolute -top-24 -left-16 w-72 h-72 rounded-full blur-3xl opacity-70"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in srgb, var(--primary) 35%, transparent), transparent)",
          }}
        />
        <Link href="/" className="flex items-center gap-2.5 font-semibold relative z-10 tracking-tight">
          <span className="w-8 h-8 rounded-[10px] bg-white/10 border border-white/15 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </span>
          AI For Everyone
        </Link>
        <div className="relative z-10 max-w-sm">
          <p className="text-[1.75rem] leading-snug font-semibold tracking-tight text-white">
            Start your AI literacy journey.
          </p>
          <p className="mt-4 text-sm text-white/60 leading-relaxed">
            Free for school students. Create your account and start learning right away.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm animate-fade-up">
          <h1 className="text-[2rem] font-semibold text-foreground tracking-tight">
            Create your account
          </h1>
          <p className="text-muted-foreground mt-2">
            Free for school students. You&apos;ll get access as soon as you sign up.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <Field label="Full Name" error={errs.fullName}>
              <Input
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                className={`mt-1.5 rounded-2xl h-12 bg-secondary/60 border-transparent focus-visible:bg-card ${errs.fullName ? "ring-2 ring-red-500" : ""}`}
              />
            </Field>

            <Field label="Email" error={errs.email}>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="Used to sign in"
                className={`mt-1.5 rounded-2xl h-12 bg-secondary/60 border-transparent focus-visible:bg-card ${errs.email ? "ring-2 ring-red-500" : ""}`}
              />
            </Field>

            <Field label="School Name" error={errs.schoolName}>
              <Input
                value={form.schoolName}
                onChange={(e) => set("schoolName", e.target.value)}
                placeholder="Your school (for reference only)"
                className={`mt-1.5 rounded-2xl h-12 bg-secondary/60 border-transparent focus-visible:bg-card ${errs.schoolName ? "ring-2 ring-red-500" : ""}`}
              />
            </Field>

            <Field label="Mobile Number" error={errs.mobileNumber}>
              <Input
                value={form.mobileNumber}
                onChange={(e) => set("mobileNumber", e.target.value)}
                className={`mt-1.5 rounded-2xl h-12 bg-secondary/60 border-transparent focus-visible:bg-card ${errs.mobileNumber ? "ring-2 ring-red-500" : ""}`}
              />
            </Field>

            <Field label="Password" error={errs.password}>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                className={`mt-1.5 rounded-2xl h-12 bg-secondary/60 border-transparent focus-visible:bg-card ${errs.password ? "ring-2 ring-red-500" : ""}`}
              />
            </Field>

            {errs.form && <p className="text-xs text-red-500">{errs.form}</p>}

            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-full h-12 bg-violet-600 hover:bg-violet-700 text-white shadow-sm mt-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-violet-600 font-medium hover:underline">
              Login
            </Link>
          </p>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Teachers: your account is created by a platform admin — sign in with the credentials you
            were given.
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
