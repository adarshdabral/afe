// Curriculum content for the single standardized course "Demystifying AI for Everyone".
//
// NOTE: No separate curriculum document was present in the repository, so this
// content was authored strictly ON-TOPIC to the 12 module titles supplied in the
// standardization spec (well-established AI-literacy material — no unrelated
// topics). Each module ships one lesson (the chapter) whose content is organized
// into the seven required sections (seeded as seven topics), plus exactly one assessment with 10 MCQs,
// 5 True/False, and 2 scenario questions generated from that module's content.

export interface LessonSections {
  overview: string;
  keyConcepts: string[];
  useCases: string[];
  bestPractices: string[];
  recentDevelopments: string[];
  takeaways: string[];
  activities: string[];
}
export interface SeedMcq {
  q: string;
  options: [string, string, string, string];
  answer: string;
  explanation: string;
}
export interface SeedTf {
  q: string;
  answer: boolean;
  explanation: string;
}
export interface SeedScenario {
  q: string;
  guidance: string;
}
export interface SeedModule {
  title: string;
  description: string;
  lessonTitle: string;
  sections: LessonSections;
  mcqs: SeedMcq[]; // 10
  tfs: SeedTf[]; // 5
  scenarios: SeedScenario[]; // 2
}

const TF = (q: string, answer: boolean, explanation: string): SeedTf => ({ q, answer, explanation });

