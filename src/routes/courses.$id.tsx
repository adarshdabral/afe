import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CheckCircle2, Lock, PlayCircle, FileText, HelpCircle, Star, Users, BookOpen,
  Clock, Calendar, Award, Download, Share2, Heart, Play, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { courses, reviews, type Lesson, type Course } from "@/data/mock";
import { categoryBadgeClass } from "@/lib/categoryColor";
import { useApp } from "@/context/AppContext";

export const Route = createFileRoute("/courses/$id")({
  head: ({ params }) => {
    const c = courses.find((x) => x.id === params.id);
    return { meta: [
      { title: c ? `${c.title} — AI For Everyone` : "Course" },
      { name: "description", content: c?.description ?? "Course details" },
    ]};
  },
  loader: ({ params }) => {
    const course = courses.find((c) => c.id === params.id);
    if (!course) throw notFound();
    return course;
  },
  component: CourseDetail,
});

const lessonIcon = (t: Lesson["type"]) => t === "video" ? PlayCircle : t === "doc" ? FileText : HelpCircle;

function CourseDetail() {
  const course = Route.useLoaderData() as Course;
  const navigate = useNavigate();
  const { enroll, enrolledCourseIds } = useApp();
  const isEnrolled = enrolledCourseIds.includes(course.id);
  const [scrolled, setScrolled] = useState(false);
  const [loading, setLoading] = useState(false);
  const courseReviews = reviews.filter((r) => r.courseId === course.id);
  const totalHours = Math.round(course.modules.reduce((sum, m) => sum + m.lessons.length, 0) * 0.25);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 300);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onEnroll = () => {
    setLoading(true);
    setTimeout(() => {
      enroll(course.id);
      toast.success("Enrolled successfully!");
      navigate({ to: "/student/dashboard" });
    }, 800);
  };

  const ratingDist = [60, 25, 10, 3, 2];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {scrolled && (
        <div className="sticky top-16 z-30 bg-card border-b border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            <p className="font-semibold text-foreground truncate">{course.title}</p>
            <Button disabled={loading || isEnrolled} onClick={onEnroll} className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white shrink-0">
              {isEnrolled ? "Enrolled" : "Enroll Now"}
            </Button>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="bg-gray-900 text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <nav className="text-sm text-white/60 flex items-center gap-2">
            <Link to="/" className="hover:text-white">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link to="/courses" className="hover:text-white">Courses</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white">{course.category}</span>
          </nav>
          <div className="mt-4 flex gap-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${categoryBadgeClass(course.category)}`}>{course.category}</span>
            <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-white/10">{course.level}</span>
          </div>
          <h1 className="mt-4 text-3xl md:text-5xl font-bold">{course.title}</h1>
          <p className="mt-4 text-lg text-white/80 max-w-3xl">{course.description}</p>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="font-semibold">{course.rating}</span>
              <span className="text-white/60">({course.reviewCount} reviews)</span>
            </span>
            <span className="text-white/60">{course.enrolledCount.toLocaleString()} enrolled</span>
            <span className="flex items-center gap-1 text-white/60"><Clock className="w-4 h-4" /> {course.duration}</span>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-sm font-semibold">{course.instructor.avatarInitials}</div>
            <div>
              <p className="text-sm">Created by <span className="font-medium">{course.instructor.name}</span></p>
              <p className="text-xs text-white/60">Last updated May 2026</p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid lg:grid-cols-3 gap-8">
        {/* Left */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-foreground">What you'll learn</h2>
            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              {course.whatYouLearn.map((w, i) => (
                <div key={i} className="flex gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                  <span className="text-foreground">{w}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-foreground">Curriculum</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {course.modules.length} modules • {course.totalLessons} lessons • {totalHours}h total
            </p>
            <Accordion type="multiple" defaultValue={[course.modules[0].id]} className="mt-4">
              {course.modules.map((m) => (
                <AccordionItem key={m.id} value={m.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex-1 flex items-center justify-between pr-4">
                      <span className="font-medium text-foreground">{m.title}</span>
                      <span className="text-xs text-muted-foreground">{m.lessons.length} lessons</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-1">
                      {m.lessons.map((l) => {
                        const Icon = lessonIcon(l.type);
                        return (
                          <div key={l.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                            <div className="flex items-center gap-3 min-w-0">
                              <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span className="text-sm text-foreground truncate">{l.title}</span>
                              {l.isPreview && <span className="text-xs bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded">Preview</span>}
                              {!l.isPreview && !isEnrolled && <Lock className="w-3 h-3 text-muted-foreground" />}
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0 ml-2">{l.duration}</span>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-foreground">About the instructor</h2>
            <div className="mt-4 flex flex-col sm:flex-row gap-4 items-start">
              <div className="w-20 h-20 rounded-full bg-violet-600 text-white flex items-center justify-center text-xl font-semibold shrink-0">
                {course.instructor.avatarInitials}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{course.instructor.name}</h3>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Star className="w-4 h-4 text-amber-400 fill-amber-400" /> {course.instructor.rating} rating</span>
                  <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {course.instructor.totalStudents.toLocaleString()} students</span>
                  <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" /> {course.instructor.totalCourses} courses</span>
                </div>
                <p className="mt-3 text-sm text-foreground">{course.instructor.bio}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-foreground">Student Reviews</h2>
            <div className="mt-4 grid sm:grid-cols-[200px_1fr] gap-6">
              <div className="text-center">
                <div className="text-5xl font-bold text-foreground">{course.rating}</div>
                <div className="flex justify-center gap-0.5 mt-2">
                  {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`w-4 h-4 ${n <= Math.round(course.rating) ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{course.reviewCount.toLocaleString()} reviews</p>
              </div>
              <div className="space-y-1.5">
                {ratingDist.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-8">{5 - i}★</span>
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400" style={{ width: `${p}%` }} />
                    </div>
                    <span className="w-10 text-muted-foreground">{p}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 space-y-4">
              {(courseReviews.length ? courseReviews : reviews).slice(0, 3).map((r) => (
                <div key={r.id} className="border-t border-gray-100 dark:border-gray-700 pt-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-semibold">{r.avatarInitials}</div>
                    <div>
                      <p className="font-medium text-sm text-foreground">{r.studentName}</p>
                      <p className="text-xs text-muted-foreground">{r.date}</p>
                    </div>
                  </div>
                  <div className="flex gap-0.5 mt-2">
                    {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`w-3.5 h-3.5 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />)}
                  </div>
                  <p className="mt-2 text-sm text-foreground">{r.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right sticky */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="aspect-video relative flex items-center justify-center" style={{ background: course.thumbnailColor }}>
              <Play className="w-16 h-16 text-white/80" />
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-3xl font-bold text-foreground">Free</p>
              </div>
              <Button onClick={onEnroll} disabled={loading || isEnrolled} className="w-full rounded-xl h-11 bg-violet-600 hover:bg-violet-700 text-white">
                {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : isEnrolled ? "Already Enrolled" : "Enroll Now"}
              </Button>
              <div className="space-y-2 pt-2 text-sm text-foreground border-t border-gray-100 dark:border-gray-700">
                <p className="font-medium pt-3">This course includes:</p>
                <p className="flex items-center gap-2 text-muted-foreground"><PlayCircle className="w-4 h-4" /> {totalHours} hours of video</p>
                <p className="flex items-center gap-2 text-muted-foreground"><FileText className="w-4 h-4" /> 6 articles</p>
                <p className="flex items-center gap-2 text-muted-foreground"><Download className="w-4 h-4" /> 12 downloadable resources</p>
                <p className="flex items-center gap-2 text-muted-foreground"><Award className="w-4 h-4" /> Certificate of completion</p>
                <p className="flex items-center gap-2 text-muted-foreground"><Calendar className="w-4 h-4" /> Lifetime access</p>
              </div>
              <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <Button variant="outline" size="sm" className="flex-1 rounded-xl"><Share2 className="w-4 h-4" /> Share</Button>
                <Button variant="outline" size="sm" className="flex-1 rounded-xl"><Heart className="w-4 h-4" /> Wishlist</Button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile fixed bottom bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-card border-t border-gray-100 dark:border-gray-700 p-4 z-40">
        <Button onClick={onEnroll} disabled={loading || isEnrolled} className="w-full rounded-xl h-11 bg-violet-600 hover:bg-violet-700 text-white">
          {isEnrolled ? "Already Enrolled" : "Enroll Now — Free"}
        </Button>
      </div>
    </div>
  );
}
