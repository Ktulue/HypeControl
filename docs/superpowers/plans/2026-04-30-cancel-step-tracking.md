# Cancel-Step Tracking Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Do NOT bump versions.** Version bumps are out of scope for this plan and are handled by the user via `npm run release`. Subagents must not edit `manifest.json`, `manifest.firefox.json`, or `package.json` version fields.

**Goal:** Fix `InterceptEvent.cancelledAtStep` so it reflects the actual step where the user cancelled, regardless of friction intensity, comparison-item count, or whether a price was detected.

**Architecture:** Replace hardcoded step numbers in `runFrictionFlow` with a running counter (`currentStep`). Precompute total steps once via a pure helper based on price availability, comparison count, intensity, and delay-timer enablement. Surface the final step reached on `FrictionResult.lastStep` so the caller can chain the cap-exceedance step (which lives outside `runFrictionFlow`) as the next step number.

**Tech Stack:** TypeScript, Jest + ts-jest, webpack. Project root at `F:\GDriveClone\Claude_Code\HypeControl`. Branch: `fix/cancel-step-tracking`.

**Spec:** `docs/superpowers/specs/2026-04-30-cancel-step-tracking-design.md`

---

## File Plan

| File | Action | Responsibility |
| --- | --- | --- |
| `src/shared/frictionStepCount.ts` | Create | Pure helper `computeTotalSteps`. No DOM dependency — lives in shared so it can be unit-tested without jsdom. |
| `tests/shared/frictionStepCount.test.ts` | Create | Unit tests covering all conditional branches of `computeTotalSteps`. |
| `src/content/interceptor.ts` | Modify | Add `lastStep` to `FrictionResult`; refactor `runFrictionFlow` to counter-based; fix delay-timer cancel; update cap-exceedance handler in caller. |
| `docs/dev/HypeControl-TODO.md` | Modify | Per CLAUDE.md post-work updates: add bug-fix entry, update header date. |

`HC-Project-Document.md` does **not** need updating — this is a bug fix; no feature status changes.

`chatCommandInterceptor.ts` does **not** need updating — it already reads `frictionResult.cancelledAtStep` and writes it through (line 306). The fix propagates automatically.

---

## Task 1: Add `computeTotalSteps` helper (TDD)

**Files:**
- Create: `src/shared/frictionStepCount.ts`
- Create: `tests/shared/frictionStepCount.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `tests/shared/frictionStepCount.test.ts` with this exact content:

```typescript
import { computeTotalSteps } from '../../src/shared/frictionStepCount';

