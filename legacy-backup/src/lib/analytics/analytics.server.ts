// SERVER-ONLY analytics store (SRS FR-12). Holds one progress snapshot per
// student (pushed by the learner app + seeded with a demo cohort) and derives
// role-scoped aggregates: class performance (teacher), school engagement
// (school admin), and national totals (platform admin). In-memory today — the
// DB seam for the future analytics rollup tables / materialized views.

import { AI_COURSE, flattenLessons } from "@/data/curriculum";
import { SCHOOLS } from "@/lib/auth/registrations.server";

const LESSONS_TOTAL = flattenLessons().length;
const MODULES_TOTAL = AI_COURSE.modules.length;

export interface StudentSnapshot {
  studentUserId: string;
  studentName: string;
  schoolId: string;
  schoolName: string;
  className: string;
  lessonsCompleted: number;
  lessonsTotal: number;
  modulesCompleted: number;
  modulesTotal: number;
  assessmentsPassed: number;
  avgScorePct: number | null;
  totalTimeSec: number;
  moduleScores: Record<string, number>; // scorePct per attempted module
  certificateIssued: boolean;
  updatedAt: string;
}

const snapshots = new Map<string, StudentSnapshot>();

// Which school each school-admin oversees (demo mapping).
const ADMIN_SCHOOL: Record<string, string> = { "u-school-admin": "school-1" };
export function schoolForAdmin(userId: string): string {
  return ADMIN_SCHOOL[userId] ?? "school-1";
}

function moduleScoresFor(passed: number, avg: number): Record<string, number> {
  const m: Record<string, number> = {};
  for (let i = 1; i <= passed; i++) m[`m${i}`] = avg;
  return m;
}

interface SeedRow {
  id: string;
  name: string;
  schoolId: string;
  schoolName: string;
  className: string;
  lessons: number;
  modules: number;
  passed: number;
  avg: number;
  timeSec: number;
  cert: boolean;
}

function fromSeed(r: SeedRow): StudentSnapshot {
  return {
    studentUserId: r.id,
    studentName: r.name,
    schoolId: r.schoolId,
    schoolName: r.schoolName,
    className: r.className,
    lessonsCompleted: r.lessons,
    lessonsTotal: LESSONS_TOTAL,
    modulesCompleted: r.modules,
    modulesTotal: MODULES_TOTAL,
    assessmentsPassed: r.passed,
    avgScorePct: r.passed ? r.avg : null,
    totalTimeSec: r.timeSec,
    moduleScores: moduleScoresFor(r.passed, r.avg),
    certificateIssued: r.cert,
    updatedAt: "2026-05-30T00:00:00.000Z",
  };
}

let seeded = false;
function seed() {
  if (seeded) return;
  seeded = true;
  const D = { schoolId: "school-1", schoolName: "Doon Public School" };
  const S = { schoolId: "school-2", schoolName: "St. Joseph's Academy" };
  const cohort: SeedRow[] = [
    {
      id: "u-student",
      name: "Aarav Singh",
      ...D,
      className: "10",
      lessons: 12,
      modules: 3,
      passed: 3,
      avg: 76,
      timeSec: 5400,
      cert: false,
    },
    {
      id: "seed-1",
      name: "Riya Menon",
      ...D,
      className: "9",
      lessons: 28,
      modules: 7,
      passed: 7,
      avg: 82,
      timeSec: 14400,
      cert: false,
    },
    {
      id: "seed-2",
      name: "Karan Verma",
      ...D,
      className: "9",
      lessons: 16,
      modules: 4,
      passed: 4,
      avg: 71,
      timeSec: 8000,
      cert: false,
    },
    {
      id: "seed-3",
      name: "Sneha Pillai",
      ...D,
      className: "9",
      lessons: 8,
      modules: 2,
      passed: 2,
      avg: 64,
      timeSec: 4200,
      cert: false,
    },
    {
      id: "seed-4",
      name: "Megha Shah",
      ...D,
      className: "10",
      lessons: 32,
      modules: 8,
      passed: 8,
      avg: 88,
      timeSec: 18000,
      cert: true,
    },
    {
      id: "seed-5",
      name: "Devon King",
      ...D,
      className: "10",
      lessons: 20,
      modules: 5,
      passed: 5,
      avg: 69,
      timeSec: 9000,
      cert: false,
    },
    {
      id: "seed-6",
      name: "Alex Tan",
      ...S,
      className: "11",
      lessons: 24,
      modules: 6,
      passed: 6,
      avg: 79,
      timeSec: 11000,
      cert: false,
    },
    {
      id: "seed-7",
      name: "Maya Lopez",
      ...S,
      className: "11",
      lessons: 32,
      modules: 8,
      passed: 8,
      avg: 91,
      timeSec: 17000,
      cert: true,
    },
    {
      id: "seed-8",
      name: "Tom Park",
      ...S,
      className: "11",
      lessons: 4,
      modules: 1,
      passed: 1,
      avg: 60,
      timeSec: 2000,
      cert: false,
    },
  ];
  for (const r of cohort) snapshots.set(r.id, fromSeed(r));
}

/** Upsert a learner's snapshot (called by the student app's sync). */
export function recordSnapshot(s: StudentSnapshot) {
  seed();
  snapshots.set(s.studentUserId, s);
}

// ---- aggregation helpers ----------------------------------------------------
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
const inSchools = (ids: Set<string>) => {
  seed();
  return [...snapshots.values()].filter((s) => ids.has(s.schoolId));
};

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
    avgProgressPct: avg(arr.map((s) => pct(s.lessonsCompleted, s.lessonsTotal))),
    avgScorePct: avgDefined(arr.map((s) => s.avgScorePct)),
    completionRate: rate(arr, isComplete),
  }));
}

export function teacherAnalytics(schoolIds: string[]) {
  const students = inSchools(new Set(schoolIds));
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
        progressPct: pct(s.lessonsCompleted, s.lessonsTotal),
        avgScorePct: s.avgScorePct,
        complete: isComplete(s),
      }))
      .sort((a, b) => b.progressPct - a.progressPct),
  };
}

export function schoolAnalytics(schoolId: string) {
  const students = inSchools(new Set([schoolId]));
  const schoolName =
    students[0]?.schoolName ?? SCHOOLS.find((s) => s.id === schoolId)?.name ?? "School";
  return {
    schoolName,
    totalStudents: students.length,
    participationRate: rate(students, (s) => s.lessonsCompleted > 0 || s.totalTimeSec > 0),
    completionRate: rate(students, isComplete),
    avgScorePct: avgDefined(students.map((s) => s.avgScorePct)),
    avgTimeSec: avg(students.map((s) => s.totalTimeSec)),
    certificatesIssued: students.filter((s) => s.certificateIssued).length,
    classes: classBreakdown(students),
  };
}

export function platformAnalytics() {
  seed();
  const all = [...snapshots.values()];
  const bySchool = new Map<string, StudentSnapshot[]>();
  for (const s of all) {
    if (!bySchool.has(s.schoolId)) bySchool.set(s.schoolId, []);
    bySchool.get(s.schoolId)!.push(s);
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
