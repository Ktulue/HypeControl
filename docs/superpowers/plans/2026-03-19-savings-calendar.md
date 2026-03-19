# Savings Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an inline calendar to the popup's Limits section showing daily savings with color-coded tiers and rotating motivational messages.

**Architecture:** New `src/popup/sections/calendar.ts` module owns all calendar logic (grid rendering, tier computation, message selection). It reads `InterceptEvent[]` from the existing `readInterceptEvents()` and current `UserSettings` for daily cap comparison. The popup HTML gets a calendar icon button and a container div; CSS gets calendar grid styles. A new `src/popup/calendarMessages.ts` holds the 90 message strings.

**Tech Stack:** TypeScript, DOM construction (no innerHTML), chrome.storage.local for InterceptEvent data, chrome.storage.sync for UserSettings/daily cap.

**Spec:** `docs/superpowers/specs/2026-03-19-savings-calendar-design.md`

**Important:** Do NOT bump versions. Versioning is handled separately at the end.

---

### Task 1: Reorder Session Before Daily in Popup HTML

**Files:**
- Modify: `src/popup/popup.html` (swap Session and Daily rows in the `.hc-group` tracker section)

- [ ] **Step 1: Move Session row before Daily row**

In `src/popup/popup.html`, within the `.hc-group` tracker section, swap the order so Session total appears first, then Daily total:

```html
<div class="hc-group">
  <div class="hc-row">
    <span class="hc-label">Session total
      <span class="escalation-info" tabindex="0">ⓘ
        <span class="info-tooltip-right" role="tooltip">Spending on the current channel this browsing session. Resets when you switch channels.</span>
      </span>
    </span>
    <span class="tracker-value" id="tracker-session">—</span>
  </div>
  <div class="hc-row">
    <span class="hc-label">Daily total</span>
    <span class="tracker-value" id="tracker-daily">—</span>
  </div>
  <!-- weekly and monthly rows unchanged -->
```

- [ ] **Step 2: Add calendar icon button and container**

After the monthly row and before the reset-row div, add:

```html
<div class="hc-row">
  <span class="hc-label">Savings calendar</span>
  <button class="btn-icon" id="btn-calendar" aria-label="Toggle savings calendar" title="View savings calendar">
    &#x1F4C5;
  </button>
</div>
<div id="calendar-container" hidden></div>
```

The `calendar-container` div is where `calendar.ts` will render the grid. Use a simple unicode calendar icon (📅 = `&#x1F4C5;`) styled as a small icon button.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Compiles successfully.

- [ ] **Step 4: Commit**

```bash
git add src/popup/popup.html
git commit -m "feat: reorder session before daily, add calendar icon and container"
```

---

### Task 2: Create Calendar Messages Module

**Files:**
- Create: `src/popup/calendarMessages.ts`

- [ ] **Step 1: Create message pools file**

Create `src/popup/calendarMessages.ts` with three exported arrays of 30 strings each, plus a date-seeded selector function:

```typescript
/** Date-seeded message selection — same day always returns same message */
export function pickMessage(pool: readonly string[], date: Date): string {
  // Simple hash from date string to get deterministic index
  const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
  }
  return pool[Math.abs(hash) % pool.length];
}

export const ZERO_MESSAGES: readonly string[] = [
  "Zero. Zilch. Nada. Your wallet thanks you.",
  "Not a single dollar. That's discipline.",
  // ... all 30 from spec
];

export const WITHIN_LIMIT_MESSAGES: readonly string[] = [
  "Spent $X \u2014 well within budget. That's control, not restriction.",
  // ... all 30 from spec
];

export const OVER_LIMIT_MESSAGES: readonly string[] = [
  "Went over at $X. You're here, you're tracking \u2014 that's the hard part.",
  // ... all 30 from spec
];
```

Copy all 90 messages exactly from the spec. Use `\u2014` for em-dashes in TS strings.

