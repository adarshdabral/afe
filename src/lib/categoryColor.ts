import type { Category } from "@/data/mock";

export function categoryBadgeClass(category: Category): string {
  switch (category) {
    case "AI & ML":
      return "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300";
    case "Web Dev":
      return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300";
    case "Data Science":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
    case "Cloud":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300";
  }
}
