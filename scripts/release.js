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

function getChangelogScaffold({ version, date, gitLogLines }) {
  const logBlock = gitLogLines.length
    ? gitLogLines.join('\n')
    : '(no git-log output — no prior tag)';
  return [
    `## [${version}] - ${date}`,
    '',
    '<!-- TODO: fill in from git log below -->',
    '',
    '### Added',
    '-',
    '',
    '### Fixed',
    '-',
    '',
    '### Changed',
    '-',
    '',
    '<!--',
    'Raw material — commits since the last tag:',
    '```',
    logBlock,
    '```',
    '-->',
    '',
    '---',
    '',
  ].join('\n');
}

function getReleaseNotesScaffold({ template, version, date }) {
  return template
    .replace(/vX\.Y\.Z/g, `v${version}`)
    .replace(/Month DD, YYYY/g, date);
}

function scaffoldChangelogEntry({ existing, scaffold }) {
  // Find the first "## [" block header and insert scaffold immediately before it.
  const firstHeaderIdx = existing.indexOf('\n## [');
  if (firstHeaderIdx === -1) {
    // No existing version entries — append at end after preamble.
    return existing.trimEnd() + '\n\n' + scaffold;
  }
  const insertAt = firstHeaderIdx + 1; // After the newline, before "## ["
  return existing.slice(0, insertAt) + scaffold + existing.slice(insertAt);
}

function scaffoldReleaseNotes({ version, date, fs: injectedFs = fs, root = ROOT }) {
  // Use forward-slash joins so injected-root tests pass on Windows too.
  const templatePath = `${root}/docs/release-notes/_template.md`;
  const outPath = `${root}/docs/release-notes/v${version}.md`;
  if (injectedFs.existsSync(outPath)) {
    throw new Error(`Release notes already exists: ${outPath}`);
  }
  const template = injectedFs.readFileSync(templatePath, 'utf8');
  const filled = getReleaseNotesScaffold({ template, version, date });
  injectedFs.writeFileSync(outPath, filled);
  return outPath;
}

function verifyScaffoldsFilled({ version, fs: injectedFs = fs, root = ROOT }) {
  const changelogPath = `${root}/CHANGELOG.md`;
  const notesPath = `${root}/docs/release-notes/v${version}.md`;

  const changelog = injectedFs.readFileSync(changelogPath, 'utf8');
  if (changelog.includes('<!-- TODO: fill in from git log below -->')) {
    throw new Error(
      `CHANGELOG.md contains placeholder marker. Fill in the v${version} entry before running --continue.`
    );
  }

  const notes = injectedFs.readFileSync(notesPath, 'utf8');
  if (notes.includes('<!-- TODO: hero paragraph -->')) {
    throw new Error(
      `Release notes file ${notesPath} contains placeholder marker. Fill in the hero paragraph before running --continue.`
    );
  }
}

function bumpManifests({ newVersion, fs: injectedFs = fs, root = ROOT }) {
  for (const rel of ['package.json', 'manifest.json', 'manifest.firefox.json']) {
    const p = `${root}/${rel}`;
    const obj = JSON.parse(injectedFs.readFileSync(p, 'utf8'));
    obj.version = newVersion;
    injectedFs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
  }
}

module.exports = {
  preflight,
  computeNextVersion,
  getChangelogScaffold,
  getReleaseNotesScaffold,
  scaffoldChangelogEntry,
  scaffoldReleaseNotes,
  verifyScaffoldsFilled,
  bumpManifests,
};
