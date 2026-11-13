# GitHub settings

This checklist is the source of truth for the repository settings that cannot live in the code.
Apply it once in **Settings → General** and **Settings → Rules** on
`https://github.com/regulardesigner/proxysmith`.

The repository currently uses `master` as the production branch and `develop` as the integration
branch. A rename to `main` is a separate decision; if the branch is renamed, update this file,
`AGENTS.md`, `.opencode/skills/pr-delivery/SKILL.md`, and the `branches` filters in
`.github/workflows/`.

## General

Target state:

- **Default branch:** `develop`.
- **Merge button:** allow merge commits; disable squash merging and rebase merging.
- **Automatically delete head branches:** enabled.
- **Branches:** keep `master` and `develop`.

Squash and rebase are disabled because Gitflow relies on `--no-ff` merge commits and on
release/hotfix back-merge points.

## Branch protection or rulesets

Configure a ruleset (or classic branch protection) for both `master` and `develop`:

- [ ] Require a pull request before merging.
  - Leave **Require approvals** unchecked (**0 approvals**) while the project has a single
    maintainer.
  - [ ] Dismiss stale approvals when new commits are pushed (enable when a second maintainer joins).
  - [ ] Require review from Code Owners (not used: there is no `CODEOWNERS` file).
- [ ] Require status checks to pass before merging.
  - [ ] Require branches to be up to date before merging.
  - Required checks:
    - `Typecheck, tests and build`
    - Do **not** add `Branch and commit warnings (non-blocking)`: warnings must never block a merge.
- [ ] Block force pushes.
- [ ] Block deletions.
- Leave **Require linear history** disabled: it forbids the merge commits Gitflow relies on.
- Leave **Require signed commits** disabled; signatures are optional for this project.

When a second maintainer joins:

- Set required approvals to **1** on `develop` and `master`.
- Optionally add a `CODEOWNERS` file and require Code Owner review.

## Repository features

Optional, depending on how the project is tracked:

- Enable **Issues** if the roadmap needs tracking outside `PLAN.md`.
- Enable **Discussions** only if the project opens to contributors.
- Disable the wiki and projects tabs if unused, to keep the repository focused.

## Verification

After applying the settings:

1. Open a throwaway pull request into `develop` and confirm that `Typecheck, tests and build` is
   listed as required.
2. Try to push directly to `develop` and confirm that GitHub rejects it.
3. Confirm that the conventions workflow appears but does not block the merge.
4. Confirm that merging deletes the head branch automatically.

The settings are not versioned by GitHub; this file is the reproducible checklist. Re-check it after
any repository transfer or branch rename.
