# MVP Completion Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out remaining MVP gaps — structured intercept event logging, popup stats panel with streaming override, named friction intensity setting, and four new friction overlay steps (reason-selection, cooldown timer, type-to-confirm, math challenge).

**Architecture:** Data-layer-first. Add a structured `InterceptEvent` store with 90-day pruning, then build the popup to display computed stats, then add the friction intensity setting and the new overlay steps that write to that store. Each task produces independently buildable, loadable output.

**Tech Stack:** TypeScript, webpack (MiniCssExtractPlugin + CopyPlugin), Chrome Extension Manifest V3, `chrome.storage.local` (intercept events) + `chrome.storage.sync` (settings), no external UI libraries.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/shared/types.ts` | Modify | Add `FrictionIntensity` type, `InterceptEvent` interface, `frictionIntensity` to `UserSettings` |
| `src/shared/interceptLogger.ts` | **Create** | Write/read/prune intercept events, compute popup stats |
| `src/content/interceptor.ts` | Modify | Wire intercept event logging; add 4 new friction overlay step functions; update `runFrictionFlow` to run them based on intensity |
| `src/options/options.ts` | Modify | Load/save `frictionIntensity`; wire segmented control |
| `src/options/options.html` | Modify | Add friction intensity segmented control UI |
| `src/popup/popup.html` | **Create** | Popup markup |
| `src/popup/popup.ts` | **Create** | Popup logic: load stats, render, streaming override |
| `src/popup/popup.css` | **Create** | Popup styles (dark theme, 360px) |
| `manifest.json` | Modify | Add `action.default_popup` |
| `webpack.config.js` | Modify | Add `popup` entry point + copy popup.html |

---

## Chunk 1: Data Layer

### Task 1: Add FrictionIntensity and InterceptEvent to types.ts

**Files:**
- Modify: `src/shared/types.ts`

**Context:** `FrictionLevel` already exists as `'none' | 'nudge' | 'full' | 'cap-bypass'` (threshold tiers). The new named intensity is a separate concept — call it `FrictionIntensity`. The existing `FrictionLevel` type and all code using it stays untouched.

- [ ] **Step 1: Add FrictionIntensity type**

In `src/shared/types.ts`, after the existing `FrictionLevel` type (line 36), add:

```typescript
/** User-selectable named friction intensity (how intense friction is when it triggers) */
export type FrictionIntensity = 'low' | 'medium' | 'high' | 'extreme';
```

- [ ] **Step 2: Add InterceptEvent interface**

In `src/shared/types.ts`, after the `DEFAULT_SPENDING_TRACKER` block, add:

```typescript
/** A single structured intercept event — stored in chrome.storage.local */
export interface InterceptEvent {
  id: string;               // Date.now().toString() + Math.random().toString(36).slice(2)
  timestamp: number;        // unix ms
  channel: string;
  purchaseType: string;
  rawPrice: string | null;
  priceWithTax: number | null;
  outcome: 'cancelled' | 'proceeded';
  cancelledAtStep?: number; // which step the user cancelled at (1 = main modal, 2+ = subsequent)
  savedAmount?: number;     // set on cancelled entries = priceWithTax (or 0 if no price)
  purchaseReason?: string;  // set when reason-selection step is completed
}
```

- [ ] **Step 3: Add frictionIntensity to UserSettings**

In `src/shared/types.ts`, add `frictionIntensity` to the `UserSettings` interface:

```typescript
export interface UserSettings {
  hourlyRate: number;
  taxRate: number;
  comparisonItems: ComparisonItem[];
  cooldown: CooldownConfig;
  dailyCap: DailyCapConfig;
  frictionThresholds: FrictionThresholds;
  frictionIntensity: FrictionIntensity;   // ← add this line
  streamingMode: StreamingModeConfig;
  toastDurationSeconds: number;
  whitelistedChannels: WhitelistEntry[];
  theme: ThemePreference;
}
```

- [ ] **Step 4: Add default value**

In `src/shared/types.ts`, add to `DEFAULT_SETTINGS`:

```typescript
export const DEFAULT_SETTINGS: UserSettings = {
  // ... existing fields ...
  frictionIntensity: 'medium',   // ← add this line (before or after frictionThresholds)
  // ... rest of fields ...
};
```

- [ ] **Step 5: Add migration**

In the `migrateSettings()` function return statement, add:

```typescript
frictionIntensity: saved.frictionIntensity ?? DEFAULT_SETTINGS.frictionIntensity,
```

- [ ] **Step 6: Build to verify no type errors**

Run: `npm run build`
Expected: Build completes. If it fails with TypeScript errors about missing `frictionIntensity` in objects that spread `UserSettings`, add the field to those objects. Most likely the only error will be in `interceptor.ts`'s `loadSettings` path (which returns `DEFAULT_SETTINGS` on error) — the `DEFAULT_SETTINGS` constant already covers that.

- [ ] **Step 7: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add FrictionIntensity type and InterceptEvent interface to types"
```

---

### Task 2: Create src/shared/interceptLogger.ts

**Files:**
- Create: `src/shared/interceptLogger.ts`

**Context:** This module is the single source of truth for structured intercept events. The popup reads from it. The interceptor writes to it. It handles 90-day pruning on every write.

- [ ] **Step 1: Create the file**

Create `src/shared/interceptLogger.ts`:

```typescript
/**
 * Structured intercept event logger for Hype Control.
 *
 * Stores purchase intercept outcomes as structured events in chrome.storage.local.
 * Applies 90-day rolling window on every write (replaces old 200-entry cap).
 *
 * Storage key: hcInterceptEvents
 * Storage location: chrome.storage.local (transient, not synced)
 */

import { InterceptEvent } from './types';

const INTERCEPT_EVENTS_KEY = 'hcInterceptEvents';
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/** Generate a unique ID for an intercept event */
function makeId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 7);
}

/** Prune entries older than 90 days */
function pruneOld(events: InterceptEvent[]): InterceptEvent[] {
  const cutoff = Date.now() - NINETY_DAYS_MS;
  return events.filter(e => e.timestamp >= cutoff);
}

/**
 * Write a new intercept event to storage.
 * Automatically prunes entries older than 90 days.
 */
export async function writeInterceptEvent(
  partial: Omit<InterceptEvent, 'id' | 'timestamp'>
): Promise<void> {
  const event: InterceptEvent = {
    ...partial,
    id: makeId(),
    timestamp: Date.now(),
  };

  try {
    const result = await chrome.storage.local.get(INTERCEPT_EVENTS_KEY);
    let events: InterceptEvent[] = result[INTERCEPT_EVENTS_KEY] ?? [];
    events = pruneOld(events);
    events.push(event);
    await chrome.storage.local.set({ [INTERCEPT_EVENTS_KEY]: events });
  } catch (e) {
    console.error('[HC] Failed to write intercept event:', e);
  }
}

/**
 * Read all intercept events (already pruned on write, but prune again on read for safety).
 */
export async function readInterceptEvents(): Promise<InterceptEvent[]> {
  try {
    const result = await chrome.storage.local.get(INTERCEPT_EVENTS_KEY);
    const events: InterceptEvent[] = result[INTERCEPT_EVENTS_KEY] ?? [];
    return pruneOld(events);
  } catch (e) {
    console.error('[HC] Failed to read intercept events:', e);
    return [];
  }
}

/** Stats computed from intercept events for the popup */
export interface PopupStats {
  savedTotal: number;       // sum of savedAmount from cancelled entries
  blockedCount: number;     // count of cancelled entries
  totalCount: number;       // total intercept events
  cancelRate: number;       // 0–100 (percentage, rounded to 1 decimal)
  mostEffectiveStep: number | null; // step number with highest cancel count, or null if no data
}

/**
 * Compute popup stats from all stored intercept events.
 */
export async function computePopupStats(): Promise<PopupStats> {
  const events = await readInterceptEvents();

  const cancelled = events.filter(e => e.outcome === 'cancelled');
  const blockedCount = cancelled.length;
  const totalCount = events.length;
  const savedTotal = Math.round(
    cancelled.reduce((sum, e) => sum + (e.savedAmount ?? 0), 0) * 100
  ) / 100;
  const cancelRate = totalCount === 0
    ? 0
    : Math.round((blockedCount / totalCount) * 1000) / 10; // 1 decimal

  // Find most effective step
  const stepCounts: Record<number, number> = {};
  for (const e of cancelled) {
    if (e.cancelledAtStep !== undefined) {
      stepCounts[e.cancelledAtStep] = (stepCounts[e.cancelledAtStep] ?? 0) + 1;
    }
  }
  let mostEffectiveStep: number | null = null;
  let maxCount = 0;
  for (const [step, count] of Object.entries(stepCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostEffectiveStep = Number(step);
    }
  }

  return { savedTotal, blockedCount, totalCount, cancelRate, mostEffectiveStep };
}
```

- [ ] **Step 2: Build to verify no type errors**

Run: `npm run build`
Expected: Build completes without errors. The new file isn't imported anywhere yet, so it's compiled but unused — that's fine.

- [ ] **Step 3: Commit**

```bash
git add src/shared/interceptLogger.ts
git commit -m "feat: add structured intercept event logger with 90-day pruning and popup stats"
```

---

### Task 3: Wire intercept event logging into interceptor.ts

**Files:**
- Modify: `src/content/interceptor.ts`

**Context:** After `runFrictionFlow` returns, write an `InterceptEvent`. Also update `runFrictionFlow` to return `cancelledAtStep` alongside the decision. We also need `purchaseReason` for later (once reason-selection step exists), but for now the field can be undefined.

- [ ] **Step 1: Change runFrictionFlow return type**

At the top of `src/content/interceptor.ts`, add a return type interface (after the imports, before the first const):

```typescript
/** Result returned by runFrictionFlow */
interface FrictionResult {
  decision: OverlayDecision;
  cancelledAtStep?: number;
  purchaseReason?: string;
}
```

- [ ] **Step 2: Update runFrictionFlow signature and return statements**

Change `runFrictionFlow` to return `Promise<FrictionResult>` and update all return statements inside it:

Replace the current `async function runFrictionFlow(...)` signature line:
```typescript
async function runFrictionFlow(
  attempt: PurchaseAttempt,
  settings: UserSettings,
  tracker: SpendingTracker,
  maxComparisons?: number,
  whitelistNote?: string,
): Promise<OverlayDecision> {
```

With:
```typescript
async function runFrictionFlow(
  attempt: PurchaseAttempt,
  settings: UserSettings,
  tracker: SpendingTracker,
  maxComparisons?: number,
  whitelistNote?: string,
): Promise<FrictionResult> {
```

Then update the 3 return statements inside the function body:

1. `return 'cancel';` after `if (mainDecision === 'cancel')` → `return { decision: 'cancel', cancelledAtStep: 1 };`
2. `return 'proceed';` after `if (priceWithTax === null)` → `return { decision: 'proceed' };`
3. The one inside the comparison step loop:
   ```typescript
   return 'cancel';
   ```
   →
   ```typescript
   return { decision: 'cancel', cancelledAtStep: stepNumber };
   ```
4. The final `return 'proceed';` → `return { decision: 'proceed' };`

- [ ] **Step 3: Update handleClick to use the new return type**

In `handleClick`, find the call to `runFrictionFlow` and update the usage:

Replace:
```typescript
const finalDecision = await runFrictionFlow(attempt, settings, tracker, maxComparisons, whitelistNote);

if (finalDecision === 'proceed' && pendingPurchase) {
  log('User completed all friction steps — proceeding with purchase');
  await recordPurchase(attempt.priceValue, settings, tracker);
  allowNextClick(pendingPurchase.attempt.element);
} else {
  log('User cancelled the purchase');
}
```

With:
```typescript
const frictionResult = await runFrictionFlow(attempt, settings, tracker, maxComparisons, whitelistNote);
const priceWithTax = attempt.priceValue !== null
  ? Math.round(attempt.priceValue * (1 + settings.taxRate / 100) * 100) / 100
  : null;

if (frictionResult.decision === 'proceed' && pendingPurchase) {
  log('User completed all friction steps — proceeding with purchase');
  await recordPurchase(attempt.priceValue, settings, tracker);
  allowNextClick(pendingPurchase.attempt.element);
  await writeInterceptEvent({
    channel: attempt.channel,
    purchaseType: attempt.type,
    rawPrice: attempt.rawPrice,
    priceWithTax,
    outcome: 'proceeded',
    purchaseReason: frictionResult.purchaseReason,
  });
} else {
  log('User cancelled the purchase');
  await writeInterceptEvent({
    channel: attempt.channel,
    purchaseType: attempt.type,
    rawPrice: attempt.rawPrice,
    priceWithTax,
    outcome: 'cancelled',
    cancelledAtStep: frictionResult.cancelledAtStep,
    savedAmount: priceWithTax ?? 0,
    purchaseReason: frictionResult.purchaseReason,
  });
}
```

- [ ] **Step 4: Add writeInterceptEvent import**

At the top of `src/content/interceptor.ts`, add to the imports:

```typescript
import { writeInterceptEvent } from '../shared/interceptLogger';
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: Build completes without errors.

- [ ] **Step 6: Manual verification**

Load the unpacked extension from `dist/` in Chrome (`chrome://extensions` → Load unpacked). Go to twitch.tv. Trigger a purchase attempt. Cancel in the main modal. Then open: `chrome://extensions` → the extension → Inspect service worker (or background) console, OR open `chrome.storage.local` via the extension's storage viewer. Confirm a `hcInterceptEvents` key exists with at least one entry.

- [ ] **Step 7: Commit**

```bash
git add src/content/interceptor.ts
git commit -m "feat: wire structured intercept event logging into friction flow"
```

---

## Chunk 2: Popup UI

### Task 4: Add popup entry to webpack and copy popup.html

**Files:**
- Modify: `webpack.config.js`