export const AI_FOR_EVERYONE_MODULES: SeedModule[] = [
  // ─────────────────────────────────────────────────────────────── Module 1
  {
    title: "Understanding Artificial Intelligence",
    description: "What AI is (and isn't), a brief history, and the difference between narrow and general intelligence.",
    lessonTitle: "Foundations of Artificial Intelligence",
    sections: {
      overview:
        "Artificial Intelligence (AI) is the field of building computer systems that perform tasks normally requiring human intelligence — perceiving, reasoning, learning, and deciding. Today's systems are 'narrow' AI: they are very good at one task but do not possess general understanding.",
      keyConcepts: [
        "Narrow (weak) AI solves a specific task; General (strong) AI — human-level across domains — does not yet exist.",
        "AI is an umbrella; Machine Learning (ML) is a subset that learns from data; Deep Learning is a subset of ML using neural networks.",
        "The Turing Test proposed judging a machine's intelligence by whether its responses are indistinguishable from a human's.",
        "AI 'winters' were periods of reduced funding when expectations outran results.",
      ],
      useCases: [
        "Voice assistants understanding spoken commands.",
        "Recommendation feeds ranking content.",
        "Spam filters classifying email.",
      ],
      bestPractices: [
        "Match the tool to the task — most value comes from narrow, well-scoped problems.",
        "Be skeptical of claims of 'human-like' understanding.",
        "Define success metrics before building.",
      ],
      recentDevelopments: [
        "Large language models made general-purpose text and reasoning assistants mainstream.",
        "Multimodal models now combine text, images, and audio.",
      ],
      takeaways: [
        "AI = machines doing tasks that need intelligence; today it is narrow, not general.",
        "ML ⊂ AI, and Deep Learning ⊂ ML.",
      ],
      activities: [
        "List five AI tools you used this week and label each as narrow or general.",
        "Write a one-paragraph explanation of AI for a 10-year-old.",
      ],
    },
    mcqs: [
      { q: "Which statement best describes today's AI systems?", options: ["General intelligence across all domains", "Narrow AI specialized for specific tasks", "Conscious machines", "Perfect and error-free"], answer: "Narrow AI specialized for specific tasks", explanation: "Modern systems are narrow AI — strong at specific tasks, not general understanding." },
      { q: "Machine Learning is best described as…", options: ["A subset of AI that learns from data", "A programming language", "A type of computer hardware", "The same thing as AGI"], answer: "A subset of AI that learns from data", explanation: "ML is a subset of AI in which systems learn patterns from data." },
      { q: "Deep Learning primarily uses…", options: ["Decision tables", "Neural networks", "Spreadsheets", "Rule engines only"], answer: "Neural networks", explanation: "Deep Learning uses multi-layer neural networks." },
      { q: "The Turing Test evaluates…", options: ["Processor speed", "Whether responses are indistinguishable from a human's", "Memory size", "Energy use"], answer: "Whether responses are indistinguishable from a human's", explanation: "It judges intelligence by conversational indistinguishability." },
      { q: "'AI winter' refers to…", options: ["A cooling technique for servers", "Periods of reduced AI funding and interest", "A neural network layer", "An annual AI conference"], answer: "Periods of reduced AI funding and interest", explanation: "AI winters were downturns when results lagged expectations." },
      { q: "Which is an example of narrow AI?", options: ["A spam email filter", "A self-aware robot", "A machine with human-level general reasoning", "A conscious agent"], answer: "A spam email filter", explanation: "A spam filter does one specific classification task." },
      { q: "General (strong) AI is…", options: ["Widely deployed today", "Not yet achieved", "The same as a chatbot", "A type of database"], answer: "Not yet achieved", explanation: "Human-level general AI does not exist today." },
      { q: "Which relationship is correct?", options: ["AI ⊂ ML", "ML ⊂ AI", "Deep Learning ⊃ AI", "ML = AI"], answer: "ML ⊂ AI", explanation: "ML is a subset of AI." },
      { q: "AI systems fundamentally rely on…", options: ["Only human intuition", "Data and algorithms", "Magic", "Random guessing only"], answer: "Data and algorithms", explanation: "AI learns and acts using data and algorithms." },
      { q: "A good first AI project scope is…", options: ["Vague and enormous", "Narrow and well-defined", "Undefined success metrics", "Everything at once"], answer: "Narrow and well-defined", explanation: "Narrow, well-scoped problems deliver the most value." },
    ],
    tfs: [
      TF("Narrow AI can perform any intellectual task a human can.", false, "Narrow AI is specialized; only hypothetical general AI would be broadly capable."),
      TF("All Machine Learning is a form of AI.", true, "ML is a subset of AI."),
      TF("Deep Learning is a subset of Machine Learning.", true, "Deep Learning is a subset of ML using neural networks."),
      TF("General AI is commercially available today.", false, "General AI has not been achieved."),
      TF("AI systems typically require data to learn.", true, "Modern AI learns patterns from data."),
    ],
    scenarios: [
      { q: "A startup claims its chatbot 'truly understands' customers like a human. As an AI-literate reviewer, what questions would you ask and how would you frame realistic expectations?", guidance: "Discuss narrow vs general AI, the difference between pattern-matching and understanding, evaluation metrics, and failure modes." },
      { q: "You must pick your team's first AI project. Explain how you would choose a narrow, high-value, well-scoped problem and define success.", guidance: "Cover scoping, data availability, measurable success metrics, and why narrow beats broad for early wins." },
    ],
  },

  // ─────────────────────────────────────────────────────────────── Module 2
  {
    title: "Data: The Foundation of AI",
    description: "Why data quality, quantity, and representativeness determine what AI can and cannot do.",
    lessonTitle: "Data as the Fuel of AI",
    sections: {
      overview:
        "AI systems are only as good as the data they learn from. Understanding data types, quality, labeling, and bias is essential to building trustworthy systems.",
      keyConcepts: [
        "Structured data (tables) vs unstructured data (text, images, audio).",
        "Training, validation, and test splits prevent over-optimistic results.",
        "Labeled data (supervised) vs unlabeled data (unsupervised).",
        "Garbage in, garbage out: biased or noisy data produces biased or unreliable models.",
      ],
      useCases: [
        "Medical images labeled by clinicians to train diagnostic models.",
        "Customer transactions used to detect fraud.",
        "Text corpora used to train language models.",
      ],
      bestPractices: [
        "Check that data is representative of the people/situations it will serve.",
        "Keep a held-out test set the model never sees during training.",
        "Document data sources, consent, and known limitations (data provenance).",
      ],
      recentDevelopments: [
        "Synthetic data generation to augment scarce or sensitive datasets.",
        "Data-centric AI: improving data quality rather than only model size.",
      ],
      takeaways: [
        "Data quality and representativeness often matter more than algorithm choice.",
        "Always evaluate on data the model did not train on.",
      ],
      activities: [
        "Take a dataset and identify potential sources of bias.",
        "Split a sample dataset into train/validation/test and explain why.",
      ],
    },
    mcqs: [
      { q: "Text, images and audio are examples of…", options: ["Structured data", "Unstructured data", "Metadata only", "Test data only"], answer: "Unstructured data", explanation: "They lack a fixed tabular schema." },
      { q: "Why hold out a test set?", options: ["To speed up training", "To estimate performance on unseen data", "To increase bias", "To reduce data size"], answer: "To estimate performance on unseen data", explanation: "A held-out set measures generalization." },
      { q: "'Garbage in, garbage out' means…", options: ["Models fix bad data", "Poor data yields poor models", "Data is unnecessary", "Bigger models fix everything"], answer: "Poor data yields poor models", explanation: "Model quality is bounded by data quality." },
      { q: "Supervised learning requires…", options: ["Only unlabeled data", "Labeled data", "No data", "Only images"], answer: "Labeled data", explanation: "Supervised learning learns from labeled examples." },
      { q: "A representative dataset is one that…", options: ["Only includes ideal cases", "Reflects the real population it serves", "Is as small as possible", "Excludes minorities"], answer: "Reflects the real population it serves", explanation: "Representativeness reduces biased outcomes." },
      { q: "Data provenance refers to…", options: ["Model accuracy", "Documenting data origin and limitations", "The training algorithm", "GPU type"], answer: "Documenting data origin and limitations", explanation: "Provenance tracks where data came from and its constraints." },
      { q: "Synthetic data is useful when…", options: ["Real data is abundant and public", "Real data is scarce or sensitive", "You want to ignore privacy", "You never validate"], answer: "Real data is scarce or sensitive", explanation: "Synthetic data augments scarce/sensitive datasets." },
      { q: "Structured data is typically stored as…", options: ["Free-form text", "Tables of rows and columns", "Raw audio", "Images"], answer: "Tables of rows and columns", explanation: "Structured data has a fixed schema." },
      { q: "The validation set is used to…", options: ["Train the final model weights", "Tune choices and detect overfitting", "Replace the test set's purpose", "Store user passwords"], answer: "Tune choices and detect overfitting", explanation: "Validation guides tuning without touching the test set." },
      { q: "Data-centric AI emphasizes…", options: ["Only bigger models", "Improving data quality", "Ignoring labels", "Removing all data"], answer: "Improving data quality", explanation: "It focuses on systematically improving the data." },
    ],
    tfs: [
      TF("Model performance is limited by data quality.", true, "Bad data caps achievable quality."),
      TF("Evaluating on training data gives a reliable estimate of real-world performance.", false, "It over-estimates; use held-out data."),
      TF("Unsupervised learning uses unlabeled data.", true, "It finds structure without labels."),
      TF("A biased dataset can lead to biased AI decisions.", true, "Bias in data propagates to models."),
      TF("More data always beats better data.", false, "Quality and representativeness often matter more."),
    ],
    scenarios: [
      { q: "Your hiring model performs worse for a demographic group. How would you investigate the data as the likely cause and what would you change?", guidance: "Examine representativeness, label bias, feature proxies, and re-sampling/relabeling strategies." },
      { q: "You have very little labeled medical data. Describe responsible options to proceed without compromising patient privacy.", guidance: "Cover synthetic data, expert labeling, transfer learning, consent, and validation on real held-out data." },
    ],
  },

  // ─────────────────────────────────────────────────────────────── Module 3
  {
    title: "How AI Learns",
    description: "Supervised, unsupervised and reinforcement learning, training vs inference, and why models generalize (or fail to).",
    lessonTitle: "The Mechanics of Learning",
    sections: {
      overview:
        "AI 'learns' by adjusting internal parameters to reduce error on examples. The main paradigms are supervised, unsupervised and reinforcement learning.",
      keyConcepts: [
        "Supervised learning: learn a mapping from inputs to labeled outputs.",
        "Unsupervised learning: find structure (clusters, patterns) in unlabeled data.",
        "Reinforcement learning: an agent learns by trial-and-error using rewards.",
        "Training adjusts parameters; inference uses the trained model to predict.",
        "Overfitting = memorizing training data; underfitting = failing to learn patterns.",
      ],
      useCases: [
        "Supervised: image classification, price prediction.",
        "Unsupervised: customer segmentation.",
        "Reinforcement: game-playing agents, robotics control.",
      ],
      bestPractices: [
        "Regularize and use validation to fight overfitting.",
        "Prefer the simplest model that meets the requirement.",
        "Report performance with confidence, not single lucky runs.",
      ],
      recentDevelopments: [
        "Self-supervised learning creates labels from the data itself, powering modern LLMs.",
        "Reinforcement learning from human feedback (RLHF) aligns model behavior.",
      ],
      takeaways: [
        "Three paradigms: supervised, unsupervised, reinforcement.",
        "Generalization (not memorization) is the real goal.",
      ],
      activities: [
        "Classify five real problems by learning paradigm.",
        "Sketch how you would detect overfitting in a project.",
      ],
    },
    mcqs: [
      { q: "Learning from labeled input–output pairs is…", options: ["Unsupervised learning", "Supervised learning", "Reinforcement learning", "No learning"], answer: "Supervised learning", explanation: "Supervised learning uses labeled pairs." },
      { q: "Clustering customers with no labels is…", options: ["Supervised", "Unsupervised", "Reinforcement", "Inference only"], answer: "Unsupervised", explanation: "Clustering finds structure without labels." },
      { q: "An agent learning from rewards is…", options: ["Reinforcement learning", "Supervised learning", "Data cleaning", "Labeling"], answer: "Reinforcement learning", explanation: "RL learns via reward feedback." },
      { q: "Overfitting means the model…", options: ["Generalizes well", "Memorizes training data and fails on new data", "Has too little data", "Ignores training data"], answer: "Memorizes training data and fails on new data", explanation: "Overfit models don't generalize." },
      { q: "Inference is…", options: ["Adjusting parameters during training", "Using a trained model to predict", "Collecting data", "Labeling data"], answer: "Using a trained model to predict", explanation: "Inference = prediction with a trained model." },
      { q: "Underfitting means…", options: ["The model captures the pattern", "The model is too simple to learn the pattern", "Perfect accuracy", "Too much training"], answer: "The model is too simple to learn the pattern", explanation: "Underfitting = failing to learn." },
      { q: "RLHF is used to…", options: ["Store data", "Align model behavior using human feedback", "Compress images", "Replace inference"], answer: "Align model behavior using human feedback", explanation: "RLHF tunes behavior with human preferences." },
      { q: "Self-supervised learning…", options: ["Needs no data", "Creates labels from the data itself", "Requires manual labels for everything", "Only works on tables"], answer: "Creates labels from the data itself", explanation: "It generates its own training signal." },
      { q: "A key goal of learning is…", options: ["Memorization", "Generalization to new data", "Maximizing overfit", "Ignoring validation"], answer: "Generalization to new data", explanation: "Good models generalize." },
      { q: "To combat overfitting you can…", options: ["Remove validation", "Use regularization and more/representative data", "Train forever", "Delete the test set"], answer: "Use regularization and more/representative data", explanation: "These improve generalization." },
    ],
    tfs: [
      TF("Reinforcement learning uses reward signals.", true, "The agent optimizes cumulative reward."),
      TF("Training and inference are the same phase.", false, "Training fits parameters; inference predicts."),
      TF("Overfitting improves real-world performance.", false, "It harms generalization."),
      TF("Unsupervised learning can discover clusters without labels.", true, "That is a core use."),
      TF("Self-supervised learning helped enable modern language models.", true, "It provides scalable training signal."),
    ],
    scenarios: [
      { q: "Your model scores 99% on training data but 60% on new data. Diagnose the problem and propose fixes.", guidance: "Identify overfitting; suggest regularization, more/representative data, simpler model, and proper validation." },
      { q: "Choose a learning paradigm for a warehouse robot that must learn to grasp varied objects, and justify it.", guidance: "Reinforcement learning fits trial-and-error control; discuss reward design and safety in training." },
    ],
  },

  // ─────────────────────────────────────────────────────────────── Module 4
  {
    title: "AI in Everyday Life",
    description: "How AI already shapes daily experiences — search, recommendations, assistants, navigation and more.",
    lessonTitle: "AI Around Us",
    sections: {
      overview:
        "AI is embedded in everyday tools most people use without noticing: search ranking, recommendations, voice assistants, maps, photo tagging and translation.",
      keyConcepts: [
        "Recommendation systems personalize content based on behavior.",
        "Natural language processing powers assistants and translation.",
        "Computer vision enables face unlock and photo search.",
        "Personalization can create filter bubbles.",
      ],
      useCases: [
        "Streaming recommendations and shopping suggestions.",
        "Turn-by-turn navigation with live traffic.",
        "Real-time translation and captions.",
      ],
      bestPractices: [
        "Give users control and transparency over personalization.",
        "Offer easy opt-outs and privacy settings.",
        "Watch for over-personalization and filter bubbles.",
      ],
      recentDevelopments: [
        "On-device AI improves privacy and latency for assistants and cameras.",
        "Generative AI assistants help draft messages and summarize content.",
      ],
      takeaways: [
        "AI is already pervasive in consumer products.",
        "Convenience trades off with privacy and autonomy.",
      ],
      activities: [
        "Audit one app you use and list where AI is likely involved.",
        "Adjust a personalization setting and observe the change.",
      ],
    },
    mcqs: [
      { q: "A streaming 'because you watched…' row is powered by…", options: ["A recommendation system", "A spreadsheet", "A firewall", "A printer driver"], answer: "A recommendation system", explanation: "Recommenders personalize suggestions from behavior." },
      { q: "Voice assistants primarily rely on…", options: ["Computer vision only", "Natural language processing", "Blockchain", "Spreadsheets"], answer: "Natural language processing", explanation: "NLP interprets spoken/written language." },
      { q: "Face unlock uses…", options: ["Computer vision", "Reinforcement rewards only", "Audio processing", "Databases only"], answer: "Computer vision", explanation: "Vision models recognize faces." },
      { q: "A 'filter bubble' is…", options: ["A privacy setting", "Narrowed exposure due to heavy personalization", "A hardware chip", "A dataset split"], answer: "Narrowed exposure due to heavy personalization", explanation: "Personalization can limit diversity of content." },
      { q: "On-device AI improves…", options: ["Only marketing", "Privacy and latency", "Font rendering", "Battery capacity physically"], answer: "Privacy and latency", explanation: "Local processing keeps data on device and is fast." },
      { q: "Live navigation ETAs use AI to…", options: ["Ignore traffic", "Predict travel time from conditions", "Draw the map only", "Play music"], answer: "Predict travel time from conditions", explanation: "Models forecast ETAs from live/historical data." },
      { q: "Real-time captions are an application of…", options: ["Speech recognition (NLP/ASR)", "3D printing", "Cryptography", "Compilers"], answer: "Speech recognition (NLP/ASR)", explanation: "ASR converts speech to text." },
      { q: "Good personalization design gives users…", options: ["No control", "Transparency and opt-outs", "Hidden settings only", "Mandatory tracking"], answer: "Transparency and opt-outs", explanation: "User control builds trust." },
      { q: "Photo search by content uses…", options: ["Computer vision", "A thermostat", "A router", "A keyboard"], answer: "Computer vision", explanation: "Vision models tag/search image content." },
      { q: "Everyday AI mostly operates…", options: ["Visibly with warnings", "Invisibly in the background", "Only in labs", "Only on supercomputers"], answer: "Invisibly in the background", explanation: "Most consumer AI is unobtrusive." },
    ],
    tfs: [
      TF("Recommendation systems personalize based on user behavior.", true, "They learn from interactions."),
      TF("AI is rarely used in consumer apps today.", false, "It is pervasive."),
      TF("Personalization can reduce the diversity of content a user sees.", true, "This is the filter-bubble effect."),
      TF("On-device AI can improve privacy.", true, "Data stays on the device."),
      TF("Voice assistants use natural language processing.", true, "NLP is core to them."),
    ],
    scenarios: [
      { q: "A user worries a shopping app 'knows too much'. Explain what's likely happening and how they can regain control.", guidance: "Explain behavioral personalization, data collection, and privacy/opt-out settings and transparency." },
      { q: "Design a recommendation feature that is helpful without trapping users in a filter bubble.", guidance: "Discuss diversity/exploration, user control, and transparency in ranking." },
    ],
  },

  // ─────────────────────────────────────────────────────────────── Module 5
  {
    title: "AI Across Industries and Public Systems",
    description: "How AI transforms healthcare, finance, agriculture, transport, and government services.",
    lessonTitle: "AI in Industry and Public Life",
    sections: {
      overview:
        "AI is reshaping sectors from healthcare to public administration — improving diagnosis, forecasting, logistics and service delivery, while raising accountability questions.",
      keyConcepts: [
        "Predictive analytics forecasts demand, risk and outcomes.",
        "Computer vision aids diagnosis and quality inspection.",
        "Optimization improves routing, scheduling and resource allocation.",
        "Public-sector AI must meet fairness, transparency and accountability standards.",
      ],
      useCases: [
        "Healthcare: imaging triage and early risk detection.",
        "Agriculture: crop monitoring and yield prediction.",
        "Transport & public systems: traffic optimization and benefits screening.",
      ],
      bestPractices: [
        "Keep a human in the loop for high-stakes decisions.",
        "Audit models for fairness across affected groups.",
        "Provide clear appeal/redress paths in public systems.",
      ],
      recentDevelopments: [
        "Foundation models fine-tuned for medical and legal domains.",
        "AI-assisted early-warning systems for disasters and outbreaks.",
      ],
      takeaways: [
        "AI adds most value in prediction, vision and optimization.",
        "Public-sector use demands extra accountability.",
      ],
      activities: [
        "Pick an industry and map one AI opportunity and one risk.",
        "Draft an accountability checklist for a public-sector AI tool.",
      ],
    },
    mcqs: [
      { q: "In healthcare, AI commonly assists with…", options: ["Medical imaging triage", "Replacing all doctors", "Billing fonts", "Cafeteria menus"], answer: "Medical imaging triage", explanation: "Vision models help prioritize/flag images." },
      { q: "Predictive analytics is used to…", options: ["Forecast demand and risk", "Draw logos", "Encrypt files only", "Print reports"], answer: "Forecast demand and risk", explanation: "It forecasts future outcomes." },
      { q: "For high-stakes public decisions, best practice is…", options: ["Full automation with no oversight", "A human in the loop", "No documentation", "Hidden logic"], answer: "A human in the loop", explanation: "Humans should oversee high-stakes calls." },
      { q: "AI in agriculture can…", options: ["Monitor crops and predict yield", "Replace soil", "Control weather", "Grow food without land"], answer: "Monitor crops and predict yield", explanation: "Vision + prediction support farming." },
      { q: "Optimization in logistics improves…", options: ["Routing and scheduling", "Only marketing slogans", "Employee birthdays", "Screen brightness"], answer: "Routing and scheduling", explanation: "Optimization allocates resources efficiently." },
      { q: "Public-sector AI especially requires…", options: ["Fairness, transparency, accountability", "Secrecy", "No appeals", "Maximal opacity"], answer: "Fairness, transparency, accountability", explanation: "Citizens need accountable systems." },
      { q: "Foundation models in medicine are typically…", options: ["Used unchanged", "Fine-tuned for the domain", "Never validated", "Purely random"], answer: "Fine-tuned for the domain", explanation: "Domain fine-tuning improves relevance/safety." },
      { q: "An AI early-warning system aims to…", options: ["Predict and alert before events", "React only after disasters", "Replace responders", "Ignore data"], answer: "Predict and alert before events", explanation: "Early warning is proactive." },
      { q: "A fairness audit checks…", options: ["Model color scheme", "Outcomes across affected groups", "Server temperature", "Font size"], answer: "Outcomes across affected groups", explanation: "Audits compare group outcomes." },
      { q: "Appeal/redress paths matter most in…", options: ["Public benefits decisions", "Music playlists", "Screen savers", "Wallpaper choice"], answer: "Public benefits decisions", explanation: "High-impact decisions need redress." },
    ],
    tfs: [
      TF("AI can help forecast disease outbreaks earlier.", true, "Early-warning models support this."),
      TF("Public-sector AI needs no accountability.", false, "It needs strong accountability."),
      TF("A human in the loop is advisable for high-stakes decisions.", true, "Oversight reduces harm."),
      TF("AI in agriculture can support yield prediction.", true, "Prediction is a common use."),
      TF("Fairness audits examine outcomes across groups.", true, "That is their purpose."),
    ],
    scenarios: [
      { q: "A city wants an AI system to prioritize benefit applications. What safeguards would you require before deployment?", guidance: "Human oversight, fairness audits, transparency, appeal paths, and monitoring." },
      { q: "A hospital plans an AI imaging triage tool. Describe how to deploy it responsibly.", guidance: "Clinician-in-the-loop, validation on local data, monitoring, and clear scope/limits." },
    ],
  },

  // ─────────────────────────────────────────────────────────────── Module 6
  {
    title: "AI in Education, Research and Creativity",
    description: "AI as a tutor, research accelerator and creative collaborator — with its limits and integrity concerns.",
    lessonTitle: "AI for Learning and Creativity",
    sections: {
      overview:
        "AI is transforming how we learn, discover and create — personalized tutoring, literature search, and generative tools for text, images, music and code — while raising integrity and originality questions.",
      keyConcepts: [
        "Adaptive learning tailors pace and content to each learner.",
        "Generative AI produces novel text, images, audio and code.",
        "AI accelerates literature review and hypothesis generation.",
        "Academic integrity and attribution matter when using AI.",
      ],
      useCases: [
        "Personalized tutoring and instant feedback.",
        "Summarizing papers and drafting research outlines.",
        "Assisting artists, writers and designers.",
      ],
      bestPractices: [
        "Use AI as a collaborator, verify its outputs.",
        "Disclose AI assistance where required.",
        "Guard against plagiarism and hallucinated citations.",
      ],
      recentDevelopments: [
        "Multimodal creative tools generating images and video from prompts.",
        "AI copilots embedded in writing, coding and design tools.",
      ],
      takeaways: [
        "AI augments learning and creativity but needs human verification.",
        "Integrity and attribution are essential.",
      ],
      activities: [
        "Use an AI tutor to learn a concept, then verify it independently.",
        "Co-create something with a generative tool and critique the result.",
      ],
    },
    mcqs: [
      { q: "Adaptive learning systems…", options: ["Teach everyone identically", "Tailor pace/content to the learner", "Ignore performance", "Only grade"], answer: "Tailor pace/content to the learner", explanation: "They personalize instruction." },
      { q: "Generative AI can produce…", options: ["Only numbers", "Novel text, images, audio and code", "Nothing new", "Only spreadsheets"], answer: "Novel text, images, audio and code", explanation: "It generates new content across modalities." },
      { q: "A key risk when citing AI output is…", options: ["Perfect citations", "Hallucinated or fake references", "Too much rigor", "No risk"], answer: "Hallucinated or fake references", explanation: "Models can fabricate citations." },
      { q: "Best practice with AI-generated content is to…", options: ["Trust it blindly", "Verify and disclose usage", "Hide its use always", "Never edit"], answer: "Verify and disclose usage", explanation: "Verification and disclosure protect integrity." },
      { q: "In research, AI can accelerate…", options: ["Literature review", "Physical lab cleaning", "Coffee brewing", "Nothing"], answer: "Literature review", explanation: "It summarizes and surfaces relevant work." },
      { q: "An AI copilot in coding tools…", options: ["Replaces all engineers", "Suggests and drafts code", "Deletes code randomly", "Only formats text"], answer: "Suggests and drafts code", explanation: "Copilots assist, humans review." },
      { q: "Academic integrity with AI requires…", options: ["No attribution", "Appropriate disclosure/attribution", "Plagiarism", "Secrecy"], answer: "Appropriate disclosure/attribution", explanation: "Disclosure maintains integrity." },
      { q: "AI as a creative tool is best seen as…", options: ["A replacement for creativity", "A collaborator", "Irrelevant", "Only a toy"], answer: "A collaborator", explanation: "It augments human creativity." },
      { q: "Multimodal creative tools generate…", options: ["Only text", "Images and video from prompts", "Only audio", "Nothing"], answer: "Images and video from prompts", explanation: "They span multiple media." },
      { q: "When learning from an AI tutor you should…", options: ["Accept everything", "Verify key facts independently", "Skip practice", "Avoid questions"], answer: "Verify key facts independently", explanation: "Verification catches errors." },
    ],
    tfs: [
      TF("Generative AI can hallucinate incorrect facts.", true, "It can produce plausible but false output."),
      TF("Disclosing AI assistance can be part of academic integrity.", true, "Transparency supports integrity."),
      TF("Adaptive learning personalizes to the learner.", true, "That is its purpose."),
      TF("AI outputs never need verification.", false, "They should always be checked."),
      TF("AI can assist literature review in research.", true, "It summarizes and surfaces sources."),
    ],
    scenarios: [
      { q: "A student uses AI to draft an essay. What guidance keeps this ethical and educational?", guidance: "Verification, disclosure, using AI to learn rather than replace effort, and checking citations." },
      { q: "A researcher wants to use AI to speed up a literature review. What are the benefits and pitfalls?", guidance: "Faster discovery/summarization vs hallucinated citations; verify all references." },
    ],
  },

  // ─────────────────────────────────────────────────────────────── Module 7
  {
    title: "Building AI Projects",
    description: "The lifecycle of an AI project: problem framing, data, modeling, evaluation and deployment.",
    lessonTitle: "From Idea to Deployed AI",
    sections: {
      overview:
        "Successful AI projects follow a lifecycle: frame the problem, gather and prepare data, build and evaluate a model, then deploy and monitor it. Most effort is data and evaluation, not modeling.",
      keyConcepts: [
        "Problem framing: define the task, users, and success metric first.",
        "Data collection, cleaning and labeling dominate project time.",
        "Baselines before complex models.",
        "Deployment includes monitoring for drift and failure.",
      ],
      useCases: [
        "A demand-forecasting pipeline for a retailer.",
        "A support-ticket classifier.",
        "A defect-detection vision system on a production line.",
      ],
      bestPractices: [
        "Start with a simple baseline and iterate.",
        "Choose a metric that reflects real business value.",
        "Plan for monitoring, rollback and retraining.",
      ],
      recentDevelopments: [
        "MLOps tools standardize deployment, monitoring and retraining.",
        "Low-code/AutoML lowers the barrier to building models.",
      ],
      takeaways: [
        "Framing and data determine success more than algorithm choice.",
        "Deployment is the start of the maintenance journey, not the end.",
      ],
      activities: [
        "Write a one-page problem framing for an AI idea.",
        "List monitoring metrics you would track post-deployment.",
      ],
    },
    mcqs: [
      { q: "The first step of an AI project should be…", options: ["Pick the fanciest model", "Frame the problem and success metric", "Deploy immediately", "Buy GPUs"], answer: "Frame the problem and success metric", explanation: "Framing guides everything else." },
      { q: "Most project effort typically goes to…", options: ["Choosing a model name", "Data collection, cleaning, labeling", "Picking colors", "Writing slides"], answer: "Data collection, cleaning, labeling", explanation: "Data work dominates timelines." },
      { q: "A baseline model is used to…", options: ["Waste time", "Set a simple reference to beat", "Replace evaluation", "Avoid data"], answer: "Set a simple reference to beat", explanation: "Baselines contextualize improvements." },
      { q: "Model drift refers to…", options: ["Faster training", "Performance degrading as data changes over time", "Better accuracy", "A UI bug"], answer: "Performance degrading as data changes over time", explanation: "Drift happens when the world shifts." },
      { q: "A good success metric should…", options: ["Be arbitrary", "Reflect real business/user value", "Ignore the goal", "Only measure speed"], answer: "Reflect real business/user value", explanation: "Metrics must map to value." },
      { q: "MLOps helps with…", options: ["Deployment, monitoring, retraining", "Only training", "Graphic design", "Payroll"], answer: "Deployment, monitoring, retraining", explanation: "MLOps operationalizes ML." },
      { q: "After deployment you should…", options: ["Stop monitoring", "Monitor and be ready to retrain/rollback", "Delete the model", "Ignore failures"], answer: "Monitor and be ready to retrain/rollback", explanation: "Ongoing monitoring is essential." },
      { q: "AutoML mainly…", options: ["Removes the need for data", "Lowers the barrier to building models", "Guarantees perfect models", "Replaces problem framing"], answer: "Lowers the barrier to building models", explanation: "It automates parts of modeling." },
      { q: "You should choose a complex model…", options: ["Always first", "Only if a baseline is insufficient", "Never", "To impress stakeholders"], answer: "Only if a baseline is insufficient", explanation: "Add complexity only when justified." },
      { q: "Evaluation should use…", options: ["Training data only", "A held-out test set reflecting real conditions", "No data", "Random guesses"], answer: "A held-out test set reflecting real conditions", explanation: "Realistic held-out evaluation matters." },
    ],
    tfs: [
      TF("Data work usually consumes most of an AI project.", true, "Data prep dominates effort."),
      TF("Deployment is the final step with no follow-up needed.", false, "Monitoring and retraining follow."),
      TF("Starting with a simple baseline is good practice.", true, "Baselines guide iteration."),
      TF("Model drift can degrade performance over time.", true, "The world changes; models decay."),
      TF("The success metric should reflect real value.", true, "Otherwise optimization misleads."),
    ],
    scenarios: [
      { q: "You're asked to 'add AI' to a product with a vague goal. Walk through how you'd frame and de-risk the project.", guidance: "Define task/users/metric, check data feasibility, baseline first, plan evaluation and monitoring." },
      { q: "A deployed model's accuracy is slowly declining. What is likely happening and how do you respond?", guidance: "Diagnose drift; monitor, collect fresh data, retrain, and consider rollback." },
    ],
  },

  // ─────────────────────────────────────────────────────────────── Module 8
  {
    title: "AI Careers and Organizations",
    description: "Roles in AI, how teams are structured, and how organizations adopt AI successfully.",
    lessonTitle: "Working With and In AI",
    sections: {
      overview:
        "AI work spans many roles — data, engineering, product, ethics and leadership. Organizations succeed by combining talent, data infrastructure and a clear strategy.",
      keyConcepts: [
        "Roles: data scientist, ML engineer, data engineer, product manager, AI ethicist.",
        "Cross-functional teams beat lone experts.",
        "AI strategy aligns projects to business goals.",
        "You don't need to be a coder to contribute to AI.",
      ],
      useCases: [
        "A product manager scoping an AI feature.",
        "A data engineer building reliable pipelines.",
        "A domain expert validating model behavior.",
      ],
      bestPractices: [
        "Start with high-value, feasible use cases.",
        "Invest in data infrastructure early.",
        "Build cross-functional literacy, not just specialists.",
      ],
      recentDevelopments: [
        "Growing demand for AI product and governance roles.",
        "AI literacy programs across non-technical staff.",
      ],
      takeaways: [
        "AI is a team sport across many roles.",
        "Strategy and data foundations enable success.",
      ],
      activities: [
        "Map which AI role best fits your strengths.",
        "Sketch a cross-functional team for an AI feature.",
      ],
    },
    mcqs: [
      { q: "Who typically builds reliable data pipelines?", options: ["Data engineer", "Graphic designer", "Receptionist", "Security guard"], answer: "Data engineer", explanation: "Data engineers own pipelines." },
      { q: "AI projects succeed best with…", options: ["A single genius", "Cross-functional teams", "No strategy", "Only executives"], answer: "Cross-functional teams", explanation: "Diverse roles collaborate." },
      { q: "An AI ethicist focuses on…", options: ["Fairness, safety and responsible use", "GPU cooling", "Office snacks", "Payroll"], answer: "Fairness, safety and responsible use", explanation: "Ethics roles guard responsible AI." },
      { q: "You can contribute to AI…", options: ["Only as a coder", "In technical and non-technical roles", "Only as a CEO", "Never"], answer: "In technical and non-technical roles", explanation: "Many roles are non-technical." },
      { q: "AI strategy should…", options: ["Ignore business goals", "Align projects to business value", "Chase hype", "Avoid measurement"], answer: "Align projects to business value", explanation: "Strategy ties AI to value." },
      { q: "A product manager in AI…", options: ["Writes all model code", "Scopes use cases and outcomes", "Runs the servers", "Designs chips"], answer: "Scopes use cases and outcomes", explanation: "PMs define the what/why." },
      { q: "Early organizational investment should include…", options: ["Only marketing", "Data infrastructure", "Nothing", "Only hardware"], answer: "Data infrastructure", explanation: "Good data foundations enable AI." },
      { q: "Growing new roles include…", options: ["AI product and governance", "Typewriter repair", "Fax operator", "None"], answer: "AI product and governance", explanation: "Governance/product demand is rising." },
      { q: "AI literacy programs target…", options: ["Only engineers", "Non-technical staff too", "No one", "Only interns"], answer: "Non-technical staff too", explanation: "Broad literacy helps adoption." },
      { q: "A domain expert on an AI team…", options: ["Is unnecessary", "Validates model behavior in context", "Only takes notes", "Replaces data"], answer: "Validates model behavior in context", explanation: "Experts ground models in reality." },
    ],
    tfs: [
      TF("Only programmers can work in AI.", false, "Many roles are non-technical."),
      TF("Cross-functional collaboration improves AI outcomes.", true, "Diverse roles are needed."),
      TF("AI strategy should align with business goals.", true, "Alignment drives value."),
      TF("Data infrastructure is irrelevant to AI adoption.", false, "It is foundational."),
      TF("AI governance is a growing career area.", true, "Demand is increasing."),
    ],
    scenarios: [
      { q: "A non-technical manager wants to contribute to their company's AI efforts. Advise them on how.", guidance: "Domain expertise, product framing, data quality, ethics/governance, and AI literacy." },
      { q: "A company keeps failing at AI projects. What organizational changes would you recommend?", guidance: "Strategy alignment, data infrastructure, cross-functional teams, and focusing on feasible high-value use cases." },
    ],
  },

  // ─────────────────────────────────────────────────────────────── Module 9
  {
    title: "AI and the Economy",
    description: "How AI affects productivity, markets, inequality and economic growth.",
    lessonTitle: "The Economics of AI",
    sections: {
      overview:
        "AI is a general-purpose technology that can boost productivity and growth, reshape markets, and shift the distribution of income — with both opportunities and risks.",
      keyConcepts: [
        "General-purpose technologies drive broad, long-run productivity gains.",
        "Automation can raise output but also displace tasks.",
        "AI can concentrate or broaden economic gains depending on policy.",
        "Complementarity: AI often augments rather than fully replaces workers.",
      ],
      useCases: [
        "Productivity tools that speed up knowledge work.",
        "Predictive maintenance reducing downtime costs.",
        "Dynamic pricing and demand forecasting.",
      ],
      bestPractices: [
        "Measure real productivity, not just adoption.",
        "Pair automation with reskilling investment.",
        "Consider distributional effects in policy.",
      ],
      recentDevelopments: [
        "Generative AI raising productivity in writing, coding and support.",
        "Debates on AI's effect on wages and inequality.",
      ],
      takeaways: [
        "AI is a general-purpose technology with economy-wide effects.",
        "Outcomes depend on complementary investments and policy.",
      ],
      activities: [
        "Estimate a productivity gain from an AI tool you use.",
        "List one winner and one at-risk group from AI automation.",
      ],
    },
    mcqs: [
      { q: "AI is often described as a…", options: ["General-purpose technology", "Niche gadget", "Temporary fad", "Single product"], answer: "General-purpose technology", explanation: "Like electricity, it affects many sectors." },
      { q: "Automation can…", options: ["Only create jobs", "Raise output and displace some tasks", "Never change work", "Only destroy value"], answer: "Raise output and displace some tasks", explanation: "It has mixed effects." },
      { q: "Complementarity means AI…", options: ["Always fully replaces workers", "Often augments workers", "Has no effect", "Only replaces machines"], answer: "Often augments workers", explanation: "AI frequently complements human work." },
      { q: "Whether AI broadens or concentrates gains depends on…", options: ["Nothing", "Policy and complementary investment", "Only luck", "The weather"], answer: "Policy and complementary investment", explanation: "Institutions shape distribution." },
      { q: "Predictive maintenance reduces…", options: ["Downtime costs", "Employee morale", "Data quality", "Product demand"], answer: "Downtime costs", explanation: "It prevents costly failures." },
      { q: "A responsible automation strategy pairs it with…", options: ["Reskilling investment", "No training", "Hiding impacts", "Ignoring workers"], answer: "Reskilling investment", explanation: "Reskilling eases transitions." },
      { q: "Generative AI has raised productivity notably in…", options: ["Writing, coding, support", "Only mining", "Only agriculture", "Nowhere"], answer: "Writing, coding, support", explanation: "Knowledge work sees gains." },
      { q: "Distributional effects concern…", options: ["Who gains and who loses", "Only total output", "Font choices", "Server uptime"], answer: "Who gains and who loses", explanation: "Distribution matters for equity." },
      { q: "Measuring AI value should focus on…", options: ["Adoption headlines", "Real productivity outcomes", "Vanity metrics", "Press releases"], answer: "Real productivity outcomes", explanation: "Outcomes, not hype, matter." },
      { q: "General-purpose technologies historically…", options: ["Have no long-run impact", "Drive broad long-run productivity", "Only help one firm", "Reduce all output"], answer: "Drive broad long-run productivity", explanation: "They diffuse widely over time." },
    ],
    tfs: [
      TF("AI can both raise productivity and displace some tasks.", true, "Its effects are mixed."),
      TF("AI always fully replaces human workers.", false, "It often augments them."),
      TF("Policy influences how AI's economic gains are distributed.", true, "Institutions matter."),
      TF("Reskilling can ease automation transitions.", true, "It helps workers adapt."),
      TF("AI is a general-purpose technology.", true, "It affects many sectors."),
    ],
    scenarios: [
      { q: "A government fears AI will worsen inequality. What policy levers could broaden the gains?", guidance: "Reskilling, education, safety nets, competition policy, and complementary infrastructure investment." },
      { q: "A firm adopts AI but sees no productivity gain. What might explain this and what would you check?", guidance: "Complementary investments, process redesign, adoption vs real usage, and measuring genuine outcomes." },
    ],
  },

  // ─────────────────────────────────────────────────────────────── Module 10
  {
    title: "AI and the Future of Work",
    description: "How jobs, skills and workplaces change as AI augments and automates tasks.",
    lessonTitle: "Work in the Age of AI",
    sections: {
      overview:
        "AI changes work at the task level: some tasks are automated, others augmented, and new tasks emerge. Adaptability and human skills that complement AI grow in value.",
      keyConcepts: [
        "Jobs are bundles of tasks; AI affects tasks, not whole jobs uniformly.",
        "Human-AI collaboration (augmentation) is the dominant near-term pattern.",
        "Durable human skills: judgment, empathy, creativity, communication.",
        "Continuous learning becomes a core career skill.",
      ],
      useCases: [
        "Support agents assisted by AI suggestions.",
        "Analysts using AI to draft and summarize.",
        "New roles: prompt design, AI oversight, model governance.",
      ],
      bestPractices: [
        "Redesign workflows around human+AI, not just tool drop-in.",
        "Invest in reskilling and internal mobility.",
        "Keep humans accountable for AI-assisted decisions.",
      ],
      recentDevelopments: [
        "Copilots embedded across office and developer tools.",
        "Emerging job categories in AI oversight and safety.",
      ],
      takeaways: [
        "AI reshapes tasks; adaptability is the key skill.",
        "Human judgment and accountability remain essential.",
      ],
      activities: [
        "Break your job into tasks and label automate/augment/unchanged.",
        "Identify one new skill to grow for an AI-augmented workplace.",
      ],
    },
    mcqs: [
      { q: "AI most directly affects work at the level of…", options: ["Whole industries only", "Individual tasks", "Building architecture", "Office furniture"], answer: "Individual tasks", explanation: "Jobs are bundles of tasks." },
      { q: "The dominant near-term pattern is…", options: ["Full automation of all jobs", "Human-AI augmentation", "No change", "AI unemployment for all"], answer: "Human-AI augmentation", explanation: "Augmentation leads in the near term." },
      { q: "Skills that complement AI include…", options: ["Judgment and empathy", "Only typing speed", "Ignoring change", "Memorizing tables"], answer: "Judgment and empathy", explanation: "Human skills complement AI." },
      { q: "A core career skill in the AI era is…", options: ["Avoiding all tools", "Continuous learning", "Resisting change", "Doing nothing new"], answer: "Continuous learning", explanation: "Adaptability is essential." },
      { q: "New AI-era roles include…", options: ["AI oversight and governance", "Fax repair", "Nothing new", "Only manual labor"], answer: "AI oversight and governance", explanation: "Oversight roles are emerging." },
      { q: "Workflows should be…", options: ["Left unchanged", "Redesigned around human+AI", "Removed entirely", "Made secret"], answer: "Redesigned around human+AI", explanation: "Redesign captures value." },
      { q: "Accountability for AI-assisted decisions rests with…", options: ["The humans/organizations", "No one", "The keyboard", "The internet"], answer: "The humans/organizations", explanation: "Humans remain accountable." },
      { q: "Reskilling and internal mobility help…", options: ["Workers adapt to change", "Increase downtime", "Reduce morale", "Avoid learning"], answer: "Workers adapt to change", explanation: "They ease transitions." },
      { q: "Copilots in office tools primarily…", options: ["Replace all staff", "Augment everyday tasks", "Delete files", "Do nothing"], answer: "Augment everyday tasks", explanation: "They assist common tasks." },
      { q: "A resilient response to AI at work is to…", options: ["Ignore it", "Learn to collaborate with it", "Ban it", "Fear it only"], answer: "Learn to collaborate with it", explanation: "Collaboration builds resilience." },
    ],
    tfs: [
      TF("AI affects tasks within jobs, not always whole jobs at once.", true, "Jobs are task bundles."),
      TF("Human judgment becomes irrelevant with AI at work.", false, "It remains essential and accountable."),
      TF("Continuous learning is a valuable skill in an AI-augmented workplace.", true, "Adaptability matters."),
      TF("New job categories can emerge from AI adoption.", true, "E.g., AI oversight roles."),
      TF("Augmentation is a more common near-term pattern than full automation.", true, "Human+AI collaboration leads."),
    ],
    scenarios: [
      { q: "Your team fears AI will take their jobs. How would you lead a constructive conversation and plan?", guidance: "Task-level analysis, augmentation framing, reskilling, redefined roles, and human accountability." },
      { q: "Design an AI-augmented workflow for a customer-support team that keeps humans in control.", guidance: "AI drafts/suggests, humans review and decide, with monitoring and accountability." },
    ],
  },

  // ─────────────────────────────────────────────────────────────── Module 11
  {
    title: "Ethics, Safety and Responsible AI",
    description: "Bias, privacy, transparency, accountability and safety in building and using AI.",
    lessonTitle: "Building AI Responsibly",
    sections: {
      overview:
        "Responsible AI means addressing bias, protecting privacy, being transparent, ensuring accountability, and managing safety risks throughout the AI lifecycle.",
      keyConcepts: [
        "Bias can enter via data, design and deployment.",
        "Privacy: minimize data, obtain consent, and secure it.",
        "Explainability helps stakeholders understand and contest decisions.",
        "Accountability: someone must be responsible for AI outcomes.",
        "Safety: test for misuse, robustness and harmful failure modes.",
      ],
      useCases: [
        "Auditing a lending model for disparate impact.",
        "Privacy-preserving techniques for sensitive data.",
        "Red-teaming a generative model for misuse.",
      ],
      bestPractices: [
        "Do fairness and privacy reviews before launch.",
        "Keep humans accountable and provide redress.",
        "Document limitations and monitor after deployment.",
      ],
      recentDevelopments: [
        "AI regulations and risk-based frameworks emerging worldwide.",
        "Standardized model documentation (model cards) and evaluations.",
      ],
      takeaways: [
        "Responsible AI spans bias, privacy, transparency, accountability, safety.",
        "It is a lifecycle practice, not a one-time checkbox.",
      ],
      activities: [
        "Write a short 'responsible AI' checklist for a project.",
        "Identify one bias risk and one mitigation for a chosen use case.",
      ],
    },
    mcqs: [
      { q: "Bias in AI can originate from…", options: ["Only hardware", "Data, design and deployment", "Only users", "Nowhere"], answer: "Data, design and deployment", explanation: "Bias can enter at multiple stages." },
      { q: "A core privacy principle is…", options: ["Collect everything", "Data minimization and consent", "Never secure data", "Sell all data"], answer: "Data minimization and consent", explanation: "Collect only what's needed, with consent." },
      { q: "Explainability primarily helps…", options: ["Hide decisions", "Stakeholders understand/contest decisions", "Slow models down", "Increase bias"], answer: "Stakeholders understand/contest decisions", explanation: "It supports transparency and redress." },
      { q: "Accountability in AI means…", options: ["No one is responsible", "Someone is responsible for outcomes", "The model decides alone", "Blaming users"], answer: "Someone is responsible for outcomes", explanation: "Clear ownership is required." },
      { q: "Red-teaming a model tests for…", options: ["Marketing appeal", "Misuse and harmful failures", "Faster training", "Nicer fonts"], answer: "Misuse and harmful failures", explanation: "Red-teaming probes weaknesses." },
      { q: "A model card documents…", options: ["A model's purpose, performance and limits", "Only the logo", "The CEO's bio", "Server prices"], answer: "A model's purpose, performance and limits", explanation: "Model cards standardize documentation." },
      { q: "Responsible AI is best treated as…", options: ["A one-time checkbox", "A lifecycle practice", "Optional after launch", "Irrelevant"], answer: "A lifecycle practice", explanation: "It spans the whole lifecycle." },
      { q: "Disparate impact refers to…", options: ["Equal outcomes", "Unequal harm across groups", "Faster inference", "Better UX"], answer: "Unequal harm across groups", explanation: "It measures unequal effects." },
      { q: "Redress means users can…", options: ["Never appeal", "Contest or appeal a decision", "Only accept outcomes", "Be ignored"], answer: "Contest or appeal a decision", explanation: "Redress provides recourse." },
      { q: "Emerging AI regulation tends to be…", options: ["Risk-based", "Nonexistent", "Banning all AI", "Only about fonts"], answer: "Risk-based", explanation: "Many frameworks scale rules to risk." },
    ],
    tfs: [
      TF("Bias can enter AI through the training data.", true, "Data is a common source of bias."),
      TF("Collecting as much personal data as possible is a privacy best practice.", false, "Data minimization is preferred."),
      TF("Explainability can help people contest AI decisions.", true, "Transparency enables redress."),
      TF("Responsible AI is a one-time task done before launch.", false, "It is an ongoing lifecycle practice."),
      TF("Someone should be accountable for AI outcomes.", true, "Accountability is essential."),
    ],
    scenarios: [
      { q: "A lending model appears to reject certain groups more often. Outline a responsible investigation and remediation.", guidance: "Measure disparate impact, audit data/features, mitigate bias, add human review and redress, document." },
      { q: "Before launching a public generative AI assistant, what safety steps would you take?", guidance: "Red-teaming, misuse testing, guardrails, monitoring, documentation, and human oversight." },
    ],
  },

  // ─────────────────────────────────────────────────────────────── Module 12
  {
    title: "Future of AI and Capstone Project",
    description: "Emerging directions in AI and a capstone to synthesize the whole course.",
    lessonTitle: "Looking Ahead & Capstone",
    sections: {
      overview:
        "The final module surveys where AI is heading — more capable multimodal systems, agents, and stronger governance — and asks you to synthesize the course into a capstone project.",
      keyConcepts: [
        "Trends: multimodal models, autonomous agents, on-device AI, and stronger governance.",
        "Uncertainty: predictions are hard; focus on adaptable principles.",
        "A capstone integrates problem framing, data, ethics and evaluation.",
        "Responsible innovation balances capability with safety.",
      ],
      useCases: [
        "An agent that automates a multi-step workflow with oversight.",
        "A multimodal assistant combining text and images.",
        "A capstone applying the full AI lifecycle to a real problem.",
      ],
      bestPractices: [
        "Design your capstone with a clear metric and ethical review.",
        "Prefer feasible scope over ambitious but unrealistic goals.",
        "Reflect on limitations and future improvements.",
      ],
      recentDevelopments: [
        "Rapid progress in agentic and multimodal AI.",
        "Growing focus on AI governance and evaluation standards.",
      ],
      takeaways: [
        "AI will keep advancing; adaptable, responsible principles endure.",
        "The capstone ties together everything learned.",
      ],
      activities: [
        "Draft a capstone proposal: problem, data, approach, metric, ethics.",
        "Write a short reflection on the most important thing you learned.",
      ],
    },
    mcqs: [
      { q: "A major current AI trend is…", options: ["Multimodal and agentic systems", "Slower computers", "Less data", "Abandoning AI"], answer: "Multimodal and agentic systems", explanation: "Multimodal and agent AI are advancing fast." },
      { q: "Because predictions are uncertain, it's wise to…", options: ["Ignore the future", "Focus on adaptable principles", "Assume one fixed outcome", "Stop learning"], answer: "Focus on adaptable principles", explanation: "Adaptability beats fixed forecasts." },
      { q: "A capstone project should integrate…", options: ["Only coding", "Framing, data, ethics and evaluation", "Only slides", "Nothing learned"], answer: "Framing, data, ethics and evaluation", explanation: "It synthesizes the whole lifecycle." },
      { q: "An AI 'agent' typically…", options: ["Does one static task", "Takes multi-step actions toward a goal", "Only stores data", "Cannot use tools"], answer: "Takes multi-step actions toward a goal", explanation: "Agents plan and act over steps." },
      { q: "Responsible innovation balances…", options: ["Capability with safety", "Speed with secrecy", "Hype with more hype", "Nothing"], answer: "Capability with safety", explanation: "Both matter together." },
      { q: "On-device AI trends improve…", options: ["Privacy and latency", "Only cost of GPUs", "Nothing", "Font rendering"], answer: "Privacy and latency", explanation: "Local inference is private and fast." },
      { q: "A good capstone scope is…", options: ["Feasible and well-defined", "Impossibly broad", "Undefined", "Metric-free"], answer: "Feasible and well-defined", explanation: "Feasibility drives completion." },
      { q: "Governance of AI is…", options: ["Becoming more important", "Disappearing", "Irrelevant", "Only for logos"], answer: "Becoming more important", explanation: "Governance focus is growing." },
      { q: "The capstone reflection should include…", options: ["Only successes", "Limitations and future improvements", "Nothing critical", "Only praise"], answer: "Limitations and future improvements", explanation: "Honest reflection aids learning." },
      { q: "The enduring lesson across the course is…", options: ["AI is magic", "Use AI responsibly and adaptably", "Avoid AI entirely", "Trust AI blindly"], answer: "Use AI responsibly and adaptably", explanation: "Responsible, adaptable use endures." },
    ],
    tfs: [
      TF("Agentic AI can take multi-step actions toward a goal.", true, "Agents plan and act over steps."),
      TF("Because the future is certain, adaptability is unnecessary.", false, "The future is uncertain; adaptability matters."),
      TF("A capstone should integrate ethics as well as technical work.", true, "Responsible AI spans both."),
      TF("AI governance is becoming less important.", false, "It is growing in importance."),
      TF("A feasible, well-scoped capstone is more likely to succeed.", true, "Feasibility drives completion."),
    ],
    scenarios: [
      { q: "Propose a capstone project that applies the full AI lifecycle responsibly to a problem you care about.", guidance: "Include problem framing, data plan, approach, success metric, ethics review, and evaluation." },
      { q: "Reflecting on the whole course, argue what principles will stay relevant even as AI technology changes.", guidance: "Responsible use, data quality, human oversight, adaptability, and clear problem framing." },
    ],
  },
];

