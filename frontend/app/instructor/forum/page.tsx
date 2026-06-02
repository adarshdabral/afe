"use client";

import { InstructorSidebar } from "@/components/InstructorSidebar";
import { ForumView } from "@/components/ForumView";

export default function InstructorForum() {
  return (
    <div className="min-h-screen flex bg-background">
      <InstructorSidebar />
      <main className="flex-1 min-w-0">
        <ForumView />
      </main>
    </div>
  );
}
