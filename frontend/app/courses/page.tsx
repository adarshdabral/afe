import { redirect } from "next/navigation";
import { resolveFlagshipSlug } from "@/lib/server/course";

// Reads the database at request time (never prerendered at build).
export const dynamic = "force-dynamic";

// AI Spark is a single-course platform: there is no catalog. `/courses` sends
// visitors straight to the Demystifying AI for Everyone course page.
export default async function CoursesIndex() {
  redirect(`/courses/${await resolveFlagshipSlug()}`);
}
