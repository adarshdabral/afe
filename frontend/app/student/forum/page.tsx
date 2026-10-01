"use client";

import { StudentSidebar } from "@/components/StudentSidebar";
import { ForumView } from "@/components/ForumView";

export default function StudentForum() {
  return (
    <div className="min-h-screen flex bg-background">
      <StudentSidebar />
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        <ForumView />
      </main>
    </div>
  );
}
