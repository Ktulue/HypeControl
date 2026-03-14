# Interactive Onboarding Tour Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-phase onboarding tour — a popup wizard on first open (Phase 1) and a Twitch-side live demo on first Twitch visit (Phase 2) — that gets new users configured and experiencing the real overlay in under 2 minutes.

**Architecture:** Phase 1 fires on first user-initiated popup open (detected via `hcOnboardingWizardPending` in `chrome.storage.local`). Phase 2 fires on first Twitch page load (detected via `hcOnboardingPhase2Pending`). Both phases are independently dismissable and replayable. The Phase 2 demo uses `triggerDemoOverlay()`, a stable export that calls the real `runFrictionFlow()` with a mock purchase and a clean tracker — no storage writes.

**Tech Stack:** TypeScript, Chrome Extension MV3, webpack, `chrome.storage.local`, DOM injection (same pattern as interceptor.ts overlay)

**Branch:** `feat/interactive-onboarding-tour`

**Do NOT bump versions** during implementation. Version bump happens in the final task.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/shared/types.ts` | Modify | Add `isDemoMode?` to `PurchaseAttempt`; add `ONBOARDING_KEYS` constants |
| `src/content/interceptor.ts` | Modify | Add `triggerDemoOverlay()` export; add demo badge to `showMainOverlay`; update `HC.testOverlay()` delegation in `index.ts` |
| `src/content/index.ts` | Modify | Refactor `HC.testOverlay()` to call `triggerDemoOverlay()`; add Phase 2 pending check + DOM readiness + `initTourPanel()` call |
| `src/background/serviceWorker.ts` | Modify | Add `onInstalled` handler to set both pending flags |
| `src/popup/popup.html` | Modify | Add wizard markup (`#hc-wizard`); add `↺ Tour` footer link |
| `src/popup/popup.css` | Modify | Add wizard styles |
| `src/popup/popup.ts` | Modify | Add wizard state check at init; skip logic; continue logic; in-place replay re-render; replay trigger |
| `src/popup/sections/settings-section.ts` | Modify | Add `↺ Replay setup tour` button + handler |
| `src/popup/sections/settings-section.html` (inline) | Modify | Add replay button to Settings section HTML in popup.html |
| `src/content/tourPanel.ts` | Create | Slide-out tour panel: DOM injection, step 1 highlights, step 2 demo, collapse/expand, completion |
| `src/content/styles.css` | Modify | Highlight ring styles, tour panel styles |
| `manifest.json` + `package.json` | Modify | Patch version bump (final task only) |

---

## Chunk 1: Foundation

> Types + demo overlay + service worker trigger

---

### Task 1: Add onboarding types and constants

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add `isDemoMode` to `PurchaseAttempt` and `ONBOARDING_KEYS` constants**

Open `src/shared/types.ts`. Make two changes:

**Change 1** — add `isDemoMode?` to `PurchaseAttempt` (after the `element` field):

```typescript
/** Information about a detected purchase attempt */
export interface PurchaseAttempt {
  type: PurchaseType;
  rawPrice: string | null;
  priceValue: number | null;
  channel: string;
  timestamp: Date;
  element: HTMLElement;
  isDemoMode?: boolean;  // true when fired from triggerDemoOverlay() — skips storage writes
}
```

**Change 2** — add `ONBOARDING_KEYS` constants at the bottom of the file (before the closing):

```typescript
/** Storage keys for onboarding state — all stored in chrome.storage.local */
export const ONBOARDING_KEYS = {
  wizardPending: 'hcOnboardingWizardPending',
  phase2Pending: 'hcOnboardingPhase2Pending',
  complete: 'hcOnboardingComplete',
} as const;
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

Run: `npm run build`

Expected: Build succeeds with no TypeScript errors. (If build fails for any reason, stop and report to the user — do not retry.)

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add isDemoMode to PurchaseAttempt and ONBOARDING_KEYS constants"
```

---

### Task 2: Add `triggerDemoOverlay()` and demo badge

**Files:**
- Modify: `src/content/interceptor.ts`

- [ ] **Step 1: Add demo badge to `showMainOverlay`**

In `src/content/interceptor.ts`, find the `showMainOverlay` function (around line 438). Find the line that renders `${whitelistNote ? ... : ''}` inside `hc-content`. Add a demo badge **above** that line:

```typescript
  overlay.innerHTML = `
    <div class="hc-modal">
      <div class="hc-header">
        <img class="hc-icon" src="${chrome.runtime.getURL('assets/icons/ChromeWebStore/HC_icon_48px.png')}" width="32" height="32" alt="Hype Control">
        <h2 class="hc-title">Hype Control</h2>
      </div>
      <div class="hc-content">
        ${attempt.isDemoMode ? '<div class="hc-demo-badge">Demo mode — no real purchase will be made</div>' : ''}
        ${whitelistNote ? `<div class="hc-whitelist-note">${whitelistNote}</div>` : ''}
```

(Only this one line addition — do not change anything else in `showMainOverlay`.)

- [ ] **Step 2: Add `triggerDemoOverlay()` export**

At the bottom of `src/content/interceptor.ts`, before the final closing, add:

```typescript
/**
 * Fires the real friction overlay with mock purchase data.
 * Used by the onboarding tour (Phase 2) and by HC.testOverlay().
 * Does NOT write to storage — no spend tracking, no event log.
 */
