"use client";

// Admin → Branding: upload the platform logo. It replaces the default Sparkles
// mark everywhere the brand appears (navbar, footer, sidebars, sign-in pages,
// certificate card, course hero). Removing it restores the default mark.

import { useRef, useState } from "react";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminSidebar } from "@/components/AdminSidebar";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import { useBranding } from "@/context/BrandingContext";
import { updateBranding } from "@/lib/api/branding";
import { uploadFile, uploadErrorMessage } from "@/lib/api/uploads";
import { PLATFORM_NAME } from "@/lib/course";

const LOGO_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml,image/gif,.png,.jpg,.jpeg,.webp,.svg,.gif";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export default function AdminBranding() {
  const { role, loadingUser } = useApp();
  const isPlatform = role === "platform_admin";
  const { logoUrl, setLogoUrl } = useBranding();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [progress, setProgress] = useState(0);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Choose an image file (PNG, JPG, WEBP, SVG or GIF).");
    if (file.size > MAX_LOGO_BYTES) return toast.error("Logo must be 2 MB or smaller.");
    setBusy("upload");
    setProgress(0);
    try {
      const uploaded = await uploadFile(file, setProgress);
      const branding = await updateBranding(uploaded.url);
      setLogoUrl(branding.logoUrl);
      toast.success("Logo updated.");
    } catch (e) {
      toast.error(uploadErrorMessage(e, "Could not upload the logo"));
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    if (!confirm("Remove the logo and go back to the default mark?")) return;
    setBusy("remove");
    try {
      await updateBranding("");
      setLogoUrl("");
      toast.success("Logo removed.");
    } catch (e) {
      toast.error(uploadErrorMessage(e, "Could not remove the logo"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <AdminSidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Branding</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload your logo. It replaces the default mark across the whole site.
          </p>

          {!loadingUser && !isPlatform ? (
            <div className="mt-6 bg-card rounded-3xl border border-border p-8 text-center text-muted-foreground">
              Platform admins only.
            </div>
          ) : (
            <section className="mt-6 bg-card rounded-3xl border border-border shadow-soft p-6 sm:p-8">
              <h2 className="font-semibold text-foreground">Logo</h2>

              <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="flex items-center gap-4 rounded-2xl border border-border bg-background px-5 py-4">
                  <BrandMark size="lg" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Preview</p>
                    <div className="mt-1.5 flex items-center gap-2.5">
                      <BrandMark />
                      <span className="font-semibold tracking-tight text-[15px] text-foreground">{PLATFORM_NAME}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <input
                    ref={inputRef}
                    type="file"
                    accept={LOGO_ACCEPT}
                    className="hidden"
                    onChange={(e) => onFile(e.target.files?.[0])}
                  />
                  <Button onClick={() => inputRef.current?.click()} disabled={busy !== null}>
                    {busy === "upload" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageUp className="w-4 h-4" />}
                    {busy === "upload" ? `Uploading… ${progress}%` : logoUrl ? "Replace logo" : "Upload logo"}
                  </Button>
                  {logoUrl && (
                    <Button variant="outline" onClick={remove} disabled={busy !== null}>
                      {busy === "remove" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Remove
                    </Button>
                  )}
                </div>
              </div>

              <ul className="mt-6 text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>PNG, JPG, WEBP, SVG or GIF, up to 2 MB.</li>
                <li>A square image with a transparent background works best — it is shown at small sizes (32 px).</li>
                <li>Until a logo is uploaded, the default violet mark is shown.</li>
              </ul>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
