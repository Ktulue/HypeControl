# Popup Polish & Dynamic Intensity Escalation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a 6-fix maintenance pass: toggle alignment, tour button relocation, weekly reset day preference, history summary centering, dynamic intensity escalation, and history metric color parity.

**Architecture:** Pure CSS fixes (1, 4, 6) are independent. HTML/TS changes (2, 3, 5) touch popup.html and popup.ts. Fix 5 (escalation) is the meatiest — it adds a `computeEscalatedIntensity()` function to a new shared module and wires it into both the popup and the content-script interceptor. Fix 3 modifies `getCurrentWeekStart()` in interceptor.ts. All new settings fields get migration in `migrateSettings()`.

**Tech Stack:** TypeScript, webpack, Chrome Extension MV3, Jest (ts-jest)

**Spec:** `docs/superpowers/specs/2026-03-16-popup-polish-and-escalation-design.md`

---

## Chunk 1: CSS-Only Fixes (Tasks 1–3)

These three tasks are independent and touch no TypeScript. Each is a single-file CSS edit.

### Task 1: Toggle Vertical Alignment (Fix 1)

**Files:**
- Modify: `src/popup/popup.css:219` (`.hc-label` min-width)

- [ ] **Step 1: Edit `.hc-label` min-width**

In `src/popup/popup.css`, change `.hc-label` `min-width` from `110px` to `140px`:

```css
.hc-label {
  flex: 0 0 auto;
  min-width: 140px;
  color: var(--text-secondary);
  font-size: 12px;
}
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds. All toggles in Friction, Limits, and Channels sections now align vertically.

- [ ] **Step 3: Commit**

```bash
git add src/popup/popup.css
git commit -m "fix: align toggles vertically by widening label min-width to 140px"
```

---

### Task 2: History Summary Bar True-Center (Fix 4)

**Files:**
- Modify: `src/history/history.css:104-113` (`.summary-metric`)

- [ ] **Step 1: Add vertical centering and min-height to `.summary-metric`**

In `src/history/history.css`, update `.summary-metric`:

```css
.summary-metric {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 14px 12px;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 4px;
  min-height: 80px;
}
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: All 6 summary metric cards are vertically and horizontally centered.

- [ ] **Step 3: Commit**

```bash
git add src/history/history.css
git commit -m "fix: true-center history summary metric cards"
```

---

### Task 3: History Metric Color Parity (Fix 6)

**Files:**
- Modify: `src/history/history.css:130-132` (add color overrides after existing `#metric-saved`)

- [ ] **Step 1: Add metric color overrides**

In `src/history/history.css`, after the existing `#metric-saved .metric-value` rule, add:

```css
#metric-saved .metric-value {
  color: var(--success);
}

#metric-spent .metric-value {
  color: var(--danger);
}

#metric-cancel-rate .metric-value {
  color: #f59e0b;
}

#metric-top-step .metric-value {
  color: var(--accent);
}
```

This replaces the existing `#metric-saved` rule and adds three new ones. `#metric-count` and `#metric-top-reason` keep default text color (no popup equivalent).

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: Total Spent = red, Total Saved = green, Cancel Rate = amber, Top Cancel Step = purple.

- [ ] **Step 3: Commit**

```bash
git add src/history/history.css
git commit -m "fix: match history summary metric colors to popup stat tiles"
```

---

## Chunk 2: Tour Button Relocation (Task 4)

### Task 4: Relocate Replay Tour Button (Fix 2)

**Files:**
- Modify: `src/popup/popup.html:356-358` (remove Settings section button), `src/popup/popup.html:393` (remove footer link)
- Modify: `src/popup/popup.css:823-832` (remove old styles, add new)
- Modify: `src/popup/popup.ts:292-299` (rewire event handler)

- [ ] **Step 1: Remove old tour button from Settings section in popup.html**

Remove lines 356-358 (the `.hc-row--replay` div):

```html
      <div class="hc-row hc-row--replay">
          <button class="btn-secondary btn-replay-tour" id="btn-replay-tour">↺ Replay setup tour</button>
        </div>
```

- [ ] **Step 2: Remove footer tour link from popup.html**

In the `.footer-links` div (around line 393), remove:

