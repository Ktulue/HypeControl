# Scope HC to www.twitch.tv Only — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop HC from activating on non-spending Twitch subdomains (docs, dashboard, clips, embed, etc.)

**Architecture:** Replace the wildcard `*.twitch.tv` match pattern with `www.twitch.tv` in all manifest match fields. Pure config change — no source code modifications.

**Tech Stack:** Chrome Extension Manifest V3 JSON

**Spec:** `docs/superpowers/specs/2026-04-15-scope-twitch-subdomain-design.md`

**Branch:** `fix/scope-twitch-subdomain-40`

**IMPORTANT:** Do NOT bump versions. Versioning is handled separately after implementation.

---

### Task 1: Update Chrome manifest

**Files:**
- Modify: `manifest.json:17` (`host_permissions`)
- Modify: `manifest.json:24` (`content_scripts[0].matches`)
- Modify: `manifest.json:39` (`web_accessible_resources[0].matches`)

- [ ] **Step 1: Replace all three wildcard patterns in manifest.json**

Replace every instance of `https://*.twitch.tv/*` with `https://www.twitch.tv/*` in `manifest.json`. There are exactly 3 occurrences:

```json
// Line 17 — host_permissions
"host_permissions": [
    "https://www.twitch.tv/*"
],

// Line 24 — content_scripts
"matches": ["https://www.twitch.tv/*"],

// Line 39 — web_accessible_resources
"matches": ["https://www.twitch.tv/*"]
```

- [ ] **Step 2: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('valid')"`
Expected: `valid`

- [ ] **Step 3: Verify exactly 3 replacements, 0 wildcards remain**

Run: `grep -c "www.twitch.tv" manifest.json && grep -c "\\*.twitch.tv" manifest.json || echo "0 wildcards remain"`
Expected: `3` then `0 wildcards remain`

- [ ] **Step 4: Commit**

```bash
git add manifest.json
git commit -m "fix: scope Chrome manifest to www.twitch.tv only (#40)"
```

---

### Task 2: Update Firefox manifest

**Files:**
- Modify: `manifest.firefox.json:25` (`host_permissions`)
- Modify: `manifest.firefox.json:32` (`content_scripts[0].matches`)
- Modify: `manifest.firefox.json:47` (`web_accessible_resources[0].matches`)

- [ ] **Step 1: Replace all three wildcard patterns in manifest.firefox.json**

Replace every instance of `https://*.twitch.tv/*` with `https://www.twitch.tv/*` in `manifest.firefox.json`. There are exactly 3 occurrences:

```json
// Line 25 — host_permissions
"host_permissions": [
    "https://www.twitch.tv/*"
],

// Line 32 — content_scripts
"matches": ["https://www.twitch.tv/*"],

// Line 47 — web_accessible_resources
"matches": ["https://www.twitch.tv/*"]
```

- [ ] **Step 2: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('manifest.firefox.json','utf8')); console.log('valid')"`
Expected: `valid`

- [ ] **Step 3: Verify exactly 3 replacements, 0 wildcards remain**

Run: `grep -c "www.twitch.tv" manifest.firefox.json && grep -c "\\*.twitch.tv" manifest.firefox.json || echo "0 wildcards remain"`
Expected: `3` then `0 wildcards remain`

- [ ] **Step 4: Commit**

```bash
git add manifest.firefox.json
git commit -m "fix: scope Firefox manifest to www.twitch.tv only (#40)"
```

---

### Task 3: Version bump and build

**Files:**
- Modify: `manifest.json:4` (`version`)
- Modify: `package.json` (`version`)

- [ ] **Step 1: Bump patch version in both manifest.json and package.json**

Bump from `1.0.7` to `1.0.8` in `manifest.json` line 4 and `package.json`.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Clean build with no errors. If build fails, stop and tell the user to run it manually.

- [ ] **Step 3: Commit version bump**

```bash
git add manifest.json package.json
git commit -m "chore: bump version to 1.0.8"
```

---

### Task 4: Update project docs

**Files:**
- Modify: `docs/dev/HypeControl-TODO.md`
- Modify: `docs/dev/HC-Project-Document.md` (if relevant section exists)

- [ ] **Step 1: Add entry to HypeControl-TODO.md**

Add a completed section after the NAV LOCK entry:

```markdown
## SUBDOMAIN SCOPE FIX (v1.0.8)

Manifest match patterns narrowed from `*.twitch.tv` to `www.twitch.tv` in both Chrome and Firefox manifests. HC no longer activates on docs.twitch.tv, dashboard.twitch.tv, or other non-spending subdomains. (#40)
```

Update the header: `Current Version: 1.0.8`, `Updated: 2026-04-15`.
Update the footer timestamp.

- [ ] **Step 2: Commit doc updates**

```bash
git add docs/dev/HypeControl-TODO.md docs/dev/HC-Project-Document.md
git commit -m "docs: document subdomain scope fix (#40)"
```

---

### Task 5: Push and open PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin fix/scope-twitch-subdomain-40
```

- [ ] **Step 2: Open PR referencing issue #40**

Open PR with title `fix: scope HC to www.twitch.tv only (#40)` and stop. Do not merge.
