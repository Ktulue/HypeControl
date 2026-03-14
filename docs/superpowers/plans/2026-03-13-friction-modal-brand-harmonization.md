# Friction Modal Brand Harmonization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the friction overlay modals (content script) visually cohesive with the popup and logs page — same font (Space Grotesk), same border radius/color tokens, flat header, aligned button sizing, no rogue monospace.

**Architecture:** All changes are in two files: `manifest.json` (expose font assets to content script context) and `src/content/styles.css` (font declarations + token/style fixes). No TypeScript logic changes. No new tests.

**Tech Stack:** Chrome MV3, TypeScript, webpack, CSS custom properties

**Spec:** `docs/superpowers/specs/2026-03-13-friction-modal-brand-harmonization-design.md`

---

## Pre-flight

Before starting, confirm you are on branch `feat/overlay-icon-issue-templates`:
```bash
git branch --show-current
```
Expected: `feat/overlay-icon-issue-templates`

Note: The popup header icon change (spec Section 6) is **already implemented** in the working tree — `popup.html` and `popup.css` are modified. Do NOT undo those changes.

---

## Chunk 1: Manifest + Font Loading

### Task 1: Extend `web_accessible_resources` with font files

**Files:**
- Modify: `manifest.json`

The existing `web_accessible_resources` array has one entry with `HC_icon_48px.png`. Add the four Space Grotesk woff2 filenames to that same entry's `resources` array. Do NOT create a second entry.

- [ ] **Step 1: Edit manifest.json**

Find the `web_accessible_resources` block (currently):
```json
"web_accessible_resources": [
  {
    "resources": ["assets/icons/ChromeWebStore/HC_icon_48px.png"],
    "matches": ["https://*.twitch.tv/*"]
  }
],
```

Replace with:
```json
"web_accessible_resources": [
  {
    "resources": [
      "assets/icons/ChromeWebStore/HC_icon_48px.png",
      "assets/fonts/SpaceGrotesk-Regular.woff2",
      "assets/fonts/SpaceGrotesk-Medium.woff2",
      "assets/fonts/SpaceGrotesk-SemiBold.woff2",
      "assets/fonts/SpaceGrotesk-Bold.woff2"
    ],
    "matches": ["https://*.twitch.tv/*"]
  }
],
```

- [ ] **Step 2: Verify font files exist in source**

```bash
ls assets/fonts/
```
Expected output includes all four: `SpaceGrotesk-Regular.woff2`, `SpaceGrotesk-Medium.woff2`, `SpaceGrotesk-SemiBold.woff2`, `SpaceGrotesk-Bold.woff2`

- [ ] **Step 3: Verify webpack copies fonts to dist**

```bash
ls dist/assets/fonts/
```
Expected: same four files. If the directory doesn't exist or files are missing, check `webpack.config.js` for a `CopyPlugin` entry covering `assets/fonts/`. The fonts must be in `dist/` at runtime or `web_accessible_resources` declarations will point to nothing.

---

### Task 2: Add `@font-face` declarations to `styles.css`

**Files:**
- Modify: `src/content/styles.css`

**Critical:** Content script CSS `url()` paths resolve against the **page origin** (twitch.tv), not the extension root. You MUST use the `chrome-extension://__MSG_@@extension_id__/` prefix. Chrome substitutes the real extension ID at injection time for CSS files declared in `content_scripts[].css`.

- [ ] **Step 1: Add @font-face blocks at the very top of styles.css** (before the `:root` block)

```css
@font-face {
  font-family: 'Space Grotesk';
  src: url('chrome-extension://__MSG_@@extension_id__/assets/fonts/SpaceGrotesk-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: 'Space Grotesk';
  src: url('chrome-extension://__MSG_@@extension_id__/assets/fonts/SpaceGrotesk-Medium.woff2') format('woff2');
  font-weight: 500;
  font-display: swap;
}
@font-face {
  font-family: 'Space Grotesk';
  src: url('chrome-extension://__MSG_@@extension_id__/assets/fonts/SpaceGrotesk-SemiBold.woff2') format('woff2');
  font-weight: 600;
  font-display: swap;
}
@font-face {
  font-family: 'Space Grotesk';
  src: url('chrome-extension://__MSG_@@extension_id__/assets/fonts/SpaceGrotesk-Bold.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
}
```