```html
      <a class="footer-link" href="#" id="footer-replay-tour">↺ Tour</a>
```

- [ ] **Step 3: Add new tour button below Credits section in popup.html**

After the closing `</section>` of `section-credits` (after line 373) and before the closing `</div><!-- /.hc-content -->`, add:

```html
    <button class="btn-secondary btn-replay-bottom" id="btn-replay-bottom">↺ Replay Setup Tour</button>
```

- [ ] **Step 4: Update popup.css — remove old styles, add new**

Replace the old replay button styles (lines 823-832):

```css
/* Replay button in settings section */
.hc-row--replay {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.btn-replay-tour {
  font-size: 12px;
}
```

With:

```css
/* Replay tour button — lives below Credits at the very bottom */
.btn-replay-bottom {
  display: block;
  margin: 24px auto 16px;
  font-size: 12px;
  opacity: 0.7;
}
.btn-replay-bottom:hover {
  opacity: 1;
}
```

- [ ] **Step 5: Update popup.ts — rewire event handler**

Replace the two replay tour handlers (lines 292-299):

```typescript
  // Replay tour triggers
  document.getElementById('footer-replay-tour')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await triggerReplay();
  });
  document.getElementById('btn-replay-tour')?.addEventListener('click', async () => {
    await triggerReplay();
  });
```

With a single handler:

```typescript
  // Replay tour trigger
  document.getElementById('btn-replay-bottom')?.addEventListener('click', async () => {
    await triggerReplay();
  });
```

- [ ] **Step 6: Build and verify**

Run: `npm run build`
Expected: No tour button in footer or Settings section. Single "Replay Setup Tour" button at bottom of page below Credits.

- [ ] **Step 7: Commit**

```bash
git add src/popup/popup.html src/popup/popup.css src/popup/popup.ts
git commit -m "fix: relocate replay tour button to bottom of page below Credits"
```

---

## Chunk 3: Types, Migration & Escalation Logic (Tasks 5–6)

### Task 5: Add New Settings Fields & Migration

**Files:**
- Modify: `src/shared/types.ts:102-118` (UserSettings interface)
- Modify: `src/shared/types.ts:155-195` (DEFAULT_SETTINGS)
- Modify: `src/shared/types.ts:205` (weeklyStartDate comment)
- Modify: `src/shared/types.ts:237-315` (migrateSettings)

- [ ] **Step 1: Write failing tests for new settings fields**

Create `tests/shared/types.test.ts`:

```typescript
import { migrateSettings, DEFAULT_SETTINGS, UserSettings } from '../../src/shared/types';

describe('migrateSettings', () => {
  test('adds weeklyResetDay with default monday for existing users', () => {
    const saved: Partial<UserSettings> = { hourlyRate: 25 };
    const result = migrateSettings(saved);
    expect(result.weeklyResetDay).toBe('monday');
  });

  test('preserves existing weeklyResetDay value', () => {
    const saved: Partial<UserSettings> = { weeklyResetDay: 'sunday' } as any;
    const result = migrateSettings(saved);
    expect(result.weeklyResetDay).toBe('sunday');
  });

  test('adds intensityLocked with default false for existing users', () => {
    const saved: Partial<UserSettings> = { hourlyRate: 25 };
    const result = migrateSettings(saved);
    expect(result.intensityLocked).toBe(false);
  });

  test('preserves existing intensityLocked value', () => {
    const saved: Partial<UserSettings> = { intensityLocked: true } as any;
    const result = migrateSettings(saved);
    expect(result.intensityLocked).toBe(true);
  });

  test('DEFAULT_SETTINGS has frictionIntensity set to low', () => {
    expect(DEFAULT_SETTINGS.frictionIntensity).toBe('low');
  });

  test('does not overwrite existing frictionIntensity on migration', () => {
    const saved: Partial<UserSettings> = { frictionIntensity: 'high' };
    const result = migrateSettings(saved);
    expect(result.frictionIntensity).toBe('high');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/shared/types.test.ts -v`
Expected: FAIL — `weeklyResetDay` and `intensityLocked` are undefined, `frictionIntensity` default is `'medium'`

- [ ] **Step 3: Add fields to UserSettings interface**

In `src/shared/types.ts`, add to the `UserSettings` interface (after `theme: ThemePreference;`):

