"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, type Role } from "@/lib/api/auth";
import { useApp } from "@/context/AppContext";
import { BrandMark } from "@/components/BrandMark";
import { PLATFORM_NAME } from "@/lib/course";

function roleHome(role: Role): string {
  switch (role) {
    case "teacher":
      return "/instructor/dashboard";
    case "platform_admin":
      return "/admin/dashboard";
    default:
      return "/student/dashboard";
  }
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errs, setErrs] = useState<{ email?: string; pwd?: string }>({});
  const router = useRouter();
  const { setSession } = useApp();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: typeof errs = {};
    if (!email) er.email = "Email or username is required";
    if (!pwd) er.pwd = "Password is required";
    setErrs(er);
    if (Object.keys(er).length) return;
    setLoading(true);
    try {
      const user = await login({ login: email, password: pwd });
      setSession(user); // sync the session into context so the role is known before navigating
      toast.success("Welcome back!");
      router.push(roleHome(user.role));
    } catch {
      setLoading(false);
      setErrs({ pwd: "Invalid email or password" });
      toast.error("Invalid email or password");
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
          <BrandMark variant="glass" />
          {PLATFORM_NAME}
        </Link>
        <div className="relative z-10 max-w-sm">
          <p className="text-sm font-medium text-white/60">Demystifying AI for Everyone</p>
          <p className="mt-2 text-[1.75rem] leading-snug font-semibold tracking-tight text-white">
            Understand artificial intelligence — its applications, opportunities and impact.
          </p>
          <p className="mt-5 text-sm text-white/60">With Dr. Sudhanshu Joshi</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm animate-fade-up">
          <Link href="/" className="md:hidden flex items-center gap-2 font-semibold mb-8">
            <BrandMark />
            {PLATFORM_NAME}
          </Link>
          <h1 className="text-[2rem] font-semibold text-foreground tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground mt-2">Sign in to continue learning.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="email">Email or username</Label>
              <Input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@afe.edu"
                className={`mt-1.5 rounded-2xl h-12 bg-secondary/60 border-transparent focus-visible:bg-card ${errs.email ? "ring-2 ring-red-500" : ""}`}
              />
              {errs.email && <p className="text-xs text-red-500 mt-1">{errs.email}</p>}
            </div>
            <div>
              <div className="flex justify-between">
                <Label htmlFor="pwd">Password</Label>
                <Link href="/forgot-password" className="text-xs text-violet-600 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative mt-1.5">
                <Input
                  id="pwd"
                  type={show ? "text" : "password"}
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  className={`rounded-2xl h-12 pr-10 bg-secondary/60 border-transparent focus-visible:bg-card ${errs.pwd ? "ring-2 ring-red-500" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errs.pwd && <p className="text-xs text-red-500 mt-1">{errs.pwd}</p>}
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-full h-12 bg-violet-600 hover:bg-violet-700 text-white shadow-sm mt-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Login"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-full h-12 bg-card"
              onClick={() => toast("Mock Google sign-in")}
            >
              Continue with Google
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-violet-600 font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
