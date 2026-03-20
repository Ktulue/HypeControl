# Weekly/Monthly Spending Limits Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independent weekly and monthly spending caps that extend the existing daily cap system with escalated friction at 100%, progress bars in the overlay, and a 4-tier color system.

**Architecture:** Extends the existing daily cap pattern (toggle + amount in `UserSettings`, running total in `SpendingTracker`, reset-on-load in `loadSpendingTracker()`). Weekly/monthly limits integrate into `determineFrictionLevel()` as additional bypass checks. When a limit is hit (100%), the overlay uses escalated friction: doubled cooldown timer + acknowledgment checkbox. Progress bars appear in `buildCostBreakdown()` below daily info. The popup Limits section gets weekly/monthly tracker displays and cap toggles.

**Tech Stack:** TypeScript, Chrome Extension MV3, webpack, chrome.storage.sync (settings) / chrome.storage.local (tracker)

**Brainstorming decisions (from prior session):**
1. **Reset boundaries:** Calendar-aligned — Monday for weekly, 1st of month for monthly
2. **Granularity:** Both weekly and monthly available independently, each with own toggle
3. **Override at 100%:** Escalated friction — double the delay timer + acknowledgment checkbox
4. **Warning display:** Overlay banner + popup tracker rows (no push notifications). Extension icon badge deferred to future enhancement.
5. **Progress bar placement:** Below comparison items, above cooldown timer in overlay
6. **Color tiers:** Green < 60%, Yellow 60–79%, Orange 80–99%, Red 100%+

---

## Chunk 1: Types, Storage & Reset Logic

### Task 1: Add Weekly/Monthly Cap Interfaces to types.ts

**Files:**
- Modify: `src/shared/types.ts:57-61` (after DailyCapConfig)

- [ ] **Step 1: Add WeeklyCapConfig and MonthlyCapConfig interfaces**

Add after `DailyCapConfig` (line 61):

```typescript
/** Weekly spending cap configuration */
export interface WeeklyCapConfig {
  enabled: boolean;
  amount: number;
}

/** Monthly spending cap configuration */
export interface MonthlyCapConfig {
  enabled: boolean;
  amount: number;
}
```

- [ ] **Step 2: Add weeklyCap and monthlyCap to UserSettings interface**

In the `UserSettings` interface (line 90-104), add after `dailyCap: DailyCapConfig;`:

```typescript
  weeklyCap: WeeklyCapConfig;
  monthlyCap: MonthlyCapConfig;
```

- [ ] **Step 3: Add defaults to DEFAULT_SETTINGS**

In `DEFAULT_SETTINGS` (line 141-173), add after the `dailyCap` block:

```typescript
  weeklyCap: {
    enabled: false,
    amount: 200,
  },
  monthlyCap: {
    enabled: false,
    amount: 800,
  },
```

- [ ] **Step 4: Extend SpendingTracker with weekly/monthly fields**

In `SpendingTracker` interface (line 176-182), add after `sessionChannel`:

```typescript
  weeklyTotal: number;
  weeklyStartDate: string;   // ISO date of the Monday that starts the current week (YYYY-MM-DD)
  monthlyTotal: number;
  monthlyMonth: string;      // YYYY-MM format
```

- [ ] **Step 5: Extend DEFAULT_SPENDING_TRACKER**

In `DEFAULT_SPENDING_TRACKER` (line 184-190), add:

```typescript
  weeklyTotal: 0,
  weeklyStartDate: '',
  monthlyTotal: 0,
  monthlyMonth: '',
```

- [ ] **Step 6: Add migration for weeklyCap and monthlyCap in migrateSettings()**

In the `return` block of `migrateSettings()` (line 239-277), add after the `dailyCap` spread:

```typescript
    weeklyCap: {
      ...DEFAULT_SETTINGS.weeklyCap,
      ...(saved.weeklyCap || {}),
    },
    monthlyCap: {
      ...DEFAULT_SETTINGS.monthlyCap,
      ...(saved.monthlyCap || {}),
    },
```

- [ ] **Step 7: Verify build compiles**

Run: `npm run build`
Expected: Compile errors in `interceptor.ts` and `limits.ts` because they don't use the new fields yet — that's expected. TypeScript should not error on `types.ts` itself.

- [ ] **Step 8: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add WeeklyCapConfig, MonthlyCapConfig types and SpendingTracker fields"
```

---

### Task 2: Add Date Helper Functions and Weekly/Monthly Reset Logic

**Files:**
- Modify: `src/content/interceptor.ts:41-55` (loadSpendingTracker)
- Modify: `src/content/interceptor.ts:65-76` (recordPurchase)

- [ ] **Step 1: Add date helper functions**

Add above `loadSpendingTracker()` (before line 41), after the `SPENDING_KEY` constant:

```typescript
/**
 * Format a local Date as YYYY-MM-DD without UTC conversion.
 * Using toISOString() would shift dates for users in non-UTC timezones
 * (e.g., 11:30 PM EDT March 31 → April 1 in UTC).
 */
