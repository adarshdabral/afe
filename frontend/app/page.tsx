import type { Metadata } from "next";
import { HomeLanding } from "@/components/course-landing/HomeLanding";
import { CourseJsonLd } from "@/components/course-landing/CourseJsonLd";
import { PLATFORM_NAME } from "@/lib/course";
import { getCourseOutline, resolveFlagshipSlug } from "@/lib/server/course";

const TITLE = `AI for Everyone — Learn Artificial Intelligence | ${PLATFORM_NAME}`;
const DESCRIPTION =
  "AI for Everyone by Dr. Sudhanshu Joshi: a self-paced, beginner-level course on what AI is, how it learns, where it's used, and how to use it responsibly — with module assessments and a verifiable certificate of completion.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: PLATFORM_NAME },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

// `/` — the AI for Everyone landing page. The course outline is fetched on the
// server for SSR/SEO; the client re-fetches only if this fails.
export default async function Home() {
  const slug = await resolveFlagshipSlug();
  const course = await getCourseOutline(slug);
  return (
    <>
      {course && <CourseJsonLd course={course} />}
      <HomeLanding slug={slug} initial={course} />
    </>
  );
}
