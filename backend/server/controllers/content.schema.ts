// zod fields for the shared learning-content system (Topics + Course Sections).
import { z } from "zod";
import { CONTENT_TYPES } from "../models/content";

const urlish = z.string().max(2000).optional().or(z.literal(""));

export const contentFields = {
  contentType: z.enum(CONTENT_TYPES).optional(),
  content: z.string().max(200000).optional(), // markdown
  audioUrl: urlish,
  documentUrl: urlish,
  videoUrl: urlish,
  subtitleUrl: urlish,
  estimatedDurationMinutes: z.coerce.number().int().min(0).max(100000).optional(),
};

export const reorderSchema = z.object({ orderedIds: z.array(z.string().min(1)).min(1) });
export const idSchema = z.string().min(1);
