---
name: Skeptical Review
description: Falsification protocol for challenging an implementation assumption before coding. Use when a claim, design choice, bug hypothesis, or proposed change must be tested adversarially.
---

# Skeptical Review

Read `AGENTS.md` first. This skill defines how to attack an assumption. It does not replace domain
skills; load `a11y-audit`, `card-export`, or `pr-delivery` when relevant.

## Core rule

An assumption is accepted only after a genuine attempt to falsify it fails. "Not falsified" is not
proof; it is the current best hypothesis. The goal is to find the counterexample, not to confirm the
idea.

## Protocol

### 1. Formalize

Rewrite the assumption as a falsifiable claim. For example: "Changing the template does not affect
card geometry." Identify:

- scope: files, templates, data, browsers, and user flows involved;
- expected behavior;
- what would count as a counterexample.

If the assumption is vague, split it into smaller claims.

### 2. Define falsification criteria

List the observations that would prove the claim false. Prefer concrete, checkable criteria: DOM
geometry, computed styles, exported pixels, test output, type errors, Scryfall responses, or product
invariants.

### 3. Attack

Try each vector:

- **Code path**: branches, fallbacks, early returns, error paths, and legacy branches that bypass the
  claim.
- **Data**: empty, very long, multi-face, missing fields, mixed languages, unusual accents.
- **State**: persisted preferences, reload, `StrictMode` double effects, stale async responses.
- **Geometry and export**: 750 × 1050 stage, transforms, fonts, pixel ratio, `pHYs`, PDF layout.
- **Accessibility**: native semantics, keyboard, focus, contrast, zoom, reflow.
- **Tests**: what is not covered; does a test assert the claim or merely the current implementation?
- **History and docs**: prior fixes, known pitfalls, `README.md`, `PLAN.md`.

Use read/grep/glob, `git diff`, `git log`, `npm test`, `npm run typecheck`, and `npm run build` when
useful.

### 4. Try to break it

Construct at least one concrete counterexample, or explain why none can exist. Do not stop at "looks
correct". Check the edge the implementation is most likely to miss.

### 5. Verdict

Return exactly one:

- **FALSIFIED** — a counterexample or contradiction exists. Provide evidence and the smallest
  reproduction.
- **NOT FALSIFIED** — a genuine attempt found no counterexample. List the attacks attempted,
  residual risk, and what evidence would change the verdict.
- **INCONCLUSIVE** — missing access, environment, or information. State exactly what is needed.

### 6. Confidence

Low, medium, or high, with one sentence justifying it. Never claim certainty from absence of
evidence.

## Output

- Assumption in one sentence.
- Falsification criteria.
- Attacks attempted and evidence (`file:line`, command, output).
- Verdict and confidence.
- If `NOT FALSIFIED`: residual risks and the recommended next verification.
- No implementation, no edits, and no full redesign unless explicitly asked.
