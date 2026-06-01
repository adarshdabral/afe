import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CertificateCard } from "@/components/CertificateCard";
import { useApp } from "@/context/AppContext";
import { buildCourseProgress } from "@/lib/progress";
import { issueCertificateFn, myCertificateFn } from "@/lib/certificates/certificate.functions";

export const Route = createFileRoute("/student/certificate")({
  head: () => ({ meta: [{ title: "Certificate — AI For Everyone" }] }),
  component: CertificatePage,
});

function CertificatePage() {
  const { completedLessons, assessmentScores } = useApp();
  const queryClient = useQueryClient();
  const progress = buildCourseProgress({ completedLessons, assessmentScores, timeSpent: {} });
  const eligible = progress.modulesCompleted === progress.modulesTotal;

  const { data: cert, isLoading } = useQuery({
    queryKey: ["myCertificate"],
    queryFn: () => myCertificateFn(),
  });

  const [issuing, setIssuing] = useState(false);

  // FR-11 auto-generation: mint as soon as the learner is eligible.
  useEffect(() => {
    if (eligible && cert === null && !issuing) {
      setIssuing(true);
      issueCertificateFn({ data: { completedLessons, assessmentScores } })
        .then(() => queryClient.invalidateQueries({ queryKey: ["myCertificate"] }))
        .catch(() => {})
        .finally(() => setIssuing(false));
    }
  }, [eligible, cert, issuing, completedLessons, assessmentScores, queryClient]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const verifyUrl = cert ? `${origin}/verify/${cert.verificationToken}` : "";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between print:hidden">
        <Link
          to="/student/curriculum"
          className="text-sm text-violet-600 inline-flex items-center gap-1 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Back to course
        </Link>
        {cert && (
          <Button
            onClick={() => window.print()}
            className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white gap-1"
          >
            <Download className="w-4 h-4" /> Download PDF
          </Button>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-12">
        {cert ? (
          <>
            <CertificateCard
              cert={{
                studentName: cert.studentName,
                schoolName: cert.schoolName,
                courseTitle: cert.courseTitle,
                certificateCode: cert.certificateCode,
                issuedAt: cert.issuedAt,
              }}
              verifyUrl={verifyUrl}
            />
            <p className="mt-4 text-center text-xs text-muted-foreground print:hidden">
              Verify at{" "}
              <Link
                to="/verify/$token"
                params={{ token: cert.verificationToken }}
                className="text-violet-600 hover:underline break-all"
              >
                {verifyUrl}
              </Link>
            </p>
          </>
        ) : isLoading || (eligible && issuing) ? (
          <div className="bg-card rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
            <Loader2 className="w-8 h-8 mx-auto text-violet-600 animate-spin" />
            <p className="mt-4 text-sm text-muted-foreground">Generating your certificate…</p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Lock className="w-6 h-6 text-muted-foreground" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-foreground">
              Your certificate isn't ready yet
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete all {progress.modulesTotal} modules and pass every assessment to earn it.
            </p>
            <p className="mt-3 text-sm font-medium text-foreground">
              {progress.modulesCompleted}/{progress.modulesTotal} modules complete ·{" "}
              {progress.assessmentsPassed}/{progress.modulesTotal} assessments passed
            </p>
            <Link to="/student/curriculum">
              <Button className="mt-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
                Continue the course
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
