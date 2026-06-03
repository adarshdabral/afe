export type Category = "AI & ML" | "Web Dev" | "Data Science" | "Cloud";
export type Level = "Beginner" | "Intermediate" | "Advanced";
export type LessonType = "video" | "doc" | "quiz";

export interface Instructor {
  name: string;
  avatarInitials: string;
  bio: string;
  totalStudents: number;
  totalCourses: number;
  rating: number;
}

export interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  duration: string;
  isPreview: boolean;
}

export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  category: Category;
  instructor: Instructor;
  level: Level;
  duration: string;
  totalLessons: number;
  rating: number;
  reviewCount: number;
  enrolledCount: number;
  thumbnailColor: string;
  price: "Free";
  whatYouLearn: string[];
  modules: Module[];
}

export const instructors: Instructor[] = [
  { name: "Dr Sudhanshu Joshi", avatarInitials: "SJ", bio: "AI researcher with 12 years of experience at top labs. Author of three books on deep learning.", totalStudents: 8200, totalCourses: 6, rating: 4.9 },
  { name: "Dr Sudhanshu Joshi", avatarInitials: "SJ", bio: "Senior software engineer turned educator. Helps developers ship production-ready apps.", totalStudents: 5400, totalCourses: 4, rating: 4.8 },
  { name: "Dr Sudhanshu Joshi", avatarInitials: "SJ", bio: "Data scientist at a Fortune 500. Specializes in making statistics intuitive.", totalStudents: 6100, totalCourses: 5, rating: 4.7 },
  { name: "Dr Sudhanshu Joshi", avatarInitials: "SJ", bio: "Cloud solutions architect. AWS & GCP certified. Loves teaching infrastructure.", totalStudents: 3900, totalCourses: 3, rating: 4.6 },
];

const mkModules = (prefix: string): Module[] => [
  {
    id: `${prefix}-m1`, title: "Foundations",
    lessons: [
      { id: `${prefix}-m1-l1`, title: "Welcome & Overview", type: "video", duration: "5:20", isPreview: true },
      { id: `${prefix}-m1-l2`, title: "Core Concepts", type: "video", duration: "12:40", isPreview: true },
      { id: `${prefix}-m1-l3`, title: "Reading: Setup Guide", type: "doc", duration: "8 min", isPreview: false },
      { id: `${prefix}-m1-l4`, title: "Quiz: Foundations", type: "quiz", duration: "10 min", isPreview: false },
    ],
  },
  {
    id: `${prefix}-m2`, title: "Practical Skills",
    lessons: [
      { id: `${prefix}-m2-l1`, title: "Hands-on Project", type: "video", duration: "18:00", isPreview: false },
      { id: `${prefix}-m2-l2`, title: "Common Patterns", type: "video", duration: "14:30", isPreview: false },
      { id: `${prefix}-m2-l3`, title: "Reading: Best Practices", type: "doc", duration: "12 min", isPreview: false },
      { id: `${prefix}-m2-l4`, title: "Quiz: Skills Check", type: "quiz", duration: "15 min", isPreview: false },
    ],
  },
  {
    id: `${prefix}-m3`, title: "Real-world Application",
    lessons: [
      { id: `${prefix}-m3-l1`, title: "Capstone Walkthrough", type: "video", duration: "22:10", isPreview: false },
      { id: `${prefix}-m3-l2`, title: "Optimization Tips", type: "video", duration: "9:50", isPreview: false },
      { id: `${prefix}-m3-l3`, title: "Reading: Resources", type: "doc", duration: "6 min", isPreview: false },
      { id: `${prefix}-m3-l4`, title: "Final Quiz", type: "quiz", duration: "20 min", isPreview: false },
    ],
  },
];

const learn = [
  "Build production-ready projects from scratch",
  "Understand the core theory behind the practice",
  "Debug and optimize real-world code",
  "Apply industry best practices",
  "Work with modern tooling and ecosystems",
  "Collaborate effectively in teams",
  "Deploy and monitor your work in production",
  "Earn a verifiable certificate of completion",
];

