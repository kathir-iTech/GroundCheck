import { z } from "zod";

export const PageItemSchema = z.object({
  str: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  ascent: z.number(),
  descent: z.number(),
});

export const PageSchema = z.object({
  pageNumber: z.number().int().positive(),
  text: z.string(),
  items: z.array(PageItemSchema),
});

export const ChapterSchema = z.object({
  pdfUrl: z.string(),
  title: z.string(),
  pages: z.array(PageSchema),
});

export const BoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const VerificationResultSchema = z.object({
  claimId: z.string(),
  status: z.enum([
    "confirmed",
    "contradicted",
    "unsupported",
    "unverifiable",
  ]),
  claimText: z.string(),
  quote: z.string().optional(),
  page: z.number().int().positive().optional(),
  boundingBox: BoundingBoxSchema.optional(),
  explanation: z.string(),
});

export const VerificationResponseSchema = z.object({
  summary: z.string(),
  pdfUrl: z.string(),
  results: z.array(VerificationResultSchema),
});

export type PageItem = z.infer<typeof PageItemSchema>;
export type Page = z.infer<typeof PageSchema>;
export type Chapter = z.infer<typeof ChapterSchema>;
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;
export type VerificationResult = z.infer<typeof VerificationResultSchema>;
export type VerificationResponse = z.infer<typeof VerificationResponseSchema>;

export const STATUS_LABELS: Record<VerificationResult["status"], string> = {
  confirmed: "Confirmed",
  contradicted: "Contradicted",
  unsupported: "Unsupported",
  unverifiable: "Unverifiable",
};

export const STATUS_EDGE: Record<VerificationResult["status"], string> = {
  confirmed: "#6FA06B",
  contradicted: "#D96B52",
  unsupported: "#C79B3C",
  unverifiable: "#A2968A",
};