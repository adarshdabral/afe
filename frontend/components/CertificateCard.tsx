import { Award } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export interface CertificateData {
  studentName: string;
  schoolName: string;
  courseTitle: string;
  certificateCode: string;
  issuedAt: string;
}

/**
 * The printable diploma. Uses explicit light colours (not theme tokens) so it
 * prints legibly regardless of dark mode. When `verifyUrl` is provided, a
 * scannable QR (encoding the public verification URL) is rendered.
 */
export function CertificateCard({
  cert,
  verifyUrl,
}: {
  cert: CertificateData;
  verifyUrl?: string;
}) {
  const issued = new Date(cert.issuedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const qrSrc = verifyUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=0&data=${encodeURIComponent(verifyUrl)}`
    : null;

  return (
    <div className="bg-white text-gray-900 rounded-2xl border-4 border-violet-600 shadow-lg overflow-hidden">
      <div className="h-2 bg-gradient-to-r from-violet-600 to-violet-400" />
      <div className="p-8 sm:p-12 text-center relative">
        <div className="flex items-center justify-center gap-2 text-violet-700">
          <BrandMark size="md" />
          <span className="font-semibold">Demystifying AI for Everyone</span>
        </div>

        <div className="mt-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-violet-100 text-violet-700">
          <Award className="w-8 h-8" />
        </div>

        <h1 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight">
          Certificate of Completion
        </h1>
        <p className="mt-6 text-sm text-gray-500">This certifies that</p>
        <p className="mt-1 text-2xl sm:text-3xl font-bold text-violet-700">{cert.studentName}</p>
        <p className="mt-4 text-sm text-gray-500">has successfully completed</p>
        <p className="mt-1 text-lg sm:text-xl font-semibold">{cert.courseTitle}</p>
        <p className="mt-2 text-sm text-gray-600">{cert.schoolName}</p>

        <div className="mt-10 flex items-end justify-between gap-6 text-left">
          <div className="text-xs text-gray-500 space-y-1">
            <p>
              <span className="font-medium text-gray-700">Issued:</span> {issued}
            </p>
            <p>
              <span className="font-medium text-gray-700">Certificate ID:</span>{" "}
              <span className="font-mono">{cert.certificateCode}</span>
            </p>
          </div>
          {qrSrc && (
            <div className="text-center shrink-0">
              <img
                src={qrSrc}
                alt={`QR code to verify certificate ${cert.certificateCode}`}
                width={96}
                height={96}
                className="w-24 h-24 rounded-lg border border-gray-200"
              />
              <p className="mt-1 text-[10px] text-gray-500">Scan to verify</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
