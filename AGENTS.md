# AGENTS.md

Guide for coding agents working on **ProxySmith**. It complements [`README.md`](./README.md)
(product overview, getting started) and [`PLAN.md`](./PLAN.md) (roadmap and decisions). In case of
conflict: an explicit user instruction wins, then this file, then the README.

## Project

ProxySmith is a local web app that creates **Magic: The Gathering proxies** from Scryfall data and
the user's own illustration.

Product invariants:

- **No official artwork** is fetched, displayed, or exported. The illustration comes from a local
  upload (PNG/JPG/WebP, 20 MB max).
- **Frames are original**: no WotC asset, frame, or proprietary font.
- The **`PROXY`** notice stays visible on the card and the legal disclaimer stays present.
- Three templates: `signature` (light/dark), `classic` (1993), `modern` (2026).
- Outputs: **PNG 750 × 1050 px at 300 DPI** (63.5 × 88.9 mm) and **A4 9-up PDF** with crop marks.
- 100% client-side: no account, no backend, no analytics. The only network call is Scryfall.

Status: local MVP. PWA, IndexedDB persistence, Tauri 2, and AI illustration generation are planned
in `PLAN.md`; do not implement them without an explicit request.

## Commands

Always run from the project root (`/Users/dams/Projects/proxysmith`), not from the parent
directory.

```bash
npm install
npm run dev -- --port 5173   # development server
npm test                     # Vitest unit tests
npm run typecheck            # strict TypeScript, no emit
npm run build                # typecheck + production build
npm run preview              # serve the production build (Lighthouse)
npm run smoke                # Playwright E2E flow, dev server required
npm run check:conventions    # warning-only branch/commit naming check
```

- Node.js 22+ (`.nvmrc` is provided; run `nvm use` if you use nvm).
- `npm run smoke` launches the installed Chrome (`channel: 'chrome'`) against
  `http://localhost:5173`, writes its screenshots and artifacts to `tmp/` (git-ignored), and must be
  run **after** the dev server.
- Lighthouse runs against `npm run preview` (production build), never against the Vite development
  server.
- Before considering a task done: `npm run typecheck`, `npm test`, `npm run build`. Add
  `npm run smoke` whenever a change touches the UI, card rendering, exports, or CSS.
- `npm run check:conventions` verifies branch names and commit headers but only prints warnings and
  always exits 0. It is a reminder, never a merge gate.

## Skills and subagents

Project-local OpenCode assets live in `.opencode/`:

```text
.opencode/
├── agents/
│   ├── a11y-skeptic.md
│   ├── export-skeptic.md
│   ├── implementer.md
│   ├── reviewer.md
│   ├── skeptic.md
│   └── test-writer.md
└── skills/
    ├── a11y-audit/SKILL.md
    ├── card-export/SKILL.md
    ├── pr-delivery/SKILL.md
    └── skeptical-review/SKILL.md
```

Skills (loaded on demand):

- `a11y-audit` — WCAG 2.2 AA, native-first ARIA, keyboard flow, Lighthouse on the production
  preview.
- `card-export` — card rendering, PNG/PDF export, artwork compositing, print geometry, smoke/pixel
  checks.
- `pr-delivery` — atomic gitmoji + Conventional Commit, Gitflow branches, PR description,
  verification matrix, merge checklist.
- `skeptical-review` — falsification protocol: formalize an assumption, define what would disprove
  it, attack it with code/data/tests, and return `FALSIFIED`, `NOT FALSIFIED`, or `INCONCLUSIVE`.

Subagents:

- `implementer` — writes scoped code in `src/**` after the assumption has passed skeptical review;
  never edits tests, docs, or configuration.
- `reviewer` — read-only review of correctness, regressions, React pitfalls, accessibility, and
  product invariants.
- `test-writer` — writes and updates Vitest tests for pure `lib/` logic, with edit access limited to
  `src/lib/**/*.test.ts`.
- `skeptic` — general assumption falsifier: product invariants, architecture, React, data flow,
  persistence, and tests.
- `a11y-skeptic` — falsifies accessibility claims with native semantics, keyboard, focus, contrast,
  zoom, and WCAG 2.2 AA evidence.