The `$X` placeholder will be replaced at render time by the caller.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Compiles successfully (module is tree-shaken if unused, but shouldn't error).

- [ ] **Step 3: Commit**

```bash
git add src/popup/calendarMessages.ts
git commit -m "feat: add savings calendar message pools (90 messages)"
```

---

### Task 3: Create Calendar Module

**Files:**
- Create: `src/popup/sections/calendar.ts`

This is the core module. It exports an `initCalendar(container, getSettings)` function that manages all calendar state and rendering.

- [ ] **Step 1: Create calendar.ts with types and data aggregation**

```typescript
import { InterceptEvent, UserSettings } from '../../shared/types';
import { readInterceptEvents } from '../../shared/interceptLogger';
import { pickMessage, ZERO_MESSAGES, WITHIN_LIMIT_MESSAGES, OVER_LIMIT_MESSAGES } from '../calendarMessages';

interface DaySummary {
  saved: number;   // sum of savedAmount from cancelled events
  spent: number;   // sum of priceWithTax from proceeded events
  hasEvents: boolean;
}

type Tier = 'zero' | 'within' | 'over' | 'empty';

/** Aggregate InterceptEvents into per-day summaries keyed by YYYY-MM-DD */
function aggregateByDay(events: InterceptEvent[]): Map<string, DaySummary> {
  const map = new Map<string, DaySummary>();
  for (const e of events) {
    const d = new Date(e.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const entry = map.get(key) ?? { saved: 0, spent: 0, hasEvents: false };
    entry.hasEvents = true;
    if (e.outcome === 'cancelled') {
      entry.saved = Math.round((entry.saved + (e.savedAmount ?? 0)) * 100) / 100;
    } else {
      entry.spent = Math.round((entry.spent + (e.priceWithTax ?? 0)) * 100) / 100;
    }
    map.set(key, entry);
  }
  return map;
}

function getTier(summary: DaySummary | undefined, dailyCap: number | null): Tier {
  if (!summary || !summary.hasEvents) return 'empty';
  if (summary.spent === 0) return 'zero';
  if (dailyCap !== null && summary.spent > dailyCap) return 'over';
  return 'within';
}
```

- [ ] **Step 2: Add the calendar grid renderer**

Continue in `calendar.ts`. Build the full month grid using DOM construction (never innerHTML). The function renders:
- Month/year header with left/right nav arrows
- Su Mo Tu We Th Fr Sa day-of-week headers
- Day cells with tier-based CSS classes
- A detail panel below the grid for showing day info + message on click

Key implementation details:
- `role="grid"` on the calendar table, `role="gridcell"` on each day cell
- Each cell gets `aria-label` with date and tier description
- Today's cell gets a `.today` class
- Tier classes: `.tier-zero`, `.tier-within`, `.tier-over`, `.tier-empty`
- Navigation: left/right arrows disabled at boundaries (right disabled on current month, left disabled when month is entirely outside 90-day window)
- Clicking a tiered cell (not `.tier-empty`) updates the detail panel below
- Detail panel shows: "Saved $X.XX" / "Spent $X.XX" / tier message (date-seeded via `pickMessage`)
- `$X` in messages replaced with `spent.toFixed(2)`

**Click-outside-to-close:** When the calendar is open, add a document-level `click` listener that checks if the click target is outside both the calendar container and the calendar button. If so, close the calendar. Remove this listener when the calendar is closed to avoid leaks.

Export:
```typescript
export interface CalendarController {
  toggle(): void;      // show/hide the calendar
  destroy(): void;     // cleanup (removes event listeners)
}

export function initCalendar(
  container: HTMLElement,
  getSettings: () => Promise<UserSettings>,
): CalendarController { ... }
```

The `toggle()` method loads events via `readInterceptEvents()`, gets settings via `getSettings()`, extracts the daily cap (if enabled), then renders the current month. Calling toggle again hides the container and removes the click-outside listener.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Compiles successfully.

- [ ] **Step 4: Commit**

```bash
git add src/popup/sections/calendar.ts
git commit -m "feat: add savings calendar grid renderer with tier logic"
```

---

### Task 4: Add Calendar CSS

**Files:**
- Modify: `src/popup/popup.css` (append calendar styles)

- [ ] **Step 1: Add calendar styles to popup.css**

Append after the `.reset-actions` block. Key styles:

```css
/* ─── Savings Calendar ──────────────────────────────────── */
.btn-icon {
  background: none;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 4px 8px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  transition: background 0.1s;
}
.btn-icon:hover { background: var(--bg-secondary); }
.btn-icon:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.calendar {
  margin-top: 8px;
  padding: 8px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 6px;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
}

.calendar-nav {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
}
.calendar-nav:disabled { opacity: 0.3; cursor: default; }
.calendar-nav:hover:not(:disabled) { color: var(--text-primary); }

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.calendar-dow {
  font-size: 10px;
  color: var(--text-muted);
  text-align: center;
  padding: 2px 0;
  font-weight: 600;
}

.calendar-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  border-radius: 3px;
  cursor: default;
  border: 1px solid transparent;
  transition: background 0.1s, border-color 0.1s;
}

.calendar-cell.today { border-color: var(--accent); }
.calendar-cell.selected { border-color: var(--text-primary); }

.calendar-cell.tier-empty { color: var(--text-muted); }

.calendar-cell.tier-zero {
  background: rgba(34, 197, 94, 0.2);
  color: var(--success);
  font-weight: 600;
  cursor: pointer;
}
.calendar-cell.tier-zero:hover { background: rgba(34, 197, 94, 0.35); }

.calendar-cell.tier-within {
  background: rgba(34, 197, 94, 0.08);
  color: var(--text-primary);
  cursor: pointer;
}
.calendar-cell.tier-within:hover { background: rgba(34, 197, 94, 0.15); }

.calendar-cell.tier-over {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  cursor: pointer;
}
.calendar-cell.tier-over:hover { background: rgba(245, 158, 11, 0.25); }

.calendar-detail {
  margin-top: 6px;
  padding: 8px;
  background: var(--bg-secondary);
  border-radius: 4px;
  font-size: 11px;
  line-height: 1.5;
}
.calendar-detail-amounts {
  display: flex;
  gap: 12px;
  margin-bottom: 4px;
  font-family: monospace;
  font-size: 12px;
}
.calendar-detail-saved { color: var(--success); }
.calendar-detail-spent { color: var(--text-secondary); }
.calendar-detail-message {
  color: var(--text-primary);
  font-style: italic;
}

.calendar-empty-state {
  padding: 16px 8px;
  text-align: center;
  color: var(--text-muted);
  font-size: 11px;
}
```

Also add light-mode overrides for the amber tier:

```css
[data-theme="light"] .calendar-cell.tier-over {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Compiles successfully.

- [ ] **Step 3: Commit**

```bash
git add src/popup/popup.css
git commit -m "feat: add savings calendar CSS with tier colors and light mode"
```

---

### Task 5: Wire Calendar into Popup

**Files:**
- Modify: `src/popup/sections/limits.ts` (import and initialize calendar)
- Modify: `src/popup/popup.ts` (if needed for settings getter)

- [ ] **Step 1: Wire up calendar in limits.ts**

In `initLimits()`, after the reset tracker block:

At the top of `limits.ts`, add the import:

```typescript
import { initCalendar } from './calendar';
```

Update the existing types import to include `migrateSettings`:

```typescript
import { UserSettings, DEFAULT_SPENDING_TRACKER, migrateSettings } from '../../shared/types';
```

Then in `initLimits()`, after the reset tracker block:

```typescript
const calendarBtnEl = el.querySelector<HTMLButtonElement>('#btn-calendar')!;
const calendarContainerEl = el.querySelector<HTMLElement>('#calendar-container')!;

const calendar = initCalendar(calendarContainerEl, async () => {
  const result = await chrome.storage.sync.get('hcSettings');
  return migrateSettings(result['hcSettings'] || {});
});

calendarBtnEl.addEventListener('click', () => {
  calendar.toggle();
});
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Compiles successfully.

- [ ] **Step 3: Manual test**

Load the extension in Chrome, open the popup. Verify:
1. Session total appears before Daily total
2. Calendar icon is visible in the Limits section
3. Clicking the icon opens the calendar grid
4. Days are color-coded (green/$0, subtle/within, amber/over based on data)
5. Clicking a day shows the detail panel with amounts and a message
6. Navigating months works, boundaries are respected
7. Clicking the icon again collapses the calendar
8. Light mode works correctly

- [ ] **Step 4: Commit**

```bash
git add src/popup/sections/limits.ts src/popup/sections/calendar.ts
git commit -m "feat: wire savings calendar into popup limits section"
```

---

### Task 6: Accessibility & Polish

**Files:**
- Modify: `src/popup/sections/calendar.ts` (keyboard nav)

- [ ] **Step 1: Add keyboard navigation**

In the calendar grid rendering, add a `keydown` listener on the grid container:
- Arrow keys move focus between day cells
- Enter/Space triggers the click handler on the focused cell
- Tab moves focus out of the grid

Each focusable cell should have `tabindex="0"` (selected) or `tabindex="-1"` (other cells). Only one cell has `tabindex="0"` at a time (roving tabindex pattern).

- [ ] **Step 2: Verify build and test keyboard nav**

Run: `npm run build`
Test: Tab into grid, use arrow keys to move between days, Enter to select.

- [ ] **Step 3: Commit**

```bash
git add src/popup/sections/calendar.ts
git commit -m "feat: add keyboard navigation to savings calendar"
```

---

### Task 7: Final Build & Version Bump

**Files:**
- Modify: `manifest.json` (version bump — coordinate with any other changes on this branch)
- Modify: `package.json` (version bump)

- [ ] **Step 1: Bump version in both files**

Only if not already bumped for this branch. Check current version first.

- [ ] **Step 2: Final build**

Run: `npm run build`
Expected: Compiles successfully.

- [ ] **Step 3: Final commit**

```bash
git add manifest.json package.json
git commit -m "maint: bump version to 0.4.XX for savings calendar"
```

- [ ] **Step 4: Update post-work docs**

Update `HypeControl-TODO.md` and `HC-Project-Document.md` per CLAUDE.md rules.
