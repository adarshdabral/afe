import { PLATFORM_NAME, type CourseOutline } from "@/lib/course";

/** schema.org Course structured data, built only from real course fields. */
export function CourseJsonLd({ course }: { course: CourseOutline }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.shortDescription || course.description,
    provider: {
      "@type": "Organization",
      name: course.offeredBy.name || PLATFORM_NAME,
      ...(course.offeredBy.url ? { url: course.offeredBy.url } : {}),
    },
    ...(course.skills.length ? { teaches: course.skills } : {}),
    ...(course.instructor ? { creator: { "@type": "Person", name: course.instructor } } : {}),
    educationalLevel: course.level,
    syllabusSections: course.modules.map((m) => ({
      "@type": "Syllabus",
      name: m.title,
      description: m.description,
    })),
  };
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output with "<" escaped so content can't close the tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
