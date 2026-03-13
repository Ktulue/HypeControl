# UI Polish & Rebrand Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address all 16 issues from the 2026-03-13 Impeccable audit — security fix, full visual rebrand to teal/Space Grotesk, accessibility hardening, and structural cleanup — producing a shippable PR.

**Architecture:** File-by-file pass in a defined sequence. Each file is touched exactly once. TypeScript changes land first (security + performance), then CSS rebrand, then HTML structural fixes, then the new logs.css file. Build verification and visual validation close the branch.

**Tech Stack:** TypeScript 5.4, webpack 5 (css-loader + MiniCssExtractPlugin + CopyPlugin), Chrome Extension MV3, plain CSS with custom properties.

**Spec:** `docs/superpowers/specs/2026-03-13-ui-polish-rebrand-design.md`

---

## Chunk 1: Setup & TypeScript

---

### Task 1: Create Branch & Add Font Assets

**Files:**
- Create: `assets/fonts/SpaceGrotesk-Regular.woff2`
- Create: `assets/fonts/SpaceGrotesk-Medium.woff2`
- Create: `assets/fonts/SpaceGrotesk-SemiBold.woff2`
- Create: `assets/fonts/SpaceGrotesk-Bold.woff2`
- Verify: `webpack.config.js` (read-only check — CopyPlugin already covers `assets/`)

**Context:** The webpack config already has `{ from: 'assets', to: 'assets', noErrorOnMissing: true }` in CopyPlugin. No webpack changes are needed — fonts placed in `assets/fonts/` will automatically copy to `dist/assets/fonts/` on build.

- [ ] **Step 1: Create the feature branch**

```bash
git checkout main
git checkout -b feat/ui-polish-rebrand
```

- [ ] **Step 2: Download Space Grotesk woff2 files**

Download the static (non-CDN) woff2 files from Google Fonts. The direct download URL for Space Grotesk is:
`https://fonts.google.com/specimen/Space+Grotesk` → click "Download family"

Extract the zip. From the downloaded files, locate the `static/` folder and copy these four files into `assets/fonts/`:

```
SpaceGrotesk-Regular.woff2   (weight 400)
SpaceGrotesk-Medium.woff2    (weight 500)
SpaceGrotesk-SemiBold.woff2  (weight 600)
SpaceGrotesk-Bold.woff2      (weight 700)
```

If the downloaded files are `.ttf` only, convert to `.woff2` using either:
- An online converter (e.g. cloudconvert.com) — simplest option
- The `ttf2woff2` npm package: `npx ttf2woff2 < SpaceGrotesk-Regular.ttf > SpaceGrotesk-Regular.woff2`

Do NOT use `npx woff2 compress` — the `woff2` npm package does not expose a working CLI on Windows.

- [ ] **Step 3: Verify the assets directory**

```bash
ls assets/fonts/
```

Expected output:
```
SpaceGrotesk-Bold.woff2
SpaceGrotesk-Medium.woff2
SpaceGrotesk-Regular.woff2
SpaceGrotesk-SemiBold.woff2
```

- [ ] **Step 4: Commit fonts**

```bash
git add assets/fonts/
git commit -m "feat: add Space Grotesk woff2 font assets (400/500/600/700)"
```

---

### Task 2: Fix interceptor.ts — Security (C-01) + Performance (H-01)

**Files:**
- Modify: `src/content/interceptor.ts`

**Context:** Two independent fixes in one file:
1. **C-01** — The reason-selection modal builds `reasonButtonsHTML` via template literals and injects it into `overlay.innerHTML`. The `${reason}` value comes from `chrome.storage` and must not be interpolated unsanitized. Fix: remove `reasonButtonsHTML` from the innerHTML template and instead build/append reason buttons via DOM construction after setting the modal shell.
2. **H-01** — Two progress bar update loops (~lines 734 and 942) set `progressEl.style.width = \`${pct}%\``. Animating `width` triggers layout recalculation ~10×/sec. Fix: use `transform: scaleX()` instead (CSS `transform-origin: left` is set in Task 4 — `styles.css`).

- [ ] **Step 1: Run existing tests to establish baseline**

```bash
npm test
```

