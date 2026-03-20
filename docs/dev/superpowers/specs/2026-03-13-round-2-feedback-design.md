# HypeControl v0.4.11 — Round 2 Feedback Design Spec

**Date:** 2026-03-13
**Version target:** 0.4.12
**Branches:** `fix/round-2-bugs` + `feat/stat-card-tooltips`

---

## Overview

Two branches address 8 user-reported issues from Round 2 feedback. Branch 1 fixes 7 bugs. Branch 2 adds stat card tooltips as a new enhancement.

---

## Branch 1: `fix/round-2-bugs`

### Bug 1 — Remove duplicate Thresholds toggle from Stats section

**Root cause:** `popup.html` has two `frictionThresholds.enabled` toggles — one in Stats (`#stats-thresholds-enabled`) and one in Friction (`#friction-thresholds-enabled`). They control the same setting. The Stats one has no config panel behind it, creating confusion.

Note: both Stats and Friction also have duplicate `frictionIntensity` segmented controls (`#stats-intensity` / `#friction-intensity`). This duplication is **intentional** — the Stats section acts as a quick-access landing section, and a simple 4-button Intensity control makes sense there. The Thresholds toggle does not, because thresholds are a multi-field setting (floor, ceiling, nudge steps) that has no meaning without the accompanying config panel.

**Fix — HTML (`popup.html`):**
- Remove the entire `<div class="hc-row">` containing `#stats-thresholds-enabled` from the Stats section

**Fix — `stats.ts`:**
- Remove `thresholdsCbEl` and its `querySelector` assignment
- Remove the `thresholdsCbEl.addEventListener('change', ...)` block
- Remove `onThresholdToggle` from the `StatsCallbacks` interface
- Remove the `callbacks.onThresholdToggle(enabled)` call

**Fix — `popup.ts`:**
- Remove `onThresholdToggle` from the `initStats(statsEl, { ... })` call block (lines ~79–86)
- `LimitsCallbacks.onThresholdToggle` in `limits.ts` is declared but **never called** — it is dead code. Remove `onThresholdToggle` from the `LimitsCallbacks` interface in `limits.ts`, remove the `callbacks` parameter from `initLimits` entirely (since `onThresholdToggle` was its only member), and remove the callback object from the `initLimits(limitsEl, { ... })` call in `popup.ts` (lines ~64–70)

**Files:** `src/popup/popup.html`, `src/popup/sections/stats.ts`, `src/popup/sections/limits.ts`, `src/popup/popup.ts`

---

### Bug 2 — Cannot scroll to bottom of popup

