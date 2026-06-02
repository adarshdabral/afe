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
import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { CourseCard } from "@/components/CourseCard";
import { Button } from "@/components/ui/button";
import { courses, type Category } from "@/data/mock";

const categories: ("All" | Category)[] = ["All", "AI & ML", "Web Dev", "Data Science", "Cloud"];

export default function Landing() {
  const [active, setActive] = useState<"All" | Category>("All");
  const filtered =
    active === "All"
      ? courses.slice(0, 6)
      : courses.filter((c) => c.category === active).slice(0, 6);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-background to-background dark:from-violet-500/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-32 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" /> AI-powered learning platform
            </span>
            <h1 className="mt-6 text-5xl md:text-6xl font-bold leading-tight text-foreground">
              Learn{" "}
              <span className="bg-gradient-to-r from-violet-600 to-violet-400 bg-clip-text text-transparent">
                AI
              </span>
              .
              <br />
              Build the Future.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              World-class courses in AI, Web Development, Data Science, and Cloud — taught by leading
              industry experts. Free for everyone.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/courses">
                <Button
                  size="lg"
                  className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white h-12 px-6"
                >
                  Browse Courses <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/register">
                <Button size="lg" variant="outline" className="rounded-xl h-12 px-6">
                  Become an Instructor
                </Button>
              </Link>
            </div>
            <div className="mt-10 flex items-center gap-3">
              <div className="flex -space-x-2">
                {["AS", "RM", "KV", "SP"].map((i, n) => (
                  <div
                    key={i}
                    className="w-9 h-9 rounded-full ring-2 ring-background flex items-center justify-center text-xs font-semibold text-white"
                    style={{ background: ["#6C63FF", "#3B82F6", "#10B981", "#F59E0B"][n] }}
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

          {/* Decorative grid */}
          <div className="relative hidden lg:block">
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              {courses.slice(0, 4).map((c, i) => (
                <div
                  key={c.id}
                  className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
                  style={{ transform: `translateY(${i % 2 === 0 ? "-12px" : "12px"})` }}
                >
                  <div
                    className="aspect-video flex items-center justify-center"
                    style={{ background: c.thumbnailColor }}
                  >
                    <BookOpen className="w-8 h-8 text-white/50" />
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-medium text-foreground line-clamp-2">{c.title}</p>
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

        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                active === c
                  ? "bg-violet-600 text-white"
                  : "bg-secondary text-foreground hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((c) => (
            <CourseCard key={c.id} course={c} variant="catalog" />
          ))}
        </div>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
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
          {[
            { title: "Platform", links: ["Courses", "Instructors", "Certificates", "Pricing"] },
            { title: "Company", links: ["About", "Careers", "Press", "Blog"] },
            { title: "Support", links: ["Help Center", "Contact", "Privacy", "Terms"] },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="font-semibold text-foreground text-sm">{col.title}</h4>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 dark:border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <p className="text-xs text-muted-foreground">
              © 2026 AI For Everyone. All rights reserved.
            </p>
            <div className="flex items-center gap-3">
              {[Github, Twitter, Linkedin].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-9 h-9 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center text-muted-foreground"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
