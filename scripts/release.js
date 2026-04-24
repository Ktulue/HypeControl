#!/usr/bin/env node
/**
 * HypeControl release script.
 * Phase 1: preflight + scaffold.
 * Phase 2 (--continue): lockstep bump + build + zip + tag.
 *
 * Exported functions are testable in isolation via dependency injection.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATHS = [
  path.join(ROOT, 'package.json'),
  path.join(ROOT, 'manifest.json'),
  path.join(ROOT, 'manifest.firefox.json'),
];

function defaultExec(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8' });
}

function defaultReadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/**
 * Preflight checks before either phase runs.
 * @returns {{currentVersion: string}}
 * @throws if any precondition fails
 */
function preflight({ exec = defaultExec, readJson = defaultReadJson } = {}) {
  const status = exec('git status --porcelain').trim();
  if (status) {
    throw new Error(`Working tree is not clean:\n${status}\nCommit or stash changes before running release.`);
  }

  const branch = exec('git branch --show-current').trim();
  if (branch === 'main' || branch === 'master') {
    throw new Error(`Current branch is "${branch}". Release work must not be on main or master — cut a maint/vX.Y.Z-release branch first.`);
  }

  const versions = MANIFEST_PATHS.map((p) => ({
    path: path.relative(ROOT, p),
    version: readJson(p).version,
  }));
  const distinct = new Set(versions.map((v) => v.version));
  if (distinct.size > 1) {
    const summary = versions.map((v) => `  ${v.path}: ${v.version}`).join('\n');
    throw new Error(`Manifests drift — versions do not match:\n${summary}\nFix drift before running release.`);
  }

  return { currentVersion: versions[0].version };
}

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * Compute the next version string given the current one and a bump type.
 * @param {string} current - Current version like "1.1.0"
 * @param {'patch'|'minor'|'major'} bumpType
 * @returns {string}
 */
function computeNextVersion(current, bumpType) {
  const m = SEMVER_RE.exec(current);
  if (!m) {
    throw new Error(`Invalid version: "${current}". Expected MAJOR.MINOR.PATCH with no prefix or suffix.`);
  }
  const [, majStr, minStr, patStr] = m;
  const major = parseInt(majStr, 10);
  const minor = parseInt(minStr, 10);
  const patch = parseInt(patStr, 10);

  switch (bumpType) {
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'major': return `${major + 1}.0.0`;
    default:
      throw new Error(`Unknown bump type: "${bumpType}". Expected patch, minor, or major.`);
  }
}

module.exports = { preflight, computeNextVersion };
