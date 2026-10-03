"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ShieldCheck, ShieldX, Loader2 } from "lucide-react";
import { verifyCertificate, type PublicCertificate } from "@/lib/api/certificates";
import { BrandMark } from "@/components/BrandMark";
import { PLATFORM_NAME } from "@/lib/course";

// PUBLIC certificate verification — no auth. Anyone (employers, teachers) can
// confirm a certificate by its id.
export default function VerifyCertificate() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<"loading" | "error" | "done">("loading");
  const [result, setResult] = useState<{ valid: boolean; certificate: PublicCertificate | null }>();

  useEffect(() => {
    verifyCertificate(id)
      .then((r) => {
        setResult(r);
        setState("done");
      })
      .catch(() => setState("error"));
  }, [id]);

  const valid = result?.valid && result.certificate;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <Link href="/" className="flex items-center gap-2 font-semibold text-foreground mb-8">
        <BrandMark />
        {PLATFORM_NAME}
      </Link>

      <div className="w-full max-w-md bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
        {state === "loading" ? (
          <>
            <Loader2 className="w-10 h-10 text-violet-600 mx-auto animate-spin" />
            <p className="text-muted-foreground mt-3">Verifying certificate…</p>
          </>
        ) : state === "error" ? (
          <p className="text-muted-foreground">Could not verify right now. Please try again.</p>
        ) : valid ? (
          <>
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/20 mx-auto flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mt-4">Certificate verified</h1>
            <p className="text-sm text-muted-foreground mt-1">This is a valid, active certificate.</p>
            <dl className="mt-6 text-left text-sm bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 space-y-2">
              <Row label="Student" value={result!.certificate!.studentName} />
              <Row label="Course" value={result!.certificate!.courseTitle} />
              {result!.certificate!.schoolName && <Row label="School" value={result!.certificate!.schoolName} />}
              <Row label="Issued" value={new Date(result!.certificate!.issueDate).toLocaleDateString()} />
              <Row label="Certificate ID" value={result!.certificate!.certificateId} mono />
              <Row label="Status" value="Active" />
            </dl>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/20 mx-auto flex items-center justify-center">
              <ShieldX className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mt-4">Not verified</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {result?.certificate?.status === "revoked"
                ? "This certificate has been revoked and is no longer valid."
                : "No active certificate matches this id."}
            </p>
            {result?.certificate && (
              <dl className="mt-6 text-left text-sm bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 space-y-2">
                <Row label="Student" value={result.certificate.studentName} />
                <Row label="Course" value={result.certificate.courseTitle} />
                <Row label="Status" value="Revoked" />
              </dl>
            )}
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-6">Certificate id: {id}</p>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`font-medium text-foreground text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