export async function triggerDemoOverlay(): Promise<void> {
  const settings = await loadSettings();
  const mockAttempt: PurchaseAttempt = {
    type: 'Subscribe',
    rawPrice: '$4.99',
    priceValue: 4.99,
    channel: getCurrentChannel() || 'example_channel',
    timestamp: new Date(),
    element: document.body,
    isDemoMode: true,
  };
  // Use a fresh tracker so demo never affects daily totals or cooldown
  const freshTracker = { ...DEFAULT_SPENDING_TRACKER };
  await runFrictionFlow(mockAttempt, settings, freshTracker);
  // Intentionally no recordPurchase or writeInterceptEvent — demo mode
}
```

You'll need to add the `getCurrentChannel` import. Check the imports at the top of interceptor.ts — it imports from `./detector`. Add `getCurrentChannel` to that import:

```typescript
import { isPurchaseButton, createPurchaseAttempt, getCurrentChannel } from './detector';
```

- [ ] **Step 3: Build to verify**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/content/interceptor.ts
git commit -m "feat: add triggerDemoOverlay() export and demo badge to main overlay"
```

---

### Task 3: Refactor `HC.testOverlay()` to delegate to `triggerDemoOverlay()`

**Files:**
- Modify: `src/content/index.ts`

- [ ] **Step 1: Import `triggerDemoOverlay`, update `testOverlay`, remove unused import**

In `src/content/index.ts`, make three changes:

**Change 1** — update the import from `./interceptor`:
```typescript
import { setupInterceptor, triggerDemoOverlay } from './interceptor';
```

**Change 2** — update the import from `./themeManager`. After the refactor, `applyThemeToOverlay` is only used inside `testOverlay()` (line 264). Once `testOverlay` no longer builds its own overlay HTML, `applyThemeToOverlay` becomes unused. Remove it from the import:
```typescript
import { initThemeManager } from './themeManager';
```

**Change 3** — find the `testOverlay()` function (around line 214). Replace the entire function body — approximately 55 lines of inline overlay HTML — with a single delegation call:
```typescript
function testOverlay(): void {
  log('Testing overlay display via triggerDemoOverlay()...');
  triggerDemoOverlay().catch((e) => log('testOverlay error:', e));
}
```

The `window.HC.testOverlay` assignment at the bottom stays unchanged — only the function body changes.

- [ ] **Step 2: Build and verify**

Run: `npm run build`

Expected: Build succeeds. Load extension in Chrome, open Twitch, run `HC.testOverlay()` in console — the real friction overlay should appear with a "Demo mode" badge.

- [ ] **Step 3: Commit**

```bash
git add src/content/index.ts
git commit -m "refactor: HC.testOverlay() delegates to triggerDemoOverlay()"
```

---

### Task 4: Service worker `onInstalled` handler

**Files:**
- Modify: `src/background/serviceWorker.ts`

Current state: The file has a single comment and is otherwise empty.

- [ ] **Step 1: Add `onInstalled` handler**

Replace the entire file content with:

```typescript
import { ONBOARDING_KEYS } from '../shared/types';

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({
      [ONBOARDING_KEYS.wizardPending]: true,
      [ONBOARDING_KEYS.phase2Pending]: true,
      [ONBOARDING_KEYS.complete]: false,
    });
  }
});
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`

Expected: Build succeeds. To verify manually: remove the extension from Chrome, reload it unpacked, then check `chrome.storage.local` via the extension's service worker DevTools — `hcOnboardingWizardPending` and `hcOnboardingPhase2Pending` should both be `true`.

- [ ] **Step 3: Commit**

```bash
git add src/background/serviceWorker.ts
git commit -m "feat: set onboarding pending flags on first install"
```

---

## Chunk 2: Popup Wizard (Phase 1)

> HTML markup + CSS + popup.ts logic for the first-open wizard

---

### Task 5: Wizard markup in popup.html

**Files:**
- Modify: `src/popup/popup.html`

- [ ] **Step 1: Add wizard container to popup.html**

In `src/popup/popup.html`, find the `<div class="hc-body">` opening tag. Add the wizard panel **immediately after** `<div class="hc-body">` and **before** `<div class="hc-content"`:

```html
  <!-- Onboarding Wizard (Phase 1) — shown on first popup open -->
  <div id="hc-wizard" class="hc-wizard" hidden>
    <div class="hc-wizard-header">
      <img src="assets/icons/ChromeWebStore/HC_icon_48px.png" width="28" height="28" alt="">
      <h2 class="hc-wizard-title">Welcome to Hype Control</h2>
    </div>

    <a class="hc-wizard-skip" id="wizard-skip" href="#">Skip setup, I'll configure it myself →</a>

    <!-- Skip confirmation (shown after skip click) -->
    <div id="wizard-skip-confirm" class="hc-wizard-skip-confirm" hidden>
      <p class="hc-wizard-defaults-msg">You're all set with defaults: <strong>$20/hr wage · 7% sales tax · Medium friction · Preset comparison items enabled.</strong> Update these in Settings anytime.</p>
      <button class="btn-primary" id="wizard-got-it">Got it →</button>
    </div>

    <!-- Main wizard form -->
    <div id="wizard-form" class="hc-wizard-form">
      <div class="hc-wizard-field">
        <label class="hc-wizard-label" for="wizard-hourly-rate">Hourly Rate (take-home)</label>
        <div class="hc-wizard-input-row">
          <span class="hc-wizard-prefix">$</span>
          <input type="number" id="wizard-hourly-rate" class="hc-wizard-input" value="20" min="1" max="999" step="0.01">
        </div>
        <p class="hc-wizard-hint">$20/hr is our default — update this for accurate results</p>
        <a class="hc-wizard-calc-toggle" id="wizard-calc-toggle" href="#">Calculate from salary →</a>
        <div id="wizard-salary-calc" class="hc-wizard-salary-calc" hidden>
          <div class="hc-wizard-input-row">
            <span class="hc-wizard-prefix">$</span>
            <input type="number" id="wizard-annual-salary" class="hc-wizard-input" placeholder="Annual salary" min="1">
          </div>
          <div class="hc-wizard-input-row">
            <input type="number" id="wizard-hours-per-week" class="hc-wizard-input" placeholder="Hours/week" value="40" min="1" max="168">
            <span class="hc-wizard-suffix">hrs/wk</span>
          </div>
        </div>
      </div>

      <div class="hc-wizard-field">
        <label class="hc-wizard-label" for="wizard-tax-rate">Sales Tax Rate</label>
        <div class="hc-wizard-input-row">
          <input type="number" id="wizard-tax-rate" class="hc-wizard-input" value="7" min="0" max="20" step="0.1">
          <span class="hc-wizard-suffix">%</span>
        </div>
      </div>

      <div class="hc-wizard-field">
        <span class="hc-wizard-label">Friction Level</span>
        <div class="hc-wizard-seg" id="wizard-friction-seg" role="group" aria-label="Friction level">
          <button class="hc-wizard-seg-btn" data-value="low">Low</button>
          <button class="hc-wizard-seg-btn active" data-value="medium">Medium</button>
          <button class="hc-wizard-seg-btn" data-value="high">High</button>
          <button class="hc-wizard-seg-btn" data-value="extreme">Extreme</button>
        </div>
        <p class="hc-wizard-friction-desc" id="wizard-friction-desc">Overlay + reason selection</p>
      </div>

      <div class="hc-wizard-field">
        <span class="hc-wizard-label">Comparison Items</span>
        <div class="hc-wizard-chips" id="wizard-chips">
          <!-- Populated by popup.ts from PRESET_COMPARISON_ITEMS -->
        </div>
        <p class="hc-wizard-hint">These are your default comparisons. <a href="#" id="wizard-customize-link">Customize in Settings →</a></p>
      </div>

      <button class="btn-primary hc-wizard-continue" id="wizard-continue">Continue →</button>
    </div>
  </div><!-- /#hc-wizard -->
```

