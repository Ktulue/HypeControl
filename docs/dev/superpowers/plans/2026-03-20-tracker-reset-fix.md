# Tracker Reset Fix & Session Removal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix stale spending totals in the popup by extracting tracker load/save/reset logic into a shared module, and remove the obsolete `sessionTotal` metric.

**Architecture:** Create `src/shared/spendingTracker.ts` as the single source of truth for all tracker reads/writes. Both the content script and popup import from it. The shared `loadSpendingTracker()` runs daily/weekly/monthly reset checks and auto-saves if any resets occurred. `sessionTotal` and `sessionChannel` are removed from the type system entirely.

**Tech Stack:** TypeScript, Chrome Extension MV3, Jest (ts-jest)

**Spec:** `docs/superpowers/specs/2026-03-20-tracker-reset-fix-design.md`

**Important:** Do NOT bump versions. The orchestrator handles versioning at the end.

---

### Task 1: Remove session fields from types

**Files:**
- Modify: `src/shared/types.ts:202-224` (SpendingTracker interface and DEFAULT_SPENDING_TRACKER)
- Modify: `src/shared/types.ts:494-525` (sanitizeTracker)
- Test: `tests/shared/types.test.ts`

- [ ] **Step 1: Write failing test — sanitizeTracker strips unknown session fields**

Add to `tests/shared/types.test.ts`:

```typescript
import { sanitizeTracker, DEFAULT_SPENDING_TRACKER, SpendingTracker } from '../../src/shared/types';

describe('sanitizeTracker', () => {
  test('returns valid tracker with correct defaults', () => {
    const result = sanitizeTracker({ ...DEFAULT_SPENDING_TRACKER });
    expect(result.dailyTotal).toBe(0);
    expect(result.weeklyTotal).toBe(0);
    expect(result.monthlyTotal).toBe(0);
    expect(result.lastProceedTimestamp).toBeNull();
    expect(result).not.toHaveProperty('sessionTotal');
    expect(result).not.toHaveProperty('sessionChannel');
  });

  test('strips legacy sessionTotal/sessionChannel from old storage', () => {
    const oldData = {
      ...DEFAULT_SPENDING_TRACKER,
      sessionTotal: 42.50,
      sessionChannel: 'xqc',
    } as any;
    const result = sanitizeTracker(oldData);
    expect(result).not.toHaveProperty('sessionTotal');
    expect(result).not.toHaveProperty('sessionChannel');
  });

  test('clamps negative totals to 0', () => {
    const bad = { ...DEFAULT_SPENDING_TRACKER, dailyTotal: -5 } as any;
    expect(sanitizeTracker(bad).dailyTotal).toBe(0);
  });

  test('rounds totals to 2 decimal places', () => {
    const t = { ...DEFAULT_SPENDING_TRACKER, dailyTotal: 1.999 } as any;
    expect(sanitizeTracker(t).dailyTotal).toBe(2.00);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/shared/types.test.ts --verbose`
Expected: FAIL — `sessionTotal` and `sessionChannel` still exist on the type and return object.

- [ ] **Step 3: Remove session fields from SpendingTracker interface**

In `src/shared/types.ts`, remove from the `SpendingTracker` interface (lines 206-207):
```typescript
// REMOVE these two lines:
  sessionTotal: number;
  sessionChannel: string;
```

- [ ] **Step 4: Remove session fields from DEFAULT_SPENDING_TRACKER**

In `src/shared/types.ts`, remove from `DEFAULT_SPENDING_TRACKER` (lines 218-219):
```typescript
// REMOVE these two lines:
  sessionTotal: 0,
  sessionChannel: '',
```

- [ ] **Step 5: Remove session fields from sanitizeTracker return object**

In `src/shared/types.ts` `sanitizeTracker()`, remove lines 518-519 from the return object:
```typescript
// REMOVE these two lines:
    sessionTotal: sanitizeTotal(t.sessionTotal),
    sessionChannel: typeof t.sessionChannel === 'string' ? t.sessionChannel : '',
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest tests/shared/types.test.ts --verbose`
Expected: PASS — all tests green.

- [ ] **Step 7: Commit**