function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Get the Monday that starts the current ISO week as YYYY-MM-DD.
 * ISO weeks start on Monday (day 1) and end on Sunday (day 7).
 */
function getCurrentWeekStart(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setDate(d.getDate() + mondayOffset);
  return formatLocalDate(d);
}

/**
 * Get the current month as YYYY-MM string using local time.
 */
function getCurrentMonth(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
```

- [ ] **Step 2: Add weekly/monthly reset logic to loadSpendingTracker()**

In `loadSpendingTracker()`, after the daily reset block (line 46-49), add:

```typescript
    // Weekly reset: calendar-aligned to Monday
    const currentWeekStart = getCurrentWeekStart();
    if (tracker.weeklyStartDate !== currentWeekStart) {
      tracker.weeklyTotal = 0;
      tracker.weeklyStartDate = currentWeekStart;
    }

    // Monthly reset: calendar-aligned to 1st of month
    const currentMonth = getCurrentMonth();
    if (tracker.monthlyMonth !== currentMonth) {
      tracker.monthlyTotal = 0;
      tracker.monthlyMonth = currentMonth;
    }
```

Also handle the case where old tracker data doesn't have these fields (migration from existing installs). After the line that initializes `tracker` from storage, add fallback initialization:

```typescript
    // Backfill new fields for existing installs
    if (tracker.weeklyTotal === undefined) tracker.weeklyTotal = 0;
    if (!tracker.weeklyStartDate) tracker.weeklyStartDate = '';
    if (tracker.monthlyTotal === undefined) tracker.monthlyTotal = 0;
    if (!tracker.monthlyMonth) tracker.monthlyMonth = '';
```

- [ ] **Step 3: Update recordPurchase() to track weekly/monthly totals**

In `recordPurchase()` (line 65-76), inside the `if (priceValue && priceValue > 0)` block, after the `sessionTotal` update, add:

```typescript
    tracker.weeklyTotal = Math.round((tracker.weeklyTotal + priceWithTax) * 100) / 100;
    tracker.monthlyTotal = Math.round((tracker.monthlyTotal + priceWithTax) * 100) / 100;
```

**Important:** Do NOT set `weeklyStartDate` or `monthlyMonth` here. `loadSpendingTracker()` is the sole owner of reset/date logic. Setting dates in `recordPurchase()` could cause a late-Sunday-night purchase to skip the weekly reset (by writing next week's start date before the reset check runs).

Update the log line to include weekly/monthly:

```typescript
    log(`recordPurchase: +$${priceWithTax.toFixed(2)} (raw=$${priceValue.toFixed(2)}, tax=${settings.taxRate}%) — daily $${before.toFixed(2)} → $${tracker.dailyTotal.toFixed(2)}, weekly $${tracker.weeklyTotal.toFixed(2)}, monthly $${tracker.monthlyTotal.toFixed(2)}`);
```

- [ ] **Step 4: Verify build compiles**

Run: `npm run build`
Expected: Should compile (new tracker fields are populated).

- [ ] **Step 5: Commit**

```bash
git add src/content/interceptor.ts
git commit -m "feat: add weekly/monthly reset logic and date helpers to spending tracker"
```

---

## Chunk 2: Friction Level Logic & Overlay Progress Bars

### Task 3: Integrate Weekly/Monthly Caps into determineFrictionLevel()

**Files:**
- Modify: `src/content/interceptor.ts:110-149` (determineFrictionLevel)

- [ ] **Step 1: Add weekly/monthly bypass checks**

The logic needs to work as follows:
1. If ANY active cap (daily, weekly, or monthly) would be exceeded → return `'full'`
2. If ALL active caps are under limit → return `'cap-bypass'`
3. If no caps are enabled, fall through to threshold logic

Replace the existing daily cap check block (lines 115-126) with:

```typescript
  // Cap checks — daily, weekly, monthly. If ANY cap is exceeded → full friction.
  // If ALL active caps are under limit → cap-bypass (silent pass).
  // Only applies when price is known.
  const hasAnyCap = settings.dailyCap.enabled || settings.weeklyCap.enabled || settings.monthlyCap.enabled;
  if (hasAnyCap && priceValue !== null && priceValue > 0) {
    const priceWithTax = Math.round(priceValue * (1 + settings.taxRate / 100) * 100) / 100;
    let anyCapExceeded = false;
    let capDetails: string[] = [];

    if (settings.dailyCap.enabled) {
      const newDailyTotal = Math.round((tracker.dailyTotal + priceWithTax) * 100) / 100;
      if (newDailyTotal >= settings.dailyCap.amount) {
        anyCapExceeded = true;
        capDetails.push(`daily $${newDailyTotal.toFixed(2)} >= $${settings.dailyCap.amount.toFixed(2)}`);
      }
    }

    if (settings.weeklyCap.enabled) {
      const newWeeklyTotal = Math.round((tracker.weeklyTotal + priceWithTax) * 100) / 100;
      if (newWeeklyTotal >= settings.weeklyCap.amount) {
        anyCapExceeded = true;
        capDetails.push(`weekly $${newWeeklyTotal.toFixed(2)} >= $${settings.weeklyCap.amount.toFixed(2)}`);
      }
    }

    if (settings.monthlyCap.enabled) {
      const newMonthlyTotal = Math.round((tracker.monthlyTotal + priceWithTax) * 100) / 100;
      if (newMonthlyTotal >= settings.monthlyCap.amount) {
        anyCapExceeded = true;
        capDetails.push(`monthly $${newMonthlyTotal.toFixed(2)} >= $${settings.monthlyCap.amount.toFixed(2)}`);
      }
    }

    if (anyCapExceeded) {
      log(`Cap exceeded: ${capDetails.join(', ')} — full modal triggered`);
      return 'full';
    }

    log(`All caps under limit (+$${priceWithTax.toFixed(2)}) — bypassing friction`);
    return 'cap-bypass';
  }
```

- [ ] **Step 2: Verify build compiles**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/content/interceptor.ts
git commit -m "feat: integrate weekly/monthly caps into friction level determination"
```

---

### Task 4: Add Progress Bars to buildCostBreakdown()

**Files:**
- Modify: `src/content/interceptor.ts:243-282` (buildCostBreakdown)
- Modify: `src/content/styles.css` (add new CSS classes)

- [ ] **Step 1: Add a helper function for cap progress bar color tier**

Add above `buildCostBreakdown()`:

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

- [ ] **Step 2: Replace the daily-only display in buildCostBreakdown()**

Replace the existing `dailyInfo` block (lines 252-264) with a unified cap bars section:

```typescript
  let capBars = '';
  if (settings.dailyCap.enabled) {
    capBars += buildCapProgressBar('Daily', tracker.dailyTotal, priceWithTax, settings.dailyCap.amount);
  }
  if (settings.weeklyCap.enabled) {
    capBars += buildCapProgressBar('Weekly', tracker.weeklyTotal, priceWithTax, settings.weeklyCap.amount);
  }
  if (settings.monthlyCap.enabled) {
    capBars += buildCapProgressBar('Monthly', tracker.monthlyTotal, priceWithTax, settings.monthlyCap.amount);
  }
  const capSection = capBars ? `<div class="hc-cap-bars">${capBars}</div>` : '';
```

Then update the return template: replace `${dailyInfo}` with `${capSection}`.

- [ ] **Step 3: Add CSS for progress bars**

In `src/content/styles.css`, add after the `.hc-daily-over` block (around line 279):

```css
/* Cap progress bars (daily/weekly/monthly) */
.hc-cap-bars {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
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
  background: rgba(234, 179, 8, 0.1);
  border-color: rgba(234, 179, 8, 0.2);
  color: #EAB308;
}
.hc-cap-yellow .hc-cap-bar__fill {
  background: #EAB308;
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

- [ ] **Step 4: Remove old daily-only CSS classes (cleanup)**

The old `.hc-daily-tracker`, `.hc-daily-warning`, and `.hc-daily-over` classes are now replaced by the cap bar system. Remove them from `styles.css` (lines ~258-278). Note: verify no other code references these classes before removing.

- [ ] **Step 5: Verify build compiles**

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/content/interceptor.ts src/content/styles.css
git commit -m "feat: add 4-tier color progress bars for daily/weekly/monthly caps in overlay"
```

---

## Chunk 3: Escalated Friction at 100%

### Task 5: Add Escalated Friction for Weekly/Monthly Cap Exceedance

**Files:**
- Modify: `src/content/interceptor.ts` (handleClick, around line 1578-1590; new function)

When a purchase would exceed a weekly or monthly cap, the friction flow includes an **additional** escalated step: doubled delay timer and an acknowledgment checkbox. This is additive — it fires AFTER the normal full friction flow completes with `proceed`, regardless of whether daily cap was also exceeded. The user sees all normal friction steps first, then the escalated cap exceedance overlay as a final gate.

The implementation approach: detect cap exceedance in `handleClick()` after `runFrictionFlow()` returns `proceed`, and show an additional overlay before recording the purchase.

- [ ] **Step 1: Add cap exceedance detection helper**

Add a helper function near `determineFrictionLevel()`:

```typescript
/**
 * Check which caps (if any) would be exceeded by this purchase.
 * Returns an object indicating which caps are exceeded — used for escalated friction.
 */
function checkCapExceedance(
  priceValue: number | null,
  settings: UserSettings,
  tracker: SpendingTracker,
): { dailyExceeded: boolean; weeklyExceeded: boolean; monthlyExceeded: boolean } {
  const result = { dailyExceeded: false, weeklyExceeded: false, monthlyExceeded: false };
  if (priceValue === null || priceValue <= 0) return result;

  const priceWithTax = Math.round(priceValue * (1 + settings.taxRate / 100) * 100) / 100;

  if (settings.dailyCap.enabled) {
    const newTotal = Math.round((tracker.dailyTotal + priceWithTax) * 100) / 100;
    result.dailyExceeded = newTotal >= settings.dailyCap.amount;
  }
  if (settings.weeklyCap.enabled) {
    const newTotal = Math.round((tracker.weeklyTotal + priceWithTax) * 100) / 100;
    result.weeklyExceeded = newTotal >= settings.weeklyCap.amount;
  }
  if (settings.monthlyCap.enabled) {
    const newTotal = Math.round((tracker.monthlyTotal + priceWithTax) * 100) / 100;
    result.monthlyExceeded = newTotal >= settings.monthlyCap.amount;
  }

  return result;
}
```

- [ ] **Step 2: Add the escalated friction overlay function**

Add a new function that shows the acknowledgment step with a doubled delay timer. This runs AFTER the normal friction flow completes with `proceed`, but BEFORE the purchase is recorded.

```typescript
/**
 * Show escalated friction step when weekly/monthly cap is exceeded.
 * Doubles the delay timer and requires an acknowledgment checkbox.
 * Uses DOM construction (not innerHTML) per project XSS prevention rules.
 */
function showCapExceedanceStep(
  exceedance: { weeklyExceeded: boolean; monthlyExceeded: boolean },
  settings: UserSettings,
  tracker: SpendingTracker,
): Promise<OverlayDecision> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.id = 'hc-overlay';
    overlay.className = 'hc-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const exceededPeriods: string[] = [];
    if (exceedance.weeklyExceeded) exceededPeriods.push('weekly');
    if (exceedance.monthlyExceeded) exceededPeriods.push('monthly');
    const periodText = exceededPeriods.join(' and ');

    // Double the delay timer (default 10s if no delay timer configured)
    const baseDelay = settings.delayTimer?.enabled ? settings.delayTimer.seconds : 10;
    const escalatedDelay = baseDelay * 2;

    const card = document.createElement('div');
    card.className = 'hc-card';

    // Heading
    const heading = document.createElement('h2');
    heading.className = 'hc-heading';
    heading.style.color = 'var(--hc-danger)';
    heading.textContent = `You're exceeding your ${periodText} budget`;
    card.appendChild(heading);

    // Subtext
    const subtext = document.createElement('p');
    subtext.className = 'hc-subtext';
    subtext.textContent = 'You set this limit for a reason. Still going?';
    card.appendChild(subtext);

    // Cap info
    const infoDiv = document.createElement('div');
    infoDiv.className = 'hc-cap-exceedance-info';
    if (exceedance.weeklyExceeded) {
      const p = document.createElement('p');
      p.textContent = `Weekly: $${tracker.weeklyTotal.toFixed(2)} / $${settings.weeklyCap.amount.toFixed(2)}`;
      infoDiv.appendChild(p);
    }
    if (exceedance.monthlyExceeded) {
      const p = document.createElement('p');
      p.textContent = `Monthly: $${tracker.monthlyTotal.toFixed(2)} / $${settings.monthlyCap.amount.toFixed(2)}`;
      infoDiv.appendChild(p);
    }
    card.appendChild(infoDiv);

    // Progress bar (uses existing hc-progress-wrap class)
    const progressWrap = document.createElement('div');
    progressWrap.className = 'hc-progress-wrap';
    progressWrap.style.margin = '16px 0';
    const progressBar = document.createElement('div');
    progressBar.className = 'hc-progress-bar';
    progressBar.id = 'hc-escalated-progress';
    progressWrap.appendChild(progressBar);
    card.appendChild(progressWrap);

    // Countdown
    const countdown = document.createElement('p');
    countdown.className = 'hc-countdown';
    countdown.id = 'hc-escalated-countdown';
    countdown.textContent = `${escalatedDelay}s`;
    card.appendChild(countdown);

    // Acknowledgment checkbox
    const ackLabel = document.createElement('label');
    ackLabel.className = 'hc-cap-acknowledge';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'hc-cap-ack-checkbox';
    const ackSpan = document.createElement('span');
    ackSpan.textContent = `I'm exceeding my ${periodText} budget`;
    ackLabel.appendChild(checkbox);
    ackLabel.appendChild(ackSpan);
    card.appendChild(ackLabel);

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'hc-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'hc-btn hc-btn-cancel';
    cancelBtn.dataset.action = 'cancel';
    cancelBtn.textContent = 'Cancel Purchase';
    const proceedBtn = document.createElement('button');
    proceedBtn.className = 'hc-btn hc-btn-proceed';
    proceedBtn.dataset.action = 'proceed';
    proceedBtn.disabled = true;
    proceedBtn.textContent = 'Proceed Anyway';
    actions.appendChild(cancelBtn);
    actions.appendChild(proceedBtn);
    card.appendChild(actions);

    overlay.appendChild(card);
    applyThemeToOverlay(overlay);
    document.body.appendChild(overlay);
    overlayVisible = true;

    let timerDone = false;
    let ackChecked = false;
    let elapsed = 0;

    const updateProceedState = () => {
      proceedBtn.disabled = !(timerDone && ackChecked);
    };

    checkbox.addEventListener('change', () => {
      ackChecked = checkbox.checked;
      updateProceedState();
    });

    const intervalId = setInterval(() => {
      elapsed++;
      const pct = Math.min((elapsed / escalatedDelay) * 100, 100);
      progressBar.style.width = `${pct}%`;
      const remaining = escalatedDelay - elapsed;
      countdown.textContent = `${Math.max(remaining, 0)}s`;

      if (elapsed >= escalatedDelay) {
        clearInterval(intervalId);
        timerDone = true;
        updateProceedState();
      }
    }, 1000);

    let resolved = false;
    const finish = (decision: OverlayDecision) => {
      if (resolved) return;
      resolved = true;
      clearInterval(intervalId);
      removeOverlay(overlay);
      resolve(decision);
    };

    cancelBtn.addEventListener('click', () => finish('cancel'));
    proceedBtn.addEventListener('click', () => finish('proceed'));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish('cancel');
    });
    document.addEventListener('keydown', function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', handleEsc);
        finish('cancel');
      }
    });
  });
}
```

- [ ] **Step 3: Wire escalated friction into handleClick()**

In `handleClick()`, after the normal friction flow completes with `proceed` (around line 1627-1638), but BEFORE `recordPurchase()` is called, insert the escalated friction check:

```typescript
  if (frictionResult.decision === 'proceed' && pendingPurchase) {
    // Check if weekly/monthly caps are exceeded — escalated friction
    const capExceedance = checkCapExceedance(attempt.priceValue, settings, tracker);
    if (capExceedance.weeklyExceeded || capExceedance.monthlyExceeded) {
      log(`Cap exceedance detected (weekly=${capExceedance.weeklyExceeded}, monthly=${capExceedance.monthlyExceeded}) — showing escalated friction`);
      const escalatedDecision = await showCapExceedanceStep(capExceedance, settings, tracker);
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
    }

    log('User completed all friction steps — proceeding with purchase');
    // ... existing recordPurchase and writeInterceptEvent code ...
```

- [ ] **Step 4: Add CSS for escalated friction step**

In `src/content/styles.css`, add:

```css
/* Cap exceedance escalated friction */
.hc-cap-exceedance-info {
  margin: 12px 0;
  padding: 8px 12px;
  background: rgba(var(--hc-danger-rgb), 0.1);
  border: 1px solid rgba(var(--hc-danger-rgb), 0.2);
  border-radius: 4px;
  color: var(--hc-danger);
  font-size: 13px;
  font-family: var(--hc-font);
}

.hc-cap-exceedance-info p {
  margin: 2px 0;
}

.hc-cap-acknowledge {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 16px 0;
  padding: 10px 12px;
  background: rgba(var(--hc-danger-rgb), 0.05);
  border: 1px solid rgba(var(--hc-danger-rgb), 0.2);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-family: var(--hc-font);
  color: var(--hc-text);
}

.hc-cap-acknowledge input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--hc-danger);
  cursor: pointer;
}
```

- [ ] **Step 5: Verify build compiles**

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/content/interceptor.ts src/content/styles.css
git commit -m "feat: add escalated friction step for weekly/monthly cap exceedance"
```