- [ ] **Step 1: Add popup entry point**

In `webpack.config.js`, add `popup` to the `entry` object:

```javascript
entry: {
  content: './src/content/index.ts',
  logs: './src/logs/logs.ts',
  options: './src/options/options.ts',
  popup: './src/popup/popup.ts',         // ← add this line
  serviceWorker: './src/background/serviceWorker.ts',
},
```

- [ ] **Step 2: Add popup.html copy pattern**

In the `CopyPlugin` patterns array, add:

```javascript
{ from: 'src/popup/popup.html', to: 'popup.html' },
```

- [ ] **Step 3: Commit**

```bash
git add webpack.config.js
git commit -m "build: add popup entry point to webpack config"
```

---

### Task 5: Create popup.html

**Files:**
- Create: `src/popup/popup.html`

- [ ] **Step 1: Create the file**

Create `src/popup/popup.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Hype Control</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup-wrap">
    <div class="popup-header">
      <span class="popup-icon">🛡️</span>
      <h1 class="popup-title">Hype Control</h1>
    </div>

    <div class="popup-stats" id="popup-stats">
      <div class="stat-row">
        <span class="stat-label">Saved (90 days)</span>
        <span class="stat-value" id="stat-saved">—</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Purchases blocked</span>
        <span class="stat-value" id="stat-blocked">—</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Cancel rate</span>
        <span class="stat-value" id="stat-cancel-rate">—</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Most effective step</span>
        <span class="stat-value" id="stat-best-step">—</span>
      </div>
    </div>

    <div class="popup-no-data" id="popup-no-data" style="display:none">
      <p>No intercept data yet.</p>
      <p class="popup-no-data-sub">Visit Twitch and encounter a purchase to get started.</p>
    </div>

    <hr class="popup-divider">

    <div class="popup-streaming">
      <div class="streaming-row">
        <span class="streaming-label" id="streaming-label">Streaming Mode Override</span>
        <button class="streaming-btn" id="streaming-btn">Enable (2 hrs)</button>
      </div>
      <p class="streaming-status" id="streaming-status" style="display:none"></p>
    </div>

    <hr class="popup-divider">

    <div class="popup-footer">
      <a id="logs-link" class="popup-link" href="#">View full logs →</a>
      <span class="popup-version" id="popup-version"></span>
    </div>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/popup/popup.html
git commit -m "feat: add popup.html markup"
```

---

### Task 6: Create popup.css

**Files:**
- Create: `src/popup/popup.css`

- [ ] **Step 1: Create the file**

Create `src/popup/popup.css`:

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  width: 360px;
  background: #18181b;
  color: #efeff1;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
}

.popup-wrap {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Header */
.popup-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.popup-icon {
  font-size: 20px;
}

.popup-title {
  font-size: 16px;
  font-weight: 700;
  color: #efeff1;
}

/* Stats */
.popup-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid #2a2a2e;
}

.stat-row:last-child {
  border-bottom: none;
}

.stat-label {
  color: #adadb8;
  font-size: 13px;
}

.stat-value {
  font-weight: 600;
  color: #efeff1;
  font-size: 14px;
}

.stat-value.positive {
  color: #4caf50;
}

/* No data */
.popup-no-data {
  text-align: center;
  padding: 12px 0;
  color: #adadb8;
  font-size: 13px;
  line-height: 1.5;
}

.popup-no-data-sub {
  font-size: 12px;
  margin-top: 4px;
}

/* Divider */
.popup-divider {
  border: none;
  border-top: 1px solid #2a2a2e;
  margin: 0;
}