- [ ] **Step 2: Add `↺ Tour` link to footer**

Find the footer in popup.html:

```html
  <footer class="hc-footer">
    <div class="footer-links">
      <a class="footer-link" href="https://github.com/Ktulue/HypeControl/issues/new" target="_blank" rel="noopener noreferrer">🐛 Bug</a>
      <a class="footer-link" href="https://github.com/Ktulue/HypeControl/discussions/new?category=ideas" target="_blank" rel="noopener noreferrer">💡 Ideas</a>
    </div>
```

Add the tour replay link inside `.footer-links`:

```html
    <div class="footer-links">
      <a class="footer-link" href="https://github.com/Ktulue/HypeControl/issues/new" target="_blank" rel="noopener noreferrer">🐛 Bug</a>
      <a class="footer-link" href="https://github.com/Ktulue/HypeControl/discussions/new?category=ideas" target="_blank" rel="noopener noreferrer">💡 Ideas</a>
      <a class="footer-link" href="#" id="footer-replay-tour">↺ Tour</a>
    </div>
```

- [ ] **Step 3: Add replay button to Settings section**

Find `section id="section-settings"` in popup.html. Add a replay button at the bottom of that section, just before its closing `</section>`:

```html
      <div class="hc-row hc-row--replay">
        <button class="btn-secondary btn-replay-tour" id="btn-replay-tour">↺ Replay setup tour</button>
      </div>
```

- [ ] **Step 4: Build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/popup/popup.html
git commit -m "feat: add wizard markup, tour footer link, and replay button to popup.html"
```

---

### Task 6: Wizard CSS

**Files:**
- Modify: `src/popup/popup.css`

- [ ] **Step 1: Add wizard styles**

Append the following to the end of `src/popup/popup.css`:

```css
/* ── Onboarding Wizard ─────────────────────────────────────────────── */

.hc-wizard {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}

.hc-wizard[hidden] { display: none; }

.hc-wizard-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--hc-border);
}

.hc-wizard-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--hc-text-primary);
  margin: 0;
}

.hc-wizard-skip {
  font-size: 11px;
  color: var(--hc-text-muted);
  text-decoration: none;
  align-self: flex-start;
}
.hc-wizard-skip:hover { color: var(--hc-text-primary); text-decoration: underline; }

.hc-wizard-skip-confirm {
  background: var(--hc-surface-2);
  border-radius: 6px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hc-wizard-skip-confirm[hidden] { display: none; }

.hc-wizard-defaults-msg {
  font-size: 12px;
  color: var(--hc-text-secondary);
  line-height: 1.5;
  margin: 0;
}

.hc-wizard-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.hc-wizard-form[hidden] { display: none; }

.hc-wizard-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hc-wizard-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--hc-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.hc-wizard-input-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.hc-wizard-prefix,
.hc-wizard-suffix {
  font-size: 13px;
  color: var(--hc-text-muted);
  flex-shrink: 0;
}

.hc-wizard-input {
  background: var(--hc-surface-2);
  border: 1px solid var(--hc-border);
  border-radius: 4px;
  color: var(--hc-text-primary);
  font-size: 14px;
  font-family: inherit;
  padding: 6px 8px;
  width: 100%;
}
.hc-wizard-input:focus {
  outline: 2px solid var(--hc-accent);
  outline-offset: 1px;
  border-color: transparent;
}

.hc-wizard-hint {
  font-size: 11px;
  color: var(--hc-text-muted);
  margin: 0;
  line-height: 1.4;
}
.hc-wizard-hint a {
  color: var(--hc-accent);
  text-decoration: none;
}
.hc-wizard-hint a:hover { text-decoration: underline; }

.hc-wizard-calc-toggle {
  font-size: 11px;
  color: var(--hc-accent);
  text-decoration: none;
  align-self: flex-start;
}
.hc-wizard-calc-toggle:hover { text-decoration: underline; }

.hc-wizard-salary-calc {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background: var(--hc-surface-2);
  border-radius: 4px;
  border: 1px solid var(--hc-border);
}
.hc-wizard-salary-calc[hidden] { display: none; }

/* Friction segmented control */
.hc-wizard-seg {
  display: flex;
  gap: 2px;
  background: var(--hc-surface-2);
  border-radius: 6px;
  padding: 2px;
}

.hc-wizard-seg-btn {
  flex: 1;
  padding: 5px 4px;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
  color: var(--hc-text-muted);
  transition: background 0.15s, color 0.15s;
}
.hc-wizard-seg-btn.active {
  background: var(--hc-accent);
  color: #fff;
}
.hc-wizard-seg-btn:hover:not(.active) {
  background: var(--hc-surface-3, rgba(255,255,255,0.08));
  color: var(--hc-text-primary);
}

.hc-wizard-friction-desc {
  font-size: 11px;
  color: var(--hc-text-muted);
  margin: 0;
  min-height: 16px;
}

/* Comparison chips */
.hc-wizard-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.hc-wizard-chip {
  background: var(--hc-surface-2);
  border: 1px solid var(--hc-border);
  border-radius: 20px;
  padding: 4px 10px;
  font-size: 12px;
  color: var(--hc-text-secondary);
}

.hc-wizard-continue {
  margin-top: 4px;
  width: 100%;
}

/* Replay button in settings section */
.hc-row--replay {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--hc-border);
}

