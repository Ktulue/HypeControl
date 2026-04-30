# Limits Progress Bars in Popup — Design

**Status:** Spec
**Date:** 2026-04-29
**Branch:** `feat/limits-progress-bars-in-popup`

## Goal

Replace the plain-text spending tracker rows in the popup's Limits section with the same visual progress-bar widget the friction overlay already shows during intercepts. Bars only render when the corresponding cap is enabled; cap-disabled rows fall back to the existing text behavior. No new settings, no toggle, no new UI chrome.

## Why

Today, a user with daily/weekly/monthly caps enabled has to trigger a purchase to see where they stand against those caps — the popup only shows raw dollar totals. Surfacing the same colored bars in the popup turns the Limits section into an at-a-glance status view, reinforces the "Green means saved" brand principle, and reuses a widget that already exists rather than inventing a parallel one.

## Scope

**In scope:**
- In-place visual upgrade of the daily/weekly/monthly tracker rows in the popup's Limits section
- Extracting the bar-rendering logic into a shared module
- Adding the necessary CSS variables and rules to `popup.css`
- Live updates so bars react to cap-amount edits before Save

**Out of scope:**
- Any change to the friction overlay's appearance or rendering behavior
- New settings, display toggles, or user preferences
- Section-level highlighting or "celebrate winning" success treatment
- Restructuring popup section layout, navigation, or other rows

## Architecture

New shared module **`src/shared/capBar.ts`** exposes two pure functions, extracted verbatim from `src/content/interceptor.ts:318-356`:

```typescript
export function getCapColorClass(percentage: number): string;
export function buildCapProgressBar(
  label: string,
  currentTotal: number,
  priceDelta: number,
  capAmount: number,
): string;
```

- The friction overlay calls `buildCapProgressBar('Daily', tracker.dailyTotal, priceWithTax, settings.dailyCap.amount)`.
- The popup calls `buildCapProgressBar('Daily', tracker.dailyTotal, 0, settings.dailyCap.amount)`.

Same signature; the popup just passes `0` for `priceDelta` because there's no in-flight purchase.

**Defensive guard added during extraction:** when `capAmount <= 0`, `buildCapProgressBar` returns an empty string. Callers must treat empty-string output as "no bar" and skip emitting it. This also prevents a 100% red bar appearing in the friction overlay when a user enables a cap but hasn't set an amount — a small positive side effect.

## File Changes

| File | Change |
|------|--------|
| `src/shared/capBar.ts` | **NEW** — extracted `getCapColorClass` and `buildCapProgressBar`; adds `capAmount <= 0` guard |
| `src/content/interceptor.ts` | Remove local copies of both functions (lines 318-356); add `import { buildCapProgressBar } from '../shared/capBar';` |
| `src/popup/sections/limits.ts` | Import `buildCapProgressBar` from shared module; render bars in `refreshTracker()`; switch cap-value source from `chrome.storage.sync` to `getPending()`; expose `refreshTracker()` so popup can call it from the existing `onCapChange` callback alongside `updateEscalation()` |
| `src/popup/popup.html` | Add `id="tracker-daily-text"` to the Daily row in `.hc-group` (currently has no row-level id); add three sibling slots: `<div class="hc-cap-bar-host" id="tracker-{daily,weekly,monthly}-bar" hidden></div>` |
| `src/popup/popup.css` | Add `--hc-*` CSS variables to `:root` and `[data-theme="light"]`; add `.hc-cap-bar*` and tier rules; add `.hc-cap-bar-host` for row rhythm |

No changes to `types.ts`, no migration logic, no new settings, no version bump (release timing handled separately per `docs/dev/RELEASE-PROCESS.md`).

## Behavior

### Visibility per row

| Period | Cap enabled | Cap disabled |
|--------|-------------|--------------|
| Daily | Bar visible, text row hidden | Text row visible (current behavior) |
| Weekly | Bar visible, text row hidden | Both hidden (current behavior) |
| Monthly | Bar visible, text row hidden | Both hidden (current behavior) |

For users with no caps enabled, the popup looks identical to today.

### Bar values

- **Label:** hardcoded constant — `'Daily'`, `'Weekly'`, or `'Monthly'`. Uppercased by CSS (`text-transform: uppercase`).
- **Header right-side text:** `$<currentTotal> / $<capAmount> (<percentage>%)`, or `$<currentTotal> / $<capAmount> — OVER BUDGET` when `currentTotal > capAmount`.
- **Color tier (existing 4-tier scale):**
  - `hc-cap-green` — < 60%
  - `hc-cap-yellow` — 60–79%
  - `hc-cap-orange` — 80–99%
  - `hc-cap-red` — ≥ 100%

### Live updates

