// Course-content standardization seed. Makes "Demystifying AI for Everyone" the ONE and ONLY
// course on the platform: it soft-deletes every other course (unless
// `archiveOthers: false`), then (idempotently) (re)builds the AI-for-Everyone course with 12 published modules — each with a
// lesson of 7 topics and exactly one assessment (10 MCQ + 5 True/False + 2 scenario).
//
// Run explicitly via `npm run seed` (users + this), or `npm run seed:flagship` to
// (re)build only this course and leave every other course untouched. It is
// intentionally NOT wired
// into app startup so test harnesses stay fast and isolated.

import { Course } from "../models/Course";
import { Module } from "../models/Module";
import { Lesson } from "../models/Lesson";
import { Topic } from "../models/Topic";
import { updateSection } from "../services/section.service";
import { Assessment } from "../models/Assessment";
import { Question } from "../models/Question";
import {
  AI_COURSE_META,
  AI_FOR_EVERYONE_MODULES,
  MODULE_LEARNING_OBJECTIVES,
  type LessonSections,
} from "./ai-course.data";
import { renameFlagshipSlug } from "../migrations/rename-course-slug";

const SLUG = AI_COURSE_META.slug;

/** A chapter's seven sections → seven topics (title + markdown body). */
function chapterTopics(s: LessonSections): { title: string; content: string }[] {
  const bullets = (items: string[]) => items.map((i) => `- ${i}`).join("\n");
  return [
    { title: "Overview", content: s.overview },
    { title: "Key Concepts", content: bullets(s.keyConcepts) },
    { title: "Use Cases", content: bullets(s.useCases) },
    { title: "Best Practices", content: bullets(s.bestPractices) },
    { title: "Recent Developments", content: bullets(s.recentDevelopments) },
    { title: "Chapter Takeaways", content: bullets(s.takeaways) },
    { title: "Suggested Learning Activities", content: bullets(s.activities) },
  ];
}

export interface SeedCourseResult {
  courseId: string;
  slug: string;
  modules: number;
  archivedOthers: number;
}

export interface SeedCourseOptions {
  /** User id recorded as the course creator (defaults to the seeded admin). */
  createdBy?: string;
  /** Soft-delete every other course (default true). False leaves them untouched. */
  archiveOthers?: boolean;
}

/** Standardize the platform to a single published "Demystifying AI for Everyone" course. */
export async function seedAiCourse({
  createdBy = "u-platform-admin",
  archiveOthers = true,
}: SeedCourseOptions = {}): Promise<SeedCourseResult> {
  // 0. A database still on the old slug: rename that course in place first, so it
  //    is updated below instead of being archived and replaced by a copy.
  await renameFlagshipSlug();

  // 1. Soft-delete (remove from every surface) every OTHER course.
  const archived = archiveOthers
    ? await Course.updateMany(
        { slug: { $ne: SLUG }, deletedAt: null },
        { $set: { status: "archived", deletedAt: new Date() } },
      )
    : { modifiedCount: 0 };

  // 2. Upsert the AI-for-Everyone course as published.
  const courseFields = {
    title: AI_COURSE_META.title,
    instructor: AI_COURSE_META.instructor,
    shortDescription: AI_COURSE_META.shortDescription,
    description: AI_COURSE_META.description,
    level: AI_COURSE_META.level,
    tags: AI_COURSE_META.tags,
    status: "published" as const,
    deletedAt: null,
  };
  let course = await Course.findOne({ slug: SLUG });
  if (!course) {
    course = await Course.create({
      slug: SLUG,
      createdBy,
      estimatedDurationMinutes: AI_FOR_EVERYONE_MODULES.length * 45,
      ...courseFields,
    });
  } else {
    course.set(courseFields);
    await course.save();
  }
  const courseId = String(course._id);

  // 3. Wipe this course's existing structure so re-runs are idempotent.
  await Topic.deleteMany({ courseId });
  await Lesson.deleteMany({ courseId });
  await Question.deleteMany({ courseId });
  await Assessment.deleteMany({ courseId });
  await Module.deleteMany({ courseId });

  // 4. Course-level sections, built only from the course's own data.
  await updateSection(courseId, "introduction", {
    title: "Course Introduction",
    contentType: "rich_text",
    content: AI_COURSE_META.description,
  });
  await updateSection(courseId, "overview", {
    title: "Course Overview",
    contentType: "rich_text",
    content: [
      `${AI_COURSE_META.title} has ${AI_FOR_EVERYONE_MODULES.length} modules. Each module has a lesson made up of topics, followed by one module assessment.`,
      "",
      ...AI_FOR_EVERYONE_MODULES.map((m, i) => `${i + 1}. **${m.title}** — ${m.description}`),
      "",
      "Complete every topic and pass every module assessment to earn your Certificate of Completion.",
    ].join("\n"),
  });
  await updateSection(courseId, "instructor", {
    title: "Meet the Instructor",
    contentType: "rich_text",
    content: `**${AI_COURSE_META.instructor}** leads all ${AI_FOR_EVERYONE_MODULES.length} modules of ${AI_COURSE_META.title}.`,
  });

  // 5. Rebuild the 12 modules: one lesson (the chapter) with 7 topics, + one assessment.
  let moduleOrder = 0;
  for (const m of AI_FOR_EVERYONE_MODULES) {
    const module = await Module.create({
      courseId,
      title: m.title,
      description: m.description,
      learningObjectives: MODULE_LEARNING_OBJECTIVES[m.title] ?? [],
      order: moduleOrder++,
      isPublished: true,
      estimatedDurationMinutes: 45,
    });
    const moduleId = String(module._id);

    const lesson = await Lesson.create({
      moduleId,
      courseId,
      title: m.lessonTitle,
      description: m.description,
      order: 0,
    });
    let topicOrder = 0;
    for (const t of chapterTopics(m.sections)) {
      await Topic.create({
        lessonId: String(lesson._id),
        moduleId,
        courseId,
        title: t.title,
        order: topicOrder++,
        contentType: "rich_text",
        content: t.content,
        estimatedDurationMinutes: 4,
      });
    }

    const assessment = await Assessment.create({
      moduleId,
      courseId,
      title: `${m.title} — Assessment`,
      description: "10 MCQs, 5 True/False, and 2 scenario questions from this module.",
      passingScore: 60,
      isPublished: true,
    });
    const assessmentId = String(assessment._id);

    let qOrder = 0;
    // 10 MCQs (4 options each).
    for (const mcq of m.mcqs) {
      await Question.create({
        assessmentId, courseId, type: "mcq", question: mcq.q, options: mcq.options,
        correctAnswer: mcq.answer, explanation: mcq.explanation, marks: 1, order: qOrder++,
      });
    }
    // 5 True/False (stored as MCQ with True/False options).
    for (const tf of m.tfs) {
      await Question.create({
        assessmentId, courseId, type: "mcq", question: tf.q, options: ["True", "False"],
        correctAnswer: tf.answer ? "True" : "False", explanation: tf.explanation, marks: 1, order: qOrder++,
      });
    }
    // 2 Scenario questions (open-ended).
    for (const sc of m.scenarios) {
      await Question.create({
        assessmentId, courseId, type: "scenario", question: sc.q, options: [],
        correctAnswer: "", explanation: sc.guidance, marks: 2, order: qOrder++,
      });
    }
  }

  return {
    courseId,
    slug: SLUG,
    modules: AI_FOR_EVERYONE_MODULES.length,
    archivedOthers: archived.modifiedCount ?? 0,
  };
}