export const AI_COURSE_META = {
  title: "Demystifying AI for Everyone",
  slug: "demystifying-ai-for-everyone",
  instructor: "Dr. Sudhanshu Joshi",
  shortDescription:
    "A complete AI-literacy course — from what AI is to building responsible AI projects — in 12 modules.",
  description:
    "Demystifying AI for Everyone is a 12-module journey through artificial intelligence for a general audience: understanding AI, data, how AI learns, everyday and industry applications, careers, economics, the future of work, ethics and safety, and a capstone project. Taught by Dr. Sudhanshu Joshi.",
  level: "beginner" as const,
  tags: ["ai", "ai-literacy", "machine-learning", "ethics"],
  // Course-page metadata (editable in Admin → Courses → Course details). Each entry
  // names something the 12 modules actually teach.
  skills: [
    "AI literacy",
    "Machine learning fundamentals",
    "Data literacy",
    "Natural language processing",
    "Computer vision",
    "AI project lifecycle",
    "Responsible AI & ethics",
    "Critical evaluation of AI output",
  ],
  tools: [
    "Generative AI chatbots",
    "AI copilots",
    "Image & video generators",
    "Low-code / AutoML platforms",
    "MLOps tools",
  ],
  offeredBy: {
    name: "AI on Wheels",
    logoUrl: "",
    description: "",
    url: "",
  },
  // Course-level learning outcomes ("What you'll learn" on the course pages).
  learningObjectives: [
    "Understand AI and how it learns: Recognise AI in everyday life, distinguish it from simple automation, and explore how systems learn patterns from data.",
    "Use AI to support learning: Write clear prompts, create useful study materials, and check AI-generated answers against reliable information.",
    "Develop solutions for familiar problems: Explore applications in schools and communities, and plan a small AI-supported solution with clear goals and measures of success.",
    "Make responsible choices: Identify errors, bias, and privacy concerns while building critical thinking, collaboration, and human judgement skills.",
  ],
};