- `export-skeptic` — falsifies card rendering, PNG/PDF export, and print-geometry claims.

Workflow for a non-trivial change:

1. State the assumption as one falsifiable sentence and name its scope.
2. Run `skeptic`, or the domain skeptic (`a11y-skeptic`, `export-skeptic`), before implementing.
3. Implement only after a `NOT FALSIFIED` verdict. `NOT FALSIFIED` is not proof; it is the current
   best hypothesis.
4. Add or update the failing test with `test-writer`, then implement with `implementer` (or the
   primary agent for a one-file change).
5. Run `reviewer` on the resulting diff before delivery.

Rules:

- `AGENTS.md` remains the source of truth. Skills and agents reference it; they must not restate or
  contradict it.
- Delegate to a subagent only for substantial, self-contained work. A one-line edit is cheaper in the
  primary session.
- Subagents start with fresh context: give them explicit scope, files, and acceptance criteria.
- Model IDs in `.opencode/agents/*.md` are environment-specific. Verify them with `opencode models`
  and adjust; never assume a model is available.
- Keep `steps` low and permissions narrow: read-only skeptics and reviewer, tests-only writer,
  source-only implementer.
- Permission rules are evaluated **last match wins**. Put the broad rule first and the exception
  after it (`shell: "*" → deny`, then `shell: "npm test*" → allow`), never the reverse.
- Patterns only support `*` and `?`. `*` also matches `/`, but the literal slash in
  `src/lib/**/*.test.ts` still requires a subdirectory, so it does not match the flat colocated
  files at `src/lib/*.test.ts`. Use the flat glob for `src/lib` tests.
- A subagent's findings are advisory. The primary agent verifies and applies changes.
- Prefer one implementer per scoped change. Do not let it edit tests, docs, or configuration.
- A skeptic is read-only and must report evidence, not opinions. If it returns `FALSIFIED` or
  `INCONCLUSIVE`, do not implement; revise the assumption or gather the missing evidence.
- Add a new skill or agent only for a recurring workflow; do not duplicate `AGENTS.md` content.

## Architecture

```
src/
├── components/        # React UI: search, preview, editor, upload, mana
├── hooks/             # reusable hooks (debounce)
├── lib/               # business logic: scryfall, mana, theme, export boundary
├── store/             # Zustand global state
├── types.ts           # shared domain types
├── index.css          # global theme + 750 × 1050 rendering of the three templates
├── App.tsx            # screen composition and export orchestration
└── main.tsx           # React bootstrap
scripts/smoke.mjs      # E2E flow and render/export checks
```

Data flow:

```
SearchPanel → lib/scryfall.ts → store/useCardStore.ts → CardPreview → lib/export.ts
```

Dependency rules:

- `lib/` depends on neither React nor the store. `scryfall.ts`, `mana.ts`, and `cardTheme.ts` are
  pure and tested; `export.ts` is the DOM/canvas boundary, but its calculations
  (`computeSheetLayout`, `withPngDpi`, `slugify`) stay pure and testable.
- Components do not `fetch`: search goes through `lib/scryfall.ts` and TanStack Query.
- The store is the **source of truth** for the card, template, variant, accent, and artwork.
  Components read through targeted Zustand selectors (`useCardStore((state) => state.card)`), never
  the entire store.
- Side effects (DOM, download, canvas, `localStorage`) stay at the boundaries: `lib/export.ts`,
  `ArtUpload`, `useCardStore`.
- `types.ts` contains only domain types, with no logic.

## Clean coding

- Strict TypeScript (`strict`, `noUnusedLocals`, `noUnusedParameters`). No `any`; prefer `unknown`
  followed by a type guard.
- `verbatimModuleSyntax` is enabled: use `import type { … }` for types.
- Code identifiers in English, **UI text in French**. Card content may be in French or English
  depending on Scryfall.
- Follow the existing style: 2 spaces, single quotes, semicolons, trailing commas, lines around 100
  characters. No dedicated formatter or linter for now.
- Files: `PascalCase.tsx` for components, `camelCase.ts` for `lib/`, `hooks/`, and `store/`.
- Functional React components, named exports (`export function CardPreview`), no classes. `App`
  remains the `export default` exception for the entry point.