.btn-replay-tour {
  font-size: 12px;
}

/* NOTE: .hc-demo-badge is intentionally NOT defined here.
   It is used in overlay HTML rendered by interceptor.ts (content script),
   which loads src/content/styles.css — not popup.css.
   The badge style is defined in Task 9 (styles.css). */
```

- [ ] **Step 2: Build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/popup/popup.css
git commit -m "feat: add wizard and demo badge CSS styles"
```

---

### Task 7: Popup wizard logic

**Files:**
- Modify: `src/popup/popup.ts`

- [ ] **Step 1: Import ONBOARDING_KEYS and PRESET_COMPARISON_ITEMS**

At the top of `src/popup/popup.ts`, update the import from `../shared/types`:

```typescript
import { migrateSettings, ThemePreference, ONBOARDING_KEYS, PRESET_COMPARISON_ITEMS, DEFAULT_SETTINGS } from '../shared/types';
```

- [ ] **Step 2: Add `showWizard()` function**

Add the following function to `popup.ts` **before** the `main()` function:

```typescript
const FRICTION_DESCRIPTIONS: Record<string, string> = {
  low: 'Main overlay only — one click to cancel',
  medium: 'Overlay + reason selection',
  high: 'Overlay + reason + cooldown timer',
  extreme: 'Everything + math challenge + type-to-confirm',
};

function showWizard(onComplete: () => void): void {
  const wizard = document.getElementById('hc-wizard')!;
  const form = document.getElementById('wizard-form')!;
  const skipLink = document.getElementById('wizard-skip')!;
  const skipConfirm = document.getElementById('wizard-skip-confirm')!;
  const gotItBtn = document.getElementById('wizard-got-it')!;
  const hourlyInput = document.getElementById('wizard-hourly-rate') as HTMLInputElement;
  const taxInput = document.getElementById('wizard-tax-rate') as HTMLInputElement;
  const calcToggle = document.getElementById('wizard-calc-toggle')!;
  const salaryCalc = document.getElementById('wizard-salary-calc')!;
  const salaryInput = document.getElementById('wizard-annual-salary') as HTMLInputElement;
  const hoursInput = document.getElementById('wizard-hours-per-week') as HTMLInputElement;
  const frictionSeg = document.getElementById('wizard-friction-seg')!;
  const frictionDesc = document.getElementById('wizard-friction-desc')!;
  const chips = document.getElementById('wizard-chips')!;
  const continueBtn = document.getElementById('wizard-continue')!;
  const customizeLink = document.getElementById('wizard-customize-link')!;

  // Show wizard, hide main content
  wizard.removeAttribute('hidden');
  const content = document.getElementById('hc-content')!;
  const nav = document.getElementById('hc-nav')!;
  content.setAttribute('hidden', '');
  nav.setAttribute('hidden', '');

  // Populate comparison chips (first 4 enabled presets)
  const previewItems = PRESET_COMPARISON_ITEMS.filter(i => i.enabled).slice(0, 4);
  chips.innerHTML = '';
  previewItems.forEach(item => {
    const chip = document.createElement('span');
    chip.className = 'hc-wizard-chip';
    chip.textContent = `${item.emoji} ${item.name}`;
    chips.appendChild(chip);
  });

  // Salary calculator toggle
  calcToggle.addEventListener('click', (e) => {
    e.preventDefault();
    const isHidden = salaryCalc.hasAttribute('hidden');
    if (isHidden) {
      salaryCalc.removeAttribute('hidden');
      calcToggle.textContent = 'Hide calculator ↑';
    } else {
      salaryCalc.setAttribute('hidden', '');
      calcToggle.textContent = 'Calculate from salary →';
    }
  });

  // Salary calculator: auto-compute hourly rate
  function updateHourlyFromSalary(): void {
    const salary = parseFloat(salaryInput.value);
    const hours = parseFloat(hoursInput.value) || 40;
    if (salary > 0 && hours > 0) {
      hourlyInput.value = (salary / 52 / hours).toFixed(2);
    }
  }
  salaryInput.addEventListener('input', updateHourlyFromSalary);
  hoursInput.addEventListener('input', updateHourlyFromSalary);

  // Friction segmented control
  frictionSeg.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.hc-wizard-seg-btn') as HTMLButtonElement | null;
    if (!btn) return;
    frictionSeg.querySelectorAll('.hc-wizard-seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    frictionDesc.textContent = FRICTION_DESCRIPTIONS[btn.dataset.value ?? 'medium'] ?? '';
  });

  // Skip path
  skipLink.addEventListener('click', async (e) => {
    e.preventDefault();
    // Write defaults to storage
    await chrome.storage.sync.set({ hcSettings: DEFAULT_SETTINGS });
    // Clear wizard pending flag; leave phase2 pending
    await chrome.storage.local.set({ [ONBOARDING_KEYS.wizardPending]: false });
    // Show skip confirmation
    form.setAttribute('hidden', '');
    skipLink.setAttribute('hidden', '');
    skipConfirm.removeAttribute('hidden');
    // Auto-close after 3s fallback
    const autoClose = setTimeout(() => closeWizard(), 3000);
    gotItBtn.addEventListener('click', () => {
      clearTimeout(autoClose);
      closeWizard();
    });
  });

  // Customize link — close wizard and navigate to Comparisons section
  customizeLink.addEventListener('click', (e) => {
    e.preventDefault();
    closeWizard();
    // Scroll to comparisons section
    setTimeout(() => {
      document.getElementById('section-comparisons')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  });

  // Continue button
  continueBtn.addEventListener('click', async () => {
    const hourlyRate = parseFloat(hourlyInput.value) || 20;
    const taxRate = parseFloat(taxInput.value) || 7;
    const activeBtn = frictionSeg.querySelector<HTMLButtonElement>('.hc-wizard-seg-btn.active');
    const frictionIntensity = (activeBtn?.dataset.value ?? 'medium') as UserSettings['frictionIntensity'];

    // Load current settings (handles reinstall case — prefills from existing)
    const result = await chrome.storage.sync.get('hcSettings');
    const current = migrateSettings(result.hcSettings ?? {});
    const updated = { ...current, hourlyRate, taxRate, frictionIntensity };
    await chrome.storage.sync.set({ hcSettings: updated });
    await chrome.storage.local.set({ [ONBOARDING_KEYS.wizardPending]: false });
    closeWizard();
  });

  function closeWizard(): void {
    wizard.setAttribute('hidden', '');
    content.removeAttribute('hidden');
    nav.removeAttribute('hidden');
    onComplete();
  }
}
```

