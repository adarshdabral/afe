import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { VerifyCertificateForm } from "@/components/course-landing/VerifyCertificateForm";
import { PLATFORM_NAME } from "@/lib/course";

export const metadata: Metadata = {
  title: `Verify a certificate | ${PLATFORM_NAME}`,
  description: "Check that an AI for Everyone certificate of completion is genuine and has not been revoked.",
};

// Public entry point for certificate verification — hands off to the existing
// /certificate/verify/[id] page.
export default function VerifyLookupPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-20 md:py-28">
        <span className="w-12 h-12 rounded-2xl bg-violet-600/10 text-violet-600 flex items-center justify-center">
          <ShieldCheck className="w-6 h-6" aria-hidden />
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground">Verify a certificate</h1>
        <p className="mt-3 text-[16px] text-muted-foreground leading-relaxed">
          Every AI for Everyone certificate has a unique ID, printed on the certificate next to its QR
          code. Enter it below to confirm the certificate is genuine and has not been revoked.
        </p>
        <VerifyCertificateForm className="mt-8" autoFocus />
        <p className="mt-10 text-[14px] text-muted-foreground">
          Earning your own?{" "}
          <Link href="/#certificate" className="text-violet-600 hover:underline">
            How the certificate works
          </Link>
        </p>
      </main>
    </div>
  );
}
