# Quick Wins Bundle Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three small independent features — a post-friction delay timer, whitelist quick-add from the overlay, and per-item comparison scope assignment (nudge vs full).

**Architecture:** Each feature is self-contained. All three share one `types.ts` update pass. The delay timer is a new step at the end of `runFrictionFlow`. The whitelist quick-add adds a button + inline selector to the existing main overlay. The comparison scope adds a subordinate control per item in the options list and a filter update in the interceptor.

**Dependency note:** This plan assumes the MVP completion plan (`2026-03-10-mvp-completion.md`) has been implemented. Specifically, `runFrictionFlow` is expected to return `FrictionResult` (not `OverlayDecision`) and the `FrictionIntensity` type already exists in `types.ts`. If MVP plan is not yet implemented, the delay timer step must return `OverlayDecision` and be wired accordingly — adjust Task 3 as needed.

**Tech Stack:** TypeScript, webpack, Chrome Extension Manifest V3, `chrome.storage.sync` (settings), no external UI libraries.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/shared/types.ts` | Modify | Add `DelayTimerConfig`, `frictionScope` to `ComparisonItem`, `delayTimer` to `UserSettings`; update defaults + migration |
| `src/content/interceptor.ts` | Modify | Add `showDelayTimerStep()`; call at end of `runFrictionFlow`; add whitelist quick-add button + inline selector to `showMainOverlay` |
| `src/options/options.html` | Modify | Add Delay Timer section; add scope segmented control per comparison item |
| `src/options/options.ts` | Modify | Load/save `delayTimer`; wire delay timer controls; render + wire scope controls per item; save scope on change |

---

## Chunk 1: Data Types

### Task 1: Update types.ts for all three features

**Files:**
- Modify: `src/shared/types.ts`

**Context:** All three features need new fields. Doing this in one pass avoids repeated migrations. The `ComparisonItem` interface needs `frictionScope`. `UserSettings` needs `delayTimer`. Migration defaults must preserve existing behavior exactly.

- [ ] **Step 1: Add DelayTimerConfig interface**

After the `DailyCapConfig` interface (around line 56), add:

```typescript
/** Standalone delay timer shown as the final step before purchase fires */
export interface DelayTimerConfig {
  enabled: boolean;
  seconds: 5 | 10 | 30 | 60;
}
```

- [ ] **Step 2: Add frictionScope to ComparisonItem**

In the `ComparisonItem` interface, add:

```typescript
export interface ComparisonItem {
  id: string;
  emoji: string;
  name: string;
  price: number;
  pluralLabel: string;
  enabled: boolean;
  isPreset: boolean;
  frictionScope: 'nudge' | 'full' | 'both';  // ← add this
}
```

- [ ] **Step 3: Add delayTimer to UserSettings**

In the `UserSettings` interface, add after `frictionThresholds`:

```typescript
delayTimer: DelayTimerConfig;
```

- [ ] **Step 4: Update PRESET_COMPARISON_ITEMS**

Add `frictionScope: 'both'` to every preset item in `PRESET_COMPARISON_ITEMS`:

```typescript
export const PRESET_COMPARISON_ITEMS: ComparisonItem[] = [
  {
    id: 'preset-chicken',
    emoji: '\u{1F357}',
    name: 'Costco Rotisserie Chicken',
    price: 4.99,
    pluralLabel: 'Costco chickens',
    enabled: true,
    isPreset: true,
    frictionScope: 'both',   // ← add to each preset
  },
  // ... same for hotdog and galleyboy
];
```

- [ ] **Step 5: Update DEFAULT_SETTINGS**

Add `delayTimer` to `DEFAULT_SETTINGS`:

```typescript
delayTimer: {
  enabled: false,
  seconds: 10,
},
```

- [ ] **Step 6: Update migrateSettings()**

In the `migrateSettings()` return statement, add:

```typescript
delayTimer: {
  ...DEFAULT_SETTINGS.delayTimer,
  ...(saved.delayTimer || {}),
},
```

Also update the `comparisonItems` migration to backfill `frictionScope` on existing saved items. Find the section that filters/deduplicates items and add after it:

```typescript
// Backfill frictionScope for items saved before this field existed
items = items.map(i => ({
  ...i,
  frictionScope: i.frictionScope ?? 'both',
}));
```

- [ ] **Step 7: Build to verify no type errors**

Run: `npm run build`
Expected: TypeScript errors will appear anywhere `ComparisonItem` is constructed without `frictionScope`. Fix each by adding `frictionScope: 'both'` (or the appropriate value). Most likely locations: any test fixtures, custom item creation in `options.ts` (when a user adds a new item).

In `options.ts`, find where new custom items are created (look for `id: crypto.randomUUID()` or similar) and add `frictionScope: 'both'` to the new item object.

- [ ] **Step 8: Commit**

```bash
git add src/shared/types.ts src/options/options.ts
git commit -m "feat: add DelayTimerConfig, frictionScope to ComparisonItem, delayTimer to UserSettings"
```

---

## Chunk 2: Delay Timer

### Task 2: Add Delay Timer section to options page

**Files:**
- Modify: `src/options/options.html`
- Modify: `src/options/options.ts`

**Context:** The options page uses toggle + subsection pattern (see `toggleSubsection()` in `options.ts`). The delay timer section follows the same pattern as the Cooldown section.

- [ ] **Step 1: Add Delay Timer HTML section to options.html**

Find a logical place in the options page (near the Cooldown section or Friction section). Add:

```html
<div class="section">
  <h3 class="section-title">Delay Timer</h3>
  <div class="setting-row">
    <label class="setting-label" for="delay-timer-enabled">Enable delay timer</label>
    <p class="setting-hint">Shows a countdown timer as the final step before any purchase fires. Runs after all friction steps complete.</p>
    <label class="toggle-switch">
      <input type="checkbox" id="delay-timer-enabled">
      <span class="toggle-slider"></span>
    </label>
  </div>
  <div id="delay-timer-subsection" style="display:none">
    <div class="setting-row">
      <label class="setting-label">Timer duration</label>
      <div class="intensity-group" id="delay-timer-group" role="radiogroup" aria-label="Delay timer duration">
        <button class="intensity-btn" data-delay="5"  aria-pressed="false">5s</button>
        <button class="intensity-btn" data-delay="10" aria-pressed="false">10s</button>
        <button class="intensity-btn" data-delay="30" aria-pressed="false">30s</button>
        <button class="intensity-btn" data-delay="60" aria-pressed="false">60s</button>
      </div>
    </div>
  </div>