```bash
git add src/shared/types.ts tests/shared/types.test.ts
git commit -m "maint: remove sessionTotal/sessionChannel from SpendingTracker type"
```

---

### Task 2: Create shared spendingTracker module

**Files:**
- Create: `src/shared/spendingTracker.ts`
- Test: `tests/shared/spendingTracker.test.ts`

- [ ] **Step 1: Write failing tests for the shared module**

Create `tests/shared/spendingTracker.test.ts`:

```typescript
import {
  formatLocalDate,
  getCurrentWeekStart,
  getCurrentMonth,
} from '../../src/shared/spendingTracker';

describe('formatLocalDate', () => {
  test('formats date as YYYY-MM-DD', () => {
    const d = new Date(2026, 2, 20); // March 20, 2026
    expect(formatLocalDate(d)).toBe('2026-03-20');
  });

  test('zero-pads single-digit month and day', () => {
    const d = new Date(2026, 0, 5); // Jan 5
    expect(formatLocalDate(d)).toBe('2026-01-05');
  });
});

describe('getCurrentWeekStart', () => {
  test('returns Monday for monday reset on a Wednesday', () => {
    const wed = new Date(2026, 2, 18); // Wed Mar 18
    expect(getCurrentWeekStart(wed, 'monday')).toBe('2026-03-16');
  });

  test('returns Sunday for sunday reset on a Wednesday', () => {
    const wed = new Date(2026, 2, 18); // Wed Mar 18
    expect(getCurrentWeekStart(wed, 'sunday')).toBe('2026-03-15');
  });

  test('returns same day when date IS the reset day (Monday)', () => {
    const mon = new Date(2026, 2, 16); // Mon Mar 16
    expect(getCurrentWeekStart(mon, 'monday')).toBe('2026-03-16');
  });

  test('returns same day when date IS the reset day (Sunday)', () => {
    const sun = new Date(2026, 2, 15); // Sun Mar 15
    expect(getCurrentWeekStart(sun, 'sunday')).toBe('2026-03-15');
  });
});

describe('getCurrentMonth', () => {
  test('returns YYYY-MM format', () => {
    const d = new Date(2026, 2, 20);
    expect(getCurrentMonth(d)).toBe('2026-03');
  });

  test('zero-pads single-digit month', () => {
    const d = new Date(2026, 0, 1);
    expect(getCurrentMonth(d)).toBe('2026-01');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/shared/spendingTracker.test.ts --verbose`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Create the shared module**

Create `src/shared/spendingTracker.ts` with the pure helper functions extracted from `src/content/interceptor.ts` lines 28, 37-69:

```typescript
import { UserSettings, SpendingTracker, DEFAULT_SPENDING_TRACKER, sanitizeTracker } from './types';
import { log, debug } from './logger';

export const SPENDING_KEY = 'hcSpending';

export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getCurrentWeekStart(date: Date = new Date(), resetDay: 'monday' | 'sunday' = 'monday'): string {
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

export function getCurrentMonth(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/shared/spendingTracker.test.ts --verbose`
Expected: PASS — all pure function tests green.

- [ ] **Step 5: Add chrome-dependent functions to the shared module**

Append to `src/shared/spendingTracker.ts` — these are the load/save/record functions extracted from `interceptor.ts` lines 83-142, with session logic removed and auto-save on reset added:

```typescript
export async function loadSpendingTracker(settings: UserSettings): Promise<SpendingTracker> {
  try {
    const result = await chrome.storage.local.get(SPENDING_KEY);
    const tracker: SpendingTracker = sanitizeTracker(result[SPENDING_KEY] || { ...DEFAULT_SPENDING_TRACKER });

    // Backfill new fields for existing installs
    if (tracker.weeklyTotal === undefined) tracker.weeklyTotal = 0;
    if (!tracker.weeklyStartDate) tracker.weeklyStartDate = '';
    if (tracker.monthlyTotal === undefined) tracker.monthlyTotal = 0;
    if (!tracker.monthlyMonth) tracker.monthlyMonth = '';

    let dirty = false;

    const today = formatLocalDate(new Date());
    if (tracker.dailyDate !== today) {
      tracker.dailyTotal = 0;
      tracker.dailyDate = today;
      dirty = true;
    }

    const currentWeekStart = getCurrentWeekStart(new Date(), settings.weeklyResetDay ?? 'monday');
    if (tracker.weeklyStartDate !== currentWeekStart) {
      tracker.weeklyTotal = 0;
      tracker.weeklyStartDate = currentWeekStart;
      dirty = true;
    }

    const currentMonth = getCurrentMonth();
    if (tracker.monthlyMonth !== currentMonth) {
      tracker.monthlyTotal = 0;
      tracker.monthlyMonth = currentMonth;
      dirty = true;
    }

    if (dirty) {
      await saveSpendingTracker(tracker);
    }

    return tracker;
  } catch (e) {
    debug('Failed to load spending tracker:', e);
    return { ...DEFAULT_SPENDING_TRACKER };
  }
}

export async function saveSpendingTracker(tracker: SpendingTracker): Promise<void> {
  try {
    await chrome.storage.local.set({ [SPENDING_KEY]: sanitizeTracker(tracker) });
  } catch (e) {
    debug('Failed to save spending tracker:', e);
  }
}

export async function recordPurchase(
  priceValue: number | null,
  settings: UserSettings,
  tracker: SpendingTracker,
): Promise<void> {
  if (priceValue && priceValue > 0) {
    const priceWithTax = Math.round(priceValue * (1 + settings.taxRate / 100) * 100) / 100;
    const before = tracker.dailyTotal;
    tracker.dailyTotal = Math.round((tracker.dailyTotal + priceWithTax) * 100) / 100;
    tracker.weeklyTotal = Math.round((tracker.weeklyTotal + priceWithTax) * 100) / 100;
    tracker.monthlyTotal = Math.round((tracker.monthlyTotal + priceWithTax) * 100) / 100;
    tracker.dailyDate = formatLocalDate(new Date());
    log(`recordPurchase: +$${priceWithTax.toFixed(2)} (raw=$${priceValue.toFixed(2)}, tax=${settings.taxRate}%) — daily $${before.toFixed(2)} → $${tracker.dailyTotal.toFixed(2)}, weekly $${tracker.weeklyTotal.toFixed(2)}, monthly $${tracker.monthlyTotal.toFixed(2)}`);
  }
  tracker.lastProceedTimestamp = Date.now();
  await saveSpendingTracker(tracker);
}
```

- [ ] **Step 6: Commit**

```bash
git add src/shared/spendingTracker.ts tests/shared/spendingTracker.test.ts
git commit -m "feat: create shared spendingTracker module with reset logic"
```

---

### Task 3: Update interceptor to use shared module

**Files:**
- Modify: `src/content/interceptor.ts:28` (remove SPENDING_KEY)
- Modify: `src/content/interceptor.ts:37-69` (remove helper functions)
- Modify: `src/content/interceptor.ts:83-142` (remove loadSpendingTracker, saveSpendingTracker, recordPurchase)
- Modify: `src/content/interceptor.ts:430-433,443` (remove sessionInfo overlay block)
- Modify: `src/content/interceptor.ts:1910-1914` (remove channel-switch session reset)

- [ ] **Step 1: Add import for shared module**

At the top of `src/content/interceptor.ts`, add import (near other imports):

```typescript
import { loadSpendingTracker, saveSpendingTracker, recordPurchase, formatLocalDate, getCurrentWeekStart, getCurrentMonth, SPENDING_KEY } from '../shared/spendingTracker';
```

- [ ] **Step 2: Remove local SPENDING_KEY constant**

Remove line 28: `const SPENDING_KEY = 'hcSpending';`

- [ ] **Step 3: Remove local helper functions**

Remove `formatLocalDate` (lines 37-42), `getCurrentWeekStart` (lines 48-60), `getCurrentMonth` (lines 65-69).

- [ ] **Step 4: Remove local loadSpendingTracker, saveSpendingTracker, recordPurchase**

Remove lines 83-142 (the `loadSpendingTracker`, `saveSpendingTracker`, and `recordPurchase` functions). These are now imported from the shared module.

