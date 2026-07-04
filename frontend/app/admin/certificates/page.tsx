"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, ShieldCheck, ShieldX, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/AppContext";
import {
  listAllCertificates,
  revokeCertificate,
  type Certificate,
  type CertificateStatus,
} from "@/lib/api/certificates";

const selectClass = "h-11 px-3 rounded-xl border border-input bg-card text-sm text-foreground";

export default function AdminCertificates() {
  const { role } = useApp();
  const isPlatform = role === "platform_admin";

  const [certs, setCerts] = useState<Certificate[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CertificateStatus | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!isPlatform) return;
    setError(false);
    listAllCertificates(status === "all" ? undefined : status)
      .then(setCerts)
      .catch(() => setError(true));
  }, [isPlatform, status]);

  useEffect(load, [load]);

  const revoke = async (c: Certificate) => {
    if (!confirm(`Revoke certificate ${c.certificateId}?`)) return;
    setBusy(c.certificateId);
    try {
      await revokeCertificate(c.certificateId);
      toast.success("Certificate revoked.");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not revoke");
    } finally {
      setBusy(null);
    }
  };

  if (!isPlatform) {
    return (
      <Shell>
        <div className="bg-card rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center text-muted-foreground">
          Platform admins only.
        </div>
      </Shell>
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = (certs ?? []).filter(
    (c) =>
      !q ||
      c.certificateId.toLowerCase().includes(q) ||
      c.studentName.toLowerCase().includes(q) ||
      c.courseTitle.toLowerCase().includes(q),
  );

  return (
    <Shell>
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Certificates</h1>
        <p className="text-muted-foreground mt-1">{certs?.length ?? 0} issued. Verify or revoke.</p>
      </header>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search id, student, course…"
            className="rounded-xl h-11 pl-9"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as CertificateStatus | "all")} className={selectClass}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      <div className="bg-card rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-gray-100 dark:border-gray-700">
                <th className="px-4 py-3 font-medium">Certificate</th>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Course</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <Row>Couldn&apos;t load certificates.</Row>
              ) : certs === null ? (
                <Row>Loading…</Row>
              ) : filtered.length === 0 ? (
                <Row>No certificates match.</Row>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{c.certificateId}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.studentName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.courseTitle}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${c.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"}`}>
                        {c.status === "active" ? <ShieldCheck className="w-3 h-3" /> : <ShieldX className="w-3 h-3" />}
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Link href={`/certificate/verify/${c.certificateId}`} target="_blank" className="text-violet-600 hover:underline text-xs">
                          Verify
                        </Link>
                        {c.status === "active" && (
                          <Button size="sm" variant="outline" disabled={busy === c.certificateId} onClick={() => revoke(c)} className="rounded-lg h-8 text-red-600">
                            <ShieldOff className="w-3.5 h-3.5 mr-1" /> Revoke
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background">
      <AdminSidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">{children}</td>
    </tr>
  );
}
