# Friction Trigger Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do NOT bump versions — versioning is handled separately at the end.**

**Goal:** Add a "Friction Trigger Mode" setting (Price Guard / Zero Trust) that controls whether friction fires only on price-detected purchases or on all purchase buttons regardless of price.

**Architecture:** New `frictionTriggerMode` field on `UserSettings` with values `'price-guard'` (default) or `'zero-trust'`. `determineFrictionLevel()` branches on this field when `priceValue === null`. Zero Trust no-price overlays show rotating messages from a 16-message pool (two tonal buckets). The `runFrictionFlow()` early return on null price is conditioned so intensity steps still fire under Zero Trust.

**Tech Stack:** TypeScript, Chrome Extension MV3, webpack

---

### Task 1: Add `frictionTriggerMode` to types and settings

**Files:**
- Modify: `src/shared/types.ts:38` (FrictionTriggerMode type)
- Modify: `src/shared/types.ts:102-120` (UserSettings interface)
- Modify: `src/shared/types.ts:157-199` (DEFAULT_SETTINGS)
- Modify: `src/shared/types.ts:237-317` (migrateSettings)
- Modify: `src/shared/types.ts:383-488` (sanitizeSettings)

- [ ] **Step 1: Add the type alias and update UserSettings**

After line 38 (`export type FrictionLevel = 'none' | 'nudge' | 'full' | 'cap-bypass';`), add:

```typescript
/** Controls when friction triggers: price-detected only, or every purchase button */
export type FrictionTriggerMode = 'price-guard' | 'zero-trust';
```

Add to the `UserSettings` interface (after `frictionIntensity: FrictionIntensity;` at line 111):

```typescript
  frictionTriggerMode: FrictionTriggerMode;
```

Update the import at the top of `interceptor.ts` to include `FrictionTriggerMode`.

- [ ] **Step 2: Add default value**

In `DEFAULT_SETTINGS` (after `frictionIntensity: 'low',` at line 183):

```typescript
  frictionTriggerMode: 'price-guard',
```

- [ ] **Step 3: Add migration support**

In `migrateSettings()`, add after the `frictionIntensity` line (~line 299):

```typescript
    frictionTriggerMode: saved.frictionTriggerMode ?? DEFAULT_SETTINGS.frictionTriggerMode,
```

- [ ] **Step 4: Add sanitization**

In `sanitizeSettings()`, add after the `frictionIntensity` validation (~line 402):

```typescript
  const frictionTriggerMode = validEnum(s.frictionTriggerMode, ['price-guard', 'zero-trust'] as const, DEFAULT_SETTINGS.frictionTriggerMode);
```

And add `frictionTriggerMode,` to the returned object (after the `frictionIntensity,` line in the result object ~line 465).

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add frictionTriggerMode to UserSettings type and defaults"
```

---

### Task 2: Add rotating Zero Trust message pool to interceptor

**Files:**
- Modify: `src/content/interceptor.ts:1-18` (imports)
- Modify: `src/content/interceptor.ts` (new constant near top, after imports)

- [ ] **Step 1: Add message pool constant**

After the imports section (~line 18) and before the `FrictionResult` interface (~line 20), add:

```typescript
// ── Zero Trust no-price overlay messages ────────────────────────────────
// Two tonal buckets: matter-of-fact and cheeky. Selection alternates buckets
// with no back-to-back duplicates.

const ZERO_TRUST_MESSAGES_FACTUAL = [
  "No price detected. That doesn't mean it's free.",
  "We couldn't read a number. You're in Zero Trust — so we showed up anyway.",
  "Price? No idea. But you told us to stop you every time.",
  "Can't see what this costs. Can you?",
  "No price tag on this one. Zero Trust doesn't care.",
  "We don't know the price. That's exactly why we're here.",
  "Price not found. Zero Trust mode doesn't take days off.",
  "Unknown cost. Known impulse risk.",
];

const ZERO_TRUST_MESSAGES_CHEEKY = [
  "Zero Trust means zero exceptions. Even this one.",
  "No price tag? Suspicious.",
  "Flying blind on the cost. Good thing you brought a parachute.",
  "Couldn't find a price. Found you clicking though.",
  "The price is a mystery. Your spending habits are not.",
  "No number to crunch. Just a button to question.",
  "We can't tell you what this costs. We can tell you to think about it.",
  "Price unknown. Wallet concern: very known.",
];

