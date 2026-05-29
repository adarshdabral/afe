import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset Password" }] }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); setSent(true); }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
        <Link to="/" className="flex items-center gap-2 font-semibold text-foreground mb-6">
          <span className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center"><Sparkles className="w-4 h-4" /></span>
          AI For Everyone
        </Link>
        {!sent ? (
          <>
            <h1 className="text-2xl font-bold text-foreground">Reset your password</h1>
            <p className="text-muted-foreground mt-2 text-sm">Enter your email and we'll send you a reset link.</p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 rounded-xl h-11" placeholder="you@example.com" />
              </div>
              <Button type="submit" disabled={loading} className="w-full rounded-xl h-11 bg-violet-600 hover:bg-violet-700 text-white">
                {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Send Reset Link"}
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 mx-auto flex items-center justify-center animate-in zoom-in duration-300">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-foreground">Reset link sent!</h2>
            <p className="text-muted-foreground mt-2 text-sm">Check your email for further instructions.</p>
          </div>
        )}
        <Link to="/login" className="mt-6 inline-flex items-center gap-1 text-sm text-violet-600 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to login
        </Link>
      </div>
    </div>
  );
}
