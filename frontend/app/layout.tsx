import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "AI For Everyone — Learn AI. Build the Future.",
  description:
    "Learn AI, web development, data science, and cloud — taught by industry experts. Free for everyone.",
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
