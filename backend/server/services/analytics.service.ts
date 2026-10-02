// Analytics service (SRS FR-12) — Mongo-backed port of
// src/lib/analytics/analytics.server.ts. Holds one progress snapshot per student
// (pushed by the learner app + seeded with a demo cohort via analytics.seed.ts)
// and derives role-scoped aggregates: class performance (teacher), school
// engagement (school admin), and national totals (platform admin). The pure
// aggregation helpers are ported verbatim; the snapshot reads hit Mongo.

import { AI_COURSE, flattenTopics } from "../data/curriculum";
import {
  AnalyticsSnapshot,
  toSnapshot,
  type StudentSnapshot,
} from "../models/AnalyticsSnapshot";

/** Upsert a learner's snapshot (called by the student app's sync). */
export async function recordSnapshot(s: StudentSnapshot): Promise<void> {
  await AnalyticsSnapshot.updateOne(
    { studentUserId: s.studentUserId },
    {
      $set: {
        studentName: s.studentName,
        schoolName: s.schoolName,
        className: s.className,
        topicsCompleted: s.topicsCompleted,
        topicsTotal: s.topicsTotal,
        modulesCompleted: s.modulesCompleted,
        modulesTotal: s.modulesTotal,
        assessmentsPassed: s.assessmentsPassed,
        avgScorePct: s.avgScorePct,
        totalTimeSec: s.totalTimeSec,
        moduleScores: s.moduleScores,
        certificateIssued: s.certificateIssued,
        updatedAt: s.updatedAt,
      },
    },
    { upsert: true },
  );
}

// ---- snapshot reads ---------------------------------------------------------
async function snapshotsForSchools(names: Set<string>): Promise<StudentSnapshot[]> {
  const docs = await AnalyticsSnapshot.find({ schoolName: { $in: [...names] } });
  return docs.map(toSnapshot);
}

/** Snapshots for a specific set of student ids (teacher analytics scope). */
async function snapshotsForStudents(ids: string[]): Promise<StudentSnapshot[]> {
  if (ids.length === 0) return [];
  const docs = await AnalyticsSnapshot.find({ studentUserId: { $in: ids } });
  return docs.map(toSnapshot);
}

async function allSnapshots(): Promise<StudentSnapshot[]> {
  const docs = await AnalyticsSnapshot.find({});
  return docs.map(toSnapshot);
}

// ---- aggregation helpers (verbatim from analytics.server.ts) ----------------
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const avg = (a: number[]) => Math.round(mean(a));
const avgDefined = (a: (number | null)[]) => {
  const v = a.filter((x): x is number => x != null);
  return v.length ? Math.round(mean(v)) : null;
};
const rate = <T>(arr: T[], pred: (t: T) => boolean) =>
  arr.length ? Math.round((arr.filter(pred).length / arr.length) * 100) : 0;
const isComplete = (s: StudentSnapshot) => s.modulesCompleted === s.modulesTotal;

function classBreakdown(students: StudentSnapshot[]) {
  const byClass = new Map<string, StudentSnapshot[]>();
  for (const s of students) {
    const k = `${s.schoolName} · Class ${s.className}`;
    if (!byClass.has(k)) byClass.set(k, []);
    byClass.get(k)!.push(s);
  }
  return [...byClass.entries()].map(([name, arr]) => ({
    name,
    students: arr.length,
    avgProgressPct: avg(arr.map((s) => pct(s.topicsCompleted, s.topicsTotal))),
    avgScorePct: avgDefined(arr.map((s) => s.avgScorePct)),
    completionRate: rate(arr, isComplete),
  }));
}

export async function teacherAnalytics(studentUserIds: string[]) {
  const students = await snapshotsForStudents(studentUserIds);
  const moduleTrend = AI_COURSE.modules.map((m) => {
    const scores = students
      .map((s) => s.moduleScores[m.id])
      .filter((v): v is number => typeof v === "number");
    return {
      moduleId: m.id,
      label: `M${m.order}`,
      avgScore: scores.length ? avg(scores) : null,
      attempts: scores.length,
    };
  });
  return {
    totalStudents: students.length,
    completionRate: rate(students, isComplete),
    avgScorePct: avgDefined(students.map((s) => s.avgScorePct)),
    classes: classBreakdown(students),
    moduleTrend,
    roster: students
      .map((s) => ({
        name: s.studentName,
        className: s.className,
        progressPct: pct(s.topicsCompleted, s.topicsTotal),
        avgScorePct: s.avgScorePct,
        complete: isComplete(s),
      }))
      .sort((a, b) => b.progressPct - a.progressPct),
  };
}

export async function schoolAnalytics(schoolName: string) {
  const students = await snapshotsForSchools(new Set([schoolName]));
  const resolvedName = students[0]?.schoolName ?? schoolName ?? "School";
  return {
    schoolName: resolvedName,
    totalStudents: students.length,
    participationRate: rate(students, (s) => s.topicsCompleted > 0 || s.totalTimeSec > 0),
    completionRate: rate(students, isComplete),
    avgScorePct: avgDefined(students.map((s) => s.avgScorePct)),
    avgTimeSec: avg(students.map((s) => s.totalTimeSec)),
    certificatesIssued: students.filter((s) => s.certificateIssued).length,
    classes: classBreakdown(students),
  };
}

export async function platformAnalytics() {
  const all = await allSnapshots();
  const bySchool = new Map<string, StudentSnapshot[]>();
  for (const s of all) {
    if (!bySchool.has(s.schoolName)) bySchool.set(s.schoolName, []);
    bySchool.get(s.schoolName)!.push(s);
  }
  return {
    totalSchools: bySchool.size,
    totalStudents: all.length,
    certificatesIssued: all.filter((s) => s.certificateIssued).length,
    completionRate: rate(all, isComplete),
    avgScorePct: avgDefined(all.map((s) => s.avgScorePct)),
    totalLearningHours: Math.round(all.reduce((s, x) => s + x.totalTimeSec, 0) / 3600),
    schools: [...bySchool.entries()]
      .map(([, arr]) => ({
        schoolName: arr[0].schoolName,
        students: arr.length,
        completionRate: rate(arr, isComplete),
        avgScorePct: avgDefined(arr.map((s) => s.avgScorePct)),
        certificates: arr.filter((s) => s.certificateIssued).length,
      }))
      .sort((a, b) => b.students - a.students),
  };
}
