// Seed the demo analytics cohort — ported verbatim from the seed() function in
// src/lib/analytics/analytics.server.ts. Idempotent: upserts each snapshot by
// studentUserId, so re-running leaves the same nine rows.

import { AI_COURSE, flattenTopics } from "../data/curriculum";
import { recordSnapshot } from "../services/analytics.service";
import type { StudentSnapshot } from "../models/AnalyticsSnapshot";

const TOPICS_TOTAL = flattenTopics().length;
const MODULES_TOTAL = AI_COURSE.modules.length;

function moduleScoresFor(passed: number, avg: number): Record<string, number> {
  const m: Record<string, number> = {};
  for (let i = 1; i <= passed; i++) m[`m${i}`] = avg;
  return m;
}

interface SeedRow {
  id: string;
  name: string;
  schoolName: string;
  className: string;
  topics: number;
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
    schoolName: r.schoolName,
    className: r.className,
    topicsCompleted: r.topics,
    topicsTotal: TOPICS_TOTAL,
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

export async function seedAnalyticsCohort(): Promise<void> {
  const D = { schoolName: "Doon Public School" };
  const S = { schoolName: "St. Joseph's Academy" };
  const cohort: SeedRow[] = [
    {
      id: "u-student",
      name: "Aarav Singh",
      ...D,
      className: "10",
      topics: 12,
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
      topics: 28,
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
      topics: 16,
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
      topics: 8,
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
      topics: 32,
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
      topics: 20,
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
      topics: 24,
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
      topics: 32,
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
      topics: 4,
      modules: 1,
      passed: 1,
      avg: 60,
      timeSec: 2000,
      cert: false,
    },
  ];
  for (const r of cohort) {
    await recordSnapshot(fromSeed(r));
  }
}
