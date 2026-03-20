# GitHub Infrastructure — Design Spec

**Date:** 2026-03-20
**Status:** Approved
**Branch:** `maint/github-setup`

---

## Goal

Set up GitHub infrastructure for a professional public-facing Chrome extension: landing page and privacy policy for GitHub Pages, contributor guide, and issue template improvements.

---

## New Files

### `CONTRIBUTING.md` (root)
Minimal contributor guide (~20 lines):
- Prerequisites: Node.js 18+
- Build steps: `npm install` (triggers postinstall build), load `dist/` in Chrome
- Branch naming: `feat/`, `fix/`, `maint/` prefixes
- PR process: file an issue first, fork, branch, PR against main
- Link to issue templates

### `docs/index.html`
Landing page served by GitHub Pages at `ktulue.github.io/HypeControl`.
- Clean, professional, light/neutral design
- Sections: hero with tagline, key features (3-4 bullets), screenshot placeholder, install CTA (placeholder Chrome Web Store URL until live), footer with links
- Self-contained — inline CSS, no framework, no build step
- Must work as a static HTML page served by GitHub Pages

### `docs/privacy.html`
Privacy policy served at `ktulue.github.io/HypeControl/privacy.html`.
- What the extension does (brief)
- What data is stored: all local via `chrome.storage.local` and `chrome.storage.sync`
- What is NOT collected: no personal data, no analytics, no external transmission
- Permissions used and why:
  - `host_permissions` (`*://*.twitch.tv/*`) — content script injects friction overlays on Twitch pages
  - `storage` — saves user settings and spending data locally
- Contact: GitHub Issues link
- Effective date
- Self-contained HTML, same style as landing page for visual consistency

### `.github/ISSUE_TEMPLATE/config.yml`
Adds external links to the issue template chooser:
```yaml
blank_issues_enabled: false
contact_links:
  - name: "Ideas & Feature Discussions"
    url: https://github.com/Ktulue/HypeControl/discussions/new?category=ideas
    about: "Suggest ideas or discuss potential features"
```

## Modified Files

### `.github/ISSUE_TEMPLATE/bug_report.md`
Update version example from `v0.4.14` to `v1.0.0`.

---

## Manual Steps (post-merge, documented in PR description)

These cannot be done via code — they require the GitHub web UI:

1. **GitHub Pages:** Settings → Pages → Source: Deploy from branch `main`, folder `/docs` → Save
2. **Repo topics:** Settings → About (gear icon) → Add topics: `chrome-extension`, `twitch`, `spending-tracker`, `impulse-control`, `browser-extension`
3. **Social preview:** Settings → Social preview → Upload a 1280x640 image (can do later)

---

## What stays the same

- All source code
- Feature request template (already clean)
- LICENSE, CLAUDE.md, README.md (README rewrite is workstream 4)
- No version bump