- Short, single-responsibility functions with early returns. Extract as soon as a function mixes
  several concerns (fetch + normalization + sorting, for example).
- No magic numbers: named and exported constants (`CARD_WIDTH_PX`, `MM_TO_PT`, `MIN_REQUEST_GAP`,
  `MAX_BYTES`). Same rule for `localStorage` keys.
- Avoid duplication before the third occurrence; abstract only when the need is stable.
- Rare and useful comments: explain **why** (Scryfall constraint, browser bug, print geometry), not
  **what** the code does.
- Errors: user-facing messages in French, typed if possible (`ScryfallError`), never a silent
  `catch`. Export errors bubble up to `App.tsx` to be displayed.
- No permanent `console.log`. Diagnostic logs stay in `scripts/`.

## SOLID principles

Apply SOLID pragmatically, not dogmatically:

- **S** — One responsibility per module: `scryfall.ts` (API + normalization), `mana.ts` (parsing),
  `cardTheme.ts` (colors), `export.ts` (canvas/PDF rendering). One component = one area of the
  screen.
- **O** — Extend templates through **CSS modifiers + variables**, not proliferating conditions.
  Adding a template = extend `CardTemplate`, add its palette in `cardTheme.ts`, its
  `.mtg-card--…` block in `index.css`, its button in `EditorPanel`. Exports and auto-fit must keep
  working without modification.
- **L** — All templates follow the same contract: 750 × 1050 card, non-overlapping zones, auto-fit,
  theme resolved by `resolveCardTheme`. A template must not break the preview or produce an export
  different from the screen.
- **I** — Small, explicit props. Split rather than pass a monolithic object (`ManaSymbol` /
  `ManaCost` / `OracleText`). Do not expose unused APIs.
- **D** — Depend on local abstractions: components → `types.ts` and `lib/` functions, no direct
  Scryfall or DOM calls. Export paths are testable through their pure functions
  (`computeSheetLayout`, `withPngDpi`, `slugify`).

Before adding a feature, identify **which module owns it**. If the answer is "several", split
first.

## TDD

**Red → green → refactor** loop:

1. Write a test that describes the expected behavior and fails.
2. Implement the minimum to make it pass.
3. Refactor without changing behavior, then rerun the suite.

Conventions:

- **Colocated** unit tests: `src/lib/*.test.ts`, with Vitest (`describe`, `it`, `expect`).
- Test **observable behavior**, not implementation details. Test names in English.
- Prioritize pure logic coverage: FR/EN normalization, multi-face cards, mana mapping,
  accent/gradient resolution, A4 layout, PNG pHYs chunk, slugify. Auto-fit and rendering are
  verified through `npm run smoke`, not in jsdom.
- React components and CSS are not tested in jsdom. The real flow is covered by
  `scripts/smoke.mjs`: DOM, geometry, computed styles, exported pixels, PDF metadata.
- Every fixed bug must come with a regression test. Every new pure function exported from `lib/`
  must have at least a nominal case and an edge case.
- Do not modify a test to make an implementation pass without verifying that the expectation is
  still correct.

## React: best practices and pitfalls

The project uses React 19, TypeScript, Zustand, and TanStack Query. These rules complement clean
coding and aim for predictable rendering with no hidden side effects.

### Best practices

- **Small, typed components.** One component = one responsibility. Type the props
  (`type CardPreviewProps = { … }`), avoid `React.FC`. Extract a subcomponent or a pure function as
  soon as the JSX or logic becomes hard to read.
- **Local state by default.** `useState` for local UI; Zustand only for shared card / artwork /
  template / frame / accent state. Do not duplicate derivable data.
- **Derive during render.** Compute `stats`, `meta`, the theme, or labels from props and state. Do
  not store them or synchronize them with a `useEffect`.
- **Atomic Zustand selectors.** Prefer `useCardStore((state) => state.card)`; do not return a new
  object or array on every render (otherwise use `useShallow`). Update state immutably with
  `set((state) => ({ … }))`.
