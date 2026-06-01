// Per-module assessments (SRS FR-07): each module has MCQs, scenario-based
// questions, and reflection questions, with a 60% passing criterion. Auto-graded:
// MCQ/scenario are scored on the correct option; reflections earn completion
// credit when they meet the minimum word count (participation marks — the only
// fair way to auto-grade open responses). Seed data = the DB seam for the future
// `quizzes`/`quiz_questions`/`quiz_attempts` tables.

export const PASS_PERCENTAGE = 60;

export type QuestionType = "mcq" | "scenario" | "reflection";

export interface McqQuestion {
  id: string;
  type: "mcq";
  points: number;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface ScenarioQuestion {
  id: string;
  type: "scenario";
  points: number;
  scenario: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface ReflectionQuestion {
  id: string;
  type: "reflection";
  points: number;
  prompt: string;
  minWords: number;
}

export type AssessmentQuestion = McqQuestion | ScenarioQuestion | ReflectionQuestion;

export interface Assessment {
  moduleId: string;
  title: string;
  passPercentage: number;
  questions: AssessmentQuestion[];
}

// ---- Grading types ---------------------------------------------------------

export interface AnswerValue {
  choiceIndex?: number; // mcq / scenario
  text?: string; // reflection
}
export type AnswerMap = Record<string, AnswerValue>;

export interface QuestionResult {
  questionId: string;
  type: QuestionType;
  points: number;
  earned: number;
  /** undefined for reflections (graded on completion, not correctness). */
  correct?: boolean;
}

export interface AssessmentResult {
  moduleId: string;
  scorePct: number;
  earned: number;
  total: number;
  passed: boolean;
  passPercentage: number;
  perQuestion: QuestionResult[];
  submittedAt: string;
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** True once a question has a gradable answer (used to gate submission). */
export function isAnswered(q: AssessmentQuestion, a: AnswerValue | undefined): boolean {
  if (q.type === "reflection") return countWords(a?.text ?? "") >= q.minWords;
  return typeof a?.choiceIndex === "number";
}

/** FR-07 auto-evaluation + 60% pass. Pure; safe on client and server. */
export function gradeAssessment(
  assessment: Assessment,
  answers: AnswerMap,
): Omit<AssessmentResult, "submittedAt"> {
  let earned = 0;
  let total = 0;
  const perQuestion: QuestionResult[] = [];

  for (const q of assessment.questions) {
    total += q.points;
    if (q.type === "reflection") {
      const ok = countWords(answers[q.id]?.text ?? "") >= q.minWords;
      const e = ok ? q.points : 0;
      earned += e;
      perQuestion.push({ questionId: q.id, type: "reflection", points: q.points, earned: e });
    } else {
      const correct = answers[q.id]?.choiceIndex === q.answerIndex;
      const e = correct ? q.points : 0;
      earned += e;
      perQuestion.push({ questionId: q.id, type: q.type, points: q.points, earned: e, correct });
    }
  }

  const scorePct = total ? Math.round((earned / total) * 100) : 0;
  return {
    moduleId: assessment.moduleId,
    scorePct,
    earned,
    total,
    passed: scorePct >= assessment.passPercentage,
    passPercentage: assessment.passPercentage,
    perQuestion,
  };
}

export function getAssessment(moduleId: string): Assessment | undefined {
  return ASSESSMENTS[moduleId];
}

// ---- Seed: one assessment per SRS module (m1..m8) --------------------------

const a = (moduleId: string, title: string, questions: AssessmentQuestion[]): Assessment => ({
  moduleId,
  title,
  passPercentage: PASS_PERCENTAGE,
  questions,
});

export const ASSESSMENTS: Record<string, Assessment> = {
  m1: a("m1", "Module 1 Assessment · Understanding AI", [
    {
      id: "m1-q1",
      type: "mcq",
      points: 1,
      question: "Which best describes most AI in use today?",
      options: [
        "Self-aware machines",
        "Narrow systems good at one task",
        "Robots with general intelligence",
        "Science fiction",
      ],
      answerIndex: 1,
      explanation: "Today's AI is 'narrow' — strong at specific tasks, not general intelligence.",
    },
    {
      id: "m1-q2",
      type: "mcq",
      points: 1,
      question: "A spam filter that improves from examples is an example of…",
      options: ["Automation", "Artificial Intelligence", "A robot", "A fixed rule"],
      answerIndex: 1,
      explanation: "Learning patterns from data is AI, not fixed-rule automation.",
    },
    {
      id: "m1-q3",
      type: "scenario",
      points: 1,
      scenario: "A factory arm repeats the exact same weld on every car and never changes.",
      question: "This is best described as:",
      options: ["General AI", "Automation", "Deep learning", "A self-aware system"],
      answerIndex: 1,
      explanation: "Fixed, repeated steps with no learning is automation.",
    },
    {
      id: "m1-q4",
      type: "reflection",
      points: 1,
      prompt: "Describe one common myth about AI and explain why it is misleading.",
      minWords: 30,
    },
  ]),
  m2: a("m2", "Module 2 Assessment · How AI Learns", [
    {
      id: "m2-q1",
      type: "mcq",
      points: 1,
      question: "Machine learning primarily works by…",
      options: [
        "Following hand-written rules",
        "Learning patterns from data",
        "Copying the internet",
        "Guessing randomly",
      ],
      answerIndex: 1,
      explanation: "ML learns patterns from data rather than explicit rules.",
    },
    {
      id: "m2-q2",
      type: "mcq",
      points: 1,
      question: "Testing a model on unseen data mainly checks its…",
      options: ["Memory", "Generalisation", "Download speed", "File size"],
      answerIndex: 1,
      explanation: "Performance on new data measures how well it generalises.",
    },
    {
      id: "m2-q3",
      type: "scenario",
      points: 1,
      scenario:
        "A model scores 99% on its training data but only 60% on new data it has never seen.",
      question: "This most likely indicates:",
      options: ["Good generalisation", "Overfitting", "A hardware fault", "Too little training"],
      answerIndex: 1,
      explanation: "Memorising training data but failing on new data is overfitting.",
    },
    {
      id: "m2-q4",
      type: "reflection",
      points: 1,
      prompt: "Give an example where biased training data could lead to an unfair AI decision.",
      minWords: 30,
    },
  ]),
  m3: a("m3", "Module 3 Assessment · AI in Everyday Life", [
    {
      id: "m3-q1",
      type: "mcq",
      points: 1,
      question: "Streaming recommendations are mainly produced by…",
      options: [
        "Random selection",
        "Learning from similar viewers",
        "Staff picking shows",
        "Alphabetical order",
      ],
      answerIndex: 1,
      explanation: "Recommenders learn from the behaviour of similar users.",
    },
    {
      id: "m3-q2",
      type: "mcq",
      points: 1,
      question: "A maps app suggests a faster route during a jam using…",
      options: [
        "A printed map",
        "Real-time + historical traffic prediction",
        "Your contacts",
        "A coin flip",
      ],
      answerIndex: 1,
      explanation: "It predicts conditions from live and historical traffic data.",
    },
    {
      id: "m3-q3",
      type: "scenario",
      points: 1,
      scenario: "Your social feed keeps showing more of the posts you tend to like and comment on.",
      question: "The main cause is:",
      options: [
        "A bug",
        "Engagement-prediction ranking",
        "Random shuffling",
        "Your storage settings",
      ],
      answerIndex: 1,
      explanation: "Feeds rank content using engagement-prediction models.",
    },
    {
      id: "m3-q4",
      type: "reflection",
      points: 1,
      prompt:
        "Pick one everyday AI you use and explain when its personalisation helps and when it harms.",
      minWords: 30,
    },
  ]),
  m4: a("m4", "Module 4 Assessment · AI Across Industries", [
    {
      id: "m4-q1",
      type: "mcq",
      points: 1,
      question: "In banking, flagging unusual transactions is an example of…",
      options: ["Crop monitoring", "Fraud detection", "Route planning", "Voice cloning"],
      answerIndex: 1,
      explanation: "Spotting unusual patterns in transactions is fraud detection.",
    },
    {
      id: "m4-q2",
      type: "mcq",
      points: 1,
      question: "Analysing drone images to find unhealthy crops is AI used in…",
      options: ["Agriculture", "Banking", "Streaming", "Gaming"],
      answerIndex: 0,
      explanation: "This is precision agriculture.",
    },
    {
      id: "m4-q3",
      type: "scenario",
      points: 1,
      scenario:
        "A hospital triage AI under-prioritises a rare condition it saw very little of during training.",
      question: "The core issue is:",
      options: [
        "The screen is too small",
        "A data gap / bias for rare cases",
        "Too many doctors",
        "Slow internet",
      ],
      answerIndex: 1,
      explanation: "Sparse data for rare cases causes biased, unsafe predictions.",
    },
    {
      id: "m4-q4",
      type: "reflection",
      points: 1,
      prompt: "Propose one responsible AI use for your school or town and the data it would need.",
      minWords: 40,
    },
  ]),
  m5: a("m5", "Module 5 Assessment · AI and the Economy", [
    {
      id: "m5-q1",
      type: "mcq",
      points: 1,
      question: "A genuine economic risk of rapid AI adoption is…",
      options: [
        "Lower electricity use",
        "Displacement of routine jobs",
        "Slower computers",
        "Fewer datasets",
      ],
      answerIndex: 1,
      explanation: "Automation can displace routine jobs without reskilling.",
    },
    {
      id: "m5-q2",
      type: "mcq",
      points: 1,
      question: "AI can raise productivity mainly by…",
      options: [
        "Automating routine tasks",
        "Using more paper",
        "Slowing decisions",
        "Hiring more managers",
      ],
      answerIndex: 0,
      explanation: "Automating routine work frees people for higher-value tasks.",
    },
    {
      id: "m5-q3",
      type: "scenario",
      points: 1,
      scenario:
        "A company automates its warehouse: output rises but several manual roles disappear.",
      question: "The most balanced response is:",
      options: [
        "Ban the technology",
        "Reskilling workers + supportive policy",
        "Ignore the displaced workers",
        "Stop measuring output",
      ],
      answerIndex: 1,
      explanation: "Reskilling and policy help spread AI's benefits.",
    },
    {
      id: "m5-q4",
      type: "reflection",
      points: 1,
      prompt:
        "As AI spreads through the economy, who gains the most and who risks being left behind?",
      minWords: 40,
    },
  ]),
  m6: a("m6", "Module 6 Assessment · Future of Work", [
    {
      id: "m6-q1",
      type: "mcq",
      points: 1,
      question: "AI is most likely to fully automate…",
      options: [
        "Comforting a patient",
        "Repetitive rule-based tasks",
        "Designing a campaign",
        "Mentoring a student",
      ],
      answerIndex: 1,
      explanation: "Repetitive, rule-based work is the most automatable.",
    },
    {
      id: "m6-q2",
      type: "mcq",
      points: 1,
      question: "Which skills are most resilient alongside AI?",
      options: [
        "Memorising facts",
        "Creativity, judgement, communication",
        "Copying templates",
        "Repetitive data entry",
      ],
      answerIndex: 1,
      explanation: "Human creativity and judgement complement AI.",
    },
    {
      id: "m6-q3",
      type: "scenario",
      points: 1,
      scenario:
        "A designer uses an AI tool to draft layout options, then edits and finalises them herself.",
      question: "This is an example of:",
      options: ["Full automation", "Human–AI collaboration", "Job replacement", "A fixed rule"],
      answerIndex: 1,
      explanation: "AI assists while the human directs and decides — collaboration.",
    },
    {
      id: "m6-q4",
      type: "reflection",
      points: 1,
      prompt: "Name two skills you'll build to thrive alongside AI and how you'll practise them.",
      minWords: 30,
    },
  ]),
  m7: a("m7", "Module 7 Assessment · AI Projects & Tools", [
    {
      id: "m7-q1",
      type: "mcq",
      points: 1,
      question: "Which step usually takes the most time in a real AI project?",
      options: ["Naming it", "Preparing the data", "Deploying", "Writing the report"],
      answerIndex: 1,
      explanation: "Collecting, cleaning and labelling data is the biggest effort.",
    },
    {
      id: "m7-q2",
      type: "mcq",
      points: 1,
      question: "When a chatbot states a wrong fact confidently, this is called a…",
      options: ["Hallucination", "Compilation", "Backup", "Cache"],
      answerIndex: 0,
      explanation: "Confident but false output is a 'hallucination'.",
    },
    {
      id: "m7-q3",
      type: "scenario",
      points: 1,
      scenario:
        "A student pastes an AI chatbot's answer straight into homework without checking, and it turns out to be wrong.",
      question: "The best practice would have been to:",
      options: [
        "Submit it faster",
        "Verify the claims and cite sources",
        "Use a longer prompt",
        "Trust it completely",
      ],
      answerIndex: 1,
      explanation: "Always verify AI output and cite real sources.",
    },
    {
      id: "m7-q4",
      type: "reflection",
      points: 1,
      prompt:
        "Outline a small AI project: the problem, the data you'd need, and how you'd know it works.",
      minWords: 40,
    },
  ]),
  m8: a("m8", "Module 8 Assessment · Ethics & Future", [
    {
      id: "m8-q1",
      type: "mcq",
      points: 1,
      question: "Making a deepfake of someone without their permission mainly violates…",
      options: ["Battery life", "Consent and dignity", "Internet speed", "Model accuracy"],
      answerIndex: 1,
      explanation: "Using someone's likeness without consent harms their rights.",
    },
    {
      id: "m8-q2",
      type: "mcq",
      points: 1,
      question: "'Governance' of AI refers to…",
      options: [
        "Faster chips",
        "Laws and standards that keep AI accountable",
        "Bigger datasets",
        "More ads",
      ],
      answerIndex: 1,
      explanation: "Governance is the rules and standards that hold AI accountable.",
    },
    {
      id: "m8-q3",
      type: "scenario",
      points: 1,
      scenario: "An app collects users' photos to train its models without telling them.",
      question: "The main ethical problem is:",
      options: ["Slow uploads", "Lack of consent and privacy", "Too few photos", "Poor lighting"],
      answerIndex: 1,
      explanation: "Using personal data without consent breaches privacy.",
    },
    {
      id: "m8-q4",
      type: "reflection",
      points: 1,
      prompt:
        "Write three personal rules you will follow to use AI ethically, and why each matters.",
      minWords: 40,
    },
  ]),
};
