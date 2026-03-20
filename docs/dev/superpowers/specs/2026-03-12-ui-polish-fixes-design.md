# UI Polish & Fixes — Design Spec

**Date:** 2026-03-12
**Branch:** fix/ui-polish
**Version target:** 0.4.10 → 0.4.11

---

## Overview

Six targeted fixes to the HypeControl popup UI. All changes are contained to the popup layer (`popup.html`, `popup.css`, `popup.ts`, `scrollSpy.ts`, `sections/stats.ts`, `sections/settings-section.ts`, `sections/channels.ts`). No storage schema changes. No new dependencies.

---

## Fix 1 — Stat Tiles: Restore Dashboard Feel

**Files:** `src/popup/popup.html`, `src/popup/popup.css`, `src/popup/sections/stats.ts`

### Problem
Stat tiles use a single `textContent` string on the whole tile `<div>` element, making it impossible to style the value and label independently. All four tiles render in `var(--text-secondary)` with minimal padding.

### Solution

**HTML:** Restructure each of the four `.stat-tile` divs in `popup.html` to contain two child `<span>` elements:
- `.stat-value` — the numeric/key value (large, colored)
- `.stat-label` — the static descriptive label (small, muted, uppercase)

Add a color-modifier class to each tile:

| Element ID | Modifier class | `.stat-value` color |
|---|---|---|
| `#stat-saved` | `stat-tile--saved` | `var(--success)` — green `#00c896` |
| `#stat-blocked` | `stat-tile--blocked` | `var(--text-primary)` — white |
| `#stat-rate` | `stat-tile--rate` | `#f59e0b` — amber |
| `#stat-step` | `stat-tile--step` | `var(--accent)` — purple `#9146ff` |

Labels (static, in HTML): "Saved", "Blocked", "Cancel Rate", "Best Step"

**CSS changes:**
- `.stat-tile`: padding `8px 10px` → `12px 10px`; add `min-height: 60px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px`; remove `color: var(--text-secondary)` (color is now on children)
- `.stat-tiles`: gap `6px` → `8px`; margin-bottom `10px` → `12px`
- Add `.stat-value`: `font-size: 18px; font-weight: 700; line-height: 1; color: var(--text-primary)` (default; overridden per modifier)
- Add `.stat-label`: `font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted)`
- Add modifier rules: `.stat-tile--saved .stat-value`, `.stat-tile--rate .stat-value`, `.stat-tile--step .stat-value`

**stats.ts changes:**

