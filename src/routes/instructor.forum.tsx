import { createFileRoute } from "@tanstack/react-router";
import { InstructorSidebar } from "@/components/InstructorSidebar";
import { ForumView } from "@/components/ForumView";

export const Route = createFileRoute("/instructor/forum")({
  head: () => ({ meta: [{ title: "Forum — AI For Everyone" }] }),
  component: InstructorForum,
});

function InstructorForum() {
  return (
    <div className="min-h-screen flex bg-background">
      <InstructorSidebar />
      <main className="flex-1 min-w-0">
        <ForumView />
      </main>
    </div>
  );
}