describe('computeTotalSteps', () => {
  test('low intensity, no price, no delay timer → 1 (main only)', () => {
    expect(computeTotalSteps(null, 0, 'low', false)).toBe(1);
  });

  test('low intensity, with price, 3 comparisons, no delay timer → 4', () => {
    expect(computeTotalSteps(5.99, 3, 'low', false)).toBe(4);
  });

  test('low intensity, no price, with delay timer → 2 (main + delay)', () => {
    expect(computeTotalSteps(null, 0, 'low', true)).toBe(2);
  });

  test('medium intensity, no price, no delay timer → 2 (main + reason)', () => {
    expect(computeTotalSteps(null, 0, 'medium', false)).toBe(2);
  });

  test('medium intensity, with price, 1 comparison, no delay timer → 3', () => {
    expect(computeTotalSteps(5.99, 1, 'medium', false)).toBe(3);
  });

  test('high intensity, no price, no delay timer → 4 (main + reason + cooldown + type)', () => {
    expect(computeTotalSteps(null, 0, 'high', false)).toBe(4);
  });

  test('high intensity, with price, 2 comparisons, with delay timer → 7', () => {
    // 1 main + 2 comparisons + 3 intensity (reason + cooldown + type) + 1 delay = 7
    expect(computeTotalSteps(5.99, 2, 'high', true)).toBe(7);
  });

  test('extreme intensity, with price, 3 comparisons, with delay timer → 9', () => {
    // 1 main + 3 comparisons + 1 reason + 1 cooldown + 1 math + 1 type + 1 delay = 9
    expect(computeTotalSteps(5.99, 3, 'extreme', true)).toBe(9);
  });

  test('extreme intensity, no price, no delay timer → 5 (main + reason + cooldown + math + type)', () => {
    expect(computeTotalSteps(null, 0, 'extreme', false)).toBe(5);
  });

  test('comparison count is ignored when price is null', () => {
    // Even with 5 items configured, no price means no comparison steps.
    expect(computeTotalSteps(null, 5, 'low', false)).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npm test -- frictionStepCount
```

Expected: FAIL — module `../../src/shared/frictionStepCount` not found.

- [ ] **Step 3: Implement the helper**

Create `src/shared/frictionStepCount.ts` with this exact content:

```typescript
import { FrictionIntensity } from './types';

/**
 * Total number of friction windows the user will see for a given configuration.
 *
 * The friction flow consists of:
 * - 1 main overlay (always)
 * - N comparison-item overlays (only when a price was detected)
 * - intensity-gated overlays:
 *     - medium: reason selection (1 step)
 *     - high: reason + cooldown + type-to-confirm (3 steps)
 *     - extreme: reason + cooldown + math + type-to-confirm (4 steps)
 * - 1 delay-timer overlay (only when delayTimer.enabled)
 */
export function computeTotalSteps(
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

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- frictionStepCount
```

Expected: PASS — all 10 test cases pass.

- [ ] **Step 5: Run full test suite to ensure nothing else broke**

```bash
npm test
```

Expected: PASS — all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/shared/frictionStepCount.ts tests/shared/frictionStepCount.test.ts
git commit -m "feat(shared): add computeTotalSteps helper for friction step accounting

Pure helper that computes the total number of friction overlays a user
will see for a given configuration (price availability, comparison count,
intensity, delay timer). Used in the next commit to fix step-number
recording in runFrictionFlow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Refactor `runFrictionFlow` to use the counter

**Files:**
- Modify: `src/content/interceptor.ts`
  - `FrictionResult` interface (lines 68-73)
  - `runFrictionFlow` body (lines 1596-1773)

This task makes coordinated changes that must land together to keep TypeScript happy. Each step is a single targeted edit.

- [ ] **Step 1: Add the import for `computeTotalSteps`**

In `src/content/interceptor.ts`, find the existing imports near the top of the file. Add this import alongside the existing `../shared/...` imports:

```typescript
import { computeTotalSteps } from '../shared/frictionStepCount';
```

- [ ] **Step 2: Add `lastStep` field to `FrictionResult` interface**

In `src/content/interceptor.ts`, find this block (around line 68-73):

```typescript
/** Result returned by runFrictionFlow */
export interface FrictionResult {
  decision: OverlayDecision;
  cancelledAtStep?: number;
  purchaseReason?: string;
}
```

Replace with:

```typescript
/** Result returned by runFrictionFlow */
export interface FrictionResult {
  decision: OverlayDecision;
  cancelledAtStep?: number;
  purchaseReason?: string;
  /** Final step number reached. Populated on both proceed and cancel. On cancel, equals cancelledAtStep. */
  lastStep: number;
}
```

After this edit, TypeScript will report errors at every `runFrictionFlow` return site. We'll fix them in Step 3.

- [ ] **Step 3: Replace the entire `runFrictionFlow` body**

In `src/content/interceptor.ts`, find the function definition starting at line 1596. Replace the entire function body (the function itself, from `async function runFrictionFlow(` through its closing `}` — currently lines 1596-1773) with this exact code:

```typescript
async function runFrictionFlow(
  attempt: PurchaseAttempt,
  settings: UserSettings,
  tracker: SpendingTracker,
  maxComparisons?: number,
  whitelistNote?: string,
  onWhitelistAdd?: (behavior: WhitelistBehavior) => Promise<void>,
): Promise<FrictionResult> {
  let purchaseReason: string | undefined;
  let currentStep = 1;

  // Step 1: Main overlay
  const mainDecision = await showMainOverlay(attempt, settings, tracker, whitelistNote, onWhitelistAdd);
  if (mainDecision === 'cancel') {
    log('Friction flow: cancelled at Step 1 (main overlay)');
    return { decision: 'cancel', cancelledAtStep: currentStep, lastStep: currentStep };
  }

  // Compute priceWithTax (null when no price was detected)
  const priceWithTax = (attempt.priceValue && attempt.priceValue > 0)
    ? Math.round(attempt.priceValue * (1 + settings.taxRate / 100) * 100) / 100
    : null;

  if (priceWithTax === null) {
    log('Friction flow: no price detected, skipping comparison steps');
  }

  // Compute item pool. Empty when priceWithTax is null (comparison loop will be skipped).
  const itemPool: ComparisonItem[] = priceWithTax === null
    ? []
    : maxComparisons !== undefined
      ? settings.comparisonItems
          .filter(i => i.enabled && (i.frictionScope ?? 'both') !== 'full')
          .slice(0, maxComparisons)
      : settings.comparisonItems
          .filter(i => i.enabled && (i.frictionScope ?? 'both') !== 'nudge');

  // Compute escalated intensity (hoisted from below — pure, no side effects)
  const maxPercent = computeMaxCapPercent(settings, tracker);
  const intensity = computeEscalatedIntensity(
    settings.frictionIntensity ?? 'low',
    maxPercent,
    settings.intensityLocked ?? false,
  );

  // Compute total steps once based on actual conditions.
  const totalSteps = computeTotalSteps(
    priceWithTax,
    itemPool.length,
    intensity,
    settings.delayTimer?.enabled ?? false,
  );

  // Steps 2..(1+itemPool.length): comparison items (only when price detected)
  if (priceWithTax !== null) {
    const taxPrice = `$${priceWithTax.toFixed(2)}`;
    const comparisonSteps: { item: ComparisonItem; display: ComparisonDisplay }[] = [];

    for (const item of itemPool) {
      const display = formatComparisonDisplay(item, priceWithTax, taxPrice);
      comparisonSteps.push({ item, display });
    }

    log(`Friction flow: ${comparisonSteps.length} comparison step(s) (${maxComparisons !== undefined ? 'nudge/enabled only' : 'full/all items'}), priceWithTax=${taxPrice}`);

    for (let i = 0; i < comparisonSteps.length; i++) {
      const { item, display } = comparisonSteps[i];
      currentStep++;
      const decision = await showComparisonStep(item, display, currentStep, totalSteps, attempt);
      if (decision === 'cancel') {
        log(`Friction flow: cancelled at Step ${currentStep} (${item.name})`, {
          stepsCompleted: currentStep - 1,
          totalSteps,
        });
        return { decision: 'cancel', cancelledAtStep: currentStep, lastStep: currentStep };
      }
    }

    log('Friction flow: completed all comparison steps', {
      totalSteps,
      channel: attempt.channel,
      rawPrice: attempt.rawPrice,
    });
  }

  // ── Intensity-gated steps ─────────────────────────────────────────────
  // For intensity steps we reuse a shared overlay element that each step re-populates.
  // Note: showReasonSelectionStep appends and removes the overlay itself.
  // The subsequent steps (cooldown, type-to-confirm, math) expect the overlay to
  // already be in the DOM (they only set innerHTML and apply theme).
  // So after reason selection proceeds we must re-append before the next step.
  let intensityOverlay: HTMLElement | null = null;

  if (intensity === 'medium' || intensity === 'high' || intensity === 'extreme') {
    intensityOverlay = document.createElement('div');
    intensityOverlay.id = 'hc-overlay';
    intensityOverlay.className = 'hc-overlay';
    intensityOverlay.setAttribute('role', 'dialog');
    intensityOverlay.setAttribute('aria-modal', 'true');
    intensityOverlay.setAttribute('aria-labelledby', 'hc-overlay-heading');
    intensityOverlay.setAttribute('aria-describedby', 'hc-overlay-desc');

    currentStep++;
    log(`Friction flow: starting reason selection step (step ${currentStep})`);
    const reasonResult = await showReasonSelectionStep(intensityOverlay);
    if (reasonResult.decision === 'cancel') {
      // Overlay was already removed by showReasonSelectionStep; nothing to clean up.
      return { decision: 'cancel', cancelledAtStep: currentStep, lastStep: currentStep };
    }
    purchaseReason = reasonResult.reason;
  }

  if (intensity === 'high' || intensity === 'extreme') {
    // showReasonSelectionStep removed the overlay from DOM after resolving.
    // Re-append so cooldown step can operate on it.
    overlayVisible = true;
    document.body.appendChild(intensityOverlay!);

    currentStep++;
    const cooldownSecs = intensity === 'extreme' ? 30 : 10;
    log(`Friction flow: starting friction cooldown step (${cooldownSecs}s, step ${currentStep})`);
    const cooldownResult = await showFrictionCooldownStep(intensityOverlay!, cooldownSecs);
    if (cooldownResult === 'cancel') {
      removeOverlay(intensityOverlay!);
      return { decision: 'cancel', cancelledAtStep: currentStep, lastStep: currentStep };
    }
  }

  if (intensity === 'high') {
    currentStep++;
    log(`Friction flow: starting type-to-confirm step (step ${currentStep})`);
    const typeResult = await showTypeToConfirmStep(intensityOverlay!);
    if (typeResult === 'cancel') {
      removeOverlay(intensityOverlay!);
      return { decision: 'cancel', cancelledAtStep: currentStep, lastStep: currentStep };
    }
    // All intensity steps done for 'high' — clean up overlay.
    removeOverlay(intensityOverlay!);
  }

  if (intensity === 'extreme') {
    currentStep++;
    log(`Friction flow: starting math challenge step (step ${currentStep})`);
    const mathResult = await showMathChallengeStep(intensityOverlay!);
    if (mathResult === 'cancel') {
      removeOverlay(intensityOverlay!);
      return { decision: 'cancel', cancelledAtStep: currentStep, lastStep: currentStep };
    }
    currentStep++;
    log(`Friction flow: starting type-to-confirm step (step ${currentStep})`);
    const typeResult = await showTypeToConfirmStep(intensityOverlay!);
    if (typeResult === 'cancel') {
      removeOverlay(intensityOverlay!);
      return { decision: 'cancel', cancelledAtStep: currentStep, lastStep: currentStep };
    }
    // All intensity steps done for 'extreme' — clean up overlay.
    removeOverlay(intensityOverlay!);
  }

  // ── Standalone Delay Timer (final step) ──────────────────────────────
  if (settings.delayTimer?.enabled) {
    currentStep++;
    log(`Delay timer step starting (${settings.delayTimer.seconds}s, step ${currentStep})`);
    const delayDecision = await showDelayTimerStep(
      settings.delayTimer.seconds,
      attempt,
    );
    if (delayDecision === 'cancel') {
      log('Friction flow: cancelled at delay timer step');
      return { decision: 'cancel', cancelledAtStep: currentStep, lastStep: currentStep };
    }
  }

  return { decision: 'proceed', purchaseReason, lastStep: currentStep };
}
```

Key changes embedded in this replacement:
- New `let currentStep = 1;` counter at top.
- `priceWithTax`, `itemPool`, `intensity`, and `totalSteps` all computed up front so `totalSteps` is accurate.
- Comparison loop uses `currentStep++` before each iteration and passes `currentStep`/`totalSteps` to `showComparisonStep`.
- Every cancel return uses `cancelledAtStep: currentStep` instead of a hardcoded number.
- Delay-timer cancel now records `cancelledAtStep: currentStep` (was missing).
- Every return includes `lastStep: currentStep` (required by the new interface).
- Proceed return at the bottom includes `lastStep: currentStep`.

- [ ] **Step 4: Update the caller's cap-exceedance handler**

In `src/content/interceptor.ts`, find this block (around lines 2006-2019 — inside the function that handles a `frictionResult.decision === 'proceed'` case before the cap-exceedance check):

```typescript
      if (escalatedDecision === 'cancel') {
        log('User cancelled at cap exceedance step');
        await writeInterceptEvent({
          channel: attempt.channel,
          purchaseType: attempt.type,
          rawPrice: attempt.rawPrice,
          priceWithTax,
          outcome: 'cancelled',
          savedAmount: priceWithTax ?? 0,
          purchaseReason: frictionResult.purchaseReason,
        });
        pendingPurchase = null;
        return;
      }
```

Replace with:

```typescript
      if (escalatedDecision === 'cancel') {
        log('User cancelled at cap exceedance step');
        await writeInterceptEvent({
          channel: attempt.channel,
          purchaseType: attempt.type,
          rawPrice: attempt.rawPrice,
          priceWithTax,
          outcome: 'cancelled',
          cancelledAtStep: frictionResult.lastStep + 1,
          savedAmount: priceWithTax ?? 0,
          purchaseReason: frictionResult.purchaseReason,
        });
        pendingPurchase = null;
        return;
      }
```

The only change is the added `cancelledAtStep: frictionResult.lastStep + 1` line. Cap-exceedance is the step *after* the last friction window the user passed.

- [ ] **Step 5: Run the full test suite to confirm types compile and nothing regressed**

```bash
npm test
```

Expected: PASS — all tests still pass (no test was added for the integration; type-checking is performed by ts-jest).

- [ ] **Step 6: Run a production build to confirm webpack accepts the changes**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors.

If the build fails for non-TypeScript reasons (e.g., environment, file lock), do **not** retry — surface the failure to the user per CLAUDE.md.

- [ ] **Step 7: Commit**

```bash
git add src/content/interceptor.ts
git commit -m "fix(interceptor): correct cancelledAtStep recording with running counter

Replaces hardcoded step numbers in runFrictionFlow's intensity-gated
branches with a single running counter (currentStep) that increments
before each window. Also fixes two cancel paths that previously did not
record cancelledAtStep at all:

- Delay-timer cancel (was returning {decision: 'cancel'} with no step)
- Cap-exceedance cancel (was writing the InterceptEvent without the field)

Adds FrictionResult.lastStep so the cap-exceedance handler — which runs
in the caller after runFrictionFlow returns proceed — can record the
correct step number (lastStep + 1).

Spec: docs/superpowers/specs/2026-04-30-cancel-step-tracking-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Manual smoke test verification

This task is performed by the user in a real Chrome browser running the unpacked extension. No code changes happen here — but the plan must explicitly capture the verification before we ship.

The implementing engineer/agent should:

- [ ] **Step 1: Build the extension for development**

```bash
npm run build
```

Then load the `dist/` directory as an unpacked extension in Chrome (or refresh it if already loaded).

- [ ] **Step 2: Walk through the verification matrix**

For each scenario, configure settings via the options page, trigger the friction flow on a Twitch page (or via the demo overlay button), cancel at the indicated step, then open the spending history (`chrome-extension://<extension-id>/history.html`), expand the row, and confirm the displayed step number.

| # | Configuration | Cancel at | Expected `Cancelled at Step` |
| --- | --- | --- | --- |
| 1 | Any | Main overlay | `Step 1` |
| 2 | Low intensity, price detected, full friction with 3 enabled comparison items | Comparison item #2 | `Step 3` |
| 3 | Medium intensity, **zero-trust** mode, click a no-price button | Reason selection | `Step 2` |
| 4 | High intensity, price detected, full friction with 3 comparison items | Cooldown timer | `Step 6` |
| 5 | Extreme intensity, price detected, full friction with 3 comparison items | Math challenge | `Step 7` |
| 6 | Low intensity, no comparisons enabled, delay timer enabled | Delay timer | `Step 2` |
| 7 | Any intensity, daily cap configured to be exceeded by the test purchase, complete all friction | Cap-exceedance step | `Step (lastStep + 1)` (varies) |

For scenarios 6 and 7, before this fix the row would have **no** "Cancelled at Step" field in the detail panel. After this fix the field must appear with the expected number.

- [ ] **Step 3: Document any deviations**

If any scenario produces an unexpected number, capture:
- Settings used (intensity, comparison items enabled, delay timer state).
- Channel and purchase type.
- Where you cancelled.
- The number shown.

Surface to the user before proceeding to Task 4.

---

## Task 4: Update the project TODO

**File:**
- Modify: `docs/dev/HypeControl-TODO.md`

- [ ] **Step 1: Read the current file to find the right section**

```bash
head -40 docs/dev/HypeControl-TODO.md
```

Locate the header (which contains `Updated:` and `Current Version:` fields) and any "Bug Fixes" or recent-fixes section. If no bug-fixes section exists, add the entry under the most recently completed feature group with a clear "Bug Fixes" heading.

- [ ] **Step 2: Update the header date**

Set `Updated:` to `2026-04-30`. Do **not** change `Current Version:` — version bumps are out of scope.

- [ ] **Step 3: Add the bug-fix entry**

Add a new bullet under the appropriate bug-fixes section:

```markdown
- [x] **Cancel-step tracking fix (`fix/cancel-step-tracking`)** — `InterceptEvent.cancelledAtStep` now reflects the actual step where the user cancelled. Replaced hardcoded step numbers in `runFrictionFlow`'s intensity-gated branches with a running counter, and added recording on two cancel paths that previously dropped the field entirely (delay-timer cancel, cap-exceedance cancel). Spec: `docs/superpowers/specs/2026-04-30-cancel-step-tracking-design.md`.
```

- [ ] **Step 4: Update footer timestamp if present**

If the file ends with a timestamp like `_Last updated: YYYY-MM-DD_`, update it to `2026-04-30`.

- [ ] **Step 5: Commit**

```bash
git add docs/dev/HypeControl-TODO.md
git commit -m "docs(todo): record cancel-step tracking fix

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Checklist (for the implementer)

After all four tasks, verify:

- [ ] `npm test` passes with all new and existing tests green.
- [ ] `npm run build` succeeds without TypeScript errors.
- [ ] All seven manual smoke-test scenarios in Task 3 produce the expected step numbers.
- [ ] No version fields in `manifest.json`, `manifest.firefox.json`, or `package.json` were edited.
- [ ] Branch is `fix/cancel-step-tracking`. PR is opened against `main` but **not merged** without explicit user approval (per CLAUDE.md global rule).

## Out of scope (do not implement here)

- "Top Cancel Step" tile tie-breaker on `history.ts:223` — deferred to a follow-up PR pending observation of corrected data.
- "Step X of Y" headers on intensity-gated modals — those modals do not currently render a step counter; not adding new UI.
- Any change to `chatCommandInterceptor.ts` — it already reads `frictionResult.cancelledAtStep` correctly and benefits from the fix automatically.
- Version bumps and release builds — handled by the user via `npm run release` after the PR merges.
