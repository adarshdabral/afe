import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { CertificateCard } from "@/components/CertificateCard";
import { verifyCertificateFn } from "@/lib/certificates/certificate.functions";

// PUBLIC route — no auth. Anyone scanning the QR can verify a certificate.
export const Route = createFileRoute("/verify/$token")({
  head: () => ({ meta: [{ title: "Verify Certificate — AI For Everyone" }] }),
  loader: ({ params }) => verifyCertificateFn({ data: { token: params.token } }),
  component: VerifyPage,
});

function VerifyPage() {
  const { valid, certificate } = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-12">
      <Link to="/" className="flex items-center gap-2 font-semibold text-foreground mb-8">
        <span className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center">
          <Sparkles className="w-4 h-4" />
        </span>
        AI For Everyone
      </Link>

      <div className="w-full max-w-2xl">
        {valid && certificate ? (
          <>
            <div className="flex items-center gap-3 justify-center mb-6">
              <span className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </span>
              <div>
                <p className="font-semibold text-foreground">Certificate verified</p>
                <p className="text-xs text-muted-foreground">
                  This is a genuine certificate issued by AI For Everyone.
                </p>
              </div>
            </div>
            <CertificateCard cert={certificate} />
          </>
        ) : (
          <div className="bg-card rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
            <span className="w-14 h-14 mx-auto rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 flex items-center justify-center">
              <XCircle className="w-7 h-7" />
            </span>
            <h1 className="mt-4 text-xl font-semibold text-foreground">Certificate not found</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This verification link is invalid or the certificate has been revoked.
            </p>
            <Link
              to="/"
              className="mt-5 inline-block text-sm font-medium text-violet-600 hover:underline"
            >
              Go to homepage
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