export const courses: Course[] = [
  { id: "1", title: "AI For Everyone: From Zero to Deployment", description: "A complete beginner-friendly journey into AI, machine learning, and shipping intelligent products.", category: "AI & ML", instructor: instructors[0], level: "Beginner", duration: "8h 20m", totalLessons: 12, rating: 4.9, reviewCount: 1240, enrolledCount: 12480, thumbnailColor: "#6C63FF", price: "Free", whatYouLearn: learn, modules: mkModules("c1") },
  { id: "2", title: "Deep Learning with PyTorch", description: "Master neural networks, transformers, and modern deep learning with hands-on PyTorch labs.", category: "AI & ML", instructor: instructors[0], level: "Advanced", duration: "14h 10m", totalLessons: 12, rating: 4.8, reviewCount: 820, enrolledCount: 7200, thumbnailColor: "#8B5CF6", price: "Free", whatYouLearn: learn, modules: mkModules("c2") },
  { id: "3", title: "Modern React & Next.js Masterclass", description: "Build blazing-fast full-stack apps using React 19, server components, and the latest tooling.", category: "Web Dev", instructor: instructors[1], level: "Intermediate", duration: "11h 45m", totalLessons: 12, rating: 4.7, reviewCount: 980, enrolledCount: 9100, thumbnailColor: "#3B82F6", price: "Free", whatYouLearn: learn, modules: mkModules("c3") },
  { id: "4", title: "TypeScript in Depth", description: "From types to generics to advanced inference — write safer JavaScript at scale.", category: "Web Dev", instructor: instructors[1], level: "Intermediate", duration: "6h 30m", totalLessons: 12, rating: 4.6, reviewCount: 620, enrolledCount: 4800, thumbnailColor: "#2563EB", price: "Free", whatYouLearn: learn, modules: mkModules("c4") },
  { id: "5", title: "Data Science with Python", description: "Pandas, NumPy, visualization, and the full analytics pipeline — taught by a working data scientist.", category: "Data Science", instructor: instructors[2], level: "Beginner", duration: "9h 15m", totalLessons: 12, rating: 4.8, reviewCount: 1100, enrolledCount: 10200, thumbnailColor: "#10B981", price: "Free", whatYouLearn: learn, modules: mkModules("c5") },
  { id: "6", title: "Statistics for Machine Learning", description: "The math you actually need — probability, distributions, and inference made intuitive.", category: "Data Science", instructor: instructors[2], level: "Intermediate", duration: "7h 50m", totalLessons: 12, rating: 4.7, reviewCount: 540, enrolledCount: 4100, thumbnailColor: "#059669", price: "Free", whatYouLearn: learn, modules: mkModules("c6") },
  { id: "7", title: "AWS Cloud Practitioner", description: "Pass the certification and confidently navigate the AWS ecosystem.", category: "Cloud", instructor: instructors[3], level: "Beginner", duration: "5h 40m", totalLessons: 12, rating: 4.5, reviewCount: 410, enrolledCount: 3600, thumbnailColor: "#F59E0B", price: "Free", whatYouLearn: learn, modules: mkModules("c7") },
  { id: "8", title: "Kubernetes for Developers", description: "Deploy, scale, and operate containerized applications with confidence.", category: "Cloud", instructor: instructors[3], level: "Advanced", duration: "10h 00m", totalLessons: 12, rating: 4.6, reviewCount: 380, enrolledCount: 2900, thumbnailColor: "#D97706", price: "Free", whatYouLearn: learn, modules: mkModules("c8") },
  { id: "9", title: "Natural Language Processing", description: "From tokenization to transformers — build chatbots, classifiers, and summarizers.", category: "AI & ML", instructor: instructors[0], level: "Intermediate", duration: "9h 30m", totalLessons: 12, rating: 4.8, reviewCount: 720, enrolledCount: 6300, thumbnailColor: "#A78BFA", price: "Free", whatYouLearn: learn, modules: mkModules("c9") },
  { id: "10", title: "Full-Stack with Node & Postgres", description: "Build APIs, model data, and ship secure full-stack apps end-to-end.", category: "Web Dev", instructor: instructors[1], level: "Intermediate", duration: "12h 20m", totalLessons: 12, rating: 4.7, reviewCount: 860, enrolledCount: 7400, thumbnailColor: "#1D4ED8", price: "Free", whatYouLearn: learn, modules: mkModules("c10") },
];

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: "student";
  enrolledCourseIds: string[];
  progress: Record<string, number>;
  hoursLearned: number;
  certificatesEarned: number;
}

