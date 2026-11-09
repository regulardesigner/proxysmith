---
name: PR Delivery
description: Prepare an atomic Conventional Commit and a complete pull request for ProxySmith, including the verification matrix and merge checklist. Use when a task is implemented and ready to ship.
---

# PR Delivery

Read `AGENTS.md` first. Its commit and pull request rules are authoritative. This skill turns a
finished change into a reviewable commit and PR without skipping verification.

## 1. Pre-flight matrix

Run from the project root:

```bash
npm run typecheck
npm test
npm run build
```

Add, depending on the change:

- `npm run smoke` — UI, card, export, or CSS change.
- Lighthouse Accessibility — UI, color, typography, or interaction change.
- Full keyboard flow — new or changed interaction.

Do not prepare a commit while a required command is red.

## 2. Self-review the diff

Check for and remove:

- dead code, debug `console.log`, unjustified TODO;
- disabled or skipped tests;
- hardcoded values that should be constants or tokens;
- secrets, API keys, `*.local`, personal illustrations;
- `node_modules/`, `dist/`, `tmp/`, screenshots;
- WotC artwork or assets, proprietary fonts;
- broken `PROXY` notice or legal disclaimer.

Confirm the diff contains one coherent topic. Split unrelated changes.

## 3. Commit

- Conventional Commits, in English, imperative mood.
- One atomic commit; subject ≤ 72 characters, no trailing period.
- Body explains **why** and the constraints, with lines around 72 characters.
- Reference the issue or task (`Refs: #123`); use `BREAKING CHANGE:` when needed.

```text
feat(export): keep artwork framing identical to the preview

The export path composites the illustration on canvas because html-to-image
does not render it reliably. Share the framing values with the preview so
both outputs stay aligned.

Refs: #123
```

## 4. Branch and PR

- Branch: English kebab-case, for example `feat/frame-color` or `fix/export-artwork`.
- One PR = one topic, opened against `main` after updating to the latest version.
- PR title in Conventional Commits format, identical to the main commit.
- Use this description:

```md
## Context
Why this change, problem, or need.

## Change
What was done, with the key files or modules.

## Verification
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run smoke` (UI / card / export / CSS)
- [ ] Lighthouse Accessibility with no regression
- [ ] Complete keyboard flow verified
- [ ] Documentation updated

## Accessibility
Impact and Lighthouse results (scores + fixed items).

## Screenshots
Before / after for any visual change (attached files, not committed).

## Risks
Side effects, rollback, points to test manually.
```

Attach screenshots and `tmp/` artifacts; never commit them.

## 5. Merge checklist

- Tests are green and there is no console error.
- Lighthouse Accessibility does not regress.
- Native HTML semantics are preferred; no redundant ARIA was added.
- No WotC asset, OFL fonts only, `PROXY` and disclaimer intact.
- Documentation updated if behavior, commands, or conventions changed.
- Squash merge when the platform allows it.

Do not push, open, or merge a PR unless the user explicitly asks. Otherwise, output the proposed
commit message and PR description for review.
