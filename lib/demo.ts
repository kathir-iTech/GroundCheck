import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { extractPdfData } from "./pdf-extract";
import { verifyQuoteInChapter } from "./ground";
import type { Chapter, VerificationResult } from "./schema";

type LineSpec =
  | { kind: "heading"; text: string }
  | { kind: "body"; text: string };

const PAGE_1_LINES: LineSpec[] = [
  { kind: "heading", text: "Chapter 4 — Thermodynamics and Energy" },
  { kind: "heading", text: "4.1 Thermal Energy and Temperature" },
  { kind: "body", text: "Heat is the energy that flows between two systems because of a difference in temperature." },
  { kind: "body", text: "Temperature is a measure of the average kinetic energy of the particles in a substance." },
  { kind: "body", text: "Two systems are in thermal equilibrium when they reach the same temperature and no" },
  { kind: "body", text: "further net heat flows between them." },
  { kind: "heading", text: "4.2 The First Law of Thermodynamics" },
  { kind: "body", text: "The first law of thermodynamics states that the change in the internal energy of a system" },
  { kind: "body", text: "equals the heat added to the system minus the work done by the system." },
  { kind: "body", text: "The zeroth law of thermodynamics states that if two systems are each in thermal" },
  { kind: "body", text: "equilibrium with a third system, then they are in thermal equilibrium with each other." },
  { kind: "body", text: "Specific heat is the amount of heat required to raise the temperature of one gram of a" },
  { kind: "body", text: "substance by one degree Celsius." },
];

const PAGE_2_LINES: LineSpec[] = [
  { kind: "heading", text: "4.3 The Second Law and Entropy" },
  { kind: "body", text: "Entropy is a measure of the disorder or randomness of a system." },
  { kind: "body", text: "In any real thermodynamic process, the entropy of an isolated system never decreases." },
  { kind: "body", text: "A heat engine converts thermal energy into mechanical work but always rejects some" },
  { kind: "body", text: "heat to a cold reservoir." },
  { kind: "body", text: "The efficiency of a Carnot engine depends only on the temperatures of the hot and" },
  { kind: "body", text: "cold reservoirs, and no heat engine can be more efficient than a Carnot engine" },
  { kind: "body", text: "operating between the same two temperatures." },
  { kind: "heading", text: "4.4 Modes of Heat Transfer" },
  { kind: "body", text: "Conduction is the transfer of thermal energy through a material due to a temperature" },
  { kind: "body", text: "gradient, without bulk motion of the material." },
  { kind: "body", text: "Convection involves the bulk movement of a fluid carrying energy from one place" },
  { kind: "body", text: "to another." },
  { kind: "body", text: "Radiation is the transfer of energy by electromagnetic waves and does not require" },
  { kind: "body", text: "a medium." },
];

const PAGE_SPECS: LineSpec[][] = [PAGE_1_LINES, PAGE_2_LINES];

const DEMO_ANSWER =
  "The first law of thermodynamics says the change in internal energy of a system equals the heat added minus the work done. In any real thermodynamic process the entropy of an isolated system never decreases. A perfect heat engine that converts all absorbed heat into work, rejecting nothing, is physically allowed by the second law. Thermal conductivity is measured in watts per mole per metre and is highest for gases. Entropy varies inversely with temperature for every thermodynamic system.";

type ClaimSeed = {
  id: string;
  text: string;
  intent: "confirmed" | "contradicted" | "unsupported";
  quote?: string;
  page?: number;
  explanation: string;
};

const DEMO_CLAIM_SEEDS: ClaimSeed[] = [
  {
    id: "c1",
    text: "The first law says the change in internal energy equals the heat added minus the work done by the system.",
    intent: "confirmed",
    quote:
      "the change in the internal energy of a system equals the heat added to the system minus the work done by the system",
    page: 1,
    explanation:
      "Chapter 4.2 states this definition of the first law verbatim.",
  },
  {
    id: "c2",
    text: "In a real thermodynamic process the entropy of an isolated system never decreases.",
    intent: "confirmed",
    quote: "the entropy of an isolated system never decreases",
    page: 2,
    explanation:
      "Chapter 4.3 says exactly this about the second law of thermodynamics.",
  },
  {
    id: "c3",
    text: "A perfect heat engine that converts all absorbed heat into work, rejecting no heat, is physically possible.",
    intent: "contradicted",
    quote: "always rejects some heat to a cold reservoir",
    page: 2,
    explanation:
      "Chapter 4.3 states that a heat engine 'always rejects some heat to a cold reservoir', so total conversion is contradicted.",
  },
  {
    id: "c4",
    text: "Thermal conductivity is measured in watts per mole per metre and is highest for gases.",
    intent: "confirmed",
    quote: "conductivity is measured in watts per mole",
    page: 1,
    explanation:
      "The model cited a quote for this claim, but that exact sentence does not appear anywhere in the chapter, so the claim cannot be verified against the source.",
  },
  {
    id: "c5",
    text: "Entropy varies inversely with temperature for every thermodynamic system.",
    intent: "unsupported",
    explanation:
      "The chapter discusses entropy only as a measure of disorder; it never relates entropy to temperature.",
  },
];

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIBERATION_REGULAR = path.join(
  ROOT,
  "node_modules",
  "pdfjs-dist",
  "standard_fonts",
  "LiberationSans-Regular.ttf"
);
const LIBERATION_BOLD = path.join(
  ROOT,
  "node_modules",
  "pdfjs-dist",
  "standard_fonts",
  "LiberationSans-Bold.ttf"
);

