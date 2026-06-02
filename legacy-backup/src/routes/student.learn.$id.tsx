import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  X, ChevronLeft, ChevronRight, PlayCircle, FileText, HelpCircle, PanelRight,
  Download, ThumbsUp, Menu, CheckCircle2, Bell,
} from "lucide-react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { courses, qna as initialQna, announcements, type Course, type Lesson } from "@/data/mock";
import { useApp } from "@/context/AppContext";

export const Route = createFileRoute("/student/learn/$id")({
  head: () => ({ meta: [{ title: "Learn — AI For Everyone" }] }),
  loader: ({ params }) => {
    const c = courses.find((x) => x.id === params.id);
    if (!c) throw notFound();
    return c;
  },
  component: Player,
});

const lessonIcon = (t: Lesson["type"]) => t === "video" ? PlayCircle : t === "doc" ? FileText : HelpCircle;

function Player() {
  const course = Route.useLoaderData() as Course;
  const navigate = useNavigate();
  const { progress, updateProgress, completeCourse, notes, saveNote } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [tab, setTab] = useState<"Overview" | "Resources" | "Q&A" | "Notes">("Overview");
  const [noteText, setNoteText] = useState("");
  const [question, setQuestion] = useState("");
  const [qList, setQList] = useState(initialQna.filter((q) => q.courseId === course.id));
  const [completed, setCompleted] = useState(false);

  const allLessons = course.modules.flatMap((m) => m.lessons);
  const [activeIdx, setActiveIdx] = useState(0);
  const activeLesson = allLessons[activeIdx];
  const pct = progress[course.id] ?? 0;
  const lessonsDone = Math.round((pct / 100) * allLessons.length);

  const courseAnnouncements = announcements.filter((a) => a.courseId === course.id);

  const markComplete = () => {
    updateProgress(course.id, activeIdx, allLessons.length);
    toast.success("Lesson complete!");
    if (activeIdx === allLessons.length - 1) {
      completeCourse(course.id);
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      setCompleted(true);
    } else {
      setActiveIdx(activeIdx + 1);
    }
  };

  const saveCurrentNote = () => {
    saveNote(activeLesson.id, noteText);
    toast.success("Note saved!");
  };

  const submitQuestion = () => {
    if (!question.trim()) return;
    setQList((prev) => [{
      id: `q-${Date.now()}`, courseId: course.id, question,
      askedBy: "Aarav Singh", timestamp: "just now", upvotes: 0,
    }, ...prev]);
    setQuestion("");
    toast.success("Question posted!");
  };

  const upvote = (id: string) => setQList((prev) => prev.map((q) => q.id === id ? { ...q, upvotes: q.upvotes + 1 } : q));

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      <div className="px-4 h-14 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
        <Link to="/student/dashboard" className="w-8 h-8 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 flex items-center justify-center">
          <X className="w-4 h-4" />
        </Link>
        <p className="font-semibold text-sm truncate flex-1 ml-2">{course.title}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {course.modules.map((m, mi) => (
          <details key={m.id} open={mi === 0} className="mb-1">
            <summary className="px-3 py-2 text-sm font-medium cursor-pointer flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
              <span>{m.title}</span>
              <span className="text-xs text-muted-foreground">{m.lessons.length}</span>
            </summary>
            <div className="mt-1 ml-1 space-y-0.5">
              {m.lessons.map((l) => {
                const idx = allLessons.findIndex((x) => x.id === l.id);
                const Icon = lessonIcon(l.type);
                const done = idx < lessonsDone;
                const active = idx === activeIdx;
                return (
                  <button
                    key={l.id}
                    onClick={() => { setActiveIdx(idx); setMobileSidebar(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm ${
                      active ? "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300" : "hover:bg-gray-100 dark:hover:bg-gray-800 text-foreground"
                    }`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${done ? "bg-violet-600 border-violet-600 text-white" : "border-gray-300 dark:border-gray-600"}`}>
                      {done && "✓"}
                    </span>
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="flex-1 truncate text-xs">{l.title}</span>
                    <span className="text-[10px] text-muted-foreground">{l.duration}</span>
                  </button>
                );
              })}
            </div>
          </details>
        ))}
      </div>
      <div className="border-t border-gray-100 dark:border-gray-800 p-4">
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-violet-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">{lessonsDone} / {allLessons.length} lessons complete</p>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {sidebarOpen && (
        <div className="hidden md:flex w-80 shrink-0 border-r border-gray-100 dark:border-gray-800 transition-all">
          <Sidebar />
        </div>
      )}

      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="hidden md:flex absolute left-0 top-1/2 z-30 bg-card border border-gray-200 dark:border-gray-700 rounded-r-lg w-6 h-12 items-center justify-center"
        style={{ left: sidebarOpen ? "20rem" : 0 }}
      >
        {sidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      {mobileSidebar && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebar(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw]"><Sidebar /></div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="h-14 border-b border-gray-100 dark:border-gray-800 px-4 flex items-center gap-2">
          <button className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800" onClick={() => setMobileSidebar(true)}>
            <Menu className="w-4 h-4" />
          </button>
          <p className="text-sm text-muted-foreground flex-1 truncate"><Link to="/courses/$id" params={{ id: course.id }} className="hover:text-foreground">{course.title}</Link> / Lesson {activeIdx + 1}</p>
          <Button variant="outline" size="sm" disabled={activeIdx === 0} onClick={() => setActiveIdx(activeIdx - 1)} className="rounded-xl"><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" disabled={activeIdx === allLessons.length - 1} onClick={() => setActiveIdx(activeIdx + 1)} className="rounded-xl"><ChevronRight className="w-4 h-4" /></Button>
          <button className="hidden md:flex w-9 h-9 rounded-xl items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800" onClick={() => setRightOpen(!rightOpen)}>
            <PanelRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
            <div className="aspect-video bg-gray-900 rounded-2xl relative overflow-hidden flex items-center justify-center">
              <PlayCircle className="w-20 h-20 text-white/90" strokeWidth={1} />
              <div className="absolute bottom-4 left-4 text-white">
                <p className="font-semibold">{activeLesson.title}</p>
                <p className="text-xs text-white/70">{activeLesson.duration}</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-foreground">{activeLesson.title}</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={activeIdx === 0} onClick={() => setActiveIdx(activeIdx - 1)} className="rounded-xl">Prev</Button>
                <Button variant="outline" size="sm" disabled={activeIdx === allLessons.length - 1} onClick={() => setActiveIdx(activeIdx + 1)} className="rounded-xl">Next</Button>
              </div>
            </div>

            <div className="border-b border-gray-100 dark:border-gray-800 flex gap-2 overflow-x-auto">
              {(["Overview", "Resources", "Q&A", "Notes"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                    tab === t ? "border-violet-600 text-violet-600" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}>
                  {t}
                </button>
              ))}
            </div>

            <div>
              {tab === "Overview" && (
                <div className="space-y-4">
                  <p className="text-foreground">In this lesson, we explore the core concepts of {activeLesson.title.toLowerCase()}. You'll learn how to apply these ideas in real-world projects and understand the underlying principles.</p>
                  <h4 className="font-semibold text-foreground">Key Takeaways</h4>
                  <ul className="space-y-1.5 text-sm text-foreground list-disc pl-5">
                    <li>Understand the fundamental theory</li>
                    <li>Recognize common patterns in practice</li>
                    <li>Apply concepts in a hands-on project</li>
                    <li>Debug and optimize your implementation</li>
                  </ul>
                </div>
              )}

              {tab === "Resources" && (
                <div className="space-y-2">
                  {[
                    { name: "Lesson slides.pdf", size: "2.4 MB" },
                    { name: "Starter code.zip", size: "180 KB" },
                    { name: "Reference notes.md", size: "12 KB" },
                  ].map((r) => (
                    <div key={r.name} className="flex items-center justify-between p-3 bg-card border border-gray-100 dark:border-gray-700 rounded-xl">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-violet-600" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{r.name}</p>
                          <p className="text-xs text-muted-foreground">{r.size}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="rounded-xl"><Download className="w-4 h-4" /> Download</Button>
                    </div>
                  ))}
                </div>
              )}

              {tab === "Q&A" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Textarea placeholder="Ask a question..." value={question} onChange={(e) => setQuestion(e.target.value)} className="rounded-xl" />
                    <Button onClick={submitQuestion} className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white">Submit</Button>
                  </div>
                  {qList.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No questions yet — be the first!</p>
                  ) : (
                    <div className="space-y-3">
                      {qList.map((q) => (
                        <div key={q.id} className="bg-card border border-gray-100 dark:border-gray-700 rounded-xl p-4">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-semibold">{q.askedBy[0]}</div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{q.askedBy}</p>
                              <p className="text-xs text-muted-foreground">{q.timestamp}</p>
                            </div>
                          </div>
                          <p className="text-sm text-foreground">{q.question}</p>
                          {q.answer && (
                            <div className="mt-3 ml-4 pl-4 border-l-2 border-violet-200 dark:border-violet-500/30">
                              <span className="text-xs bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded inline-block mb-2">Instructor</span>
                              <p className="text-sm text-foreground">{q.answer}</p>
                            </div>
                          )}
                          <button onClick={() => upvote(q.id)} className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-violet-600">
                            <ThumbsUp className="w-3.5 h-3.5" /> {q.upvotes}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === "Notes" && (
                <div className="space-y-4">
                  <Textarea
                    placeholder="Write your notes for this lesson..."
                    value={noteText || notes[activeLesson.id] || ""}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="rounded-xl min-h-32"
                  />
                  <Button onClick={saveCurrentNote} className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white">Save Note</Button>
                  {notes[activeLesson.id] && (
                    <div className="bg-card border border-gray-100 dark:border-gray-700 rounded-xl p-4">
                      <p className="text-xs text-muted-foreground mb-2">Saved note</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{notes[activeLesson.id]}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-background pt-4 pb-4 border-t border-gray-100 dark:border-gray-800">
              <Button onClick={markComplete} variant="outline" className="w-full rounded-xl border-violet-600 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10">
                Mark Lesson Complete
              </Button>
            </div>
          </div>
        </div>
      </div>

      {rightOpen && (
        <aside className="hidden md:flex w-72 shrink-0 border-l border-gray-100 dark:border-gray-800 flex-col bg-card">
          <div className="px-4 h-14 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800">
            <Bell className="w-4 h-4 text-violet-600" />
            <p className="font-semibold text-sm">Announcements</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {courseAnnouncements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No announcements.</p>
            ) : courseAnnouncements.map((a) => (
              <div key={a.id} className="border border-gray-100 dark:border-gray-700 rounded-xl p-3">
                <p className="font-medium text-sm text-foreground">{a.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.date}</p>
                <p className="text-sm text-foreground mt-2">{a.body}</p>
              </div>
            ))}
          </div>
        </aside>
      )}

      <Dialog open={completed} onOpenChange={setCompleted}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 mx-auto flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <DialogTitle className="text-center text-2xl">Course Complete! 🎉</DialogTitle>
          </DialogHeader>
          <p className="text-center text-muted-foreground">Congratulations on finishing {course.title}.</p>
          <Button onClick={() => { setCompleted(false); navigate({ to: "/student/certificates" }); }} className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
            Download Certificate
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
