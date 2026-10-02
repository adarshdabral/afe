// One-time data migration for the Course → Module → Lesson → Topic restructure.
// Runs at every backend start (ensureServerReady) and is idempotent + crash-safe:
//
// 1. Old "lesson" documents (the CONTENT units, recognisable by `contentType`) in
//    the `lessons` collection become TOPICS in `topics` — keeping the same _id, so
//    every student's completed-progress references stay valid. Each module gets one
//    container LESSON holding its former lessons as topics, in their old order. The
//    container takes the old lesson's name when the module had just one, else
//    "Lesson 1". The container is found/created by (moduleId, migratedFromLegacy),
//    so a re-run after a crash reuses it instead of creating a duplicate.
// 2. Progress: completedLessons → completedTopics, lastVisitedLessonId → lastVisitedTopicId.
// 3. Analytics snapshots: lessonsCompleted/lessonsTotal → topicsCompleted/topicsTotal.
// 4. Every live course gets its three course sections.

import { Lesson } from "../models/Lesson";
import { Topic } from "../models/Topic";
import { Progress } from "../models/Progress";
import { AnalyticsSnapshot } from "../models/AnalyticsSnapshot";
import { Course } from "../models/Course";
import { ensureSections } from "../services/section.service";

export async function migrateLessonsToTopics(): Promise<{ topics: number; lessons: number }> {
  const lessons = Lesson.collection;
  const topics = Topic.collection;
  const legacy = await lessons.find({ contentType: { $exists: true } }).sort({ order: 1, createdAt: 1 }).toArray();

  const byModule = new Map<string, typeof legacy>();
  for (const doc of legacy) {
    const mid = String(doc.moduleId);
    if (!byModule.has(mid)) byModule.set(mid, []);
    byModule.get(mid)!.push(doc);
  }

  const now = new Date();
  for (const [moduleId, docs] of byModule) {
    const single = docs.length === 1 ? docs[0] : null;
    const container = await lessons.findOneAndUpdate(
      { moduleId, migratedFromLegacy: true },
      {
        $setOnInsert: {
          moduleId,
          courseId: String(docs[0].courseId),
          title: single?.title ?? "Lesson 1",
          description: single?.description ?? "",
          order: 0,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true, returnDocument: "after" },
    );
    const containerId = container!._id;
    let order = 0;
    for (const doc of docs) {
      const { _id, ...rest } = doc;
      await topics.updateOne(
        { _id },
        { $setOnInsert: { ...rest, lessonId: String(containerId), order: order++ } },
        { upsert: true },
      );
    }
    await lessons.deleteMany({ _id: { $in: docs.map((d) => d._id) } });
  }

  await Progress.collection.updateMany(
    { completedLessons: { $exists: true } },
    { $rename: { completedLessons: "completedTopics" } },
  );
  await Progress.collection.updateMany(
    { lastVisitedLessonId: { $exists: true } },
    { $rename: { lastVisitedLessonId: "lastVisitedTopicId" } },
  );
  await AnalyticsSnapshot.collection.updateMany(
    { lessonsCompleted: { $exists: true } },
    { $rename: { lessonsCompleted: "topicsCompleted", lessonsTotal: "topicsTotal" } },
  );

  for (const c of await Course.find({ deletedAt: null }).select("_id")) await ensureSections(String(c._id));

  if (legacy.length) {
    console.log(`[migration] converted ${legacy.length} lesson(s) into topics inside ${byModule.size} lesson container(s).`);
  }
  return { topics: legacy.length, lessons: byModule.size };
}