export const currentUser: CurrentUser = {
  id: "u1", name: "Aarav Singh", email: "aarav@example.com", role: "student",
  enrolledCourseIds: ["1", "2", "3"],
  progress: { "1": 65, "2": 30, "3": 90 },
  hoursLearned: 24, certificatesEarned: 1,
};

export interface QuizQuestion {
  id: string;
  type: "mcq" | "msq" | "truefalse" | "short";
  question: string;
  options?: string[];
  correctAnswer: string | string[];
}

export const quizQuestions: QuizQuestion[] = [
  { id: "q1", type: "mcq", question: "What does AI stand for?", options: ["Automated Intelligence", "Artificial Intelligence", "Applied Inference", "Adaptive Iteration"], correctAnswer: "Artificial Intelligence" },
  { id: "q2", type: "msq", question: "Which of these are supervised learning tasks?", options: ["Classification", "Clustering", "Regression", "Dimensionality reduction"], correctAnswer: ["Classification", "Regression"] },
  { id: "q3", type: "truefalse", question: "Neural networks always require GPUs to train.", options: ["True", "False"], correctAnswer: "False" },
  { id: "q4", type: "mcq", question: "Which library is most associated with deep learning in Python?", options: ["Pandas", "PyTorch", "NumPy", "Matplotlib"], correctAnswer: "PyTorch" },
  { id: "q5", type: "short", question: "In one sentence, define overfitting.", correctAnswer: "When a model learns the training data too well and fails to generalize." },
];

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  description: string;
  dueDate: string;
  maxMarks: number;
  status: "pending" | "submitted" | "graded";
  submittedFile?: string;
  grade?: number;
  feedback?: string;
}

export const assignments: Assignment[] = [
  { id: "a1", courseId: "1", title: "Build a Linear Regression Model", description: "Train a simple linear regression model on the provided dataset and submit your notebook with results and a brief writeup.", dueDate: "2026-06-05", maxMarks: 100, status: "pending" },
  { id: "a2", courseId: "2", title: "Image Classifier with CNN", description: "Train a CNN to classify CIFAR-10 images. Submit code + report.", dueDate: "2026-06-02", maxMarks: 100, status: "submitted", submittedFile: "cnn_classifier.ipynb" },
  { id: "a3", courseId: "3", title: "Build a Todo App in React", description: "Build a fully functional todo app with persistence.", dueDate: "2026-05-28", maxMarks: 100, status: "graded", submittedFile: "todo-app.zip", grade: 85, feedback: "Excellent component structure and clean code. Consider extracting the form into a custom hook for reusability." },
];

export interface Certificate {
  id: string;
  courseId: string;
  courseTitle: string;
  issuedDate: string;
  verificationId: string;
}

export const certificates: Certificate[] = [
  { id: "cert1", courseId: "3", courseTitle: "Modern React & Next.js Masterclass", issuedDate: "2026-05-12", verificationId: "AFE-CERT-3X9K-2026" },
  { id: "cert2", courseId: "4", courseTitle: "TypeScript in Depth", issuedDate: "2026-04-20", verificationId: "AFE-CERT-7Q2L-2026" },
  { id: "cert3", courseId: "7", courseTitle: "AWS Cloud Practitioner", issuedDate: "2026-03-15", verificationId: "AFE-CERT-9M4P-2026" },
];

