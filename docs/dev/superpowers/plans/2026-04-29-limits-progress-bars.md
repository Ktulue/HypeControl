# Limits Progress Bars in Popup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the popup Limits section's plain-text spending tracker rows with the same visual progress bars the friction overlay already renders. Bars only show when their cap is enabled; cap-disabled rows fall back to existing behavior.

**Architecture:** Extract `getCapColorClass` and `buildCapProgressBar` from `src/content/interceptor.ts` into a new shared module `src/shared/capBar.ts`. The friction overlay continues to import from there; the popup's `limits.ts` imports the same widget and renders bars into new sibling slots in `popup.html`. Cap-amount changes in the popup trigger a live bar repaint via the existing `onCapChange` callback chain. CSS variables and `.hc-cap-bar*` rules are added to `popup.css`.

**Tech Stack:** TypeScript, Chrome Extension MV3, webpack, Jest + ts-jest (node env), `chrome.storage.sync` (settings) / `chrome.storage.local` (tracker).

**Spec:** `docs/dev/superpowers/specs/2026-04-29-limits-progress-bars-design.md`

**Branch:** `feat/limits-progress-bars-in-popup` (already created)

**Versioning note for executors:** Do NOT bump versions during this plan. The release process is separate per `docs/dev/RELEASE-PROCESS.md`.

---

## File Map

| Path | Status | Responsibility |
|------|--------|----------------|
| `src/shared/capBar.ts` | NEW | Pure functions: tier classification + bar HTML construction. Single source of truth for the bar widget. |
| `tests/shared/capBar.test.ts` | NEW | Unit tests for `getCapColorClass` and `buildCapProgressBar`, including the new amount guard. |
| `src/content/interceptor.ts` | MODIFY | Remove local copies of bar functions; import from shared module. No behavior change. |
| `src/popup/popup.html` | MODIFY | Add `id="tracker-daily-text"` to Daily row; add three sibling `<div class="hc-cap-bar-host">` slots. |
| `src/popup/popup.css` | MODIFY | Add `--hc-*` variables to `:root` + `[data-theme="light"]`; add `.hc-cap-bar*` and tier rules; add `.hc-cap-bar-host`. |
| `src/popup/sections/limits.ts` | MODIFY | Render bars in `refreshTracker()`; switch cap-value source to `getPending()`; toggle bar/text visibility per cap state. |
| `src/popup/popup.ts` | MODIFY | Extend `onCapChange` callback in `initLimits` call to also invoke `limits.refreshTracker()` so cap edits live-update bars. |
| `docs/dev/HypeControl-TODO.md` | MODIFY | Mark feature complete after manual test pass. |

---

## Task 1: Create shared `capBar.ts` module with tests

**Files:**
- Create: `src/shared/capBar.ts`
- Create: `tests/shared/capBar.test.ts`

This task introduces the new shared module via TDD. The functions are extracted from `interceptor.ts:318-356`, with one new behavior: when `capAmount <= 0`, `buildCapProgressBar` returns `''` (empty string) so callers can skip rendering instead of producing a divide-by-zero bar.

- [ ] **Step 1: Write the failing test file**

Create `tests/shared/capBar.test.ts` with the following content:

