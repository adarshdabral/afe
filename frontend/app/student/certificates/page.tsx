"use client";

import Link from "next/link";
import { Award, CheckCircle2, Download, Share2, ExternalLink } from "lucide-react";
import { StudentSidebar } from "@/components/StudentSidebar";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";

export default function Certificates() {
  const { certificates, currentUser } = useApp();

  return (
    <div className="min-h-screen flex bg-background">
      <StudentSidebar />
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <header className="flex items-center gap-3 mb-8">
            <h1 className="text-3xl font-bold text-foreground">My Certificates</h1>
            <span className="px-2.5 py-1 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 text-sm font-medium">{certificates.length}</span>
          </header>

          {certificates.length === 0 ? (
            <div className="bg-card rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-16 text-center">
              <Award className="w-20 h-20 mx-auto text-gray-300 dark:text-gray-600" />
              <h3 className="mt-4 text-xl font-semibold text-foreground">No certificates yet.</h3>
              <p className="text-muted-foreground mt-2">Complete a course to earn your first certificate.</p>
              <Link href="/courses"><Button className="mt-6 rounded-xl bg-violet-600 hover:bg-violet-700 text-white">Browse Courses</Button></Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {certificates.map((c) => (
                <div key={c.id} className="bg-card border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-8 transition-transform hover:-translate-y-1 duration-200">
                  <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-semibold text-violet-600">AI For Everyone</p>
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="w-4 h-4" /> Verified
                    </span>
                  </div>
                  <div className="text-center py-6">
                    <p className="text-xs text-gray-500 uppercase tracking-widest">Certificate of Completion</p>
                    <h2 className="text-3xl font-bold text-foreground mt-3">{currentUser.name}</h2>
                    <p className="text-sm text-muted-foreground mt-2">has successfully completed</p>
                    <p className="text-xl text-violet-600 font-semibold mt-2">{c.courseTitle}</p>
                    <p className="text-sm text-muted-foreground mt-2">Issued {c.issuedDate}</p>
                  </div>
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                    <p className="font-mono text-xs text-gray-400 dark:text-gray-500">ID: {c.verificationId}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="rounded-xl border-violet-300 text-violet-700 dark:text-violet-300"><Download className="w-4 h-4" /> PDF</Button>
                      <Button variant="outline" size="sm" className="rounded-xl"><Share2 className="w-4 h-4" /> Share</Button>
                      <Button variant="outline" size="sm" className="rounded-xl"><ExternalLink className="w-4 h-4" /> Verify</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