export interface QnA {
  id: string;
  courseId: string;
  question: string;
  askedBy: string;
  timestamp: string;
  answer?: string;
  answeredBy?: string;
  upvotes: number;
}

export const qna: QnA[] = [
  { id: "qa1", courseId: "1", question: "How do I install PyTorch on Windows?", askedBy: "Riya M.", timestamp: "2h ago", answer: "Use the official installer from pytorch.org and pick the CUDA version matching your GPU drivers.", answeredBy: "Dr Sudhanshu Joshi", upvotes: 12 },
  { id: "qa2", courseId: "1", question: "Is calculus required for this course?", askedBy: "Karan V.", timestamp: "5h ago", upvotes: 4 },
  { id: "qa3", courseId: "1", question: "Can I use Google Colab instead of a local setup?", askedBy: "Sneha P.", timestamp: "1d ago", answer: "Yes — Colab is fully supported and recommended for beginners.", answeredBy: "Dr Sudhanshu Joshi", upvotes: 22 },
  { id: "qa4", courseId: "2", question: "When should I use batch normalization?", askedBy: "Alex T.", timestamp: "3h ago", upvotes: 6 },
  { id: "qa5", courseId: "3", question: "Does this cover React Server Components?", askedBy: "Megha S.", timestamp: "6h ago", answer: "Yes, module 2 covers RSC in detail.", answeredBy: "Dr Sudhanshu Joshi", upvotes: 9 },
  { id: "qa6", courseId: "3", question: "What's the difference between useEffect and useLayoutEffect?", askedBy: "Devon K.", timestamp: "1d ago", upvotes: 3 },
];

export interface Announcement {
  id: string;
  courseId: string;
  title: string;
  body: string;
  date: string;
}

export const announcements: Announcement[] = [
  { id: "an1", courseId: "1", title: "New bonus lesson added!", body: "We've added a new lesson covering recent advances in transformer architectures. Check it out in Module 3.", date: "2026-05-28" },
  { id: "an2", courseId: "1", title: "Office hours this Friday", body: "Join live Q&A this Friday at 6pm IST. Bring your questions!", date: "2026-05-26" },
  { id: "an3", courseId: "2", title: "Updated dataset", body: "The dataset for the CNN assignment has been refreshed. Please re-download.", date: "2026-05-25" },
  { id: "an4", courseId: "3", title: "Welcome cohort 12!", body: "A warm welcome to our newest learners.", date: "2026-05-20" },
];

export interface Review {
  id: string;
  courseId: string;
  studentName: string;
  avatarInitials: string;
  rating: number;
  date: string;
  text: string;
}

export const reviews: Review[] = [
  { id: "r1", courseId: "1", studentName: "Ananya R.", avatarInitials: "AR", rating: 5, date: "2 weeks ago", text: "This course completely demystified AI for me. The hands-on projects made everything click." },
  { id: "r2", courseId: "1", studentName: "Rohan S.", avatarInitials: "RS", rating: 5, date: "1 month ago", text: "Best AI course I've taken. The instructor explains complex topics in such an approachable way." },
  { id: "r3", courseId: "1", studentName: "Maya L.", avatarInitials: "ML", rating: 4, date: "1 month ago", text: "Excellent content. Would love even more deep-dive examples in the later modules." },
  { id: "r4", courseId: "3", studentName: "Karim B.", avatarInitials: "KB", rating: 5, date: "3 weeks ago", text: "Real-world React patterns I can use at work immediately." },
  { id: "r5", courseId: "3", studentName: "Priya V.", avatarInitials: "PV", rating: 5, date: "2 months ago", text: "The server components section is gold. Worth it just for that." },
  { id: "r6", courseId: "5", studentName: "Tom K.", avatarInitials: "TK", rating: 5, date: "1 week ago", text: "Practical, no-fluff data science. Highly recommended." },
];

