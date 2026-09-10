# Groundcheck — verify AI study answers against the real textbook

Paste any AI-generated study answer and Groundcheck checks it claim by claim against your actual textbook PDF — **confirmed**, **contradicted**, or **unsupported** — then draws a glowing highlight box on the exact page where the supporting (or contradicting) text appears, connected back to the claim card.

It is **not** a chatbot and uses **no embeddings or vector store**. The whole chapter goes to the model in a single prompt; every confirmed/contradicted verdict is then *proven* by finding the model's quote character-for-character inside the extracted PDF text. Quotes that can't be matched verbatim are downgraded to **unverifiable** instead of being shown as evidence.

## How it works (plain language)

1. A chapter PDF is extracted into text + per-character geometry (`npm run extract`), bundled with the app.
2. You paste an AI answer and press **Verify**. One server-side Gemini call splits it into atomic claims and labels each one.
3. For confirmed/contradicted claims, the app searches the chapter text for the model's exact quote. If it exists, the app computes where that text is on the page and draws the highlight box. If the quote doesn't exist verbatim, the claim is downgraded — no invented evidence.
4. The adjacent PDF viewer renders the real pages; clicking a claim auto-scrolls to its page and draws a glowing box + animated connector line.

## Setup

```bash
npm install
cp .env.local.example .env.local   # add your GEMINI_API_KEY (demo mode works without it)
npm run dev                         # http://localhost:3000
```

Demo mode (the toggle defaults to **OFF**/cached) needs no API key — it loads `data/demo-response.json` instantly. Flipping **Live API mode** on makes a real server-side Gemini call.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Unit tests for quote matching, summaries, and bundled data schemas |
| `npm run extract` | Extract the single chapter PDF in `data/source/` into `data/chapter.json`, updating the title + per-page text, and copies the renderer assets. Prints per-page character counts and **warns loudly on any page under ~50 chars** (the scanned-image signature — OCR isn't supported). |
| `npm run extract -- --file <pdf>` | Extract from an explicit path (e.g. a freshly dropped PDF) |
| `npm run extract -- --title "…"` | Override the auto-detected chapter title |
| `npm run capture-demo` | Run the real verify pipeline against `data/chapter.json` and cache the result to `data/demo-response.json` for demo mode. Pass the answer as an argument (`npm run capture-demo -- "My answer…"`) or via `--file answer.txt`. Uses `GEMINI_API_KEY` from `.env.local`. |

### Swapping in your real textbook chapter

1. Put one digitally-native (text-selectable, not scanned) chapter PDF at `data/source/your-chapter.pdf` (replace the placeholder `demo.pdf`).
2. `npm run extract` — title is read from `--title` or auto-detected from page 1; the per-page summary flags any page that looks image-only.
3. `npm run capture-demo -- "a realistic example answer"` — generate a fresh cached demo that reflects the real chapter (this makes one real API call).
4. The app now verifies against the real content; no UI code changes needed — the chapter title comes from `data/chapter.json` metadata.

## Textbook source

Chapter 11 — Thermodynamics from **NCERT Class 11 Physics Part II** (official 2026-27 reprint, `keph204.pdf`, ncert.nic.in), a digitally-native ~18-page PDF with selectable text. Extracted on demand with `npm run extract`; page text and per-character geometry are bundled into `data/chapter.json` and the PDF into `public/chapters/chapter.pdf`. The cached demo response in `data/demo-response.json` is generated against this real chapter (zero claims beyond its scope).

## Project structure

```
app/
  api/verify/route.ts    POST handler — thin wrapper over lib/verify (validation + error mapping)
  page.tsx               3-panel UI: input / verdicts / PDF viewer (title from chapter metadata)
components/
  InputPanel.tsx         paste box + live/cached toggle + verify button + char counter
  ClaimCard.tsx          verdict card with expandable verbatim quote
  PdfSourceView.tsx      pdf.js renderer, glowing highlight box, animated connector curve
lib/
  schema.ts              zod schemas shared by server, CLI, and client
  pdf-extract.ts         Node pdf.js text + per-character geometry extraction
  extract.ts             CLI: chapter.json build, warnings, title detection, asset copy
  verify.ts              shared Gemini pipeline: claims → quote grounding → verdicts (with retry)
  capture-demo.ts        CLI: run the real pipeline and cache the result for demo mode
  ground.ts              quote normalization, matching, bounding-box math
  load-env.ts            tiny .env.local loader for the CLI scripts
  demo.ts                placeholder chapter generator (until a real PDF is supplied)
```

## Deployment (Vercel)

- Connect the repo; Vercel should auto-detect **Next.js**.
- Settings → Environment Variables: `GEMINI_API_KEY` (required for live calls; demo mode works without it), optional `GEMINI_MODEL` (default `gemini-3.6-flash`).
- Redeploy after saving env vars — they're only picked up by builds that start afterwards.
- Vercel Hobby tier is free for hosting.
- On the Gemini API, Flash (not Pro) is the free-tier model.