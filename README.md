# Groundcheck

Groundcheck verifies a student's AI-generated study answer against a real textbook chapter — claim by claim — and shows you exactly where each claim is (or isn't) supported on the actual PDF page.

It is **not** a chatbot and uses **no embeddings or vector store**. It passes the full chapter text to the model in a single prompt and then proves each claim with verbatim, character-for-character quote matching against the PDF, drawing a glowing box at the exact text position.

## How it works

1. The app ships with a bundled chapter (`data/chapter.json`) that is extracted from a real PDF (`data/source/demo.pdf`) at build time.
2. Paste an AI answer, click **Verify against the chapter**. A single server-side Gemini call splits the answer into atomic claims and labels each one `confirmed`, `contradicted`, or `unsupported`.
3. For `confirmed` / `contradicted` claims, the app finds the model's verbatim quote inside the chapter text and computes its pixel position on the page (`lib/ground.ts` → `computeBox`).
4. If the quote can't be matched character-for-character, the claim is **downgraded to `unverifiable`** instead of being shown as confirmed. No hallucinated evidence.
5. The UI links each claim card to the rendered PDF page with a glowing highlight box and an animated connector curve.

### Demo mode (default)

The toggle in the input panel defaults to **OFF** (cached demo). It loads a pre-verified demo response (`data/demo-response.json`) instantly with zero API calls — this is what makes the free Vercel tier viable. Flip **Try the live example** on to run a real Gemini call.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

Open http://localhost:3000. Demo mode works with no configuration.

For live verification, copy `.env.local.example` to `.env.local` and set `GEMINI_API_KEY` (Google AI Studio key). Only Flash-tier models are free on Vercel Hobby.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run extract` | Extract `data/source/*.pdf` into `data/chapter.json` |
| `npm run extract -- --demo` | Regenerate the demo PDF + all cached assets |

## Using your own chapter

1. Drop a real textbook PDF into `data/source/`.
2. `npm run extract` — walks every page of the PDF, extracts the text with per-character geometry, and writes `data/chapter.json` (bundled into the build) plus `public/chapters/chapter.pdf` (rendered for the viewer).
3. Update the chapter label in `components/InputPanel.tsx`.

## Deployment (Vercel)

- Install https://github.com/apps/vercel on the repo, or connect via the dashboard.
- Framework preset: **Next.js** (auto-detected).
- Environment variables: `GEMINI_API_KEY`, optional `GEMINI_MODEL`.
- No `data/` or `public/` build steps needed — `next build` bundles `data/chapter.json` and copies `public/` automatically.

Cost note: the free tier exposes only Flash-tier models; `.env.local.example` defaults to `gemini-3.6-flash`.

## Project structure

```
app/
  api/verify/route.ts    POST handler — Gemini call, quote grounding, verdicts
  page.tsx               3-panel UI: input / verdicts / PDF viewer
components/
  InputPanel.tsx         paste box + live toggle + verify button
  ClaimCard.tsx          verdict card with expandable quote + evidence
  PdfSourceView.tsx      pdf.js renderer, glow box, connector curve
lib/
  schema.ts              zod schemas shared by server, CLI, and client
  ground.ts              quote normalization, matching, bounding boxes
  pdf-extract.ts         Node pdf.js text+geometry extraction
  demo.ts                demo PDF generator (embedded Liberation Sans)
  extract.ts             CLI: build chapter.json + copy PDF assets
```