- **TanStack Query for server state.** No `fetch` in a `useEffect`. Pass the `signal`, stable keys,
  `enabled`, and `staleTime`, and let Query handle caching, retries, and cancellation.
- **Effects = external synchronization.** `useEffect` for DOM listeners, timers, `localStorage`, or
  post-paint synchronization, with systematic cleanup. `useLayoutEffect` only for measuring before
  paint (`AutoFitText`). No effect to compute a derived value.
- **Explicit promises.** In a handler, `void asyncFn()` if the result is not awaited; otherwise
  `async` + `try/catch/finally`. Never leave an unhandled promise.
- **Lists and keys.** Use a stable domain key (`card.scryfallId`), not the index when the list can
  be filtered or reordered. The index remains acceptable for a static sequence, such as the symbols
  of a mana cost.
- **Controlled fields.** A single source of truth: `value` + `onChange`, and `value={card.power ??
  ''}` to avoid switching from uncontrolled to controlled.
- **Measured memoization.** No `useMemo`/`useCallback` by default: React Compiler is not enabled.
  Use them for an expensive calculation or an identity required by a memoized child or an effect.
- **DOM at the boundaries.** No `querySelector` in render. Refs are for measurement and export;
  dynamic theme styles go through CSS variables (`--frame-accent`).
- **Native accessibility first.** See the accessibility section: native HTML element before ARIA,
  associated label, keyboard navigation.

### Known pitfalls to avoid

- `useEffect` with unstable dependencies (recreated object, array, or function) → effect re-runs in
  a loop. Stabilize the dependency or move it out of the component.
- Calling a hook in a condition, a loop, or after an early return → unstable hook order. Hooks
  always stay at the top level of the component.
- Defining a component inside another component → new type on every render, remount, and state
  loss. Declare each component at module level.
- `setState` during render → loop and inconsistent rendering. Compute the derived value or move the
  update into a handler or effect.
- Direct state mutation (`push`, `splice`, `obj.x = …`) → no re-render. Always create a new object
  or array.
- Zustand selector returning a new object on every call → permanent re-render. Use separate
  selectors or `useShallow`.
- `key` based on the index in a reorderable list → state attached to the wrong element. Use a
  stable key.
- `useEffect` without cleanup for a listener or timer → leaks and duplicated handlers. Clean up in
  the return function.
- Stale async response overwriting a newer one → use `AbortController`, a `cancelled` flag
  (`AutoFitText` pattern), or let TanStack Query handle it.
- Reading or writing `ref.current` during render to display a value → use state; the ref is
  reserved for the DOM and measurement.
- `dangerouslySetInnerHTML` with oracle text or a card name → XSS risk. React already escapes text:
  render as text, never as HTML.
- `StrictMode` is enabled in `main.tsx`: in development, effects are double-invoked. Every effect
  must be idempotent and cleaned up; do not disable `StrictMode` to hide a bug.
- Measuring before fonts load → wrong auto-fit. Wait for `document.fonts.ready` (`AutoFitText`
  pattern).
- Inline props or objects recreated on every render on a memoized component → useless memoization.
  Do not memoize without measurement or a real need.

## Minimal design system

The design system is **CSS-first**, derived from `src/index.css` and the Tailwind classes already in
use. Goal: stay consistent without creating a premature component library.

### Foundations

| Role | Project convention |
|---|---|
| Background | `#0f0e0c`, discreet radial glows (`app-glow`) |
| Surfaces | `bg-stone-900/45`, `bg-stone-950/40`, borders `border-stone-700/80` or `stone-800/90` |
| Text | `stone-100` (primary), `stone-400` (secondary/meta); avoid `stone-500/600` for readable text (below 4.5:1 on the dark background) |
| Action | `amber-500` / `amber-400` (primary button, focus, selection) |
| Success / local | `emerald-300` / `emerald-500` |
| Error | `red-300` |
| Radii | `rounded-lg` (field), `rounded-xl` (control), `rounded-2xl` (panel), `rounded-full` (badge, pill) |
| Rhythm | Sections `px-5 py-5`, groups `gap-2/3/4`, containers `max-w-7xl` / `max-w-3xl` |
| Elevation | `shadow-2xl shadow-black/30`, `backdrop-blur` on panels |