```typescript
  weeklyResetDay: 'monday' | 'sunday';
  intensityLocked: boolean;
```

- [ ] **Step 4: Update DEFAULT_SETTINGS**

Change `frictionIntensity: 'medium'` to `frictionIntensity: 'low'`.

Add new defaults at the end (before the closing `};`):

```typescript
  weeklyResetDay: 'monday',
  intensityLocked: false,
```

- [ ] **Step 5: Update weeklyStartDate comment**

Change line 205 from:
```typescript
  weeklyStartDate: string;   // ISO date of the Monday that starts the current week (YYYY-MM-DD)
```
To:
```typescript
  weeklyStartDate: string;   // ISO date of the day that starts the current week (Monday or Sunday, YYYY-MM-DD)
```

- [ ] **Step 6: Add migration for new fields**

In `migrateSettings()`, in the return block, add these two lines (after the `theme` line):

```typescript
    weeklyResetDay: saved.weeklyResetDay ?? DEFAULT_SETTINGS.weeklyResetDay,
    intensityLocked: saved.intensityLocked ?? DEFAULT_SETTINGS.intensityLocked,
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx jest tests/shared/types.test.ts -v`
Expected: All 6 tests PASS

- [ ] **Step 8: Fix existing test — pendingState.test.ts**

The test at `tests/popup/pendingState.test.ts:19` asserts `frictionIntensity` is `'medium'`. Update to `'low'`:

```typescript
    expect(p.frictionIntensity).toBe('low');
```

Also at line 38 (resetPending test), same change:

```typescript
    expect(mod.getPending().frictionIntensity).toBe('low');
```

- [ ] **Step 9: Run full test suite**

Run: `npx jest -v`
Expected: All tests PASS

- [ ] **Step 10: Commit**

```bash
git add src/shared/types.ts tests/shared/types.test.ts tests/popup/pendingState.test.ts
git commit -m "feat: add weeklyResetDay, intensityLocked settings; change default intensity to low"
```

---

### Task 6: Create Escalation Logic Module

**Files:**
- Create: `src/shared/escalation.ts`
- Create: `tests/shared/escalation.test.ts`

- [ ] **Step 1: Write failing tests for `computeEscalatedIntensity`**

Create `tests/shared/escalation.test.ts`:

```typescript
import { computeEscalatedIntensity, computeMaxCapPercent } from '../../src/shared/escalation';
import { DEFAULT_SETTINGS, UserSettings, SpendingTracker, DEFAULT_SPENDING_TRACKER } from '../../src/shared/types';

describe('computeMaxCapPercent', () => {
  const baseSettings = { ...DEFAULT_SETTINGS };
  const baseTracker = { ...DEFAULT_SPENDING_TRACKER };

  test('returns 0 when no caps are enabled', () => {
    expect(computeMaxCapPercent(baseSettings, baseTracker)).toBe(0);
  });

  test('returns daily cap percentage when only daily cap enabled', () => {
    const settings = { ...baseSettings, dailyCap: { enabled: true, amount: 100 } };
    const tracker = { ...baseTracker, dailyTotal: 60 };
    expect(computeMaxCapPercent(settings, tracker)).toBe(60);
  });

  test('returns highest percentage across multiple caps', () => {
    const settings = {
      ...baseSettings,
      dailyCap: { enabled: true, amount: 100 },
      weeklyCap: { enabled: true, amount: 200 },
      monthlyCap: { enabled: true, amount: 1000 },
    };
    const tracker = { ...baseTracker, dailyTotal: 30, weeklyTotal: 180, monthlyTotal: 100 };
    // daily=30%, weekly=90%, monthly=10% → max=90
    expect(computeMaxCapPercent(settings, tracker)).toBe(90);
  });

  test('returns percentage above 100 when cap exceeded', () => {
    const settings = { ...baseSettings, dailyCap: { enabled: true, amount: 50 } };
    const tracker = { ...baseTracker, dailyTotal: 75 };
    expect(computeMaxCapPercent(settings, tracker)).toBe(150);
  });

  test('ignores disabled caps', () => {
    const settings = {
      ...baseSettings,
      dailyCap: { enabled: false, amount: 10 },
      weeklyCap: { enabled: true, amount: 200 },
    };
    const tracker = { ...baseTracker, dailyTotal: 100, weeklyTotal: 50 };
    // daily disabled (even though 1000%), weekly=25% → max=25
    expect(computeMaxCapPercent(settings, tracker)).toBe(25);
  });
});

describe('computeEscalatedIntensity', () => {
  test('returns base intensity when no caps enabled (maxPercent=0)', () => {
    expect(computeEscalatedIntensity('low', 0, false)).toBe('low');
  });

  test('returns base intensity when under 60%', () => {
    expect(computeEscalatedIntensity('low', 59, false)).toBe('low');
  });

  test('escalates to medium at 60%', () => {
    expect(computeEscalatedIntensity('low', 60, false)).toBe('medium');
  });

  test('escalates to high at 80%', () => {
    expect(computeEscalatedIntensity('low', 80, false)).toBe('high');
  });

  test('escalates to extreme at 100%', () => {
    expect(computeEscalatedIntensity('low', 100, false)).toBe('extreme');
  });

  test('escalates to extreme above 100%', () => {
    expect(computeEscalatedIntensity('low', 150, false)).toBe('extreme');
  });

  test('does not escalate below base intensity', () => {
    // Base is high, 65% would suggest medium, but high > medium so stays high
    expect(computeEscalatedIntensity('high', 65, false)).toBe('high');
  });

  test('does not escalate when locked', () => {
    expect(computeEscalatedIntensity('low', 95, true)).toBe('low');
  });

  test('does not escalate when locked even at 100%+', () => {
    expect(computeEscalatedIntensity('low', 150, true)).toBe('low');
  });

  test('medium base at 80% escalates to high', () => {
    expect(computeEscalatedIntensity('medium', 80, false)).toBe('high');
  });

  test('medium base at 65% stays medium (already at that tier)', () => {
    expect(computeEscalatedIntensity('medium', 65, false)).toBe('medium');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/shared/escalation.test.ts -v`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/shared/escalation.ts`**

```typescript
import { FrictionIntensity, UserSettings, SpendingTracker } from './types';

/** Ordered intensity levels from lowest to highest */
const INTENSITY_ORDER: FrictionIntensity[] = ['low', 'medium', 'high', 'extreme'];

/**
 * Compute the highest spending percentage across all active caps.
 * Returns 0 when no caps are enabled.
 */
export function computeMaxCapPercent(settings: UserSettings, tracker: SpendingTracker): number {
  const percentages: number[] = [];

  if (settings.dailyCap.enabled && settings.dailyCap.amount > 0) {
    percentages.push(Math.round(tracker.dailyTotal / settings.dailyCap.amount * 10000) / 100);
  }
  if (settings.weeklyCap.enabled && settings.weeklyCap.amount > 0) {
    percentages.push(Math.round(tracker.weeklyTotal / settings.weeklyCap.amount * 10000) / 100);
  }
  if (settings.monthlyCap.enabled && settings.monthlyCap.amount > 0) {
    percentages.push(Math.round(tracker.monthlyTotal / settings.monthlyCap.amount * 10000) / 100);
  }

  return percentages.length === 0 ? 0 : Math.max(...percentages);
}

/**
 * Compute the effective friction intensity based on spending threshold escalation.
 *
 * Escalation tiers:
 * - Under 60%: no change (base)
 * - 60–79%: Medium
 * - 80–99%: High
 * - 100%+: Extreme
 *
 * Rules:
 * - Only escalates UP from base, never down
 * - Returns base immediately if locked
 * - Returns base if maxPercent is 0 (no caps enabled)
 */
