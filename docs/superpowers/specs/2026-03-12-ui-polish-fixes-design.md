# UI Polish & Fixes — Design Spec

**Date:** 2026-03-12
**Branch:** fix/ui-polish
**Version target:** 0.4.10 → 0.4.11

---

## Overview

Six targeted fixes to the HypeControl popup UI. All changes are contained to the popup layer (`popup.html`, `popup.css`, `popup.ts`, `scrollSpy.ts`, `sections/stats.ts`, `sections/channels.ts`). No storage schema changes. No new dependencies.

---

## Fix 1 — Stat Tiles: Restore Dashboard Feel

**Files:** `popup.html`, `popup.css`, `sections/stats.ts`

### Problem
Stat tiles use a single `textContent` string (e.g. `"$1.23 saved"`) on the whole tile element, making it impossible to style the value and label independently. All four tiles render in the same `var(--text-secondary)` color with minimal padding, resulting in a cramped, low-contrast dashboard.

### Solution
Restructure each tile in `popup.html` to contain two child `<span>` elements:
- `.stat-value` — the numeric/key value (large, colored)
- `.stat-label` — the descriptive label (small, muted, uppercase)

Add a color-modifier class to each tile:
- `stat-tile--saved` → `.stat-value` color: `var(--success)` (green `#00c896`)
- `stat-tile--blocked` → `.stat-value` color: `var(--text-primary)` (white)
- `stat-tile--rate` → `.stat-value` color: `#f59e0b` (amber)
- `stat-tile--step` → `.stat-value` color: `var(--accent)` (purple `#9146ff`)

**CSS changes to `.stat-tile`:**
- Padding: `8px 10px` → `12px 10px`
- Add `min-height: 60px`
- Add `display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px`
- `.stat-tiles` gap: `6px` → `8px`, margin-bottom: `10px` → `12px`
- `.stat-value`: `font-size: 18px; font-weight: 700; line-height: 1`
- `.stat-label`: `font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted)`

**stats.ts changes:**
- Query `.stat-value` child from each tile element
- `refreshStats()` sets only the value portion (e.g. `"$1.23"`, `"42"`, `"67%"`, `"Step 2"`)

---

## Fix 2 — Stats Section Scroll Detection

**Files:** `scrollSpy.ts`

### Problem
`IntersectionObserver` rootMargin is `-20% 0px -70% 0px`, placing the observation window from 20%–30% of the container height. The Stats section heading sits at scroll position 0 (the very top). When the user scrolls back up to the Stats section, the heading is at 0% — outside the observation zone — so the "Stats" nav item never re-activates.

### Solution
Change rootMargin to `0px 0px -80% 0px`. This shifts the observation window to 0%–20% of the container, so the Stats heading is intersecting when scrollTop is near 0. All other sections remain detectable as they scroll into the top portion of the viewport.

---

## Fix 3 — Light Mode (and Auto) Theme Support

**Files:** `popup.ts`, `popup.css`

### Problem
The theme setting is saved to storage but never applied to the DOM. There are no light mode CSS overrides — `:root` variables are hardcoded dark. `'auto'` mode has no implementation.

### Solution

**`popup.ts`:** Add `applyTheme(theme: ThemePreference)` function:
- `'dark'` → set `document.documentElement.dataset.theme = 'dark'`
- `'light'` → set `document.documentElement.dataset.theme = 'light'`
- `'auto'` → check `window.matchMedia('(prefers-color-scheme: light)').matches`, then apply `'light'` or `'dark'` accordingly; also attach a `change` listener on the media query to react to OS-level switches

Call `applyTheme()` on initial load (after settings are loaded) and wire it to the theme select's `change` event reactively (before save).

**`popup.css`:** Add a `[data-theme="light"]` block that overrides all CSS custom properties:
```
--bg-primary: #ffffff
--bg-secondary: #f4f4f5
--bg-input: #e9e9ec
--border-color: #d4d4d8
--text-primary: #18181b
--text-secondary: #3f3f46
--text-muted: #71717a
```
Accent, danger, success colors remain the same in both modes.

---

## Fix 4 — Footer Link Visibility

**Files:** `popup.css`

### Problem
`.footer-link` uses `color: var(--text-muted)` (`#6b6b80`), which is too low-contrast against the dark footer background.

### Solution
Change `.footer-link` base color to `var(--text-secondary)` (`#adadb8`). Hover state already uses `var(--text-primary)` — no change needed there.

---

## Fix 5 — Right Nav Width

**Files:** `popup.css`

### Problem
`.hc-nav` is `width: 110px`, consuming more horizontal space than the label text requires.

### Solution
Reduce `.hc-nav` width from `110px` to `90px`. Nav label text ("Stats", "Friction", "Comparisons", "Limits", "Channels", "Settings") all fit comfortably at 90px with existing padding.

---

## Fix 6 — Auto-Detect Channel from Active Tab

**Files:** `sections/channels.ts`

### Problem
The "Add Channel" whitelist input requires manual entry even when the extension is opened while on a Twitch channel page.

### Solution
In `initChannels()`, call `chrome.tabs.query({ active: true, currentWindow: true })` immediately after the element refs are established. Parse the returned tab URL for a Twitch channel slug using `/twitch\.tv\/([^/?#]+)/i`. If a match is found and the slug is not a reserved Twitch path (exclude: `directory`, `search`, `following`, `subscriptions`, `wallet`, `settings`, `downloads`, `jobs`, `p`, `products`), pre-populate `whitelistInputEl.value` with the slug.

**Fallback:** If `tabs[0]?.url` is undefined (e.g. `activeTab` didn't grant URL access, or the user is not on Twitch), do nothing — leave the input empty. No error thrown.

**Permission:** `activeTab` (already in manifest) is sufficient since this runs in popup context triggered by the user clicking the extension icon.

---

## Out of Scope

- No changes to storage schema
- No changes to content scripts or overlay
- No manifest permission additions
- Light mode is "functional correct" — not a deep visual design pass

---

## Files Changed Summary

| File | Change |
|---|---|
| `src/popup/popup.html` | Restructure 4 stat tiles to add `.stat-value` / `.stat-label` children and modifier classes |
| `src/popup/popup.css` | Stat tile sizing/color, footer link color, nav width, light mode variables |
| `src/popup/popup.ts` | Add `applyTheme()`, call on load and on theme change |
| `src/popup/scrollSpy.ts` | rootMargin adjustment |
| `src/popup/sections/stats.ts` | Target `.stat-value` child in `refreshStats()` |
| `src/popup/sections/channels.ts` | Auto-detect Twitch channel from active tab URL |
