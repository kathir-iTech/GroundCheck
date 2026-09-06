# Groundcheck — Design Plan

## PASS 1 — Direction

A warm, soft, human study tool. Think a cozy study journal, not a dashboard:
warm paper surfaces, a coral "verified-by-hand" accent, deep plum ink for text,
and verdict cards with real personality instead of uniform chrome.

### Palette (named, warm + soft)

| Token | Hex | Use |
| --- | --- | --- |
| `--bg` | `#FAF3EC` | page background — warm paper |
| `--bg-soft` | `#F2E7DD` | secondary panels (input / verdicts chrome) |
| `--card` | `#FFFDFA` | surfaces (verdict cards, chapter card) |
| `--ink` | `#452D25` | headings — deep warm plum (not black) |
| `--body` | `#63463A` | body / claim text |
| `--muted` | `#7D6152` | secondary text (AA on paper) |
| `--line` | `#E7D9CC` | hairline borders |
| `--primary` | `#C4503C` | buttons, focus rings (coral; white text passes AA on it) |
| `--accent-soft` | `#F3C9B8` | active toggle fill, soft highlights |

Status colors — softened, distinguishable by more than color, AA-safe text:

| Status | Tint bg | Text | Edge/accent |
| --- | --- | --- | --- |
| Confirmed | `#DEE9DB` sage | `#3F5A3C` | `#6FA06B` |
| Contradicted | `#F5D9D0` warm coral | `#98442F` | `#D96B52` |
| Unsupported | `#F3E2BE` honey amber | `#7D5E1F` | `#C79B3C` |
| Unverifiable | `#E8DFD5` warm taupe | `#6E5F54` | `#A2968A` |

### Type

- Display (`next/font/google` **Baloo 2**, weights 500–700): headings, wordmark, numbers. Rounded, friendly, warm.
- Body (**Inter**, 400/500/600): everything else — long claim text stays highly readable.
- Sentence case everywhere (no ALL-CAPS eyebrows). `chapter.json` titles render in sentence case.

### Layout

- KEEP the three-panel structure (input / verdicts / source) — it's functionally right.
- Hierarchy via weight + radius, not identical boxes: chrome panels are flat soft-tinted; verdict cards are white, `rounded-xl`, with a **4px colored left edge** (status-colored) + tinted top fade — the emotional core. Chapter card gets a subtle warm illustration-free accent. Buttons are the only fully-saturated coral elements.
- Header: wordmark + one plain sentence, no em-dash flourish. Mode badge stays.

### Copy principles

Plain, active, sentence case. The words **Confirmed / Contradicted / Unsupported / Unverifiable** are functional verdicts and stay exactly as-is. Everything around them says what the thing does in one plain sentence.

## PASS 2 — Cliche check (fixing the three named tells)

1. **Near-black bg + one accent** → gone. Paper/blush multi-tone palette; the status colors carry meaning; coral is limited to interactive/primary.
2. **ALL-CAPS "CHAPTER" eyebrow** → sentence-case "Chapter" label.
3. **Em-dash header sentence** → replaced by the plain "Groundcheck checks study answers against the textbook."
4. **Uniform rounded-card treatment** → verdict cards differ from chrome (white surface, colored left edge, `rounded-xl`); input/chapter panels are flat `rounded-2xl` soft tints; buttons are the only saturated shapes.

Risk noted and answered: this direction could read as "warm recipe app." Counter: the study-tool vocabulary stays (verdict panel, verbatim quote, page highlight, "check against the textbook") and the PDF page remains the factual centerpiece — warmth lives in the chrome, not the content.