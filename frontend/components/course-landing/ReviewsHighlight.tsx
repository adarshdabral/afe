"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Quote } from "lucide-react";
import { StarRow } from "@/components/CourseReviews";
import { listReviews, type CourseReviews } from "@/lib/api/reviews";
import { SectionHeading } from "./sections";

/** Home-page reviews: the live aggregate and a few real reviews with comments.
 *  Writing/editing reviews stays on the course page (CourseReviews). */
export function ReviewsHighlight({ courseId, slug }: { courseId: string; slug: string }) {
  const [data, setData] = useState<CourseReviews | null>(null);

  useEffect(() => {
    listReviews(courseId)
      .then(setData)
      .catch(() => setData(null));
  }, [courseId]);

  if (!data) return null;
  const { averageRating, totalReviews } = data.aggregate;
  const featured = data.reviews.filter((r) => r.comment.trim()).slice(0, 3);

  return (
    <section aria-labelledby="reviews-heading" className="py-20 md:py-24 border-t border-border">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <SectionHeading id="reviews-heading" eyebrow="Learner reviews" title="What learners say" />
        {totalReviews > 0 ? (
          <div className="flex items-center gap-4">
            <span className="text-5xl font-semibold tracking-tight text-foreground tabular-nums">
              {averageRating.toFixed(1)}
            </span>
            <div>
              <StarRow rating={averageRating} />
              <p className="text-[13px] text-muted-foreground mt-1">
                {totalReviews.toLocaleString()} {totalReviews === 1 ? "review" : "reviews"}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {featured.length > 0 ? (
        <ul className="mt-10 grid md:grid-cols-3 gap-5">
          {featured.map((r) => (
            <li key={r.id} className="rounded-3xl border border-border bg-card shadow-soft p-6 flex flex-col">
              <Quote className="w-5 h-5 text-violet-600/60" aria-hidden />
              <p className="mt-3 text-[15px] text-foreground leading-relaxed line-clamp-6 flex-1">{r.comment}</p>
              <div className="mt-5 flex items-center justify-between gap-3">
                <span className="text-[13px] font-medium text-foreground truncate">{r.userName}</span>
                <StarRow rating={r.rating} size="w-3.5 h-3.5" />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-muted-foreground">
          No written reviews yet. Learners can rate the course from the course page.
        </p>
      )}

      <Link
        href={`/courses/${slug}#reviews`}
        className="mt-8 inline-flex items-center gap-1.5 text-[14px] font-medium text-violet-600 hover:underline"
      >
        {totalReviews > 0 ? "Read all reviews" : "Rate the course"} <ArrowRight className="w-4 h-4" />
      </Link>
    </section>
  );
}