---

## Chunk 4: Popup UI — Settings & Tracker Display

### Task 6: Add Weekly/Monthly Cap Controls to Popup HTML

**Files:**
- Modify: `src/popup/popup.html:226-267` (section-limits)

- [ ] **Step 1: Add weekly and monthly cap toggle rows**

In the Limits section, after the daily cap row (line 236), add:

```html
        <div class="hc-row">
          <label class="hc-label" for="weekly-cap-enabled">Weekly cap</label>
          <label class="toggle-wrap">
            <input type="checkbox" id="weekly-cap-enabled" />
            <span class="toggle-track"></span>
          </label>
          <input type="number" id="weekly-cap-amount" min="0" step="0.01" class="hc-input hc-input--sm" hidden />
        </div>
        <div class="hc-row">
          <label class="hc-label" for="monthly-cap-enabled">Monthly cap</label>
          <label class="toggle-wrap">
            <input type="checkbox" id="monthly-cap-enabled" />
            <span class="toggle-track"></span>
          </label>
          <input type="number" id="monthly-cap-amount" min="0" step="0.01" class="hc-input hc-input--sm" hidden />
        </div>
```

- [ ] **Step 2: Add weekly/monthly tracker displays**

In the spending tracker display group (after the session total row, before the reset button row), add:

```html
          <div class="hc-row" id="tracker-weekly-row" hidden>
            <span class="hc-label">Weekly total</span>
            <span class="tracker-value" id="tracker-weekly">—</span>
          </div>
          <div class="hc-row" id="tracker-monthly-row" hidden>
            <span class="hc-label">Monthly total</span>
            <span class="tracker-value" id="tracker-monthly">—</span>
          </div>
```

- [ ] **Step 3: Commit**

```bash
git add src/popup/popup.html
git commit -m "feat: add weekly/monthly cap toggles and tracker displays to popup HTML"
```

---

### Task 7: Wire Up Weekly/Monthly Controls in limits.ts

**Files:**
- Modify: `src/popup/sections/limits.ts`

- [ ] **Step 1: Add element queries for new controls**

After the existing element queries (line 18), add:

```typescript
  const weeklyCapEnabledEl = el.querySelector<HTMLInputElement>('#weekly-cap-enabled')!;
  const weeklyCapAmountEl = el.querySelector<HTMLInputElement>('#weekly-cap-amount')!;
  const monthlyCapEnabledEl = el.querySelector<HTMLInputElement>('#monthly-cap-enabled')!;
  const monthlyCapAmountEl = el.querySelector<HTMLInputElement>('#monthly-cap-amount')!;
  const trackerWeeklyEl = el.querySelector<HTMLElement>('#tracker-weekly')!;
  const trackerWeeklyRowEl = el.querySelector<HTMLElement>('#tracker-weekly-row')!;
  const trackerMonthlyEl = el.querySelector<HTMLElement>('#tracker-monthly')!;
  const trackerMonthlyRowEl = el.querySelector<HTMLElement>('#tracker-monthly-row')!;
```

