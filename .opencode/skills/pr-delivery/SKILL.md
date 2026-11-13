---
name: PR Delivery
description: Prepare an atomic gitmoji + Conventional Commit and a complete pull request for ProxySmith using Gitflow, including the verification matrix and merge checklist. Use when a task is implemented and ready to ship.
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

`npm run check:conventions` is available as a local reminder for branch names and commit headers.

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

## 3. Commit — gitmoji + Conventional Commits

Every commit starts with a [gitmoji](https://gitmoji.dev), then the Conventional Commits header:

```text
<gitmoji> <type>(<scope>): <imperative, lowercase subject, no period>
```

- Use the Unicode emoji followed by a space; the `:shortcode:` form is accepted when the tooling
  does not render emoji. The emoji prefixes the header, it does not replace `type` or `scope`.
- One atomic commit; subject ≤ 72 characters, no trailing period.
- Body explains **why** and the constraints, with lines around 72 characters.
- Reference the issue or task (`Refs: #123`).
- Flag a breaking change with 💥 `:boom:` and a `BREAKING CHANGE:` footer.

| `type` | gitmoji | Use for |
|---|---|---|
| `feat` | ✨ `:sparkles:` | new feature |
| `fix` | 🐛 `:bug:` | bug fix (`🩹 :adhesive_bandage:` for a trivial one) |
| `refactor` | ♻️ `:recycle:` | behavior-preserving refactor |
| `test` | ✅ `:white_check_mark:` | adding or fixing tests |
| `docs` | 📝 `:memo:` | documentation |
| `style` | 💄 `:lipstick:` | UI/CSS only |
| `perf` | ⚡️ `:zap:` | performance |
| `build` | 🔨 `:hammer:` | build system or scripts |
| `ci` | 👷 `:construction_worker:` | CI configuration |
| `chore` | 🔧 `:wrench:` | tooling, config, dependencies |

Cross-cutting additions: ♿️ `:wheelchair:` accessibility, 🔒️ `:lock:` security,
⬆️ `:arrow_up:` dependency upgrade, 🔥 `:fire:` deleting code, 🔖 `:bookmark:` release.

```text
✨ feat(export): keep artwork framing identical to the preview

The export path composites the illustration on canvas because html-to-image
does not render it reliably. Share the framing values with the preview so
both outputs stay aligned.

Refs: #123
```

## 4. Branch — Gitflow

ProxySmith follows [Gitflow](https://nvie.com/posts/a-successful-git-branching-model/):

- `master` — production. Only receives `release/*` and `hotfix/*` merges plus `v<version>` tags.
  Never commit directly to it.
- `develop` — integration. Finished features and bugfixes land here. Never commit directly to it.
- `feature/<topic>` — new work, from `develop`, merged back into `develop`.
- `bugfix/<topic>` — non-urgent fix, from `develop`, merged back into `develop`.
- `release/<version>` — release stabilization, from `develop`; PR into `master`, then a `master` →
  `develop` PR back-merges it; tagged on `master`.
- `hotfix/<version>` — production emergency, from `master`; PR into `master`, then a `master` →
  `develop` PR back-merges it; tagged on `master`.

| Branch | From | PR target | Back-merge | Example |
|---|---|---|---|---|
| `feature/<topic>` | `develop` | `develop` | — | `feature/dark-frame` |
| `bugfix/<topic>` | `develop` | `develop` | — | `bugfix/search-focus` |
| `release/<version>` | `develop` | `master` | `master` → `develop` | `release/0.2.0` |
| `hotfix/<version>` | `master` | `master` | `master` → `develop` | `hotfix/0.1.1` |

Rules:

- English kebab-case after the prefix; the topic is short and descriptive.
- Never branch a feature from `master`, and never open a feature PR against `master`.
- Merge with `--no-ff` to preserve the topology Gitflow relies on. Do not squash feature branches:
  squashing flattens history and breaks the release and hotfix back-merge points.
- `git pull --ff-only` from the base branch before opening the PR.
- One PR = one topic. If it exceeds ~400 useful lines, split it or justify.
- PR title uses the same gitmoji + Conventional Commits format as its main commit.

Typical commands:

```bash
# feature
git switch develop
git pull --ff-only
git switch -c feature/dark-frame
# ... commit ...
git push -u origin feature/dark-frame       # open PR into develop

# release
git switch develop
git pull --ff-only
git switch -c release/0.2.0
# ... bump version and changelog, final QA ...
git push -u origin release/0.2.0            # open PR into master, merge --no-ff
git switch master
git pull --ff-only
git tag -a v0.2.0 -m "v0.2.0"
git push origin v0.2.0
# open a master -> develop PR, merge --no-ff (back-merge)

# hotfix
git switch master
git pull --ff-only
git switch -c hotfix/0.1.1
# ... fix + tests ...
git push -u origin hotfix/0.1.1             # open PR into master, merge --no-ff
git switch master
git pull --ff-only
git tag -a v0.1.1 -m "v0.1.1"
git push origin v0.1.1
# open a master -> develop PR, merge --no-ff (back-merge)
```

## 5. PR description

Create the PR body from `.github/pull_request_template.md` and fill every section. The template is
the canonical description; do not restate it here. Attach screenshots and `tmp/` artifacts; never
commit them.

## 6. Merge checklist

- The PR targets the Gitflow branch: `develop` for feature/bugfix, `master` for release/hotfix.
- The `Typecheck, tests and build` check (workflow `CI`) is green; run `npm run check:conventions`
  locally and read its warnings, but never treat a convention warning as a merge blocker.
- Lighthouse Accessibility does not regress.
- Native HTML semantics are preferred; no redundant ARIA was added.
- No WotC asset, OFL fonts only, `PROXY` and disclaimer intact.
- Documentation updated if behavior, commands, or conventions changed.
- Merge with `--no-ff`; tag releases on `master` after the release/hotfix PR, then back-merge with a
  `master` → `develop` PR.
- Delete the merged topic branch. The full GitHub settings checklist is in
  `.github/GITHUB_SETTINGS.md`.

Do not push, open, or merge a PR unless the user explicitly asks. Otherwise, output the proposed
commit message and PR description for review.