- Tailwind 4 is configured in CSS via `@theme`. New fonts or global values are added in `@theme` /
  `:root`, not hardcoded in components.
- A raw color (`#…`) is acceptable only in a centralized **template palette**
  (`src/lib/cardTheme.ts`, `index.css` variables) or a decorative thumbnail. Otherwise, reuse the
  `stone` / `amber` / `emerald` / `red` scale.
- A new value must reuse the existing scale. If it is genuinely missing, add it as a token, never
  duplicate it.

### Typography

- `font-display`: **Cinzel** — brand, section titles, uppercase labels with `tracking-[0.18em]` to
  `[0.28em]`.
- `font-serif`: **EB Garamond** — card rendering (name, type, oracle), small caps on the 1993
  template.
- UI: system sans-serif stack, sizes `text-[10px]`/`[11px]` for labels, `text-xs`, `text-sm`,
  `text-base`. Numeric values and codes use `font-mono`.
- Embedded fonts are **OFL only**: Cinzel, EB Garamond, `mana-font`. Never add a proprietary font
  (Beleren, MPlantin…). `mana-font` ships proprietary MPlantin assets: the `stripMplantin` Vite
  plugin removes them and falls back to EB Garamond, so no `mplantin-*` asset may appear in
  `dist/`.

### Components and states

- Conditional classes with `clsx`, never manual concatenation.
- Form field: reuse `inputClass` from `EditorPanel` (`stone-700` border, translucent background,
  `amber-500` focus + ring). Do not recreate a local field style.
- Primary button: `amber-500` background, `stone-950` text, `amber-400` hover. Secondary button:
  `stone-700` border, `amber-500/50` hover and `amber-500/5` background. Destructive button: red
  only on hover.
- Disabled states: `disabled:opacity-60` and `disabled:cursor-wait` for exports.
- Selection: `aria-pressed` + amber border/ring. An icon-only control must have a French
  `aria-label`.
- Accessibility: follow the dedicated section below, without exception.

### Accessibility and Lighthouse

Reference level: **WCAG 2.2 AA**. Accessibility is part of the definition of done, not a final pass.

**Web rules**

- **The first rule of ARIA: do not use ARIA.** Always prefer a native HTML element with the
  expected semantics and behavior (`button`, `a`, `nav`, `main`, `header`, `footer`, `label`,
  `input`, `select`, `ul`/`li`, etc.). Never add a `role` or `aria-*` attribute that is redundant
  with native semantics: no `role="button"` on a `<button>`, no `role="list"` on a `<ul>`, no
  `aria-label` if the visible text already names the control.
- Add ARIA only when no native element can express the role, state, or relationship (for example a
  custom combobox, a tab, a dynamic status area). ARIA describes existing semantics; it does not
  fix a non-semantic DOM. A page with less ARIA is generally more robust.
- Do not put `aria-label` on a generic element (`div`, `span`) without a role: the name may be
  ignored. Use a semantic element or an appropriate role, and never put `aria-hidden="true"` on a
  focusable element.
- Semantic and valid HTML: `header`, `main`, `section`, `footer`, `button` for actions, `a` for
  links. Never a clickable `div`. Verify HTML validity and the accessibility tree in Chrome
  DevTools.
- Every control has an accessible name in French: associated `label` (`htmlFor`) or `sr-only`,
  `aria-label` only for icon-only buttons with no visible text. Decorative SVGs are
  `aria-hidden="true"`.
- Complete keyboard navigation: logical order, always-visible focus, `Escape` closes the search
  list, `ArrowUp`/`ArrowDown`/`Enter` select. Never remove an outline without replacing focus with
  a visible style.
- Existing ARIA patterns are legitimate when native HTML does not cover the need:
  `role="combobox"`, `aria-expanded`, `aria-controls` for search, `role="listbox"`,
  `role="option"`, `aria-selected`, `aria-pressed` for states. Keep them, but look for a native
  alternative first before adding new ones. For any new dynamic content, use visible text and, if
  necessary, `aria-live` / `role="status"` / `role="alert"`.
- Do not convey information by color alone: selection combines `aria-pressed` + a ring, errors have
  explicit text.
