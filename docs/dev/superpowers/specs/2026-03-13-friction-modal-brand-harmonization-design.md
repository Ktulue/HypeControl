# Friction Modal Brand Harmonization — Design Spec
**Date:** 2026-03-13
**Branch:** `feat/overlay-icon-issue-templates` (extend existing branch)
**Version target:** 0.4.16
**Status:** Approved

---

## Overview

The friction modal overlays (rendered by the content script) were not fully updated during the UI polish & rebrand pass. The Impeccable audit spec explicitly deferred Space Grotesk font loading in the content script due to `web_accessible_resources` complexity. That blocker is now removed — the manifest already has a `web_accessible_resources` entry (added for the logo icon). This pass completes the brand harmonization so the friction modals are visually cohesive with the popup and logs page.

**Purple accent values (already in styles.css, for reference):**
- Dark: `--hc-primary: #9147ff`, `--hc-primary-dark: #772ce8`, `--hc-primary-rgb: 145, 71, 255`
- Light: `--hc-primary: #7c3aed`, `--hc-primary-dark: #6d28d9`, `--hc-primary-rgb: 124, 58, 237`

---

## Changes

### 1. Space Grotesk font loading (`manifest.json` + `styles.css`)

**`manifest.json`** — Add font filenames to the **existing** `web_accessible_resources` entry's `resources` array (do not append a new entry):

```json
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
```

**`styles.css`** — Add `@font-face` declarations at the top of the file.

**Critical path note:** Content script CSS `url()` paths are resolved relative to the **page origin** (e.g. `https://www.twitch.tv/`), not the extension root. The relative paths used in `popup.css` (`url('assets/fonts/...')`) work there because popup pages are served from `chrome-extension://<id>/`. They will silently fail in `styles.css`. The correct form for content script CSS is the absolute extension URL using Chrome's built-in `__MSG_@@extension_id__` substitution token, which Chrome replaces at injection time:

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

---

### 2. Token alignment (`styles.css`)

Two minor fixes to match popup.css values:

| Token | Current | Target |
|-------|---------|--------|
| `--hc-radius` | `8px` | `6px` |
| `--hc-border` | `#3d3d42` | `#2d2d35` |

---

### 3. Header flattening (`styles.css`)

**Current:**
```css
.hc-header {
  background: linear-gradient(135deg, var(--hc-primary) 0%, var(--hc-primary-dark) 100%);
  padding: 16px 20px;
}
.hc-title {
  color: white;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
}
```

**Target:**
```css
.hc-header {
  background: var(--hc-bg-card);
  border-bottom: 1px solid var(--hc-border);
  padding: 16px 20px;
}
.hc-title {
  color: var(--hc-text);
  font-size: 15px;
  font-weight: 700;
}
```

Removes gradient, uppercase, and letter-spacing. Matches popup header's flat, quiet style. The header's visual identity is anchored by the HC logo PNG (32px, injected via `chrome.runtime.getURL()`) which is already in place.

---

### 4. Button alignment (`styles.css`)

**Current:**
```css
.hc-btn {
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

**Target:**
```css
.hc-btn {
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
}
```

Removes uppercase and letter-spacing. Aligns size with popup button conventions.

---

### 5. Type-to-confirm phrase display (`styles.css`)

The `.hc-confirm-phrase` selector (the badge that displays the phrase to type) has `font-family: 'Courier New', Courier, monospace` and `letter-spacing: 0.5px`. With Space Grotesk now loaded, both should be updated:

- `font-family: 'Courier New', Courier, monospace` → `font-family: var(--hc-font)`
- Remove `letter-spacing: 0.5px` (was compensating for monospace character spacing)

Note: `.hc-confirm-input` (the actual text input) already uses `font-family: inherit` — no change needed there.

---

### 6. Popup header icon (`popup.html` + `popup.css`)

Add the HC logo to the popup header alongside "Hype Control" — matching the logs page pattern.

**`popup.html`** — Add `<img>` to `.hc-title`:
```html
<h1 class="hc-title">
  <img src="assets/icons/ChromeWebStore/HC_icon_48px.png" width="20" height="20" alt="">
  Hype Control
</h1>
```

**`popup.css`** — Add flex layout to `.hc-title` so icon and text align:
```css
.hc-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
```

This change is already implemented. No `web_accessible_resources` changes needed — popup pages resolve asset URLs relative to the extension root natively.

---

## Out of Scope

- Merging `--hc-*` and `--*` CSS variable namespaces — they are semantically aligned; a structural merge is unnecessary
- Any changes to modal behavior, copy, or friction logic
- New tests

---

## Validation

- `npm run build` — zero errors
- Reload extension in Chrome, trigger a friction modal on Twitch — verify Space Grotesk renders (not system sans-serif), header is flat with the HC logo PNG visible at top, buttons are correctly sized without uppercase
- Verify light mode by toggling theme in Settings — modal should use `#7c3aed` accent throughout
