// Course IMPORT from a structured JSON source (e.g. server/data/imports/
// demystifying-ai-five-week.json) into the EXISTING Course CMS models — no parallel
// content system. Idempotent and additive:
//   - every imported item carries a stable `importKey` (the source id, e.g. "1.1.6",
//     "week-2-graded", "1.1.6#3" for a question) with a unique index per course, so a
//     re-run finds it instead of creating a duplicate;
//   - on the first run, items that already exist (built by hand in the CMS) are
//     MATCHED — modules by week/title, lessons by topic overlap, topics by normalised
//     title, questions by wording — and only stamped with their importKey;
//   - nothing existing is deleted, renamed (except generic placeholder titles such as
//     "Lesson assignment"), re-ordered, or has its text/media/questions changed;
//   - new topics added to a PUBLISHED module, and every content shell, are created as
//     drafts (Topic.isPublished = false); new assessments are always unpublished — so
//     students' sequence/progress is unaffected until an admin reviews and publishes;
//   - content absent from the source is never invented: such items become shells with
//     contentStatus "needs_content" and an admin-only note.
// `dryRun` performs every lookup and reports the planned changes without writing.

import { Course } from "../models/Course";
import { Module } from "../models/Module";
import { Lesson } from "../models/Lesson";
import { Topic, type TopicContentType } from "../models/Topic";
import { Assessment, MODULE_KIND } from "../models/Assessment";
import { Question } from "../models/Question";
import { ensureSections } from "../services/section.service";
import { ensureDiscussionThread } from "../services/forum.service";
import { slugify } from "../services/course.service";

// ── Source format ────────────────────────────────────────────────────────────
type Letter = string;
export interface SourceQuestion {
  question: string;
  options: Record<Letter, string>;
  correct_answer: Letter | null;
  feedback: string | null;
}
export interface SourceAssignment {
  id: string;
  title: string;
  type: string; // quiz | discussion | practical_scenario | guided_activity | applied_activity | project_proposal | project | reflection
  grading?: string;
  attempts?: number | "unlimited";
  duration_minutes?: number;
  marks?: number;
  question_count?: number | string;
  questions?: SourceQuestion[];
  requirements?: string;
  prompt?: string;
  notes?: string;
  weight?: string;
  source_status?: string;
  highest_score_retained?: boolean;
  negative_marking?: boolean;
}
export interface SourceModule {
  id: string;
  week: number;
  title: string;
  planned_title?: string;
  learning_outcome?: string;
  source_status?: string;
  lessons: { id: string; title: string; content_items: string[] }[];
  assignments: SourceAssignment[];
}
export interface SourceCourse {
  course: {
    title: string;
    source_document?: string;
    target_group?: string;
    planned_duration?: string;
    delivery?: string;
    platform_structure?: Record<string, string>;
    assessment_weights?: Record<string, string>;
    source_notes?: string[];
  };
  modules: SourceModule[];
  planned_module_overview?: { module: number; title: string; q3_self_assessment?: string; discussion?: string }[];
}

export interface ImportOptions {
  /** Course to import into (default: match by importKey, then by slug of the title). */
  courseSlug?: string;
  /** Stable key for the course itself. */
  courseKey: string;
  /** User id recorded as creator of new content (a platform admin). */
  createdBy: string;
  authorName?: string;
  dryRun?: boolean;
}

export interface ImportReport {
  dryRun: boolean;
  courseId: string | null;
  created: Record<string, number>;
  matched: Record<string, number>;
  /** Human-readable log of every change (or planned change). */
  actions: string[];
  /** Items left as "needs content" shells (admin follow-up). */
  needsContent: string[];
  /** Source/platform observations worth an admin's attention. */
  warnings: string[];
}

// ── Matching helpers ─────────────────────────────────────────────────────────
const PREFIXES =
  /^(lesson\s*\d+\s*[:.-]?|week\s*\d+\s*[:.-]?|module\s*\d+\s*[:.-]?|essential reading\s*:|recommended reading\s*:|guided discussion\s*:|practice assignment\s*:|practical scenario\s*:|demonstration\s*:)\s*/i;
const ID_PREFIX = /^(\d+(?:\.\d+)+)\s+/;

