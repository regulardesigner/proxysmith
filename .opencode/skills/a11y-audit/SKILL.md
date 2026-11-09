---
name: Accessibility Audit
description: Audit ProxySmith UI changes against WCAG 2.2 AA with native-first ARIA, keyboard flow, and Lighthouse targets. Use after any UI, interaction, color, or typography change.
---

# Accessibility Audit

Read `AGENTS.md` first. Its accessibility rules are authoritative; this skill is the execution
checklist. Do not restate or contradict those rules in code comments or new docs.

## When to use

- A UI component, form, control, color, typography, focus style, or animation changed.
- A PR touches `.tsx`, `src/index.css`, or interaction handlers.
- A Lighthouse Accessibility regression is suspected.

## 1. Inspect

- Read the diff and the affected components.
- Identify interactive controls, dynamic regions, dialogs/lists, forms, and images.
- Write down the expected keyboard path: search → select → edit → upload → export.

## 2. Static checks

- Native element first; flag any redundant `role` or `aria-*`.
- Accessible name for every control: associated label, `sr-only`, or `aria-label` only for
  icon-only buttons.
- One `h1`; no heading-level skips.
- `lang` on rendered cards; descriptive `alt` for illustrations; `alt=""` for decorative images.
- Focus is always visible and never removed without a replacement style.
- Contrast: 4.5:1 for normal text, 3:1 for large text, UI components, and focus.
- State is not conveyed by color alone.
- Form errors are linked with `aria-describedby`.
- Targets are at least 24 × 24 px; layout works at 200% zoom and reflows at 320 px.
- `prefers-reduced-motion` is respected.
- No `aria-hidden="true"` on a focusable element.

## 3. Keyboard and focus

- Tab/Shift+Tab through the full flow.
- Enter/Space activate buttons.
- Escape closes the search list.
- ArrowUp/ArrowDown/Enter select a result.
- Focus returns to the trigger after closing a list or dialog.
- No keyboard trap.

## 4. Lighthouse

Build and serve the production bundle in one terminal:

```bash
npm run build
npm run preview
```

Preview defaults to `http://localhost:4173`. In another terminal:

```bash
npx lighthouse http://localhost:4173 \
  --only-categories=accessibility,performance,best-practices \
  --chrome-flags="--headless=new" \
  --output=json --output-path=tmp/lighthouse.json
```

Run desktop and, if the layout is responsive, mobile emulation. Targets: **Accessibility 100**,
**Performance ≥ 90**, **Best Practices ≥ 95**. Read the JSON `categories` and `audits`; fix failures,
not just the score.

## 5. Report

Report findings in severity order:

- **Blocker** — WCAG failure or inaccessible flow.
- **Major** — misleading semantics, missing accessible name, focus loss.
- **Minor** — polish, target size, motion.

Each finding: `file:line`, criterion, observed behavior, suggested fix. This skill produces
findings; apply fixes only when the task explicitly includes implementation. After fixing, rerun the
affected checks and Lighthouse.