`refreshTracker()` switches its cap-value source from `chrome.storage.sync.get('hcSettings')` to `getPending()` (the popup's in-memory pending state, already kept in sync with every input keystroke). Tracker totals (`dailyTotal`, `weeklyTotal`, `monthlyTotal`) still come from `chrome.storage.local` (read-only here — popup never mutates the tracker).

`refreshTracker()` is called in three places:
1. On popup load (already wired in `popup.ts:269`)
2. From `popup.ts:244` — the `onCapChange` callback for the Limits controller is extended to call both `updateEscalation()` (existing) and `limits.refreshTracker()` (new), so toggling a cap or editing its amount triggers a bar repaint
3. After "Wipe it" (Reset Tracker) — already wired in `limits.ts:144`

## CSS

### Variables

Added to `src/popup/popup.css` `:root` block (defaults — match overlay's dark-mode values from `styles.css:36-58`):

```css
--hc-success: #22C55E;
--hc-success-rgb: 34, 197, 94;
--hc-danger: #e91916;
--hc-danger-rgb: 233, 25, 22;
--hc-warning: #F97316;
--hc-warning-rgb: 249, 115, 22;
--hc-caution: #EAB308;
--hc-caution-rgb: 234, 179, 8;
--hc-progress-bg: #2a2a2e;
```

Added to `[data-theme="light"]` block (overrides — match overlay's light-mode values from `styles.css:74-77`):

```css
--hc-success: #16A34A;
--hc-warning: #EA580C;
--hc-caution: #CA8A04;
--hc-caution-rgb: 202, 138, 4;
```

These duplicate the values of existing `--success` / `--danger` tokens in popup. The duplication is intentional: the shared bar CSS uses `--hc-*` names, so adding them to popup keeps a single canonical bar stylesheet across both surfaces. Normalizing the popup's variable namespace is out of scope.

### Rules

Copied verbatim from `src/content/styles.css:269-337` into `popup.css` (the `.hc-cap-bars` wrapper at lines 262-267 is **not** copied — bars in the popup are interleaved with other rows, not stacked as a single block):

- `.hc-cap-bar`
- `.hc-cap-bar__header`, `.hc-cap-bar__label`
- `.hc-cap-bar__track`, `.hc-cap-bar__fill`
- `.hc-cap-green`, `.hc-cap-yellow`, `.hc-cap-orange`, `.hc-cap-red` (and their `.hc-cap-{tier} .hc-cap-bar__fill` companions)

There is no `.hc-cap-bar__value` rule in the source; the value span uses inherited typography.

Plus one new rule for the host slot:

```css
.hc-cap-bar-host {
  /* Vertical rhythm matching other .hc-row elements in .hc-group */
}
```

Exact margin/padding values matched to the existing row gap at implementation time.

## Edge Cases

1. **Cap enabled, amount = 0.** Guard in `capBar.ts` returns empty string. Popup treats it as "no bar" and falls back to the text row (daily) or hidden state (weekly/monthly). Friction overlay also benefits from this guard.
2. **Tracker totals at $0.** Bar renders at 0%, green tier. No special handling.
3. **`currentTotal > capAmount`.** Fill width capped at 100% (existing logic in `buildCapProgressBar`); header shows `— OVER BUDGET` in place of `(NN%)`. Tier is red.
4. **Theme switch mid-session.** `applyTheme()` flips `[data-theme="light"]` on `documentElement`; CSS variable cascade re-resolves bar colors automatically. No JS recomputation.
5. **User-controlled data in bar markup.** None. Label is a string constant; values are numeric. The existing safety comment in `buildCapProgressBar` ("innerHTML is safe here") remains valid in the popup context.
6. **Cap amount edited but not yet saved.** Bar reflects the in-memory pending state immediately. If user closes popup without saving, next open shows the saved-state bar — same as every other pending field today.

## Manual Test Plan

| # | Action | Expected |
|---|--------|----------|
| 1 | Fresh install, no caps enabled | Plain text "Daily total $0.00"; weekly/monthly rows hidden — *unchanged from today* |
| 2 | Enable daily cap, set $50, click Save, reopen popup | Daily row is a green bar with `DAILY` on the left and `$0.00 / $50.00 (0%)` on the right |
| 3 | Complete an intercepted $10 purchase, reopen popup | Bar shows `$10.00 / $50.00 (20%)`, green tier |
| 4 | Push tracker over $50 (multiple completed purchases) | Bar shows `$X.XX / $50.00 — OVER BUDGET`, red tier, fill at 100% width |
| 5 | Toggle daily cap off | Bar disappears, plain text row reappears with current $ value |
| 6 | Enable weekly + monthly caps with non-zero amounts | Both rows render as bars in their appropriate tier |
| 7 | Disable weekly cap | Weekly bar AND text row both hidden (current behavior preserved) |
| 8 | Edit daily cap amount input from $50 → $20 (don't save) | Bar percentage and tier update live as user types; on Save, persists |
| 9 | Switch popup theme: dark → light → auto | Bars use the light-mode hex values; transitions smoothly |
| 10 | Trigger a real friction event on Twitch (regression) | Friction overlay bars still render correctly — shared module extraction did not break the source surface |
| 11 | Enable daily cap with amount = 0 | Treated as disabled — text row shown for daily, bar suppressed |
| 12 | Reset Tracker via "Wipe it" | All bars instantly re-render at 0% green |

## Risks

1. **Shared-module extraction breaks the friction overlay.** Function signature is unchanged; only the source file moves. Test case #10 is the regression check.
2. **CSS variable namespace duplication in popup.** `--success` and `--hc-success` will both exist with the same value. Long-term debt; could be normalized in a future maintenance pass. Acceptable for this feature.
3. **Bar host row spacing visually inconsistent with surrounding rows.** Visual-only, caught by inspection at implementation time.
4. **Live updates on input might cause flicker on rapid keystrokes.** Each keystroke triggers `refreshTracker` → `loadSpendingTracker` → bar re-render. The async `loadSpendingTracker` could race if input is faster than storage round-trip. Mitigation: tracker totals don't change while editing cap inputs, so we can cache the tracker fetch and only re-read it on tracker-affecting events. *Decision deferred to implementation* — try the naive approach first, optimize if visible flicker occurs.

## Follow-ups

None. Scope was deliberately kept tight. If future signal arrives for any of the rejected design directions (display toggle, section-level winning highlight, co-located bars next to cap toggles), each would be a separate spec.
