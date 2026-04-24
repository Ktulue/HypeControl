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
