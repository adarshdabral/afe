export function CourseCardSkeleton() {
  return (
    <div className="bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="aspect-video bg-gray-100 dark:bg-gray-800 animate-pulse" />
      <div className="p-5 space-y-3">
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-3/4" />
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-1/2" />
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-2/3" />
        <div className="h-9 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse mt-3" />
      </div>
    </div>
  );
}