Note the pass/fail count. If tests are failing, record which ones — only stop if `interceptor`-related tests are failing. Pre-existing failures unrelated to this file do not block this task.

- [ ] **Step 2: Find the reason button section in interceptor.ts**

Search for `reasonButtonsHTML` in `src/content/interceptor.ts`. Locate:
- Where `reasonButtonsHTML` is built up in a loop (the `+=` template literal with `data-reason`)
- Where it is injected into the `overlay.innerHTML` template
- The container element in the overlay that holds the buttons (look for a div/section that contains the reason buttons)

- [ ] **Step 3: Fix C-01 — replace reason button injection**

In the `overlay.innerHTML` template for the reason selection modal: replace the `${reasonButtonsHTML}` placeholder with an empty container div. Keep the existing class `hc-reason-list` (CSS rules reference this class — do not rename it), and add an id for the querySelector:

```html
<div class="hc-reason-list" id="hc-reason-container"></div>
```

Remove the `reasonButtonsHTML` variable and its loop entirely. After `overlay.innerHTML = \`...\``, add DOM construction using the correct source array name `PURCHASE_REASONS`:

```typescript
const container = overlay.querySelector('#hc-reason-container');
if (container) {
  PURCHASE_REASONS.forEach(reason => {
    const btn = document.createElement('button');
    btn.className = 'hc-reason-btn';
    btn.setAttribute('data-reason', reason);
    btn.textContent = reason;
    container.appendChild(btn);
  });
}
```

- [ ] **Step 4: Fix H-01 — replace progress bar width assignments**

Search for `progressEl.style.width` in `interceptor.ts`. There are two occurrences (cooldown timer and delay timer loops). Replace each with:

```typescript
// BEFORE
progressEl.style.width = `${pct}%`;

// AFTER
progressEl.style.transform = `scaleX(${pct / 100})`;
```

Do not touch the CSS here — `transform-origin: left` is added to `styles.css` in Task 4.

- [ ] **Step 5: Run tests to verify no regression**

```bash
npm test
```

Expected: same count passes as Step 1. If any test fails, fix before continuing.

- [ ] **Step 6: Commit**

```bash
git add src/content/interceptor.ts
git commit -m "fix: replace reason innerHTML with DOM construction (XSS), use scaleX for progress bars"
```

---

## Chunk 2: CSS Rebrand

---

### Task 3: Rebuild popup.css — Font, Rebrand Tokens, A11y, Cleanup

**Files:**
- Modify: `src/popup/popup.css`

**Context:** `popup.css` is the main stylesheet for the extension popup. It is processed by webpack (css-loader + MiniCssExtractPlugin) and emitted to `dist/popup.css`. Font `url()` paths must be relative to `dist/popup.css` — so `assets/fonts/SpaceGrotesk-Regular.woff2` resolves to `dist/assets/fonts/SpaceGrotesk-Regular.woff2` at runtime. The existing CSS variable system is correct; we are extending it.

- [ ] **Step 1: Add @font-face declarations at the top of popup.css**

Insert before the `:root` block:

```css
@font-face {
  font-family: 'Space Grotesk';
  src: url('assets/fonts/SpaceGrotesk-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: 'Space Grotesk';
  src: url('assets/fonts/SpaceGrotesk-Medium.woff2') format('woff2');
  font-weight: 500;
  font-display: swap;
}
@font-face {
  font-family: 'Space Grotesk';
  src: url('assets/fonts/SpaceGrotesk-SemiBold.woff2') format('woff2');
  font-weight: 600;
  font-display: swap;
}
@font-face {
  font-family: 'Space Grotesk';
  src: url('assets/fonts/SpaceGrotesk-Bold.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
}
```

- [ ] **Step 2: Update :root token values**

In the `:root` block, make these changes:

Make these changes inside the `:root` block:

- Replace `--font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` with `--font: 'Space Grotesk', sans-serif`
- Replace `--accent: #9146ff` with `--accent: #06B6D4`
- Replace `--accent-hover: #7c3dd1` with `--accent-hover: #0891B2`
- Replace `--success: #00c896` with `--success: #22C55E`
- After `--success`, add these new tokens:

```css
--accent-rgb: 6, 182, 212;
--danger-rgb: 233, 25, 22;
--success-rgb: 34, 197, 94;
```

- [ ] **Step 3: Fix the hardcoded rgba on .nav-label.active**

Find the `.nav-label.active` rule (around line 106). It contains a hardcoded `rgba(145, 70, 255, 0.1)`. Replace with:

```css
background: rgba(var(--accent-rgb), 0.1);
```

- [ ] **Step 4: Update [data-theme="light"] block**

In the `[data-theme="light"]` override block, update the accent and success values and add their hover variants:

```css
[data-theme="light"] {
  /* existing bg/text/border overrides stay as-is */

  /* CHANGE */
  --accent: #0891B2;
  --accent-hover: #0E7490;
  --success: #16A34A;
}
```

- [ ] **Step 5: Fix input and select focus styles**

`popup.css` has `.hc-input:focus` and `.hc-select:focus` as two separate rules. Delete both of them entirely. In their place, add a single combined rule:

```css
.hc-input:focus,
.hc-select:focus {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-color: var(--accent);
}
```

Keeping the old rules alongside this new one would cause conflicting `outline` declarations.

- [ ] **Step 6: Bump touch target padding**

Each button class has its own rule and its own current padding value — update them individually:

```css
/* .seg-btn: currently padding: 4px 6px → change to: */
.seg-btn {
  padding: 8px 10px;
}

/* .btn-primary: currently padding: 5px 12px → change to: */
.btn-primary {
  padding: 8px 14px;
}

/* .btn-secondary: currently padding: 5px 10px → change to: */
.btn-secondary {
  padding: 8px 14px;
}

/* .btn-danger: currently padding: 5px 10px → change to: */
.btn-danger {
  padding: 8px 14px;
}
```

Update only the `padding` declaration in each rule; leave all other properties unchanged.

- [ ] **Step 7: Remove redundant cursor on footer links**

Find the `.footer-link` rule. Remove the `cursor: pointer` declaration. Anchor elements already have pointer cursor natively.

- [ ] **Step 8: Build to verify no CSS errors**

```bash
npm run build
```

Expected: zero errors, zero warnings. If build fails, fix before continuing.

- [ ] **Step 9: Commit**

```bash
git add src/popup/popup.css
git commit -m "feat: rebrand popup.css — Space Grotesk, teal/green tokens, focus rings, touch targets"
```

---

### Task 4: Sweep styles.css — Token Unification, Rebrand, Performance

**Files:**
- Modify: `src/content/styles.css`

**Context:** `styles.css` is the content script stylesheet (injected into Twitch pages). It has its own variable namespace (`--hc-primary` etc.) which is separate from `popup.css` (`--accent` etc.). Both are being rebranded to the same values but kept in their respective files. This file has ~30 hardcoded color values that need to be replaced with variable references.

- [ ] **Step 1: Update :root token values in styles.css**

In the `:root` block:

```css
/* CHANGE primary to teal */
--hc-primary: #06B6D4;
--hc-primary-dark: #0891B2;

/* CHANGE success to green */
--hc-success: #22C55E;

/* ADD new tokens after existing ones */
--hc-font: 'Space Grotesk', sans-serif;
--hc-primary-rgb: 6, 182, 212;
--hc-danger-rgb: 233, 25, 22;
--hc-success-rgb: 34, 197, 94;
--hc-warning: #F97316;
--hc-primary-light: rgba(6, 182, 212, 0.12);
```

- [ ] **Step 2: Update [data-theme="light"] block in styles.css**

In the light mode override block:

```css
[data-theme="light"] {
  /* ADD/CHANGE */
  --hc-primary: #0891B2;
  --hc-primary-dark: #0E7490;
  --hc-success: #16A34A;
  --hc-warning: #EA580C;
  --hc-primary-light: rgba(8, 145, 178, 0.12);
}
```

