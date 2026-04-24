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
 * Phase 1 requires a clean tree. Phase 2 runs against the Phase 1 scaffold
 * (CHANGELOG.md modified + docs/release-notes/vX.Y.Z.md untracked), so
 * Phase 2 skips the clean-tree check.
 * @param {{exec?, readJson?, phase?: 1|2}} opts
 * @returns {{currentVersion: string}}
 * @throws if any precondition fails
 */
function preflight({ exec = defaultExec, readJson = defaultReadJson, phase = 1 } = {}) {
  if (phase === 1) {
    const status = exec('git status --porcelain').trim();
    if (status) {
      throw new Error(`Working tree is not clean:\n${status}\nCommit or stash changes before running release.`);
    }
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
  const templatePath = path.join(root, 'docs/release-notes/_template.md');
  const outPath = path.join(root, 'docs/release-notes', `v${version}.md`);
  if (injectedFs.existsSync(outPath)) {
    throw new Error(`Release notes already exists: ${outPath}`);
  }
  const template = injectedFs.readFileSync(templatePath, 'utf8');
  const filled = getReleaseNotesScaffold({ template, version, date });
  injectedFs.writeFileSync(outPath, filled);
  return outPath;
}

function verifyScaffoldsFilled({ version, fs: injectedFs = fs, root = ROOT }) {
  const changelogPath = path.join(root, 'CHANGELOG.md');
  const notesPath = path.join(root, 'docs/release-notes', `v${version}.md`);

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
    const p = path.join(root, rel);
    const obj = JSON.parse(injectedFs.readFileSync(p, 'utf8'));
    obj.version = newVersion;
    injectedFs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
  }
}

function getLastTag({ exec = defaultExec }) {
  try {
    return exec('git describe --tags --abbrev=0').trim();
  } catch (err) {
    return null;
  }
}

function getGitLogSinceTag({ tag, exec = defaultExec }) {
  if (tag) {
    return exec(`git log ${tag}..HEAD --oneline`).trim().split('\n').filter(Boolean);
  }
  // Fallback: no prior tag exists
  console.log('[release] No prior git tag found — falling back to last 30 commits for raw material.');
  return exec('git log -n 30 --oneline').trim().split('\n').filter(Boolean);
}

function isoDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prettyDate() {
  const d = new Date();
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

async function runPhase1({ bumpType }) {
  const { currentVersion } = preflight();
  const newVersion = computeNextVersion(currentVersion, bumpType);
  console.log(`[release] ${currentVersion} → ${newVersion} (${bumpType})`);

  const lastTag = getLastTag({ exec: defaultExec });
  const gitLogLines = getGitLogSinceTag({ tag: lastTag, exec: defaultExec });

  // CHANGELOG scaffold
  const changelogPath = path.join(ROOT, 'CHANGELOG.md');
  const existing = fs.readFileSync(changelogPath, 'utf8');
  const scaffold = getChangelogScaffold({
    version: newVersion,
    date: isoDate(),
    gitLogLines,
  });
  const updated = scaffoldChangelogEntry({ existing, scaffold });
  fs.writeFileSync(changelogPath, updated);
  console.log(`[release] Scaffolded CHANGELOG.md entry for v${newVersion}`);

  // Release notes scaffold
  const notesPath = scaffoldReleaseNotes({
    version: newVersion,
    date: prettyDate(),
  });
  console.log(`[release] Scaffolded ${path.relative(ROOT, notesPath)}`);

  console.log([
    '',
    'Phase 1 complete. Now:',
    `  1. Edit CHANGELOG.md — replace the <!-- TODO: fill in from git log below --> block with real entries`,
    `  2. Edit ${path.relative(ROOT, notesPath)} — write the hero paragraph, fill in category bullets`,
    `  3. Run: npm run release -- --continue`,
  ].join('\n'));
}

async function runPhase2() {
  preflight({ phase: 2 });
  const { version: currentVersion } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  // Figure out the "next" version from the latest scaffolded CHANGELOG entry
  const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  const m = /^## \[(\d+\.\d+\.\d+)\]/m.exec(changelog);
  if (!m) throw new Error('Could not find a ## [X.Y.Z] header in CHANGELOG.md.');
  const newVersion = m[1];
  if (newVersion === currentVersion) {
    throw new Error(`CHANGELOG top entry is ${newVersion} but manifests are already at ${newVersion}. Did Phase 1 run?`);
  }

  // Sanity check: scraped version must be a valid bump (patch/minor/major) of current.
  // Catches the case where the CHANGELOG top entry is a doc-only block or a stale scaffold.
  const validBumps = ['patch', 'minor', 'major'].map((t) => computeNextVersion(currentVersion, t));
  if (!validBumps.includes(newVersion)) {
    throw new Error(
      `CHANGELOG top entry v${newVersion} is not a valid bump from current v${currentVersion}. ` +
      `Expected one of: ${validBumps.map((v) => `v${v}`).join(', ')}. ` +
      `Check that Phase 1 scaffolded correctly and no unrelated entries were added above it.`
    );
  }

  verifyScaffoldsFilled({ version: newVersion });
  console.log('[release] Scaffolds verified filled in.');

  bumpManifests({ newVersion });
  console.log(`[release] Bumped all three manifests to ${newVersion}`);

  // Build Chrome
  console.log('[release] Building Chrome...');
  defaultExec('npm run build');
  assertDistVersion(newVersion, 'chrome');
  await zipDist(newVersion, 'chrome');

  // Build Firefox (wipes dist/ — sequential is mandatory)
  console.log('[release] Building Firefox...');
  defaultExec('npm run build:firefox');
  assertDistVersion(newVersion, 'firefox');
  await zipDist(newVersion, 'firefox');

  // Commit + tag
  defaultExec(`git add package.json manifest.json manifest.firefox.json CHANGELOG.md docs/release-notes/v${newVersion}.md`);
  defaultExec(`git commit -m "maint: cut v${newVersion} release"`);
  defaultExec(`git tag v${newVersion}`);

  console.log([
    '',
    `Local release cut complete.`,
    `  Branch: ${defaultExec('git branch --show-current').trim()}`,
    `  Tag: v${newVersion} (local only)`,
    `  Zips:`,
    `    releases/hype-control-chrome-v${newVersion}.zip`,
    `    releases/hype-control-firefox-v${newVersion}.zip`,
    '',
    'Next steps (run manually):',
    `  git push -u origin ${defaultExec('git branch --show-current').trim()}`,
    `  gh pr create --title "maint: cut v${newVersion} release"`,
    `  (after PR merge)`,
    `  git push origin v${newVersion}`,
    `  gh release create v${newVersion} --notes-file docs/release-notes/v${newVersion}.md \\`,
    `    releases/hype-control-chrome-v${newVersion}.zip \\`,
    `    releases/hype-control-firefox-v${newVersion}.zip`,
    '  Upload zips to Chrome Web Store + Firefox AMO dashboards.',
  ].join('\n'));
}

function assertDistVersion(expected, target) {
  const distManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist/manifest.json'), 'utf8'));
  if (distManifest.version !== expected) {
    throw new Error(`dist/manifest.json version (${distManifest.version}) does not match expected ${expected} for ${target} build.`);
  }
}

function zipDist(version, target) {
  return new Promise((resolve, reject) => {
    const archiver = require('archiver');
    const zipPath = path.join(ROOT, 'releases', `hype-control-${target}-v${version}.zip`);
    fs.mkdirSync(path.dirname(zipPath), { recursive: true });
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => {
      console.log(`[release] Wrote ${path.relative(ROOT, zipPath)} (${archive.pointer()} bytes)`);
      resolve();
    });
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(path.join(ROOT, 'dist'), false);
    archive.finalize();
  });
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.includes('--continue')) return { phase: 2 };
  if (args.includes('--major')) return { phase: 1, bumpType: 'major' };
  if (args.includes('--minor')) return { phase: 1, bumpType: 'minor' };
  return { phase: 1, bumpType: 'patch' };
}

async function main() {
  const { phase, bumpType } = parseArgs(process.argv);
  try {
    if (phase === 1) await runPhase1({ bumpType });
    else await runPhase2();
  } catch (err) {
    console.error(`[release] FAILED: ${err.message}`);
    if (process.env.HC_RELEASE_DEBUG) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
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
