import type { BoundingBox, Page, PageItem } from "@/lib/schema";

export type QuoteVerification = {
  verified: boolean;
  page?: number;
  boundingBox?: BoundingBox;
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

type Span = {
  startItem: number;
  endItem: number;
};

function buildSearchIndex(items: PageItem[]): {
  parts: { text: string; index: number }[];
  offsets: number[];
} {
  const parts: { text: string; index: number }[] = [];
  const offsets: number[] = [];
  let cursor = 0;
  items.forEach((item, index) => {
    const text = normalize(item.str);
    if (text.length === 0) return;
    parts.push({ text, index });
    offsets.push(cursor);
    cursor += text.length + 1;
  });
  return { parts, offsets };
}

function findSpanForRange(
  offsets: number[],
  start: number,
  end: number
): Span {
  let startItem = 0;
  let endItem = 0;
  for (let i = 0; i < offsets.length; i++) {
    if (offsets[i] <= start) startItem = i;
    if (offsets[i] <= end) endItem = i;
  }
  return { startItem, endItem };
}

function computeBox(items: PageItem[]): BoundingBox {
  if (items.length === 0) {
    throw new Error("cannot compute a bounding box for an empty item list");
  }
  const minX = Math.min(...items.map((i) => i.x));
  const maxRight = Math.max(...items.map((i) => i.x + i.width));
  const top = Math.max(...items.map((i) => i.y + i.ascent));
  const bottom = Math.min(...items.map((i) => i.y - i.descent));
  return {
    x: minX,
    y: top,
    width: maxRight - minX,
    height: top - bottom,
  };
}

export function verifyQuote(quote: string, page: Page): QuoteVerification {
  const { parts, offsets } = buildSearchIndex(page.items);
  if (parts.length === 0) return { verified: false };

  const text = parts.map((p) => p.text).join(" ");
  const normalizedQuote = normalize(quote);
  const start = text.indexOf(normalizedQuote);
  if (start < 0) return { verified: false };

  const end = start + normalizedQuote.length - 1;
  const span = findSpanForRange(offsets, start, end);

  const originalItems = parts
    .slice(span.startItem, span.endItem + 1)
    .map((p) => page.items[p.index]);

  const boundingBox = computeBox(originalItems);

  return {
    verified: true,
    page: page.pageNumber,
    boundingBox,
  };
}

export function verifyQuoteInChapter(
  quote: string,
  pages: Page[],
  preferredPage?: number
): QuoteVerification {
  if (preferredPage) {
    const target = pages.find((p) => p.pageNumber === preferredPage);
    if (target) {
      const result = verifyQuote(quote, target);
      if (result.verified) return result;
    }
  }
  for (const page of pages) {
    const result = verifyQuote(quote, page);
    if (result.verified) return result;
  }
  return { verified: false };
}