Also replace the two hardcoded light-mode values in this block:
- `#6b2fd6` (whitelist note tint) → `var(--hc-primary-light)`
- Leave `#c47600` amber for price note unchanged (it's semantic, not brand)

- [ ] **Step 3: Replace hardcoded color values — primary/purple instances**

These are the `#9146ff` / `#9147ff` (typo variant) instances. There are approximately 6-8 of these across lines 220, 222, 461, 486, 494, 533, 543. Replace each with the appropriate variable:

- Solid color uses: `var(--hc-primary)`
- Alpha tint uses like `rgba(145, 70, 255, 0.1)`: replace with `rgba(var(--hc-primary-rgb), 0.1)`
- Alpha tint uses like `rgba(145, 70, 255, 0.2)`: replace with `rgba(var(--hc-primary-rgb), 0.2)`
- Alpha tint uses like `rgba(145, 71, 255, ...)` (typo): same replacement

- [ ] **Step 4: Replace hardcoded color values — danger/red instances**

Instances at lines ~232, 233, 234, 404, 442. Replace:
- `#eb0400` / `#e91916` solid → `var(--hc-danger)`
- `rgba(235, 4, 0, 0.15)` → `rgba(var(--hc-danger-rgb), 0.15)`
- `rgba(235, 4, 0, 0.3)` → `rgba(var(--hc-danger-rgb), 0.3)`
- `#e91916` in toast background → `var(--hc-danger)`

- [ ] **Step 5: Replace hardcoded color values — success/green instances**

Instances at lines ~308, 423. Replace:
- `#00a344` (button hover) → `var(--hc-success)`
- `#00c853` in toast background → `var(--hc-success)`

- [ ] **Step 6: Replace hardcoded color values — warning/orange instances**

Instances at lines ~142, 226, 227, 228, 473. Replace:
- `#ffa500` solid → `var(--hc-warning)`
- `rgba(255, 165, 0, 0.15)` → `rgba(var(--hc-warning-rgb), 0.15)` — add `--hc-warning-rgb: 249, 115, 22` to `:root`
- `rgba(255, 165, 0, 0.3)` → `rgba(var(--hc-warning-rgb), 0.3)`
- `#ff8c00` grace badge → `var(--hc-warning)`

Note: add `--hc-warning-rgb: 249, 115, 22` to the `:root` block (missed in Step 1 — add it now).

- [ ] **Step 7: Replace remaining hardcoded light-mode values**

Lines ~37, 41 (light mode overrides already partially handled in Step 2). Verify no other hardcoded colors remain in the file by searching for `#` followed by 3 or 6 hex digits. Any remaining should either be in the variable definitions themselves (expected) or flagged for replacement. The progress bar background at line ~486 (`#2a2a2e`) can become `var(--hc-bg-card)` if that token exists, or add `--hc-progress-bg: #2a2a2e` to `:root`.

- [ ] **Step 8: Fix transition: all on .hc-btn**

Find the `.hc-btn` rule. Replace:

```css
/* BEFORE */
transition: all 0.2s ease;

/* AFTER */
transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
```

- [ ] **Step 9: Fix progress bar CSS for transform-based animation**

Find the `.hc-progress-bar` rule. It currently has `width: 0%` as an initial state. When using `scaleX()`, the element must have `width: 100%` as its base — otherwise `scaleX(1)` scales a zero-width element (invisible at all values). Make all three changes:

```css
/* BEFORE */
width: 0%;
transition: width 0.1s linear;

/* AFTER */
width: 100%;
transform: scaleX(0);
transform-origin: left;
transition: transform 0.1s linear;
```

The JS in `interceptor.ts` (already fixed in Task 2) sets `scaleX(pct / 100)`, so `scaleX(0)` = empty bar and `scaleX(1)` = full bar.

- [ ] **Step 10: Update toast font-family**

Find the 4 toast element rules (lines ~411, 430, 449, 481). In each one, replace:

```css
/* BEFORE */
font-family: sans-serif;

/* AFTER */
font-family: var(--hc-font);
```

- [ ] **Step 11: Build to verify no CSS errors**

```bash
npm run build
```

Expected: zero errors, zero warnings. If build fails, fix before continuing.

- [ ] **Step 12: Commit**

```bash
git add src/content/styles.css
git commit -m "feat: rebrand styles.css — teal/green tokens, sweep hardcoded colors, fix transition and progress bar"
```

---

## Chunk 3: HTML & Structural

---

### Task 5: Fix popup.html — Label Associations

**Files:**
- Modify: `src/popup/popup.html`

**Context:** 7 `<label class="hc-label">` elements have no `for` attribute or grouping structure, making them invisible to screen readers. Two segmented controls get `<fieldset>`/`<legend>` wrappers. Five toggle labels get `for` attributes pointing to the checkbox id. All `id` values below are verified against the current source.

- [ ] **Step 1: Fix "Intensity" label in Stats section (line ~50)**

The Stats section has:
```html
<label class="hc-label">Intensity</label>
<div class="segmented" id="stats-intensity" ...>
```

Wrap the label AND the segmented div in a `<fieldset>`:
```html
<fieldset class="hc-fieldset">
  <legend class="hc-label">Intensity</legend>
  <div class="segmented" id="stats-intensity" ...>
    ...buttons...
  </div>
</fieldset>
```

Remove the original `<label class="hc-label">Intensity</label>`. The `.hc-row` div wrapping this content stays in place around the fieldset.

- [ ] **Step 2: Fix "Intensity" label in Friction section (line ~72)**

Same pattern as Step 1, but for the Friction section:
```html
<fieldset class="hc-fieldset">
  <legend class="hc-label">Intensity</legend>
  <div class="segmented" id="friction-intensity" ...>
    ...buttons...
  </div>
</fieldset>
```

- [ ] **Step 3: Fix "Delay timer" label (line ~81)**

Find `<label class="hc-label">Delay timer</label>`. Add `for="delay-enabled"`:
```html
<label class="hc-label" for="delay-enabled">Delay timer</label>
```

- [ ] **Step 4: Fix "Thresholds" label (line ~94)**

Find `<label class="hc-label">Thresholds</label>`. Add `for="friction-thresholds-enabled"`:
```html
<label class="hc-label" for="friction-thresholds-enabled">Thresholds</label>
```

The `<label class="toggle-wrap">` wrapping the checkbox remains unchanged — two labels for one input is valid HTML.

- [ ] **Step 5: Fix "Daily cap" label (line ~156)**

Find `<label class="hc-label">Daily cap</label>`. Add `for="daily-cap-enabled"`:
```html
<label class="hc-label" for="daily-cap-enabled">Daily cap</label>
```

- [ ] **Step 6: Fix "Spending cooldown" label (line ~164)**

Find `<label class="hc-label">Spending cooldown</label>`. Add `for="cooldown-enabled"`:
```html
<label class="hc-label" for="cooldown-enabled">Spending cooldown</label>
```

- [ ] **Step 7: Fix "Streaming mode" label (line ~199)**

Find `<label class="hc-label">Streaming mode</label>`. Add `for="streaming-mode-enabled"`:
```html
<label class="hc-label" for="streaming-mode-enabled">Streaming mode</label>
```

- [ ] **Step 8: Add minimal fieldset CSS to popup.css**

The `<fieldset>` element has browser-default styling (border, padding, min-width) that will break the popup layout. Add reset styles to `popup.css`:

```css
.hc-fieldset {
  border: none;
  padding: 0;
  margin: 0;
  min-width: 0;
  display: contents; /* preserves the .hc-row flex layout */
}
.hc-fieldset .hc-label,
.hc-fieldset legend {
  /* legend does not inherit font by default */
  font: inherit;
  color: inherit;
}
```

- [ ] **Step 9: Build to verify**

```bash
npm run build
```

Expected: zero errors. If the fieldset styling breaks the popup layout visually, adjust the `.hc-fieldset` CSS (do not change the HTML structure).

- [ ] **Step 10: Commit**

```bash
git add src/popup/popup.html src/popup/popup.css
git commit -m "fix: add label associations and fieldsets for segmented controls (a11y)"
```

---

### Task 6: Update logs.html — ARIA Tab Pattern + Style Extraction

**Files:**
- Modify: `src/logs/logs.html`

**Context:** The embedded `<style>` block is being extracted to `logs.css` (Task 8). The tab controls need a full ARIA tab pattern. The `data-tab` attributes on buttons must be retained — `logs.ts` reads them.

- [ ] **Step 1: Remove the embedded style block**

Delete the entire `<style>...</style>` block from `logs.html`. This will leave the page unstyled until `logs.css` is linked (next step).

- [ ] **Step 2: Add link to logs.css and Space Grotesk**

In `<head>`, after `<meta charset>`, add:
```html
<link rel="stylesheet" href="logs.css" />
```

Note: No separate font link tag needed — `logs.css` will contain its own `@font-face` declarations.

- [ ] **Step 3: Implement ARIA tab pattern and add panel role**

`logs.ts` writes all log output to a single `id="log-container"` element. Both tabs rewrite this same container — there is only ONE panel. Both tab buttons must point `aria-controls` to `log-container`.

Find the tab button area and replace it, and update the log container element, in one pass:

```html
<div role="tablist" aria-label="Log type">
  <button role="tab" id="tab-ext" data-tab="extension"
          aria-selected="true" aria-controls="log-container"
          class="tab-btn active">Extension Log</button>
  <button role="tab" id="tab-settings" data-tab="settings"
          aria-selected="false" aria-controls="log-container"
          class="tab-btn">Settings Log</button>
</div>
```

Update the log container div (keep `id="log-container"` exactly — `logs.ts` depends on it):

```html
<div role="tabpanel"
     id="log-container"
     aria-labelledby="tab-ext"
     aria-live="polite">
  <!-- log entries rendered here by logs.ts -->
</div>
```

Note: `data-tab="extension"` and `data-tab="settings"` are retained — `logs.ts` reads these. Do NOT add a second hidden panel — content is rewritten by `loadAndRender()`, not toggled.

- [ ] **Step 5: Commit**

```bash
git add src/logs/logs.html
git commit -m "feat: add ARIA tab pattern and extract embedded styles from logs.html"
```

---

### Task 7: Update logs.ts — ARIA Tab State Management

**Files:**
- Modify: `src/logs/logs.ts`

**Context:** The current `setupTabs()` toggles `.active` class and sets `activeTab`. It must also toggle `aria-selected` on tab buttons and `hidden` on tab panels. The `data-tab` values (`'extension'` / `'settings'`) and `loadAndRender()` call are unchanged.

- [ ] **Step 1: Update setupTabs() in logs.ts**

Replace the existing `setupTabs()` function with:

```typescript
function setupTabs(): void {
  const tabs = document.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  const panel = document.getElementById('log-container');

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active class (existing behaviour)
      tabs.forEach(t => t.classList.remove('active'));
      btn.classList.add('active');

      // Update ARIA selected state
      tabs.forEach(t => t.setAttribute('aria-selected', 'false'));
      btn.setAttribute('aria-selected', 'true');

      // Update panel's aria-labelledby to reflect the active tab
      // (both tabs control the same panel — no hidden toggling needed)
      if (panel) {
        panel.setAttribute('aria-labelledby', btn.id);
      }

      // Update activeTab and reload (existing behaviour)
      activeTab = btn.dataset.tab as 'extension' | 'settings';
      loadAndRender();
    });
  });
}
```

Note: There is only one panel (`log-container`). Both tabs control it by rewriting its content via `loadAndRender()`. Do NOT add `hidden` toggling — there is nothing to hide.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: same pass count as before. If any test fails, fix before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/logs/logs.ts
git commit -m "fix: update setupTabs() to manage aria-selected state on tab switch"
```

---

### Task 8: Create logs.css — Extracted & Tokenized Styles

**Files:**
- Create: `src/logs/logs.css`
- Modify: `src/logs/logs.ts` (add CSS import for webpack)

**Context:** `logs.css` is a new standalone stylesheet. It does NOT inherit from `popup.css` or `styles.css` — it must declare its own `:root` block. Webpack processes it via the `logs` entry point (`logs.ts` imports it). The emitted file lands at `dist/logs.css`, which `dist/logs.html` references as `logs.css` (same directory).

- [ ] **Step 1: Add CSS import to logs.ts**

At the top of `src/logs/logs.ts`, after the existing imports, add:

```typescript
import './logs.css';
```

This tells webpack to include `logs.css` in the `logs` bundle output, emitting `dist/logs.css`.

- [ ] **Step 2: Create src/logs/logs.css with @font-face and :root tokens**

```css
/* Space Grotesk — local font, paths relative to dist/logs.css */
@font-face {
  font-family: 'Space Grotesk';
  src: url('assets/fonts/SpaceGrotesk-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: 'Space Grotesk';
  src: url('assets/fonts/SpaceGrotesk-Medium.woff2') format('woff2');
  font-weight: 500;
  font-display: swap;
}
@font-face {
  font-family: 'Space Grotesk';
  src: url('assets/fonts/SpaceGrotesk-SemiBold.woff2') format('woff2');
  font-weight: 600;
  font-display: swap;
}
@font-face {
  font-family: 'Space Grotesk';
  src: url('assets/fonts/SpaceGrotesk-Bold.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
}

:root {
  --bg-primary: #18181b;
  --bg-secondary: #1f1f23;
  --text-primary: #efeff1;
  --text-secondary: #adadb8;
  --text-muted: #6b6b80;
  --border-color: #2d2d35;
  --accent: #06B6D4;
  --danger: #E91916;
  --success: #22C55E;
  --hc-warning: #F97316;
  --font: 'Space Grotesk', sans-serif;
}

[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f4f4f5;
  --text-primary: #18181b;
  --text-secondary: #3f3f46;
  --text-muted: #71717a;
  --border-color: #d4d4d8;
  --accent: #0891B2;
  --success: #16A34A;
  --hc-warning: #EA580C;
}
```

- [ ] **Step 3: Port all styles from the former embedded block**

Take every rule that was in the `<style>` block of `logs.html` (now deleted) and add it to `logs.css`, replacing hardcoded values with tokens:

| Old hardcoded value | Replace with |
|---------------------|-------------|
| `#18181b` (body bg) | `var(--bg-primary)` |
| `#efeff1` (body text) | `var(--text-primary)` |
| `#1f1f23` (tab bg) | `var(--bg-secondary)` |
| `#adadb8` (tab text) | `var(--text-secondary)` |
| `#3d3d42` (border) | `var(--border-color)` |
| `#9147ff` (active tab) | `var(--accent)` |
| `#fff` (active tab text) | `var(--text-primary)` |
| `#f44336` (error color) | `var(--danger)` |
| `#ff9800` (warn color) | `var(--hc-warning)` |
| `#888` / `#666` (debug/timestamp) | `var(--text-muted)` |
| Font stacks | `var(--font)` |

- [ ] **Step 4: Build to verify logs.css is emitted**

```bash
npm run build
```

Expected: `dist/logs.css` exists and is non-empty. Zero errors.

Check:
```bash
ls dist/ | grep logs
```
Expected output includes `logs.css` and `logs.html`.

- [ ] **Step 5: Commit**

```bash
git add src/logs/logs.css src/logs/logs.ts
git commit -m "feat: extract logs styles to logs.css with Space Grotesk and teal tokens"
```

---

### Task 9: Clean up options.html

**Files:**
- Modify: `src/options/options.html`

**Context:** `options.html` is vestigial dead code — it has no `options_page` or `options_ui` entry in `manifest.json` and is not copied to `dist/` by CopyPlugin. Changes here are archival only. Do not add a manifest entry or CopyPlugin rule.

- [ ] **Step 1: Remove inline styles and link popup.css**

Open `src/options/options.html`. Remove all `style="..."` inline attributes. In `<head>`, add:

```html
<link rel="stylesheet" href="../popup/popup.css" />
```

This is a source-relative path for the archived file. It has no effect on the built extension.

- [ ] **Step 2: Commit**

```bash
git add src/options/options.html
git commit -m "maint: clean up vestigial options.html inline styles"
```

---

## Chunk 4: Build, Validate & Ship

---

### Task 10: Full Build Verification

**Files:** None modified — verification only.

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: zero TypeScript errors, zero webpack errors or warnings.

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: all tests pass with same count as baseline from Task 2, Step 1.

- [ ] **Step 3: Verify dist output structure**

```bash
ls dist/
```

Expected to include:
```
assets/
content.css
content.js
logs.css        ← new
logs.html
logs.js
manifest.json
popup.css
popup.html
popup.js
serviceWorker.js
```

```bash
ls dist/assets/fonts/
```

Expected:
```
SpaceGrotesk-Bold.woff2
SpaceGrotesk-Medium.woff2
SpaceGrotesk-Regular.woff2
SpaceGrotesk-SemiBold.woff2
```

---

### Task 11: Visual Validation (Manual)

**Files:** None — load unpacked extension in Chrome.

**How to load unpacked:** Chrome → `chrome://extensions` → "Load unpacked" → select `dist/` folder.

- [ ] **Step 1: Dark mode popup validation**

Open the extension popup. Verify:
- [ ] Font is Space Grotesk (not system UI) — letters should have slightly squared, distinct letterforms vs system fonts
- [ ] Accent color is Electric Teal (`#06B6D4`) — nav active state, segmented control active, save button
- [ ] Success color is Electric Green (`#22C55E`) — visible on stat tiles, cancel buttons
- [ ] Toggle focus ring is visible (teal outline, not just border color) — Tab to a toggle to verify
- [ ] Input focus ring is visible — Tab to an input field to verify
- [ ] Segmented control padding looks comfortable (not cramped)

- [ ] **Step 2: Light mode popup validation**

Open Settings section → set Theme to "Light". Inspect all 6 sections. Flag any element where:
- Text becomes unreadable against background
- Teal accent disappears or blends into white
- Focus rings are invisible

Make note of any issues and adjust the light-mode token values in `popup.css` or `styles.css` as needed. Re-build after any adjustments.

- [ ] **Step 3: Friction overlay validation**

Navigate to any Twitch channel page. Trigger a purchase (or test by temporarily lowering the daily cap to $0.01 to force an intercept). Verify:
- [ ] Overlay appears with teal header gradient (not purple)
- [ ] Progress bar fills smoothly without layout jank
- [ ] Reason buttons render and are clickable
- [ ] Overlay colors are consistent with popup rebrand

- [ ] **Step 4: Logs page validation**

Open the extension → "View Activity Logs" (or navigate to `dist/logs.html` directly). Verify:
- [ ] Space Grotesk renders
- [ ] Active tab uses teal (not purple)
- [ ] Keyboard navigation: Tab to first tab button, press arrow keys to move between tabs, press Enter/Space to activate
- [ ] In Chrome DevTools → Accessibility panel: tab buttons should show `role: tab`, `selected: true/false`

---

### Task 12: Version Bump & Final Commit

**Files:**
- Modify: `manifest.json`
- Modify: `package.json`

**Context:** Per CLAUDE.md, version is bumped at the end of the branch, patch only. Current version is 0.4.13 → bump to 0.4.14.

- [ ] **Step 1: Bump version in both files**

In `package.json`:
```json
"version": "0.4.14"
```

In `manifest.json`:
```json
"version": "0.4.14"
```

Bump patch only. Do not change minor or major.

- [ ] **Step 2: Run build with new version**

```bash
npm run build
```

Expected: zero errors. The build reads version from `package.json` and injects it into `manifest.json` at build time (see webpack CopyPlugin transform).

- [ ] **Step 3: Verify version in dist**

```bash
grep '"version"' dist/manifest.json
```

Expected: `"version": "0.4.14"`

- [ ] **Step 4: Update MTS-TODO.md and MTS-Project-Document.md**

Per CLAUDE.md post-work rules:
- `MTS-TODO.md`: mark any completed items with `[x]`, update `Current Version` to `0.4.14`, update `Updated` date to today
- `MTS-Project-Document.md`: update any feature sections whose status changed in this branch

- [ ] **Step 5: Commit version bump and doc updates**

```bash
git add manifest.json package.json MTS-TODO.md MTS-Project-Document.md
git commit -m "feat: bump version to 0.4.14 — UI polish & rebrand complete"
```

- [ ] **Step 6: Push branch and open PR**

```bash
git push -u origin feat/ui-polish-rebrand
```

Open a PR on GitHub. Suggested PR title: `feat: UI polish & rebrand — teal/Space Grotesk, a11y fixes, security hardening`

PR description should note:
- Visual rebrand (Space Grotesk, Electric Teal, Electric Green)
- Security: C-01 XSS fix in reason button injection
- A11y: focus rings, label associations, ARIA tab pattern
- Performance: progress bar transform, transition specificity
- Requires visual validation of light mode before merging