```typescript
import { getCapColorClass, buildCapProgressBar } from '../../src/shared/capBar';

describe('getCapColorClass', () => {
  test('returns hc-cap-green when percentage is 0', () => {
    expect(getCapColorClass(0)).toBe('hc-cap-green');
  });

  test('returns hc-cap-green when percentage is 59', () => {
    expect(getCapColorClass(59)).toBe('hc-cap-green');
  });

  test('returns hc-cap-yellow at exactly 60', () => {
    expect(getCapColorClass(60)).toBe('hc-cap-yellow');
  });

  test('returns hc-cap-yellow when percentage is 79', () => {
    expect(getCapColorClass(79)).toBe('hc-cap-yellow');
  });

  test('returns hc-cap-orange at exactly 80', () => {
    expect(getCapColorClass(80)).toBe('hc-cap-orange');
  });

  test('returns hc-cap-orange when percentage is 99', () => {
    expect(getCapColorClass(99)).toBe('hc-cap-orange');
  });

  test('returns hc-cap-red at exactly 100', () => {
    expect(getCapColorClass(100)).toBe('hc-cap-red');
  });

  test('returns hc-cap-red when percentage exceeds 100', () => {
    expect(getCapColorClass(150)).toBe('hc-cap-red');
  });
});

describe('buildCapProgressBar', () => {
  test('returns empty string when capAmount is 0', () => {
    expect(buildCapProgressBar('Daily', 10, 0, 0)).toBe('');
  });

  test('returns empty string when capAmount is negative', () => {
    expect(buildCapProgressBar('Daily', 10, 0, -5)).toBe('');
  });

  test('renders a bar with 0% green when current and delta are 0', () => {
    const html = buildCapProgressBar('Daily', 0, 0, 100);
    expect(html).toContain('hc-cap-green');
    expect(html).toContain('Daily');
    expect(html).toContain('$0.00 / $100.00');
    expect(html).toContain('(0%)');
    expect(html).toContain('width: 0%');
  });

  test('renders 50% green bar when current is 50 of 100', () => {
    const html = buildCapProgressBar('Daily', 50, 0, 100);
    expect(html).toContain('hc-cap-green');
    expect(html).toContain('$50.00 / $100.00');
    expect(html).toContain('(50%)');
    expect(html).toContain('width: 50%');
  });

  test('renders 60% yellow bar at the green/yellow boundary', () => {
    const html = buildCapProgressBar('Weekly', 60, 0, 100);
    expect(html).toContain('hc-cap-yellow');
    expect(html).toContain('Weekly');
    expect(html).toContain('(60%)');
  });

  test('renders 85% orange bar', () => {
    const html = buildCapProgressBar('Monthly', 85, 0, 100);
    expect(html).toContain('hc-cap-orange');
    expect(html).toContain('Monthly');
    expect(html).toContain('(85%)');
  });

  test('renders 100% red bar with OVER BUDGET when newTotal exactly equals capAmount', () => {
    // Boundary: newTotal == capAmount is treated as 100% (red), not over-budget.
    const html = buildCapProgressBar('Daily', 100, 0, 100);
    expect(html).toContain('hc-cap-red');
    expect(html).toContain('(100%)');
    expect(html).not.toContain('OVER BUDGET');
  });

  test('renders OVER BUDGET when newTotal exceeds capAmount', () => {
    const html = buildCapProgressBar('Daily', 120, 0, 100);
    expect(html).toContain('hc-cap-red');
    expect(html).toContain('$120.00 / $100.00');
    expect(html).toContain('OVER BUDGET');
    expect(html).not.toContain('(120%)');
  });

  test('caps fill width at 100% when over budget', () => {
    const html = buildCapProgressBar('Daily', 200, 0, 100);
    expect(html).toContain('width: 100%');
    expect(html).not.toContain('width: 200%');
  });

  test('adds purchaseAmount to currentTotal for the bar value', () => {
    // Friction-overlay use case: current $40, in-flight $20, cap $100 → 60% yellow
    const html = buildCapProgressBar('Daily', 40, 20, 100);
    expect(html).toContain('hc-cap-yellow');
    expect(html).toContain('$60.00 / $100.00');
    expect(html).toContain('(60%)');
  });

  test('rounds the displayed total to 2 decimals', () => {
    const html = buildCapProgressBar('Daily', 10.005, 0, 100);
    // Math.round((10.005 + 0) * 100) / 100 = 10.01
    expect(html).toContain('$10.01');
  });

  test('emits all four required structural classes', () => {
    const html = buildCapProgressBar('Daily', 50, 0, 100);
    expect(html).toContain('class="hc-cap-bar hc-cap-green"');
    expect(html).toContain('class="hc-cap-bar__header"');
    expect(html).toContain('class="hc-cap-bar__label"');
    expect(html).toContain('class="hc-cap-bar__value"');
    expect(html).toContain('class="hc-cap-bar__track"');
    expect(html).toContain('class="hc-cap-bar__fill"');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
npx jest tests/shared/capBar.test.ts
```

Expected: ALL tests fail with `Cannot find module '../../src/shared/capBar'` or equivalent. The module does not exist yet.

- [ ] **Step 3: Implement the shared module**

Create `src/shared/capBar.ts` with the following content:

```typescript
/**
 * Determine the color tier for a cap progress bar.
 * Green < 60%, Yellow 60–79%, Orange 80–99%, Red 100%+
 */
export function getCapColorClass(percentage: number): string {
  if (percentage >= 100) return 'hc-cap-red';
  if (percentage >= 80) return 'hc-cap-orange';
  if (percentage >= 60) return 'hc-cap-yellow';
  return 'hc-cap-green';
}

/**
 * Build a single cap progress bar HTML string.
 *
 * Label is constrained to known static values — never user-controlled.
 * Numeric values are computed internally. innerHTML of this string is safe.
 *
 * Returns '' (empty string) when `capAmount <= 0`. Callers must treat empty
 * output as "no bar to render" and skip emitting it. This guards against
 * divide-by-zero displays when a cap is enabled but its amount has not been
 * set, and is used by both the friction overlay and the popup Limits section.
 *
 * @param label Hardcoded period label: 'Daily' | 'Weekly' | 'Monthly'.
 * @param currentTotal Already-spent amount for the period.
 * @param purchaseAmount Additional amount being attempted (overlay) or 0 (popup).
 * @param capAmount Configured cap for the period.
 */
export function buildCapProgressBar(
  label: 'Daily' | 'Weekly' | 'Monthly',
  currentTotal: number,
  purchaseAmount: number,
  capAmount: number,
): string {
  if (capAmount <= 0) return '';

  const newTotal = Math.round((currentTotal + purchaseAmount) * 100) / 100;
  const percentage = Math.round((newTotal / capAmount) * 100);
  const barWidth = Math.min(percentage, 100);
  const colorClass = getCapColorClass(percentage);
  const overBudget = newTotal > capAmount;

  return `
    <div class="hc-cap-bar ${colorClass}">
      <div class="hc-cap-bar__header">
        <span class="hc-cap-bar__label">${label}</span>
        <span class="hc-cap-bar__value">$${newTotal.toFixed(2)} / $${capAmount.toFixed(2)}${overBudget ? ' — OVER BUDGET' : ` (${percentage}%)`}</span>
      </div>
      <div class="hc-cap-bar__track">
        <div class="hc-cap-bar__fill" style="width: ${barWidth}%"></div>
      </div>
    </div>
  `;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
npx jest tests/shared/capBar.test.ts
```