- [ ] **Step 5: Remove sessionInfo overlay block**

Remove lines 430-433 (the `sessionInfo` variable and conditional) and the `${sessionInfo}` reference in the overlay template at line 443.

- [ ] **Step 6: Remove channel-switch session reset block**

Remove lines 1910-1914:
```typescript
// REMOVE:
  if (tracker.sessionChannel !== attempt.channel) {
    tracker.sessionTotal = 0;
    tracker.sessionChannel = attempt.channel;
  }
```

- [ ] **Step 7: Verify build compiles**

Run: `npx webpack --mode production`
Expected: Build succeeds with no TypeScript errors about missing session fields or duplicate identifiers. If build fails, do NOT retry — report the error.

- [ ] **Step 8: Commit**

```bash
git add src/content/interceptor.ts
git commit -m "maint: interceptor uses shared spendingTracker module, session logic removed"
```

---

### Task 4: Update popup to use shared loader and remove session UI

**Files:**
- Modify: `src/popup/popup.html:289-296` (remove session row)
- Modify: `src/popup/sections/limits.ts:5,21-23,62,115-121,158-182` (use shared loader, remove session refs)
- Modify: `src/popup/popup.ts:225-226` (use shared loader in updateEscalation)

- [ ] **Step 1: Remove session total row from popup.html**

Remove lines 289-296 from `src/popup/popup.html`:
```html
<!-- REMOVE this entire hc-row div: -->
        <div class="hc-row">
          <span class="hc-label">Session total
            <span class="escalation-info" tabindex="0">ⓘ
              <span class="info-tooltip-right" role="tooltip">Spending on the current channel this browsing session. Resets when you switch channels.</span>
            </span>
          </span>
          <span class="tracker-value" id="tracker-session">—</span>
        </div>
```

- [ ] **Step 2: Update limits.ts — imports and constant**

In `src/popup/sections/limits.ts`:
- Add import: `import { loadSpendingTracker, SPENDING_KEY } from '../../shared/spendingTracker';`
- Remove line 5: `const TRACKER_KEY = 'hcSpending';`
- Replace all remaining references to `TRACKER_KEY` with `SPENDING_KEY` (occurs at lines 112, 139, and 159 — the reset button handler, reset confirm handler, and refreshTracker)

- [ ] **Step 3: Update limits.ts — remove session element references**

Remove `trackerSessionEl` declaration (line 22):
```typescript
// REMOVE:
  const trackerSessionEl = el.querySelector<HTMLElement>('#tracker-session')!;
```

- [ ] **Step 4: Update limits.ts — remove session from reset summary**

In the reset button click handler (around lines 115-121), remove the session total from the summary:
```typescript
// REMOVE these lines:
    const session = tracker?.sessionTotal ?? 0;
    if (session > 0) parts.push(`session $${session.toFixed(2)}`);
```

- [ ] **Step 5: Update limits.ts — replace refreshTracker with shared loader**

Replace the `refreshTracker()` function (lines 158-182) with:

```typescript
  async function refreshTracker(): Promise<void> {
    const settingsResult = await chrome.storage.sync.get('hcSettings');
    const userSettings = migrateSettings(settingsResult['hcSettings'] || {});
    const tracker = await loadSpendingTracker(userSettings);

    trackerDailyEl.textContent = `$${(tracker.dailyTotal ?? 0).toFixed(2)}`;

    trackerWeeklyEl.textContent = `$${(tracker.weeklyTotal ?? 0).toFixed(2)}`;
    trackerMonthlyEl.textContent = `$${(tracker.monthlyTotal ?? 0).toFixed(2)}`;

    const weeklyEnabled = userSettings.weeklyCap?.enabled ?? false;
    const monthlyEnabled = userSettings.monthlyCap?.enabled ?? false;
    trackerWeeklyRowEl.hidden = !weeklyEnabled;
    trackerMonthlyRowEl.hidden = !monthlyEnabled;
  }
```

- [ ] **Step 6: Update popup.ts — use shared loader in updateEscalation**

In `src/popup/popup.ts`, add import:
```typescript
import { loadSpendingTracker } from '../shared/spendingTracker';
```