The existing `savedEl`, `blockedEl`, `rateEl`, `stepEl` variables reference the tile `<div>` elements directly (queried by ID from `initStats`'s `el` parameter). In `refreshStats()`, replace the four `*El.textContent = ...` assignments with `*El.querySelector('.stat-value')!.textContent = ...`. Set only the numeric/key portion — the label text is static in HTML.

Use optional chaining (`?.`) rather than non-null assertion to guard against HTML/JS sync issues: `*El.querySelector('.stat-value')?.textContent = ...`

New value strings: `$${stats.savedTotal.toFixed(2)}`, `${stats.blockedCount}`, `${Math.round(stats.cancelRate)}%`, `Step ${stats.mostEffectiveStep}` (or `'—'` when null).

---

## Fix 2 — Stats Section Scroll Detection

**Files:** `src/popup/scrollSpy.ts`

### Problem
The `IntersectionObserver` is initialized with `root: contentEl` (the `.hc-content` scrollable div) and `rootMargin: '-20% 0px -70% 0px'`. This creates a 10% observation band starting 20% from the top of the scroll container. The Stats section heading sits at scrollTop 0 — the very top — which falls outside this zone. When the user scrolls back up to Stats, the heading never intersects, so the "Stats" nav item never re-activates.

### Solution
Change rootMargin to `'0px 0px -80% 0px'`. The observation window becomes 0%–20% of the container height, anchored at the top, so the Stats heading is intersecting when scrollTop ≈ 0. All other section headings remain detectable as they enter the top portion of the scroll container.

Note: the existing `IntersectionObserver` already uses `root: contentEl` where `contentEl` is the `.hc-content` div (the `overflow-y: auto` scroll container). rootMargin percentages are therefore relative to that element's bounds, not the viewport.

---

## Fix 3 — Light Mode (and Auto) Theme Support

**Files:** `src/popup/popup.ts`, `src/popup/popup.css`, `src/popup/sections/settings-section.ts`

### Problem
The theme setting is saved to `chrome.storage.sync` but never applied to the DOM. No light-mode CSS overrides exist. `'auto'` mode has no implementation.

### Solution

**`settings-section.ts`:** Add an optional `onThemeChange?: (theme: ThemePreference) => void` field to the options object passed to `initSettingsSection` (same pattern: `initStats` accepts a `StatsCallbacks` object, `initLimits` accepts a `LimitsCallbacks` object). Call `onThemeChange?.(themeEl.value as ThemePreference)` inside the existing `themeEl` change handler, before `setPendingField`.

**`popup.ts`:** Declare two module-scoped variables at the top of `main()` (or as closed-over variables):
```ts
let activeMql: MediaQueryList | null = null;
let mqlHandler: ((e: MediaQueryListEvent) => void) | null = null;
```

Add `applyTheme(theme: ThemePreference)`:
1. Always clean up any existing MQL listener first — this applies to ALL theme values, not just when switching to `'auto'`:
   ```ts
   if (activeMql && mqlHandler) {
     activeMql.removeEventListener('change', mqlHandler);
     activeMql = null;
     mqlHandler = null;
   }
   ```
2. Resolve the effective theme:
   - `'dark'` → resolved = `'dark'`. No MQL listener attached. `activeMql`/`mqlHandler` remain `null`.
   - `'light'` → resolved = `'light'`. No MQL listener attached. `activeMql`/`mqlHandler` remain `null`.
   - `'auto'` → resolved = `window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'`; then create `mqlHandler = () => applyTheme('auto')`, store the MQL as `activeMql = window.matchMedia('(prefers-color-scheme: light)')`, and call `activeMql.addEventListener('change', mqlHandler)`.
3. Set `document.documentElement.dataset.theme = resolvedTheme`

Call `applyTheme(settings.theme)` on initial load after `renderAll()`. Wire it to the `onThemeChange` callback passed to `initSettingsSection`.

**`popup.css`:** Add after the `:root` block:
```css
[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f4f4f5;
  --bg-input: #e9e9ec;
  --border-color: #d4d4d8;
  --text-primary: #18181b;
  --text-secondary: #3f3f46;
  --text-muted: #71717a;
}
```
Override only these seven variables. `--accent`, `--danger`, `--success`, `--radius`, and `--font` are intentionally kept at their dark-mode values for this pass.

---

## Fix 4 — Footer Link Visibility

**Files:** `src/popup/popup.css`

Change `.footer-link` base color from `var(--text-muted)` to `var(--text-secondary)`. Hover state (`var(--text-primary)`) unchanged.

---

## Fix 5 — Right Nav Width

**Files:** `src/popup/popup.css`

Reduce `.hc-nav` width from `110px` to `90px`. All nav label text fits at 90px with existing padding.

---

## Fix 6 — Auto-Detect Channel from Active Tab

**Files:** `src/popup/sections/channels.ts`

### Solution
In `initChannels()`, after element refs are established, call:
```ts
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs.length) return;
  const url = tabs[0]?.url;
  if (!url) return;
  try {
    const hostname = new URL(url).hostname; // e.g. "www.twitch.tv"
    const pathname = new URL(url).pathname; // e.g. "/channelname"
    if (!hostname.endsWith('twitch.tv')) return;
    const slug = pathname.split('/')[1]?.toLowerCase();
    if (!slug || RESERVED_TWITCH_PATHS.has(slug)) return;
    whitelistInputEl.value = slug;
  } catch {
    // malformed URL — do nothing
  }
});
```

Define `RESERVED_TWITCH_PATHS` as a `Set<string>` at module scope:
```ts
const RESERVED_TWITCH_PATHS = new Set([
  'directory', 'search', 'following', 'subscriptions', 'wallet',
  'settings', 'downloads', 'jobs', 'p', 'products', 'videos',
  'clips', 'schedule', 'about', 'moderator', 'login', 'signup',
  'friends', 'inbox', 'drops', 'prime',
]);
```

Using `new URL(url).hostname` prevents false-positive matches on domains like `notwitch.tv`.

**Fallback:** If `tabs[0]?.url` is undefined — which occurs when `activeTab` alone doesn't return the `url` property — the function returns silently. No placeholder text, no error message. The input remains empty for manual entry.

**Permission note:** `"activeTab"` is already declared in `manifest.json` (`permissions` array). In MV3, when the user clicks the extension toolbar icon to open the popup, `activeTab` grants temporary access to the active tab including its URL — making `tab.url` available in `chrome.tabs.query()` for this invocation context. The `"tabs"` permission (which would make URL access unconditional) is intentionally not added in this pass; the graceful `url`-undefined fallback covers any edge case where access is not granted.

---

## Out of Scope

- No storage schema changes
- No content script or overlay changes
- No manifest permission additions
- Light mode is "functionally correct" — not a deep visual design pass; only the seven listed CSS variables are overridden

---

## Files Changed Summary

| File | Change |
|---|---|
| `src/popup/popup.html` | Restructure 4 stat tiles: add `.stat-value`/`.stat-label` spans and modifier classes |
| `src/popup/popup.css` | Stat tile sizing/color, footer link color, nav width, `[data-theme="light"]` block |
| `src/popup/popup.ts` | Add `applyTheme()` with MQL listener management; wire to `onThemeChange` callback |
| `src/popup/scrollSpy.ts` | `rootMargin` change: `'-20% 0px -70% 0px'` → `'0px 0px -80% 0px'` |
| `src/popup/sections/stats.ts` | Replace tile `textContent` assignments with `.stat-value` child targeting |
| `src/popup/sections/settings-section.ts` | Add `onThemeChange` callback to interface and controller |
| `src/popup/sections/channels.ts` | Auto-detect Twitch channel slug from active tab URL |
