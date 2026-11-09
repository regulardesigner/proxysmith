---
name: Card Export
description: Verify changes to card rendering, PNG/PDF export, artwork compositing, and print geometry. Use for src/lib/export.ts, CardPreview, .mtg-card CSS, or artwork framing changes.
---

# Card Export

Read `AGENTS.md` first. Its card rendering, export, and print rules are authoritative. This skill is
the execution checklist for changes that can alter the preview or the exported files.

## Invariants to protect

- Card stage: exactly **750 × 1050 px**.
- PNG: 750 × 1050 px with a `pHYs` chunk at **300 DPI**, rounded corners.
- PDF: **A4 210 × 297 mm**, centered 3 × 3 grid, crop marks in the margins.
- No official artwork or WotC asset; the `PROXY` notice and disclaimer stay intact.
- OFL fonts only.
- Exported output must match the preview.

## 1. Identify the boundary

- Pure geometry and metadata: `computeSheetLayout`, `withPngDpi`, `slugify`.
- DOM/canvas boundary: `lib/export.ts`, `CardPreview`, `.mtg-card` blocks in `src/index.css`.
- Artwork framing: `object-fit: cover`, zoom, offsets, and the canvas compositing path.

Write or update unit tests for pure functions before touching the DOM/canvas path.

## 2. Verification sequence

```bash
npm test
npm run typecheck
npm run build
```

Then, with the dev server running from the project root:

```bash
npm run dev -- --port 5173
npm run smoke
```

`npm run smoke` writes artifacts to `tmp/`. Inspect DOM geometry, computed styles, exported pixels,
and PDF metadata. Screenshots are not committed.

## 3. Structural checks

- The stage is 750 × 1050 and does not depend on viewport units.
- Changing template does not change geometry or break auto-fit.
- Long cards do not overflow on `signature`, `classic`, or `modern`.
- Export renders at scale 1, with no residual transform and `pixelRatio: 1`.
- `document.fonts.ready` is awaited before rendering.
- The artwork framing in the export matches the preview.
- PDF grid is centered, contiguous, and keeps crop marks in the margins.

## 4. Known traps

- `html-to-image` does not reliably render the illustration: keep `.mtg-art-img` excluded and keep
  the manual canvas compositing.
- Do not introduce a raw card hex outside the centralized palette in `cardTheme.ts`.
- Do not duplicate card geometry in React components; keep it in `.mtg-card--*`.
- Adding a template means extending `CardTemplate`, the palette, the CSS block, and the editor
  button without touching the export path.

## 5. Report

State the commands run, the smoke result, the geometry or pixel evidence, and any residual risk.
If an export changed, say whether the preview still matches and which templates were checked.
