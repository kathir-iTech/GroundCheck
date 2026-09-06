import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { verifyQuoteInChapter } from "@/lib/ground";
import {
  ChapterSchema,
  type VerificationResponse,
  type VerificationResult,
} from "@/lib/schema";

import chapterData from "@/data/chapter.json";

const chapter = ChapterSchema.parse(chapterData);

const JSON_OUTPUT_SCHEMA_PROMPT = `Return strictly one JSON object and nothing else — no markdown fences, no prose outside the JSON.

The JSON object MUST match this exact shape:
{
  "claims": [
    {
      "text": "the atomic claim, verbatim from the student's answer",
      "status": "confirmed" | "contradicted" | "unsupported",
      "quote": "exact verbatim quote copied word-for-word from the provided chapter text, ONLY for confirmed and contradicted claims; omit for unsupported",
      "page": 1,
      "explanation": "1-2 sentences, grounded only in the provided chapter text"
    }
  ]
}`;

function buildPrompt(answerText: string): string {
  const chapterText = chapter.pages
    .map((p) => `\n--- Page ${p.pageNumber} ---\n${p.text}\n`)
    .join("\n");

  return `You are a verification engine. You will be given (A) the full text of one chapter of a real textbook, split into pages, and (B) an answer written by an AI for a student. Your job is to break the answer into atomic claims and judge each claim STRICTLY against the provided chapter text.

Rules:
- Split the answer into atomic, verifiable claims. Each claim must be short enough to check independently.
- For each claim, status means:
  - "confirmed": the chapter text explicitly supports the claim.
  - "contradicted": the chapter text explicitly contradicts the claim.
  - "unsupported": the chapter text neither supports nor contradicts the claim (the answer goes beyond the chapter or the chapter does not address it).
- For "confirmed" and "contradicted" only: include "quote", an EXACT verbatim substring of the provided chapter text (copy it character-for-character from the text above, do not paraphrase, do not reword), and "page", the number of the page the quote appears on.
- For "unsupported", omit "quote" entirely.
- The "explanation" must be grounded ONLY in the provided chapter text, 1-2 sentences.

Chapter text:
${chapterText}

Student answer:
${answerText}
`;
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY. Set it in your .env.local or Vercel environment."
    );
  }

  const modelId = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelId,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  if (!text || text.trim().length === 0) {
    throw new Error("Gemini returned an empty response.");
  }
  return text;
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

const RawClaimsSchema = z.object({
  claims: z.array(
    z.object({
      text: z.string().min(1),
      status: z.enum(["confirmed", "contradicted", "unsupported"]),
      quote: z.string().optional(),
      page: z.number().int().positive().optional(),
      explanation: z.string().min(1),
    })
  ),
});

function parseRawClaims(raw: string) {
  return RawClaimsSchema.parse(JSON.parse(extractJson(raw)));
}

async function requestVerification(answerText: string) {
  try {
    return parseRawClaims(await callGemini(buildPrompt(answerText)));
  } catch {
    const retryPrompt = `${buildPrompt(answerText)}\n\n${JSON_OUTPUT_SCHEMA_PROMPT}`;
    return parseRawClaims(await callGemini(retryPrompt));
  }
}

type RawClaim = z.infer<typeof RawClaimsSchema>["claims"][number];

function toResult(
  index: number,
  claim: RawClaim
): VerificationResult {
  const base: VerificationResult = {
    claimId: `claim-${index + 1}`,
    claimText: claim.text,
    status: claim.status,
    explanation: claim.explanation,
  };

  if (claim.status === "unsupported") {
    return base;
  }

  if (!claim.quote) {
    return { ...base, status: "unverifiable" };
  }

  const check = verifyQuoteInChapter(claim.quote, chapter.pages, claim.page);
  if (check.verified && check.page && check.boundingBox) {
    return {
      ...base,
      quote: claim.quote,
      page: check.page,
      boundingBox: check.boundingBox,
    };
  }

  return { ...base, status: "unverifiable" };
}

function buildSummary(results: VerificationResult[]): string {
  const counts = {
    confirmed: results.filter((r) => r.status === "confirmed").length,
    contradicted: results.filter((r) => r.status === "contradicted").length,
    unsupported: results.filter((r) => r.status === "unsupported").length,
    unverifiable: results.filter((r) => r.status === "unverifiable").length,
  };
  return `${counts.confirmed} of ${results.length} claims confirmed against the chapter. ${counts.contradicted} contradicted. ${counts.unsupported} unsupported.`;
}

const requestSchema = z.object({
  answerText: z.string().min(10),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error:
          "Provide an 'answerText' string of at least 10 characters to verify.",
      },
      { status: 400 }
    );
  }

  try {
    const rawClaims = await requestVerification(parsed.data.answerText);
    const results = rawClaims.claims.map((claim, i) => toResult(i, claim));

    const response: VerificationResponse = {
      summary: buildSummary(results),
      pdfUrl: chapter.pdfUrl,
      results,
    };

    return Response.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown verification error.";
    const status = message.includes("GEMINI_API_KEY") ? 500 : 502;
    return Response.json({ error: message }, { status });
  }
}