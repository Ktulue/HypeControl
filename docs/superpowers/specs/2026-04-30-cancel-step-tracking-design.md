# Cancel-Step Tracking Fix — Design

**Date:** 2026-04-30
**Branch:** `fix/cancel-step-tracking`
**Scope:** Bug fix — `InterceptEvent.cancelledAtStep` recording in the spending history.

## Problem

The spending history view (`history.html`) shows incorrect or missing "Cancelled at Step" values for cancelled events. Per-row detail panels report wrong step numbers, and some cancel paths produce events with no step recorded at all.

The user-visible symptom: cancel-step values do not reflect where the user actually cancelled. The "Top Cancel Step" summary tile is dominated by Step 1 because data at later steps is either mislabeled or missing.

## Root cause

Three independent issues in `runFrictionFlow` (`src/content/interceptor.ts`) and its caller:

### 1. Hardcoded step numbers in intensity-gated branches

Lines 1706, 1722, 1732, 1744, 1751 return hardcoded step numbers (`3`, `4`, `5`, `5`, `6`) on cancel. These were correct under one assumption: `1 main + 1 comparison + intensity steps`. That assumption holds only when `softNudgeSteps === 1` and a price was detected — which is the minority case.

Examples of breakage:
- Zero-trust mode + no detected price → comparison loop is skipped → reason step is actually step 2, not step 3.
- Full friction with 3 comparison items → reason step is actually step 5, not step 3 (and step 3 collides with comparison item #2's number).
- Full friction with 3 comparison items + high intensity → cooldown is actually step 6, not step 4.

### 2. Two cancel paths don't record `cancelledAtStep` at all

- **Delay-timer cancel** (`interceptor.ts:1768`) returns `{ decision: 'cancel' }` with no step.
- **Cap-exceedance cancel** (`interceptor.ts:2008-2016`) writes the InterceptEvent without `cancelledAtStep`.

Both result in `cancelledAtStep === undefined`, which causes `history.ts:291` to silently omit the "Cancelled at Step" detail field for those rows.

### 3. (Out of scope) "Top Cancel Step" tile tie-breaker

`history.ts:223` favors the lowest step number on ties. Once recording is fixed, this may or may not still be a problem. Deferred per design decision — revisit after observing real corrected data.

## Approach

Replace hardcoded step numbers with a single running counter inside `runFrictionFlow`. Precompute `totalSteps` once. Every cancel returns the counter's current value. The function returns the final step it reached so the caller can chain the cap-exceedance step as the next number.

This mirrors the natural mental model of the flow ("which window am I on?") and removes the assumption-based numbering that caused Issue #1. It also makes the "Step X of Y" display on comparison modals correct without changing the modal-rendering code itself — `Y` becomes accurate because we compute it from the same set of conditions that drive the flow.

## Changes

### 1. `runFrictionFlow` (`src/content/interceptor.ts:1596`)

- Declare `let currentStep = 1;` at the top (the main overlay is always step 1).
- Compute total steps upfront with a new helper:
  ```ts
  const totalSteps = computeTotalSteps(
    priceWithTax,
    itemPool.length,
    intensity,
    settings.delayTimer.enabled,
  );
  ```
- Increment `currentStep` immediately before each subsequent window:
  - Each iteration of the comparison loop.
  - Reason step.
  - Cooldown step.
  - Type-to-confirm step (high intensity).
  - Math challenge step (extreme intensity).
  - Type-to-confirm step (after math, extreme intensity).
  - Delay timer step.
- Replace every `cancelledAtStep: <hardcoded>` return with `cancelledAtStep: currentStep`.
- Fix the delay-timer cancel path to include `cancelledAtStep: currentStep`.
- Pass the corrected `totalSteps` to `showComparisonStep` (replaces the local `totalSteps = 1 + comparisonSteps.length` calculation, which understates `Y` when intensity steps also run).

### 2. New helper: `computeTotalSteps`

```ts
function computeTotalSteps(
  priceWithTax: number | null,
  comparisonItemCount: number,
  intensity: FrictionIntensity,
  delayTimerEnabled: boolean,
): number {
  let total = 1; // main overlay
  if (priceWithTax !== null) total += comparisonItemCount;
  if (intensity !== 'low')     total += 1; // reason
  if (intensity === 'high')    total += 2; // cooldown + type-to-confirm
  if (intensity === 'extreme') total += 3; // cooldown + math + type-to-confirm
  if (delayTimerEnabled)       total += 1; // delay timer
  return total;
}
```

Lives in `interceptor.ts` near `runFrictionFlow`. Pure function, no side effects.

### 3. `FrictionResult` interface (`src/content/interceptor.ts:68-73`)

Add a new field:

```ts
export interface FrictionResult {
  decision: OverlayDecision;
  cancelledAtStep?: number;
  purchaseReason?: string;
  lastStep: number; // final step number reached, populated on both proceed and cancel
}
```

`lastStep` is populated unconditionally so the caller can use it to compute the next step number (for cap-exceedance). On cancel, `lastStep === cancelledAtStep`.

### 4. Caller's cap-exceedance handler (`src/content/interceptor.ts:2008-2016`)

When the user cancels at the cap-exceedance step (which runs *after* `runFrictionFlow` returns proceed), record:

```ts
cancelledAtStep: frictionResult.lastStep + 1,
```

This positions cap-exceedance correctly as the step immediately after the last friction window the user passed.

## Out of scope

- **"Top Cancel Step" tile tie-breaker** (`history.ts:223`). Deferred — revisit after observing post-fix data. Tracked as a future PR if still problematic.
- **"Step X of Y" headers on intensity-gated modals.** These modals do not currently render a step counter in their UI. We are not adding one.
- **`chatCommandInterceptor.ts`.** Already reads `frictionResult.cancelledAtStep` and writes it through (line 306). The fix propagates automatically; no changes required in this file.

## Testing

Manual smoke testing covers each fix scenario. Trigger via real Twitch purchase buttons or the demo-overlay action.

| Scenario | Expected `cancelledAtStep` | Pre-fix bug |
| --- | --- | --- |
| Cancel at main overlay | `1` | (correct already) |
| Cancel at comparison item index `i` (0-based) | `i + 2` | (correct already) |
| Zero-trust + no detected price + medium intensity, cancel at reason | `2` | Hardcoded `3` |
| Full friction with 3 enabled comparison items, high intensity, cancel at cooldown | `6` | Hardcoded `4` |
| Full friction with 3 enabled comparison items, extreme intensity, cancel at math | `7` | Hardcoded `5` |
| Delay timer enabled, low intensity, no comparisons (price null), cancel at delay timer | `2` | Missing entirely (`undefined`) |
| All friction passed, cancel at cap-exceedance | `lastStep + 1` (varies) | Missing entirely (`undefined`) |

After the fix:
- Per-row detail panels in `history.html` show the correct step number for every cancelled event.
- "Step X of Y" headers on comparison modals show correct `Y` when intensity steps also run.

## Follow-ups

- Observe whether the "Top Cancel Step" summary tile still skews to Step 1 once real data accumulates with corrected recording. If so, open a follow-up PR to revisit the tie-breaker (`history.ts:223`).