export function normalize(s: string): string {
  let t = s
    .normalize("NFKD")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .trim()
    .replace(ID_PREFIX, "");
  for (let i = 0; i < 3; i++) t = t.replace(PREFIXES, "");
  return t
    .toLowerCase()
    .replace(/\bartificial intelligence\b/g, "ai") // "What is AI" ≡ "What is Artificial Intelligence"
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
const tokens = (s: string) => new Set(normalize(s).split(" ").filter((w) => w.length > 1));
function jaccard(a: string, b: string): number {
  const x = tokens(a);
  const y = tokens(b);
  if (!x.size || !y.size) return 0;
  let inter = 0;
  for (const w of x) if (y.has(w)) inter++;
  return inter / (x.size + y.size - inter);
}
export function sameTitle(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (Math.min(na.length, nb.length) >= 12 && (na.includes(nb) || nb.includes(na))) return true;
  return jaccard(a, b) >= 0.75;
}
/** Question wording match: one contains the other (hand-entered copies often add a
 *  heading such as "Does automatic mean AI?"), or near-identical tokens. */
export function sameQuestion(existing: string, source: string): boolean {
  const ne = normalize(existing);
  const ns = normalize(source);
  if (!ne || !ns) return false;
  if (ne === ns || ne.includes(ns) || (ns.length >= 40 && ns.includes(ne))) return true;
  return jaccard(existing, source) >= 0.85;
}
const GENERIC_ASSESSMENT_TITLES = new Set(["lesson assignment", "module quiz", "module assessment", "assignment", "quiz"]);

/** "40%" → 40 */
const percent = (s: string) => Number(String(s).replace(/[^0-9.]/g, "")) || 0;

const WEEKLY_QUIZZES = (w: Record<string, string>) => Object.keys(w).find((k) => /weekly quizzes/i.test(k)) ?? "";
const APPLIED = (w: Record<string, string>) => Object.keys(w).find((k) => /applied activit/i.test(k)) ?? "";
const PROJECT = (w: Record<string, string>) => Object.keys(w).find((k) => /final project/i.test(k)) ?? "";
const DISCUSSION = (w: Record<string, string>) => Object.keys(w).find((k) => /discussion/i.test(k)) ?? "";

const ACTIVITY_TYPES = new Set(["practical_scenario", "guided_activity", "applied_activity", "project_proposal", "project"]);

// ── Import ───────────────────────────────────────────────────────────────────
export async function importCourse(src: SourceCourse, opts: ImportOptions): Promise<ImportReport> {
  const dry = !!opts.dryRun;
  const report: ImportReport = { dryRun: dry, courseId: null, created: {}, matched: {}, actions: [], needsContent: [], warnings: [] };
  const bump = (bucket: Record<string, number>, k: string) => (bucket[k] = (bucket[k] ?? 0) + 1);
  const log = (s: string) => report.actions.push(`${dry ? "[dry-run] " : ""}${s}`);
  let fakeSeq = 0;
  const fakeId = () => `dry-run-${++fakeSeq}`;
  const weights = src.course.assessment_weights ?? {};
  // Existing topics already matched in this run (so a dry run claims them exactly like
  // a real run, where the stamped importKey would exclude them).
  const claimedTopics = new Set<string>();
  const author = { id: opts.createdBy, name: opts.authorName ?? "Course team", role: "platform_admin" as const };

  // ── Course ──
  let course =
    (await Course.findOne({ importKey: opts.courseKey, deletedAt: null })) ??
    (await Course.findOne({ slug: slugify(opts.courseSlug ?? src.course.title), deletedAt: null }));
  let courseId: string;
  if (!course) {
    courseId = dry ? fakeId() : "";
    log(`create course "${src.course.title}" (draft)`);
    bump(report.created, "courses");
    if (!dry) {
      course = await Course.create({
        title: src.course.title,
        slug: slugify(opts.courseSlug ?? src.course.title),
        status: "draft",
        createdBy: opts.createdBy,
        importKey: opts.courseKey,
      });
      courseId = String(course._id);
      await ensureSections(courseId);
    }
  } else {
    courseId = String(course._id);
    bump(report.matched, "courses");
  }
  report.courseId = dry && !course ? null : courseId;

  if (course) {
    const patch: Record<string, unknown> = {};
    if (!course.importKey) patch.importKey = opts.courseKey;
    if (!(course.gradingWeights ?? []).length && Object.keys(weights).length) {
      patch.gradingWeights = Object.entries(weights).map(([category, w]) => ({ category, weight: percent(w) }));
    }
    if (!course.adminNote) patch.adminNote = courseNote(src);
    if (Object.keys(patch).length) {
      log(`course: set ${Object.keys(patch).join(", ")}`);
      if (!dry) {
        course.set(patch);
        await course.save();
      }
    }
  }
  for (const n of src.course.source_notes ?? []) report.warnings.push(`Source note: ${n}`);

  // ── Modules ──
  const existingModules = course && !dry ? await Module.find({ courseId }).sort({ order: 1, createdAt: 1 }) : course ? await Module.find({ courseId }).sort({ order: 1, createdAt: 1 }) : [];
  const usedModuleIds = new Set<string>();
  for (const sm of src.modules) {
    let mod =
      existingModules.find((m) => m.importKey === sm.id) ??
      existingModules.find(
        (m) =>
          !usedModuleIds.has(String(m._id)) &&
          (new RegExp(`^\\s*week\\s*${sm.week}\\b`, "i").test(m.title) || sameTitle(m.title, sm.title) || (!!sm.planned_title && sameTitle(m.title, sm.planned_title))),
      );
    let moduleId: string;
    const modulePublished = !!mod?.isPublished;
    if (!mod) {
      log(`create module "${sm.title}" (draft)`);
      bump(report.created, "modules");
      moduleId = fakeId();
      if (!dry) {
        const last = await Module.findOne({ courseId }).sort({ order: -1 });
        mod = await Module.create({
          courseId,
          title: sm.title,
          description: "",
          learningObjectives: sm.learning_outcome ? [sm.learning_outcome] : [],
          order: last ? (last.order ?? 0) + 1 : 0,
          isPublished: false,
          importKey: sm.id,
          contentStatus: sm.source_status ? "needs_content" : "complete",
          adminNote: moduleNote(sm),
        });
        moduleId = String(mod._id);
      }
      report.needsContent.push(`Module "${sm.title}": needs a module description before it can be published${sm.source_status ? ` (source: ${sm.source_status})` : ""}.`);
    } else {
      moduleId = String(mod._id);
      usedModuleIds.add(moduleId);
      bump(report.matched, "modules");
      const patch: Record<string, unknown> = {};
      if (!mod.importKey) patch.importKey = sm.id;
      if (!(mod.learningObjectives ?? []).length && sm.learning_outcome) patch.learningObjectives = [sm.learning_outcome];
      if (!mod.adminNote) patch.adminNote = moduleNote(sm);
      if (Object.keys(patch).length) {
        log(`module "${mod.title}" ← ${sm.id}: set ${Object.keys(patch).join(", ")}`);
        if (!dry) {
          mod.set(patch);
          await mod.save();
        }
      }
      if (mod.title !== sm.title && !new RegExp(`${escapeRx(sm.title)}`, "i").test(mod.title)) {
        report.warnings.push(`Module ${sm.id}: live title "${mod.title}" differs from source "${sm.title}" (kept).`);
      }
      if (!mod.description?.trim()) report.needsContent.push(`Module "${mod.title}": needs a module description before it can be published.`);
    }

    // ── Lessons ──
    const liveLessons = mod && !String(moduleId).startsWith("dry-run") ? await Lesson.find({ moduleId }).sort({ order: 1, createdAt: 1 }) : [];
    const liveTopics = liveLessons.length ? await Topic.find({ moduleId }).sort({ order: 1, createdAt: 1 }) : [];
    const usedLessonIds = new Set<string>();
    const usedTopicsInModule = new Set<string>(); // topics matched anywhere in this module
    const assignmentsById = new Map(sm.assignments.map((a) => [a.id, a]));
    const placed = new Set<string>(); // assignment ids positioned via content items
    let lastLessonId: string | null = null;
    let lastLessonPublishedModule = modulePublished;

    for (const sl of sm.lessons) {
      // Match: importKey → most content-item title matches among topics → title.
      let lesson = liveLessons.find((l) => l.importKey === sl.id) ?? null;
      if (!lesson) {
        let best: { l: (typeof liveLessons)[number]; n: number } | null = null;
        for (const l of liveLessons) {
          if (usedLessonIds.has(String(l._id))) continue;
          const ts = liveTopics.filter((t) => t.lessonId === String(l._id));
          const n = sl.content_items.filter((ci) => ts.some((t) => sameTitle(t.title, ci))).length;
          if (n > 0 && (!best || n > best.n)) best = { l, n };
        }
        lesson = best && best.n >= Math.min(2, sl.content_items.length) ? best.l : (liveLessons.find((l) => !usedLessonIds.has(String(l._id)) && sameTitle(l.title, sl.title)) ?? null);
      }
      let lessonId: string;
      if (!lesson) {
        log(`  create lesson "${sl.title}" in ${sm.id}`);
        bump(report.created, "lessons");
        lessonId = fakeId();
        if (!dry && !moduleId.startsWith("dry-run")) {
          const last = await Lesson.findOne({ moduleId }).sort({ order: -1 });
          lesson = await Lesson.create({ moduleId, courseId, title: sl.title, description: "", order: last ? (last.order ?? 0) + 1 : 0, importKey: sl.id });
          lessonId = String(lesson._id);
        }
      } else {
        lessonId = String(lesson._id);
        usedLessonIds.add(lessonId);
        bump(report.matched, "lessons");
        if (!lesson.importKey) {
          log(`  lesson "${lesson.title}" ← ${sl.id}`);
          if (!dry) {
            lesson.importKey = sl.id;
            await lesson.save();
          }
        }
        if (!sameTitle(lesson.title, sl.title)) report.warnings.push(`Lesson ${sl.id}: live title "${lesson.title}" differs from source "${sl.title}" (kept).`);
      }
      lastLessonId = lessonId;
      lastLessonPublishedModule = modulePublished;

      // ── Lesson items, in source order ──
      const lessonTopics = liveTopics.filter((t) => t.lessonId === lessonId);
      const lessonAssignments = !lessonId.startsWith("dry-run") ? await Assessment.find({ lessonId, kind: "lesson" }).sort({ order: 1, createdAt: 1 }) : [];
      type Plan = { key: string; text: string; assignment?: SourceAssignment; existingPos: number | null; apply: (pos: number) => Promise<void> };
      const plans: Plan[] = [];
      const usedTopicIds = new Set<string>();
      const usedAssessIds = new Set<string>();

      sl.content_items.forEach((raw, idx) => {
        const m = ID_PREFIX.exec(raw);
        const key = m ? m[1] : `${sl.id}.${idx + 1}`;
        const text = m ? raw.slice(m[0].length) : raw;
        const sa = assignmentsById.get(key);
        // The module's graded quiz listed as a lesson item → the module assessment (below).
        if (!sa && /\(graded\)/i.test(text)) {
          const graded = sm.assignments.find((a) => /graded$/.test(a.id) && a.type === "quiz");
          if (graded) {
            placed.add(`listed:${graded.id}`);
            return;
          }
        }
        if (sa) placed.add(sa.id);

        if (sa?.type === "quiz" || sa?.type === "reflection") {
          // Lesson assignment at this position.
          const existing =
            lessonAssignments.find((a) => a.importKey === sa.id) ??
            null;
          plans.push({
            key,
            text,
            assignment: sa,
            existingPos: existing && typeof existing.order === "number" ? existing.order : null,
            apply: async (pos) => {
              await upsertAssessment({ sa, kind: "lesson", moduleId, lessonId, pos, candidates: lessonAssignments, used: usedAssessIds });
            },
          });
          return;
        }
        // Topic (content, discussion or activity): this lesson first, then anywhere in
        // the module (e.g. a "Week Summary" kept in its own lesson) — matched, not moved.
        const title = sa?.title ?? text;
        // A topic already claimed by ANOTHER import key never matches (no cross-matching).
        const free = (t: (typeof liveTopics)[number]) =>
          !usedTopicIds.has(String(t._id)) &&
          !usedTopicsInModule.has(String(t._id)) &&
          !claimedTopics.has(String(t._id)) &&
          (!t.importKey || t.importKey === key);
        const inLesson = lessonTopics.find((t) => t.importKey === key) ?? lessonTopics.find((t) => free(t) && sameTitle(t.title, title));
        const elsewhere = inLesson ? null : (liveTopics.find((t) => t.importKey === key) ?? liveTopics.find((t) => free(t) && sameTitle(t.title, title)));
        const existing = inLesson ?? elsewhere ?? null;
        if (existing) {
          usedTopicIds.add(String(existing._id));
          usedTopicsInModule.add(String(existing._id));
        }
        plans.push({
          key,
          text,
          assignment: sa,
          // A match in another lesson doesn't occupy a position in this one.
          existingPos: inLesson ? (inLesson.order ?? 0) : null,
          apply: async (pos) => {
            await upsertTopic({ key, title: sa ? sa.title : text, sa, moduleId, lessonId, pos, existing, modulePublished });
          },
        });
      });
      // Pre-match lesson assignments by question overlap so positions are known.
      for (const p of plans) {
        if (!p.assignment || (p.assignment.type !== "quiz" && p.assignment.type !== "reflection")) continue;
        const match = matchAssessment(p.assignment, lessonAssignments, usedAssessIds, await questionsOf(lessonAssignments));
        if (match) {
          usedAssessIds.add(String(match._id));
          p.existingPos = typeof match.order === "number" ? match.order : null;
        }
      }
      usedAssessIds.clear(); // re-resolved inside upsertAssessment

      // Positions: keep existing items where they are; place new ones between their
      // neighbours in source order (fractional positions, nothing is renumbered).
      const positions = placePositions(plans.map((p) => p.existingPos));
      for (let i = 0; i < plans.length; i++) await plans[i].apply(positions[i]);
    }

    // ── Module-level items not listed in any lesson ──
    for (const sa of sm.assignments) {
      if (placed.has(sa.id)) continue;
      const isModuleQuiz = sa.type === "quiz" && (/graded$/.test(sa.id) || placed.has(`listed:${sa.id}`) || (sa.grading === "graded" && !sm.assignments.some((x) => /graded$/.test(x.id))));
      if (isModuleQuiz) {
        const candidates = moduleId.startsWith("dry-run") ? [] : await Assessment.find({ moduleId, ...MODULE_KIND });
        await upsertAssessment({ sa, kind: "module", moduleId, lessonId: null, pos: null, candidates, used: new Set() });
        continue;
      }
      // Activities, discussions, reflections → end of the module's last source lesson.
      if (!lastLessonId) {
        report.warnings.push(`${sa.id}: no lesson to place it in (skipped).`);
        continue;
      }
      const lessonId = lastLessonId;
      if (sa.type === "quiz" || sa.type === "reflection") {
        const candidates = lessonId.startsWith("dry-run") ? [] : await Assessment.find({ lessonId, kind: "lesson" });
        await upsertAssessment({ sa, kind: "lesson", moduleId, lessonId, pos: await endPosition(lessonId), candidates, used: new Set() });
      } else {
        const lessonTopics = lessonId.startsWith("dry-run") ? [] : await Topic.find({ lessonId });
        const existing =
          lessonTopics.find((t) => t.importKey === sa.id) ??
          lessonTopics.find((t) => !t.importKey && !claimedTopics.has(String(t._id)) && sameTitle(t.title, sa.title)) ??
          null;
        await upsertTopic({ key: sa.id, title: sa.title, sa, moduleId, lessonId, pos: existing ? (existing.order ?? 0) : await endPosition(lessonId), existing, modulePublished: lastLessonPublishedModule });
      }
    }
  }

  // Planned-overview items that differ from the detailed modules are reported, not imported.
  for (const p of src.planned_module_overview ?? []) {
    const sm = src.modules.find((m) => m.week === p.module);
    if (sm && p.title !== sm.title && p.title !== sm.planned_title) report.warnings.push(`Planned module ${p.module} title "${p.title}" differs from detailed module "${sm.title}".`);
    if (p.discussion && sm && !sm.assignments.some((a) => a.type === "discussion" && a.prompt === p.discussion) && !sm.assignments.some((a) => a.requirements === p.discussion)) {
      report.warnings.push(`Planned module ${p.module} discussion "${p.discussion}" is not in the detailed module content (not imported).`);
    }
  }
  return report;

  // ── helpers (closures over report/dry/course) ──
  async function endPosition(lessonId: string): Promise<number> {
    if (lessonId.startsWith("dry-run")) return 0;
    const [t, a] = await Promise.all([
      Topic.findOne({ lessonId }).sort({ order: -1 }).select("order").lean(),
      Assessment.findOne({ lessonId, kind: "lesson", order: { $type: "number" } }).sort({ order: -1 }).select("order").lean(),
    ]);
    return Math.max(t?.order ?? -1, typeof a?.order === "number" ? a.order : -1) + 1;
  }

  async function upsertTopic(args: {
    key: string;
    title: string;
    sa?: SourceAssignment;
    moduleId: string;
    lessonId: string;
    pos: number;
    existing: InstanceType<typeof Topic> | null;
    modulePublished: boolean;
  }): Promise<void> {
    const { key, title, sa, moduleId, lessonId, pos, existing, modulePublished } = args;
    const isDiscussion = sa?.type === "discussion";
    const isActivity = !!sa && ACTIVITY_TYPES.has(sa.type);
    const gradeCategory = sa ? categoryFor(sa) : "";
    if (existing) {
      claimedTopics.add(String(existing._id));
      bump(report.matched, "topics");
      const patch: Record<string, unknown> = {};
      if (!existing.importKey) patch.importKey = key;
      if (gradeCategory && !existing.gradeCategory) patch.gradeCategory = gradeCategory;
      if (Object.keys(patch).length) {
        log(`    topic "${existing.title}" ← ${key}`);
        if (!dry) {
          existing.set(patch);
          await existing.save();
        }
      }
      return;
    }
    // New topic.
    let contentType: TopicContentType = "rich_text";
    let content = "";
    let contentStatus: "complete" | "needs_content" = "complete";
    let adminNote = "";
    const discussion = isDiscussion
      ? { prompt: sa!.prompt ?? "", instructions: sa!.requirements ?? "", questions: [] as string[], relatedTopicId: null, required: false }
      : undefined;
    if (isDiscussion) {
      contentType = "discussion";
      adminNote = [sa!.notes ? `Facilitator note (source): ${sa!.notes}` : "", sa!.grading ? `Grading (source): ${sa!.grading}` : ""].filter(Boolean).join("\n");
    } else if (isActivity) {
      contentType = "activity";
      content = sa!.requirements ?? "";
      const graded = sa!.grading === "graded" || sa!.grading === "applied";
      if (graded) {
        contentStatus = "needs_content";
        adminNote = `Graded ${sa!.type.replace("_", " ")} (${gradeCategory || "uncategorised"}${sa!.weight ? `, ${sa!.weight}` : ""}): students must submit work, which the platform does not support yet. Imported as instructions only.`;
        report.needsContent.push(`${key} "${title}": graded ${sa!.type.replace("_", " ")} — needs a submission feature (instructions imported).`);
      }
      if (!content) {
        contentStatus = "needs_content";
        adminNote = `${adminNote}\nNo requirements text in the source.`.trim();
      }
    } else {
      // A lesson content item: the source lists its title only.
      contentType = /reading|summary|guide|checklist|worksheet/i.test(title) ? "rich_text" : "video";
      contentStatus = "needs_content";
      adminNote = "Imported from the course plan: title only — add the lesson body/media.";
      report.needsContent.push(`${key} "${title}": topic body/media not in the source.`);
    }
    // Shells and anything new in a live (published) module start as drafts.
    const isPublished = contentStatus === "complete" && !modulePublished;
    log(`    create ${contentType} topic ${key} "${title}"${isPublished ? "" : " (draft)"} at position ${pos}`);
    bump(report.created, "topics");
    if (dry || lessonId.startsWith("dry-run")) return;
    const doc = await Topic.create({
      lessonId,
      moduleId,
      courseId,
      title,
      description: "",
      order: pos,
      contentType,
      content,
      estimatedDurationMinutes: sa?.duration_minutes ?? 0,
      discussion,
      isPublished,
      gradeCategory,
      contentStatus,
      adminNote,
      importKey: key,
    });
    if (isDiscussion) {
      await ensureDiscussionThread(
        {
          id: String(doc._id),
          courseId,
          moduleId,
          title,
          description: "",
          discussion: { prompt: discussion!.prompt },
        },
        author,
      );
    }
  }

  async function upsertAssessment(args: {
    sa: SourceAssignment;
    kind: "lesson" | "module";
    moduleId: string;
    lessonId: string | null;
    pos: number | null;
    candidates: InstanceType<typeof Assessment>[];
    used: Set<string>;
  }): Promise<void> {
    const { sa, kind, moduleId, lessonId, pos, candidates, used } = args;
    const questions = sa.questions ?? [];
    const missingKeys = questions.filter((q) => !q.correct_answer).length;
    const shell = questions.length === 0;
    const gradeCategory = categoryFor(sa);
    const isGraded = sa.grading === "graded";
    const config = {
      isGraded,
      maxAttempts: typeof sa.attempts === "number" ? sa.attempts : 0,
      estimatedDurationMinutes: sa.duration_minutes ?? 0,
      gradeCategory,
    };
    const notes = [
      shell ? `Question bank not in the source${sa.question_count !== undefined ? ` (expected: ${sa.question_count} questions)` : ""}.` : "",
      sa.source_status ? `Source status: ${sa.source_status}` : "",
      missingKeys ? `Answer key missing for ${missingKeys} of ${questions.length} questions (correct_answer is null in the source) — add them before publishing.` : "",
      sa.duration_minutes ? `Source duration: ${sa.duration_minutes} min (imported as the estimated time; no timer set).` : "",
      sa.marks !== undefined ? `Source marks: ${sa.marks}.` : "",
      sa.highest_score_retained ? "Source: highest score retained (platform keeps the best score)." : "",
      sa.negative_marking === false ? "Source: no negative marking." : "",
      sa.weight ? `Weight: ${sa.weight}.` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const needsContent = shell || missingKeys > 0;
    if (needsContent) report.needsContent.push(`${sa.id} "${sa.title}": ${shell ? "question bank not in the source" : `answer key missing for ${missingKeys} questions`}.`);

    const existingQuestions = await questionsOf(candidates);
    // A module has ONE assessment slot: an existing module assessment IS the module's
    // graded quiz (its own questions are kept; missing source questions are added).
    let doc =
      candidates.find((a) => a.importKey === sa.id) ??
      (kind === "module" ? (candidates.find((a) => !a.importKey) ?? null) : matchAssessment(sa, candidates, used, existingQuestions));
    if (doc) {
      used.add(String(doc._id));
      bump(report.matched, kind === "module" ? "module assessments" : "lesson assignments");
      const patch: Record<string, unknown> = {};
      if (!doc.importKey) patch.importKey = sa.id;
      if (GENERIC_ASSESSMENT_TITLES.has(doc.title.trim().toLowerCase())) patch.title = sa.title;
      if (kind === "lesson" && typeof doc.order !== "number" && pos !== null) patch.order = pos;
      if (!doc.gradeCategory && gradeCategory) patch.gradeCategory = gradeCategory;
      if (sa.duration_minutes && !doc.estimatedDurationMinutes) patch.estimatedDurationMinutes = sa.duration_minutes;
      if (typeof sa.attempts === "number" && !doc.maxAttempts) patch.maxAttempts = sa.attempts;
      if (doc.isGraded !== isGraded && !doc.isPublished) patch.isGraded = isGraded;
      if (!doc.adminNote && notes) patch.adminNote = notes;
      if (needsContent && doc.contentStatus !== "needs_content") patch.contentStatus = "needs_content";
      if (Object.keys(patch).length) {
        log(`  ${kind} assessment "${doc.title}" ← ${sa.id}: set ${Object.keys(patch).join(", ")}`);
        if (!dry) {
          doc.set(patch);
          await doc.save();
        }
      }
    } else {
      log(`  create ${kind === "module" ? "module assessment" : "lesson assignment"} ${sa.id} "${sa.title}" (unpublished${shell ? ", shell" : ""})`);
      bump(report.created, kind === "module" ? "module assessments" : "lesson assignments");
      if (dry || moduleId.startsWith("dry-run") || (lessonId && lessonId.startsWith("dry-run"))) {
        for (const _q of questions) bump(report.created, "questions");
        return;
      }
      doc = await Assessment.create({
        kind,
        moduleId,
        lessonId,
        courseId,
        title: sa.title,
        description: "",
        instructions: sa.requirements ?? "",
        ...config,
        order: kind === "lesson" ? pos : null,
        isPublished: false,
        importKey: sa.id,
        contentStatus: needsContent ? "needs_content" : "complete",
        adminNote: notes,
      });
    }
    await upsertQuestions(sa, String(doc._id), existingQuestions.get(String(doc._id)) ?? []);
  }

  async function upsertQuestions(sa: SourceAssignment, assessmentId: string, existing: InstanceType<typeof Question>[]): Promise<void> {
    const questions = sa.questions ?? [];
    const marksEach = sa.marks && questions.length ? sa.marks / questions.length : 1;
    if (sa.marks && questions.length && !Number.isInteger(marksEach)) report.warnings.push(`${sa.id}: ${sa.marks} marks over ${questions.length} questions is not a whole number per question (${marksEach}).`);
    let nextOrder = existing.reduce((m, q) => Math.max(m, q.order ?? 0), -1) + 1;
    const used = new Set<string>();
    for (let i = 0; i < questions.length; i++) {
      const sq = questions[i];
      const key = `${sa.id}#${i + 1}`;
      const match = existing.find((q) => q.importKey === key) ?? existing.find((q) => !used.has(String(q._id)) && !q.importKey && sameQuestion(q.question, sq.question));
      if (match) {
        used.add(String(match._id));
        bump(report.matched, "questions");
        if (!match.importKey) {
          log(`    question ${key} matched existing "${match.question.slice(0, 50)}…"`);
          if (!dry) {
            match.importKey = key;
            await match.save();
          }
        }
        continue;
      }
      const letters = Object.keys(sq.options).sort();
      const options = letters.map((l) => sq.options[l]);
      const correct = sq.correct_answer ? (sq.options[sq.correct_answer] ?? "") : "";
      if (sq.correct_answer && !correct) report.warnings.push(`${key}: correct answer "${sq.correct_answer}" is not one of the options.`);
      log(`    create question ${key}${correct ? "" : " (no answer key in source)"}`);
      bump(report.created, "questions");
      if (dry) continue;
      await Question.create({
        assessmentId,
        courseId,
        type: "mcq",
        question: sq.question,
        options,
        correctAnswer: correct,
        explanation: sq.feedback ?? "",
        marks: marksEach,
        order: nextOrder++,
        importKey: key,
      });
    }
  }

  function categoryFor(sa: SourceAssignment): string {
    if (sa.type === "quiz" && sa.grading === "graded" && /^week-[1-4]-graded$/.test(sa.id)) return WEEKLY_QUIZZES(weights);
    if (sa.grading === "applied") return APPLIED(weights);
    if (sa.type === "project") return PROJECT(weights);
    if (sa.grading && /discussion participation/i.test(sa.grading)) return DISCUSSION(weights);
    return "";
  }
}

// Match an existing assessment to a source quiz: importKey → question overlap (≥2 or
// all) → title → an empty generic placeholder ("Lesson assignment").
function matchAssessment(
  sa: SourceAssignment,
  candidates: InstanceType<typeof Assessment>[],
  used: Set<string>,
  questions: Map<string, InstanceType<typeof Question>[]>,
): InstanceType<typeof Assessment> | null {
  const free = candidates.filter((a) => !used.has(String(a._id)));
  const byKey = free.find((a) => a.importKey === sa.id);
  if (byKey) return byKey;
  const unkeyed = free.filter((a) => !a.importKey);
  const sq = sa.questions ?? [];
  let best: { a: InstanceType<typeof Assessment>; n: number; all: boolean } | null = null;
  for (const a of unkeyed) {
    const qs = questions.get(String(a._id)) ?? [];
    const n = sq.filter((s) => qs.some((q) => sameQuestion(q.question, s.question))).length;
    // Every existing question appears in this source quiz → it's the same quiz.
    const all = qs.length > 0 && qs.every((q) => sq.some((s) => sameQuestion(q.question, s.question)));
    if (n > 0 && (!best || n > best.n)) best = { a, n, all };
  }
  if (best && (best.n >= Math.min(2, sq.length) || best.all)) return best.a;
  const byTitle = unkeyed.find((a) => sameTitle(a.title, sa.title));
  if (byTitle) return byTitle;
  const placeholder = unkeyed.find((a) => GENERIC_ASSESSMENT_TITLES.has(a.title.trim().toLowerCase()) && (questions.get(String(a._id)) ?? []).length === 0);
  return placeholder ?? null;
}

async function questionsOf(assessments: InstanceType<typeof Assessment>[]): Promise<Map<string, InstanceType<typeof Question>[]>> {
  const map = new Map<string, InstanceType<typeof Question>[]>();
  if (!assessments.length) return map;
  const qs = await Question.find({ assessmentId: { $in: assessments.map((a) => String(a._id)) } }).sort({ order: 1, createdAt: 1 });
  for (const q of qs) {
    if (!map.has(q.assessmentId)) map.set(q.assessmentId, []);
    map.get(q.assessmentId)!.push(q);
  }
  return map;
}

/** Positions for items in source order: existing positions are kept; each new item is
 *  placed between the previous and the next existing position (fractions allowed). */
export function placePositions(existing: (number | null)[]): number[] {
  const out: number[] = [];
  let prev = -1;
  for (let i = 0; i < existing.length; i++) {
    const own = existing[i];
    if (own !== null && own > prev) {
      out.push(own);
      prev = own;
      continue;
    }
    if (own !== null) {
      // An existing item sits before an earlier source item: keep it (not re-ordered).
      out.push(own);
      continue;
    }
    // Next existing position after this one (source order).
    let next: number | null = null;
    for (let j = i + 1; j < existing.length; j++) {
      const e = existing[j];
      if (e !== null && e > prev) {
        next = e;
        break;
      }
    }
    // Count consecutive new items until `next`, spread them evenly in (prev, next).
    let run = 1;
    for (let j = i + 1; j < existing.length && existing[j] === null; j++) run++;
    const hi = next ?? prev + run + 1;
    const step = (hi - prev) / (run + 1);
    for (let k = 0; k < run; k++) out.push(Number((prev + step * (k + 1)).toFixed(4)));
    prev = out[out.length - 1];
    i += run - 1;
  }
  return out;
}

function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function moduleNote(sm: SourceModule): string {
  return [
    `Import: ${sm.id} (week ${sm.week}).`,
    sm.planned_title && sm.planned_title !== sm.title ? `Planned title in the course plan: "${sm.planned_title}".` : "",
    sm.learning_outcome ? `Learning outcome (source): ${sm.learning_outcome}` : "",
    sm.source_status ? `Source status: ${sm.source_status}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function courseNote(src: SourceCourse): string {
  const c = src.course;
  return [
    c.source_document ? `Source: ${c.source_document}` : "",
    c.target_group ? `Target group: ${c.target_group}` : "",
    c.planned_duration ? `Planned duration: ${c.planned_duration}` : "",
    c.delivery ? `Delivery: ${c.delivery}` : "",
    c.platform_structure ? `Platform structure: ${Object.entries(c.platform_structure).map(([k, v]) => `${k} ${v}`).join("; ")}` : "",
    ...(c.source_notes ?? []).map((n) => `Source note: ${n}`),
    ...(src.planned_module_overview ?? []).map(
      (p) => `Planned module ${p.module} — ${p.title}. Self-assessment: ${p.q3_self_assessment ?? "—"} Discussion: ${p.discussion ?? "—"}`,
    ),
  ]
    .filter(Boolean)
    .join("\n");
}
