// The " Demystifying AI for Everyone" curriculum (SRS FR-05 / FR-06): one course,
// eight modules, multi-format topics. This is seed data — the DB seam for the
// future `courses`/`modules`/`topics` tables. Content types are a discriminated
// union so the topic player can render each format type-safely.

export type ContentKind =
  | "video"
  | "pdf"
  | "infographic"
  | "interactive"
  | "case_study"
  | "reflection";

export interface VideoContent {
  kind: "video";
  videoUrl?: string;
  summary: string;
  keyPoints: string[];
}

export interface PdfContent {
  kind: "pdf";
  fileName: string;
  fileUrl?: string;
  pages: number;
  summary: string;
  sections: string[];
}

export interface InfographicContent {
  kind: "infographic";
  caption: string;
  imageUrl?: string;
  facts: string[];
}

export interface InteractiveCheck {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface InteractiveContent {
  kind: "interactive";
  intro: string;
  cards: { term: string; detail: string }[];
  check?: InteractiveCheck;
}

export interface CaseStudyContent {
  kind: "case_study";
  scenario: string;
  background: string;
  questions: string[];
}

export interface ReflectionContent {
  kind: "reflection";
  prompt: string;
  guidance: string;
  minWords: number;
}

export type TopicContent =
  | VideoContent
  | PdfContent
  | InfographicContent
  | InteractiveContent
  | CaseStudyContent
  | ReflectionContent;

export interface Topic {
  id: string; // globally unique, e.g. "m1-l1"
  title: string;
  durationMin: number;
  content: TopicContent;
}

export interface Module {
  id: string; // "m1".."m8"
  order: number;
  title: string;
  description: string;
  keyTopics: string[]; // SRS key topics
  topics: Topic[];
}

export interface Course {
  id: string;
  title: string;
  subtitle: string;
  modules: Module[];
}

export const AI_COURSE: Course = {
  id: "ai-literacy",
  title: " Demystifying AI for Everyone",
  subtitle: "An eight-module journey into AI literacy for school students.",
  modules: [
    {
      id: "m1",
      order: 1,
      title: "Understanding Artificial Intelligence",
      description: "What AI is (and isn't), its types, and how it already shapes daily life.",
      keyTopics: [
        "What is AI",
        "AI myths vs reality",
        "Automation vs AI vs robots",
        "Types of AI",
        "Evolution of AI",
        "AI in daily life",
      ],
      topics: [
        {
          id: "m1-l1",
          title: "What is AI? Myths vs Reality",
          durationMin: 8,
          content: {
            kind: "video",
            summary:
              "A plain-language introduction to artificial intelligence and the myths that surround it.",
            keyPoints: [
              "AI is software that performs tasks needing human-like reasoning, not a conscious robot.",
              "Most real AI is 'narrow' — great at one task, not general intelligence.",
              "Sci-fi exaggerates AI; today's systems are powerful but limited tools.",
            ],
          },
        },
        {
          id: "m1-l2",
          title: "Types & Evolution of AI",
          durationMin: 10,
          content: {
            kind: "pdf",
            fileName: "M1-Types-of-AI.pdf",
            pages: 6,
            summary:
              "Reading notes on narrow vs general AI and the milestones from rule-based systems to modern learning.",
            sections: [
              "Narrow, general & super AI",
              "Rule-based vs learning systems",
              "Timeline: 1950 → today",
              "Why deep learning changed everything",
            ],
          },
        },
        {
          id: "m1-l3",
          title: "AI vs Automation vs Robots",
          durationMin: 7,
          content: {
            kind: "interactive",
            intro:
              "Tap each card to see how these often-confused ideas differ, then test yourself.",
            cards: [
              {
                term: "Automation",
                detail: "Fixed rules repeating a task — e.g. a washing-machine cycle. No learning.",
              },
              {
                term: "Artificial Intelligence",
                detail:
                  "Software that learns patterns from data to make decisions — e.g. spam filters.",
              },
              {
                term: "Robot",
                detail:
                  "A physical machine. It may or may not use AI to sense and act in the world.",
              },
            ],
            check: {
              question:
                "A thermostat that follows a fixed on/off temperature rule is an example of…",
              options: [
                "Artificial Intelligence",
                "Automation",
                "A learning robot",
                "Deep learning",
              ],
              answerIndex: 1,
              explanation: "Fixed rules with no learning from data is automation, not AI.",
            },
          },
        },
        {
          id: "m1-l4",
          title: "Reflection: AI in Your Day",
          durationMin: 5,
          content: {
            kind: "reflection",
            prompt:
              "List three moments today when you likely interacted with AI. What did each one do for you?",
            guidance: "Think about your phone, apps, recommendations, maps, or voice assistants.",
            minWords: 40,
          },
        },
      ],
    },
    {
      id: "m2",
      order: 2,
      title: "How AI Learns",
      description: "Data, machine learning, deep learning, and why bias and overfitting matter.",
      keyTopics: [
        "Data fundamentals",
        "Datasets",
        "Machine learning",
        "Deep learning",
        "Model evaluation",
        "Bias and overfitting",
      ],
      topics: [
        {
          id: "m2-l1",
          title: "From Data to Learning",
          durationMin: 9,
          content: {
            kind: "video",
            summary:
              "How machines 'learn' patterns from examples instead of being explicitly programmed.",
            keyPoints: [
              "Machine learning finds patterns in data rather than following hand-written rules.",
              "More and better data usually means better predictions.",
              "Deep learning uses layered neural networks for complex patterns like images and language.",
            ],
          },
        },
        {
          id: "m2-l2",
          title: "Datasets, ML & Deep Learning",
          durationMin: 11,
          content: {
            kind: "pdf",
            fileName: "M2-How-AI-Learns.pdf",
            pages: 8,
            summary:
              "Notes on training data, features, the train/test split, and evaluating a model.",
            sections: [
              "What makes a good dataset",
              "Features & labels",
              "Training vs testing",
              "Accuracy & evaluation",
            ],
          },
        },
        {
          id: "m2-l3",
          title: "Spot the Bias",
          durationMin: 8,
          content: {
            kind: "interactive",
            intro: "Explore two ways AI models go wrong, then identify which is happening.",
            cards: [
              {
                term: "Bias",
                detail:
                  "When training data over-represents some groups, the model treats others unfairly.",
              },
              {
                term: "Overfitting",
                detail: "The model memorises the training examples and fails on new, unseen data.",
              },
              {
                term: "Generalisation",
                detail: "The goal: performing well on data the model has never seen before.",
              },
            ],
            check: {
              question:
                "A face-unlock model works for the developers but fails for many users with darker skin tones. This is most likely…",
              options: [
                "Overfitting",
                "Bias in the training data",
                "Good generalisation",
                "A hardware fault",
              ],
              answerIndex: 1,
              explanation:
                "Unrepresentative training data leads to biased, unfair performance across groups.",
            },
          },
        },
        {
          id: "m2-l4",
          title: "Reflection: When Data Misleads",
          durationMin: 5,
          content: {
            kind: "reflection",
            prompt:
              "Describe a situation where biased data could lead an AI system to an unfair decision. Who would be harmed?",
            guidance: "Consider hiring, exams, loans, or recommendations.",
            minWords: 50,
          },
        },
      ],
    },
    {
      id: "m3",
      order: 3,
      title: "AI in Everyday Life",
      description: "The AI already running in your phone, feeds, maps, and home.",
      keyTopics: [
        "Smartphones",
        "Social media algorithms",
        "Navigation systems",
        "E-commerce",
        "Voice assistants",
        "Smart homes",
      ],
      topics: [
        {
          id: "m3-l1",
          title: "AI in Your Pocket",
          durationMin: 7,
          content: {
            kind: "video",
            summary: "A tour of the everyday AI in phones, feeds, shopping, and navigation.",
            keyPoints: [
              "Recommendation algorithms decide much of what you see and buy.",
              "Voice assistants combine speech recognition with language models.",
              "Maps use AI to predict traffic and the fastest route.",
            ],
          },
        },
        {
          id: "m3-l2",
          title: "Algorithms Around You",
          durationMin: 6,
          content: {
            kind: "infographic",
            caption: "A snapshot of where AI quietly works during an ordinary day.",
            facts: [
              "Social feeds rank posts using engagement-prediction models.",
              "E-commerce sites personalise results for each shopper.",
              "Navigation apps re-route millions of trips in real time.",
              "Smart homes learn routines to adjust lights and temperature.",
            ],
          },
        },
        {
          id: "m3-l3",
          title: "Match the App to its AI",
          durationMin: 7,
          content: {
            kind: "interactive",
            intro: "Reveal how familiar apps use AI, then answer the check.",
            cards: [
              {
                term: "Streaming app",
                detail: "Recommends shows by learning from what similar viewers watch.",
              },
              {
                term: "Maps app",
                detail: "Predicts traffic and arrival times from live and historical data.",
              },
              {
                term: "Camera app",
                detail: "Uses vision models to detect faces and enhance photos.",
              },
            ],
            check: {
              question:
                "When your maps app suggests a faster route during a jam, it is mainly using…",
              options: [
                "A fixed map",
                "Real-time prediction from data",
                "Your contacts",
                "A random guess",
              ],
              answerIndex: 1,
              explanation: "It predicts conditions and routes from live + historical traffic data.",
            },
          },
        },
        {
          id: "m3-l4",
          title: "Reflection: Helpful or Annoying?",
          durationMin: 5,
          content: {
            kind: "reflection",
            prompt:
              "Pick one everyday AI you use. When is it genuinely helpful, and when does it get in your way?",
            guidance: "Be specific about a recent experience.",
            minWords: 40,
          },
        },
      ],
    },
    {
      id: "m4",
      order: 4,
      title: "AI Across Industries & Public Systems",
      description: "How AI is used in agriculture, healthcare, banking, government, and cities.",
      keyTopics: [
        "Agriculture",
        "Manufacturing",
        "Healthcare",
        "Banking",
        "Retail",
        "Government",
        "Smart cities",
      ],
      topics: [
        {
          id: "m4-l1",
          title: "AI at Work Across Sectors",
          durationMin: 9,
          content: {
            kind: "video",
            summary: "Real uses of AI from farms to hospitals to city traffic systems.",
            keyPoints: [
              "Agriculture: AI spots crop disease and guides irrigation.",
              "Healthcare: AI assists diagnosis and prioritises urgent cases.",
              "Public systems: AI manages traffic, utilities, and services.",
            ],
          },
        },
        {
          id: "m4-l2",
          title: "Case Study: AI in Hospital Triage",
          durationMin: 10,
          content: {
            kind: "case_study",
            scenario:
              "A busy hospital pilots an AI tool that flags which incoming patients likely need urgent care first.",
            background:
              "The tool was trained on past records. It speeds up triage but occasionally under-prioritises rare conditions it has seen little data on.",
            questions: [
              "What are the benefits of faster, data-driven triage?",
              "What could go wrong if staff trust the tool blindly?",
              "Should a human always be able to override the AI? Why?",
            ],
          },
        },
        {
          id: "m4-l3",
          title: "Match Industry to AI Use",
          durationMin: 7,
          content: {
            kind: "interactive",
            intro: "Explore one AI use per sector, then take the check.",
            cards: [
              {
                term: "Banking",
                detail: "Detects fraud by spotting unusual transaction patterns.",
              },
              { term: "Retail", detail: "Forecasts demand to keep shelves stocked." },
              { term: "Agriculture", detail: "Analyses drone images to find unhealthy crops." },
            ],
            check: {
              question:
                "Flagging a sudden, out-of-pattern card transaction is an example of AI used for…",
              options: [
                "Crop monitoring",
                "Fraud detection",
                "Demand forecasting",
                "Traffic control",
              ],
              answerIndex: 1,
              explanation: "Spotting unusual patterns in transactions is classic fraud detection.",
            },
          },
        },
        {
          id: "m4-l4",
          title: "Reflection: AI for Your Community",
          durationMin: 5,
          content: {
            kind: "reflection",
            prompt:
              "Name one problem in your school or town. How could a responsible AI system help solve it?",
            guidance: "Consider who would use it and what data it would need.",
            minWords: 50,
          },
        },
      ],
    },
    {
      id: "m5",
      order: 5,
      title: "AI and the Economy",
      description: "Productivity, business strategy, supply chains, growth, and inequality.",
      keyTopics: [
        "Productivity",
        "Business strategy",
        "Supply chains",
        "Economic growth",
        "AI and inequality",
      ],
      topics: [
        {
          id: "m5-l1",
          title: "AI, Productivity & Growth",
          durationMin: 8,
          content: {
            kind: "video",
            summary: "How AI can raise productivity and reshape entire industries and economies.",
            keyPoints: [
              "AI can automate routine work, freeing people for higher-value tasks.",
              "Faster, data-driven decisions can boost productivity and growth.",
              "Benefits are uneven — some regions and workers gain more than others.",
            ],
          },
        },
        {
          id: "m5-l2",
          title: "Supply Chains & Inequality",
          durationMin: 10,
          content: {
            kind: "pdf",
            fileName: "M5-AI-and-the-Economy.pdf",
            pages: 7,
            summary: "Notes on how AI optimises supply chains and why it can widen inequality.",
            sections: [
              "Forecasting & logistics",
              "Strategy & competition",
              "Who benefits?",
              "Policy responses",
            ],
          },
        },
        {
          id: "m5-l3",
          title: "Boost or Risk?",
          durationMin: 7,
          content: {
            kind: "interactive",
            intro: "Explore both sides of AI's economic impact, then decide.",
            cards: [
              { term: "Opportunity", detail: "New jobs, faster services, and cheaper products." },
              {
                term: "Risk",
                detail: "Job displacement and concentration of power in a few firms.",
              },
              { term: "Balance", detail: "Reskilling and good policy help spread the benefits." },
            ],
            check: {
              question: "Which is a genuine economic risk of rapid AI adoption?",
              options: [
                "Lower electricity use",
                "Displacement of routine jobs",
                "Slower computers",
                "Fewer datasets",
              ],
              answerIndex: 1,
              explanation:
                "Automation of routine work can displace jobs unless workers are reskilled.",
            },
          },
        },
        {
          id: "m5-l4",
          title: "Reflection: Winners and Losers",
          durationMin: 5,
          content: {
            kind: "reflection",
            prompt:
              "As AI spreads through the economy, who do you think gains the most and who risks being left behind?",
            guidance: "Think about different jobs, ages, and regions.",
            minWords: 50,
          },
        },
      ],
    },
    {
      id: "m6",
      order: 6,
      title: "AI and the Future of Work",
      description: "Tasks vs jobs, emerging careers, AI skills, and human–AI collaboration.",
      keyTopics: ["Tasks vs jobs", "Emerging AI careers", "AI skills", "Human–AI collaboration"],
      topics: [
        {
          id: "m6-l1",
          title: "Tasks vs Jobs",
          durationMin: 8,
          content: {
            kind: "video",
            summary: "Why AI changes tasks within jobs more often than it erases whole jobs.",
            keyPoints: [
              "AI usually automates specific tasks, not entire roles.",
              "New roles emerge around building, guiding, and checking AI.",
              "The most resilient skills are creativity, judgement, and communication.",
            ],
          },
        },
        {
          id: "m6-l2",
          title: "AI Skills & Emerging Careers",
          durationMin: 9,
          content: {
            kind: "pdf",
            fileName: "M6-Future-of-Work.pdf",
            pages: 6,
            summary:
              "Notes on careers that AI is creating and the skills students can start building now.",
            sections: [
              "New AI-era roles",
              "Durable human skills",
              "Working alongside AI",
              "How to start learning",
            ],
          },
        },
        {
          id: "m6-l3",
          title: "Will AI Change This Task?",
          durationMin: 7,
          content: {
            kind: "interactive",
            intro: "Consider how AI affects different tasks, then take the check.",
            cards: [
              {
                term: "Routine task",
                detail: "Repetitive, rule-like work — most exposed to automation.",
              },
              {
                term: "Creative task",
                detail: "Novel ideas and design — AI assists but rarely replaces.",
              },
              { term: "Care task", detail: "Empathy and human connection — least automatable." },
            ],
            check: {
              question: "Which task is AI most likely to fully automate?",
              options: [
                "Comforting a patient",
                "Sorting thousands of receipts",
                "Designing a campaign",
                "Mentoring a student",
              ],
              answerIndex: 1,
              explanation:
                "Repetitive, rule-based tasks like sorting receipts are the most automatable.",
            },
          },
        },
        {
          id: "m6-l4",
          title: "Reflection: Skills for an AI World",
          durationMin: 5,
          content: {
            kind: "reflection",
            prompt:
              "Which two skills will you build to thrive alongside AI, and how will you practise them?",
            guidance: "Mix a technical skill with a human skill.",
            minWords: 40,
          },
        },
      ],
    },
    {
      id: "m7",
      order: 7,
      title: "AI Projects and AI Tools",
      description: "The AI project lifecycle and using tools like ChatGPT and Perplexity well.",
      keyTopics: [
        "AI project lifecycle",
        "Data preparation",
        "Model training",
        "AI adoption",
        "ChatGPT",
        "Perplexity",
        "Productivity tools",
        "Mini project",
      ],
      topics: [
        {
          id: "m7-l1",
          title: "The AI Project Lifecycle",
          durationMin: 9,
          content: {
            kind: "video",
            summary: "The repeatable steps behind any AI project, from problem to deployment.",
            keyPoints: [
              "Start with a clear problem, not the technology.",
              "Most effort goes into preparing good data.",
              "Train, evaluate, and only then adopt — then keep monitoring.",
            ],
          },
        },
        {
          id: "m7-l2",
          title: "Case Study: Using ChatGPT & Perplexity Responsibly",
          durationMin: 10,
          content: {
            kind: "case_study",
            scenario: "A student uses an AI chatbot to help with a science assignment.",
            background:
              "The tool drafts answers quickly but sometimes states wrong facts confidently ('hallucinations') and doesn't cite sources.",
            questions: [
              "How should the student verify what the AI produces?",
              "What is fair, honest use of AI in schoolwork?",
              "When is it better to use a tool like Perplexity that shows sources?",
            ],
          },
        },
        {
          id: "m7-l3",
          title: "Order the AI Project Steps",
          durationMin: 7,
          content: {
            kind: "interactive",
            intro: "Review each lifecycle stage, then check your understanding.",
            cards: [
              {
                term: "1. Define the problem",
                detail: "Decide what success looks like before touching data.",
              },
              {
                term: "2. Prepare data",
                detail: "Collect, clean, and label the data the model will learn from.",
              },
              {
                term: "3. Train & evaluate",
                detail: "Build the model and test it on unseen data.",
              },
              { term: "4. Deploy & monitor", detail: "Put it to use and watch for drift or harm." },
            ],
            check: {
              question: "Which step usually takes the most time in a real AI project?",
              options: [
                "Defining the problem",
                "Preparing the data",
                "Deploying",
                "Naming the project",
              ],
              answerIndex: 1,
              explanation:
                "Collecting, cleaning, and labelling data is typically the biggest effort.",
            },
          },
        },
        {
          id: "m7-l4",
          title: "Reflection: Plan Your Mini-Project",
          durationMin: 6,
          content: {
            kind: "reflection",
            prompt:
              "Sketch a small AI project idea: the problem, the data you'd need, and how you'd know it works.",
            guidance: "Keep it realistic for a school project.",
            minWords: 60,
          },
        },
      ],
    },
    {
      id: "m8",
      order: 8,
      title: "Ethics, Responsibility & Future",
      description: "Hype vs reality, bias, privacy, deepfakes, governance, and what comes next.",
      keyTopics: [
        "AI hype vs reality",
        "Bias and fairness",
        "Privacy",
        "Deepfakes",
        "Governance",
        "Future of AI",
      ],
      topics: [
        {
          id: "m8-l1",
          title: "Hype, Bias & Responsibility",
          durationMin: 9,
          content: {
            kind: "video",
            summary:
              "Separating realistic AI from hype, and the responsibilities that come with it.",
            keyPoints: [
              "Healthy scepticism: ask what a system can actually do.",
              "Fairness, privacy, and transparency are everyone's concern.",
              "Responsible use needs both good tech and good rules.",
            ],
          },
        },
        {
          id: "m8-l2",
          title: "Deepfakes, Privacy & Governance",
          durationMin: 7,
          content: {
            kind: "infographic",
            caption: "The key risks society must manage as AI grows more capable.",
            facts: [
              "Deepfakes can fabricate convincing fake video and audio.",
              "AI systems can expose private data if poorly designed.",
              "Governance means laws and standards that keep AI accountable.",
              "Transparency helps people understand and contest AI decisions.",
            ],
          },
        },
        {
          id: "m8-l3",
          title: "Ethical or Not?",
          durationMin: 8,
          content: {
            kind: "interactive",
            intro: "Weigh up a few scenarios, then take the check.",
            cards: [
              { term: "Consent", detail: "People should know when AI uses their data or image." },
              {
                term: "Fairness",
                detail: "AI should not disadvantage groups based on biased data.",
              },
              {
                term: "Accountability",
                detail: "Someone must be responsible when AI causes harm.",
              },
            ],
            check: {
              question:
                "Creating a deepfake of a classmate without their permission mainly violates…",
              options: ["Battery life", "Consent and dignity", "Internet speed", "Model accuracy"],
              answerIndex: 1,
              explanation:
                "Using someone's likeness without consent harms their dignity and rights.",
            },
          },
        },
        {
          id: "m8-l4",
          title: "Reflection: Your AI Code of Ethics",
          durationMin: 6,
          content: {
            kind: "reflection",
            prompt:
              "Write three rules you will personally follow when using AI tools, and why each matters.",
            guidance: "Think about honesty, consent, and checking facts.",
            minWords: 50,
          },
        },
      ],
    },
  ],
};

// ---- Derived helpers (pure; safe on client and server) ---------------------

export interface FlatTopic {
  topic: Topic;
  module: Module;
  index: number; // position in the flattened list
}

export function flattenTopics(course: Course = AI_COURSE): FlatTopic[] {
  const out: FlatTopic[] = [];
  for (const module of course.modules) {
    for (const topic of module.topics) out.push({ topic, module, index: out.length });
  }
  return out;
}

export interface TopicContextInfo extends FlatTopic {
  prevId: string | null;
  nextId: string | null;
  total: number;
}

export function findTopicContext(
  topicId: string,
  course: Course = AI_COURSE,
): TopicContextInfo | null {
  const flat = flattenTopics(course);
  const i = flat.findIndex((f) => f.topic.id === topicId);
  if (i === -1) return null;
  return {
    ...flat[i],
    prevId: i > 0 ? flat[i - 1].topic.id : null,
    nextId: i < flat.length - 1 ? flat[i + 1].topic.id : null,
    total: flat.length,
  };
}

export function moduleProgress(module: Module, completed: Record<string, boolean>) {
  const total = module.topics.length;
  const done = module.topics.filter((l) => completed[l.id]).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function courseStats(completed: Record<string, boolean>, course: Course = AI_COURSE) {
  const topics = flattenTopics(course);
  const topicsCompleted = topics.filter((f) => completed[f.topic.id]).length;
  const modulesCompleted = course.modules.filter(
    (m) => moduleProgress(m, completed).pct === 100,
  ).length;
  return {
    topicsCompleted,
    topicsTotal: topics.length,
    modulesCompleted,
    modulesTotal: course.modules.length,
    pct: topics.length ? Math.round((topicsCompleted / topics.length) * 100) : 0,
  };
}

export function firstIncompleteTopicId(
  completed: Record<string, boolean>,
  course: Course = AI_COURSE,
): string {
  const flat = flattenTopics(course);
  return (flat.find((f) => !completed[f.topic.id]) ?? flat[0]).topic.id;
}
