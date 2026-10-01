import type { CourseStatus } from "@/lib/api/courses";

const STYLES: Record<CourseStatus, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  published: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
  archived: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
};

export function CourseStatusBadge({ status }: { status: CourseStatus }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STYLES[status]}`}>
      {status}
    </span>
  );
}