export function computeEscalatedIntensity(
  base: FrictionIntensity,
  maxPercent: number,
  locked: boolean,
): FrictionIntensity {
  if (locked || maxPercent === 0) return base;

  let tier: FrictionIntensity;
  if (maxPercent >= 100) {
    tier = 'extreme';
  } else if (maxPercent >= 80) {
    tier = 'high';
  } else if (maxPercent >= 60) {
    tier = 'medium';
  } else {
    return base; // Under 60% — no escalation
  }

  // Only escalate up: if base is already higher than tier, keep base
  const baseIndex = INTENSITY_ORDER.indexOf(base);
  const tierIndex = INTENSITY_ORDER.indexOf(tier);
  return tierIndex > baseIndex ? tier : base;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/shared/escalation.test.ts -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/escalation.ts tests/shared/escalation.test.ts
git commit -m "feat: add escalation module with computeEscalatedIntensity and computeMaxCapPercent"
```

---

## Chunk 4: Weekly Reset Day (Task 7)

### Task 7: Weekly Reset Day Preference (Fix 3)

**Files:**
- Modify: `src/content/interceptor.ts:43-53` (`getCurrentWeekStart`)
- Modify: `src/popup/popup.html` (Limits section — add segmented control)
- Modify: `src/popup/sections/limits.ts` (bind new control)

- [ ] **Step 1: Update `getCurrentWeekStart` in interceptor.ts**

Change the function signature and body to accept a reset day parameter:

```typescript
/**
 * Get the start of the current week as YYYY-MM-DD.
 * Supports Monday-start (ISO default) or Sunday-start weeks.
 */
function getCurrentWeekStart(date: Date = new Date(), resetDay: 'monday' | 'sunday' = 'monday'): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  if (resetDay === 'sunday') {
    // Sunday = 0, so offset is just -dayOfWeek
    d.setDate(d.getDate() - dayOfWeek);
  } else {
    // Monday start (ISO): Sunday needs -6, others need 1-dayOfWeek
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    d.setDate(d.getDate() + mondayOffset);
  }
  return formatLocalDate(d);
}
```

- [ ] **Step 2: Update `loadSpendingTracker` to pass the reset day**

In `loadSpendingTracker`, the function needs access to settings. Update the call site at line 94:

Change:
```typescript
    const currentWeekStart = getCurrentWeekStart();
```
To:
```typescript
    const currentWeekStart = getCurrentWeekStart(new Date(), settings.weeklyResetDay ?? 'monday');
```

This requires passing `settings` into `loadSpendingTracker`. Update the function signature:

```typescript
async function loadSpendingTracker(settings: UserSettings): Promise<SpendingTracker> {
```

There is one call site at approximately line 1896 inside `handlePurchaseAttempt()`, where `settings` is already loaded into a local variable earlier in the same function. Update that single call to `loadSpendingTracker(settings)`.

- [ ] **Step 3: Add reset day segmented control to popup.html**

In the Limits section, after the weekly cap row (after line 243 — `weeklyCapAmountEl`), add a new row for the reset day selector:

```html
        <div class="hc-row" id="weekly-reset-day-row" hidden>
          <label class="hc-label">Week starts</label>
          <div class="segmented" id="weekly-reset-day" data-pending-field="weeklyResetDay">
            <button class="seg-btn" data-value="monday">Mon</button>
            <button class="seg-btn" data-value="sunday">Sun</button>
          </div>
        </div>
```

- [ ] **Step 4: Wire the reset day control in limits.ts**

In `src/popup/sections/limits.ts`, add element references after existing weekly cap refs:

```typescript
  const weeklyResetDayRowEl = el.querySelector<HTMLElement>('#weekly-reset-day-row')!;
  const weeklyResetDayEl = el.querySelector<HTMLElement>('#weekly-reset-day')!;
```

Add event handler for the segmented control (after weekly cap handlers):

```typescript
  // Weekly reset day
  weeklyResetDayEl.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.value as 'monday' | 'sunday';
      setPendingField('weeklyResetDay', val);
      weeklyResetDayEl.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.value === val);
      });
    });
  });
```

Update the weekly cap enabled handler to also show/hide the reset day row:

```typescript
  weeklyCapEnabledEl.addEventListener('change', () => {
    const enabled = weeklyCapEnabledEl.checked;
    weeklyCapAmountEl.hidden = !enabled;
    weeklyResetDayRowEl.hidden = !enabled;
    setPendingField('weeklyCap', { ...getPending().weeklyCap, enabled });
  });
```

Update `render()` to handle the new control:

```typescript
    weeklyResetDayRowEl.hidden = !settings.weeklyCap.enabled;
    weeklyResetDayEl.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === settings.weeklyResetDay);
    });