</div>
```

Note: The `.intensity-group` and `.intensity-btn` CSS classes were added in the MVP completion plan. If those styles don't exist yet, add them to the options.html `<style>` block (copy from the MVP plan's friction intensity section).

- [ ] **Step 2: Wire delay timer controls in options.ts**

Add these functions to `options.ts`:

```typescript
function setDelayTimerDurationUI(seconds: number): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('#delay-timer-group .intensity-btn');
  buttons.forEach(btn => {
    btn.setAttribute('aria-pressed', btn.dataset.delay === String(seconds) ? 'true' : 'false');
  });
}

function wireDelayTimerControls(): void {
  const enabledEl = document.getElementById('delay-timer-enabled') as HTMLInputElement | null;
  const group = document.getElementById('delay-timer-group');

  enabledEl?.addEventListener('change', async () => {
    toggleSubsection('delay-timer-subsection', enabledEl.checked);
    if (cachedSettings) {
      cachedSettings.delayTimer.enabled = enabledEl.checked;
      await saveSettings(cachedSettings);
      settingsLog('Delay timer enabled changed', { enabled: enabledEl.checked });
    }
  });

  group?.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.intensity-btn');
    if (!btn || !btn.dataset.delay) return;
    const seconds = parseInt(btn.dataset.delay, 10) as 5 | 10 | 30 | 60;
    setDelayTimerDurationUI(seconds);
    if (cachedSettings) {
      cachedSettings.delayTimer.seconds = seconds;
      await saveSettings(cachedSettings);
      settingsLog('Delay timer duration changed', { seconds });
    }
  });
}
```

- [ ] **Step 3: Populate delay timer fields during form load**

Find the function that populates the form with saved settings (where `hourlyRate`, cooldown, etc. are set from storage). Add:

```typescript
// Delay Timer
const delayEnabledEl = document.getElementById('delay-timer-enabled') as HTMLInputElement | null;
if (delayEnabledEl) {
  delayEnabledEl.checked = settings.delayTimer.enabled;
  toggleSubsection('delay-timer-subsection', settings.delayTimer.enabled);
}
setDelayTimerDurationUI(settings.delayTimer.seconds);
```

- [ ] **Step 4: Call wireDelayTimerControls() in DOMContentLoaded**

In the `DOMContentLoaded` init block (where other `wire*` functions are called), add:

```typescript
wireDelayTimerControls();
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: Build completes.