- [ ] **Step 2: Add event listeners for weekly/monthly cap controls**

After the daily cap event listeners (line 34), add:

```typescript
  // Weekly cap
  weeklyCapEnabledEl.addEventListener('change', () => {
    const enabled = weeklyCapEnabledEl.checked;
    weeklyCapAmountEl.hidden = !enabled;
    setPendingField('weeklyCap', { ...getPending().weeklyCap, enabled });
  });
  weeklyCapAmountEl.addEventListener('input', () => {
    setPendingField('weeklyCap', {
      ...getPending().weeklyCap,
      amount: parseFloat(weeklyCapAmountEl.value) || 0,
    });
  });

  // Monthly cap
  monthlyCapEnabledEl.addEventListener('change', () => {
    const enabled = monthlyCapEnabledEl.checked;
    monthlyCapAmountEl.hidden = !enabled;
    setPendingField('monthlyCap', { ...getPending().monthlyCap, enabled });
  });
  monthlyCapAmountEl.addEventListener('input', () => {
    setPendingField('monthlyCap', {
      ...getPending().monthlyCap,
      amount: parseFloat(monthlyCapAmountEl.value) || 0,
    });
  });
```

- [ ] **Step 3: Update refreshTracker() to show weekly/monthly totals**

In `refreshTracker()`, after the existing tracker display lines, add:

