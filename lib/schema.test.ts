import { describe, expect, it } from "vitest";
import { ChapterSchema, VerificationResponseSchema } from "./schema";
import { normalize } from "./ground";
import { CHAPTER_TITLE } from "./chapter-meta";

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

  it("joins page text exactly the way the quote matcher will search it", () => {
    // Regression: extraction used to concatenate items with no separator while
    // ground.ts joins them with a space, gluing words together (e.g. the old
    // "ELEVENTHERMODYNAMICS" heading) so real quotes failed to match and got
    // wrongly downgraded. Both sides must join identically.
    const expected = chapter.pages.map(
      (page) => page.items.map((i) => normalize(i.str)).filter((s) => s.length > 0).join(" "),
    );
    for (const [i, page] of chapter.pages.entries()) {
      expect(normalize(page.text)).toBe(expected[i]);
    }
  });

  it("exposes the title used in the UI header, matching chapter-meta", () => {
    expect(chapter.title).toBe(CHAPTER_TITLE);
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

  it("keeps evidence on every confirmed/contradicted claim", () => {
    const claims = VerificationResponseSchema.parse(demoResponse).results;
    for (const c of claims) {
      if (c.status === "confirmed" || c.status === "contradicted") {
        expect(c.page).toBeDefined();
        expect(c.boundingBox).toBeDefined();
        expect(c.quote).toBeDefined();
      }
    }
    expect(claims.some((c) => c.status === "unsupported")).toBe(true);
  });
});