const LIBERATION_ASCENT = 1901 / 2048;
const LIBERATION_DESCENT = 483 / 2048;

function applyDemoFontMetrics(pages: Chapter["pages"]) {
  for (const page of pages) {
    for (const item of page.items) {
      const size = item.height;
      item.ascent = size * LIBERATION_ASCENT;
      item.descent = size * LIBERATION_DESCENT;
    }
  }
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 72;
const START_Y = 740;
const HEADING_GAP = 21;
const BODY_GAP = 17;

async function buildDemoPdf() {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([
    readFile(LIBERATION_REGULAR),
    readFile(LIBERATION_BOLD),
  ]);
  const font = await doc.embedFont(Uint8Array.from(regularBytes));
  const boldFont = await doc.embedFont(Uint8Array.from(boldBytes));

  for (const lines of PAGE_SPECS) {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = START_Y;
    for (const line of lines) {
      if (line.kind === "heading") {
        page.drawText(line.text, {
          x: MARGIN_X,
          y,
          size: 14,
          font: boldFont,
          color: rgb(0.05, 0.05, 0.1),
        });
        y -= HEADING_GAP;
      } else {
        page.drawText(line.text, {
          x: MARGIN_X,
          y,
          size: 11,
          font,
          color: rgb(0.1, 0.1, 0.12),
        });
        y -= BODY_GAP;
      }
    }
  }

  const bytes = await doc.save({ useObjectStreams: false });
  return Uint8Array.from(bytes);
}

export async function buildDemoChapter(): Promise<{
  pdfBytes: Uint8Array;
  chapter: Chapter;
  demoResponse: { summary: string; pdfUrl: string; results: VerificationResult[] };
}> {
  const pdfBytes = await buildDemoPdf();
  const pages = await extractPdfData(pdfBytes);
  applyDemoFontMetrics(pages);
  const chapter: Chapter = {
    pdfUrl: "/chapters/chapter.pdf",
    title: "Physics · Chapter 4 — Thermodynamics and Energy",
    pages,
  };

  const results: VerificationResult[] = [];
  for (const seed of DEMO_CLAIM_SEEDS) {
    if (seed.intent === "unsupported") {
      results.push({
        claimId: seed.id,
        claimText: seed.text,
        status: "unsupported",
        explanation: seed.explanation,
      });
      continue;
    }

    if (!seed.quote) {
      results.push({
        claimId: seed.id,
        claimText: seed.text,
        status: "unverifiable",
        explanation: seed.explanation,
      });
      continue;
    }

    const check = verifyQuoteInChapter(seed.quote, pages, seed.page);
    if (check.verified && check.boundingBox) {
      results.push({
        claimId: seed.id,
        claimText: seed.text,
        status: seed.intent,
        quote: seed.quote,
        page: check.page,
        boundingBox: check.boundingBox,
        explanation: seed.explanation,
      });
    } else {
      results.push({
        claimId: seed.id,
        claimText: seed.text,
        status: "unverifiable",
        explanation: seed.explanation,
      });
    }
  }

  const counts = {
    confirmed: results.filter((r) => r.status === "confirmed").length,
    contradicted: results.filter((r) => r.status === "contradicted").length,
    unsupported: results.filter((r) => r.status === "unsupported").length,
    unverifiable: results.filter((r) => r.status === "unverifiable").length,
  };
  const summary = `${counts.confirmed} of ${results.length} claims confirmed against the chapter. ${counts.contradicted} contradicted. ${counts.unsupported} unsupported.`;

  return {
    pdfBytes,
    chapter,
    demoResponse: { summary, pdfUrl: chapter.pdfUrl, results },
  };
}

export { DEMO_ANSWER };