```typescript
      // Show weekly/monthly tracker rows only when their cap is enabled
      const settings = await chrome.storage.sync.get('hcSettings');
      const userSettings = settings['hcSettings'];

      if (tracker.weeklyTotal !== undefined) {
        trackerWeeklyEl.textContent = `$${(tracker.weeklyTotal ?? 0).toFixed(2)}`;
      }
      if (tracker.monthlyTotal !== undefined) {
        trackerMonthlyEl.textContent = `$${(tracker.monthlyTotal ?? 0).toFixed(2)}`;
      }

      // Show/hide rows based on whether caps are enabled
      const weeklyEnabled = userSettings?.weeklyCap?.enabled ?? false;
      const monthlyEnabled = userSettings?.monthlyCap?.enabled ?? false;
      trackerWeeklyRowEl.hidden = !weeklyEnabled;
      trackerMonthlyRowEl.hidden = !monthlyEnabled;
```

- [ ] **Step 4: Update render() to populate weekly/monthly settings**

In `render()`, after the existing daily cap and cooldown lines, add:

```typescript
    weeklyCapEnabledEl.checked = settings.weeklyCap.enabled;
    weeklyCapAmountEl.hidden = !settings.weeklyCap.enabled;
    weeklyCapAmountEl.value = String(settings.weeklyCap.amount);
    monthlyCapEnabledEl.checked = settings.monthlyCap.enabled;
    monthlyCapAmountEl.hidden = !settings.monthlyCap.enabled;
    monthlyCapAmountEl.value = String(settings.monthlyCap.amount);
```

