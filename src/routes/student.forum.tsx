import { createFileRoute } from "@tanstack/react-router";
import { StudentSidebar } from "@/components/StudentSidebar";
import { ForumView } from "@/components/ForumView";

export const Route = createFileRoute("/student/forum")({
  head: () => ({ meta: [{ title: "Forum — AI For Everyone" }] }),
  component: StudentForum,
});

function StudentForum() {
  return (
    <div className="min-h-screen flex bg-background">
      <StudentSidebar />
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        <ForumView />
      </main>
    </div>
  );
}
