import { readFile, writeFile, mkdir, readdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { extractPdfData } from "./pdf-extract";
import { buildDemoChapter } from "./demo";
import type { Chapter, Page } from "./schema";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(ROOT, "data", "source");
const DATA_DIR = path.join(ROOT, "data");
const CHAPTERS_PUBLIC = path.join(ROOT, "public", "chapters");
const PDFJS_PUBLIC = path.join(ROOT, "public", "pdfjs");

const SHORT_TEXT_WARNING_CHARS = 50;

const WORKER_SRC = path.join(
  ROOT,
  "node_modules",
  "pdfjs-dist",
  "build",
  "pdf.worker.min.mjs"
);
const WORKER_DEST = path.join(PDFJS_PUBLIC, "pdf.worker.min.mjs");

const STANDARD_FONTS_SRC = path.join(
  ROOT,
  "node_modules",
  "pdfjs-dist",
  "standard_fonts"
);
const STANDARD_FONTS_DEST = path.join(PDFJS_PUBLIC, "standard_fonts");

async function copyStaticPdfjsAssets() {
  await mkdir(PDFJS_PUBLIC, { recursive: true });
  await copyFile(WORKER_SRC, WORKER_DEST);
  await mkdir(STANDARD_FONTS_DEST, { recursive: true });
  const fontFiles = await readdir(STANDARD_FONTS_SRC);
  for (const font of fontFiles) {
    await copyFile(
      path.join(STANDARD_FONTS_SRC, font),
      path.join(STANDARD_FONTS_DEST, font)
    );
  }
}

async function writeChapter(chapter: Chapter) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    path.join(DATA_DIR, "chapter.json"),
    JSON.stringify(chapter, null, 2)
  );
}

async function writeChapterMeta(title: string) {
  await writeFile(
    path.join(ROOT, "lib", "chapter-meta.ts"),
    `export const CHAPTER_TITLE = ${JSON.stringify(title)};`
  );
}

async function writeSourcePdf(bytes: Uint8Array, filename: string) {
  await mkdir(SOURCE_DIR, { recursive: true });
  await writeFile(path.join(SOURCE_DIR, filename), Buffer.from(bytes));
}

async function writePublicPdf(bytes: Uint8Array) {
  await mkdir(CHAPTERS_PUBLIC, { recursive: true });
  await writeFile(path.join(CHAPTERS_PUBLIC, "chapter.pdf"), Buffer.from(bytes));
}

function printPageSummary(pages: Page[]) {
  for (const page of pages) {
    const chars = page.text.trim().length;
    console.log(`  page ${page.pageNumber}: ${chars.toLocaleString()} chars extracted`);
    if (chars < SHORT_TEXT_WARNING_CHARS) {
      console.warn(
        `  ${"⚠".padEnd(2)} WARNING: page ${page.pageNumber} has only ${chars} chars — ` +
          `this looks like a scanned/blank page. Groundcheck supports digitally-native ` +
          `(text-selectable) text and has no OCR, so this page's content will be empty.`
      );
    }
  }
}

function detectTitle(pageOneText: string, fallback: string): string {
  const first = pageOneText.split("\n").map((s) => s.trim()).filter(Boolean)[0];
  if (!first) return fallback;
  const headingLike = first.split(/(?=\d+\.\d+\s+[A-Z])/)[0].trim();
  const candidate = headingLike.length > 0 ? headingLike : first.slice(0, 120).trim();
  if (/^page\b/i.test(candidate)) return fallback;
  return candidate || fallback;
}

async function runDemo() {
  console.log("Generating demo chapter (no source PDF required) ...");
  const { pdfBytes, chapter, demoResponse } = await buildDemoChapter();

  await writeSourcePdf(pdfBytes, "demo.pdf");
  await writePublicPdf(pdfBytes);
  await copyStaticPdfjsAssets();
  await writeChapter(chapter);
  await writeChapterMeta(chapter.title);
  await writeFile(
    path.join(DATA_DIR, "demo-response.json"),
    JSON.stringify(demoResponse, null, 2)
  );
  console.log(`Demo assets written:
  data/chapter.json
  lib/chapter-meta.ts (title: "${chapter.title}")
  data/demo-response.json
  data/source/demo.pdf
  public/chapters/chapter.pdf
  public/pdfjs/pdf.worker.min.mjs
  public/pdfjs/standard_fonts/*`);
}

async function runExtract(sourceFile?: string, titleOverride?: string) {
  let filePath = sourceFile;
  if (!filePath) {
    await mkdir(SOURCE_DIR, { recursive: true });
    const files = (await readdir(SOURCE_DIR)).filter((f) =>
      f.toLowerCase().endsWith(".pdf")
    );
    if (files.length === 0) {
      console.error(
        "No PDFs found under data/source/. Place a digitally-native (text-selectable) " +
          "chapter PDF there and re-run, or use  --file <path>  for an explicit file, " +
          "or run  npx tsx lib/extract.ts --demo  to generate the built-in demo chapter."
      );
      process.exit(1);
    }
    if (files.length > 1) {
      console.error(
        `Multiple PDFs found under data/source/: ${files.join(", ")}. ` +
          "Groundcheck is single-chapter — keep exactly one chapter PDF there, " +
          "or select one explicitly with  --file <path>."
      );
      process.exit(1);
    }
    filePath = path.join(SOURCE_DIR, files[0]);
  }

  console.log(`Extracting ${filePath} ...`);
  const data = await readFile(filePath);
  const pages = await extractPdfData(new Uint8Array(data));

  const title =
    titleOverride ??
    detectTitle(pages[0]?.text ?? "", path.basename(filePath, ".pdf"));

  printPageSummary(pages);

  const chapter: Chapter = { pdfUrl: "/chapters/chapter.pdf", title, pages };

  await copyStaticPdfjsAssets();
  await writePublicPdf(data);
  await writeChapter(chapter);
  await writeChapterMeta(title);
  console.log(`Wrote:
  data/chapter.json (${pages.length} pages, title: "${title}")
  lib/chapter-meta.ts (title: "${title}")
  public/chapters/chapter.pdf
  public/pdfjs/pdf.worker.min.mjs
  public/pdfjs/standard_fonts/*`);
}

type CliArgs = { demo: boolean; file?: string; title?: string };

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { demo: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--demo") args.demo = true;
    else if (arg === "--file") args.file = argv[++i];
    else if (arg === "--title") args.title = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.demo) {
    await runDemo();
  } else {
    await runExtract(args.file, args.title);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});