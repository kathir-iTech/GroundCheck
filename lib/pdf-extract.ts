import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { Page } from "./schema";

GlobalWorkerOptions.workerSrc = new URL(
  "../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type TextItemWithTransform = {
  str?: string;
  transform: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
};

const DEFAULT_ASCENT_SCALE = 0.8;
const DEFAULT_DESCENT_SCALE = 0.21;

export async function extractPdfData(data: Uint8Array): Promise<Page[]> {
  const loadingTask = getDocument({
    data: Uint8Array.from(data),
  });
  const pdf = await loadingTask.promise;

  const pages: Page[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();

    const items: Page["items"] = [];
    for (const raw of content.items) {
      const item = raw as unknown as TextItemWithTransform;
      if (typeof item.str !== "string" || item.str.length === 0) continue;
      const [a, b, , , e, f] = item.transform ?? [0, 0, 0, 0, 0, 0];
      const width = typeof item.width === "number" ? item.width : a;
      const height = typeof item.height === "number" ? item.height : a;
      const fontScale = Math.hypot(a, b);
      items.push({
        str: item.str,
        x: e,
        y: f,
        width,
        height,
        ascent: fontScale * DEFAULT_ASCENT_SCALE,
        descent: fontScale * DEFAULT_DESCENT_SCALE,
      });
    }

    const text = items.map((i) => i.str).join(" ");
    pages.push({ pageNumber: n, text, items });

    if (text.trim().length < 100) {
      console.warn(
        `[warn] page ${n} yielded very little text (${text.trim().length} chars). ` +
          `If this page looks like a scanned image, the PDF is not digitally native and OCR is not supported by Groundcheck.`
      );
    }
  }

  await loadingTask.destroy();
  return pages;
}