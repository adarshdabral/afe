"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, Download, ShieldCheck, ExternalLink } from "lucide-react";
import { StudentSidebar } from "@/components/StudentSidebar";
import { FLAGSHIP_SLUG } from "@/lib/course";
import { Button } from "@/components/ui/button";
import {
  myCertificates,
  certificateDownloadUrl,
  type Certificate,
} from "@/lib/api/certificates";

export default function StudentCertificates() {
  const [certs, setCerts] = useState<Certificate[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    myCertificates()
      .then(setCerts)
      .catch(() => setError(true));
  }, []);

  return (
    <div className="min-h-screen flex bg-background">
      <StudentSidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <header className="mb-6">
            <h1 className="text-3xl font-bold text-foreground">Certificates</h1>
            <p className="text-muted-foreground mt-1">
              Earned automatically when you complete a course.
            </p>
          </header>

          {error ? (
            <Empty>Couldn&apos;t load your certificates.</Empty>
          ) : certs === null ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="h-28 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : certs.length === 0 ? (
            <Empty>
              <Award className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              No certificates yet — complete every lesson and pass each module assessment to earn yours.{" "}
              <Link href={`/learn/${FLAGSHIP_SLUG}`} className="text-violet-600 underline">Continue AI for Everyone</Link>.
            </Empty>
          ) : (
            <div className="space-y-4">
              {certs.map((c) => (
                <div
                  key={c.id}
                  className="bg-card rounded-3xl border border-border shadow-soft elevate p-6 flex flex-col sm:flex-row sm:items-center gap-5"
                >
                  <div className="w-14 h-14 rounded-2xl bg-violet-600/10 text-violet-600 flex items-center justify-center shrink-0 ring-1 ring-violet-600/15">
                    <Award className="w-7 h-7" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate">{c.courseTitle}</p>
                    <p className="text-[13px] text-muted-foreground mt-0.5 font-mono">
                      {c.certificateId} · issued {new Date(c.issueDate).toLocaleDateString()}
                    </p>
                    {c.status === "revoked" && (
                      <span className="inline-block mt-2 text-xs px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">
                        Revoked
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <a href={certificateDownloadUrl(c.certificateId)} target="_blank" rel="noreferrer">
                      <Button
                        size="sm"
                        className="rounded-full h-9 px-4 bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
                      >
                        <Download className="w-4 h-4 mr-1.5" /> PDF
                      </Button>
                    </a>
                    <Link href={`/certificate/verify/${c.certificateId}`} target="_blank">
                      <Button size="sm" variant="outline" className="rounded-full h-9 px-4 bg-card">
                        <ShieldCheck className="w-4 h-4 mr-1.5" /> Verify
                        <ExternalLink className="w-3 h-3 ml-1.5" />
                      </Button>
                    </Link>
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

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl border border-gray-100 dark:border-gray-700 p-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
