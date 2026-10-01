"use client";

import type { ReactNode } from "react";
import { LearningProvider } from "@/context/LearningContext";

// All /learn/[slug]/* pages share one LearningContext (course progress cache).
export default function LearnLayout({ children }: { children: ReactNode }) {
  return <LearningProvider>{children}</LearningProvider>;
}