let lastZeroTrustBucket: 'factual' | 'cheeky' | null = null;
let lastZeroTrustIndex: number = -1;

function pickZeroTrustMessage(): string {
  // Alternate buckets, avoiding back-to-back duplicates within a bucket
  const useBucket: 'factual' | 'cheeky' = lastZeroTrustBucket === 'factual' ? 'cheeky' : 'factual';
  const pool = useBucket === 'factual' ? ZERO_TRUST_MESSAGES_FACTUAL : ZERO_TRUST_MESSAGES_CHEEKY;

  let idx: number;
  do {
    idx = Math.floor(Math.random() * pool.length);
  } while (idx === lastZeroTrustIndex && pool.length > 1);

  lastZeroTrustBucket = useBucket;
  lastZeroTrustIndex = idx;
  return pool[idx];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/content/interceptor.ts
git commit -m "feat: add Zero Trust rotating message pool and picker"
```

---

### Task 3: Update `determineFrictionLevel()` to respect trigger mode

**Files:**
- Modify: `src/content/interceptor.ts:104-172` (determineFrictionLevel function)

- [ ] **Step 1: Move null-price check above thresholds-disabled check and add trigger mode branching**

The function already receives `settings: UserSettings`. Currently lines 151-155 have the thresholds-disabled check BEFORE the null-price check, which means thresholds-disabled would return `'full'` even for null-price Price Guard clicks. We need to reorder so null-price is checked first.

Replace lines 151-155 entirely. Current code:

```typescript
  if (!settings.frictionThresholds.enabled) {
    log('Thresholds disabled — defaulting to full modal');
    return 'full';
  }
  if (priceValue === null || priceValue <= 0) return 'full';
```

New code:

```typescript
  if (priceValue === null || priceValue <= 0) {
    if (settings.frictionTriggerMode === 'zero-trust') {
      log('No price detected — Zero Trust mode: full friction applied');
      return 'full';
    }
    log('No price detected — Price Guard mode: no friction applied');
    return 'none';
  }

  if (!settings.frictionThresholds.enabled) {
    log('Thresholds disabled — defaulting to full modal');
    return 'full';
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/content/interceptor.ts
git commit -m "feat: determineFrictionLevel respects frictionTriggerMode setting"
```

---

### Task 4: Update `showMainOverlay()` to use rotating messages for Zero Trust no-price

**Files:**
- Modify: `src/content/interceptor.ts:508-588` (showMainOverlay function)

- [ ] **Step 1: Replace static no-price copy with rotating message**

`showMainOverlay` already receives `settings: UserSettings`. Change lines 520-525 from:

```typescript
  let priceExtra = '';
  if (attempt.priceValue !== null && attempt.priceValue > 0) {
    priceExtra = buildCostBreakdown(attempt.priceValue, settings, tracker);
  } else {
    priceExtra = '<p class="hc-price-note">Unable to detect price. Proceed with caution.</p>';
  }
```

to:

```typescript
  let priceExtra = '';
  if (attempt.priceValue !== null && attempt.priceValue > 0) {
    priceExtra = buildCostBreakdown(attempt.priceValue, settings, tracker);
  } else {
    const noteEl = document.createElement('p');
    noteEl.className = 'hc-price-note';
    noteEl.textContent = settings.frictionTriggerMode === 'zero-trust'
      ? pickZeroTrustMessage()
      : 'Unable to detect price. Proceed with caution.';
    priceExtra = noteEl.outerHTML;
  }
```

Note: We use DOM construction + `textContent` to stay consistent with the project's XSS prevention rules, even though these are hardcoded strings. The pattern is the convention.

- [ ] **Step 2: Commit**

```bash
git add src/content/interceptor.ts
git commit -m "feat: Zero Trust no-price overlay shows rotating messages"
```

---

### Task 5: Fix `runFrictionFlow()` early return so intensity steps fire for Zero Trust no-price

**Files:**
- Modify: `src/content/interceptor.ts:1534-1542` (runFrictionFlow null-price early return)

- [ ] **Step 1: Condition the early return on Price Guard mode**

The current code at lines 1534-1542:

```typescript
  // Build comparison steps — only when price is detected
  const priceWithTax = (attempt.priceValue && attempt.priceValue > 0)
    ? Math.round(attempt.priceValue * (1 + settings.taxRate / 100) * 100) / 100
    : null;

  if (priceWithTax === null) {
    log('Friction flow: no price detected, skipping comparison steps');
    return { decision: 'proceed', purchaseReason };
  }
```

Change to:

```typescript
  // Build comparison steps — only when price is detected
  const priceWithTax = (attempt.priceValue && attempt.priceValue > 0)
    ? Math.round(attempt.priceValue * (1 + settings.taxRate / 100) * 100) / 100
    : null;

  if (priceWithTax === null) {
    log('Friction flow: no price detected, skipping comparison steps');
    // Price Guard would never reach here (determineFrictionLevel returns 'none').
    // Zero Trust continues to intensity steps below — fall through.
  }
```

- [ ] **Step 2: Guard comparison step loop against null price**

The comparison step code (lines 1544-1593) already uses `priceWithTax` to build comparisons. We need to wrap the comparison block so it only runs when `priceWithTax` is not null. The code immediately after the null check starts with:

```typescript
  // nudge: enabled items where scope is 'nudge' or 'both', limited to softNudgeSteps
  // full: enabled items where scope is 'full' or 'both' (scope replaces the old "all items" behavior)
  const itemPool = maxComparisons !== undefined
```

Wrap the entire comparison block (from `const itemPool` through the comparison step loop ending before `// ── Intensity-gated steps`) in a null check:

```typescript
  if (priceWithTax !== null) {
    // nudge: enabled items where scope is 'nudge' or 'both', limited to softNudgeSteps
    // full: enabled items where scope is 'full' or 'both'
    const itemPool = maxComparisons !== undefined
      ? settings.comparisonItems
          .filter(i => i.enabled && (i.frictionScope ?? 'both') !== 'full')
          .slice(0, maxComparisons)
      : settings.comparisonItems
          .filter(i => i.enabled && (i.frictionScope ?? 'both') !== 'nudge');
```

Read lines 1544-1593 to identify the exact end of the comparison block, then close the `if` brace before the intensity-gated steps comment. The comparison block ends just before the `// ── Intensity-gated steps` comment at line 1595. Add the closing `}` before that comment:

```typescript
  } // end if (priceWithTax !== null)

  // ── Intensity-gated steps ─────────────────────────────────────────────
```

- [ ] **Step 3: Commit**

```bash
git add src/content/interceptor.ts
git commit -m "feat: Zero Trust no-price overlays now run intensity steps"
```

---

### Task 6: Add trigger mode segmented control to popup HTML

**Files:**
- Modify: `src/popup/popup.html:147-165` (friction section, before intensity fieldset)

- [ ] **Step 1: Add the trigger mode control**

Insert the following BEFORE the existing intensity fieldset (before line 148 `<div class="hc-row">`  that contains `<fieldset class="hc-fieldset">` with `<legend class="hc-label">Intensity</legend>`):

```html
        <div class="hc-row">
          <fieldset class="hc-fieldset">
            <legend class="hc-label">Trigger Mode</legend>
            <div class="segmented" id="friction-trigger-mode" data-pending-field="frictionTriggerMode">
              <button class="seg-btn" data-value="price-guard">Price Guard</button>
              <button class="seg-btn" data-value="zero-trust">Zero Trust</button>
            </div>
          </fieldset>
        </div>
        <div class="trigger-mode-desc" id="trigger-mode-desc">
          <p class="hc-hint" id="trigger-mode-hint"></p>
        </div>
```

- [ ] **Step 2: Commit**

```bash
git add src/popup/popup.html
git commit -m "feat: add trigger mode segmented control to popup HTML"
```

---

### Task 7: Wire trigger mode control in friction section TypeScript

**Files:**
- Modify: `src/popup/sections/friction.ts:1-181`

- [ ] **Step 1: Update imports**

Change line 1 from:

```typescript
import { UserSettings, FrictionIntensity, DelayTimerConfig, FrictionThresholds, DEFAULT_SETTINGS } from '../../shared/types';
```

to:

```typescript
import { UserSettings, FrictionIntensity, FrictionTriggerMode, DelayTimerConfig, FrictionThresholds, DEFAULT_SETTINGS } from '../../shared/types';
```

- [ ] **Step 2: Add DOM references and wiring**

After line 33 (`const lockEl = ...`), add:

```typescript
  const triggerModeEl = el.querySelector<HTMLElement>('#friction-trigger-mode')!;
  const triggerModeDescEl = el.querySelector<HTMLElement>('#trigger-mode-hint')!;
```

Add the description text mapping and update function after the `renderSegmented` function (~line 47):

```typescript
  const TRIGGER_MODE_DESCRIPTIONS: Record<FrictionTriggerMode, string> = {
    'price-guard': "Friction triggers only when a price is detected. If we can't read the number, you walk.",
    'zero-trust': "Friction on every purchase button — price or not. You asked for this.",
  };

  function updateTriggerModeDesc(mode: FrictionTriggerMode): void {
    triggerModeDescEl.textContent = TRIGGER_MODE_DESCRIPTIONS[mode];
  }
```

- [ ] **Step 3: Add event listener for trigger mode buttons**

After the intensity segmented listener block (~after line 100), add:

```typescript
  // Trigger mode segmented
  triggerModeEl.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.value as FrictionTriggerMode;
      setPendingField('frictionTriggerMode', val);
      renderSegmented(triggerModeEl, val);
      updateTriggerModeDesc(val);
    });
  });
```

- [ ] **Step 4: Update render function**

In the `render` function (~line 163), after `renderSegmented(intensityEl, settings.frictionIntensity);` (line 168), add:

```typescript
    renderSegmented(triggerModeEl, settings.frictionTriggerMode);
    updateTriggerModeDesc(settings.frictionTriggerMode);
```

- [ ] **Step 5: Commit**

```bash
git add src/popup/sections/friction.ts
git commit -m "feat: wire trigger mode segmented control with descriptions"
```

---

### Task 8: Add CSS for trigger mode description hint

**Files:**
- Identify the CSS file used by the popup (likely `src/popup/popup.css` or a shared CSS file)

- [ ] **Step 1: Find and read the popup CSS file**

Check `src/popup/popup.css` for existing `.hc-hint` styles. If `.hc-hint` already exists, no new CSS is needed — the description text will inherit the existing hint styling.

If `.hc-hint` does NOT exist, add to the popup CSS:

```css
.trigger-mode-desc {
  padding: 0 0 4px;
}

.hc-hint {
  font-size: 0.8rem;
  opacity: 0.7;
  margin: 2px 0 0;
  line-height: 1.4;
}
```

If `.hc-hint` already exists, just add the `.trigger-mode-desc` wrapper style if needed for spacing.

- [ ] **Step 2: Commit (if changes were needed)**

```bash
git add src/popup/popup.css
git commit -m "maint: add trigger mode description hint styles"
```

---

### Task 9: Update docs

**Files:**
- Modify: `docs/dev/HypeControl-TODO.md`
- Modify: `docs/dev/HC-Project-Document.md`

- [ ] **Step 1: Update HypeControl-TODO.md**

Update the header:
- Set `Updated:` to `2026-04-13`
- Bump `Current Version:` to the new version (after version bump)

Add a new completed item in the appropriate section:

```markdown
| Friction Trigger Mode (Price Guard / Zero Trust) | ✅ Complete |
```

- [ ] **Step 2: Update HC-Project-Document.md**

Find the section describing the friction/overlay system and add a note about trigger modes:

```markdown
**Friction Trigger Mode:** Users choose between Price Guard (friction only when price detected — default) and Zero Trust (friction on every purchase button regardless of price detection, with rotating contextual messages).
```

- [ ] **Step 3: Commit**

```bash
git add docs/dev/HypeControl-TODO.md docs/dev/HC-Project-Document.md
git commit -m "maint: update project docs for friction trigger mode feature"
```

---

### Task 10: Version bump and build

**Files:**
- Modify: `manifest.json` (version field)
- Modify: `package.json` (version field)

- [ ] **Step 1: Bump patch version in both files**

Increment the patch version (e.g., `1.0.2` → `1.0.3`) in both `manifest.json` and `package.json`.

- [ ] **Step 2: Run build**

```bash
npm run build
```

If the build fails, stop and tell the user to run `npm run build` manually.

- [ ] **Step 3: Commit**

```bash
git add manifest.json package.json
git commit -m "maint: bump to v1.0.3 for friction trigger mode feature"
```

---

## Task Dependency Summary

```
Task 1 (types) → Task 2 (message pool) → Task 3 (determineFrictionLevel)
                                        → Task 4 (overlay messages)
                                        → Task 5 (runFrictionFlow fix)
Task 1 (types) → Task 6 (popup HTML) → Task 7 (friction.ts wiring) → Task 8 (CSS)
Tasks 3-8 all complete → Task 9 (docs) → Task 10 (version bump + build)
```

Tasks 2-5 (interceptor changes) and Tasks 6-8 (UI changes) can run in parallel after Task 1 completes, since they touch different files.
