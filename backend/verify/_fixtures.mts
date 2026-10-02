// Shared test fixtures. Publishing a module requires a description, at least one
// learning objective and a published module assessment with ≥1 question; these
// helpers set that up so harnesses can publish modules the way the CMS does.

export interface ApiClient {
  get: (p: string) => Promise<{ status: number; json: any }>;
  post: (p: string, b?: unknown) => Promise<{ status: number; json: any }>;
  patch: (p: string, b?: unknown) => Promise<{ status: number; json: any }>;
}

export const MODULE_CONTENT = {
  description: "What this module covers and why it matters.",
  learningObjectives: ["Explain the module's core idea in your own words."],
};

/** The single MCQ added to a module assessment by `ensureAssessment` (answer: "Yes"). */
export const READY_QUESTION = {
  type: "mcq",
  question: "Did you complete this module?",
  options: ["Yes", "No"],
  correctAnswer: "Yes",
  explanation: "Placeholder question.",
  marks: 1,
};

/** Make sure the module has a published assessment with ≥1 question; returns its id. */
export async function ensureAssessment(admin: ApiClient, moduleId: string, title = "Module assessment"): Promise<string> {
  let a = (await admin.get(`/admin/assessments/module/${moduleId}`)).json?.data;
  if (!a?.assessment && !a?.id) {
    const created = await admin.post("/admin/assessments", { moduleId, title });
    if (created.status !== 201) throw new Error(`create assessment failed: ${JSON.stringify(created.json)}`);
    a = created.json.data;
  }
  const assessment = a.assessment ?? a;
  const questions: unknown[] = a.questions ?? [];
  if (questions.length === 0) await admin.post(`/admin/assessments/${assessment.id}/questions`, READY_QUESTION);
  if (!assessment.isPublished) {
    const pub = await admin.post(`/admin/assessments/${assessment.id}/publish`);
    if (pub.status !== 200) throw new Error(`publish assessment failed: ${JSON.stringify(pub.json)}`);
  }
  return assessment.id;
}

/** Fill in the required module content, ensure its assessment, then publish it. */
export async function publishModule(admin: ApiClient, moduleId: string): Promise<string> {
  await admin.patch(`/admin/courses/modules/${moduleId}`, MODULE_CONTENT);
  const assessmentId = await ensureAssessment(admin, moduleId);
  const r = await admin.patch(`/admin/courses/modules/${moduleId}`, { isPublished: true });
  if (r.status !== 200) throw new Error(`publish module failed: ${JSON.stringify(r.json)}`);
  return assessmentId;
}
