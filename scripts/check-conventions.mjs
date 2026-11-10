#!/usr/bin/env node
/**
 * Non-blocking branch, pull request title, and commit convention check.
 *
 * Emits GitHub Actions warnings (`::warning::`) or plain `warning:` lines, and always exits 0.
 * Branch and commit naming are documentation rules in AGENTS.md, not merge gates.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BRANCH_PATTERN = /^(feature|bugfix|release|hotfix)\/[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const PROTECTED_BRANCHES = new Set(['develop', 'master']);
const TYPES = ['feat', 'fix', 'refactor', 'test', 'docs', 'style', 'perf', 'build', 'ci', 'chore'];
const HEADER_PATTERN = new RegExp(
  `^(?:\\p{Extended_Pictographic}\\uFE0F?|:[a-z0-9_+-]+:)\\s+(${TYPES.join('|')})` +
    `(?:\\(([a-z0-9]+(?:-[a-z0-9]+)*)\\))?!?:\\s+(\\S.*)$`,
  'u',
);
const MAX_SUBJECT_LENGTH = 72;

const isCi = process.env.GITHUB_ACTIONS === 'true';

function warn(message) {
  if (isCi) {
    console.log(`::warning title=Conventions::${message}`);
  } else {
    console.log(`warning: ${message}`);
  }
}

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function resolveBranch() {
  return (
    process.env.GITHUB_HEAD_REF ||
    process.env.GITHUB_REF_NAME ||
    git(['rev-parse', '--abbrev-ref', 'HEAD'])
  );
}

function resolveHashes() {
  const baseSha = process.env.BASE_SHA;
  if (baseSha && !/^0+$/.test(baseSha)) {
    try {
      return git(['rev-list', `${baseSha}..HEAD`]).split('\n').filter(Boolean);
    } catch {
      warn(`cannot compare with BASE_SHA ${baseSha}; falling back to the local base branch`);
    }
  }

  const base = process.env.GITHUB_BASE_REF || 'develop';
  const mergeBase = newestMergeBase([base, `origin/${base}`]);
  if (mergeBase) {
    return git(['rev-list', `${mergeBase}..HEAD`]).split('\n').filter(Boolean);
  }

  warn(`cannot resolve the base branch "${base}"; checking the last 20 commits only`);
  return git(['rev-list', '-n', '20', 'HEAD']).split('\n').filter(Boolean);
}

function newestMergeBase(candidates) {
  const bases = [];
  for (const candidate of candidates) {
    try {
      bases.push(git(['merge-base', candidate, 'HEAD']));
    } catch {
      // The candidate does not exist locally; try the next one.
    }
  }
  if (bases.length === 0) return null;

  let newest = bases[0];
  for (const candidate of bases.slice(1)) {
    if (candidate === newest) continue;
    try {
      // `--is-ancestor` succeeds when `newest` is an ancestor of `candidate`.
      git(['merge-base', '--is-ancestor', newest, candidate]);
      newest = candidate;
    } catch {
      // `candidate` is not newer; keep the current merge base.
    }
  }
  return newest;
}

function headerProblem(header) {
  if (header.startsWith('Merge ')) return null;

  const match = HEADER_PATTERN.exec(header);
  if (!match) {
    return (
      `"${header}" is not "<gitmoji> <type>(<scope>): <subject>" ` +
      `(types: ${TYPES.join(', ')})`
    );
  }

  const subject = match[3];
  if (subject.length > MAX_SUBJECT_LENGTH) {
    return `subject is ${subject.length} characters (max ${MAX_SUBJECT_LENGTH})`;
  }
  if (subject.endsWith('.')) return 'subject must not end with a period';
  if (!/^[a-z0-9]/.test(subject)) {
    return 'subject must start lowercase, in the imperative mood';
  }
  return null;
}

function checkBranch(branch) {
  if (PROTECTED_BRANCHES.has(branch)) return;
  if (BRANCH_PATTERN.test(branch)) return;
  warn(
    `branch "${branch}" does not match feature/<topic>, bugfix/<topic>, release/<version> ` +
      'or hotfix/<version> (English kebab-case)',
  );
}

function checkTargetBranch(head, base) {
  if (!head || !base) return;

  if (/^(feature|bugfix)\//.test(head) && base !== 'develop') {
    warn(`pull request "${head}" targets "${base}" instead of "develop"`);
  }
  if (/^(release|hotfix)\//.test(head) && base !== 'master') {
    warn(`pull request "${head}" targets "${base}" instead of "master"`);
  }
}

function checkCommit(hash) {
  const header = git(['show', '-s', '--format=%B', hash]).split('\n')[0];
  const problem = headerProblem(header);
  if (problem) warn(`${hash.slice(0, 7)}: ${problem}`);
}

function checkPullRequestTitle() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return;

  try {
    const event = JSON.parse(readFileSync(eventPath, 'utf8'));
    const title = event.pull_request?.title;
    if (!title) return;

    const problem = headerProblem(title);
    if (problem) warn(`pull request title: ${problem}`);
  } catch {
    // The event payload is optional; never fail on it.
  }
}

function main() {
  const branch = resolveBranch();
  const hashes = resolveHashes();

  checkBranch(branch);
  checkTargetBranch(process.env.GITHUB_HEAD_REF, process.env.GITHUB_BASE_REF);
  checkPullRequestTitle();
  for (const hash of hashes) checkCommit(hash);

  console.log(
    `Conventions checked on "${branch}" for ${hashes.length} commit(s); warnings do not fail CI.`,
  );
}

try {
  main();
} catch (error) {
  warn(`convention check could not run: ${error instanceof Error ? error.message : String(error)}`);
}