- [ ] **Step 6: Commit**

```bash
git add src/options/options.html src/options/options.ts
git commit -m "feat: add delay timer settings UI to options page"
```

---

### Task 3: Add showDelayTimerStep() to interceptor and wire into runFrictionFlow

**Files:**
- Modify: `src/content/interceptor.ts`

**Context:** The delay timer runs as the absolute final step in `runFrictionFlow`, after all intensity steps (reason-selection, cooldown, type-to-confirm, math) have been passed. If the user cancels during the delay timer, the purchase is blocked. This function follows the same pattern as `showFrictionCooldownStep()` from the MVP plan.

- [ ] **Step 1: Add showDelayTimerStep() function**

Add after the `showMathChallengeStep` function (or after `showCooldownBlock` if MVP plan not implemented):

```typescript
// ── Overlay: Standalone Delay Timer Step ───────────────────────────────

async function showDelayTimerStep(
  durationSeconds: number,
  stepNumber: number,
  totalSteps: number,
  attempt: PurchaseAttempt,
): Promise<OverlayDecision> {
  if (overlayVisible) return 'cancel';
  overlayVisible = true;

  const overlay = document.createElement('div');
  overlay.id = 'hc-overlay';
  overlay.className = 'hc-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'hc-overlay-heading');
  overlay.setAttribute('aria-describedby', 'hc-overlay-desc');
  overlay.innerHTML = `
    <div class="hc-modal">
      <div class="hc-header">
        <span class="hc-icon">⏱️</span>
        <h2 class="hc-title" id="hc-overlay-heading">FINAL STEP — ${stepNumber} OF ${totalSteps}</h2>
      </div>
      <div class="hc-content" id="hc-overlay-desc" style="text-align: center;">
        <p class="hc-label">Last chance to reconsider.</p>
        <p class="hc-message">Waiting ${durationSeconds} seconds before this purchase goes through.</p>
        <div class="hc-progress-wrap">
          <div class="hc-progress-bar" id="hc-delay-progress"></div>
        </div>
        <p class="hc-countdown" id="hc-delay-countdown">${durationSeconds}s remaining</p>
      </div>
      <div class="hc-actions">
        <button class="hc-btn hc-btn-cancel" data-action="cancel">Cancel Purchase</button>
        <button class="hc-btn hc-btn-proceed" data-action="proceed" disabled aria-disabled="true" style="opacity: 0.4; cursor: not-allowed;">
          Waiting...
        </button>
      </div>
    </div>
  `;

  log(`Delay timer step (${durationSeconds}s) started`, { channel: attempt.channel });

  return new Promise((resolve) => {
    let resolved = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const previousFocus = document.activeElement as HTMLElement | null;
    const expiresAt = Date.now() + durationSeconds * 1000;

    const finish = (decision: OverlayDecision) => {
      if (resolved) return;
      resolved = true;
      if (intervalId !== null) clearInterval(intervalId);
      document.removeEventListener('keydown', handleKeydown);
      removeOverlay(overlay);
      previousFocus?.focus();
      resolve(decision);
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { finish('cancel'); return; }
      if (e.key === 'Tab') {
        const focusable = Array.from(
          overlay.querySelectorAll<HTMLButtonElement>('.hc-btn:not([disabled])')
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKeydown);

    overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => finish('cancel'));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish('cancel'); });

    const progressEl = overlay.querySelector('#hc-delay-progress') as HTMLElement | null;
    const countdownEl = overlay.querySelector('#hc-delay-countdown') as HTMLElement | null;
    const proceedBtn = overlay.querySelector('[data-action="proceed"]') as HTMLButtonElement | null;

    intervalId = setInterval(() => {
      const left = expiresAt - Date.now();
      const elapsed = durationSeconds * 1000 - left;
      const pct = Math.min(100, (elapsed / (durationSeconds * 1000)) * 100);
      if (progressEl) progressEl.style.width = `${pct}%`;

      if (left <= 0) {
        if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
        if (countdownEl) countdownEl.textContent = 'Time\'s up — purchase ready to proceed';
        if (proceedBtn) {
          proceedBtn.disabled = false;
          proceedBtn.removeAttribute('aria-disabled');
          proceedBtn.style.opacity = '';
          proceedBtn.style.cursor = '';
          proceedBtn.textContent = 'Proceed';
          proceedBtn.addEventListener('click', () => finish('proceed'));
          proceedBtn.focus();
        }
        return;
      }

      const sec = Math.ceil(left / 1000);
      if (countdownEl) countdownEl.textContent = `${sec}s remaining`;
    }, 100);

    applyThemeToOverlay(overlay);
    document.body.appendChild(overlay);
    (overlay.querySelector('[data-action="cancel"]') as HTMLButtonElement)?.focus();
  });
}
```

