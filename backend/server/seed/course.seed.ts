// Course-content standardization seed. Makes "AI for Everyone" the ONE and ONLY
// course on the platform: it soft-deletes every other course, then (idempotently)
// (re)builds the AI-for-Everyone course with 12 published modules — each with a
// 7-section lesson and exactly one assessment (10 MCQ + 5 True/False + 2 scenario).
//
// Run explicitly via `npm run seed` (users + this). It is intentionally NOT wired
// into app startup so test harnesses stay fast and isolated.

import { Course } from "../models/Course";
import { Module } from "../models/Module";
import { Lesson } from "../models/Lesson";
import { Assessment } from "../models/Assessment";
import { Question } from "../models/Question";
import {
  AI_COURSE_META,
  AI_FOR_EVERYONE_MODULES,
  type LessonSections,
} from "./ai-course.data";

const SLUG = AI_COURSE_META.slug;

/** Render the seven required sections into a single markdown lesson body. */
function buildLessonMarkdown(s: LessonSections): string {
  const bullets = (items: string[]) => items.map((i) => `- ${i}`).join("\n");
  return [
    `## Overview\n\n${s.overview}`,
    `## Key Concepts\n\n${bullets(s.keyConcepts)}`,
    `## Use Cases\n\n${bullets(s.useCases)}`,
    `## Best Practices\n\n${bullets(s.bestPractices)}`,
    `## Recent Developments\n\n${bullets(s.recentDevelopments)}`,
    `## Chapter Takeaways\n\n${bullets(s.takeaways)}`,
    `## Suggested Learning Activities\n\n${bullets(s.activities)}`,
  ].join("\n\n");
}

export interface SeedCourseResult {
  courseId: string;
  slug: string;
  modules: number;
  archivedOthers: number;
}

/**
 * Standardize the platform to a single published "AI for Everyone" course.
 * @param createdBy user id recorded as the course creator (defaults to the seeded admin).
 */
export async function seedAiCourse(createdBy = "u-platform-admin"): Promise<SeedCourseResult> {
  // 1. Soft-delete (remove from every surface) every OTHER course.
  const archived = await Course.updateMany(
    { slug: { $ne: SLUG }, deletedAt: null },
    { $set: { status: "archived", deletedAt: new Date() } },
  );

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
  await Lesson.deleteMany({ courseId });
  await Question.deleteMany({ courseId });
  await Assessment.deleteMany({ courseId });
  await Module.deleteMany({ courseId });

  // 4. Rebuild the 12 modules, each with a lesson + one assessment.
  let moduleOrder = 0;
  for (const m of AI_FOR_EVERYONE_MODULES) {
    const module = await Module.create({
      courseId,
      title: m.title,
      description: m.description,
      order: moduleOrder++,
      isPublished: true,
      estimatedDurationMinutes: 45,
    });
    const moduleId = String(module._id);

    await Lesson.create({
      moduleId,
      courseId,
      title: m.lessonTitle,
      description: m.description,
      order: 0,
      contentType: "rich_text",
      content: buildLessonMarkdown(m.sections),
      isPreview: false,
      estimatedDurationMinutes: 30,
    });

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
