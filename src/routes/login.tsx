import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Login — AI For Everyone" }] }),
  component: Login,
});

function Login() {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errs, setErrs] = useState<{ email?: string; pwd?: string }>({});
  const navigate = useNavigate();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: typeof errs = {};
    if (!email) er.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(email)) er.email = "Enter a valid email";
    if (!pwd) er.pwd = "Password is required";
    setErrs(er);
    if (Object.keys(er).length) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Welcome back!");
      navigate({ to: "/student/dashboard" });
    }, 1000);
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="relative hidden md:flex flex-col justify-between p-12 text-white bg-gradient-to-br from-violet-600 to-violet-800 overflow-hidden">
        <Link to="/" className="flex items-center gap-2 font-semibold relative z-10">
          <span className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center"><Sparkles className="w-4 h-4" /></span>
          AI For Everyone
        </Link>
        <div className="relative z-10">
          <p className="text-3xl font-bold leading-tight">"This platform completely changed my career trajectory. I learned more in 6 months than 4 years of college."</p>
          <p className="mt-4 text-white/80">— Ananya R., ML Engineer</p>
        </div>
        <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="md:hidden flex items-center gap-2 font-semibold mb-8">
            <span className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center"><Sparkles className="w-4 h-4" /></span>
            AI For Everyone
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Welcome back</h1>
          <p className="text-muted-foreground mt-2">Login to continue your learning journey.</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                className={`mt-1.5 rounded-xl h-11 ${errs.email ? "ring-2 ring-red-500" : ""}`} />
              {errs.email && <p className="text-xs text-red-500 mt-1">{errs.email}</p>}
            </div>
            <div>
              <div className="flex justify-between">
                <Label htmlFor="pwd">Password</Label>
                <Link to="/forgot-password" className="text-xs text-violet-600 hover:underline">Forgot password?</Link>
              </div>
              <div className="relative mt-1.5">
                <Input id="pwd" type={show ? "text" : "password"} value={pwd} onChange={(e) => setPwd(e.target.value)}
                  className={`rounded-xl h-11 pr-10 ${errs.pwd ? "ring-2 ring-red-500" : ""}`} />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errs.pwd && <p className="text-xs text-red-500 mt-1">{errs.pwd}</p>}
            </div>
            <Button type="submit" disabled={loading} className="w-full rounded-xl h-11 bg-violet-600 hover:bg-violet-700 text-white">
              {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Login"}
            </Button>
            <Button type="button" variant="outline" className="w-full rounded-xl h-11" onClick={() => toast("Mock Google sign-in")}>
              Continue with Google
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-6">
            Don't have an account? <Link to="/register" className="text-violet-600 font-medium hover:underline">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