**Root cause:** `.hc-content` is a flex child with `overflow-y: auto` but no `min-height: 0`. Its parent `.hc-body` already has `min-height: 0`, but the child `.hc-content` does not — without it, the flex item resists shrinking below its content height, so `overflow-y: auto` never activates a bounded scroll region. (Note: `.hc-body`'s `min-height: 0` is not the fix here — it is `.hc-content` that is missing it.)

**Fix:** Add `min-height: 0` to the `.hc-content` rule in `popup.css`.

**Files:** `src/popup/popup.css`

---

### Bug 3 — Soft Nudge Steps can exceed comparison count

**Root cause:** `#threshold-nudge-steps` has `min="1"` but no `max`. No cap is enforced at save time.

**Fix in `friction.ts`:**
- Add `let currentSettings: UserSettings` as a closure-level variable inside `initFriction` (before `render` and `updateThresholds` are defined)
- In `render(settings: UserSettings)`, assign `currentSettings = settings` and then set `nudgeStepsEl.max = String(settings.comparisonItems.length)`
- In `updateThresholds()`, clamp the parsed steps value: `Math.min(parseInt(nudgeStepsEl.value, 10) || 1, currentSettings?.comparisonItems.length || 1)`

**Files:** `src/popup/sections/friction.ts`

---

### Bug 4 — Settings Log captures nothing from popup saves

**Root cause:** `popup.ts` save handler calls `chrome.storage.sync.set` directly without importing `logger`. All `settingsLog()` calls live in `options.ts` only. Popup-driven saves are invisible to the Settings Log tab.

**Fix in `popup.ts`:**
- Import `settingsLog` and `setVersion` from `../shared/logger`
- In `main()` at startup, call `setVersion(chrome.runtime.getManifest().version)` — this initialises the logger's version tracking without triggering log clearing (do NOT call `loadLogs()` from the popup; `options.ts` and the content script already handle log clearing on version change, and adding a third caller risks redundant clears)
- In the save button success path, after `chrome.storage.sync.set` resolves, call `settingsLog('Settings saved via popup', { snapshot: getPending() })`

**Files:** `src/popup/popup.ts`

---

### Bug 5 — Logs page content not centered

**Root cause:** `logs.html` body has `padding: 16px` but no centering. All elements render left-aligned.

**Fix:** Wrap the existing body content (`<h1>`, `.tabs`, `.controls`, `.log-container`) in a `<div class="log-wrapper">`. Add to the inline `<style>`:

```css
.log-wrapper {
  max-width: 900px;
  margin: 0 auto;
}
```

Do not apply `max-width` to `body` — `body` contains `.log-container` which uses `height: calc(100vh - 140px)`. Keeping body full-width and constraining the inner wrapper avoids a mismatch between the viewport-relative height and the constrained width.

**Files:** `src/logs/logs.html`

---

### Bug 6 — Emoji picker tooltip missing from comparison subpanel

**Root cause:** The comparison item subpanel in `popup.html` has the emoji input but no platform hint. Previously existed, lost in a refactor.

**Fix:**
- Below the emoji `<div class="hc-row">`, add:
  ```html
  <p class="hc-hint">Windows: <kbd>Win + .</kbd>&nbsp; Mac: <kbd>Ctrl + ⌘ + Space</kbd></p>
  ```
- Add `.hc-hint` to `popup.css`:
  ```css
  .hc-hint {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 2px;
    margin-bottom: 4px;
  }
  .hc-hint kbd {
    font-family: var(--font);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    padding: 1px 4px;
    font-size: 10px;
  }
  ```

**Files:** `src/popup/popup.html`, `src/popup/popup.css`

---

### Bug 7 — Whitelist banner shows placeholder dev copy

**Root cause:** `interceptor.ts` builds the whitelist note string using unicode escapes:
```
'\u2B50 Whitelisted Channel \u2014 This is a planned support channel'
```
"planned support channel" is dev placeholder copy.

**Fix:** Change the string to:
```
'\u2B50 Whitelisted Channel \u2014 This channel is on your whitelist'
```
Search for the exact string `This is a planned support channel` in `interceptor.ts` to locate it.

**Files:** `src/content/interceptor.ts`

---

## Branch 2: `feat/stat-card-tooltips`

### Enhancement 8 — Stat card hover tooltips

**Goal:** Each of the 4 stat tiles gets a ⓘ icon in the bottom-right corner. Hovering the tile reveals a tooltip explaining the stat.

**HTML changes in `popup.html`:**
Add inside each `.stat-tile`, after `.stat-label`:
```html
<span class="stat-info">ⓘ</span>
<span class="stat-tooltip">...</span>
```

Tooltip copy per tile:
- **#stat-saved** — "Total dollars saved by cancelling intercepted purchases"
- **#stat-blocked** — "Number of purchases you chose not to complete"
- **#stat-rate** — "How often you cancel when Hype Control intervenes"
- **#stat-step** — "The friction step where you most often decide to cancel"

**CSS in `popup.css`:**
- `.stat-tile` gets `position: relative` (add if not already set)
- `.stat-info`: `position: absolute; bottom: 4px; right: 6px; font-size: 10px; color: var(--text-muted); cursor: default; line-height: 1;`
- `.stat-tile:hover .stat-info`: `color: var(--text-secondary);`
- `.stat-tooltip`: hidden by default (`display: none`), shown on `.stat-tile:hover .stat-tooltip`; positioned above the tile; styled as a small dark tooltip bubble with padding, border-radius, border, and z-index to float above other content
- Tooltip positioning: `position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); width: 160px; ...`

**No JS required.** CSS-only hover interaction.

**Files:** `src/popup/popup.html`, `src/popup/popup.css`

---

## What Is Not Changing

- No new settings fields or storage keys
- No changes to `types.ts`, `interceptLogger.ts`, or the options page
- No version bump in this spec (handled at build time per CLAUDE.md)
- Duplicate `frictionIntensity` controls in Stats + Friction are intentionally retained
- Firefox rebuild remains tabled

---

## Success Criteria

- [ ] Only one Thresholds toggle exists in the popup (in Friction section only)
- [ ] `LimitsCallbacks` no longer has `onThresholdToggle`; `initLimits` takes no callbacks
- [ ] Popup scrolls fully to the bottom with all sections visible
- [ ] Soft Nudge Steps input cannot exceed total comparison item count (`settings.comparisonItems.length`)
- [ ] Saving settings via popup writes an entry to the Settings Log tab
- [ ] Logs page header and controls are centered (via `.log-wrapper` max-width)
- [ ] Emoji hint shows both Windows and Mac shortcuts below the emoji input
- [ ] Whitelist friction overlay shows "This channel is on your whitelist"
- [ ] All 4 stat tiles show ⓘ icon with tooltip on hover
