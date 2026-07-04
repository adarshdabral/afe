"use client";

import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Search,
  GraduationCap,
  Award,
  Star,
  Github,
  Twitter,
  Linkedin,
  BookOpen,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { listPublicCourses, type Course } from "@/lib/api/courses";

export default function Landing() {
  const [featured, setFeatured] = useState<Course[]>([]);
  useEffect(() => {
    listPublicCourses({ pageSize: 6 })
      .then((r) => setFeatured(r.courses))
      .catch(() => setFeatured([]));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* One soft ambient glow — the only color in a near-white stage. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[560px] rounded-full opacity-60 blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in srgb, var(--primary) 16%, transparent), transparent)",
          }}
        />
        <div className="relative max-w-6xl mx-auto px-5 sm:px-6 py-24 md:py-36 grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-card border border-border text-muted-foreground text-[12px] font-medium shadow-soft">
              <Sparkles className="w-3.5 h-3.5 text-violet-600" /> AI-powered learning platform
            </span>
            <h1 className="mt-6 text-[3.4rem] leading-[1.02] md:text-7xl md:leading-[1.03] font-semibold text-foreground tracking-[-0.03em]">
              Learn <span className="text-violet-600">AI</span>.
              <br />
              Build the future.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
              A world-class AI-literacy course — from what AI is to building responsibly. Taught by
              experts. Free for everyone.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/courses">
                <Button
                  size="lg"
                  className="rounded-full bg-violet-600 hover:bg-violet-700 text-white h-12 px-7 text-[15px] shadow-sm"
                >
                  Browse the course <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/register">
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full h-12 px-7 text-[15px] bg-card"
                >
                  Create account
                </Button>
              </Link>
            </div>
            <div className="mt-10 flex items-center gap-3">
              <div className="flex -space-x-2">
                {["AS", "RM", "KV", "SP"].map((i, n) => (
                  <div
                    key={i}
                    className="w-9 h-9 rounded-full ring-2 ring-background flex items-center justify-center text-xs font-semibold text-white"
                    style={{ background: ["#0071e3", "#5e5ce6", "#34c759", "#ff9f0a"][n] }}
                  >
                    {i}
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Join <span className="font-semibold text-foreground">12,000+</span> learners
              </p>
            </div>
          </div>

          {/* Floating course preview cards */}
          <div className="relative hidden lg:block animate-fade-up [animation-delay:120ms]">
            <div className="grid grid-cols-2 gap-5 max-w-md mx-auto">
              {(featured.length ? featured : Array.from({ length: 4 })).slice(0, 4).map((c, i) => (
                <div
                  key={(c as Course)?.id ?? i}
                  className="bg-card rounded-3xl shadow-soft border border-border overflow-hidden elevate"
                  style={{ transform: `translateY(${i % 2 === 0 ? "-16px" : "16px"})` }}
                >
                  <div className="aspect-video flex items-center justify-center bg-secondary">
                    <BookOpen className="w-7 h-7 text-violet-600/70" />
                  </div>
                  <div className="p-4">
                    <p className="text-[13px] font-medium text-foreground line-clamp-2 leading-snug">
                      {(c as Course)?.title ?? "AI for Everyone"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-violet-600 text-white py-10">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-white/20">
          {[
            { n: "12,000+", l: "Students" },
            { n: "340", l: "Courses" },
            { n: "80", l: "Instructors" },
            { n: "95%", l: "Completion" },
          ].map((s) => (
            <div key={s.l} className="py-2">
              <div className="text-3xl md:text-4xl font-bold">{s.n}</div>
              <div className="text-sm text-white/80 mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Most Popular Courses</h2>
            <p className="text-muted-foreground mt-2">Hand-picked, top-rated, and free.</p>
          </div>
          <Link
            href="/courses"
            className="text-violet-600 font-medium hover:underline inline-flex items-center gap-1"
          >
            View All Courses <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {featured.length === 0 ? (
          <p className="text-muted-foreground">No published courses yet — check back soon.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map((c) => (
              <Link
                key={c.id}
                href={`/courses/${c.slug}`}
                className="block bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="aspect-video bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-white/60" />
                </div>
                <div className="p-4">
                  <span className="text-[11px] uppercase tracking-wide text-violet-600 font-medium capitalize">
                    {c.level}
                  </span>
                  <h3 className="font-semibold text-foreground mt-1 line-clamp-2">{c.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {c.shortDescription || "Start learning today."}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="bg-gray-50 dark:bg-gray-800/50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center">
            How It Works
          </h2>
          <p className="text-muted-foreground text-center mt-2">Three simple steps to mastery.</p>
          <div className="grid md:grid-cols-3 gap-8 mt-12">
            {[
              {
                icon: Search,
                title: "Browse",
                desc: "Explore hundreds of free courses across AI, Web, Data, and Cloud.",
              },
              {
                icon: GraduationCap,
                title: "Enroll",
                desc: "Learn at your own pace with hands-on projects and quizzes.",
              },
              {
                icon: Award,
                title: "Earn Certificate",
                desc: "Get a verifiable certificate to share with employers.",
              },
            ].map((s, i) => (
              <div
                key={i}
                className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-violet-600 text-white mx-auto flex items-center justify-center font-semibold">
                  {i + 1}
                </div>
                <s.icon className="w-8 h-8 mx-auto mt-4 text-violet-600" />
                <h3 className="mt-4 font-semibold text-foreground text-lg">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center">
          What Our Learners Say
        </h2>
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          {[
            {
              i: "AR",
              n: "Ananya R.",
              r: "ML Engineer",
              text: "This platform changed my career. I went from zero to landing my dream ML role in 8 months.",
            },
            {
              i: "KB",
              n: "Karim B.",
              r: "Frontend Dev",
              text: "The React courses are incredible. I use what I learned at work every single day.",
            },
            {
              i: "TK",
              n: "Tom K.",
              r: "Data Analyst",
              text: "Practical, focused, no fluff. The instructors really care about your success.",
            },
          ].map((t) => (
            <div
              key={t.n}
              className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center font-semibold text-sm">
                  {t.i}
                </div>
                <div>
                  <div className="font-medium text-foreground">{t.n}</div>
                  <div className="text-xs text-muted-foreground">{t.r}</div>
                </div>
              </div>
              <div className="flex gap-0.5 mt-3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="mt-3 text-sm text-foreground">"{t.text}"</p>
            </div>
          ))}
        </div>
      </section>

      {/* Instructor CTA */}
      <section className="bg-violet-50 dark:bg-violet-500/10 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Share Your Knowledge</h2>
            <p className="mt-4 text-muted-foreground">
              Join a community of 80+ expert instructors. Create courses, reach thousands, earn
              recognition.
            </p>
            <Link href="/register" className="inline-block mt-6">
              <Button
                size="lg"
                className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white h-12 px-6"
              >
                Apply to Teach <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
          <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
            <div className="grid grid-cols-2 gap-6 text-center">
              {[
                { n: "$48k", l: "Avg yearly earnings" },
                { n: "1.2k", l: "Avg students per course" },
                { n: "4.8★", l: "Avg instructor rating" },
                { n: "48h", l: "Review time" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="text-2xl font-bold text-violet-600">{s.n}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 dark:border-gray-800 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </span>
              <span className="font-semibold text-foreground">AI For Everyone</span>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              World-class learning, free for everyone.
            </p>
          </div>
          {/* Only functional links */}
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/courses" className="text-muted-foreground hover:text-foreground">Courses</Link>
            <Link href="/login" className="text-muted-foreground hover:text-foreground">Login</Link>
            <Link href="/register" className="text-muted-foreground hover:text-foreground">Sign up</Link>
          </nav>
        </div>
        <div className="border-t border-gray-100 dark:border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <p className="text-xs text-muted-foreground">
              © 2026 AI For Everyone. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
