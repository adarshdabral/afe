import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Sign Up — AI For Everyone" }] }),
  component: Register,
});

function Register() {
  const [form, setForm] = useState({ name: "", email: "", pwd: "", confirm: "" });
  const [role, setRole] = useState<"Student" | "Instructor">("Student");
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!form.name) er.name = "Required";
    if (!form.email) er.email = "Required";
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) er.email = "Invalid email";
    if (!form.pwd) er.pwd = "Required";
    else if (form.pwd.length < 6) er.pwd = "Min 6 characters";
    if (form.confirm !== form.pwd) er.confirm = "Passwords don't match";
    if (!terms) er.terms = "You must accept terms";
    setErrs(er);
    if (Object.keys(er).length) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Account created!");
      navigate({ to: "/login" });
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
          <p className="text-3xl font-bold leading-tight">"Join 12,000+ learners building the future, one lesson at a time."</p>
        </div>
        <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold text-foreground">Create your account</h1>
          <p className="text-muted-foreground mt-2">Free forever. No credit card.</p>

          <div className="mt-6 flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
            {(["Student", "Instructor"] as const).map((r) => (
              <button key={r} onClick={() => setRole(r)} type="button"
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${role === r ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                {r}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {[
              { k: "name", label: "Full Name", type: "text" },
              { k: "email", label: "Email", type: "email" },
              { k: "pwd", label: "Password", type: "password" },
              { k: "confirm", label: "Confirm Password", type: "password" },
            ].map((f) => (
              <div key={f.k}>
                <Label htmlFor={f.k}>{f.label}</Label>
                <Input id={f.k} type={f.type} value={form[f.k as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [f.k]: e.target.value })}
                  className={`mt-1.5 rounded-xl h-11 ${errs[f.k] ? "ring-2 ring-red-500" : ""}`} />
                {errs[f.k] && <p className="text-xs text-red-500 mt-1">{errs[f.k]}</p>}
              </div>
            ))}
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={terms} onCheckedChange={(v) => setTerms(v === true)} />
              <span className="text-muted-foreground">I agree to the <a href="#" className="text-violet-600 hover:underline">Terms</a> and <a href="#" className="text-violet-600 hover:underline">Privacy Policy</a></span>
            </label>
            {errs.terms && <p className="text-xs text-red-500 -mt-2">{errs.terms}</p>}
            <Button type="submit" disabled={loading} className="w-full rounded-xl h-11 bg-violet-600 hover:bg-violet-700 text-white">
              {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Create Account"}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-6">
            Already have an account? <Link to="/login" className="text-violet-600 font-medium hover:underline">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
