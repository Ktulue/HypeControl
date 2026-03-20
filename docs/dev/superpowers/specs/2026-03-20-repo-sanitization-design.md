# Repo Sanitization — Design Spec

**Date:** 2026-03-20
**Status:** Approved
**Branch:** `maint/repo-cleanup`

---

## Goal

Clean up the HypeControl repository for public release: move internal docs out of root, remove dead files, trim gitignore, untrack `dist/`, and clean up the TODO into a forward-looking document.

---

## File Moves

| From | To |
|------|-----|
| `HC-Project-Document.md` | `docs/dev/HC-Project-Document.md` |
| `HypeControl-TODO.md` | `docs/dev/HypeControl-TODO.md` |
| `docs/previews-extension-settings-reference.md` | `docs/dev/previews-extension-settings-reference.md` |
| `docs/superpowers/` (entire folder) | `docs/dev/superpowers/` |
| `changelog.md` | `CHANGELOG.md` (rename at root) |

## File Deletions

| File | Reason |
|------|--------|
| `SCOPE.md` | Stale — all items captured and marked done in TODO |
| `test-ext.js` | Dead Playwright e2e tests from v0.4.5, 23 versions behind current UI |

## File Modifications

### `.gitignore`
- Trim from ~160 lines to only project-relevant entries
- Keep: `node_modules/`, `dist/` (as its own explicit entry — currently buried inside the Nuxt boilerplate block), `coverage/`, `.env*`, `*.log`, Claude Code artifacts (`.claude/settings.local.json`, `.claude/skills/`, `.agents/`, `skills-lock.json`, `.superpowers/`), `.playwright-mcp/`, `/*.png`, `*.png~`, `.vscode-test`
- Remove: all Gatsby/Nuxt/Vue/Svelte/Vite/Firebase/DynamoDB/Parcel/Bower/Yarn v3/etc boilerplate
- Important: the `dist` entry currently lives on line 104 inside the Nuxt comment block. When trimming, ensure `dist/` is preserved as a standalone entry near the top of the file.

### `dist/` — Untrack from git
- Run `git rm -r --cached dist/` to untrack without deleting local files
- The `dist/` entry already in `.gitignore` will then take effect
- Contributors build locally via `npm install` (which triggers postinstall build)

### `docs/dev/HypeControl-TODO.md` — Clean up
Reconcile stale items and restructure:

1. **MVP Part 4b** — "Peak spending hours" and "Top channels" are unchecked but marked "deferred to Add-on 2". Add-on 2 is complete without them. Move these to the Deferred section explicitly.

2. **MVP Part 6** — Header says "⚠️ PARTIALLY DONE" but all items are checked. Update header to "✅ Complete".

3. **Interactive Onboarding Tour** (lines 190-203) — The Quick Summary table says "✅ Complete" but the section has 5 unchecked items describing a full Twitch-page overlay tour. What was implemented was the popup wizard, not the full page tour. Reconcile: mark the section as "✅ Complete (Popup Wizard)" and move the unimplemented full-page tour items to Deferred.

4. **Current Roadmap > Next Up** (lines 241-246) — Stale. Items 1-3 are done. Update to reflect current priorities:
   - Next: Firefox AMO Port
   - Deferred: Add-ons 6-12

5. **Collapse completed sections** — Each completed version section (v0.4.9, v0.4.12, v0.4.14, etc.) currently has full line-by-line detail. Collapse to 1-2 line summaries per version, preserving what was done but not the granular checkbox lists.

6. **Update header** with current version and date.

### `CLAUDE.md`
Update path references in the "Post-Work Updates" section:
- `MTS-TODO.md` → `docs/dev/HypeControl-TODO.md`
- `MTS-Project-Document.md` → `docs/dev/HC-Project-Document.md`

### `README.md`
- Update "Load unpacked" instruction: after `npm install`, point to the `dist/` folder (not project root) since that's where the built extension lives
- Minor wording only — full README rewrite is workstream 4

---

## Resulting Root Structure

```
HypeControl/
├── README.md
├── CHANGELOG.md          (renamed from changelog.md)
├── LICENSE
├── CLAUDE.md
├── setup.bat
├── manifest.json
├── package.json
├── package-lock.json
├── webpack.config.js
├── tsconfig.json
├── tsconfig.test.json
├── jest.config.js
├── .gitignore            (trimmed)
├── .github/
│   └── ISSUE_TEMPLATE/
├── assets/
├── src/
├── tests/
└── docs/
    └── dev/
        ├── HC-Project-Document.md
        ├── HypeControl-TODO.md
        ├── previews-extension-settings-reference.md
        └── superpowers/
            ├── plans/   (16 files)
            └── specs/   (18+ files)
```

The `docs/` root is intentionally left clean for workstreams 3-4 (privacy policy, screenshots, GitHub Pages).

---

## What stays the same

- All source code (`src/`, `tests/`)
- All asset files (`assets/`)
- Build configuration (`webpack.config.js`, `tsconfig.json`)
- GitHub issue templates (`.github/ISSUE_TEMPLATE/`)
- `setup.bat`
- No version bump in this workstream
