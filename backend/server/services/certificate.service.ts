// Certificate service. Auto-issues one certificate per (student, course) when
// progress becomes certificate-eligible (idempotent). Owns id generation
// (AFE-YYYY-XXXXXXXX), verification, revocation, and branded PDF + QR generation.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { Certificate, toCertificate, type CertificateView } from "../models/Certificate";
import { Course } from "../models/Course";
import { getUserById } from "./auth.service";
import { studentSchoolInfo } from "./registration.service";

/** Public app origin used to build the QR verification URL. (CORS_ORIGIN is a
 *  legacy fallback from the old split deployment.) */
function appUrl(): string {
  return process.env.APP_PUBLIC_URL ?? process.env.CORS_ORIGIN ?? "http://localhost:3000";
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomHex(bytes: number): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function randomCode(len: number): string {
  const arr = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(arr, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

/** Generate a unique AFE-YYYY-XXXXXXXX certificate id (retries on collision). */
async function uniqueCertificateId(year: number): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const id = `AFE-${year}-${randomHex(4)}`;
    if (!(await Certificate.findOne({ certificateId: id }))) return id;
  }
  return `AFE-${year}-${randomHex(4)}${randomHex(2)}`;
}

/**
 * Idempotently issue a certificate for (student, course). Returns the existing
 * certificate if one is already present. Snapshots the student name, school name,
 * and course title at issue time.
 */
export async function issueCertificate(
  studentId: string,
  courseId: string,
): Promise<CertificateView> {
  const existing = await Certificate.findOne({ studentId, courseId });
  if (existing) return toCertificate(existing);

  const [principal, course, school] = await Promise.all([
    getUserById(studentId),
    Course.findById(courseId).catch(() => null),
    studentSchoolInfo(studentId),
  ]);

  const year = new Date().getFullYear();
  const certificateId = await uniqueCertificateId(year);
  const verificationCode = randomCode(8);
  const qrCode = `${appUrl()}/certificate/verify/${certificateId}`;

  // Handle the unique-index race (concurrent auto-issue) by returning the winner.
  try {
    const doc = await Certificate.create({
      certificateId,
      studentId,
      courseId,
      studentName: principal?.name ?? "Student",
      schoolName: school?.schoolName || "Independent Learner",
      courseTitle: course?.title ?? "Course",
      issueDate: new Date().toISOString(),
      verificationCode,
      qrCode,
      status: "active",
    });
    return toCertificate(doc);
  } catch (err) {
    const dup = await Certificate.findOne({ studentId, courseId });
    if (dup) return toCertificate(dup);
    throw err;
  }
}

export async function getStudentCertificates(studentId: string): Promise<CertificateView[]> {
  const docs = await Certificate.find({ studentId }).sort({ issueDate: -1 });
  return docs.map(toCertificate);
}

export async function getCertificateForCourse(
  studentId: string,
  courseId: string,
): Promise<CertificateView | null> {
  const doc = await Certificate.findOne({ studentId, courseId });
  return doc ? toCertificate(doc) : null;
}

export async function getByCertificateId(certificateId: string): Promise<CertificateView | null> {
  const doc = await Certificate.findOne({ certificateId });
  return doc ? toCertificate(doc) : null;
}

export async function listAllCertificates(): Promise<CertificateView[]> {
  const docs = await Certificate.find({}).sort({ createdAt: -1 });
  return docs.map(toCertificate);
}

/** Revoke a certificate (admin). Returns the updated view, or null if missing. */
export async function revokeCertificate(certificateId: string): Promise<CertificateView | null> {
  const doc = await Certificate.findOne({ certificateId });
  if (!doc) return null;
  doc.status = "revoked";
  await doc.save();
  return toCertificate(doc);
}

/** Branded certificate PDF (A4 landscape) with an embedded QR code. */
export async function generateCertificatePdf(cert: CertificateView): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]); // A4 landscape (pt)
  const { width, height } = page.getSize();
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const violet = rgb(0.42, 0.39, 1);
  const dark = rgb(0.1, 0.1, 0.15);
  const grey = rgb(0.4, 0.4, 0.45);

  // Border
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: violet, borderWidth: 3 });
  page.drawRectangle({ x: 34, y: 34, width: width - 68, height: height - 68, borderColor: violet, borderWidth: 1 });

  const center = (text: string, y: number, size: number, font = serif, color = dark) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - w) / 2, y, size, font, color });
  };

  center("AI FOR EVERYONE", height - 90, 16, serifBold, violet);
  center("Certificate of Completion", height - 140, 30, serifBold, dark);
  center("This is proudly presented to", height - 185, 13, serif, grey);
  center(cert.studentName, height - 235, 34, serifBold, dark);
  center("for successfully completing the course", height - 275, 13, serif, grey);
  center(cert.courseTitle, height - 315, 22, serifBold, violet);
  if (cert.schoolName) center(cert.schoolName, height - 342, 12, serif, grey);

  const issued = new Date(cert.issueDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  center(`Issued on ${issued}`, height - 380, 12, serif, grey);

  // QR code (links to public verification)
  try {
    const qrDataUrl = await QRCode.toDataURL(cert.qrCode || cert.certificateId, { margin: 1, width: 240 });
    const qrImage = await pdf.embedPng(qrDataUrl);
    page.drawImage(qrImage, { x: width - 150, y: 70, width: 90, height: 90 });
    page.drawText("Scan to verify", { x: width - 152, y: 60, size: 8, font: serif, color: grey });
  } catch {
    /* QR is best-effort — the id + code below are always present */
  }

  // Certificate id + verification code
  page.drawText(`Certificate ID: ${cert.certificateId}`, { x: 60, y: 100, size: 10, font: serifBold, color: dark });
  page.drawText(`Verification code: ${cert.verificationCode}`, { x: 60, y: 84, size: 9, font: serif, color: grey });

  // Signatures
  page.drawLine({ start: { x: 60, y: 150 }, end: { x: 230, y: 150 }, thickness: 1, color: grey });
  page.drawText("Dr Sudhanshu Joshi", { x: 60, y: 135, size: 11, font: serifBold, color: dark });
  page.drawText("Programme Director", { x: 60, y: 122, size: 9, font: serif, color: grey });

  page.drawLine({ start: { x: 300, y: 150 }, end: { x: 470, y: 150 }, thickness: 1, color: grey });
  page.drawText("AI For Everyone", { x: 300, y: 135, size: 11, font: serifBold, color: dark });
  page.drawText("Platform Authority", { x: 300, y: 122, size: 9, font: serif, color: grey });

  if (cert.status === "revoked") center("— REVOKED —", height / 2, 60, serifBold, rgb(0.9, 0.2, 0.2));

  return pdf.save();
}
