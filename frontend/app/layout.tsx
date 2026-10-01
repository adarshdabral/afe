import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: {
    default: "AI for Everyone — Learn Artificial Intelligence | AI Spark",
    template: "%s",
  },
  description:
    "AI Spark presents AI for Everyone by Dr. Sudhanshu Joshi — a self-paced course on artificial intelligence, its applications and its impact, with module assessments and a verifiable certificate.",
  applicationName: "AI Spark",
  openGraph: { siteName: "AI Spark", type: "website" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          <div className="flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
          <Toaster position="top-right" richColors />
        </AppProvider>
      </body>
    </html>
  );
}