- [ ] **Step 2: Wire delay timer into runFrictionFlow**

**If MVP plan is implemented:** At the very end of `runFrictionFlow`, just before the final `return { decision: 'proceed', purchaseReason };`, add:

```typescript
  // ── Standalone Delay Timer (final step) ──────────────────────────────
  if (settings.delayTimer?.enabled) {
    const delayStepNum = grandTotal + 1;
    const delayTotal = grandTotal + 1;
    log(`Delay timer step starting (${settings.delayTimer.seconds}s)`);
    const delayDecision = await showDelayTimerStep(
      settings.delayTimer.seconds,
      delayStepNum,
      delayTotal,
      attempt,
    );
    if (delayDecision === 'cancel') {
      log('Friction flow: cancelled at delay timer step');
      return { decision: 'cancel', cancelledAtStep: delayStepNum, purchaseReason };
    }
  }
```

**If MVP plan is NOT yet implemented:** Add before the final `return 'proceed';` in the current `runFrictionFlow`, and adjust `totalSteps` similarly.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Build completes without errors.

- [ ] **Step 4: Manual verification**

Reload extension. Enable delay timer in options (set to 5s for testing). Go to Twitch, trigger a purchase, proceed through the friction flow. Verify:
- Delay timer modal appears as the final step
- Progress bar fills over 5 seconds
- Proceed button is disabled until timer completes, then enables
- Cancelling the timer blocks the purchase
- Proceeding after timer fires the purchase

Disable delay timer. Verify the timer step no longer appears.

- [ ] **Step 5: Commit**

```bash
git add src/content/interceptor.ts
git commit -m "feat: add standalone delay timer as final friction step"
```

---

## Chunk 3: Whitelist Quick-Add

### Task 4: Add "Remember this channel" to the main overlay

**Files:**
- Modify: `src/content/interceptor.ts`

**Context:** The main overlay (`showMainOverlay`) currently takes `attempt`, `settings`, `tracker`, and optional `whitelistNote`. To support quick-add, it needs a callback for when the user picks a whitelist behavior. Pass an optional `onWhitelistAdd` callback; if provided, the button is shown.

The callback is defined in `handleClick` (where `settings` is in scope) and does the actual save to `chrome.storage.sync`.

- [ ] **Step 1: Update showMainOverlay signature**

Change the `showMainOverlay` function signature to accept an optional callback:

```typescript
async function showMainOverlay(
  attempt: PurchaseAttempt,
  settings: UserSettings,
  tracker: SpendingTracker,
  whitelistNote?: string,
  onWhitelistAdd?: (behavior: WhitelistBehavior) => Promise<void>,
): Promise<OverlayDecision> {
```

Ensure `WhitelistBehavior` is imported — it already is in the existing imports from `'../shared/types'`.

- [ ] **Step 2: Add "Remember this channel" button to the overlay HTML**

In `showMainOverlay`, find the overlay HTML and add the button below the `.hc-actions` div:

```typescript
  const quickAddBtn = onWhitelistAdd
    ? `<div class="hc-quick-add-wrap">
         <button class="hc-btn-text" id="hc-quick-add-btn">
           ⭐ Remember this channel
         </button>
       </div>`
    : '';

  overlay.innerHTML = `
    <div class="hc-modal">
      ...existing content...
      <div class="hc-actions">
        <button class="hc-btn hc-btn-cancel" data-action="cancel">Cancel</button>
        <button class="hc-btn hc-btn-proceed" data-action="proceed">Proceed Anyway</button>
      </div>
      ${quickAddBtn}
    </div>
  `;
```

- [ ] **Step 3: Add CSS for the quick-add button and inline selector**