- [ ] **Step 5: Verify reset button clears weekly/monthly**

The existing reset button (line 58-63 in limits.ts) sets `{ [TRACKER_KEY]: DEFAULT_SPENDING_TRACKER }`. Since Task 1 Step 5 added `weeklyTotal: 0`, `weeklyStartDate: ''`, `monthlyTotal: 0`, `monthlyMonth: ''` to `DEFAULT_SPENDING_TRACKER`, the reset button automatically clears weekly/monthly totals. No code change needed — just verify this works by inspection.

- [ ] **Step 6: Verify build compiles**

Run: `npm run build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/popup/sections/limits.ts
git commit -m "feat: wire weekly/monthly cap controls and tracker display in popup"
```

---

## Chunk 5: Cap-Bypass Toast Update & Polish

### Task 8: Update Budget Toast to Show All Active Caps

**Files:**
- Modify: `src/content/interceptor.ts` (showDailyBudgetToast → showBudgetToast, handleClick cap-bypass section)

- [ ] **Step 1: Rename and extend the budget toast function**

Replace `showDailyBudgetToast()` with a more general version that shows remaining budget for all active caps:

```typescript
function showBudgetToast(
  settings: UserSettings,
  tracker: SpendingTracker,
  priceWithTax: number,
  durationMs: number,
): void {
  document.getElementById('hc-budget-toast')?.remove();

  const lines: string[] = [];

  if (settings.dailyCap.enabled) {
    const remaining = Math.max(0, Math.round((settings.dailyCap.amount - (tracker.dailyTotal + priceWithTax)) * 100) / 100);
    lines.push(`Daily: $${remaining.toFixed(2)} left`);
  }
  if (settings.weeklyCap.enabled) {
    const remaining = Math.max(0, Math.round((settings.weeklyCap.amount - (tracker.weeklyTotal + priceWithTax)) * 100) / 100);
    lines.push(`Weekly: $${remaining.toFixed(2)} left`);
  }
  if (settings.monthlyCap.enabled) {
    const remaining = Math.max(0, Math.round((settings.monthlyCap.amount - (tracker.monthlyTotal + priceWithTax)) * 100) / 100);
    lines.push(`Monthly: $${remaining.toFixed(2)} left`);
  }

  const toast = document.createElement('div');
  toast.id = 'hc-budget-toast';
  toast.className = 'hc-budget-toast';
  toast.textContent = `\u2705 ${lines.join(' · ')}`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hc-budget-toast--fade');
    setTimeout(() => toast.remove(), 300);
  }, durationMs);
}
```

- [ ] **Step 2: Update cap-bypass section in handleClick()**

Replace the existing cap-bypass block (lines ~1581-1590) to use the new toast function:

```typescript
  if (frictionLevel === 'cap-bypass') {
    const priceWithTax = Math.round((attempt.priceValue ?? 0) * (1 + settings.taxRate / 100) * 100) / 100;
    log(`Cap bypass — proceeding silently`);
    await recordPurchase(attempt.priceValue, settings, tracker);
    showBudgetToast(settings, tracker, priceWithTax, settings.toastDurationSeconds * 1000);
    allowNextClick(actualButton);
    return;
  }
```

Note: The toast now uses tracker values AFTER `recordPurchase()` has updated them, but `showBudgetToast` receives the `priceWithTax` separately to calculate remaining. Actually — `recordPurchase` mutates the tracker in-place. So the toast should be called BEFORE `recordPurchase`, or the remaining calculation needs to account for the price already being added.