Note: `UserSettings` needs to be imported. Update the types import to include it:

```typescript
import { migrateSettings, ThemePreference, ONBOARDING_KEYS, PRESET_COMPARISON_ITEMS, DEFAULT_SETTINGS, UserSettings } from '../shared/types';
```

- [ ] **Step 3: Add wizard check to `main()`**

At the very start of the `main()` async function, **before** the `chrome.storage.sync.get` call, add the wizard check:

```typescript
async function main(): Promise<void> {
  // Check if onboarding wizard should be shown (first open)
  const onboardingState = await chrome.storage.local.get([
    ONBOARDING_KEYS.wizardPending,
  ]);
  if (onboardingState[ONBOARDING_KEYS.wizardPending] === true) {
    // Show wizard; when complete, re-run main() to populate normal popup state
    showWizard(() => main());
    return;
  }

  // --- existing main() code continues below ---
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  // ...
```

- [ ] **Step 4: Add replay trigger function**

Add the following function to `popup.ts` (after `showWizard`):

```typescript
async function triggerReplay(): Promise<void> {
  await chrome.storage.local.set({
    [ONBOARDING_KEYS.wizardPending]: true,
    [ONBOARDING_KEYS.phase2Pending]: true,
    [ONBOARDING_KEYS.complete]: false,
  });
  // Re-render wizard in place.
  // On completion, reload the popup window to avoid double-initializing
  // section controllers and event listeners (main() already ran once).
  showWizard(() => window.location.reload());
}
```

- [ ] **Step 5: Wire up replay triggers in `main()`**

At the end of `main()`, after all sections are initialized, wire up both replay entry points:

```typescript
  // Replay tour triggers
  document.getElementById('footer-replay-tour')?.addEventListener('click', (e) => {
    e.preventDefault();
    triggerReplay();
  });
  document.getElementById('btn-replay-tour')?.addEventListener('click', () => {
    triggerReplay();
  });
```

- [ ] **Step 6: Build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 7: Manual smoke test**

1. Load extension unpacked
2. Open popup — wizard should NOT show (onboarding flags not set yet)
3. Manually set `hcOnboardingWizardPending: true` via service worker console: `chrome.storage.local.set({ hcOnboardingWizardPending: true })`
4. Close and reopen popup — wizard should appear
5. Test skip path: click skip, confirm defaults summary shows, click "Got it →" — returns to normal popup
6. Test continue path: adjust hourly rate, click Continue — verify settings saved in storage
7. Test replay: click `↺ Tour` in footer — wizard reappears in place

- [ ] **Step 8: Commit**

```bash
git add src/popup/popup.ts
git commit -m "feat: popup wizard Phase 1 — first-open config wizard with skip and replay"
```

---

## Chunk 3: Twitch Tour Panel (Phase 2)

> New `tourPanel.ts` module + styles + index.ts trigger

---

### Task 8: Create `tourPanel.ts`

**Files:**
- Create: `src/content/tourPanel.ts` ← lives in `src/content/`, NOT `src/popup/`. It is imported as a module by `index.ts` and bundled into the content script — it is NOT a new webpack entry point.

- [ ] **Step 1: Create the tour panel module**

Create `src/content/tourPanel.ts` with the following content:

```typescript
/**
 * tourPanel.ts — Phase 2 onboarding tour
 *
 * Injects a non-blocking slide-out panel on Twitch pages when
 * hcOnboardingPhase2Pending is true. Two steps:
 *   Step 1: Highlight visible interceptable buttons
 *   Step 2: Fire triggerDemoOverlay() so user experiences the real overlay
 */

import { ONBOARDING_KEYS } from '../shared/types';
import { triggerDemoOverlay } from './interceptor';
import { log } from '../shared/logger';

/** Selectors used by detector.ts — kept in sync manually */
const INTERCEPTABLE_SELECTORS = [
  '[data-a-target="gift-button"]',
  '[data-a-target="gift-sub-confirm-button"]',
  'button[data-a-target="top-nav-get-bits-button"]',
  'button[aria-label="Bits"]',
  'button[data-a-target^="bits-purchase-button"]',
];

/** Labels for each selector type */
const SELECTOR_LABELS: Record<string, string> = {
  'gift-button': 'Gift Sub',
  'gift-sub-confirm-button': 'Gift Sub',
  'top-nav-get-bits-button': 'Get Bits',
  'bits': 'Get Bits',
};

interface HighlightedButton {
  el: HTMLElement;
  ring: HTMLElement;
  label: HTMLElement;
}

let panelEl: HTMLElement | null = null;
let highlightedButtons: HighlightedButton[] = [];
let completionTimeout: ReturnType<typeof setTimeout> | null = null;

/** Mark onboarding as complete in storage */
async function markComplete(): Promise<void> {
  await chrome.storage.local.set({
    [ONBOARDING_KEYS.phase2Pending]: false,
    [ONBOARDING_KEYS.complete]: true,
  });
  log('Onboarding Phase 2 complete');
}

/** Remove all highlight rings from Twitch buttons */
function clearHighlights(): void {
  highlightedButtons.forEach(({ ring, label }) => {
    ring.remove();
    label.remove();
  });
  highlightedButtons = [];
}

/** Find interceptable buttons currently visible in the viewport */
function findVisibleInterceptableButtons(): HTMLElement[] {
  const found: HTMLElement[] = [];
  for (const selector of INTERCEPTABLE_SELECTORS) {
    document.querySelectorAll<HTMLElement>(selector).forEach(el => {
      const rect = el.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0 &&
        rect.top >= 0 && rect.bottom <= window.innerHeight;
      if (isVisible && !found.includes(el)) {
        found.push(el);
      }
    });
  }
  return found;
}

/** Get a human-readable label for a highlighted button */
function getLabelForButton(el: HTMLElement): string {
  const dataTarget = el.getAttribute('data-a-target') || '';
  const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();

  if (dataTarget.includes('gift')) return 'Gift Sub';
  if (dataTarget.includes('bits') || ariaLabel === 'bits') return 'Get Bits';

  // Bits purchase tier buttons
  if (dataTarget.startsWith('bits-purchase-button')) {
    const match = dataTarget.match(/bits-purchase-button-(\d+)/);
    return match ? `Buy ${Number(match[1]).toLocaleString()} Bits` : 'Get Bits';
  }

  return 'Purchase Button';
}

/** Apply highlight ring and floating label to a button */
function highlightButton(el: HTMLElement): HighlightedButton {
  const rect = el.getBoundingClientRect();

  const ring = document.createElement('div');
  ring.className = 'hc-tour-highlight-ring';
  ring.style.cssText = `
    position: fixed;
    top: ${rect.top - 4}px;
    left: ${rect.left - 4}px;
    width: ${rect.width + 8}px;
    height: ${rect.height + 8}px;
    pointer-events: none;
    z-index: 999997;
    border-radius: 6px;
  `;

  const label = document.createElement('div');
  label.className = 'hc-tour-highlight-label';
  label.textContent = getLabelForButton(el);
  label.style.cssText = `
    position: fixed;
    top: ${rect.top - 28}px;
    left: ${rect.left}px;
    pointer-events: none;
    z-index: 999998;
  `;

  document.body.appendChild(ring);
  document.body.appendChild(label);

  return { el, ring, label };
}

/** Render Step 2 content into the panel */
function renderStep2(panel: HTMLElement): void {
  const body = panel.querySelector('.hc-tour-body')!;
  body.innerHTML = `
    <p class="hc-tour-heading">Here's what happens when you click one</p>
    <p class="hc-tour-sub">No real purchase will be made.</p>
    <button class="hc-tour-btn-primary" id="hc-tour-try-btn">Try it now</button>
  `;

  panel.querySelector('#hc-tour-try-btn')?.addEventListener('click', async () => {
    // Collapse panel to tab while overlay is active
    panel.classList.add('hc-tour-panel--collapsed');

    try {
      await triggerDemoOverlay();
    } finally {
      // Re-expand after overlay is dismissed (triggerDemoOverlay resolves after user interacts)
      panel.classList.remove('hc-tour-panel--collapsed');
      showCompletion(panel);
    }
  });
}

/** Show completion message and auto-dismiss */
function showCompletion(panel: HTMLElement): void {
  const body = panel.querySelector('.hc-tour-body')!;
  body.innerHTML = `<p class="hc-tour-complete">That's it. You're protected. 🛡️</p>`;

  completionTimeout = setTimeout(async () => {
    await markComplete();
    panel.remove();
    panelEl = null;
  }, 3000);
}

/** Build and inject the tour panel into the page */
function createPanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.id = 'hc-tour-panel';
  panel.className = 'hc-tour-panel';
  panel.setAttribute('role', 'complementary');
  panel.setAttribute('aria-label', 'Hype Control onboarding tour');

  panel.innerHTML = `
    <div class="hc-tour-header">
      <img class="hc-tour-icon" src="${chrome.runtime.getURL('assets/icons/ChromeWebStore/HC_icon_48px.png')}" width="20" height="20" alt="">
      <span class="hc-tour-title">Hype Control</span>
      <button class="hc-tour-close" id="hc-tour-close" aria-label="Dismiss tour">✕</button>
    </div>
    <div class="hc-tour-body">
      <!-- Content injected per step -->
    </div>
    <!-- Collapsed tab state -->
    <div class="hc-tour-tab">
      <img src="${chrome.runtime.getURL('assets/icons/ChromeWebStore/HC_icon_48px.png')}" width="16" height="16" alt="HC">
      <span>…</span>
    </div>
  `;

  // Dismiss / close
  panel.querySelector('#hc-tour-close')?.addEventListener('click', async () => {
    if (completionTimeout) clearTimeout(completionTimeout);
    clearHighlights();
    await markComplete();
    panel.remove();
    panelEl = null;
  });

  return panel;
}

/** Run Step 1: find and highlight buttons, show panel */
function runStep1(panel: HTMLElement): void {
  const buttons = findVisibleInterceptableButtons();
  const body = panel.querySelector('.hc-tour-body')!;

  if (buttons.length > 0) {
    // Highlight each visible button
    buttons.forEach(btn => {
      highlightedButtons.push(highlightButton(btn));
    });

    body.innerHTML = `
      <p class="hc-tour-heading">Here's what I watch for you</p>
      <p class="hc-tour-sub">${buttons.length} interceptable button${buttons.length !== 1 ? 's' : ''} on this page</p>
      <button class="hc-tour-btn-primary" id="hc-tour-next-btn">Show me what happens →</button>
    `;

    panel.querySelector('#hc-tour-next-btn')?.addEventListener('click', () => {
      clearHighlights();
      renderStep2(panel);
    });
  } else {
    // No buttons visible — skip to step 2
    body.innerHTML = `
      <p class="hc-tour-heading">Navigate to a channel to see what I protect</p>
      <p class="hc-tour-sub">Or try a demo now.</p>
      <button class="hc-tour-btn-primary" id="hc-tour-next-btn">Show me anyway →</button>
    `;

    panel.querySelector('#hc-tour-next-btn')?.addEventListener('click', () => {
      renderStep2(panel);
    });
  }
}

/**
 * Initialize the Phase 2 onboarding tour panel.
 * Call from index.ts after DOM readiness check passes.
 */
export function initTourPanel(): void {
  if (panelEl) return; // Already initialized

  panelEl = createPanel();
  document.body.appendChild(panelEl);
  runStep1(panelEl);
  log('Onboarding Phase 2 tour panel initialized');
}
```