```

- [ ] **Step 5: Build and verify**

Run: `npm run build`
Expected: Build succeeds. Weekly "Mon / Sun" toggle appears when weekly cap is enabled.

- [ ] **Step 6: Run full test suite**

Run: `npx jest -v`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/content/interceptor.ts src/popup/popup.html src/popup/sections/limits.ts
git commit -m "feat: add weekly reset day preference (Monday/Sunday) in Limits section"
```

---

## Chunk 5: Wire Escalation into Interceptor & Popup (Tasks 8–9)

### Task 8: Wire Escalation into Content Script

**Files:**
- Modify: `src/content/interceptor.ts:1702` (use escalated intensity instead of raw setting)
- Modify: `src/content/interceptor.ts:1-16` (add import)

- [ ] **Step 1: Add import for escalation module**

At the top of `src/content/interceptor.ts`, add:

```typescript
import { computeEscalatedIntensity, computeMaxCapPercent } from '../shared/escalation';
```

- [ ] **Step 2: Replace raw intensity with escalated intensity in `runFrictionFlow`**

Find line 1702:
```typescript
  const intensity = settings.frictionIntensity ?? 'low';
```

Replace with (`runFrictionFlow` already receives `tracker` as its third parameter — reuse it, don't reload):
```typescript
  const maxPercent = computeMaxCapPercent(settings, tracker);
  const intensity = computeEscalatedIntensity(
    settings.frictionIntensity ?? 'low',
    maxPercent,
    settings.intensityLocked ?? false,
  );
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds. Interceptor now uses escalated intensity.

- [ ] **Step 4: Commit**

```bash
git add src/content/interceptor.ts
git commit -m "feat: wire escalated intensity into friction flow"
```

---

### Task 9: Wire Escalation UI into Popup

**Files:**
- Modify: `src/popup/popup.html` (add lock toggle + info icon to both intensity controls, add escalation label)
- Modify: `src/popup/popup.css` (lock toggle styles, escalation indicator styles)
- Modify: `src/popup/sections/stats.ts` (lock toggle handling, escalation visual)
- Modify: `src/popup/sections/friction.ts` (lock toggle handling, escalation visual)
- Modify: `src/popup/popup.ts` (compute and pass escalation state on render)

- [ ] **Step 1: Add lock toggle + info icon to Stats intensity control in popup.html**

In the Stats section, after the `#stats-intensity` segmented div (line 126), within the same `.hc-row`, add:

```html
          <label class="toggle-wrap toggle-wrap--lock" title="Lock intensity — prevents auto-escalation">
            <input type="checkbox" id="stats-intensity-lock" />
            <span class="toggle-track"></span>
            <span class="lock-label">🔒</span>
          </label>
          <span class="escalation-info" tabindex="0" aria-describedby="tooltip-escalation">ⓘ</span>
          <span class="stat-tooltip" id="tooltip-escalation" role="tooltip">Intensity auto-adjusts as you approach your spending limits. Lock to keep your chosen level.</span>
```

- [ ] **Step 2: Add lock toggle to Friction intensity control in popup.html**

In the Friction section, after the `#friction-intensity` segmented div (line 150), within the same `.hc-row`, add:

```html
          <label class="toggle-wrap toggle-wrap--lock" title="Lock intensity — prevents auto-escalation">
            <input type="checkbox" id="friction-intensity-lock" />
            <span class="toggle-track"></span>
            <span class="lock-label">🔒</span>
          </label>
```

- [ ] **Step 3: Add escalation indicator label to both sections**

After each intensity `.hc-row` (in both Stats and Friction), add:

```html
        <div class="escalation-indicator" id="stats-escalation-indicator" hidden>
          <span class="escalation-text"></span>
        </div>
```

And for Friction:

```html
        <div class="escalation-indicator" id="friction-escalation-indicator" hidden>
          <span class="escalation-text"></span>
        </div>
```

- [ ] **Step 4: Add CSS styles for lock toggle and escalation indicator**

In `src/popup/popup.css`, add after the toggle styles section:

```css
/* ─── Lock toggle (compact, inline with segmented) ───────── */
.toggle-wrap--lock {
  gap: 4px;
  margin-left: 4px;
}
.lock-label {
  font-size: 11px;
}

/* ─── Escalation indicator ──────────────────────────────── */
.escalation-indicator {
  padding: 2px 0 2px 140px; /* aligns with content after label column */
  font-size: 11px;
  color: var(--text-muted);
}
.escalation-indicator .escalation-text {
  color: #f59e0b;
  font-weight: 500;
}

/* ─── Escalation info icon (reuses stat-tooltip pattern) ── */
.escalation-info {
  font-size: 12px;
  color: var(--text-muted);
  cursor: help;
  position: relative;
}

/* Escalated segmented button highlight */
.seg-btn.escalated {
  border-color: #f59e0b;
  color: #f59e0b;
  font-weight: 600;
}
.seg-btn.base-indicator::after {
  content: '';
  display: block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--accent);
  margin: 2px auto 0;
}
```

- [ ] **Step 5: Update stats.ts — add lock toggle handling and escalation display**

In `src/popup/sections/stats.ts`:

Add element references:
```typescript
  const lockEl = el.querySelector<HTMLInputElement>('#stats-intensity-lock')!;
  const escalationIndicatorEl = el.querySelector<HTMLElement>('#stats-escalation-indicator')!;
```

Wire lock toggle:
```typescript
  lockEl.addEventListener('change', () => {
    setPendingField('intensityLocked', lockEl.checked);
    // Sync the friction section lock
    const frictionLock = document.querySelector<HTMLInputElement>('#friction-intensity-lock');
    if (frictionLock) frictionLock.checked = lockEl.checked;
  });
```

Add a method to display escalation state. Extend `StatsController` interface:
```typescript
export interface StatsController {
  render(settings: UserSettings): void;
  refreshStats(): Promise<void>;
  showEscalation(base: FrictionIntensity, effective: FrictionIntensity): void;
}
```

Implement `showEscalation`:
```typescript
  function showEscalation(base: FrictionIntensity, effective: FrictionIntensity): void {
    const isEscalated = base !== effective;
    escalationIndicatorEl.hidden = !isEscalated;
    if (isEscalated) {
      const textEl = escalationIndicatorEl.querySelector('.escalation-text')!;
      textEl.textContent = `↑ Auto-escalated from ${base.charAt(0).toUpperCase() + base.slice(1)}`;
      // Highlight escalated button, mark base button
      intensityEl.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
        btn.classList.remove('escalated', 'base-indicator');
        btn.classList.toggle('active', btn.dataset.value === effective);
        if (btn.dataset.value === base) btn.classList.add('base-indicator');
        if (btn.dataset.value === effective) btn.classList.add('escalated');
      });
    } else {
      intensityEl.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
        btn.classList.remove('escalated', 'base-indicator');
      });
    }
  }
```

Update `render()`:
```typescript
  function render(settings: UserSettings): void {
    renderSegmented(intensityEl, settings.frictionIntensity);
    renderOverride(settings);
    lockEl.checked = settings.intensityLocked ?? false;
  }
```

**Update the return statement** from `return { render, refreshStats };` to `return { render, refreshStats, showEscalation };`.

- [ ] **Step 6: Update friction.ts — add lock toggle handling and escalation display**

Mirror the same pattern as stats.ts:

Add element references:
```typescript
  const lockEl = el.querySelector<HTMLInputElement>('#friction-intensity-lock')!;
  const escalationIndicatorEl = el.querySelector<HTMLElement>('#friction-escalation-indicator')!;
```

Wire lock toggle (syncs with stats lock):
```typescript
  lockEl.addEventListener('change', () => {
    setPendingField('intensityLocked', lockEl.checked);
    const statsLock = document.querySelector<HTMLInputElement>('#stats-intensity-lock');
    if (statsLock) statsLock.checked = lockEl.checked;
  });
```

Extend `FrictionController` interface to add `showEscalation`:
```typescript
export interface FrictionController {
  render(settings: UserSettings): void;
  showEscalation(base: FrictionIntensity, effective: FrictionIntensity): void;
}
```

Implement `showEscalation` (same pattern as stats.ts). **Update the return statement** from `return { render };` to `return { render, showEscalation };`.

Update `render()` to set lock state:
```typescript
    lockEl.checked = settings.intensityLocked ?? false;
```

- [ ] **Step 7: Update popup.ts — compute escalation on load and pass to sections**

In `src/popup/popup.ts`, add imports:
```typescript
import { computeEscalatedIntensity, computeMaxCapPercent } from '../shared/escalation';
import { SpendingTracker, DEFAULT_SPENDING_TRACKER } from '../shared/types';
```

After `limits.refreshTracker()` (line 248), add escalation computation:

```typescript
  // Compute escalation state from tracker + settings
  async function updateEscalation(): Promise<void> {
    const trackerResult = await chrome.storage.local.get('hcSpending');
    const tracker: SpendingTracker = { ...DEFAULT_SPENDING_TRACKER, ...trackerResult['hcSpending'] };
    const s = getPending();
    const maxPercent = computeMaxCapPercent(s, tracker);
    const effective = computeEscalatedIntensity(s.frictionIntensity, maxPercent, s.intensityLocked);
    stats.showEscalation(s.frictionIntensity, effective);
    friction.showEscalation(s.frictionIntensity, effective);
  }
  await updateEscalation();
```

- [ ] **Step 8: Build and verify**

Run: `npm run build`
Expected: Build succeeds. Lock toggle appears on both intensity controls. When caps are enabled and tracker shows spending approaching a threshold, escalation indicator appears.

- [ ] **Step 9: Run full test suite**

Run: `npx jest -v`
Expected: All tests PASS

- [ ] **Step 10: Commit**

```bash
git add src/popup/popup.html src/popup/popup.css src/popup/popup.ts src/popup/sections/stats.ts src/popup/sections/friction.ts
git commit -m "feat: wire escalation UI with lock toggle, info icon, and escalation indicator"
```

---

## Chunk 6: Wizard Default Update & Version Bump (Task 10)

### Task 10: Update Wizard Defaults, Bump Version, Update TODO

**Files:**
- Modify: `src/popup/popup.html` (wizard friction default)
- Modify: `src/popup/popup.ts:150` (wizard fallback)
- Modify: `manifest.json` (version bump)
- Modify: `package.json` (version bump)
- Modify: `HypeControl-TODO.md` (post-work update)

- [ ] **Step 1: Update wizard friction default in popup.html**

Move `active` class from Medium to Low button (line 64):
```html
            <button class="hc-wizard-seg-btn active" data-value="low">Low</button>
            <button class="hc-wizard-seg-btn" data-value="medium">Medium</button>
```

Update skip-confirmation text (line 26 area). Change:
```
Medium friction
```
To:
```
Low friction
```

Update the default `wizard-friction-desc` text (line 68):
```html
          <p class="hc-wizard-friction-desc" id="wizard-friction-desc">Main overlay only — one click to cancel</p>
```

- [ ] **Step 2: Update wizard fallback in popup.ts**

At line 150, change the fallback from `'medium'` to `'low'`:
```typescript
    const frictionIntensity = (activeBtn?.dataset.value ?? 'low') as UserSettings['frictionIntensity'];
```

- [ ] **Step 3: Bump version in manifest.json and package.json**

Determine current version (should be 0.4.23), bump to 0.4.24.

In `manifest.json`:
```json
  "version": "0.4.24",
```

In `package.json`:
```json
  "version": "0.4.24",
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: Build succeeds with version 0.4.24.

- [ ] **Step 5: Update HypeControl-TODO.md**

Add the following changes:
- Update header: `Current Version: 0.4.24`, `Updated: 2026-03-16`
- In the "In-Scope" add-on section, note that the maintenance pass is complete
- Update the footer timestamp

- [ ] **Step 6: Commit**

```bash
git add src/popup/popup.html src/popup/popup.ts manifest.json package.json HypeControl-TODO.md
git commit -m "feat: update wizard defaults to Low intensity, bump version to 0.4.24"
```

---

## Subagent Briefing Notes

**IMPORTANT — Do NOT bump versions.** Version bump happens only in Task 10. If you are a subagent working on Tasks 1–9, skip any version bump steps.

**Build note:** `npm run build` may fail due to shell/path issues on Windows (known issue). If the build fails, skip the build step and note it for the user to run manually.

**Test note:** Tests use Jest with ts-jest. Run with `npx jest -v`. The chrome API is not available in test context — only test pure functions (types, escalation, pendingState), not DOM/chrome-dependent code.
