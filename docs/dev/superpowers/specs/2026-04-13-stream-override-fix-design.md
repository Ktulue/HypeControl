# Stream Override Fix — Design Spec

**Issue:** [#32 — Stream Override feature doesn't seem to work](https://github.com/Ktulue/HypeControl/issues/32)
**Date:** 2026-04-13
**Status:** Approved, ready for plan

## Problem

The popup's "Stream Override" button starts a 2-hour countdown but does not actually disable interception. Users can still be blocked by friction overlays while the override is supposedly active.

## Root Cause

The override is wired up at both ends but the two ends are not connected.

- **Popup side** (`src/popup/sections/stats.ts:44-47`): Saves `streamingOverride: { expiresAt: <timestamp> }` to `chrome.storage.sync` inside the `hcSettings` key.
- **Content script side** (`src/content/streamingMode.ts:91-97`): Checks `manualOverrideUntil` from a completely different location — `chrome.storage.local` under the `hcStreamingState` key. Nothing ever writes to that field.

Two different storage APIs, two different key names, two different data shapes. The popup and the interceptor never talk to each other about overrides.

Additionally, `shouldBypassFriction()` gates on `streamingMode.enabled && twitchUsername && onOwnChannel` (line 86). The override button in the popup has no such constraints — it is a general "disable HC for 2 hours" escape hatch that should work on any channel.

## Mental Model

"Streaming mode bypass" is a single state with two activation paths:

1. **Auto-detect** — you are live on your own channel (or in grace period after stream ended)
2. **Manual override** — the 2-hour override button was clicked and has not expired

While the state is active:

- No friction overlay is shown for intercepted purchases
- Every intercepted purchase is recorded and logged with `outcome: 'streaming'`
- A persistent badge is visible indicating HC is paused (and how long remains)

When the state ends, the badge disappears and normal friction resumes. Purchases made during the bypass window are visible in the logs viewer, giving the user after-the-fact visibility into spending.

## Scope Decisions

- **Override is global, any channel.** The button is presented as a universal escape hatch; no UI copy or gating implies own-channel only. The auto-detect feature already handles the "I'm live on my channel" case.
- **Single `'streaming'` outcome label for both activation paths.** Users do not need to distinguish manual override from auto-detect in the logs. Both produce the same bypass behavior.
- **Persistent badge replaces the per-purchase toast.** The current `showStreamingModeToast` flashes for a few seconds on each purchase. A persistent badge is a better fit for a mode state that lasts hours.

## Changes by File

### 1. `src/shared/types.ts`

- Extend the `InterceptEvent.outcome` union from `'cancelled' | 'proceeded'` to `'cancelled' | 'proceeded' | 'streaming'`.
- Update `sanitizeInterceptEvent` (or equivalent sanitizer) to accept the new value on read.

### 2. `src/content/streamingMode.ts`

- Update `shouldBypassFriction(settings)`:
  - **First check:** if `settings.streamingOverride?.expiresAt` is a finite number greater than `Date.now()`, return `true` (global bypass — short-circuits all other gates).
  - **Otherwise:** fall through to the existing own-channel live / grace-period logic, unchanged.
- Remove the dead `manualOverrideUntil` field from the `StreamingState` interface and from `loadStreamingState` / `saveStreamingState`. It is never written.
- Fix the stale code comment on line 93 ("Manual override (future popup feature)") — the popup feature exists; the comment is misleading.

### 3. `src/content/interceptor.ts`

- In the streaming bypass block (~line 1847), after `shouldBypassFriction()` returns `true`:
  - Load the spending tracker (`loadSpendingTracker(settings)`).
  - Compute price with tax: `Math.round((attempt.priceValue ?? 0) * (1 + settings.taxRate / 100) * 100) / 100`.
  - Call `recordPurchase(attempt.priceValue, settings, tracker)` so daily/weekly/monthly totals reflect the spend.
  - Call `writeInterceptEvent({ ..., outcome: 'streaming' })` so the log captures the event.
  - Remove the call to `showStreamingModeToast()` — replaced by persistent badge.
  - Keep `allowNextClick(actualButton)` and the early `return`.
- The `logBypassed` debug log (line 1854-1856) stays.
- The `checkWhitelist` informational log (line 1850-1853) stays — useful signal that a whitelist entry was overridden by streaming mode.

### 4. Persistent Badge

Follow the precedent set by `hc-grace-badge` in `streamingMode.ts:updateGracePeriodBadge()`:

- New element id: `hc-streaming-badge` (rename or replace the current `hc-streaming-toast`; the toast is being removed).
- New function: `updateStreamingBadge(settings)`:
  - If `shouldBypassFriction(settings)` would return true, show the badge; otherwise remove it.
  - Content depends on which activation is active (check in this order):
    - **Manual override active:** `⏸ HC paused — override (<Xh Ym>)` with countdown derived from `settings.streamingOverride.expiresAt`
    - **Live on own channel:** `🔴 HC paused — live on <channel>`
    - **Grace period:** `⏳ HC paused — grace period (<Xm>)` — this is effectively today's `updateGracePeriodBadge`, unified into the same element
- Update frequency:
  - Piggyback on the existing 30s `checkAndUpdateLiveStatus` poll.
  - Add a separate lightweight 30s timer (or shared tick) that refreshes the badge when the user is not on their own channel, so the manual-override countdown updates regardless of location.
  - Update once immediately on content script load as well, so the badge appears without waiting for the first tick.
- The existing `hc-grace-badge` is replaced by the unified badge. Retire the old id and CSS class; add styles for the new `hc-streaming-badge`.

### 5. `src/content/styles.css`

- Remove or retire `.hc-streaming-toast` / `.hc-streaming-toast--fade` styles (no longer used).
- Add styles for `.hc-streaming-badge` — same positioning convention as the former grace badge (corner-anchored, unobtrusive, non-interactive: `pointer-events: none`), with a color that reads as "paused / informational" rather than "alert." Teal or purple accent fits the brand palette better than the current danger red.
- Retire `hc-grace-badge` styles in favor of the unified badge.

### 6. `src/logs/logs.ts`

- Add visual treatment for `outcome: 'streaming'`:
  - Distinct badge color (teal or blue, to stay clear of green=saved and red=blocked semantics).
  - Label text: "Streaming".
- Ensure any existing filter / grouping UI handles the third outcome value gracefully (does not crash, does not silently drop these events).

### 7. `src/shared/interceptLogger.ts`

- `computePopupStats()` currently derives `blockedCount` and `savedTotal` from `outcome === 'cancelled'`. **No change needed** — `streaming` events count as neither blocked nor proceeded-under-friction, which is the correct semantic: they are a third category, "allowed without friction." This keeps the cancel-rate stat honest (it measures friction effectiveness, not bypass spending).

## Outcome Taxonomy Summary

| Outcome | Meaning | Counts toward |
|---|---|---|
| `cancelled` | User saw friction and backed out | `blockedCount`, `savedTotal` |
| `proceeded` | User saw friction and went through | neither |
| `streaming` | Bypass was active — no friction shown, logged and allowed through | neither |

## Testing Plan

1. **Override activates bypass on any channel:**
   - On a channel other than your own, click "Stream Override (2 hr)" in the popup.
   - Attempt a cheer/sub/gift purchase.
   - Expected: no friction overlay, purchase allowed through, logged with `outcome: 'streaming'`.

2. **Override persists across page reloads and channel changes:**
   - Activate override.
   - Navigate to a different Twitch channel.
   - Expected: badge still visible with correct remaining time; bypass still active.

3. **Override expires correctly:**
   - Activate override, wait for (or mock) expiry.
   - Expected: badge disappears, friction resumes on next purchase attempt.

4. **Cancel override button works:**
   - Activate override, then click "Cancel Override" in the popup.
   - Expected: badge disappears immediately (or within one poll tick), friction resumes on next purchase.

5. **Auto-detect still works:**
   - Disable override. Configure streaming mode with your own username. Go live on your own channel.
   - Expected: badge reads "🔴 HC paused — live on <channel>", purchases bypass and log as `streaming`.

6. **Grace period still works:**
   - End a live stream (or mock `streamEndedAt`).
   - Expected: badge reads "⏳ HC paused — grace period (Xm)" and counts down; bypass stays active for the configured grace minutes.

7. **Logs viewer shows streaming events:**
   - After bypass activity, open the logs page.
   - Expected: events show with "Streaming" label/badge in a distinct color.

8. **Stats unchanged for streaming outcomes:**
   - `savedTotal` and `blockedCount` do not move for `streaming` events.
   - Cancel-rate math ignores `streaming` events (only `cancelled` / `proceeded` contribute).

## Out of Scope (Follow-ups)

- Dedicated "spent during streaming mode" stat / chart in the popup.
- Separate outcome values for manual-override vs auto-detect (intentionally labeled the same).
- Cosmetic cleanup of `shouldBypassFriction`'s early-return log lines (not blocking).

## Version Bump

Per project convention, bump patch version in `manifest.json` and `package.json` at the end of implementation, before the final build. Current version is 1.0.2 (per issue reporter); bump to 1.0.3.