- [ ] **Step 2: Build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/content/tourPanel.ts
git commit -m "feat: add tourPanel.ts for Phase 2 Twitch-side onboarding tour"
```

---

### Task 9: Tour panel and highlight ring styles

**Files:**
- Modify: `src/content/styles.css`

- [ ] **Step 1: Add tour panel styles**

Append the following to the end of `src/content/styles.css`:

```css
/* ── Onboarding Tour Panel ─────────────────────────────────────────── */

#hc-tour-panel {
  position: fixed;
  top: 50%;
  right: 16px;
  transform: translateY(-50%);
  width: 260px;
  background: var(--hc-modal-bg, #1f1f23);
  border: 1px solid var(--hc-border, rgba(255,255,255,0.1));
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  z-index: 999996;
  font-family: 'Space Grotesk', sans-serif;
  overflow: hidden;
  transition: width 0.2s, opacity 0.2s;
}

/* Collapsed tab state (shown while demo overlay is active) */
.hc-tour-panel--collapsed .hc-tour-header,
.hc-tour-panel--collapsed .hc-tour-body {
  display: none;
}

.hc-tour-panel--collapsed {
  width: 44px;
  border-radius: 8px;
}

.hc-tour-tab {
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px 0;
  gap: 4px;
  font-size: 10px;
  color: var(--hc-text-muted, rgba(255,255,255,0.5));
}

.hc-tour-panel--collapsed .hc-tour-tab {
  display: flex;
}

/* Panel header */
.hc-tour-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px 8px;
  border-bottom: 1px solid var(--hc-border, rgba(255,255,255,0.08));
}

.hc-tour-icon {
  flex-shrink: 0;
}

