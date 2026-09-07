import { describe, expect, it } from "vitest";
import { ChapterSchema, VerificationResponseSchema } from "./schema";

import chapterData from "../data/chapter.json";
import demoResponse from "../data/demo-response.json";

describe("data/ chapter.json", () => {
  const chapter = ChapterSchema.parse(chapterData);

  it("is a valid chapter with a title and pdfUrl", () => {
    expect(chapter.title.length).toBeGreaterThan(0);
    expect(chapter.pdfUrl.length).toBeGreaterThan(0);
    expect(chapter.pages.length).toBeGreaterThan(0);
  });

  it("has non-empty page text and item geometry", () => {
    for (const page of chapter.pages) {
      expect(page.text.trim().length).toBeGreaterThan(0);
      expect(page.items.length).toBeGreaterThan(0);
      for (const i of page.items) {
        expect(typeof i.ascent).toBe("number");
        expect(typeof i.descent).toBe("number");
      }
    }
  });

  it("exposes the title used in the UI header", () => {
    expect(chapter.title).toBe("Chapter 4 — Thermodynamics and Energy");
  });
});

describe("data/ demo-response.json", () => {
  it("parses as a VerificationResponse with at least one claim", () => {
    const response = VerificationResponseSchema.parse(demoResponse);
    expect(response.results.length).toBeGreaterThan(0);
    expect(response.summary.length).toBeGreaterThan(0);
    expect(response.pdfUrl.length).toBeGreaterThan(0);
  });

  it("rejects an unknown verdict status", () => {
    expect(() =>
      VerificationResponseSchema.parse({
        summary: "x",
        pdfUrl: "/chapters/chapter.pdf",
        results: [
          {
            claimId: "c1",
            status: "maybe",
            claimText: "t",
            explanation: "e",
          },
        ],
      })
    ).toThrow();
  });
});