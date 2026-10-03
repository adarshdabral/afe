import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { BrandingProvider } from "@/context/BrandingContext";
import { getServerLogoUrl } from "@/lib/server/branding";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: {
    default: "Demystifying AI for Everyone | AI on Wheels",
    template: "%s",
  },
  description:
    "AI on Wheels presents Demystifying AI by Dr. Sudhanshu Joshi — a self-paced course on artificial intelligence, its applications and its impact, with module assessments and a verifiable certificate.",
  applicationName: "Demystifying AI",
  openGraph: { siteName: "Demystifying AI", type: "website" },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const logoUrl = await getServerLogoUrl();
  return (
    <html lang="en">
      <body>
        <AppProvider>
          <BrandingProvider initialLogoUrl={logoUrl}>
          <div className="flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
          <Toaster position="top-right" richColors />
          </BrandingProvider>
        </AppProvider>
      </body>
    </html>
  );
}