export interface AdminStats {
  totalUsers: number;
  totalCourses: number;
  totalEnrollments: number;
  certificatesIssued: number;
  signupsPerDay: number[];
  revenuePerMonth: number[];
}

export const adminStats: AdminStats = {
  totalUsers: 12480, totalCourses: 340, totalEnrollments: 48200, certificatesIssued: 8900,
  signupsPerDay: [120, 145, 132, 168, 190, 210, 175, 195, 220, 240, 215, 260, 285, 310],
  revenuePerMonth: [32000, 38000, 41000, 39000, 45000, 48200],
};

export interface PendingInstructor {
  id: string; name: string; email: string; appliedOn: string; expertise: string;
}

export const pendingInstructors: PendingInstructor[] = [
  { id: "pi1", name: "Rahul Verma", email: "rahul@example.com", appliedOn: "2026-05-26", expertise: "Machine Learning" },
  { id: "pi2", name: "Sara Ahmed", email: "sara@example.com", appliedOn: "2026-05-25", expertise: "Frontend Engineering" },
  { id: "pi3", name: "Yuki Tanaka", email: "yuki@example.com", appliedOn: "2026-05-24", expertise: "Cloud & DevOps" },
];

export interface PendingCourse {
  id: string; title: string; instructorName: string; submittedOn: string; thumbnailColor: string;
}

export const pendingCourses: PendingCourse[] = [
  { id: "pc1", title: "Intro to Reinforcement Learning", instructorName: "Dr Sudhanshu Joshi", submittedOn: "2026-05-27", thumbnailColor: "#6C63FF" },
  { id: "pc2", title: "Advanced Tailwind Patterns", instructorName: "Dr Sudhanshu Joshi", submittedOn: "2026-05-26", thumbnailColor: "#3B82F6" },
  { id: "pc3", title: "GCP for Data Engineers", instructorName: "Dr Sudhanshu Joshi", submittedOn: "2026-05-25", thumbnailColor: "#F59E0B" },
];

export interface AdminUser {
  id: string; name: string; email: string;
  role: "student" | "instructor" | "admin";
  joinedDate: string;
  status: "active" | "suspended";
}

export const adminUsers: AdminUser[] = [
  { id: "au1", name: "Aarav Singh", email: "aarav@example.com", role: "student", joinedDate: "2026-01-12", status: "active" },
  { id: "au2", name: "Dr Sudhanshu Joshi", email: "priya@example.com", role: "instructor", joinedDate: "2025-08-04", status: "active" },
  { id: "au3", name: "Dr Sudhanshu Joshi", email: "marcus@example.com", role: "instructor", joinedDate: "2025-09-21", status: "active" },
  { id: "au4", name: "Ananya R.", email: "ananya@example.com", role: "student", joinedDate: "2026-02-15", status: "active" },
  { id: "au5", name: "Karan V.", email: "karan@example.com", role: "student", joinedDate: "2026-03-02", status: "suspended" },
  { id: "au6", name: "Sneha P.", email: "sneha@example.com", role: "student", joinedDate: "2026-03-10", status: "active" },
  { id: "au7", name: "Dr Sudhanshu Joshi", email: "ana@example.com", role: "instructor", joinedDate: "2025-10-11", status: "active" },
  { id: "au8", name: "Riya M.", email: "riya@example.com", role: "student", joinedDate: "2026-04-01", status: "active" },
  { id: "au9", name: "Alex T.", email: "alex@example.com", role: "student", joinedDate: "2026-04-18", status: "active" },
  { id: "au10", name: "Dr Sudhanshu Joshi", email: "admin@example.com", role: "admin", joinedDate: "2025-06-01", status: "active" },
];