Expected: ALL tests pass (15 tests across the two `describe` blocks).

- [ ] **Step 5: Commit**

```bash
git add src/shared/capBar.ts tests/shared/capBar.test.ts
git commit -m "feat: extract cap bar widget into shared module

New src/shared/capBar.ts exposes getCapColorClass and buildCapProgressBar
as pure functions, ready to be reused by the popup Limits section.

Adds capAmount<=0 guard: returns '' instead of dividing by zero. Callers
must skip rendering when output is empty.

Tests cover all four tier boundaries, OVER BUDGET formatting, fill-width
clamping, and the new guard."
```

---

## Task 2: Migrate `interceptor.ts` to use the shared module

**Files:**
- Modify: `src/content/interceptor.ts:318-357` (remove local function definitions, add import)

This is a verbatim swap — the friction overlay's behavior must not change. Tests pass = local copy was redundant.

- [ ] **Step 1: Add the import to `interceptor.ts`**

Find the existing imports near the top of `src/content/interceptor.ts` (look for the block of `import` statements). Add this line, sorted near the other `../shared/*` imports:

```typescript
import { buildCapProgressBar } from '../shared/capBar';
```

Note: We do NOT need to import `getCapColorClass` because it's only called internally by `buildCapProgressBar`, and the local interceptor code never called `getCapColorClass` directly outside of `buildCapProgressBar`.

- [ ] **Step 2: Delete the local function definitions**

Delete lines 318–357 of `src/content/interceptor.ts` — the entire block from the `/**` comment of `getCapColorClass` through the closing brace of `buildCapProgressBar` (inclusive). The exact block to remove:

```typescript
/**
 * Determine the color tier for a cap progress bar.
 * Green < 60%, Yellow 60–79%, Orange 80–99%, Red 100%+
 */
function getCapColorClass(percentage: number): string {
  if (percentage >= 100) return 'hc-cap-red';
  if (percentage >= 80) return 'hc-cap-orange';
  if (percentage >= 60) return 'hc-cap-yellow';
  return 'hc-cap-green';
}

/**
 * Build a single cap progress bar HTML string.
 * Label is constrained to known static values — never user-controlled.
 * Numeric values are computed internally. innerHTML is safe here.
 */
function buildCapProgressBar(
  label: 'Daily' | 'Weekly' | 'Monthly',
  currentTotal: number,
  purchaseAmount: number,
  capAmount: number,
): string {
  const newTotal = Math.round((currentTotal + purchaseAmount) * 100) / 100;
  const percentage = Math.round((newTotal / capAmount) * 100);
  const barWidth = Math.min(percentage, 100);
  const colorClass = getCapColorClass(percentage);
  const overBudget = newTotal > capAmount;

  return `
    <div class="hc-cap-bar ${colorClass}">
      <div class="hc-cap-bar__header">
        <span class="hc-cap-bar__label">${label}</span>
        <span class="hc-cap-bar__value">$${newTotal.toFixed(2)} / $${capAmount.toFixed(2)}${overBudget ? ' — OVER BUDGET' : ` (${percentage}%)`}</span>
      </div>
      <div class="hc-cap-bar__track">
        <div class="hc-cap-bar__fill" style="width: ${barWidth}%"></div>
      </div>
    </div>
  `;
}
```

The `buildCostBreakdown` function below (which calls `buildCapProgressBar`) stays unchanged — it now resolves the call to the imported function.

**Note on the new `capAmount <= 0` guard:** `buildCostBreakdown` already wraps each call in `if (settings.dailyCap.enabled)` etc., but does NOT check the amount. After this migration, the shared function returns `''` for amount=0, and the existing `if (capBars)` check at line 381 will produce an empty `<div class="hc-cap-bars">` if all caps return empty. Add a defensive check in `buildCostBreakdown` to skip the wrapper when `capBars === ''`:

```typescript
const capSection = capBars.trim() ? `<div class="hc-cap-bars">${capBars}</div>` : '';
```

(The original used a truthiness check on `capBars` which is `''` for empty — already correct. The `.trim()` adds safety against whitespace-only template output. Verify by reading the current line 381 and only adjust if the existing check is loose enough to render empty wrappers.)

- [ ] **Step 3: Run the existing test suite to verify nothing broke**

Run:
```bash
npx jest
```

Expected: all existing tests pass plus the 15 new `capBar.test.ts` tests. Total test count goes up by 15 from before Task 1. No failures.

- [ ] **Step 4: Build the extension to verify the migration compiles**

Run:
```bash
npm run build
```

Expected: build succeeds with no errors. `dist/` contains the rebuilt extension.

- [ ] **Step 5: Manual smoke test of the friction overlay**

