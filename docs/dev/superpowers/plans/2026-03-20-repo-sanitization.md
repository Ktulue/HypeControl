# Repo Sanitization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up the HypeControl repository for public release — move internal docs, delete dead files, trim gitignore, untrack dist/, and clean up the TODO.

**Architecture:** Pure file operations — git mv, git rm, file edits. No source code changes. No version bump. No build required.

**Tech Stack:** Git, Bash

**Spec:** `docs/superpowers/specs/2026-03-20-repo-sanitization-design.md`

**Important:** Do NOT bump versions. Do NOT modify source code. Do NOT run builds.

---

### Task 1: Create directory structure and move internal docs

**Files:**
- Move: `HC-Project-Document.md` → `docs/dev/HC-Project-Document.md`
- Move: `HypeControl-TODO.md` → `docs/dev/HypeControl-TODO.md`
- Move: `docs/previews-extension-settings-reference.md` → `docs/dev/previews-extension-settings-reference.md`
- Move: `docs/superpowers/` → `docs/dev/superpowers/`
- Rename: `changelog.md` → `CHANGELOG.md`

- [ ] **Step 1: Create docs/dev/ directory**

```bash
mkdir -p docs/dev
```

- [ ] **Step 2: Move internal docs to docs/dev/**

```bash
git mv HC-Project-Document.md docs/dev/HC-Project-Document.md
git mv HypeControl-TODO.md docs/dev/HypeControl-TODO.md
git mv docs/previews-extension-settings-reference.md docs/dev/previews-extension-settings-reference.md
git mv docs/superpowers docs/dev/superpowers
```

- [ ] **Step 3: Rename changelog.md to CHANGELOG.md**

```bash
git mv changelog.md CHANGELOG.md
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "maint: move internal docs to docs/dev/, rename changelog to CHANGELOG.md"
```

---

### Task 2: Delete dead files

**Files:**
- Delete: `SCOPE.md`
- Delete: `test-ext.js`

- [ ] **Step 1: Remove stale files**

```bash
git rm SCOPE.md
git rm test-ext.js
```

- [ ] **Step 2: Commit**

```bash
git commit -m "maint: remove stale SCOPE.md and dead test-ext.js"
```

---

### Task 3: Untrack dist/ and trim .gitignore

**Files:**
- Modify: `.gitignore`
- Untrack: `dist/` (remove from git index without deleting local files)

- [ ] **Step 1: Verify dist/ is not tracked (and untrack if needed)**

```bash
git ls-files dist/ | grep -q . && git rm -r --cached dist/ || echo "dist/ already untracked — skipping"
```

If `dist/` has tracked files, this removes them from the git index only — local files stay. If already untracked (likely), this is a safe no-op. The `.gitignore` entry ensures it stays untracked.

- [ ] **Step 2: Replace .gitignore with trimmed version**

Replace the entire `.gitignore` with only project-relevant entries:

```
# Build output
dist/

# Dependencies
node_modules/

# Test coverage
coverage/
*.lcov

# Environment variables
.env
.env.*
!.env.example

# Logs
*.log
npm-debug.log*

# OS / Editor
.DS_Store
Thumbs.db

# Claude Code artifacts
.claude/settings.local.json
.claude/skills/
.agents/
skills-lock.json
.superpowers/

# Playwright MCP cache
.playwright-mcp/

# Root-level scratch screenshots
/*.png
*.png~

# TypeScript cache
*.tsbuildinfo

# Optional caches
.npm
.eslintcache

# VS Code
.vscode-test

# Runtime
*.pid
*.seed
*.pid.lock
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "maint: untrack dist/, trim .gitignore to project-relevant entries"
```

---

### Task 4: Update CLAUDE.md path references

**Files:**
- Modify: `CLAUDE.md:36-37`

- [ ] **Step 1: Update Post-Work Updates section**

In `CLAUDE.md`, find lines 36-37:

```markdown
- **MTS-TODO.md** — Mark completed items with `[x]`, update phase statuses, set the `Updated` date and `Current Version` in the header, and update the footer timestamp.
- **MTS-Project-Document.md** — If a feature's status has changed (e.g., a previously unimplemented MVP part is now done), update the relevant section to reflect the current state.
```

Replace with:

```markdown
- **docs/dev/HypeControl-TODO.md** — Mark completed items with `[x]`, update phase statuses, set the `Updated` date and `Current Version` in the header, and update the footer timestamp.
- **docs/dev/HC-Project-Document.md** — If a feature's status has changed (e.g., a previously unimplemented MVP part is now done), update the relevant section to reflect the current state.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "maint: update CLAUDE.md path references to docs/dev/"
```

---

### Task 5: Update README.md installation instructions

**Files:**
- Modify: `README.md:32-38`

- [ ] **Step 1: Update the dev installation section**

In `README.md`, find lines 32-38:

```markdown
For development:
1. Clone this repository
2. Run `npm install` (this also triggers the build automatically via `postinstall`)
   - On Windows you can also just double-click `setup.bat`
3. Open Chrome → `chrome://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked" and select the project root folder (where `manifest.json` lives)
```

Replace with:

```markdown
For development:
1. Clone this repository
2. Run `npm install` (this also triggers the build automatically via `postinstall`)
   - On Windows you can also just double-click `setup.bat`
3. Open Chrome → `chrome://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked" and select the `dist/` folder
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "maint: update README to point Load unpacked at dist/"
```

---

### Task 6: Clean up HypeControl-TODO.md

**Files:**
- Modify: `docs/dev/HypeControl-TODO.md`

This is the most involved task. The TODO needs to be restructured from a detailed historical log into a clean forward-looking document. Read the full file first, then apply these changes:

- [ ] **Step 1: Update header**

Change:
```markdown
**Updated:** 2026-03-20
**Current Version:** 0.4.28
**Based On:** MTS-Project-Document.md vs. actual codebase audit (MTS was the original project codename)
```

To:
```markdown
**Updated:** 2026-03-20
**Current Version:** 0.4.28
**Based On:** HC-Project-Document.md vs. actual codebase audit (MTS was the original project codename)
```

- [ ] **Step 2: Fix MVP Part 4b — move deferred items**

In the MVP Part 4b section, the two unchecked items ("Peak spending hours" and "Top channels") are marked "deferred to Add-on 2" but Add-on 2 is complete without them. Change them from:

```markdown
- [ ] **Peak spending hours** — Hour-of-day bucketing (not implemented — deferred to Add-on 2)
- [ ] **Top channels** — Per-channel stats (not implemented — deferred to Add-on 2)
```

To:

```markdown
- [x] ~~**Peak spending hours**~~ — Deferred to future enhancement (not part of Add-on 2 final scope)
- [x] ~~**Top channels**~~ — Deferred to future enhancement (not part of Add-on 2 final scope)
```

- [ ] **Step 3: Fix MVP Part 6 header**

Change:
```markdown
### ⚠️ MVP Part 6 — Polish & Edge Cases (PARTIALLY DONE)
```

To:
```markdown
### ✅ MVP Part 6 — Polish & Edge Cases (COMPLETE)
```

Also update the Quick Summary table row for MVP Part 6 from `✅ Complete` — actually check: if the table already says Complete, just fix the section header.

- [ ] **Step 4: Reconcile Interactive Onboarding Tour section**

The Quick Summary table says "✅ Complete" but the detailed section (lines 190-203) has 5 unchecked items for a full Twitch-page overlay tour that was never built. What shipped was the popup wizard.

Replace the entire Interactive Onboarding Tour section (from `### Interactive Onboarding Tour` through the 5 unchecked items) with:

```markdown
### ✅ Interactive Onboarding Tour (COMPLETE — Popup Wizard)

**What was implemented:** First-run setup wizard in the popup with hourly rate, tax rate, friction level, and comparison item selection. Skip option with defaults summary. Replay button at bottom of popup.

**What was deferred (full Twitch-page tour):**
The original design called for a guided overlay on the Twitch page highlighting each interceptable element. This was descoped in favor of the popup wizard approach. If revisited, it would be a future enhancement.
```

- [ ] **Step 5: Update Current Roadmap section**

Replace the entire "CURRENT ROADMAP" section (from `## CURRENT ROADMAP` through the "Deferred to Future Enhancements" list) with:

```markdown
## CURRENT ROADMAP

### Next Up

1. **Chrome Web Store Launch** — Store listing, privacy policy, screenshots, version 1.0.0 release
2. **Firefox AMO Port** — Adapt extension for Firefox (manifest changes, `browser.*` API audit, AMO submission)

### Future Enhancements

- Add-on 6 — Export Data (CSV/JSON)
- Add-on 7 — Accountability Partner
- Add-on 8 — Discord Webhook Integration
- Add-on 9 — Weekly Email Summary
- Add-on 10 — Regret Scoring (24-Hour Check-in)
- Add-on 11 — Monthly Budget & Rollover System
- Add-on 12 — Reporting Dashboard + Google Sheets
- Peak spending hours (hour-of-day bucketing)
- Top channels (per-channel stats)
- Full Twitch-page onboarding tour (overlay-based walkthrough)
```

- [ ] **Step 6: Collapse completed version sections**

Replace the detailed checkbox lists for each completed version section with brief summaries. Each section starts at its `##` heading and ends just before the next `##` heading (or `---` separator). Read the file carefully to identify boundaries. Collapse these sections:

**SECURITY FIXES** — replace with:
```markdown
## SECURITY FIXES (v0.4.9, v0.4.21)

Stored XSS vulnerabilities in logs.ts and interceptor.ts resolved via DOM construction (textContent). All user-controlled and storage values now use safe rendering.
```

**ROUND 2 BUG FIXES** — replace with:
```markdown
## ROUND 2 BUG FIXES (v0.4.12)

7 issues fixed: duplicate thresholds toggle, popup scroll, nudge step capping, settings log, logs centering, emoji hint, whitelist copy.
```

**STAT CARD TOOLTIPS** — replace with:
```markdown
## STAT CARD TOOLTIPS (v0.4.13)

Added ⓘ hover tooltips to all 4 stat tiles.
```

**UI POLISH & REBRAND** — replace with:
```markdown
## UI POLISH & REBRAND (v0.4.14)

Space Grotesk typography, teal/green token system, ARIA label associations, light mode fixes.
```

**MAINTENANCE PASS** — replace with:
```markdown
## MAINTENANCE PASS (v0.4.24)

Toggle alignment, history summary centering, metric color parity, tour button relocation, escalation logic, weekly reset day, wizard default changed to Low.
```

**INPUT VALIDATION HARDENING** — replace with:
```markdown
## INPUT VALIDATION HARDENING (v0.4.25)

sanitizeSettings()/sanitizeTracker() gates on all storage paths, XSS fix in options comparison items, parsePrice() NaN/Infinity guard.
```

**BUG FIX & LOGS ENHANCEMENT** — replace with:
```markdown
## BUG FIX & LOGS ENHANCEMENT (v0.4.26)

Silent-proceed bypass paths now record to spending history. Logs page Copy All button added.
```

**SAVINGS CALENDAR** — replace with:
```markdown
## SAVINGS CALENDAR (v0.4.27)

Interactive calendar in popup Limits section with 3-tier day classification, 90 motivational messages, keyboard navigation, 90-day rolling window.
```

**TRACKER RESET FIX** — replace with:
```markdown
## TRACKER RESET FIX & SESSION REMOVAL (v0.4.28)

Shared spendingTracker module, daily/weekly/monthly reset fix for popup, session total removed.
```

- [ ] **Step 7: Update the footer timestamp**

Replace the last line with:
```markdown
_Last updated 2026-03-20 against the v0.4.28 codebase. Repository cleaned up for Chrome Web Store launch preparation._
```

- [ ] **Step 8: Remove the duplicate `---` separator**

There are two consecutive `---` separators around line 260-262 (between the CURRENT ROADMAP and FIREFOX AMO PORT sections). Remove the duplicate.

- [ ] **Step 9: Commit**

```bash
git add docs/dev/HypeControl-TODO.md
git commit -m "maint: clean up TODO — collapse completed sections, reconcile stale items, update roadmap"
```
