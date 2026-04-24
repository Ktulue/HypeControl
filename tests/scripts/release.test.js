/**
 * @jest-environment node
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { preflight } = require('../../scripts/release.js');

describe('release.js preflight', () => {
  test('preflight throws when working tree is dirty', () => {
    // Mock execSync to return non-empty git status
    const mockExec = jest.fn((cmd) => {
      if (cmd.includes('git status --porcelain')) return ' M package.json\n';
      if (cmd.includes('git branch --show-current')) return 'maint/foo\n';
      return '';
    });
    expect(() => preflight({ exec: mockExec, readJson: () => ({ version: '1.1.0' }) }))
      .toThrow(/working tree is not clean/i);
  });

  test('preflight throws when on main branch', () => {
    const mockExec = jest.fn((cmd) => {
      if (cmd.includes('git status --porcelain')) return '';
      if (cmd.includes('git branch --show-current')) return 'main\n';
      return '';
    });
    expect(() => preflight({ exec: mockExec, readJson: () => ({ version: '1.1.0' }) }))
      .toThrow(/must not be on main or master/i);
  });

  test('preflight throws when on master branch', () => {
    const mockExec = jest.fn((cmd) => {
      if (cmd.includes('git status --porcelain')) return '';
      if (cmd.includes('git branch --show-current')) return 'master\n';
      return '';
    });
    expect(() => preflight({ exec: mockExec, readJson: () => ({ version: '1.1.0' }) }))
      .toThrow(/must not be on main or master/i);
  });

  test('preflight throws when manifests drift', () => {
    const mockExec = jest.fn((cmd) => {
      if (cmd.includes('git status --porcelain')) return '';
      if (cmd.includes('git branch --show-current')) return 'maint/foo\n';
      return '';
    });
    const mockReadJson = jest.fn((p) => {
      if (p.endsWith('package.json')) return { version: '1.1.0' };
      if (p.endsWith('manifest.json')) return { version: '1.1.0' };
      if (p.endsWith('manifest.firefox.json')) return { version: '1.0.2' };
      throw new Error('unexpected read: ' + p);
    });
    expect(() => preflight({ exec: mockExec, readJson: mockReadJson }))
      .toThrow(/manifests drift/i);
  });

  test('preflight passes on a clean feature branch with aligned manifests', () => {
    const mockExec = jest.fn((cmd) => {
      if (cmd.includes('git status --porcelain')) return '';
      if (cmd.includes('git branch --show-current')) return 'maint/release-workflow\n';
      return '';
    });
    const mockReadJson = jest.fn(() => ({ version: '1.1.0' }));
    expect(() => preflight({ exec: mockExec, readJson: mockReadJson })).not.toThrow();
    // Returns the current version for downstream use
    expect(preflight({ exec: mockExec, readJson: mockReadJson })).toEqual({ currentVersion: '1.1.0' });
  });
});

const { computeNextVersion } = require('../../scripts/release.js');

describe('release.js computeNextVersion', () => {
  test('patch bump (default)', () => {
    expect(computeNextVersion('1.1.0', 'patch')).toBe('1.1.1');
    expect(computeNextVersion('0.4.28', 'patch')).toBe('0.4.29');
  });

  test('minor bump resets patch', () => {
    expect(computeNextVersion('1.1.0', 'minor')).toBe('1.2.0');
    expect(computeNextVersion('1.0.10', 'minor')).toBe('1.1.0');
  });

  test('major bump resets minor + patch', () => {
    expect(computeNextVersion('1.1.0', 'major')).toBe('2.0.0');
    expect(computeNextVersion('0.4.28', 'major')).toBe('1.0.0');
  });

  test('rejects non-semver input', () => {
    expect(() => computeNextVersion('v1.1.0', 'patch')).toThrow(/invalid version/i);
    expect(() => computeNextVersion('1.1', 'patch')).toThrow(/invalid version/i);
    expect(() => computeNextVersion('1.1.0-beta', 'patch')).toThrow(/invalid version/i);
  });

  test('rejects unknown bump type', () => {
    expect(() => computeNextVersion('1.1.0', 'mega')).toThrow(/unknown bump type/i);
  });
});

const { scaffoldChangelogEntry, scaffoldReleaseNotes, getChangelogScaffold, getReleaseNotesScaffold } = require('../../scripts/release.js');

describe('release.js scaffold helpers', () => {
  test('getChangelogScaffold produces a dated version block with git-log comment', () => {
    const out = getChangelogScaffold({
      version: '1.1.1',
      date: '2026-05-01',
      gitLogLines: ['abc1234 fix: something'],
    });
    expect(out).toContain('## [1.1.1] - 2026-05-01');
    expect(out).toContain('<!-- TODO: fill in from git log below -->');
    expect(out).toContain('abc1234 fix: something');
    expect(out).toMatch(/### Added[\s\S]*### Fixed[\s\S]*### Changed/);
  });

  test('getReleaseNotesScaffold fills version and date into template', () => {
    const template = '# vX.Y.Z — Month DD, YYYY\n\n<!-- TODO: hero paragraph -->\n';
    const out = getReleaseNotesScaffold({
      template,
      version: '1.1.1',
      date: 'May 1, 2026',
    });
    expect(out).toContain('# v1.1.1 — May 1, 2026');
    expect(out).toContain('<!-- TODO: hero paragraph -->');
    expect(out).not.toContain('vX.Y.Z');
    expect(out).not.toContain('Month DD, YYYY');
  });

  test('scaffoldChangelogEntry inserts new block above existing entries', () => {
    const existing = '# Changelog\n\n---\n\n## [1.1.0] - 2026-04-24\n\n### Changed\n- prior\n';
    const out = scaffoldChangelogEntry({
      existing,
      scaffold: '## [1.1.1] - 2026-05-01\n\n### Fixed\n- new\n',
    });
    const firstHeader = out.indexOf('## [1.1.1]');
    const oldHeader = out.indexOf('## [1.1.0]');
    expect(firstHeader).toBeGreaterThan(-1);
    expect(firstHeader).toBeLessThan(oldHeader);
    // preamble + separator preserved
    expect(out.startsWith('# Changelog\n\n---\n\n')).toBe(true);
  });

  test('scaffoldReleaseNotes writes a new file when it does not exist', () => {
    const written = {};
    const fakeFs = {
      existsSync: () => false,
      writeFileSync: (p, content) => { written[p] = content; },
      readFileSync: () => '# vX.Y.Z — Month DD, YYYY\n\n<!-- TODO: hero paragraph -->',
    };
    scaffoldReleaseNotes({
      version: '1.1.1',
      date: 'May 1, 2026',
      fs: fakeFs,
      root: '/tmp/hc',
    });
    const expectedPath = '/tmp/hc/docs/release-notes/v1.1.1.md';
    expect(written[expectedPath]).toContain('# v1.1.1 — May 1, 2026');
  });

  test('scaffoldReleaseNotes refuses to overwrite existing file', () => {
    const fakeFs = {
      existsSync: () => true,
      writeFileSync: () => { throw new Error('should not write'); },
      readFileSync: () => '',
    };
    expect(() => scaffoldReleaseNotes({
      version: '1.1.1',
      date: 'May 1, 2026',
      fs: fakeFs,
      root: '/tmp/hc',
    })).toThrow(/already exists/i);
  });

  test('no-prior-tags fallback: getChangelogScaffold handles empty gitLogLines', () => {
    const out = getChangelogScaffold({
      version: '1.0.0',
      date: '2026-03-23',
      gitLogLines: [],
    });
    expect(out).toContain('## [1.0.0] - 2026-03-23');
    expect(out).toContain('(no git-log output — no prior tag)');
  });
});

const { verifyScaffoldsFilled, bumpManifests } = require('../../scripts/release.js');

describe('release.js Phase 2 continue', () => {
  test('verifyScaffoldsFilled throws if changelog still has TODO marker', () => {
    const fakeFs = {
      readFileSync: (p) => {
        if (p.endsWith('CHANGELOG.md')) return '## [1.1.1]\n<!-- TODO: fill in from git log below -->\n';
        if (p.endsWith('v1.1.1.md')) return '# v1.1.1\nHero text.\n';
        return '';
      },
    };
    expect(() => verifyScaffoldsFilled({ version: '1.1.1', fs: fakeFs, root: '/tmp/hc' }))
      .toThrow(/CHANGELOG.*placeholder/i);
  });

  test('verifyScaffoldsFilled throws if release notes still has TODO hero', () => {
    const fakeFs = {
      readFileSync: (p) => {
        if (p.endsWith('CHANGELOG.md')) return '## [1.1.1]\n### Fixed\n- real entry\n';
        if (p.endsWith('v1.1.1.md')) return '# v1.1.1\n<!-- TODO: hero paragraph -->\n';
        return '';
      },
    };
    expect(() => verifyScaffoldsFilled({ version: '1.1.1', fs: fakeFs, root: '/tmp/hc' }))
      .toThrow(/release notes.*placeholder/i);
  });

  test('verifyScaffoldsFilled passes when both files are clean', () => {
    const fakeFs = {
      readFileSync: (p) => {
        if (p.endsWith('CHANGELOG.md')) return '## [1.1.1]\n### Fixed\n- real\n';
        if (p.endsWith('v1.1.1.md')) return '# v1.1.1\nReal hero paragraph.\n';
        return '';
      },
    };
    expect(() => verifyScaffoldsFilled({ version: '1.1.1', fs: fakeFs, root: '/tmp/hc' })).not.toThrow();
  });

  test('bumpManifests writes new version to all three JSON files', () => {
    const written = {};
    const fakeFs = {
      readFileSync: () => JSON.stringify({ version: '1.1.0', otherField: 'keep' }, null, 2),
      writeFileSync: (p, content) => { written[p] = content; },
    };
    bumpManifests({ newVersion: '1.1.1', fs: fakeFs, root: '/tmp/hc' });
    const paths = Object.keys(written);
    expect(paths.length).toBe(3);
    for (const p of paths) {
      const parsed = JSON.parse(written[p]);
      expect(parsed.version).toBe('1.1.1');
      expect(parsed.otherField).toBe('keep');
    }
  });
});