Load the unpacked extension from `dist/` in Chrome (chrome://extensions → Developer mode → Load unpacked → select `dist/`).

1. In settings (popup), enable a daily cap of $50.
2. Click Save.
3. Visit a Twitch channel and attempt a Bits purchase (or use the test panel if available — see `src/content/tourPanel.ts`).
4. Confirm the friction overlay still renders the daily cap progress bar exactly as before — same color, same `$X.XX / $50.00 (NN%)` formatting, same fill width.

If the bar is missing or visually different from the v1.1.2 baseline, the migration broke something. Investigate before proceeding.

- [ ] **Step 6: Commit**

```bash
git add src/content/interceptor.ts
git commit -m "refactor: interceptor reuses shared capBar module

Delete local getCapColorClass and buildCapProgressBar; import from
src/shared/capBar instead. No behavior change for the friction overlay;
manual smoke-tested against a real Twitch purchase attempt."
```

---

## Task 3: Add CSS variables and bar styles to `popup.css`

**Files:**
- Modify: `src/popup/popup.css` (variables and rules added; line numbers will shift, so the steps below describe targets by selector, not by line number)

- [ ] **Step 1: Add `--hc-*` variables to `:root` block**

Find the `:root { ... }` block in `src/popup/popup.css` (currently around lines 27–46). At the end of the existing variable list (after `--accent-text: #bf94ff;`), add:

```css
  /* Bar widget tokens (mirror src/content/styles.css for the shared .hc-cap-bar* rules) */
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

- [ ] **Step 2: Add light-mode overrides to `[data-theme="light"]`**

Find the `[data-theme="light"] { ... }` block (currently around lines 49–63). Append at the end of the block, before the closing `}`:

```css
  /* Bar widget light-mode overrides */
  --hc-success: #16A34A;
  --hc-warning: #EA580C;
  --hc-caution: #CA8A04;
  --hc-caution-rgb: 202, 138, 4;
```

`--hc-danger` and `--hc-danger-rgb` are not overridden in light mode (the danger red stays the same per `src/content/styles.css`).

- [ ] **Step 3: Append the bar widget rules**

Append the following block to the end of `src/popup/popup.css`. Pick a location after all existing rules but before any final `@media` blocks if present.

```css
/* ─── Cap progress bars (shared widget — mirrors src/content/styles.css) ─── */

.hc-cap-bar-host {
  /* Match the vertical rhythm of sibling .hc-row elements inside .hc-group */
  margin-top: 8px;
}

.hc-cap-bar {
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid transparent;
}

.hc-cap-bar__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 4px;
}

