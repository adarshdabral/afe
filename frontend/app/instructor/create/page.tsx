"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, GripVertical, PlusCircle, Trash2, Upload, CheckCircle2, X } from "lucide-react";
import { InstructorSidebar } from "@/components/InstructorSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const steps = ["Basic Info", "Curriculum", "Content", "Settings", "Review"];

interface LessonDraft { id: string; title: string; type: "video" | "doc" | "quiz"; duration: string; progress: number; uploaded: boolean }
interface ModuleDraft { id: string; title: string; lessons: LessonDraft[] }

export default function Create() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("AI & ML");
  const [level, setLevel] = useState("Beginner");
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [modules, setModules] = useState<ModuleDraft[]>([{ id: "m1", title: "Module 1", lessons: [{ id: "l1", title: "Lesson 1", type: "video", duration: "5:00", progress: 0, uploaded: false }] }]);
  const [certEnabled, setCertEnabled] = useState(true);
  const [visibility, setVisibility] = useState("Public");
  const [prereqs, setPrereqs] = useState<string[]>([]);
  const [prereqInput, setPrereqInput] = useState("");
  const [welcome, setWelcome] = useState("");
  const [completion, setCompletion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!title) e.title = "Required";
    if (!desc) e.desc = "Required";
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (step === 0 && !validateStep1()) return;
    if (step === 1 && (modules.length === 0 || !modules.some((m) => m.lessons.length > 0))) {
      toast.error("Add at least one module with one lesson");
      return;
    }
    setStep(step + 1);
  };

  const onThumb = (f: File | null) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = (e) => setThumbPreview(e.target?.result as string);
    r.readAsDataURL(f);
  };

  const addModule = () => setModules([...modules, { id: `m${Date.now()}`, title: `Module ${modules.length + 1}`, lessons: [] }]);
  const addLesson = (mi: number) => {
    const m = [...modules];
    m[mi].lessons.push({ id: `l${Date.now()}`, title: "New Lesson", type: "video", duration: "5:00", progress: 0, uploaded: false });
    setModules(m);
  };

  const uploadAll = () => {
    const updated = modules.map((m) => ({ ...m, lessons: m.lessons.map((l) => ({ ...l, progress: 0, uploaded: false })) }));
    setModules(updated);
    const total = 30;
    let count = 0;
    const interval = setInterval(() => {
      count++;
      setModules((cur) => cur.map((m) => ({ ...m, lessons: m.lessons.map((l) => ({ ...l, progress: Math.min(100, (count / total) * 100), uploaded: count >= total })) })));
      if (count >= total) clearInterval(interval);
    }, 50);
  };

  const submit = () => {
    setSubmitting(true);
    setTimeout(() => { setSubmitting(false); setSuccess(true); }, 1500);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-500/20 mx-auto flex items-center justify-center animate-in zoom-in duration-500">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mt-6">Submitted for Review!</h2>
          <p className="text-muted-foreground mt-2 max-w-md">Our team will review your course within 48 hours.</p>
          <Button onClick={() => router.push("/instructor/dashboard")} className="mt-6 rounded-xl bg-violet-600 hover:bg-violet-700 text-white">Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      <InstructorSidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <h1 className="text-3xl font-bold text-foreground mb-8">Create New Course</h1>

          <div className="flex items-center mb-8">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center flex-1 last:flex-initial">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium ${
                    i < step ? "bg-violet-600 text-white" : i === step ? "bg-violet-600 text-white ring-4 ring-violet-100 dark:ring-violet-500/20" : "border-2 border-gray-200 dark:border-gray-700 text-muted-foreground"
                  }`}>
                    {i < step ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className="text-xs text-foreground hidden sm:block">{s}</span>
                </div>
                {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${i < step ? "bg-violet-600" : "bg-gray-200 dark:bg-gray-700"} transition-colors`} />}
              </div>
            ))}
          </div>

          <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            {step === 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">Basic Info</h2>
                <div>
                  <Label>Course Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} className={`mt-1.5 rounded-xl ${errs.title ? "ring-2 ring-red-500" : ""}`} />
                  {errs.title && <p className="text-xs text-red-500 mt-1">{errs.title}</p>}
                </div>
                <div>
                  <Label>Short Description</Label>
                  <Textarea value={desc} onChange={(e) => setDesc(e.target.value.slice(0, 160))} className={`mt-1.5 rounded-xl ${errs.desc ? "ring-2 ring-red-500" : ""}`} />
                  <p className="text-xs text-muted-foreground mt-1 text-right">{desc.length}/160</p>
                </div>
                <div>
                  <Label>Category</Label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1.5 w-full h-10 px-3 rounded-xl border border-input bg-background">
                    {["AI & ML", "Web Dev", "Data Science", "Cloud"].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Level</Label>
                  <div className="mt-1.5 flex gap-2">
                    {["Beginner", "Intermediate", "Advanced"].map((l) => (
                      <button key={l} onClick={() => setLevel(l)} className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium ${level === l ? "bg-violet-600 text-white" : "border border-input"}`}>{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Thumbnail</Label>
                  {thumbPreview ? (
                    <div className="mt-1.5 relative">
                      <img src={thumbPreview} alt="thumb" className="w-full aspect-video object-cover rounded-xl" />
                      <Button variant="outline" size="sm" onClick={() => setThumbPreview(null)} className="absolute top-2 right-2 rounded-xl">Change</Button>
                    </div>
                  ) : (
                    <div onClick={() => fileRef.current?.click()} className="mt-1.5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-violet-400">
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                      <p className="text-sm mt-2 text-foreground">Click to upload</p>
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onThumb(e.target.files?.[0] ?? null)} />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-foreground">Curriculum</h2>
                  <Button variant="outline" onClick={addModule} className="rounded-xl"><PlusCircle className="w-4 h-4" /> Add Module</Button>
                </div>
                {modules.map((m, mi) => (
                  <div key={m.id} className="border border-gray-100 dark:border-gray-700 rounded-xl p-4">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <Input value={m.title} onChange={(e) => { const arr = [...modules]; arr[mi].title = e.target.value; setModules(arr); }} className="rounded-xl flex-1" />
                      <Button variant="outline" size="sm" onClick={() => addLesson(mi)} className="rounded-xl">+ Lesson</Button>
                      <Button variant="ghost" size="icon" onClick={() => setModules(modules.filter((_, i) => i !== mi))} className="rounded-xl text-red-600"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                    <div className="mt-3 ml-6 space-y-2">
                      {m.lessons.map((l, li) => (
                        <div key={l.id} className="flex items-center gap-2">
                          <GripVertical className="w-3 h-3 text-muted-foreground" />
                          <select value={l.type} onChange={(e) => { const arr = [...modules]; arr[mi].lessons[li].type = e.target.value as LessonDraft["type"]; setModules(arr); }} className="h-9 px-2 rounded-lg border border-input bg-background text-sm">
                            <option value="video">Video</option><option value="doc">Doc</option><option value="quiz">Quiz</option>
                          </select>
                          <Input value={l.title} onChange={(e) => { const arr = [...modules]; arr[mi].lessons[li].title = e.target.value; setModules(arr); }} className="rounded-lg h-9 flex-1" />
                          <Input value={l.duration} onChange={(e) => { const arr = [...modules]; arr[mi].lessons[li].duration = e.target.value; setModules(arr); }} className="rounded-lg h-9 w-20" />
                          <Button variant="ghost" size="icon" onClick={() => { const arr = [...modules]; arr[mi].lessons = arr[mi].lessons.filter((_, i) => i !== li); setModules(arr); }} className="text-red-600"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-foreground">Upload Content</h2>
                  <Button onClick={uploadAll} className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white">Upload All</Button>
                </div>
                {modules.flatMap((m) => m.lessons).map((l) => (
                  <div key={l.id} className="border border-gray-100 dark:border-gray-700 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm text-foreground">{l.title}</p>
                        <span className="text-xs text-muted-foreground capitalize">{l.type}</span>
                      </div>
                      {l.uploaded && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                    </div>
                    <Progress value={l.progress} className="h-2" />
                  </div>
                ))}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <h2 className="text-xl font-semibold text-foreground">Settings</h2>
                <div>
                  <Label>Price</Label>
                  <div className="mt-1.5 flex gap-2">
                    <button className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm">Free</button>
                    <button disabled className="px-4 py-2 rounded-xl border border-input text-sm opacity-50 cursor-not-allowed" title="Coming soon">Paid</button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Certificate</Label>
                  <Switch checked={certEnabled} onCheckedChange={setCertEnabled} />
                </div>
                <div>
                  <Label>Visibility</Label>
                  <div className="mt-1.5 flex gap-2">
                    {["Public", "Unlisted"].map((v) => (
                      <button key={v} onClick={() => setVisibility(v)} className={`px-4 py-2 rounded-xl text-sm ${visibility === v ? "bg-violet-600 text-white" : "border border-input"}`}>{v}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Prerequisites</Label>
                  <div className="mt-1.5 flex flex-wrap gap-2 mb-2">
                    {prereqs.map((p) => (
                      <span key={p} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 text-xs">
                        {p} <button onClick={() => setPrereqs(prereqs.filter((x) => x !== p))}><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                  <Input value={prereqInput} onChange={(e) => setPrereqInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && prereqInput.trim()) { setPrereqs([...prereqs, prereqInput.trim()]); setPrereqInput(""); e.preventDefault(); } }}
                    placeholder="Type and press Enter" className="rounded-xl" />
                </div>
                <div>
                  <Label>Welcome Message</Label>
                  <Textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} className="mt-1.5 rounded-xl" />
                </div>
                <div>
                  <Label>Completion Message</Label>
                  <Textarea value={completion} onChange={(e) => setCompletion(e.target.value)} className="mt-1.5 rounded-xl" />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">Review</h2>
                {[
                  { title: "Basic Info", body: <><p className="text-sm"><strong>{title}</strong></p><p className="text-sm text-muted-foreground">{desc}</p><p className="text-xs mt-1">{category} • {level}</p></> },
                  { title: "Curriculum", body: <p className="text-sm">{modules.length} modules • {modules.reduce((s, m) => s + m.lessons.length, 0)} lessons</p> },
                  { title: "Content", body: <p className="text-sm text-muted-foreground">Uploaded files configured</p> },
                  { title: "Settings", body: <p className="text-sm">Free • {visibility} • Certificate {certEnabled ? "on" : "off"}</p> },
                ].map((c) => (
                  <div key={c.title} className="border border-gray-100 dark:border-gray-700 rounded-xl p-4">
                    <h3 className="font-semibold text-foreground mb-2">{c.title}</h3>
                    {c.body}
                  </div>
                ))}
                <div className="flex gap-3">
                  <Button variant="outline" className="rounded-xl flex-1" onClick={() => { toast.success("Saved as draft"); router.push("/instructor/dashboard"); }}>Save as Draft</Button>
                  <Button onClick={submit} disabled={submitting} className="rounded-xl flex-1 bg-violet-600 hover:bg-violet-700 text-white">
                    {submitting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Submit for Review"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {step < 4 && (
            <div className="flex justify-between mt-6">
              <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)} className="rounded-xl">Back</Button>
              <Button onClick={next} className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white">Next</Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