- [ ] **Step 2: Build and verify no errors**

```bash
npm run build
```
Expected: `webpack compiled successfully` — zero TypeScript errors, zero warnings.

- [ ] **Step 3: Commit**

```bash
git add manifest.json src/content/styles.css
git commit -m "feat: load Space Grotesk in content script via web_accessible_resources"
```

---

## Chunk 2: Token + Style Alignment

### Task 3: Align CSS tokens

**Files:**
- Modify: `src/content/styles.css` — `:root` block

- [ ] **Step 1: Update --hc-radius and --hc-border in :root**

Find in the `:root` block:
```css
--hc-radius: 8px;
```
Change to:
```css
--hc-radius: 6px;
```

Find:
```css
--hc-border: #3d3d42;
```
Change to:
```css
--hc-border: #2d2d35;
```

---

### Task 4: Flatten the modal header

**Files:**
- Modify: `src/content/styles.css` — `.hc-header`, `.hc-title`

- [ ] **Step 1: Update .hc-header**

Find:
```css
.hc-header {
  background: linear-gradient(135deg, var(--hc-primary) 0%, var(--hc-primary-dark) 100%);
```
Replace the `background` line with:
```css
  background: var(--hc-bg-card);
  border-bottom: 1px solid var(--hc-border);
```
Leave all other `.hc-header` properties (padding, display, flex, gap) unchanged.

- [ ] **Step 2: Update .hc-title**

Find the `.hc-title` rule. Remove these two properties:
```css
  text-transform: uppercase;
  letter-spacing: 1px;
```
Change `color: white` to:
```css
  color: var(--hc-text);
```
Change `font-size: 18px` to:
```css
  font-size: 15px;
```

---

### Task 5: Align button sizing

**Files:**
- Modify: `src/content/styles.css` — `.hc-btn`

- [ ] **Step 1: Update .hc-btn**

Find the `.hc-btn` base rule. Make these changes:
- `padding: 12px 20px` → `padding: 8px 14px`
- `font-size: 14px` → `font-size: 12px`
- Remove `text-transform: uppercase`
- Remove `letter-spacing: 0.5px`

Leave `font-weight`, `border-radius`, `cursor`, `transition`, and all other properties unchanged.

---

### Task 6: Fix type-to-confirm phrase font

**Files:**
- Modify: `src/content/styles.css` — `.hc-confirm-phrase`

- [ ] **Step 1: Update .hc-confirm-phrase**

Find the `.hc-confirm-phrase` rule. Make these changes:
- `font-family: 'Courier New', Courier, monospace` → `font-family: var(--hc-font)`
- Remove `letter-spacing: 0.5px`

Note: `.hc-confirm-input` (the actual text input below the phrase) uses `font-family: inherit` — leave it unchanged.

---

### Task 7: Build, version bump, commit

- [ ] **Step 1: Build**

```bash
npm run build
```
Expected: `webpack compiled successfully`

- [ ] **Step 2: Bump patch version**

In `manifest.json`: `"version": "0.4.16"` → `"0.4.17"`
In `package.json`: `"version": "0.4.16"` → `"0.4.17"`

- [ ] **Step 3: Build again with new version**

```bash
npm run build
```
Expected: `webpack compiled successfully`

- [ ] **Step 4: Commit everything**

```bash
git add manifest.json package.json package-lock.json src/content/styles.css
git commit -m "feat: harmonize friction modal brand — Space Grotesk, flat header, aligned tokens (v0.4.17)"
```

---

## Validation (manual — after reload in Chrome)

- [ ] Reload the extension in `chrome://extensions`
- [ ] Open a Twitch page and trigger a friction modal (use `window.HC.testOverlay()` in DevTools console if available)
- [ ] Verify Space Grotesk renders in the modal (not system sans-serif — check DevTools Computed tab, `font-family` on `.hc-modal`)
- [ ] Verify modal header is flat (no gradient), normal-case title, same dark background as the modal body
- [ ] Verify buttons are compact (matching popup size), no uppercase text
- [ ] Trigger the type-to-confirm step — verify the phrase display uses Space Grotesk, not Courier New
- [ ] Toggle Settings → Theme → Light — verify modal uses `#7c3aed` accent in light mode
