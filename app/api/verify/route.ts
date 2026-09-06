import { z } from "zod";
import { ChapterSchema } from "@/lib/schema";
import { verifyChapterAnswer, MAX_ANSWER_CHARS } from "@/lib/verify";

import chapterData from "@/data/chapter.json";

const chapter = ChapterSchema.parse(chapterData);

export const maxDuration = 45;

const requestSchema = z.object({
  answerText: z.string().min(10).max(MAX_ANSWER_CHARS),
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
    const issue = parsed.error.issues[0];
    const message =
      issue && issue.path[0] === "answerText"
        ? issue.code === "too_small"
          ? "Answer too short — paste at least a few sentences to verify."
          : issue.code === "too_big"
            ? "Answer too long — keep it under 5,000 characters."
            : "Provide an 'answerText' string to verify."
        : "Invalid request body. Provide an 'answerText' string.";
    return Response.json({ error: message }, { status: 400 });
  }

  try {
    const response = await verifyChapterAnswer(chapter, parsed.data.answerText);
    return Response.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown verification error.";
    const status = message.includes("GEMINI_API_KEY") ? 500 : 502;
    return Response.json({ error: message }, { status });
  }
}