/* Streaming override */
.popup-streaming {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.streaming-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.streaming-label {
  color: #adadb8;
  font-size: 13px;
}

.streaming-btn {
  background: #9147ff;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.streaming-btn:hover {
  background: #772ce8;
}

.streaming-btn.active {
  background: #d44000;
}

.streaming-btn.active:hover {
  background: #b33800;
}

.streaming-status {
  font-size: 12px;
  color: #adadb8;
}

/* Footer */
.popup-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.popup-link {
  color: #9147ff;
  text-decoration: none;
  font-size: 12px;
}

.popup-link:hover {
  text-decoration: underline;
}

.popup-version {
  color: #adadb8;
  font-size: 11px;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/popup/popup.css
git commit -m "feat: add popup.css dark theme styles"
```

---

### Task 7: Create popup.ts

**Files:**
- Create: `src/popup/popup.ts`

- [ ] **Step 1: Create the file**

Create `src/popup/popup.ts`:

```typescript
/**
 * HC Popup — stats summary and streaming mode override
 */

import { computePopupStats } from '../shared/interceptLogger';

const OVERRIDE_KEY = 'hcManualOverride';
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

// ── Stats ──────────────────────────────────────────────────────────────

async function renderStats(): Promise<void> {
  const stats = await computePopupStats();
  const statsEl = document.getElementById('popup-stats')!;
  const noDataEl = document.getElementById('popup-no-data')!;

  if (stats.totalCount === 0) {
    statsEl.style.display = 'none';
    noDataEl.style.display = 'block';
    return;
  }

  statsEl.style.display = 'flex';
  noDataEl.style.display = 'none';

  const savedEl = document.getElementById('stat-saved')!;
  const blockedEl = document.getElementById('stat-blocked')!;
  const cancelRateEl = document.getElementById('stat-cancel-rate')!;
  const bestStepEl = document.getElementById('stat-best-step')!;

  savedEl.textContent = `$${stats.savedTotal.toFixed(2)}`;
  if (stats.savedTotal > 0) savedEl.classList.add('positive');

  blockedEl.textContent = stats.blockedCount.toString();
  cancelRateEl.textContent = `${stats.cancelRate}%`;
  bestStepEl.textContent = stats.mostEffectiveStep !== null
    ? `Step ${stats.mostEffectiveStep}`
    : '—';
}

// ── Streaming Override ──────────────────────────────────────────────────

function formatTimeRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m remaining`;
  if (m > 0) return `${m}m ${s}s remaining`;
  return `${s}s remaining`;
}

async function renderStreamingOverride(): Promise<void> {
  const btn = document.getElementById('streaming-btn') as HTMLButtonElement;
  const statusEl = document.getElementById('streaming-status')!;

  const result = await chrome.storage.local.get(OVERRIDE_KEY);
  const overrideUntil: number | null = result[OVERRIDE_KEY] ?? null;
  const now = Date.now();

  if (overrideUntil && overrideUntil > now) {
    const remaining = overrideUntil - now;
    btn.textContent = 'Cancel override';
    btn.classList.add('active');
    statusEl.style.display = 'block';
    statusEl.textContent = formatTimeRemaining(remaining);
  } else {
    btn.textContent = 'Enable (2 hrs)';
    btn.classList.remove('active');
    statusEl.style.display = 'none';
  }

  btn.addEventListener('click', async () => {
    const r = await chrome.storage.local.get(OVERRIDE_KEY);
    const until: number | null = r[OVERRIDE_KEY] ?? null;
    const isActive = until && until > Date.now();

    if (isActive) {
      await chrome.storage.local.remove(OVERRIDE_KEY);
    } else {
      await chrome.storage.local.set({ [OVERRIDE_KEY]: Date.now() + TWO_HOURS_MS });
    }
    // Re-render to reflect new state
    await renderStreamingOverride();
  });
}

// ── Version ──────────────────────────────────────────────────────────────

function renderVersion(): void {
  const versionEl = document.getElementById('popup-version');
  if (versionEl) {
    const manifest = chrome.runtime.getManifest();
    versionEl.textContent = `v${manifest.version}`;
  }
}

// ── Logs Link ────────────────────────────────────────────────────────────

function setupLogsLink(): void {
  const link = document.getElementById('logs-link') as HTMLAnchorElement;
  link.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('logs.html') });
  });
}

// ── Init ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  renderVersion();
  setupLogsLink();
  await Promise.all([
    renderStats(),
    renderStreamingOverride(),
  ]);
});
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build completes. `dist/popup.js` and `dist/popup.html` and `dist/popup.css` appear in dist.

- [ ] **Step 3: Commit**

```bash
git add src/popup/popup.ts
git commit -m "feat: add popup.ts with stats display and streaming override"
```

---

### Task 8: Wire popup to manifest

**Files:**
- Modify: `manifest.json`

**Context:** The manifest currently has `"action": { "default_title": "..." }` with no `default_popup`. Adding `default_popup` makes the extension icon open the popup instead of the options page.

- [ ] **Step 1: Add default_popup to manifest.json**

In `manifest.json`, update the `action` object:

```json
"action": {
  "default_title": "Hype Control - Click for settings",
  "default_popup": "popup.html"
},
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build completes. `dist/manifest.json` now contains `"default_popup": "popup.html"`.

- [ ] **Step 3: Manual verification**

Reload the extension in Chrome. Click the extension icon in the toolbar. The popup should appear showing the stats UI (or the "no data yet" state). Verify the "View full logs →" link opens logs.html in a new tab.

- [ ] **Step 4: Commit**

```bash
git add manifest.json
git commit -m "feat: wire popup.html as default action popup in manifest"
```

---

## Chunk 3: Friction Intensity Setting

### Task 9: Add friction intensity segmented control to options page

**Files:**
- Modify: `src/options/options.html`
- Modify: `src/options/options.ts`

**Context:** The options page has a "Friction" section with threshold settings. Add a 4-button segmented control above the threshold toggles. The control is a group of `<button>` elements styled as a radio group — simpler than actual `<input type=radio>` for the existing options page pattern.

- [ ] **Step 1: Add segmented control HTML to options.html**

Find the friction section in `src/options/options.html` (search for "Friction" heading or "frictionThresholds"). Add this block above the threshold controls:

```html
<div class="setting-row" style="flex-direction: column; align-items: flex-start; gap: 8px;">
  <label class="setting-label">Friction Intensity</label>
  <p class="setting-hint">Controls how much friction is applied when a purchase is intercepted.</p>
  <div class="intensity-group" id="friction-intensity-group" role="radiogroup" aria-label="Friction intensity">
    <button class="intensity-btn" data-intensity="low"    aria-pressed="false">Low</button>
    <button class="intensity-btn" data-intensity="medium" aria-pressed="false">Medium</button>
    <button class="intensity-btn" data-intensity="high"   aria-pressed="false">High</button>
    <button class="intensity-btn" data-intensity="extreme" aria-pressed="false">Extreme</button>
  </div>
  <p class="intensity-desc" id="intensity-desc"></p>
</div>
```

Also add these styles to the `<style>` block in `options.html` (or the existing inline styles section):

```css
.intensity-group {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.intensity-btn {
  background: var(--opt-bg-inset);
  color: var(--opt-text-muted);
  border: 1px solid var(--opt-border);
  border-radius: 4px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.intensity-btn:hover {
  background: var(--opt-border);
  color: var(--opt-text);
}

.intensity-btn[aria-pressed="true"] {
  background: #9147ff;
  color: #fff;
  border-color: #9147ff;
}

.intensity-desc {
  font-size: 12px;
  color: var(--opt-text-muted);
  min-height: 16px;
}
```

- [ ] **Step 2: Add intensity descriptions constant to options.ts**

In `src/options/options.ts`, add near the top:

```typescript
const INTENSITY_DESCRIPTIONS: Record<string, string> = {
  low:     'Price + tax display only. No extra friction steps.',
  medium:  'Adds a reason-selection step (why are you buying this?).',
  high:    'Adds a 10-second cooldown timer + type-to-confirm.',
  extreme: 'Adds a math challenge. Cooldown extends to 30 seconds.',
};
```

- [ ] **Step 3: Add setIntensityUI and wireIntensityControl functions to options.ts**

```typescript
function setIntensityUI(intensity: string): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('.intensity-btn');
  buttons.forEach(btn => {
    const active = btn.dataset.intensity === intensity;
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  const descEl = document.getElementById('intensity-desc');
  if (descEl) descEl.textContent = INTENSITY_DESCRIPTIONS[intensity] ?? '';
}

function wireIntensityControl(): void {
  const group = document.getElementById('friction-intensity-group');
  if (!group) return;
  group.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.intensity-btn');
    if (!btn || !btn.dataset.intensity) return;
    const intensity = btn.dataset.intensity;
    setIntensityUI(intensity);
    if (cachedSettings) {
      (cachedSettings as any).frictionIntensity = intensity;
      await saveSettings(cachedSettings);
      settingsLog('Friction intensity changed', { intensity });
    }
  });
}
```

- [ ] **Step 4: Call setIntensityUI during populateForm and wireIntensityControl during init**

In the function that populates the form with saved settings (likely called `populateForm` or similar — search for where `hourlyRate` input is set), add:

```typescript
setIntensityUI(settings.frictionIntensity ?? 'medium');
```

In the DOMContentLoaded init block (where other `wire*` functions are called), add:

```typescript
wireIntensityControl();
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: Build completes without errors.

- [ ] **Step 6: Manual verification**

Reload the extension. Open the options page. Verify the 4-button intensity control appears in the Friction section. Click each button — the selected one should highlight purple, the description should update, and saving should persist the value (verify by closing and reopening the options page).

- [ ] **Step 7: Commit**

```bash
git add src/options/options.html src/options/options.ts
git commit -m "feat: add friction intensity segmented control to options page"
```

---

## Chunk 4: New Friction Overlay Steps

### Task 10: Implement reason-selection step (Medium+)

**Files:**
- Modify: `src/content/interceptor.ts`

**Context:** This step presents 3 buttons. Selecting "Caught up in the moment" cancels automatically. The other two log a reason and proceed. The step tracks `cancelledAtStep` and `purchaseReason` in the returned `FrictionResult`.

- [ ] **Step 1: Add showReasonSelectionStep function**

In `src/content/interceptor.ts`, add this function after `showComparisonStep` and before the cooldown block:

```typescript
// ── Overlay: Reason-Selection Step ─────────────────────────────────────

/** Result of the reason-selection step */
interface ReasonResult {
  decision: OverlayDecision;
  reason?: string;
}

async function showReasonSelectionStep(
  stepNumber: number,
  totalSteps: number,
  attempt: PurchaseAttempt,
): Promise<ReasonResult> {
  if (overlayVisible) return { decision: 'cancel' };
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
        <span class="hc-icon">🤔</span>
        <h2 class="hc-title" id="hc-overlay-heading">STEP ${stepNumber} OF ${totalSteps}</h2>
      </div>
      <div class="hc-content" id="hc-overlay-desc">
        <p class="hc-label">Why are you making this purchase?</p>
        <p class="hc-message">Be honest with yourself.</p>
      </div>
      <div class="hc-actions hc-actions--column">
        <button class="hc-btn hc-btn-proceed" data-reason="support">To support the streamer</button>
        <button class="hc-btn hc-btn-proceed" data-reason="want">I genuinely want this</button>
        <button class="hc-btn hc-btn-cancel" data-reason="moment">Caught up in the moment</button>
      </div>
    </div>
  `;

  log(`Step ${stepNumber} — Reason selection shown`, { channel: attempt.channel });

  return new Promise((resolve) => {
    let resolved = false;
    const previousFocus = document.activeElement as HTMLElement | null;

    const finish = (decision: OverlayDecision, reason: string) => {
      if (resolved) return;
      resolved = true;
      document.removeEventListener('keydown', handleKeydown);
      removeOverlay(overlay);
      previousFocus?.focus();
      resolve({ decision, reason });
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        finish('cancel', 'escaped');
        return;
      }
      if (e.key === 'Tab') {
        const focusableButtons = Array.from(overlay.querySelectorAll<HTMLButtonElement>('.hc-btn'));
        if (focusableButtons.length === 0) return;
        const first = focusableButtons[0];
        const last = focusableButtons[focusableButtons.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeydown);

    overlay.querySelectorAll<HTMLButtonElement>('[data-reason]').forEach(btn => {
      btn.addEventListener('click', () => {
        const reason = btn.dataset.reason!;
        if (reason === 'moment') {
          // Auto-cancel with message
          log(`Step ${stepNumber} — Reason: "Caught up in the moment" — auto-cancelled`);
          // Brief message before dismiss
          const content = overlay.querySelector('.hc-content');
          const actions = overlay.querySelector('.hc-actions');
          if (content) content.innerHTML = `
            <p class="hc-label" style="color: #4caf50;">No worries — the moment passes.</p>
            <p class="hc-message">Your wallet thanks you. 💚</p>
          `;
          if (actions) (actions as HTMLElement).style.display = 'none';
          setTimeout(() => finish('cancel', 'moment'), 1500);
        } else {
          log(`Step ${stepNumber} — Reason: "${reason}" — proceeding`);
          finish('proceed', reason);
        }
      });
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish('cancel', 'outside');
    });

    applyThemeToOverlay(overlay);
    document.body.appendChild(overlay);
    (overlay.querySelector('.hc-btn') as HTMLButtonElement)?.focus();
  });
}
```

- [ ] **Step 2: Add hc-actions--column CSS**

In `src/content/styles.css`, add:

```css
.hc-actions--column {
  flex-direction: column;
  gap: 8px;
}

.hc-actions--column .hc-btn {
  width: 100%;
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Build completes.

- [ ] **Step 4: Commit**

```bash
git add src/content/interceptor.ts src/content/styles.css
git commit -m "feat: add reason-selection friction overlay step"
```

---

### Task 11: Implement friction cooldown timer step (High+)

**Files:**
- Modify: `src/content/interceptor.ts`

**Context:** This is distinct from the *spending cooldown* (which blocks repeated purchases after the last one). This is a *friction cooldown* — a mandatory wait built into the friction flow itself for High and Extreme levels. 10s for High, 30s for Extreme.

- [ ] **Step 1: Add showFrictionCooldownStep function**

In `src/content/interceptor.ts`, add after `showReasonSelectionStep`:

```typescript
// ── Overlay: Friction Cooldown Step ────────────────────────────────────

async function showFrictionCooldownStep(
  stepNumber: number,
  totalSteps: number,
  durationSeconds: number,
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
        <span class="hc-icon">⏳</span>
        <h2 class="hc-title" id="hc-overlay-heading">STEP ${stepNumber} OF ${totalSteps}</h2>
      </div>
      <div class="hc-content" id="hc-overlay-desc" style="text-align: center;">
        <p class="hc-label">Wait ${durationSeconds} seconds.</p>
        <p class="hc-message">Use this time to really think about it.</p>
        <div class="hc-progress-wrap">
          <div class="hc-progress-bar" id="hc-friction-progress"></div>
        </div>
        <p class="hc-countdown" id="hc-friction-countdown">${durationSeconds}s remaining</p>
      </div>
      <div class="hc-actions">
        <button class="hc-btn hc-btn-cancel" data-action="cancel">Cancel</button>
        <button class="hc-btn hc-btn-proceed" data-action="proceed" disabled aria-disabled="true" style="opacity: 0.4; cursor: not-allowed;">
          Waiting...
        </button>
      </div>
    </div>
  `;

  log(`Step ${stepNumber} — Friction cooldown (${durationSeconds}s) started`, { channel: attempt.channel });

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
        const focusableButtons = Array.from(overlay.querySelectorAll<HTMLButtonElement>('.hc-btn:not([disabled])'));
        if (focusableButtons.length === 0) return;
        const first = focusableButtons[0];
        const last = focusableButtons[focusableButtons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKeydown);

    overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => finish('cancel'));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish('cancel'); });

    const progressEl = overlay.querySelector('#hc-friction-progress') as HTMLElement | null;
    const countdownEl = overlay.querySelector('#hc-friction-countdown') as HTMLElement | null;
    const proceedBtn = overlay.querySelector('[data-action="proceed"]') as HTMLButtonElement | null;

    intervalId = setInterval(() => {
      const left = expiresAt - Date.now();
      const elapsed = durationSeconds * 1000 - left;
      const pct = Math.min(100, (elapsed / (durationSeconds * 1000)) * 100);

      if (progressEl) progressEl.style.width = `${pct}%`;

      if (left <= 0) {
        if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
        if (countdownEl) countdownEl.textContent = 'Time\'s up — ready to proceed?';
        if (proceedBtn) {
          proceedBtn.disabled = false;
          proceedBtn.removeAttribute('aria-disabled');
          proceedBtn.style.opacity = '';
          proceedBtn.style.cursor = '';
          proceedBtn.textContent = 'Proceed Anyway';
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

- [ ] **Step 2: Add progress bar CSS to styles.css**

```css
.hc-progress-wrap {
  width: 100%;
  background: var(--hc-border, #3d3d42);
  border-radius: 4px;
  height: 8px;
  margin: 12px 0 6px;
  overflow: hidden;
}

.hc-progress-bar {
  height: 100%;
  background: #9147ff;
  border-radius: 4px;
  width: 0%;
  transition: width 0.1s linear;
}

.hc-countdown {
  font-size: 13px;
  color: var(--hc-text-muted, #adadb8);
  margin-top: 4px;
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Build completes.

- [ ] **Step 4: Commit**

```bash
git add src/content/interceptor.ts src/content/styles.css
git commit -m "feat: add friction cooldown timer overlay step"
```

---

### Task 12: Implement type-to-confirm step (High+)

**Files:**
- Modify: `src/content/interceptor.ts`

- [ ] **Step 1: Add showTypeToConfirmStep function**

```typescript
// ── Overlay: Type-to-Confirm Step ──────────────────────────────────────

const TYPE_TO_CONFIRM_PHRASE = 'I WANT THIS';

async function showTypeToConfirmStep(
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
        <span class="hc-icon">✍️</span>
        <h2 class="hc-title" id="hc-overlay-heading">STEP ${stepNumber} OF ${totalSteps}</h2>
      </div>
      <div class="hc-content" id="hc-overlay-desc">
        <p class="hc-label">Type to confirm you want to proceed:</p>
        <p class="hc-message hc-confirm-phrase">${TYPE_TO_CONFIRM_PHRASE}</p>
        <input
          class="hc-confirm-input"
          id="hc-confirm-input"
          type="text"
          placeholder="Type: ${TYPE_TO_CONFIRM_PHRASE}"
          autocomplete="off"
          spellcheck="false"
          aria-label="Type the confirmation phrase"
        />
      </div>
      <div class="hc-actions">
        <button class="hc-btn hc-btn-cancel" data-action="cancel">Cancel</button>
        <button class="hc-btn hc-btn-proceed" data-action="proceed" disabled aria-disabled="true" style="opacity: 0.4; cursor: not-allowed;">
          Proceed Anyway
        </button>
      </div>
    </div>
  `;

  log(`Step ${stepNumber} — Type-to-confirm shown`, { channel: attempt.channel });

  return new Promise((resolve) => {
    let resolved = false;
    const previousFocus = document.activeElement as HTMLElement | null;

    const finish = (decision: OverlayDecision) => {
      if (resolved) return;
      resolved = true;
      document.removeEventListener('keydown', handleKeydown);
      removeOverlay(overlay);
      previousFocus?.focus();
      resolve(decision);
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { finish('cancel'); return; }
      if (e.key === 'Tab') {
        const focusable = Array.from(
          overlay.querySelectorAll<HTMLElement>('.hc-btn:not([disabled]), #hc-confirm-input')
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

    const proceedBtn = overlay.querySelector('[data-action="proceed"]') as HTMLButtonElement;
    const input = overlay.querySelector('#hc-confirm-input') as HTMLInputElement;

    const checkInput = () => {
      const valid = input.value.trim().toUpperCase() === TYPE_TO_CONFIRM_PHRASE;
      proceedBtn.disabled = !valid;
      proceedBtn.setAttribute('aria-disabled', valid ? 'false' : 'true');
      proceedBtn.style.opacity = valid ? '' : '0.4';
      proceedBtn.style.cursor = valid ? '' : 'not-allowed';
    };

    input.addEventListener('input', checkInput);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !proceedBtn.disabled) {
        finish('proceed');
      }
    });

    proceedBtn.addEventListener('click', () => {
      if (!proceedBtn.disabled) finish('proceed');
    });

    applyThemeToOverlay(overlay);
    document.body.appendChild(overlay);
    input.focus();
  });
}
```

- [ ] **Step 2: Add confirm input CSS to styles.css**

```css
.hc-confirm-phrase {
  font-family: monospace;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--hc-accent, #9147ff);
  text-align: center;
  margin: 8px 0;
}

.hc-confirm-input {
  width: 100%;
  padding: 8px 12px;
  background: var(--hc-bg, #18181b);
  border: 1px solid var(--hc-border, #3d3d42);
  border-radius: 4px;
  color: var(--hc-text, #efeff1);
  font-size: 14px;
  font-family: monospace;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-top: 8px;
}

.hc-confirm-input:focus {
  outline: none;
  border-color: #9147ff;
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Build completes.

- [ ] **Step 4: Commit**

```bash
git add src/content/interceptor.ts src/content/styles.css
git commit -m "feat: add type-to-confirm friction overlay step"
```

---

### Task 13: Implement math challenge step (Extreme only)

**Files:**
- Modify: `src/content/interceptor.ts`

- [ ] **Step 1: Add math problem generator helper**

In `src/content/interceptor.ts`, add this helper before `showMathChallengeStep`:

```typescript
/** Generate a simple arithmetic problem where the answer is always < 100 */
function generateMathProblem(): { question: string; answer: number } {
  const ops = ['+', '-', '*'] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a: number, b: number, answer: number;

  switch (op) {
    case '+':
      a = Math.floor(Math.random() * 49) + 1;   // 1–49
      b = Math.floor(Math.random() * (99 - a)) + 1; // keeps answer < 100
      answer = a + b;
      break;
    case '-':
      a = Math.floor(Math.random() * 99) + 1;   // 1–99
      b = Math.floor(Math.random() * a) + 1;    // always positive result
      answer = a - b;
      break;
    case '*':
      a = Math.floor(Math.random() * 9) + 2;    // 2–10
      b = Math.floor(Math.random() * Math.floor(99 / a)) + 1;
      answer = a * b;
      break;
  }

  const opSymbol = op === '*' ? '×' : op;
  return { question: `What is ${a} ${opSymbol} ${b}?`, answer };
}
```

- [ ] **Step 2: Add showMathChallengeStep function**

```typescript
// ── Overlay: Math Challenge Step ────────────────────────────────────────

async function showMathChallengeStep(
  stepNumber: number,
  totalSteps: number,
  attempt: PurchaseAttempt,
): Promise<OverlayDecision> {
  if (overlayVisible) return 'cancel';
  overlayVisible = true;

  let { question, answer } = generateMathProblem();

  const overlay = document.createElement('div');
  overlay.id = 'hc-overlay';
  overlay.className = 'hc-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'hc-overlay-heading');
  overlay.setAttribute('aria-describedby', 'hc-overlay-desc');

  const buildHTML = (q: string) => `
    <div class="hc-modal">
      <div class="hc-header">
        <span class="hc-icon">🧮</span>
        <h2 class="hc-title" id="hc-overlay-heading">STEP ${stepNumber} OF ${totalSteps}</h2>
      </div>
      <div class="hc-content" id="hc-overlay-desc">
        <p class="hc-label">Solve this to prove you're thinking clearly:</p>
        <p class="hc-math-question" id="hc-math-question">${q}</p>
        <input
          class="hc-confirm-input hc-math-input"
          id="hc-math-input"
          type="number"
          placeholder="Answer"
          autocomplete="off"
          aria-label="Math answer"
        />
        <p class="hc-math-error" id="hc-math-error" style="display:none; color: #f44336; font-size: 12px; margin-top: 4px;">
          Not quite. Try the new problem.
        </p>
      </div>
      <div class="hc-actions">
        <button class="hc-btn hc-btn-cancel" data-action="cancel">Cancel</button>
        <button class="hc-btn hc-btn-proceed" data-action="proceed">Submit</button>
      </div>
    </div>
  `;

  overlay.innerHTML = buildHTML(question);

  log(`Step ${stepNumber} — Math challenge shown`, { channel: attempt.channel });

  return new Promise((resolve) => {
    let resolved = false;
    const previousFocus = document.activeElement as HTMLElement | null;

    const finish = (decision: OverlayDecision) => {
      if (resolved) return;
      resolved = true;
      document.removeEventListener('keydown', handleKeydown);
      removeOverlay(overlay);
      previousFocus?.focus();
      resolve(decision);
    };

    const newProblem = () => {
      const next = generateMathProblem();
      question = next.question;
      answer = next.answer;
      const qEl = overlay.querySelector('#hc-math-question');
      const inputEl = overlay.querySelector('#hc-math-input') as HTMLInputElement | null;
      const errEl = overlay.querySelector('#hc-math-error') as HTMLElement | null;
      if (qEl) qEl.textContent = question;
      if (inputEl) { inputEl.value = ''; inputEl.focus(); }
      if (errEl) errEl.style.display = 'none';
    };

    const checkAnswer = () => {
      const input = overlay.querySelector('#hc-math-input') as HTMLInputElement | null;
      const errEl = overlay.querySelector('#hc-math-error') as HTMLElement | null;
      if (!input) return;
      const userAnswer = parseInt(input.value.trim(), 10);
      if (userAnswer === answer) {
        log(`Step ${stepNumber} — Math challenge passed`);
        finish('proceed');
      } else {
        log(`Step ${stepNumber} — Math challenge failed, new problem generated`);
        if (errEl) errEl.style.display = 'block';
        // Shake animation then new problem
        input.classList.add('hc-shake');
        setTimeout(() => {
          input.classList.remove('hc-shake');
          newProblem();
        }, 600);
      }
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { finish('cancel'); return; }
      if (e.key === 'Enter') { checkAnswer(); return; }
      if (e.key === 'Tab') {
        const focusable = Array.from(
          overlay.querySelectorAll<HTMLElement>('.hc-btn, #hc-math-input')
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
    overlay.querySelector('[data-action="proceed"]')?.addEventListener('click', checkAnswer);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish('cancel'); });

    applyThemeToOverlay(overlay);
    document.body.appendChild(overlay);
    (overlay.querySelector('#hc-math-input') as HTMLInputElement)?.focus();
  });
}
```

- [ ] **Step 3: Add math challenge CSS to styles.css**

```css
.hc-math-question {
  font-size: 22px;
  font-weight: 700;
  text-align: center;
  margin: 12px 0 8px;
  color: var(--hc-text, #efeff1);
}

.hc-math-input {
  text-align: center;
  font-size: 18px;
}

/* Remove number input spinners */
.hc-math-input::-webkit-outer-spin-button,
.hc-math-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
}
.hc-math-input[type=number] {
  -moz-appearance: textfield;
}

@keyframes hc-shake {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-6px); }
  40%       { transform: translateX(6px); }
  60%       { transform: translateX(-4px); }
  80%       { transform: translateX(4px); }
}

.hc-shake {
  animation: hc-shake 0.5s ease-in-out;
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: Build completes.

- [ ] **Step 5: Commit**

```bash
git add src/content/interceptor.ts src/content/styles.css
git commit -m "feat: add math challenge friction overlay step"
```

---

## Chunk 5: Wire Steps into runFrictionFlow + Final Build

### Task 14: Update runFrictionFlow to run steps based on frictionIntensity

**Files:**
- Modify: `src/content/interceptor.ts`

**Context:** `runFrictionFlow` currently runs: main overlay → comparison steps. Now it needs to continue with additional steps based on the user's `frictionIntensity` setting. The intensity is read from `UserSettings`, which is already loaded in `handleClick`. Pass it into `runFrictionFlow`.

**Step sequence:**
- Low: main → comparisons → done
- Medium: main → comparisons → reason-selection
- High: main → comparisons → reason-selection → cooldown(10s) → type-to-confirm
- Extreme: main → comparisons → reason-selection → cooldown(30s) → type-to-confirm → math challenge

- [ ] **Step 1: Add frictionIntensity parameter to runFrictionFlow**

Update the `runFrictionFlow` signature:

```typescript
async function runFrictionFlow(
  attempt: PurchaseAttempt,
  settings: UserSettings,
  tracker: SpendingTracker,
  maxComparisons?: number,
  whitelistNote?: string,
  frictionIntensity?: FrictionIntensity,
): Promise<FrictionResult> {
```

(Import `FrictionIntensity` from `'../shared/types'` if not already imported — add it to the existing import line.)

- [ ] **Step 2: Update the import line at the top of interceptor.ts**

Add `FrictionIntensity` to the import from `'../shared/types'`:

```typescript
import {
  PurchaseAttempt, OverlayDecision, OverlayCallback, UserSettings, DEFAULT_SETTINGS,
  FrictionLevel, FrictionIntensity, SpendingTracker, DEFAULT_SPENDING_TRACKER,
  ComparisonItem, migrateSettings, WhitelistEntry,
} from '../shared/types';
```

- [ ] **Step 3: Update runFrictionFlow body — compute grandTotal before comparison loop, then add extra steps after**

**3a. Compute extra steps and grandTotal BEFORE the comparison loop** (so step headers show the correct total).

Find the line `const totalSteps = 1 + comparisonSteps.length;` and replace it with:

```typescript
  const intensity = frictionIntensity ?? 'medium';
  const extraSteps: string[] = [];
  if (intensity === 'medium' || intensity === 'high' || intensity === 'extreme') extraSteps.push('reason');
  if (intensity === 'high' || intensity === 'extreme') extraSteps.push('cooldown', 'typeconfirm');
  if (intensity === 'extreme') extraSteps.push('math');

  const totalSteps = 1 + comparisonSteps.length;        // steps shown so far
  const grandTotal = totalSteps + extraSteps.length;    // true total
```

**3b. Update showComparisonStep calls** to pass `grandTotal` instead of `totalSteps` as the `totalSteps` argument, so comparison step headers say "STEP 2 OF 5" not "STEP 2 OF 3":

```typescript
  const decision = await showComparisonStep(item, display, stepNumber, grandTotal, attempt);
```

**3c. Add extra steps AFTER the comparison loop** (after the `log('Friction flow: completed all steps', ...)` line, before the final return):

```typescript
  // ── Extra friction steps based on frictionIntensity ─────────────────
  const stepOffset = 1 + comparisonSteps.length;  // step number where extras start

  let currentStep = stepOffset + 1;
  let purchaseReason: string | undefined;

  // Reason-selection (Medium+)
  if (extraSteps.includes('reason')) {
    const reasonResult = await showReasonSelectionStep(currentStep, grandTotal, attempt);
    if (reasonResult.decision === 'cancel') {
      log(`Friction flow: cancelled at Step ${currentStep} (reason-selection)`);
      return { decision: 'cancel', cancelledAtStep: currentStep, purchaseReason: reasonResult.reason };
    }
    purchaseReason = reasonResult.reason;
    currentStep++;
  }

  // Cooldown timer (High+)
  if (extraSteps.includes('cooldown')) {
    const cooldownSecs = intensity === 'extreme' ? 30 : 10;
    const cooldownDecision = await showFrictionCooldownStep(currentStep, grandTotal, cooldownSecs, attempt);
    if (cooldownDecision === 'cancel') {
      log(`Friction flow: cancelled at Step ${currentStep} (friction cooldown)`);
      return { decision: 'cancel', cancelledAtStep: currentStep, purchaseReason };
    }
    currentStep++;
  }

  // Type-to-confirm (High+)
  if (extraSteps.includes('typeconfirm')) {
    const typeDecision = await showTypeToConfirmStep(currentStep, grandTotal, attempt);
    if (typeDecision === 'cancel') {
      log(`Friction flow: cancelled at Step ${currentStep} (type-to-confirm)`);
      return { decision: 'cancel', cancelledAtStep: currentStep, purchaseReason };
    }
    currentStep++;
  }

  // Math challenge (Extreme only)
  if (extraSteps.includes('math')) {
    const mathDecision = await showMathChallengeStep(currentStep, grandTotal, attempt);
    if (mathDecision === 'cancel') {
      log(`Friction flow: cancelled at Step ${currentStep} (math challenge)`);
      return { decision: 'cancel', cancelledAtStep: currentStep, purchaseReason };
    }
  }
```

Then update the final return to include `purchaseReason`:

```typescript
  log('Friction flow: completed all steps', {
    totalSteps: grandTotal,
    channel: attempt.channel,
    rawPrice: attempt.rawPrice,
  });

  return { decision: 'proceed', purchaseReason };
```

- [ ] **Step 4: Pass frictionIntensity into the runFrictionFlow call in handleClick**

In `handleClick`, find the `runFrictionFlow` call and add `settings.frictionIntensity`:

```typescript
const frictionResult = await runFrictionFlow(
  attempt, settings, tracker, maxComparisons, whitelistNote, settings.frictionIntensity
);
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: Build completes without errors.

- [ ] **Step 6: End-to-end manual verification**

Load the extension in Chrome.

**Test Low intensity:**
- Set intensity to Low in options. Trigger a purchase. Verify: main modal → comparison steps → proceeds (no extra steps).

**Test Medium intensity:**
- Set intensity to Medium. Trigger a purchase. Verify: main → comparisons → reason-selection step appears. Click "Caught up in the moment" → verify auto-cancel message appears and purchase is blocked.

**Test High intensity:**
- Set intensity to High. Trigger a purchase. Proceed through main + comparisons + reason → verify cooldown timer bar appears, proceed button is disabled, enables after 10s. Then type-to-confirm step appears. Type "i want this" → verify proceed button enables. Click proceed.

**Test Extreme intensity:**
- Set to Extreme. Trigger a purchase. Proceed through all steps. Verify 30s cooldown. Verify math challenge appears. Enter wrong answer → verify shake + new problem. Enter correct answer → purchase proceeds.

**Test popup:**
- After running several intercepts (mix of cancelled and proceeded), click extension icon. Verify popup shows stats. Verify streaming override button works.

- [ ] **Step 7: Commit**

```bash
git add src/content/interceptor.ts
git commit -m "feat: wire all friction intensity steps into runFrictionFlow"
```

---

### Task 15: Version bump + update changelog and TODO

**Files:**
- Modify: `manifest.json`
- Modify: `package.json`
- Modify: `changelog.md`
- Modify: `HypeControl-TODO.md`

- [ ] **Step 1: Bump patch version in both files**

In `manifest.json`: `"version": "0.4.3"` → `"version": "0.4.4"`
In `package.json`: `"version": "0.4.3"` → `"version": "0.4.4"`

- [ ] **Step 2: Add changelog entry**

Add to top of `changelog.md` (after the header):

```markdown
## [0.4.4] - 2026-03-10

### Added
- **Popup stats panel** — clicking the extension icon now opens a dedicated popup showing: saved $ (90 days), purchases blocked, cancel rate, most effective friction step, and streaming mode manual override button
- **Structured intercept event log** — all friction flow outcomes now stored as structured events in `hcInterceptEvents` (chrome.storage.local) with 90-day rolling window
- **Friction intensity setting** — new Low / Medium / High / Extreme segmented control in the Friction section of options
- **Reason-selection step (Medium+)** — "Why are you making this purchase?" with three options; "Caught up in the moment" auto-cancels
- **Friction cooldown timer (High+)** — 10-second (High) or 30-second (Extreme) progress bar; proceed button locked until timer completes
- **Type-to-confirm step (High+)** — must type "I WANT THIS" (case-insensitive) to enable proceed
- **Math challenge step (Extreme)** — simple arithmetic must be solved before proceeding; wrong answer generates a new problem

---
```

- [ ] **Step 3: Update HypeControl-TODO.md**

Mark completed items:
- In "MVP Part 4b": mark popup stats items as `[x]`
- In "MVP Part 5": mark manual override button as `[x]`
- In "MVP Part 4": mark named friction level setting, reason-selection, cooldown timer, type-to-confirm, math problem, step-level cancellation tracking as `[x]`
- Update header: `**Current Version:** 0.4.4` and `**Updated:** 2026-03-10`

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: Build completes.

- [ ] **Step 5: Final commit**

```bash
git add manifest.json package.json changelog.md HypeControl-TODO.md
git commit -m "chore: bump to v0.4.4, update changelog and TODO for MVP completion"
```

---

## Quick Reference

| Intensity | Steps shown |
|-----------|-------------|
| Low | Main → Comparisons |
| Medium | Main → Comparisons → Reason |
| High | Main → Comparisons → Reason → Cooldown (10s) → Type-to-confirm |
| Extreme | Main → Comparisons → Reason → Cooldown (30s) → Type-to-confirm → Math |

| Storage key | What it holds |
|-------------|---------------|
| `hcSettings` | `UserSettings` (chrome.storage.sync) |
| `hcSpending` | `SpendingTracker` (chrome.storage.local) |
| `hcExtensionLog` | Raw log messages (chrome.storage.local) |
| `hcInterceptEvents` | Structured `InterceptEvent[]` with 90-day pruning (chrome.storage.local) |
| `hcManualOverride` | Override expiry timestamp (chrome.storage.local) |

| New file | Purpose |
|----------|---------|
| `src/shared/interceptLogger.ts` | Write/read/prune intercept events; compute popup stats |
| `src/popup/popup.html` | Popup markup |
| `src/popup/popup.ts` | Popup logic |
| `src/popup/popup.css` | Popup styles |