.hc-cap-bar__label {
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.hc-cap-bar__track {
  height: 4px;
  background: var(--hc-progress-bg, #2a2a2e);
  border-radius: 2px;
  overflow: hidden;
}

.hc-cap-bar__fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

/* Color tiers */
.hc-cap-green {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.2);
  color: var(--hc-success);
}
.hc-cap-green .hc-cap-bar__fill {
  background: var(--hc-success);
}

.hc-cap-yellow {
  background: rgba(var(--hc-caution-rgb), 0.1);
  border-color: rgba(var(--hc-caution-rgb), 0.2);
  color: var(--hc-caution);
}
.hc-cap-yellow .hc-cap-bar__fill {
  background: var(--hc-caution);
}

.hc-cap-orange {
  background: rgba(var(--hc-warning-rgb), 0.1);
  border-color: rgba(var(--hc-warning-rgb), 0.2);
  color: var(--hc-warning);
}
.hc-cap-orange .hc-cap-bar__fill {
  background: var(--hc-warning);
}

.hc-cap-red {
  background: rgba(var(--hc-danger-rgb), 0.1);
  border-color: rgba(var(--hc-danger-rgb), 0.2);
  color: var(--hc-danger);
}
.hc-cap-red .hc-cap-bar__fill {
  background: var(--hc-danger);
}
```

- [ ] **Step 4: Build the extension**

Run:
```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Reload the unpacked extension and verify no visual regressions**

Reload the extension at chrome://extensions. Open the popup. The Limits section should still look identical to before — no bars yet because the HTML and rendering haven't been updated. Verify nothing else is broken by the new CSS rules (they're scoped to `.hc-cap-bar*` so should not bleed).

- [ ] **Step 6: Commit**

```bash
git add src/popup/popup.css
git commit -m "feat(popup): add cap bar CSS variables and tier styles

Adds the --hc-* color tokens that the shared .hc-cap-bar* rules expect,
plus the bar widget styles themselves. Light-mode overrides match the
friction overlay. .hc-cap-bar-host spacer aligns bars with the existing
.hc-row rhythm in .hc-group."
```

---

## Task 4: Add bar host slots and IDs to `popup.html`

**Files:**
- Modify: `src/popup/popup.html` around the Limits section (currently lines 308–335) — specifically the `.hc-group` block containing the tracker rows.

- [ ] **Step 1: Add `id="tracker-daily-text"` to the Daily row**

Find this block (around line 309–312):

```html
<div class="hc-row">
  <span class="hc-label">Daily total</span>
  <span class="tracker-value" id="tracker-daily">—</span>
</div>
```

Change it to:

```html
<div class="hc-row" id="tracker-daily-text">
  <span class="hc-label">Daily total</span>
  <span class="tracker-value" id="tracker-daily">—</span>
</div>
```

- [ ] **Step 2: Add bar host slots after each tracker text row**

Insert a `<div class="hc-cap-bar-host" ...>` element immediately after each of the three tracker rows. Final structure for the daily/weekly/monthly block:

```html
<div class="hc-row" id="tracker-daily-text">
  <span class="hc-label">Daily total</span>
  <span class="tracker-value" id="tracker-daily">—</span>
</div>
<div class="hc-cap-bar-host" id="tracker-daily-bar" hidden></div>
<div class="hc-row" id="tracker-weekly-row" hidden>
  <span class="hc-label">Weekly total</span>
  <span class="tracker-value" id="tracker-weekly">—</span>
</div>
<div class="hc-cap-bar-host" id="tracker-weekly-bar" hidden></div>
<div class="hc-row" id="tracker-monthly-row" hidden>
  <span class="hc-label">Monthly total</span>
  <span class="tracker-value" id="tracker-monthly">—</span>
</div>
<div class="hc-cap-bar-host" id="tracker-monthly-bar" hidden></div>
```

Note that the savings calendar row, calendar container, and reset row that follow this block stay exactly where they are — no changes there.

- [ ] **Step 3: Build the extension**

Run:
```bash
npm run build
```

Expected: build succeeds. (Webpack will copy `popup.html` to `dist/popup.html`.)

- [ ] **Step 4: Reload and verify popup still works**

Reload the unpacked extension. Open the popup. The Limits section should look identical to before — the new bar host slots are all `hidden`, so visually nothing changes. Verify the tracker text rows still display dollar amounts. Verify Reset Tracker still works.

- [ ] **Step 5: Commit**

```bash
git add src/popup/popup.html
git commit -m "feat(popup): add cap bar host slots in Limits section

Adds three hidden <div class='hc-cap-bar-host'> siblings, one per
tracker row, ready to host the bar widget. Daily row gains
id='tracker-daily-text' so it can be toggled. No visual change yet —
slots stay hidden until limits.ts wires up the rendering."
```

---

## Task 5: Render bars in `limits.ts`

**Files:**
- Modify: `src/popup/sections/limits.ts` (entire `refreshTracker` function plus surrounding element refs and imports)

This is the core wiring change. The function picks bar-vs-text per row based on the cap-enabled state, reads cap values from `getPending()` (the popup's live in-memory state, not saved settings) so cap-input edits update bars immediately, and uses tracker totals from `chrome.storage.local`.

- [ ] **Step 1: Add the import**

Open `src/popup/sections/limits.ts`. Find the existing imports at the top of the file. Add:

```typescript
import { buildCapProgressBar } from '../../shared/capBar';
```

- [ ] **Step 2: Acquire references to the new DOM elements**

Inside `initLimits`, find the block of `el.querySelector<...>(...)` declarations (currently lines 16–34). Add the following references at the end of that block, before the event-listener wiring begins:

```typescript
  // Tracker rows + bar host slots (one pair per period)
  const trackerDailyTextEl = el.querySelector<HTMLElement>('#tracker-daily-text')!;
  const trackerDailyBarEl = el.querySelector<HTMLElement>('#tracker-daily-bar')!;
  const trackerWeeklyBarEl = el.querySelector<HTMLElement>('#tracker-weekly-bar')!;
  const trackerMonthlyBarEl = el.querySelector<HTMLElement>('#tracker-monthly-bar')!;
```

The existing `trackerDailyEl`, `trackerWeeklyEl`, `trackerMonthlyEl` (the value spans inside the text rows) and `trackerWeeklyRowEl`, `trackerMonthlyRowEl` (the row containers for weekly/monthly) stay as-is.

- [ ] **Step 3: Replace the body of `refreshTracker()` with bar-aware rendering**

Find the existing `refreshTracker()` function (currently lines 160–174):

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

Replace it with:

```typescript
async function refreshTracker(): Promise<void> {
  // Cap config comes from pending state so live edits to cap inputs
  // update the bars before the user clicks Save.
  const pending = getPending();
  // Tracker totals come from chrome.storage.local (read-only here — popup
  // never mutates the tracker). loadSpendingTracker handles auto-resets.
  const settingsForTracker = await (async () => {
    const stored = await chrome.storage.sync.get('hcSettings');
    return migrateSettings(stored['hcSettings'] || {});
  })();
  const tracker = await loadSpendingTracker(settingsForTracker);

  const dailyTotal = tracker.dailyTotal ?? 0;
  const weeklyTotal = tracker.weeklyTotal ?? 0;
  const monthlyTotal = tracker.monthlyTotal ?? 0;

  // Always set the text-value spans — they're the fallback when no bar renders.
  trackerDailyEl.textContent = `$${dailyTotal.toFixed(2)}`;
  trackerWeeklyEl.textContent = `$${weeklyTotal.toFixed(2)}`;
  trackerMonthlyEl.textContent = `$${monthlyTotal.toFixed(2)}`;

  // Daily: cap on → bar; cap off → text row (always visible per current behavior).
  renderCapRow(
    'Daily',
    dailyTotal,
    pending.dailyCap,
    trackerDailyTextEl,
    trackerDailyBarEl,
    /* showTextWhenCapOff */ true,
  );

  // Weekly/Monthly: cap on → bar; cap off → entire row hidden (current behavior).
  renderCapRow(
    'Weekly',
    weeklyTotal,
    pending.weeklyCap,
    trackerWeeklyRowEl,
    trackerWeeklyBarEl,
    /* showTextWhenCapOff */ false,
  );
  renderCapRow(
    'Monthly',
    monthlyTotal,
    pending.monthlyCap,
    trackerMonthlyRowEl,
    trackerMonthlyBarEl,
    /* showTextWhenCapOff */ false,
  );
}
```

- [ ] **Step 4: Add the `renderCapRow` helper above `refreshTracker`**

Add this helper function to `src/popup/sections/limits.ts`, immediately above the `refreshTracker` function (still inside the `initLimits` closure, so it has access to nothing it shouldn't):

```typescript
/**
 * Render one tracker row as either a progress bar (cap enabled with non-zero
 * amount) or as a plain text row / hidden state (cap disabled or amount=0).
 *
 * @param textRowEl The .hc-row element holding the label + value spans.
 * @param barHostEl The sibling .hc-cap-bar-host slot.
 * @param showTextWhenCapOff true for daily (always visible), false for
 *   weekly/monthly (hidden until their cap is enabled).
 */
function renderCapRow(
  label: 'Daily' | 'Weekly' | 'Monthly',
  total: number,
  cap: { enabled: boolean; amount: number },
  textRowEl: HTMLElement,
  barHostEl: HTMLElement,
  showTextWhenCapOff: boolean,
): void {
  const barHtml = cap.enabled
    ? buildCapProgressBar(label, total, 0, cap.amount)
    : '';

  if (barHtml) {
    barHostEl.innerHTML = barHtml;
    barHostEl.hidden = false;
    textRowEl.hidden = true;
  } else {
    barHostEl.innerHTML = '';
    barHostEl.hidden = true;
    textRowEl.hidden = !showTextWhenCapOff;
  }
}
```

- [ ] **Step 5: Run the existing test suite**

Run:
```bash
npx jest
```

Expected: all tests pass. There are no DOM-rendering tests for `limits.ts`, but the existing tests (escalation, spendingTracker, types, etc.) should be unaffected.

- [ ] **Step 6: Build the extension**

Run:
```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 7: Manual smoke test of bar rendering**

Reload the unpacked extension. Open the popup.

1. Confirm no caps enabled: the Limits section shows plain `Daily total $X.XX` only (weekly/monthly hidden). Same as today.
2. Enable Daily cap, set amount to $50, click Save Settings, reopen popup. Confirm the Daily row now shows a green bar `DAILY $0.00 / $50.00 (0%)` (or whatever the current daily total is). The plain text row is hidden.
3. Enable Weekly + Monthly caps with non-zero amounts, click Save, reopen. Confirm both render as bars.
4. Disable Daily cap, click Save, reopen. Confirm the green bar disappears and the plain text row reappears.

Live updates from cap-input edits don't work yet — that comes in Task 6.

- [ ] **Step 8: Commit**

```bash
git add src/popup/sections/limits.ts
git commit -m "feat(popup): render cap progress bars in Limits section

refreshTracker() now picks per-row between bar (cap enabled) and text
(cap disabled). Cap config sourced from pending state so future cap
input edits can repaint bars without saving first. Tracker totals
still read from chrome.storage.local."
```

---

## Task 6: Wire `refreshTracker` into the `onCapChange` callback

**Files:**
- Modify: `src/popup/popup.ts:244` (the `initLimits` call inside `main()`)

Today, the `onCapChange` callback only triggers escalation recomputation. We need it to also repaint the bars so cap toggles and amount edits update visually before Save.

- [ ] **Step 1: Update the `onCapChange` callback**

Find the existing line in `src/popup/popup.ts` (around line 244):

```typescript
const limits = initLimits(limitsEl, { onCapChange: () => updateEscalation() });
```

Replace it with:

```typescript
const limits = initLimits(limitsEl, {
  onCapChange: () => {
    updateEscalation();
    // Repaint cap progress bars on cap toggle/amount edits.
    // limits is in the closure scope; resolved at call-time, not init-time
    // (same pattern updateEscalation uses to reach `friction`).
    limits.refreshTracker();
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors. The `limits` reference inside the callback resolves at runtime via closure, the same pattern `updateEscalation()` already uses to reach `friction`.

If TypeScript complains about "Block-scoped variable 'limits' used before its declaration," investigate — `updateEscalation`'s reference to `friction` works because TS allows the use inside function/arrow bodies as long as actual invocation happens later. If somehow this is rejected here, fall back to:

```typescript
let limitsRef: ReturnType<typeof initLimits> | null = null;
const limits = initLimits(limitsEl, {
  onCapChange: () => {
    updateEscalation();
    limitsRef?.refreshTracker();
  },
});
limitsRef = limits;
```

- [ ] **Step 3: Run the test suite**

Run:
```bash
npx jest
```

Expected: all tests pass.

- [ ] **Step 4: Build**

Run:
```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Manual smoke test of live updates**

Reload the unpacked extension. Open the popup.

1. Enable Daily cap, set amount to $50. As you edit the amount input (don't click Save), the bar percentage should update live with each keystroke.
2. Toggle Daily cap off — bar disappears immediately, text row reappears.
3. Toggle Daily cap on — bar reappears immediately.
4. Click Save Settings. Close and reopen popup. Confirm the bar persists with the saved cap amount.

- [ ] **Step 6: Commit**

```bash
git add src/popup/popup.ts
git commit -m "feat(popup): live-update cap bars on toggle/amount edits

Extends the Limits onCapChange callback to also call refreshTracker()
so the bars repaint as the user toggles caps or edits cap amount inputs
— no Save click required for visual feedback."
```

---

## Task 7: Run the full manual test plan from the spec

**Files:** none (verification task)

This task executes test cases #1–12 from `docs/dev/superpowers/specs/2026-04-29-limits-progress-bars-design.md` "Manual Test Plan" section. No code changes; if any case fails, return to the responsible task and fix.

- [ ] **Step 1: Reload the unpacked extension fresh**

At chrome://extensions, click "Reload" on the Hype Control extension. Then close any open popups.

- [ ] **Step 2: Execute test case #1 — fresh / no caps**

Disable all three caps (daily, weekly, monthly), click Save, reopen popup. Expected: Daily row shows plain `Daily total $X.XX`; weekly/monthly rows hidden. No bars visible. Pass/fail: ___.

- [ ] **Step 3: Execute test case #2 — enable daily cap**

Enable Daily cap, set $50, click Save, reopen. Expected: Daily row is now a green bar with `DAILY` on the left and `$X.XX / $50.00 (NN%)` on the right. Pass/fail: ___.

- [ ] **Step 4: Execute test case #3 — bar after a $10 intercepted purchase**

On a Twitch channel, attempt a $10 purchase via the Bits panel and complete the friction (let it through). Reopen popup. Expected: bar shows current-total / $50.00 (NN%) in green. Pass/fail: ___.

- [ ] **Step 5: Execute test case #4 — over budget**

Push the daily tracker over $50 by completing additional purchases (or temporarily set the daily cap to $5 if the tracker is already at $10+, then revert). Reopen popup. Expected: bar shows `$X.XX / $50.00 — OVER BUDGET` in red, fill at full width. Pass/fail: ___.

- [ ] **Step 6: Execute test case #5 — disable daily cap**

Toggle Daily cap off, click Save, reopen. Expected: bar disappears, plain text row reappears with current dollar value. Pass/fail: ___.

- [ ] **Step 7: Execute test case #6 — enable weekly + monthly**

Enable Weekly cap ($200) and Monthly cap ($800), click Save, reopen. Expected: both rows render as bars. Pass/fail: ___.

- [ ] **Step 8: Execute test case #7 — disable weekly cap**

Toggle Weekly cap off, click Save, reopen. Expected: weekly bar AND text row both hidden. Pass/fail: ___.

- [ ] **Step 9: Execute test case #8 — live edit of daily amount**

With Daily cap enabled at $50, click into the daily cap amount input, change to `20`. As you type, the bar's percentage and tier should update live (e.g., $10 spent / $20 cap = 50% green; $25 spent / $20 = OVER BUDGET red). Click Save. Reopen and confirm persists. Pass/fail: ___.

- [ ] **Step 10: Execute test case #9 — theme switch**

In Settings section, switch theme dark → light → auto. Bars should re-render with the appropriate light-mode hex values. Confirm green/yellow/orange/red all look correct in light mode (slightly darker shades than dark mode). Pass/fail: ___.

- [ ] **Step 11: Execute test case #10 — friction overlay regression**

On a Twitch channel, trigger a real friction event (Bits attempt, Sub attempt, or `/gift` command). Confirm the overlay's existing cap progress bars still render correctly — same color tier, same `$X.XX / $Y.YY (NN%)` formatting, same fill widths. Pass/fail: ___.

- [ ] **Step 12: Execute test case #11 — cap enabled with amount = 0**

Enable Daily cap, set amount to `0`, click Save. Reopen popup. Expected: no bar rendered for daily; plain text row visible (because the empty-string guard in `buildCapProgressBar` returned `''` and `renderCapRow` falls back to text-with-`showTextWhenCapOff=true`). Pass/fail: ___.

- [ ] **Step 13: Execute test case #12 — Reset Tracker**

With caps enabled and tracker > $0, click Reset Tracker, confirm with "Wipe it". Expected: all bars instantly re-render at 0% green. Pass/fail: ___.

- [ ] **Step 14: If any test case failed, return to the responsible task**

Match failures back to the implementing task:
- #1, #5, #7, #11 → likely Task 5 (limits.ts rendering logic)
- #2, #3, #6, #13 → likely Task 5 or Task 4 (markup / refresh)
- #4 → Task 1 (over-budget logic in capBar.ts)
- #8 → Task 6 (live update wiring)
- #9 → Task 3 (light-mode CSS variables)
- #10 → Task 2 (interceptor migration regression)
- #12 → Task 1 (capAmount<=0 guard)

If all pass, proceed to Task 8.

---

## Task 8: Update `HypeControl-TODO.md`

**Files:**
- Modify: `docs/dev/HypeControl-TODO.md`

- [ ] **Step 1: Read the current state of the TODO**

Run:
```bash
head -60 docs/dev/HypeControl-TODO.md
```

Note the format used for completed items, the `Updated` date, and `Current Version` fields.

- [ ] **Step 2: Add the completion entry**

In the appropriate section (likely an "Add-ons" or "v1.1.x" or similar block — match existing structure), add a checked entry along the lines of:

```markdown
- [x] **Limits Progress Bars in Popup** — Replaced plain text trackers in the popup Limits section with the same colored progress bar widget the friction overlay uses. Bars only render when their cap is enabled; cap-disabled rows fall back to current text behavior. Live updates on cap-input edits via the existing onCapChange callback. Spec: `docs/dev/superpowers/specs/2026-04-29-limits-progress-bars-design.md`. Plan: `docs/dev/superpowers/plans/2026-04-29-limits-progress-bars.md`.
```

Also update the `Updated:` date in the header (set to today's date — 2026-04-29 unless executing later) and the footer timestamp if one exists.

Do NOT update `Current Version` in the header — versioning is handled separately by `npm run release` per `docs/dev/RELEASE-PROCESS.md`.

- [ ] **Step 3: Commit**

```bash
git add docs/dev/HypeControl-TODO.md
git commit -m "docs: mark limits progress bars feature complete in TODO"
```

---

## Task 9: Push branch and open PR (NOT merge)

**Files:** none

- [ ] **Step 1: Run security review on the branch BEFORE pushing**

Per the user's standing feedback (`feedback_security_review_before_pr.md`), `/security-review` must run on the branch before opening the PR — treated as a non-negotiable pre-push gate.

In the Claude Code session, run:
```
/security-review
```

Expected: clean report. The new code is a CSS-and-DOM addition with no user-controlled data flowing into innerHTML (label is hardcoded constants, values are numeric). The shared module's amount guard is a defensive improvement.

If `/security-review` flags anything, address it before pushing.

- [ ] **Step 2: Push the branch**

Run:
```bash
git push -u origin feat/limits-progress-bars-in-popup
```

- [ ] **Step 3: Open the PR (do NOT merge)**

Per the user's standing rule: open the PR and stop. Never run `gh pr merge` without explicit user approval.

```bash
gh pr create --title "feat: limits progress bars in popup Limits section" --body "$(cat <<'EOF'
## Summary

- Extracted `getCapColorClass` + `buildCapProgressBar` from `interceptor.ts` into new shared module `src/shared/capBar.ts`
- Popup Limits section now renders the same colored progress bars the friction overlay uses, when caps are enabled
- Cap-disabled rows fall back to existing text behavior (no UX change for users without caps)
- Cap-amount edits live-update bars via the existing `onCapChange` callback
- Added `capAmount <= 0` guard in the shared widget — fixes a latent edge case in the friction overlay too

Spec: `docs/dev/superpowers/specs/2026-04-29-limits-progress-bars-design.md`
Plan: `docs/dev/superpowers/plans/2026-04-29-limits-progress-bars.md`

## Test plan

- [x] New unit tests for `capBar.ts` (15 tests, all four tier boundaries + over-budget + amount guard)
- [x] Existing test suite green
- [x] Manual: fresh install, no caps → unchanged
- [x] Manual: enable daily cap → green bar replaces text row
- [x] Manual: push tracker over budget → red bar with `OVER BUDGET`
- [x] Manual: cap enabled with amount=0 → text fallback (guard works)
- [x] Manual: live update on cap input edits
- [x] Manual: theme switch dark/light/auto
- [x] Manual: friction overlay still renders bars (regression check)
EOF
)"
```

Stop here. Report the PR URL to the user and wait for explicit approval before any merge.

---

## Self-Review Checklist (already performed; documented for executors)

- **Spec coverage:** All seven file changes listed in the spec map to tasks (capBar.ts → T1, interceptor.ts → T2, popup.css → T3, popup.html → T4, limits.ts → T5, popup.ts → T6, HypeControl-TODO.md → T8). All 12 manual test cases have explicit steps in T7.
- **Placeholder scan:** No TBDs, TODOs, or "implement later" stubs. Every code step has complete code.
- **Type consistency:** `buildCapProgressBar` signature is identical across the shared module, `interceptor.ts` callers (Task 2 leaves them untouched), and the new `limits.ts` callers (Task 5 calls with `purchaseAmount = 0`). `LimitsCallbacks.onCapChange` signature unchanged. `LimitsController` exposes `refreshTracker` already (used in Task 6).
- **Ambiguity check:** TypeScript closure-over-`limits` pattern in Task 6 includes a fallback in case TS is stricter than expected. CSS placement in Task 3 is described by selector + targeting (after existing rules), not by line number, since prior tasks shift line numbers.
