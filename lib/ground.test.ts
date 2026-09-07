import { describe, expect, it } from "vitest";
import { verifyQuote, verifyQuoteInChapter } from "./ground";
import type { Page, PageItem } from "./schema";

function item(str: string, x = 10, y = 100, width = 40): PageItem {
  return { str, x, y, width, height: 12, ascent: 0.8, descent: 0.2 };
}

const page: Page = {
  pageNumber: 1,
  text: "The first law says heat added minus work done.",
  items: [
    item("The first", 10, 100, 45),
    item("law says", 55, 100, 40),
    item("heat added", 10, 120, 48),
    item("minus work done.", 58, 120, 70),
  ],
};

describe("verifyQuote", () => {
  it("matches a quote that spans two text items", () => {
    const result = verifyQuote("law says heat", page);
    expect(result.verified).toBe(true);
    expect(result.page).toBe(1);
    expect(result.boundingBox).toBeDefined();
    expect(result.boundingBox?.x).toBe(10);
    expect(result.boundingBox!.width).toBeGreaterThan(0);
    expect(result.boundingBox!.height).toBeGreaterThan(0);
  });

  it("tolerates case and collapsed whitespace", () => {
    expect(verifyQuote("Heat   Added", page).verified).toBe(true);
    expect(verifyQuote("LAW SAYS", page).verified).toBe(true);
  });

  it("returns verified:false when the quote is not present", () => {
    expect(verifyQuote("entropy of an isolated system", page).verified).toBe(false);
  });

  it("returns verified:false on a page with no items", () => {
    expect(
      verifyQuote("anything", { pageNumber: 2, text: "", items: [] }).verified
    ).toBe(false);
  });
});

describe("verifyQuoteInChapter", () => {
  const page2: Page = {
    pageNumber: 2,
    text: "Entropy of an isolated system never decreases.",
    items: [item("Entropy of an", 10, 50, 60), item("isolated system never decreases.", 70, 50, 140)],
  };
  const pages = [page, page2];

  it("prefers the model-provided page when the quote exists there", () => {
    const result = verifyQuoteInChapter("Entropy of an", pages, 2);
    expect(result.verified).toBe(true);
    expect(result.page).toBe(2);
  });

  it("falls back to scanning every page even when the preferred page misses", () => {
    const result = verifyQuoteInChapter("heat added", pages, 2);
    expect(result.verified).toBe(true);
    expect(result.page).toBe(1);
  });

  it("returns verified:false when no page contains the quote", () => {
    expect(verifyQuoteInChapter("not in any page", pages, 1).verified).toBe(false);
  });
});