**Important:** Call `showBudgetToast` BEFORE `recordPurchase` so the tracker totals don't include the current purchase yet (the function adds `priceWithTax` to compute remaining). Or call it after and don't add `priceWithTax` again. The cleanest approach: call it BEFORE recordPurchase, passing `priceWithTax` so the function can subtract from cap:

```typescript
  if (frictionLevel === 'cap-bypass') {
    const priceWithTax = Math.round((attempt.priceValue ?? 0) * (1 + settings.taxRate / 100) * 100) / 100;
    log(`Cap bypass — proceeding silently`);
    showBudgetToast(settings, tracker, priceWithTax, settings.toastDurationSeconds * 1000);
    await recordPurchase(attempt.priceValue, settings, tracker);
    allowNextClick(actualButton);
    return;
  }
```

- [ ] **Step 3: Verify build compiles**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/content/interceptor.ts
git commit -m "feat: update budget toast to show remaining for all active caps"
```

---

### Task 9: Add Yellow CSS Variable and Light Mode Support

**Files:**
- Modify: `src/content/styles.css` (CSS variables)

- [ ] **Step 1: Add yellow color variable**

The 4-tier color system needs a yellow that's distinct from orange. Add to the `:root` block:

```css
  --hc-caution: #EAB308;
  --hc-caution-rgb: 234, 179, 8;
```

And in the light mode `[data-theme="light"]` block:

```css
  --hc-caution: #CA8A04;
  --hc-caution-rgb: 202, 138, 4;
```

- [ ] **Step 2: Update yellow cap bar to use the variable**

In the `.hc-cap-yellow` CSS block, replace hardcoded values:

```css
.hc-cap-yellow {
  background: rgba(var(--hc-caution-rgb), 0.1);
  border-color: rgba(var(--hc-caution-rgb), 0.2);
  color: var(--hc-caution);
}
.hc-cap-yellow .hc-cap-bar__fill {
  background: var(--hc-caution);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/content/styles.css
git commit -m "feat: add caution (yellow) CSS variable for cap progress bar tiers"
```

---

### Task 10: Version Bump, Build & Post-Work Updates

**Files:**
- Modify: `manifest.json` (version)
- Modify: `package.json` (version)
- Modify: `HypeControl-TODO.md`

- [ ] **Step 1: Bump version in both files**

Change version from `0.4.21` to `0.4.22` in both `manifest.json` and `package.json`.

- [ ] **Step 2: Run final build**

Run: `npm run build`
Expected: PASS — clean build with no errors.

If the build fails, do NOT retry. Tell the user to run `npm run build` manually.

- [ ] **Step 3: Update HypeControl-TODO.md**

Mark Add-on 3 as complete:
- Change `| Add-on 3 — Weekly/Monthly Limits | 🔲 Not Started |` → `| Add-on 3 — Weekly/Monthly Limits | ✅ Complete |`
- Mark the checkbox: `- [x] **Add-on 3 — Weekly/Monthly Spending Limits**`
- Update the `Current Version` header to `0.4.22`
- Update the `Updated` date to `2026-03-16`
- Update footer timestamp

- [ ] **Step 4: Commit**

```bash
git add manifest.json package.json HypeControl-TODO.md
git commit -m "maint: bump version to 0.4.22, update TODO for weekly/monthly limits"
```

- [ ] **Step 5: Push branch and open PR**

```bash
git push -u origin feat/weekly-monthly-limits
```

Open PR — do NOT merge. Say "PR #N is open — ready to merge when you give the word."

---

## IMPORTANT NOTES FOR SUBAGENTS

- **Do NOT bump versions.** Only Task 10 bumps the version. All other tasks leave version untouched.
- **Currency math:** Always use `Math.round(value * 100) / 100` at computation time.
- **Storage:** Settings in `chrome.storage.sync`, tracker data in `chrome.storage.local`.
- **Security:** Never interpolate user-controlled or storage-sourced values into innerHTML template literals. Use `textContent` for user data, or sanitize via DOM construction. The `buildCapProgressBar` function uses innerHTML but its `label` parameter is constrained to `'Daily' | 'Weekly' | 'Monthly'` (static strings) and all other values are internally computed numbers — this is safe. The `showCapExceedanceStep` function uses full DOM construction.
- **Date handling:** Always use local time (not UTC/`toISOString()`) for date comparisons. The `formatLocalDate()`, `getCurrentWeekStart()`, and `getCurrentMonth()` helpers handle this correctly.
- **Reset ownership:** Only `loadSpendingTracker()` sets date fields (`weeklyStartDate`, `monthlyMonth`). `recordPurchase()` only updates totals — never dates.
- **CSS variables:** Use existing CSS custom properties where possible. New colors need both dark and light mode definitions.
- **Build:** `npm run build` — attempt once. If it fails, stop and report.