In `src/content/styles.css`, add:

```css
.hc-quick-add-wrap {
  text-align: center;
  padding: 8px 0 4px;
  border-top: 1px solid var(--hc-border, #3d3d42);
  margin-top: 4px;
}

.hc-btn-text {
  background: none;
  border: none;
  color: var(--hc-text-muted, #adadb8);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
}

.hc-btn-text:hover {
  color: var(--hc-text, #efeff1);
  background: var(--hc-border, #3d3d42);
}

.hc-whitelist-selector {
  padding: 12px 0 4px;
  border-top: 1px solid var(--hc-border, #3d3d42);
  margin-top: 4px;
}

.hc-whitelist-selector-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--hc-text, #efeff1);
}

.hc-whitelist-warning {
  background: rgba(255, 165, 0, 0.15);
  border: 1px solid rgba(255, 165, 0, 0.4);
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 12px;
  color: #ffa500;
  margin-bottom: 8px;
}

.hc-whitelist-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hc-whitelist-option {
  display: flex;
  flex-direction: column;
  padding: 8px 10px;
  border: 1px solid var(--hc-border, #3d3d42);
  border-radius: 4px;
  cursor: pointer;
  background: var(--hc-bg, #18181b);
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
}

.hc-whitelist-option:hover {
  border-color: #9147ff;
  background: rgba(145, 71, 255, 0.1);
}

.hc-whitelist-option-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--hc-text, #efeff1);
}

.hc-whitelist-option-desc {
  font-size: 11px;
  color: var(--hc-text-muted, #adadb8);
  margin-top: 2px;
}
```

- [ ] **Step 4: Wire the quick-add button logic in showMainOverlay**

After `document.body.appendChild(overlay)` (at the end of `showModalPromise` setup), add a handler for the quick-add button. Do this INSIDE `showMainOverlay`, after calling `showModalPromise` but before returning — actually, wire it directly after building the overlay, before calling `showModalPromise`:

Replace the final lines of `showMainOverlay`:

```typescript
  log('Step 1 — Main overlay shown:', { ... });
  return showModalPromise(overlay, { type: attempt.type, rawPrice: attempt.rawPrice });
```

With:

```typescript
  log('Step 1 — Main overlay shown:', {
    type: attempt.type,
    rawPrice: attempt.rawPrice,
    priceValue: attempt.priceValue,
    channel: attempt.channel,
  });

  // Wire quick-add button if callback provided
  if (onWhitelistAdd) {
    const quickAddBtnEl = overlay.querySelector('#hc-quick-add-btn') as HTMLButtonElement | null;
    quickAddBtnEl?.addEventListener('click', () => {
      showWhitelistSelector(overlay, attempt.channel, settings, onWhitelistAdd);
    });
  }

  return showModalPromise(overlay, { type: attempt.type, rawPrice: attempt.rawPrice });
```

- [ ] **Step 5: Add showWhitelistSelector() helper**

Add this function just before `showMainOverlay`:

```typescript
/** Behavior descriptions for the whitelist quick-add selector */
const WHITELIST_BEHAVIOR_LABELS: Record<WhitelistBehavior, { name: string; desc: string }> = {
  skip:    { name: 'Skip',    desc: 'No friction, silently logged' },
  reduced: { name: 'Reduced', desc: 'Toast notification only' },
  full:    { name: 'Full',    desc: 'Full friction flow with a whitelist note' },
};

/**
 * Replaces the bottom of the main overlay with an inline whitelist behavior selector.
 * Called when user clicks "Remember this channel".
 */
function showWhitelistSelector(
  overlay: HTMLElement,
  channel: string,
  settings: UserSettings,
  onConfirm: (behavior: WhitelistBehavior) => Promise<void>,
): void {
  const existingEntry = settings.whitelistedChannels.find(
    e => e.username === channel.trim().toLowerCase()
  );

  const warningHTML = existingEntry
    ? `<div class="hc-whitelist-warning">
         ⚠️ Already whitelisted as <strong>${existingEntry.behavior}</strong>. Selecting a new behavior will update it.
       </div>`
    : '';

  const optionsHTML = (['skip', 'reduced', 'full'] as WhitelistBehavior[]).map(behavior => {
    const { name, desc } = WHITELIST_BEHAVIOR_LABELS[behavior];
    const selected = existingEntry?.behavior === behavior ? ' style="border-color: #9147ff;"' : '';
    return `
      <button class="hc-whitelist-option" data-behavior="${behavior}"${selected}>
        <span class="hc-whitelist-option-name">${name}</span>
        <span class="hc-whitelist-option-desc">${desc}</span>
      </button>
    `;
  }).join('');

  const selectorHTML = `
    <div class="hc-whitelist-selector">
      <p class="hc-whitelist-selector-title">Remember <strong>${channel}</strong> as:</p>
      ${warningHTML}
      <div class="hc-whitelist-options">
        ${optionsHTML}
      </div>
    </div>
  `;

  // Replace the quick-add wrap with the selector
  const wrap = overlay.querySelector('.hc-quick-add-wrap');
  if (wrap) wrap.outerHTML = selectorHTML;

  // Wire behavior buttons — they're now in the overlay
  overlay.querySelectorAll<HTMLButtonElement>('[data-behavior]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const behavior = btn.dataset.behavior as WhitelistBehavior;
      log(`Whitelist quick-add: ${channel} → ${behavior}`);
      await onConfirm(behavior);
    });
  });
}
```