.hc-tour-title {
  flex: 1;
  font-size: 13px;
  font-weight: 700;
  color: var(--hc-text-primary, #fff);
}

.hc-tour-close {
  background: none;
  border: none;
  color: var(--hc-text-muted, rgba(255,255,255,0.4));
  cursor: pointer;
  font-size: 13px;
  padding: 2px 4px;
  border-radius: 3px;
  line-height: 1;
}
.hc-tour-close:hover {
  color: var(--hc-text-primary, #fff);
  background: rgba(255,255,255,0.08);
}

/* Panel body */
.hc-tour-body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hc-tour-heading {
  font-size: 13px;
  font-weight: 700;
  color: var(--hc-text-primary, #fff);
  margin: 0;
  line-height: 1.4;
}

.hc-tour-sub {
  font-size: 12px;
  color: var(--hc-text-muted, rgba(255,255,255,0.5));
  margin: 0;
  line-height: 1.4;
}

.hc-tour-complete {
  font-size: 14px;
  font-weight: 700;
  color: var(--hc-success, #22C55E);
  margin: 0;
  text-align: center;
  padding: 8px 0;
}

.hc-tour-btn-primary {
  background: var(--hc-accent, #9147ff);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  width: 100%;
  text-align: center;
  transition: opacity 0.15s;
}
.hc-tour-btn-primary:hover { opacity: 0.88; }

/* ── Highlight ring on Twitch buttons ──────────────────────────────── */

.hc-tour-highlight-ring {
  border: 2px solid var(--hc-accent, #9147ff);
  box-shadow: 0 0 0 3px rgba(145, 71, 255, 0.3);
  animation: hc-tour-pulse 1.6s ease-in-out infinite;
}

@keyframes hc-tour-pulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(145, 71, 255, 0.3); }
  50%       { box-shadow: 0 0 0 6px rgba(145, 71, 255, 0.1); }
}

.hc-tour-highlight-label {
  background: var(--hc-accent, #9147ff);
  color: #fff;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  white-space: nowrap;
}
```

- [ ] **Step 2: Build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/content/styles.css
git commit -m "feat: add tour panel and highlight ring styles"
```

---

### Task 10: Phase 2 trigger in `index.ts`

**Files:**
- Modify: `src/content/index.ts`

- [ ] **Step 1: Import `initTourPanel` and `ONBOARDING_KEYS`**

Add to the imports at the top of `src/content/index.ts`:

```typescript
import { initTourPanel } from './tourPanel';
import { ONBOARDING_KEYS } from '../shared/types';
```

- [ ] **Step 2: Add Phase 2 check function**

Add the following function to `index.ts`, before the `init()` function:

```typescript
/**
 * Checks if the Phase 2 onboarding tour should run on this page load.
 * Waits for a known stable Twitch selector before injecting.
 * Times out silently after 10 seconds if selector never appears.
 */
async function maybeInitTourPanel(): Promise<void> {
  try {
    const state = await chrome.storage.local.get(ONBOARDING_KEYS.phase2Pending);
    if (!state[ONBOARDING_KEYS.phase2Pending]) return;

    // Wait for a stable Twitch selector (same strategy as detector.ts uses)
    // NOTE: This selector targets the top-nav avatar present for logged-in users.
    // Logged-out users will not have this element, causing the tour to silently
    // skip on that page load and retry on the next navigation. This is acceptable —
    // HypeControl only intercepts purchases, which require a logged-in Twitch account.
    const STABLE_SELECTOR = '[data-a-target="top-nav-avatar"]';
    const TIMEOUT_MS = 10_000;
    const POLL_MS = 300;

    await new Promise<void>((resolve, reject) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (document.querySelector(STABLE_SELECTOR)) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - start > TIMEOUT_MS) {
          clearInterval(interval);
          reject(new Error('Twitch selector timeout'));
        }
      }, POLL_MS);
    });

    initTourPanel();
  } catch (e) {
    // Timeout or storage error — skip silently, retry on next navigation
    debug('Tour panel init skipped:', e);
  }
}
```

- [ ] **Step 3: Call `maybeInitTourPanel()` from `init()`**

Inside the `init()` function, after `setupInterceptor()` is called, add:

```typescript
    // Phase 2 onboarding tour (fires on first Twitch visit after install)
    maybeInitTourPanel();
```

- [ ] **Step 4: Build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 5: Manual smoke test**

1. Load extension, navigate to Twitch
2. Manually set `hcOnboardingPhase2Pending: true` via service worker console
3. Reload Twitch page — tour panel should appear after a moment
4. Click "Show me what happens →" (Step 2)
5. Click "Try it now" — real overlay fires with demo badge, panel collapses to tab
6. Cancel or Proceed in overlay — panel re-expands, shows "You're protected." message
7. Panel auto-dismisses after 3 seconds; verify `hcOnboardingComplete: true` in storage

- [ ] **Step 6: Commit**

```bash
git add src/content/index.ts
git commit -m "feat: trigger Phase 2 tour panel on first Twitch visit"
```

---

## Chunk 4: Version Bump + Final Build

---

### Task 11: Version bump and build

**Files:**
- Modify: `manifest.json`
- Modify: `package.json`

- [ ] **Step 1: Check current version**

```bash
grep '"version"' manifest.json package.json
```

Expected: Both show `"0.4.20"`.

- [ ] **Step 2: Bump patch version in both files**

In `manifest.json`, change:
```json
"version": "0.4.20"
```
to:
```json
"version": "0.4.21"
```

In `package.json`, change:
```json
"version": "0.4.20"
```
to:
```json
"version": "0.4.21"
```

- [ ] **Step 3: Final build**

Run: `npm run build`

Expected: Build succeeds. Verify `dist/` is populated.

- [ ] **Step 4: Update HypeControl-TODO.md**

In `HypeControl-TODO.md`:
- Update `Current Version` in the header to `0.4.21`
- Update the `Updated` date to today (`2026-03-14`)
- Mark `Interactive Onboarding Tour` as `✅ Complete` in the Quick Summary table
- Update the footer timestamp

- [ ] **Step 5: Commit**

```bash
git add manifest.json package.json HypeControl-TODO.md
git commit -m "feat: interactive onboarding tour complete (v0.4.21)"
```

---

## End-to-End Test Checklist

After all tasks are complete, verify the full flow:

**Fresh install simulation:**
- [ ] Remove and re-load extension unpacked
- [ ] Verify `hcOnboardingWizardPending: true` and `hcOnboardingPhase2Pending: true` in storage
- [ ] Open popup — wizard appears, normal popup is hidden
- [ ] Adjust hourly rate, select friction level, click Continue
- [ ] Verify settings saved to `chrome.storage.sync`
- [ ] Navigate to Twitch — tour panel appears after selector is found
- [ ] Step 1: interceptable buttons highlighted (if present)
- [ ] Step 2: click "Try it now" — real overlay fires with "Demo mode" badge
- [ ] Overlay shows cost breakdown with adjusted hourly rate
- [ ] Dismiss overlay — panel re-expands, "You're protected." message
- [ ] Panel auto-dismisses — `hcOnboardingComplete: true` in storage
- [ ] Reopen popup — normal stats view, no wizard

**Skip path:**
- [ ] Reset flags, open popup, click "Skip setup" link
- [ ] Default summary shows, "Got it →" button closes wizard
- [ ] Navigate to Twitch — tour panel still appears (Phase 2 not skipped)

**Replay:**
- [ ] Click "↺ Tour" in popup footer — wizard re-renders in place
- [ ] Click "↺ Replay setup tour" in Settings section — same behavior
- [ ] After wizard completes, Phase 2 fires again on next Twitch visit

**Advanced user (skip both phases by dismissing):**
- [ ] X on tour panel marks `hcOnboardingComplete: true`
- [ ] Popup no longer shows wizard on reopen
