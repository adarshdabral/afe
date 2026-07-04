"use client";

import { useCallback, useEffect, useState } from "react";
import { Star, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/context/AppContext";
import {
  addReview,
  deleteReview,
  listReviews,
  updateReview,
  type CourseReviews as ReviewsData,
  type Review,
} from "@/lib/api/reviews";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          aria-checked={value === n}
          role="radio"
          className="p-0.5"
        >
          <Star
            className={`w-6 h-6 transition-colors ${
              n <= value ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function StarRow({ rating, size = "w-4 h-4" }: { rating: number; size?: string }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${size} ${n <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600"}`}
        />
      ))}
    </div>
  );
}

function ReviewForm({
  initialRating,
  initialComment,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  initialRating: number;
  initialComment: string;
  submitLabel: string;
  busy: boolean;
  onSubmit: (rating: number, comment: string) => void;
  onCancel?: () => void;
}) {
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);

  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground mb-1.5">Your rating</p>
        <StarInput value={rating} onChange={setRating} />
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Share what you thought about this course…"
        className="rounded-xl min-h-24"
      />
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button variant="outline" className="rounded-xl" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
        <Button
          className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white"
          disabled={busy || rating < 1}
          onClick={() => onSubmit(rating, comment)}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

export function CourseReviews({
  courseId,
  fallbackRating,
  fallbackCount,
}: {
  courseId: string;
  fallbackRating: number;
  fallbackCount: number;
}) {
  const { isAuthenticated } = useApp();
  const [data, setData] = useState<ReviewsData | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    listReviews(courseId)
      .then(setData)
      .catch(() => setData(null));
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const total = data?.aggregate.totalReviews ?? 0;
  // Show the live aggregate once real reviews exist; until then, the seeded
  // catalog rating so the page isn't empty.
  const avg = total > 0 ? data!.aggregate.averageRating : fallbackRating;
  const shownTotal = total > 0 ? total : fallbackCount;
  const mine = data?.mine ?? null;
  const others = (data?.reviews ?? []).filter((r) => r.id !== mine?.id);

  const handleAdd = async (rating: number, comment: string) => {
    setBusy(true);
    try {
      await addReview(courseId, { rating, comment });
      toast.success("Review posted.");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not post review");
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = async (rating: number, comment: string) => {
    if (!mine) return;
    setBusy(true);
    try {
      await updateReview(mine.id, { rating, comment });
      toast.success("Review updated.");
      setEditing(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update review");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!mine) return;
    if (!confirm("Delete your review?")) return;
    setBusy(true);
    try {
      await deleteReview(mine.id);
      toast.success("Review deleted.");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete review");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold text-foreground">Student Reviews</h2>

      <div className="mt-4 flex items-center gap-6">
        <div className="text-center">
          <div className="text-5xl font-bold text-foreground">{avg.toFixed(1)}</div>
          <div className="flex justify-center mt-2">
            <StarRow rating={avg} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {shownTotal.toLocaleString()} {shownTotal === 1 ? "review" : "reviews"}
          </p>
        </div>
      </div>

      {/* Your review — add / edit / delete */}
      <div className="mt-6">
        {!isAuthenticated ? (
          <p className="text-sm text-muted-foreground">Sign in to leave a review.</p>
        ) : mine && !editing ? (
          <div className="rounded-xl border border-violet-200 dark:border-violet-500/30 bg-violet-50/50 dark:bg-violet-500/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Your review</p>
                <div className="mt-1">
                  <StarRow rating={mine.rating} size="w-3.5 h-3.5" />
                </div>
                {mine.comment && <p className="mt-2 text-sm text-foreground">{mine.comment}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{fmtDate(mine.createdAt)}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="outline" size="icon" className="rounded-xl" onClick={() => setEditing(true)} aria-label="Edit review">
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" className="rounded-xl text-red-600" onClick={handleDelete} disabled={busy} aria-label="Delete review">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : mine && editing ? (
          <ReviewForm
            initialRating={mine.rating}
            initialComment={mine.comment}
            submitLabel="Save changes"
            busy={busy}
            onSubmit={handleEdit}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <ReviewForm
            initialRating={5}
            initialComment=""
            submitLabel="Post review"
            busy={busy}
            onSubmit={handleAdd}
          />
        )}
      </div>

      {/* Recent reviews */}
      <div className="mt-6 space-y-4">
        {others.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {mine ? "No other reviews yet." : "No reviews yet — be the first."}
          </p>
        ) : (
          others.map((r: Review) => (
            <div key={r.id} className="border-t border-gray-100 dark:border-gray-700 pt-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-semibold">
                  {r.userName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">{r.userName}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</p>
                </div>
              </div>
              <div className="mt-2">
                <StarRow rating={r.rating} size="w-3.5 h-3.5" />
              </div>
              {r.comment && <p className="mt-2 text-sm text-foreground">{r.comment}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
