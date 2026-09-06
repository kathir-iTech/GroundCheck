# Groundcheck — Pre-Submission Readiness Audit

| # | Check | Result | Notes |
| --- | --- | --- | --- |
| F1 | Live pipeline — mixed correct/incorrect answer | PASS | Real Gemini call returned HTTP 200, 52 s, 4 claims: 2 confirmed with page matched + bounding box, 1 contradicted with box, 1 unsupported (no false positive) |
| F2 | Empty / whitespace-only submission | PASS | Verify button disabled on whitespace-only; API rejects `{"answerText":"   "}` with 400 before any AI call |
| F3 | Single-sentence submission | PASS (by design) | Server breaks fragments into atomic claims; empty claims fall through to the friendly zero-claims card |
| F4 | Answer near 2000-char soft limit | PASS (design) | Soft cap 2000 (UI counter/amber), hard cap 5000 enforced server-side; client timeouts at 40 s, below the 45 s `maxDuration` so the friendly timeout message wins instead of a raw platform error |
| F5 | Unrelated text (cooking) never false-confirms | PENDING | Could not re-run: Gemini free-tier daily quota (20 req/day, resets daily) exhausted by earlier live tests. The contradicted/unsupported path is quote-grounded by `verifyQuoteInChapter`, so off-topic text cannot gain a verified page box. Re-run risotto case tomorrow against the live quota. |
| F6 | Text with no checkable claims | PASS | Server returns `claims: []` → friendly zero-claims card; summary bar now shows "No checkable claims in that text." instead of a contradictory "0 of 0 …" line |
| F7 | Malformed input (raw HTML / code) | PASS | Content is rendered as plain text; no v-html anywhere; React escapes all claim/quote/explanation strings |

| S1 | `git grep --cached "AIza"` | PASS | no matches in staged files |
| S2 | `git grep --cached "GEMINI_API_KEY"` | PASS | only non-secret env-name strings (`.env.local.example`, README, route, page, libs) |
| S3 | `.env.local` ignored, untracked | PASS | `git check-ignore .env.local` → ignored; `git ls-files .env.local` → not tracked |
| S4 | No `process.env` read in client bundle | PASS | `process.env` occurs only in server route + Node CLIs; zero hits in `*.tsx` client files |

| A1 | New palette contrast (WCAG AA) | PASS | Body `#63463A` on `#FAF3EC` ≈ 7.8:1; muted `#7D6152` on paper ≈ 4.6:1; status badge text chosen dark-on-tint (e.g. `#3F5A3C` on `#DEE9DB`) |
| A2 | Keyboard access to every interactive element | PASS | Claim cards now `role="button"`, `tabIndex=0`, Enter/Space activation, `aria-expanded` + `aria-controls` (was click-only `<div>`); switch/buttons native; global `:focus-visible` ring |
| A3 | Status not conveyed by color alone | PASS | Verdict words "Confirmed/Contradicted/…" are the primary signal; color is decorative (left edge, badge tint, glow) and glow overlays are `aria-hidden` |

| P1 | Zero console errors/warnings, fresh load + full cycle | PASS | SSR render clean; live cycle 200 with no client errors |
| P2 | `next build` + `next lint` clean | PASS | Compiled ✓; ESLint 0 warnings/errors |
| P3 | Lighthouse | SKIPPED | Not run in this environment; surface is one lightweight page + one `/chapters/chapter.pdf` + worker |

## Known external constraints (not code)
- **Gemini free-tier quota**: 20 generate calls/day/model (observed 429 → 502). Demo mode stays the recorded default; the live toggle proves it works for the scripted clip.
- **Gemini transient 503s**: capped 2-attempt / 1 s retry; both-fail shows a clear banner.
- **Real textbook PDF**: placeholder `demo.pdf` ships until the real chapter arrives; `npm run extract` + `npm run capture-demo` swap it in with no UI edits.

## What changed in this pass
- Full visual + copy redesign (see `DESIGN.md`): warm paper/blush palette, coral primary, plum ink, Baloo 2 + Inter via `next/font`, sentence-case copy, em-dash header removed, verdict cards with status-colored left edge, PDF panel warmed.
- Keyboard-accessible claim cards; global focus ring; AA-contrast status palette.
- Fixed zero-claims summary contradiction; aligned client timeout (40 s) under `maxDuration` (45 s) so the friendly timeout fires first.
- Shared `DEMO_ANSWER` moved to `lib/demo-answer.ts` (killed page/demo drift); removed dead `ClaimSchema`, `STATUS_COLORS`, `svgRef`.
- PDF cache now evicts failed loads (recoverable without reload); page-render errors surface instead of silent blank canvas; API-key hint no longer appended when the error is a quota error.