- Minimum contrast: 4.5:1 for normal text, 3:1 for large text, UI components, and focus. On the dark
  background, `stone-500` and `stone-600` are below 4.5:1: use `stone-400` for readable meta text.
- Forms: error associated with the field (`aria-describedby`), explicit label, no placeholder used
  as the only label.
- Consistent heading hierarchy: one `h1`, then `h2`/`h3` with no skipped level.
- After closing a list or dialog, return focus to the triggering control.
- Respect `prefers-reduced-motion` for non-essential animations (spinner, long transitions,
  animated glows). No flashing content or autoplay.
- Interactive targets: at least 24 × 24 px (WCAG 2.2), with sufficient spacing.
- The app must remain usable at 200% zoom and reflow at 320 px wide (equivalent to 400% on a
  1280 px screen), without content loss or horizontal scrolling of the main panel.
- Every rendered card keeps its `lang` attribute; illustration images have a descriptive `alt`,
  purely decorative images have `alt=""`.

**Lighthouse**

- Generate the build, then serve the production version: `npm run build && npm run preview`.
- Run Lighthouse (Chrome DevTools or CLI) against the preview URL, in desktop navigation and, if the
  screen is responsive, in mobile.
- Targets: **Accessibility 100**, **Performance ≥ 90**, **Best Practices ≥ 95**. SEO is not a
  priority goal for a local app, but no major error may remain.
- Fix first: missing names/labels, insufficient contrast, heading order, targets too small, console
  errors, images without dimensions, non-disableable animations.
- Lighthouse does not replace manual testing: verify the complete flow by keyboard:
  search → select → edit → upload → export.
- Any new UI or any color/typography change must be revalidated with Lighthouse Accessibility
  before the PR. An accessibility regression blocks merging.

### Card rendering contract

- Fixed **750 × 1050 px** stage; never `vh`/`vw` or window-size dependency inside `.mtg-card`. The
  preview is scaled down by `.card-scaler` (`transform: scale`), and the export renders the stage at
  scale 1.
- Geometry (title, illustration, type, text, bottom) lives in the `.mtg-card--*` blocks of
  `src/index.css`. Do not duplicate it in components.
- Available theme variables: `--frame-paper`, `--frame-paper-2`, `--frame-ink`, `--frame-muted`,
  `--frame-line`, `--frame-accent`, `--frame-accent-2`, `--frame-accent-gradient`,
  `--frame-title-ink`.
- Color resolution happens **only** in `src/lib/cardTheme.ts` (`resolveCardTheme`). A component
  never chooses an accent or hardcodes a card hex, except for the centralized palette and template
  thumbnails.
- A template = `.mtg-card` + `.mtg-card--{signature|classic|modern}` (+ `.mtg-card--dark` for
  Signature). Variants must go through CSS variables.
- 1993 relief: light from the top/left, shadow at the bottom/right, embossed title plate, recessed
  art window, CSS-generated parchment. No bitmap assets.
- 2026: real gradient `--frame-accent` → `--frame-accent-2` on two-color cards in automatic mode; an
  imposed color stays monochrome.
- Exports must remain **identical to the preview**: `html-to-image` excludes `.mtg-art-img`, then
  the illustration is composited on canvas with the same framing (`object-fit: cover`, zoom,
  offsets). Any change to geometry or the art class requires `npm run smoke` + a visual/pixel check.

## Scryfall data

- Free API, **no key**. Never commit a key or token.
- Limit ~2 requests/s: 450 ms debounce on search, minimum 500 ms spacing (`MIN_REQUEST_GAP`), 24 h
  TanStack Query cache.
- **French first** search (`lang:fr`), fallback to all languages. Use `printed_name`,
  `printed_text`, `printed_type_line` when available.
- `typeLine` prefers the localized `printed_type_line` (front face first), then falls back to the
  English `type_line`; it stays editable in the editor.
- Multi-face cards: only the **front face** is used (`isFrontFaceOnly`).
- Do not set `User-Agent` in `fetch` (forbidden in browsers); keep `Accept: application/json`.
- Handle `404` (no results) and `429` (explicit message, no aggressive retry).
- Never use Scryfall images in proxies.