Replace lines 225-226 in `updateEscalation()`:
```typescript
// BEFORE:
      const trackerResult = await chrome.storage.local.get('hcSpending');
      const tracker: SpendingTracker = { ...DEFAULT_SPENDING_TRACKER, ...trackerResult['hcSpending'] };

// AFTER:
      const settingsResult = await chrome.storage.sync.get('hcSettings');
      const settings = migrateSettings(settingsResult['hcSettings'] || {});
      const tracker = await loadSpendingTracker(settings);
```

Note: `migrateSettings` is already imported in popup.ts (line 3).

- [ ] **Step 7: Clean up dead imports in popup.ts**

After the change, `DEFAULT_SPENDING_TRACKER` is no longer used in `popup.ts`. Remove it from the import on line 3. Check if `SpendingTracker` is still needed (the `tracker` variable is now inferred from `loadSpendingTracker`'s return type) — if not, remove it too.

- [ ] **Step 8: Verify build compiles**

Run: `npx webpack --mode production`
Expected: Build succeeds. If build fails, do NOT retry — report the error.

- [ ] **Step 9: Commit**

```bash
git add src/popup/popup.html src/popup/sections/limits.ts src/popup/popup.ts
git commit -m "fix: popup uses shared tracker loader, session total removed from UI"
```

---

### Task 5: Update options page

**Files:**
- Modify: `src/options/options.ts:1157-1158`

- [ ] **Step 1: Update reset confirmation text**

In `src/options/options.ts` line 1157, change:
```typescript
// BEFORE:
  if (!confirm('Reset all spending totals (daily, session, weekly, monthly) to $0?')) return;

// AFTER:
  if (!confirm('Reset all spending totals (daily, weekly, monthly) to $0?')) return;
```

- [ ] **Step 2: Import SPENDING_KEY and use it**

Add import at top of `src/options/options.ts`:
```typescript
import { SPENDING_KEY } from '../shared/spendingTracker';
```

Replace the raw string on line 1158:
```typescript
// BEFORE:
  await chrome.storage.local.remove('hcSpending');

// AFTER:
  await chrome.storage.local.remove(SPENDING_KEY);
```

Also update the debug display function (around line 1168):
```typescript
// BEFORE:
  const result = await chrome.storage.local.get('hcSpending');

// AFTER:
  const result = await chrome.storage.local.get(SPENDING_KEY);
```

- [ ] **Step 3: Verify build compiles**

Run: `npx webpack --mode production`
Expected: Build succeeds. If build fails, do NOT retry — report the error.

- [ ] **Step 4: Commit**

```bash
git add src/options/options.ts
git commit -m "maint: remove session from options reset text, use shared SPENDING_KEY"
```

---

### Task 6: Run all tests and final build

- [ ] **Step 1: Run full test suite**

Run: `npx jest --verbose`
Expected: All tests pass.

- [ ] **Step 2: Run production build**

Run: `npx webpack --mode production`
Expected: Clean build, no errors.

- [ ] **Step 3: Commit any remaining fixes if needed**

Only if tests or build revealed issues.

---

### Task 7: Version bump and project docs

**Files:**
- Modify: `manifest.json`
- Modify: `package.json`
- Modify: `MTS-TODO.md`
- Modify: `MTS-Project-Document.md`

- [ ] **Step 1: Bump version to 0.4.28**

In `manifest.json`: update `"version"` to `"0.4.28"`
In `package.json`: update `"version"` to `"0.4.28"`

- [ ] **Step 2: Run final build**

Run: `npx webpack --mode production`
Expected: Clean build with version 0.4.28 baked in.

- [ ] **Step 3: Update MTS-TODO.md**

Mark the tracker reset fix as complete, update version and date.

- [ ] **Step 4: Update MTS-Project-Document.md**

Update the spending tracker section to reflect that session tracking has been removed and all totals now reset correctly from any entry point (popup or content script).

- [ ] **Step 5: Commit**

```bash
git add manifest.json package.json MTS-TODO.md MTS-Project-Document.md
git commit -m "maint: bump version to 0.4.28 for tracker reset fix"
```
