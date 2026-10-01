import type { Metadata } from "next";
import { CourseDetailView } from "@/components/course-landing/CourseDetailView";
import { CourseJsonLd } from "@/components/course-landing/CourseJsonLd";
import { PLATFORM_NAME } from "@/lib/course";
import { getCourseOutline } from "@/lib/server/course";

// Reads the database at request time (never prerendered at build).
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseOutline(slug);
  if (!course) return { title: `Course | ${PLATFORM_NAME}` };
  const title = `${course.title}${course.instructor ? ` by ${course.instructor}` : ""} | ${PLATFORM_NAME}`;
  const description = course.shortDescription || course.description;
  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: PLATFORM_NAME },
    twitter: { card: "summary", title, description },
  };
}

// Public course page — published courses only (the API scopes anonymous reads).
export default async function CourseDetailPage({ params }: Params) {
  const { slug } = await params;
  const course = await getCourseOutline(slug);
  return (
    <>
      {course && <CourseJsonLd course={course} />}
      <CourseDetailView slug={slug} initial={course} />
    </>
  );
}