/** Estimated minutes per module assessment (10 MCQs, 5 True/False, 2 scenarios). */
export const MODULE_ASSESSMENT_MINUTES = 20;

/**
 * Learning objectives per module (by module title). Each one restates that
 * module's own key concepts / takeaways as something the learner can do.
 */
export const MODULE_LEARNING_OBJECTIVES: Record<string, string[]> = {
  "Understanding Artificial Intelligence": [
    "Explain what artificial intelligence is and distinguish today's narrow AI from general AI.",
    "Describe how AI, machine learning and deep learning relate to one another.",
    "Recognize milestones such as the Turing Test and the 'AI winters'.",
  ],
  "Data: The Foundation of AI": [
    "Distinguish structured from unstructured data, and labeled from unlabeled data.",
    "Explain why training, validation and test splits are needed to judge a model fairly.",
    "Describe how data quality and bias shape what an AI system can do ('garbage in, garbage out').",
  ],
  "How AI Learns": [
    "Compare supervised, unsupervised and reinforcement learning.",
    "Distinguish training a model from using it for inference.",
    "Explain overfitting and underfitting, and why generalization is the real goal.",
  ],
  "AI in Everyday Life": [
    "Identify AI in everyday products such as recommendations, assistants, translation and face unlock.",
    "Explain how natural language processing and computer vision power these tools.",
    "Weigh personalization and convenience against privacy, autonomy and filter bubbles.",
  ],
  "AI Across Industries and Public Systems": [
    "Describe how prediction, computer vision and optimization create value across industries.",
    "Give examples of AI in healthcare, finance, agriculture, transport and government services.",
    "Explain why public-sector AI must meet higher standards of fairness, transparency and accountability.",
  ],
  "AI in Education, Research and Creativity": [
    "Describe how adaptive learning and generative AI support teaching, research and creative work.",
    "Explain why AI-generated output needs human verification.",
    "Apply principles of academic integrity and attribution when using AI tools.",
  ],
  "Building AI Projects": [
    "Frame an AI problem by defining the task, its users and a success metric.",
    "Outline the project lifecycle: data, baseline, modeling, evaluation and deployment.",
    "Explain why deployed models must be monitored for drift and failure.",
  ],
  "AI Careers and Organizations": [
    "Describe the main roles in AI teams, including non-coding roles.",
    "Explain why cross-functional teams and a clear AI strategy drive success.",
    "Identify ways you can contribute to AI work without being a programmer.",
  ],
  "AI and the Economy": [
    "Explain why AI is considered a general-purpose technology.",
    "Describe how automation can raise productivity while displacing some tasks.",
    "Discuss how complementary investment and policy shape who benefits from AI.",
  ],
  "AI and the Future of Work": [
    "Explain why AI changes tasks within jobs rather than whole jobs uniformly.",
    "Describe human–AI collaboration as the dominant near-term pattern of work.",
    "Identify durable human skills — judgment, empathy, creativity, communication — and the role of continuous learning.",
  ],
  "Ethics, Safety and Responsible AI": [
    "Identify how bias can enter AI systems through data, design and deployment.",
    "Explain the principles of privacy, explainability, accountability and safety.",
    "Treat responsible AI as a practice across the whole lifecycle, not a one-time check.",
  ],
  "Future of AI and Capstone Project": [
    "Describe emerging AI trends: multimodal models, autonomous agents, on-device AI and stronger governance.",
    "Plan a capstone project that applies problem framing, data, ethics and evaluation together.",
    "Explain which responsible-innovation principles stay relevant as AI changes.",
  ],
};