## Exports and printing

- PNG: 750 × 1050 px, `pHYs` chunk at 300 DPI, rounded corners.
- PDF: A4 210 × 297 mm, centered 3 × 3 grid with no gaps, crop marks in the margins, ProxySmith
  metadata, `pdf-lib` imported dynamically.
- Wait for `document.fonts.ready` before rendering.
- Deterministic rendering: no residual transform, `pixelRatio: 1`, imposed width/height.
- Any change to `lib/export.ts` must be covered by geometry unit tests and by `npm run smoke`.

## Persistence

Existing `localStorage` keys, to be validated before reading:

- `proxysmith:template` → `signature` | `classic` | `modern`
- `proxysmith:frame` → `minimal` | `dark`
- `proxysmith:accent` → `auto` | `W` | `U` | `B` | `R` | `G` | `C` | `M`

Always guard access with `typeof localStorage === 'undefined'`. Any new preference must be
documented here and in the README.

## Known pitfalls

- The dev server must run from `proxysmith/`; otherwise Vite cannot find the configuration.
- `npm run smoke` fails if the server is not on port 5173.
- `tmp/` is ignored: screenshots must not be committed.
- `html-to-image` does not reliably render the illustration: do not remove the `.mtg-art-img` filter
  or the canvas compositing.
- Choosing a template must not change geometry or break auto-fit.
- `mana-font` maps `{T}` to `ms-tap` and `{Q}` to `ms-untap`: keep the overrides.
- Long cards are a real test case: verify there is no overflow on all three templates.

## Commits and pull requests

### Commits

- One commit = **one coherent, atomic change**. Do not mix a feature, a formatting refactor, and a
  fix in the same commit.
