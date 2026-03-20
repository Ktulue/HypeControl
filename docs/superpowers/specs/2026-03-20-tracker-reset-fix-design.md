# Tracker Reset Fix & Session Removal

**Date:** 2026-03-20
**Status:** Approved
**Version target:** 0.4.28

---

## Problem

Two bugs sharing one root cause:

1. **Stale totals in popup.** The daily/weekly/monthly reset logic (date comparison → zero out) only runs inside `loadSpendingTracker()` in `interceptor.ts` (the content script). The popup's `limits.ts` reads raw `chrome.storage.local` and displays whatever's there — no freshness checks. If the user opens the popup after midnight without navigating a Twitch page first, they see yesterday's totals. The popup's `popup.ts` has the same issue — its `updateEscalation()` function reads raw storage for escalation indicator computation.

2. **`sessionTotal` is a stale, confusing metric.** It resets only on channel switch, has no timeout, and persists indefinitely across browser restarts. Daily/weekly/monthly cover the useful ranges. Session is being removed entirely.

**Root cause:** Reset logic is trapped in the content script. No shared "load tracker with freshness checks" function exists.

---

## Design

### New file: `src/shared/spendingTracker.ts`

Single source of truth for all spending tracker reads and writes. Exports:

| Export | Purpose |
|--------|---------|
| `SPENDING_KEY` | Storage key constant (`'hcSpending'`) |
| `loadSpendingTracker(settings)` | Read from `chrome.storage.local`, run daily/weekly/monthly reset checks, **auto-save back** if any resets occurred, return fresh data |
| `saveSpendingTracker(tracker)` | Write sanitized tracker to storage |
| `recordPurchase(price, settings, tracker)` | Accumulate totals (daily, weekly, monthly — **not** session), set `lastProceedTimestamp`, save |
| `formatLocalDate(d)` | `YYYY-MM-DD` in local time |
| `getCurrentWeekStart(date, resetDay)` | ISO date of current week's start day |
| `getCurrentMonth(date)` | `YYYY-MM` format |

Functions moved from `interceptor.ts` with two behavioral changes:
1. `sessionTotal`/`sessionChannel` accumulation and reset logic removed from all functions
2. `loadSpendingTracker` now **auto-saves** if any period reset occurred (current interceptor version returns the reset tracker in memory but relies on the caller to save — the popup never did, which is why resets didn't persist)

### Type changes: `src/shared/types.ts`

Remove from `SpendingTracker` interface:
- `sessionTotal: number`
- `sessionChannel: string`

Remove from `DEFAULT_SPENDING_TRACKER`:
- `sessionTotal: 0`
- `sessionChannel: ''`

Update `sanitizeTracker()`: no explicit stripping needed — `sanitizeTracker()` already constructs a fresh object by picking known fields. Once the fields are removed from the interface, old storage values are implicitly dropped on first sanitized load.

### Content script: `src/content/interceptor.ts`

- Remove local definitions: `loadSpendingTracker`, `saveSpendingTracker`, `recordPurchase`, `formatLocalDate`, `getCurrentWeekStart`, `getCurrentMonth`, `SPENDING_KEY`
- Import all from `../../shared/spendingTracker`
- Remove the channel-switch session reset block (`if (tracker.sessionChannel !== attempt.channel)`)
- Remove the `sessionInfo` overlay rendering block (lines 430–433) and its reference in the overlay template (line 443) — this showed "Session total: $X.XX" in the friction overlay

### Popup: `src/popup/sections/limits.ts`

- Import `loadSpendingTracker` and `SPENDING_KEY` from `../../shared/spendingTracker`
- Remove local `TRACKER_KEY` constant
- Replace `refreshTracker()` implementation: fetch settings from `chrome.storage.sync`, then call shared `loadSpendingTracker(settings)` instead of raw `chrome.storage.local.get()`. This ensures reset checks run every time the popup opens.
- Remove all references to `trackerSessionEl` / `tracker-session`
- Remove `session` from reset confirmation summary text (lines 115–121 currently include `tracker?.sessionTotal` in the summary)
- Reset button still writes `DEFAULT_SPENDING_TRACKER` to storage

### Popup: `src/popup/popup.ts`

- Import `loadSpendingTracker` and `SPENDING_KEY` from shared module
- Replace raw `chrome.storage.local.get('hcSpending')` in `updateEscalation()` (line 225–226) with shared `loadSpendingTracker(settings)` so escalation indicators use fresh, reset-checked data

### Popup HTML: `src/popup/popup.html`

Remove the session total row (lines 289–296):
```html
<!-- REMOVE -->
<div class="hc-row">
  <span class="hc-label">Session total
    <span class="escalation-info" tabindex="0">ⓘ
      <span class="info-tooltip-right" role="tooltip">...</span>
    </span>
  </span>
  <span class="tracker-value" id="tracker-session">—</span>
</div>
```

### Options page: `src/options/options.ts`

- Update reset confirmation text (line 1157): change `'Reset all spending totals (daily, session, weekly, monthly) to $0?'` to `'Reset all spending totals (daily, weekly, monthly) to $0?'`
- Import `SPENDING_KEY` from shared module instead of using raw `'hcSpending'` string

---

## Files changed

| File | Action |
|------|--------|
| `src/shared/spendingTracker.ts` | **New** — shared tracker load/save/record module |
| `src/shared/types.ts` | Remove session fields from interface, default, and sanitizer |
| `src/content/interceptor.ts` | Remove local tracker functions, import shared, remove session reset block, remove overlay session display |
| `src/popup/sections/limits.ts` | Use shared loader, remove session display, remove session from reset summary |
| `src/popup/popup.ts` | Use shared loader in `updateEscalation()` |
| `src/popup/popup.html` | Remove session total row |
| `src/options/options.ts` | Remove "session" from reset prompt, use shared `SPENDING_KEY` |
| `manifest.json` | Version bump to 0.4.28 |
| `package.json` | Version bump to 0.4.28 |

---

## What stays the same

- `writeInterceptEvent()` and intercept logging pipeline (already in `src/shared/interceptLogger.ts`)
- Calendar, stats, history views — they read intercept events, not `SpendingTracker`
- All friction overlay logic (except session display removal)
- Reset button behavior (writes `DEFAULT_SPENDING_TRACKER` to storage)

---

## Testing

1. Set a daily total by proceeding through a purchase intercept
2. Advance system clock past midnight (or wait)
3. Open popup without navigating Twitch — daily total should show $0.00
4. Confirm weekly reset works at week boundary (test both Monday and Sunday reset day configs)
5. Confirm monthly reset works at month boundary
6. Confirm session total row is gone from the popup
7. Confirm session total is gone from the friction overlay
8. Confirm reset button still zeros all totals and confirmation text says "daily, weekly, monthly" (no session)
9. Confirm purchases still accumulate daily/weekly/monthly correctly
10. Confirm escalation indicator in popup uses fresh (reset-checked) tracker data
11. Build succeeds with no TypeScript errors referencing removed session fields