- [ ] **Step 6: Define onWhitelistAdd callback in handleClick and pass it to runFrictionFlow**

In `handleClick`, before the `runFrictionFlow` call, define the callback:

```typescript
  const onWhitelistAdd = async (behavior: WhitelistBehavior): Promise<void> => {
    const normalized = attempt.channel.trim().toLowerCase();
    const existing = settings.whitelistedChannels.findIndex(e => e.username === normalized);
    const newEntry: WhitelistEntry = { username: normalized, behavior };
    if (existing >= 0) {
      settings.whitelistedChannels[existing] = newEntry;
    } else {
      settings.whitelistedChannels.push(newEntry);
    }
    await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
    log(`Whitelist quick-add saved: ${normalized} → ${behavior}`);
  };
```

- [ ] **Step 7: Pass onWhitelistAdd into runFrictionFlow**

Update the `runFrictionFlow` signature to accept the callback:

```typescript
async function runFrictionFlow(
  attempt: PurchaseAttempt,
  settings: UserSettings,
  tracker: SpendingTracker,
  maxComparisons?: number,
  whitelistNote?: string,
  frictionIntensity?: FrictionIntensity,    // from MVP plan (or omit if not implemented)
  onWhitelistAdd?: (behavior: WhitelistBehavior) => Promise<void>,
): Promise<FrictionResult> {  // or Promise<OverlayDecision> if MVP not implemented
```

Update the `showMainOverlay` call inside `runFrictionFlow`:

```typescript
  const mainDecision = await showMainOverlay(attempt, settings, tracker, whitelistNote, onWhitelistAdd);
```

Update the call site in `handleClick`:

```typescript
  const frictionResult = await runFrictionFlow(
    attempt, settings, tracker, maxComparisons, whitelistNote,
    settings.frictionIntensity,   // omit if MVP not implemented
    onWhitelistAdd,
  );
```

- [ ] **Step 8: Build**

Run: `npm run build`
Expected: Build completes without errors.

- [ ] **Step 9: Manual verification**

Reload extension. Go to Twitch. Trigger a friction overlay. Verify:
- "⭐ Remember this channel" button appears below Cancel/Proceed
- Clicking it replaces the button with the inline behavior selector
- Selecting a behavior saves to the whitelist (check options page → Channel Whitelist)
- After confirming, overlay dismisses and purchase proceeds
- Trigger again on the same channel — verify the "already whitelisted" warning appears with current behavior pre-highlighted

- [ ] **Step 10: Commit**

```bash
git add src/content/interceptor.ts src/content/styles.css
git commit -m "feat: add whitelist quick-add button to main friction overlay"
```

---

## Chunk 4: Comparison Scope Assignment

### Task 5: Add scope control to comparison items in options page

**Files:**
- Modify: `src/options/options.ts`
- Modify: `src/options/options.html`

**Context:** `renderComparisonItems()` in `options.ts` builds each item row. Add a subordinate scope control (3 buttons: Nudge / Full / Both) below the enabled toggle, visible only when the item is enabled.

- [ ] **Step 1: Add scope control CSS to options.html**

In the `<style>` block, add:

```css
.scope-group {
  display: flex;
  gap: 3px;
  margin-top: 4px;
}

.scope-btn {
  background: var(--opt-bg-inset);
  color: var(--opt-text-muted);
  border: 1px solid var(--opt-border);
  border-radius: 3px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.scope-btn:hover {
  background: var(--opt-border);
  color: var(--opt-text);
}

.scope-btn[aria-pressed="true"] {
  background: #9147ff;
  color: #fff;
  border-color: #9147ff;
}

.item-toggle-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}
```

- [ ] **Step 2: Update renderComparisonItems() to include scope control**

In `options.ts`, find `renderComparisonItems()`. Update the `row.innerHTML` assignment to include the scope control:

```typescript
    const scopeGroup = item.enabled ? `
      <div class="scope-group" data-scope-group="${item.id}" role="radiogroup" aria-label="Friction scope for ${item.name}">
        <button class="scope-btn" data-scope="nudge" aria-pressed="${item.frictionScope === 'nudge' ? 'true' : 'false'}">Nudge</button>
        <button class="scope-btn" data-scope="full"  aria-pressed="${item.frictionScope === 'full'  ? 'true' : 'false'}">Full</button>
        <button class="scope-btn" data-scope="both"  aria-pressed="${item.frictionScope === 'both'  ? 'true' : 'false'}">Both</button>
      </div>
    ` : '';

    row.innerHTML = `
      <span class="drag-handle" title="Drag to reorder">&#x2261;</span>
      <div class="item-toggle-wrap">
        <label class="toggle-switch">
          <input type="checkbox" data-item-id="${item.id}" ${item.enabled ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
        ${scopeGroup}
      </div>
      <span class="comparison-item-info">
        <span>${item.emoji}</span>
        <span>${item.name}</span>
        <span class="toggle-price">${priceText}</span>
      </span>
      ${customControls}
    `;
```

- [ ] **Step 3: Wire scope button clicks**

After `renderComparisonItems` renders all rows, add an event listener on the container for scope button clicks. Find where comparison item checkbox changes are handled (the section that handles `data-item-id`) and add scope handling alongside it.

In the section of `options.ts` that handles the comparison items list event delegation (look for `data-item-id` checkbox change handler), add scope button handling:

```typescript
// Scope button click
if ((e.target as HTMLElement).closest('.scope-btn')) {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.scope-btn')!;
  const scopeGroup = btn.closest<HTMLElement>('[data-scope-group]')!;
  const itemId = scopeGroup.dataset.scopeGroup!;
  const scope = btn.dataset.scope as 'nudge' | 'full' | 'both';

  // Update UI
  scopeGroup.querySelectorAll<HTMLButtonElement>('.scope-btn').forEach(b => {
    b.setAttribute('aria-pressed', b.dataset.scope === scope ? 'true' : 'false');
  });

  // Persist
  if (cachedSettings) {
    const item = cachedSettings.comparisonItems.find(i => i.id === itemId);
    if (item) {
      item.frictionScope = scope;
      await saveSettings(cachedSettings);
      settingsLog('Comparison item scope changed', { itemId, scope });
    }
  }
}
```

- [ ] **Step 4: Show/hide scope control when toggle changes**

When a comparison item's enabled checkbox is toggled, re-render the scope group. Find the existing `data-item-id` checkbox change handler and update it:

After saving the enabled state, re-render the scope group for that item:

```typescript
// After saving the item's enabled state:
const scopeGroup = document.querySelector<HTMLElement>(`[data-scope-group="${itemId}"]`);
if (scopeGroup) {
  scopeGroup.style.display = isEnabled ? 'flex' : 'none';
} else if (isEnabled && cachedSettings) {
  // Re-render to show scope group (it wasn't in DOM when item was disabled)
  renderComparisonItems(cachedSettings.comparisonItems);
}
```

Actually, the cleaner approach: instead of toggling display, just call `renderComparisonItems(cachedSettings.comparisonItems)` after the toggle save. This re-renders the full list with the correct scope group visibility. Since this is already the pattern used elsewhere (the list is re-rendered on various events), this is consistent.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: Build completes.

- [ ] **Step 6: Manual verification**

Open options page. Verify:
- Each enabled comparison item shows Nudge / Full / Both buttons below its toggle
- Disabled items don't show scope buttons
- Clicking a scope button highlights it (purple) and the others deselect
- Disabling an item hides its scope buttons
- Re-enabling shows them again with the previously saved scope
- Settings persist after page reload

- [ ] **Step 7: Commit**

```bash
git add src/options/options.ts src/options/options.html
git commit -m "feat: add nudge/full/both scope selector to comparison items"
```

---

### Task 6: Update item pool filter in interceptor for scope

**Files:**
- Modify: `src/content/interceptor.ts`

**Context:** `runFrictionFlow` builds item pools for nudge and full tiers. Update the filter to respect `frictionScope`. Default `'both'` if the field is missing (safety for old data).

- [ ] **Step 1: Update item pool logic in runFrictionFlow**

Find this section in `runFrictionFlow`:

```typescript
  // nudge: enabled items only, limited to softNudgeSteps
  // full: ALL items regardless of enabled state (maximum penalty — cannot be reduced by disabling items)
  const itemPool = maxComparisons !== undefined
    ? settings.comparisonItems.filter(i => i.enabled).slice(0, maxComparisons)
    : settings.comparisonItems;
```

Replace with:

```typescript
  // nudge: enabled items where scope is 'nudge' or 'both', limited to softNudgeSteps
  // full: enabled items where scope is 'full' or 'both' (scope replaces the old "all items" behavior)
  const itemPool = maxComparisons !== undefined
    ? settings.comparisonItems
        .filter(i => i.enabled && (i.frictionScope ?? 'both') !== 'full')
        .slice(0, maxComparisons)
    : settings.comparisonItems
        .filter(i => i.enabled && (i.frictionScope ?? 'both') !== 'nudge');
```

**Note on behavior change for full tier:** Previously full friction showed ALL items regardless of `enabled`. The spec changes this to only show enabled items (with appropriate scope). This is the designed behavior — users now have full control via both the enabled toggle and the scope selector.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build completes.

- [ ] **Step 3: Manual verification**

In options: set one comparison item to "Nudge only", one to "Full only", one to "Both". Then trigger purchases at different friction tiers and verify the correct items appear.

- [ ] **Step 4: Commit**

```bash
git add src/content/interceptor.ts
git commit -m "feat: filter comparison items by frictionScope in nudge and full tiers"
```

---

## Chunk 5: Version Bump and Wrap-Up

### Task 7: Version bump, changelog, TODO update

**Files:**
- Modify: `manifest.json`
- Modify: `package.json`
- Modify: `changelog.md`
- Modify: `HypeControl-TODO.md`

- [ ] **Step 1: Bump patch version**

`manifest.json`: increment patch (e.g. `0.4.4` → `0.4.5`)
`package.json`: same version

- [ ] **Step 2: Add changelog entry**

```markdown
## [0.4.5] - 2026-03-10

### Added
- **Delay Timer** — configurable countdown timer (5/10/30/60s) shown as the final step before any purchase fires; can be enabled and configured in Settings
- **Whitelist quick-add** — "Remember this channel" button inside the main friction overlay; inline behavior selector (Skip/Reduced/Full) with duplicate detection and update support
- **Comparison item scope** — each comparison item can now be assigned to Nudge only, Full only, or Both; scope selector appears below the enabled toggle in Settings

---
```

- [ ] **Step 3: Update HypeControl-TODO.md**

Mark completed:
- `[x]` Add-on 1 — Delay Timer
- `[x]` Add-on 4 — Custom Comparison Items (Enhanced) — scope assignment done
- `[x]` Add-on 5 — Whitelist quick-add from overlay
- Update `**Current Version:**` and `**Updated:**` header

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: Build completes.

- [ ] **Step 5: Final commit**

```bash
git add manifest.json package.json changelog.md HypeControl-TODO.md
git commit -m "chore: bump to v0.4.5, update changelog and TODO for quick wins bundle"
```

---

## Quick Reference

| Feature | New setting key | Storage |
|---------|----------------|---------|
| Delay Timer | `UserSettings.delayTimer` | `chrome.storage.sync` |
| Comparison Scope | `ComparisonItem.frictionScope` | `chrome.storage.sync` (part of comparisonItems) |
| Whitelist Quick-Add | No new setting (writes to existing `whitelistedChannels`) | `chrome.storage.sync` |

| Scope value | Nudge pool | Full pool |
|-------------|-----------|----------|
| `nudge` | ✅ included | ❌ excluded |
| `full` | ❌ excluded | ✅ included |
| `both` | ✅ included | ✅ included |
