import { redirect } from "next/navigation";
import { resolveFlagshipSlug } from "@/lib/server/course";

// AI Spark is a single-course platform: there is no catalog. `/courses` sends
// visitors straight to the AI for Everyone course page.
export default async function CoursesIndex() {
  redirect(`/courses/${await resolveFlagshipSlug()}`);
}