- Commit messages and PR titles in **English**, imperative mood.
- **gitmoji + Conventional Commits** format:

  ```
  <gitmoji> <type>(<scope>): <imperative, lowercase subject, no period>
  ```

  The gitmoji is a Unicode emoji from [gitmoji.dev](https://gitmoji.dev) followed by a space;
  `:shortcode:` is accepted when the tooling does not render emoji. The emoji prefixes the
  Conventional Commit header; it does not replace `type` or `scope`.

  Types: `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `perf`, `build`, `ci`, `chore`.
  Common scopes: `search`, `card`, `editor`, `art`, `export`, `theme`, `store`, `a11y`, `deps`,
  `docs`.

  gitmoji mapping: `feat` ✨, `fix` 🐛, `refactor` ♻️, `test` ✅, `docs` 📝, `style` 💄, `perf` ⚡️,
  `build` 🔨, `ci` 👷, `chore` 🔧; plus ♿️ accessibility, 🔒️ security, ⬆️ dependency upgrade,
  🔥 deletion, 🔖 release, 💥 breaking change.

  Examples:

  ```
  ✨ feat(theme): add a manual frame color override
  🐛 fix(export): keep the artwork framing identical to the preview
  ✅ test(mana): cover tap and untap glyph mapping
  📝 docs(agents): document accessibility and Lighthouse rules
  ```

- Subject ≤ 72 characters, imperative, no initial capital, no trailing period. The body explains
  **why** and the constraints, with lines around 72 characters.
- Reference the issue or task in the body or footer (`Refs: #123`). Flag a breaking change with
  `BREAKING CHANGE:`.
- The commit must be green: `npm run typecheck`, `npm test`, `npm run build`, plus `npm run smoke`
  if the UI or exports are affected.
- Never commit: `node_modules/`, `dist/`, `tmp/`, screenshots, `*.local`, secrets, API keys, the
  user's personal illustrations.
- Update README/PLAN/AGENTS in the same commit if behavior, commands, or conventions change.
- Rewriting local history (`amend`, `rebase`) is allowed; never rewrite a shared branch that has
  already been pushed.

### Branches and pull requests

Gitflow branching model:

- `master` — production; only receives `release/*` and `hotfix/*` merges plus `v<version>` tags.
  Never commit directly to it.
- `develop` — integration; finished features and bugfixes land here. Never commit directly to it.
- `feature/<topic>` — from `develop`, merged back into `develop`.
- `bugfix/<topic>` — from `develop`, merged back into `develop`.
- `release/<version>` — from `develop`; PR into `master`, then a `master` → `develop` PR
  back-merges it; tagged on `master`.
- `hotfix/<version>` — from `master`; PR into `master`, then a `master` → `develop` PR back-merges
  it; tagged on `master`.

Names are English kebab-case after the prefix, for example `feature/dark-frame` or
`bugfix/search-focus`. One PR = **one topic**, opened against the branch's Gitflow target
(`develop` for feature/bugfix, `master` for release/hotfix) after updating to the latest version. If
it exceeds ~400 useful lines, split it or justify. PR title uses the same gitmoji + Conventional
Commits format as its main commit.
- Mandatory description: fill every section of `.github/pull_request_template.md`. It is the
  canonical PR body; skills and agents link to it instead of restating it.

- Self-review the diff before opening the PR: no dead code, no `console.log`, no unjustified TODO,
  no disabled test, no hardcoded value.
- Screenshots and `tmp/` artifacts are attached to the PR, not committed.
- Explicitly verify before merging: no WotC artwork or asset, OFL fonts only, `PROXY` notice and
  disclaimer intact, no exposed secret.
- **Merge with `--no-ff`** to preserve the Gitflow topology; do not squash feature branches, since
  that flattens history and breaks the release and hotfix back-merge points. Tag releases on
  `master` after the release/hotfix PR, then open a `master` → `develop` PR to back-merge; never
  merge locally into a protected branch.
- A PR with red tests, a console error, a Lighthouse Accessibility regression, or a blocking
  accessibility defect must not be merged.

### Review and merge process

Every change reaches `develop` or `master` through a pull request. Direct pushes to these branches
are disabled in GitHub once the settings in
[`.github/GITHUB_SETTINGS.md`](./.github/GITHUB_SETTINGS.md) are applied.

Required on every pull request:

1. **CI green** — the `CI / Typecheck, tests and build` job runs `npm ci`, `npm run typecheck`,
   `npm test`, and `npm run build`.
2. **Local checks for UI changes** — `npm run smoke` for UI, card, export, or CSS changes, plus
   Lighthouse Accessibility when the change touches colors, typography, or interactions.
3. **Self-review** — read the full diff. For a non-trivial change, run the `reviewer` subagent and
   resolve its `Blocker` and `Major` findings, or justify why they do not apply.
4. **PR description** — fill `.github/pull_request_template.md`; keep the verification checkboxes
   accurate.

Solo mode: the repository owner may merge their own PR. No human approval is required while the
project has a single maintainer, but the PR and the green CI checks are mandatory. When a second
maintainer joins, require one approval on `develop` and `master` as described in the settings file.

- The `Conventions` workflow checks branch names, commit headers, PR titles, and Gitflow targets,
  emits `::warning::` annotations, and always succeeds. It is deliberately **not** a required check
  and must never block a merge.
- Keep merge commits: merge with `--no-ff`; squash and rebase merging are disabled in GitHub.
- Release and hotfix back-merges also go through PRs: `release/x → master`, then `master →
  develop`; tag `master` after the first merge.
- Delete the merged topic branch; head-branch auto-deletion is enabled in the settings.
- `develop` and `master` are protected against force pushes and deletion. Never rewrite or delete
  them.

## Definition of done

- The requested behavior works in the preview and, when relevant, in exports.
- Non-trivial assumptions were challenged by a skeptic, and only `NOT FALSIFIED` claims were
  implemented.
- Relevant tests are added or updated; `npm test`, `npm run typecheck`, and `npm run build` pass.
- `npm run smoke` passes for any UI, card, export, or CSS change.
- The complete keyboard flow works and Lighthouse Accessibility does not regress.
- Native HTML semantics are preferred and no redundant ARIA has been added.
- No console errors, no accessibility regression, UI text in French.
- CI is green on the pull request, and convention warnings were reviewed even though they never
  block a merge.
- No WotC artwork or asset added; OFL fonts only; `PROXY` notice intact.
- README/PLAN/AGENTS updated if commands, architecture, templates, accessibility, or preferences
  change.
