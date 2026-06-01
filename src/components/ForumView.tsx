import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Send,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/context/AppContext";
import { roleLabel } from "@/lib/auth/access";
import { AI_COURSE } from "@/data/curriculum";
import {
  createThreadFn,
  getThreadFn,
  listThreadsFn,
  moderatePostFn,
  moderateThreadFn,
  replyFn,
  type ThreadListItem,
} from "@/lib/forum/forum.functions";

function moduleTag(moduleId: string | null): string {
  if (!moduleId) return "General";
  const m = AI_COURSE.modules.find((x) => x.id === moduleId);
  return m ? `Module ${m.order}` : "General";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ForumView() {
  const { role } = useApp();
  const isStaff = role === "teacher" || role === "school_admin" || role === "platform_admin";
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [asking, setAsking] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["forumThreads", search, page],
    queryFn: () => listThreadsFn({ data: { search: search || undefined, page } }),
  });

  const threads = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 5;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const refreshList = () => queryClient.invalidateQueries({ queryKey: ["forumThreads"] });

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Discussion Forum</h1>
        <p className="text-muted-foreground mt-1">
          {isStaff
            ? "Answer questions and moderate the course discussion."
            : "Ask questions and learn from your classmates and teachers."}
        </p>
      </header>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form onSubmit={applySearch} className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search questions…"
            className="pl-9 rounded-xl h-10"
          />
        </form>
        <Button
          onClick={() => setAsking((a) => !a)}
          className="rounded-xl h-10 bg-violet-600 hover:bg-violet-700 text-white gap-1"
        >
          <Plus className="w-4 h-4" /> Ask
        </Button>
      </div>

      {asking && (
        <AskForm
          onCancel={() => setAsking(false)}
          onPosted={() => {
            setAsking(false);
            setSearch("");
            setSearchInput("");
            setPage(1);
            refreshList();
          }}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : threads.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
          <MessageSquare className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600" />
          <h3 className="mt-4 font-semibold text-foreground">No discussions found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {search ? "Try a different search." : "Be the first to ask a question."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map((t) => (
            <ThreadCard
              key={t.id}
              thread={t}
              isStaff={isStaff}
              expanded={expandedId === t.id}
              onToggle={() => setExpandedId((id) => (id === t.id ? null : t.id))}
              onModerated={refreshList}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-xl"
          >
            Prev
          </Button>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`w-9 h-9 rounded-xl text-sm ${
                page === i + 1
                  ? "bg-violet-600 text-white"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {i + 1}
            </button>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-xl"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function AskForm({ onCancel, onPosted }: { onCancel: () => void; onPosted: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (title.trim().length < 4 || !body.trim()) {
      toast.error("Add a short title and a question.");
      return;
    }
    setBusy(true);
    try {
      await createThreadFn({ data: { title, body, moduleId: moduleId || undefined } });
      toast.success("Question posted.");
      onPosted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not post");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 mb-6 space-y-3">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Question title"
        className="rounded-xl h-11"
      />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Describe your question…"
        className="rounded-xl min-h-28"
      />
      <select
        value={moduleId}
        onChange={(e) => setModuleId(e.target.value)}
        className="w-full h-11 px-3 rounded-xl border border-input bg-card text-sm text-foreground"
      >
        <option value="">General</option>
        {AI_COURSE.modules.map((m) => (
          <option key={m.id} value={m.id}>
            Module {m.order}: {m.title}
          </option>
        ))}
      </select>
      <div className="flex justify-end gap-2">
        <Button variant="outline" className="rounded-xl" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white"
          onClick={submit}
          disabled={busy}
        >
          Post question
        </Button>
      </div>
    </div>
  );
}

function ThreadCard({
  thread,
  isStaff,
  expanded,
  onToggle,
  onModerated,
}: {
  thread: ThreadListItem;
  isStaff: boolean;
  expanded: boolean;
  onToggle: () => void;
  onModerated: () => void;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const toggleHidden = async () => {
    setBusy(true);
    try {
      await moderateThreadFn({ data: { threadId: thread.id, hidden: !thread.hidden } });
      toast.success(thread.hidden ? "Thread restored." : "Thread hidden.");
      onModerated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`bg-card rounded-2xl shadow-sm border p-5 ${
        thread.hidden
          ? "border-red-200 dark:border-red-500/30"
          : "border-gray-100 dark:border-gray-700"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <button onClick={onToggle} className="text-left">
            <h3 className="font-semibold text-foreground hover:text-violet-600">{thread.title}</h3>
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{thread.authorName}</span>
            <RoleBadge role={thread.authorRole} />
            <span>· {fmtDate(thread.createdAt)}</span>
            <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-foreground">
              {moduleTag(thread.moduleId)}
            </span>
            {thread.hasTeacherAnswer && (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Answered
              </span>
            )}
            {thread.hidden && (
              <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">
                Hidden
              </span>
            )}
          </div>
        </div>
        {isStaff && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1 shrink-0"
            disabled={busy}
            onClick={toggleHidden}
          >
            {thread.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {thread.hidden ? "Unhide" : "Hide"}
          </Button>
        )}
        <button
          onClick={onToggle}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <ThreadPanel
          threadId={thread.id}
          isStaff={isStaff}
          onReplied={() => {
            queryClient.invalidateQueries({ queryKey: ["forumThread", thread.id] });
            onModerated(); // refresh list counts/answered badge
          }}
        />
      )}
    </div>
  );
}

function ThreadPanel({
  threadId,
  isStaff,
  onReplied,
}: {
  threadId: string;
  isStaff: boolean;
  onReplied: () => void;
}) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["forumThread", threadId],
    queryFn: () => getThreadFn({ data: { threadId } }),
  });

  const [body, setBody] = useState("");
  const [asAnswer, setAsAnswer] = useState(false);
  const [busy, setBusy] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["forumThread", threadId] });

  const reply = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await replyFn({ data: { threadId, body, asAnswer: isStaff ? asAnswer : undefined } });
      setBody("");
      setAsAnswer(false);
      onReplied();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reply");
    } finally {
      setBusy(false);
    }
  };

  const togglePostHidden = async (postId: string, hidden: boolean) => {
    try {
      await moderatePostFn({ data: { postId, hidden } });
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  };

  const posts = data?.posts ?? [];

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
      {data?.thread.body && (
        <p className="text-sm text-foreground whitespace-pre-wrap">{data.thread.body}</p>
      )}

      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No replies yet.</p>
      ) : (
        posts.map((p) => (
          <div
            key={p.id}
            className={`rounded-xl p-3 ${
              p.isAnswer
                ? "bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30"
                : "bg-gray-50 dark:bg-gray-800/60"
            } ${p.hidden ? "opacity-60" : ""}`}
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <span className="font-medium text-foreground">{p.authorName}</span>
              <RoleBadge role={p.authorRole} />
              {p.isAnswer && (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" /> Answer
                </span>
              )}
              {p.hidden && <span className="text-red-600">Hidden</span>}
              <span>· {fmtDate(p.createdAt)}</span>
              {isStaff && (
                <button
                  onClick={() => togglePostHidden(p.id, !p.hidden)}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                >
                  {p.hidden ? "Unhide" : "Hide"}
                </button>
              )}
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{p.body}</p>
          </div>
        ))
      )}

      <div className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={isStaff ? "Write a response…" : "Add a reply…"}
          className="rounded-xl"
        />
        <div className="flex items-center justify-between">
          {isStaff ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={asAnswer}
                onChange={(e) => setAsAnswer(e.target.checked)}
                className="accent-violet-600"
              />
              Post as official answer
            </label>
          ) : (
            <span />
          )}
          <Button
            onClick={reply}
            disabled={busy || !body.trim()}
            className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white gap-1"
          >
            <Send className="w-4 h-4" /> Reply
          </Button>
        </div>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: "student" | "teacher" | "school_admin" | "platform_admin" }) {
  const staff = role !== "student";
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
        staff
          ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
          : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
      }`}
    >
      {roleLabel(role)}
    </span>
  );
}
