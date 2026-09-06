import { readFile, writeFile, mkdir, readdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { extractPdfData } from "./pdf-extract";
import { buildDemoChapter } from "./demo";
import type { Chapter } from "./schema";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(ROOT, "data", "source");
const DATA_DIR = path.join(ROOT, "data");
const CHAPTERS_PUBLIC = path.join(ROOT, "public", "chapters");
const PDFJS_PUBLIC = path.join(ROOT, "public", "pdfjs");

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

async function writeSourcePdf(bytes: Uint8Array, filename: string) {
  await mkdir(SOURCE_DIR, { recursive: true });
  await writeFile(path.join(SOURCE_DIR, filename), Buffer.from(bytes));
}

async function writePublicPdf(bytes: Uint8Array) {
  await mkdir(CHAPTERS_PUBLIC, { recursive: true });
  await writeFile(path.join(CHAPTERS_PUBLIC, "chapter.pdf"), Buffer.from(bytes));
}

async function runDemo() {
  console.log("Generating demo chapter (no source PDF required) ...");
  const { pdfBytes, chapter, demoResponse } = await buildDemoChapter();

  await writeSourcePdf(pdfBytes, "demo.pdf");
  await writePublicPdf(pdfBytes);
  await copyStaticPdfjsAssets();
  await writeChapter(chapter);
  await writeFile(
    path.join(DATA_DIR, "demo-response.json"),
    JSON.stringify(demoResponse, null, 2)
  );
  console.log(`Demo assets written:
  data/chapter.json
  data/demo-response.json
  data/source/demo.pdf
  public/chapters/chapter.pdf
  public/pdfjs/pdf.worker.min.mjs
  public/pdfjs/standard_fonts/*`);
}

async function runExtract() {
  await mkdir(SOURCE_DIR, { recursive: true });
  const files = (await readdir(SOURCE_DIR)).filter((f) =>
    f.toLowerCase().endsWith(".pdf")
  );
  if (files.length === 0) {
    console.error(
      "No PDFs found under data/source/. Place a digitally-native (text-selectable) " +
        "chapter PDF there and re-run, or run  npx tsx lib/extract.ts --demo  to generate a built-in demo chapter."
    );
    process.exit(1);
  }

  const filename = files[0];
  console.log(`Extracting ${filename} ...`);
  const data = await readFile(path.join(SOURCE_DIR, filename));
  const pages = await extractPdfData(new Uint8Array(data));
  const chapter: Chapter = { pdfUrl: "/chapters/chapter.pdf", pages };

  await copyStaticPdfjsAssets();
  await writePublicPdf(data);
  await writeChapter(chapter);
  console.log(`Wrote:
  data/chapter.json (${pages.length} pages)
  public/chapters/chapter.pdf
  public/pdfjs/pdf.worker.min.mjs
  public/pdfjs/standard_fonts/*`);
}

async function main() {
  const flag = process.argv[2];
  if (flag === "--demo") {
    await runDemo();
  } else {
    await runExtract();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});