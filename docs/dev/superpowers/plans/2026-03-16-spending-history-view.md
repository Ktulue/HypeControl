# Spending History View — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-tab spending history page showing a filterable, sortable table of InterceptEvents with a 6-metric summary bar, accessed via a new popup button.

**Architecture:** Three new files (`history.html`, `history.ts`, `history.css`) follow the existing logs page pattern — a webpack entry point, CopyPlugin HTML copy, and CSS import at the top of the TS file. All data comes from the existing `readInterceptEvents()` in `interceptLogger.ts`. Filtering, sorting, and aggregation are client-side. The popup gets a new button wired identically to the existing "View Activity Logs" pattern.

**Tech Stack:** TypeScript, webpack (MiniCssExtractPlugin + CopyPlugin), Chrome Extension APIs (`chrome.storage.sync`, `chrome.storage.local`, `chrome.tabs.create`), Space Grotesk font.

**Subagent briefing:** Do NOT bump versions in `manifest.json` or `package.json`. Version bumping happens once at the end, not per-task.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/history/history.html` | Page shell — head, font links, summary bar, filter controls, table container, empty states |
| Create | `src/history/history.ts` | All page logic — load events, filter, sort, render summary, render table, expand/collapse rows, theme init |
| Create | `src/history/history.css` | All page styles — layout, summary bar, filters, table, row detail, empty states, light mode overrides |
| Modify | `webpack.config.js` | Add `history` entry point + CopyPlugin pattern for `history.html` |
| Modify | `src/popup/popup.html` | Add "View Spending History" button adjacent to "View Activity Logs" |
| Modify | `src/popup/sections/settings-section.ts` | Wire new button to `chrome.tabs.create({ url: 'history.html' })` |
| Modify | `manifest.json` | Version bump (final task only) |
| Modify | `package.json` | Version bump (final task only) |
| Modify | `HypeControl-TODO.md` | Mark Add-on 2 complete, update header |

---

## Chunk 1: Infrastructure & Page Shell

### Task 1: Webpack Configuration

**Files:**
- Modify: `webpack.config.js:6-12` (entry points) and `:38-53` (CopyPlugin patterns)

- [ ] **Step 1: Add history entry point to webpack config**

In `webpack.config.js`, add the `history` entry alongside the existing entries:

```js
entry: {
  content: './src/content/index.ts',
  history: './src/history/history.ts',   // ← add this line
  logs: './src/logs/logs.ts',
  popup: './src/popup/popup.ts',
  serviceWorker: './src/background/serviceWorker.ts',
},
```

- [ ] **Step 2: Add CopyPlugin pattern for history.html**

In the `CopyPlugin` patterns array (after the `logs.html` entry), add:

```js
{ from: 'src/history/history.html', to: 'history.html' },
```

The patterns array should now include:
```js
{ from: 'src/logs/logs.html', to: 'logs.html' },
{ from: 'src/history/history.html', to: 'history.html' },
{ from: 'src/popup/popup.html', to: 'popup.html' },
```

- [ ] **Step 3: Commit**

```bash
git add webpack.config.js
git commit -m "feat: add history page webpack entry point and copy pattern"
```

---

### Task 2: History HTML Page

**Files:**
- Create: `src/history/history.html`

- [ ] **Step 1: Create the history HTML page**

Create `src/history/history.html` with the full page structure. This follows the same pattern as `logs.html` — standalone page that loads its own CSS and JS bundle:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Spending History — Hype Control</title>
  <link rel="stylesheet" href="history.css">
</head>
<body>
  <div class="history-wrapper">
    <h1 class="history-title">
      <img src="assets/icons/ChromeWebStore/HC_icon_48px.png" width="40" height="40" alt="Hype Control">
      Spending History
    </h1>

    <!-- Summary Bar -->
    <div class="summary-bar" id="summary-bar">
      <div class="summary-metric" id="metric-spent">
        <span class="metric-value">$0.00</span>
        <span class="metric-label">Total Spent</span>
      </div>
      <div class="summary-metric" id="metric-saved">
        <span class="metric-value">$0.00</span>
        <span class="metric-label">Total Saved</span>
      </div>
      <div class="summary-metric" id="metric-cancel-rate">
        <span class="metric-value">0.0%</span>
        <span class="metric-label">Cancel Rate</span>
      </div>
      <div class="summary-metric" id="metric-count">
        <span class="metric-value">0</span>
        <span class="metric-label">Events</span>
      </div>
      <div class="summary-metric" id="metric-top-step">
        <span class="metric-value">—</span>
        <span class="metric-label">Top Cancel Step</span>
      </div>
      <div class="summary-metric" id="metric-top-reason">
        <span class="metric-value">—</span>
        <span class="metric-label">Top Reason</span>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar" id="filter-bar">
      <div class="filter-group">
        <label class="filter-label" for="filter-start">From</label>
        <input type="date" id="filter-start" class="filter-input">
      </div>
      <div class="filter-group">
        <label class="filter-label" for="filter-end">To</label>
        <input type="date" id="filter-end" class="filter-input">
      </div>
      <div class="filter-group">
        <label class="filter-label" for="filter-channel">Channel</label>
        <select id="filter-channel" class="filter-select">
          <option value="">All Channels</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Outcome</label>
        <div class="outcome-toggle" id="outcome-toggle" role="group" aria-label="Outcome filter">
          <button class="outcome-btn active" data-value="all">All</button>
          <button class="outcome-btn" data-value="cancelled">Cancelled</button>
          <button class="outcome-btn" data-value="proceeded">Proceeded</button>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="table-container">
      <table class="history-table" id="history-table">
        <thead>
          <tr>
            <th class="sortable active" data-sort="timestamp">Date/Time <span class="sort-arrow">▼</span></th>
            <th class="sortable" data-sort="channel">Channel <span class="sort-arrow"></span></th>
            <th class="sortable" data-sort="amount">Amount <span class="sort-arrow"></span></th>
            <th class="sortable" data-sort="outcome">Outcome <span class="sort-arrow"></span></th>
            <th class="sortable" data-sort="saved">Saved <span class="sort-arrow"></span></th>
          </tr>
        </thead>
        <tbody id="history-tbody">
        </tbody>
      </table>
    </div>

    <!-- Empty states -->
    <div class="empty-state" id="empty-no-data" hidden>
      No spending activity recorded yet. HypeControl will log purchases as you browse Twitch.
    </div>
    <div class="empty-state" id="empty-no-match" hidden>
      No events match your filters. Try adjusting the date range or clearing filters.
    </div>
  </div>

  <script src="history.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/history/history.html
git commit -m "feat: add spending history page HTML shell"
```

---

### Task 3: History CSS — Base Styles

**Files:**
- Create: `src/history/history.css`

- [ ] **Step 1: Create the history CSS file with all styles**

Create `src/history/history.css`. This reuses the same CSS variable system as `logs.css` (same `@font-face` declarations, same `:root` variables, same `[data-theme="light"]` overrides). The page-specific styles cover: layout, summary bar, filter bar, table, expandable row detail, and empty states.

```css
/* ─── Font faces (same as logs.css) ─────────────────────── */
@font-face {
  font-family: 'Space Grotesk';
  src: url('assets/fonts/SpaceGrotesk-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: 'Space Grotesk';
  src: url('assets/fonts/SpaceGrotesk-Medium.woff2') format('woff2');
  font-weight: 500;
  font-display: swap;
}
@font-face {
  font-family: 'Space Grotesk';
  src: url('assets/fonts/SpaceGrotesk-SemiBold.woff2') format('woff2');
  font-weight: 600;
  font-display: swap;
}
@font-face {
  font-family: 'Space Grotesk';
  src: url('assets/fonts/SpaceGrotesk-Bold.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
}

/* ─── Variables (same token system as logs.css) ─────────── */
:root {
  --bg-primary:    #18181b;
  --bg-secondary:  #1f1f23;
  --bg-input:      #0e0e10;
  --border-color:  #2a2a2e;
  --accent:        #9147ff;
  --accent-hover:  #772ce8;
  --accent-rgb:    145, 71, 255;
  --text-primary:  #efeff1;
  --text-secondary:#adadb8;
  --text-muted:    #666;
  --danger:        #e91916;
  --danger-rgb:    233, 25, 22;
  --success:       #22C55E;
  --success-light: #16A34A;
  --outcome-proceeded: #adadb8;
  --outcome-proceeded-light: #53535f;
  --radius:        4px;
  --font:          'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono:     'Space Grotesk', 'Consolas', 'Monaco', monospace;
}

/* ─── Light mode overrides ───────────────────────────────── */
[data-theme="light"] {
  --bg-primary:    #ffffff;
  --bg-secondary:  #f4f4f5;
  --bg-input:      #e9e9ec;
  --border-color:  #d4d4d8;
  --text-primary:  #18181b;
  --text-secondary:#3f3f46;
  --text-muted:    #71717a;
  --accent:        #7c3aed;
  --accent-hover:  #6d28d9;
  --accent-rgb:    124, 58, 237;
  --danger:        #e91916;
  --success:       #16A34A;
  --outcome-proceeded: #53535f;
}

/* ─── Reset ──────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ─── Base ───────────────────────────────────────────────── */
body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font);
  font-size: 14px;
  padding: 24px;
}

/* ─── Layout ─────────────────────────────────────────────── */
.history-wrapper {
  max-width: 1100px;
  margin: 0 auto;
}

/* ─── Heading ────────────────────────────────────────────── */
.history-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

/* ─── Summary Bar ────────────────────────────────────────── */
.summary-bar {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.summary-metric {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 14px 12px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric-value {
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}

.metric-label {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}

/* Color-code the saved metric */
#metric-saved .metric-value {
  color: var(--success);
}

/* ─── Filter Bar ─────────────────────────────────────────── */
.filter-bar {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}

.filter-input,
.filter-select {
  background: var(--bg-input);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 6px 10px;
  font-family: var(--font);
  font-size: 13px;
}

.filter-input:focus,
.filter-select:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

/* ─── Outcome Toggle ─────────────────────────────────────── */
.outcome-toggle {
  display: flex;
  gap: 2px;
}

.outcome-btn {
  background: var(--bg-input);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 6px 12px;
  font-family: var(--font);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}

.outcome-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.outcome-btn.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  font-weight: 600;
}

.outcome-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* ─── Table ──────────────────────────────────────────────── */
.table-container {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.history-table th {
  background: var(--bg-secondary);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
  user-select: none;
}

.history-table th.sortable {
  cursor: pointer;
}

.history-table th.sortable:hover {
  color: var(--text-primary);
}

.history-table th.active {
  color: var(--accent);
}

.sort-arrow {
  font-size: 10px;
  margin-left: 4px;
}

.history-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
  vertical-align: top;
}

.history-table tbody tr {
  cursor: pointer;
  transition: background 0.1s;
}

.history-table tbody tr:hover {
  background: var(--bg-secondary);
}

.history-table tbody tr:last-child td {
  border-bottom: none;
}

/* Column widths */
.history-table th:nth-child(1),
.history-table td:nth-child(1) { width: 26%; }
.history-table th:nth-child(2),
.history-table td:nth-child(2) { width: 20%; }
.history-table th:nth-child(3),
.history-table td:nth-child(3) { width: 14%; font-family: var(--font-mono); }
.history-table th:nth-child(4),
.history-table td:nth-child(4) { width: 16%; }
.history-table th:nth-child(5),
.history-table td:nth-child(5) { width: 14%; font-family: var(--font-mono); }

/* Outcome colors */
.outcome-cancelled {
  color: var(--success);
  font-weight: 600;
}

.outcome-proceeded {
  color: var(--outcome-proceeded);
}

/* Saved column */
.saved-value {
  color: var(--success);
  font-weight: 600;
}

/* ─── Expandable Row Detail ──────────────────────────────── */
.detail-row td {
  padding: 0 12px 12px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-input);
}

.detail-row:hover {
  background: var(--bg-input) !important;
}

.detail-panel {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px 24px;
  padding: 12px 0;
}

.detail-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-field-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}

.detail-field-value {
  font-size: 13px;
  color: var(--text-primary);
}

/* ─── Empty States ───────────────────────────────────────── */
.empty-state {
  color: var(--text-muted);
  text-align: center;
  padding: 48px 24px;
  font-size: 14px;
  line-height: 1.6;
}

/* ─── Responsive ─────────────────────────────────────────── */
@media (max-width: 768px) {
  .summary-bar {
    grid-template-columns: repeat(3, 1fr);
  }

  .filter-bar {
    flex-direction: column;
    align-items: stretch;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/history/history.css
git commit -m "feat: add spending history page styles"
```

---

### Task 4: History TypeScript — Scaffold with Theme Init

**Files:**
- Create: `src/history/history.ts`

- [ ] **Step 1: Create the history TS file with imports and theme initialization**

Create `src/history/history.ts` with the CSS import (for webpack extraction), theme initialization (copied from `logs.ts` pattern), and the `DOMContentLoaded` entry point. This task creates the scaffold; subsequent tasks add the logic.

```typescript
/**
 * Hype Control — Spending History page
 * Full-tab view of InterceptEvents with filtering, sorting, and summary metrics.
 */

import './history.css';
import { InterceptEvent } from '../shared/types';
import { readInterceptEvents } from '../shared/interceptLogger';

// ─── State ──────────────────────────────────────────────────
let allEvents: InterceptEvent[] = [];
let filteredEvents: InterceptEvent[] = [];
let sortColumn: 'timestamp' | 'channel' | 'amount' | 'outcome' | 'saved' = 'timestamp';
let sortAsc = false; // default: newest first (descending)
let expandedRowId: string | null = null;

// ─── Theme ──────────────────────────────────────────────────
async function initTheme(): Promise<void> {
  try {
    const result = await chrome.storage.sync.get('hcSettings');
    const theme = result?.hcSettings?.theme;
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else if (theme === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches) {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  } catch {
    // non-extension context — ignore
  }
}

// ─── Formatting helpers ─────────────────────────────────────
function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  return '$' + value.toFixed(2);
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }) + ' ' + d.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── Placeholder functions (filled in by subsequent tasks) ──
function applyFilters(): void { /* Task 6 */ }
function computeSummary(): void { /* Task 7 */ }
function renderTable(): void { /* Task 8 */ }
function setupFilters(): void { /* Task 6 */ }
function setupSort(): void { /* Task 8 */ }

// ─── Entry point ────────────────────────────────────────────
async function main(): Promise<void> {
  await initTheme();
  allEvents = await readInterceptEvents();

  setupFilters();
  setupSort();
  applyFilters();
}

document.addEventListener('DOMContentLoaded', () => { main(); });
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: Build succeeds. `dist/history.js`, `dist/history.css`, and `dist/history.html` all exist.

- [ ] **Step 3: Commit**

```bash
git add src/history/history.ts
git commit -m "feat: add spending history page scaffold with theme init"
```

---

## Chunk 2: Core Logic — Filters, Summary, Table, Row Detail

### Task 5: Popup Button — "View Spending History"

**Files:**
- Modify: `src/popup/popup.html:351` (Settings section, adjacent to View Activity Logs button)
- Modify: `src/popup/sections/settings-section.ts:16,28-30`

- [ ] **Step 1: Add the button to popup HTML**

In `src/popup/popup.html`, in the Settings section, add a new row BEFORE the "View Activity Logs" row (line ~351):

```html
        <div class="hc-row">
          <button class="btn-secondary" id="btn-view-history">View Spending History</button>
        </div>
```

The Settings section should now have:
```html
        <div class="hc-row">
          <button class="btn-secondary" id="btn-view-history">View Spending History</button>
        </div>
        <div class="hc-row">
          <button class="btn-secondary" id="btn-view-logs">View Activity Logs</button>
        </div>
```

- [ ] **Step 2: Wire the button in settings-section.ts**

In `src/popup/sections/settings-section.ts`, add a query for the new button and its click handler, following the exact pattern used for the logs button:

After line 16 (`const logsBtn = ...`), add:
```typescript
  const historyBtn = el.querySelector<HTMLButtonElement>('#btn-view-history')!;
```

After the `logsBtn.addEventListener('click', ...)` block (after line 30), add:
```typescript
  historyBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
  });
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/popup/popup.html src/popup/sections/settings-section.ts
git commit -m "feat: add View Spending History button to popup settings"
```

---

### Task 6: Filter Logic

**Files:**
- Modify: `src/history/history.ts` (replace placeholder `setupFilters` and `applyFilters`)

- [ ] **Step 1: Implement setupFilters and applyFilters**

Replace the placeholder `setupFilters` and `applyFilters` functions in `history.ts` with the full implementations. Also remove the placeholder comment lines for these functions.

Replace the `setupFilters` placeholder:

```typescript
function setupFilters(): void {
  const startEl = document.getElementById('filter-start') as HTMLInputElement;
  const endEl = document.getElementById('filter-end') as HTMLInputElement;
  const channelEl = document.getElementById('filter-channel') as HTMLSelectElement;
  const outcomeToggle = document.getElementById('outcome-toggle')!;

  // Default date range: last 30 days
  const today = new Date();
  const thirtyAgo = new Date(today);
  thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  startEl.value = toDateInputValue(thirtyAgo);
  endEl.value = toDateInputValue(today);

  // Wire date inputs
  startEl.addEventListener('change', () => applyFilters());
  endEl.addEventListener('change', () => applyFilters());

  // Wire channel select
  channelEl.addEventListener('change', () => applyFilters());

  // Wire outcome toggle
  outcomeToggle.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.outcome-btn') as HTMLButtonElement | null;
    if (!btn) return;
    outcomeToggle.querySelectorAll('.outcome-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilters();
  });
}
```

Replace the `applyFilters` placeholder:

```typescript
function applyFilters(): void {
  const startEl = document.getElementById('filter-start') as HTMLInputElement;
  const endEl = document.getElementById('filter-end') as HTMLInputElement;
  const channelEl = document.getElementById('filter-channel') as HTMLSelectElement;
  const outcomeToggle = document.getElementById('outcome-toggle')!;
  const activeOutcome = outcomeToggle.querySelector('.outcome-btn.active') as HTMLButtonElement;
  const outcomeFilter = activeOutcome?.dataset.value ?? 'all';

  // Parse date range — start of startDate to end of endDate
  const startDate = startEl.value ? new Date(startEl.value + 'T00:00:00') : null;
  const endDate = endEl.value ? new Date(endEl.value + 'T23:59:59.999') : null;

  // Filter events
  filteredEvents = allEvents.filter(event => {
    // Date range
    if (startDate && event.timestamp < startDate.getTime()) return false;
    if (endDate && event.timestamp > endDate.getTime()) return false;

    // Channel
    if (channelEl.value && event.channel !== channelEl.value) return false;

    // Outcome
    if (outcomeFilter !== 'all' && event.outcome !== outcomeFilter) return false;

    return true;
  });

  // Update channel dropdown (only channels in current date range)
  updateChannelDropdown(channelEl);

  // Sort and render
  sortEvents();
  computeSummary();
  renderTable();
  updateEmptyStates();
}
```

- [ ] **Step 2: Add the updateChannelDropdown and updateEmptyStates helpers**

Add these functions above `applyFilters`:

```typescript
function updateChannelDropdown(channelEl: HTMLSelectElement): void {
  const startEl = document.getElementById('filter-start') as HTMLInputElement;
  const endEl = document.getElementById('filter-end') as HTMLInputElement;
  const startDate = startEl.value ? new Date(startEl.value + 'T00:00:00') : null;
  const endDate = endEl.value ? new Date(endEl.value + 'T23:59:59.999') : null;

  // Get unique channels in the date range
  const channelsInRange = new Set<string>();
  for (const event of allEvents) {
    if (startDate && event.timestamp < startDate.getTime()) continue;
    if (endDate && event.timestamp > endDate.getTime()) continue;
    channelsInRange.add(event.channel);
  }

  const previousValue = channelEl.value;
  channelEl.innerHTML = '';

  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = 'All Channels';
  channelEl.appendChild(allOption);

  const sorted = [...channelsInRange].sort((a, b) => a.localeCompare(b));
  for (const ch of sorted) {
    const opt = document.createElement('option');
    opt.value = ch;
    opt.textContent = ch;
    channelEl.appendChild(opt);
  }

  // Restore selection if still valid; otherwise reset to All
  if (channelsInRange.has(previousValue)) {
    channelEl.value = previousValue;
  } else {
    channelEl.value = '';
  }
}

function updateEmptyStates(): void {
  const noDataEl = document.getElementById('empty-no-data')!;
  const noMatchEl = document.getElementById('empty-no-match')!;
  const tableContainer = document.querySelector('.table-container') as HTMLElement;

  if (allEvents.length === 0) {
    noDataEl.removeAttribute('hidden');
    noMatchEl.setAttribute('hidden', '');
    tableContainer.style.display = 'none';
  } else if (filteredEvents.length === 0) {
    noDataEl.setAttribute('hidden', '');
    noMatchEl.removeAttribute('hidden');
    tableContainer.style.display = 'none';
  } else {
    noDataEl.setAttribute('hidden', '');
    noMatchEl.setAttribute('hidden', '');
    tableContainer.style.display = '';
  }
}
```

- [ ] **Step 3: Add the sortEvents helper**

Add above `applyFilters`:

```typescript
function sortEvents(): void {
  filteredEvents.sort((a, b) => {
    let cmp = 0;
    switch (sortColumn) {
      case 'timestamp':
        cmp = a.timestamp - b.timestamp;
        break;
      case 'channel':
        cmp = a.channel.localeCompare(b.channel);
        break;
      case 'amount':
        cmp = (a.priceWithTax ?? 0) - (b.priceWithTax ?? 0);
        break;
      case 'outcome':
        cmp = a.outcome.localeCompare(b.outcome);
        break;
      case 'saved':
        cmp = (a.savedAmount ?? 0) - (b.savedAmount ?? 0);
        break;
    }
    return sortAsc ? cmp : -cmp;
  });
}
```

- [ ] **Step 4: Verify the build compiles**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/history/history.ts
git commit -m "feat: implement filter and sort logic for spending history"
```

---

### Task 7: Summary Bar Computation

**Files:**
- Modify: `src/history/history.ts` (replace placeholder `computeSummary`)

- [ ] **Step 1: Implement computeSummary**

Replace the `computeSummary` placeholder with the full implementation. All 6 metrics are computed from `filteredEvents`. Currency math uses `Math.round(value * 100) / 100`.

```typescript
function computeSummary(): void {
  const proceeded = filteredEvents.filter(e => e.outcome === 'proceeded');
  const cancelled = filteredEvents.filter(e => e.outcome === 'cancelled');

  // Total Spent — sum of priceWithTax for proceeded events
  const totalSpent = Math.round(
    proceeded.reduce((sum, e) => sum + (e.priceWithTax ?? 0), 0) * 100
  ) / 100;

  // Total Saved — sum of savedAmount for cancelled events
  const totalSaved = Math.round(
    cancelled.reduce((sum, e) => sum + (e.savedAmount ?? 0), 0) * 100
  ) / 100;

  // Cancel Rate
  const cancelRate = filteredEvents.length === 0
    ? 0
    : Math.round((cancelled.length / filteredEvents.length) * 1000) / 10;

  // Event Count
  const eventCount = filteredEvents.length;

  // Top Cancel Step — step with highest cancel frequency, lowest step wins ties
  const stepCounts: Record<number, number> = {};
  for (const e of cancelled) {
    if (e.cancelledAtStep !== undefined) {
      stepCounts[e.cancelledAtStep] = (stepCounts[e.cancelledAtStep] ?? 0) + 1;
    }
  }
  let topStep: number | null = null;
  let maxStepCount = 0;
  for (const [step, count] of Object.entries(stepCounts)) {
    const stepNum = Number(step);
    if (count > maxStepCount || (count === maxStepCount && topStep !== null && stepNum < topStep)) {
      maxStepCount = count;
      topStep = stepNum;
    }
  }

  // Top Reason — most common purchaseReason among proceeded events
  const reasonCounts: Record<string, number> = {};
  for (const e of proceeded) {
    if (e.purchaseReason) {
      reasonCounts[e.purchaseReason] = (reasonCounts[e.purchaseReason] ?? 0) + 1;
    }
  }
  let topReason: string | null = null;
  let topReasonCount = 0;
  for (const [reason, count] of Object.entries(reasonCounts)) {
    if (count > topReasonCount) {
      topReasonCount = count;
      topReason = reason;
    }
  }

  // Update DOM
  setMetricValue('metric-spent', formatCurrency(totalSpent));
  setMetricValue('metric-saved', formatCurrency(totalSaved));
  setMetricValue('metric-cancel-rate', cancelRate.toFixed(1) + '%');
  setMetricValue('metric-count', String(eventCount));
  setMetricValue('metric-top-step', topStep !== null ? `Step ${topStep}` : '—');
  setMetricValue('metric-top-reason',
    topReason ? `${topReason} (${topReasonCount}x)` : '—'
  );
}

function setMetricValue(metricId: string, value: string): void {
  const el = document.getElementById(metricId);
  if (!el) return;
  const valueEl = el.querySelector('.metric-value');
  if (valueEl) valueEl.textContent = value;
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/history/history.ts
git commit -m "feat: implement summary bar computation for spending history"
```

---

### Task 8: Table Rendering, Sorting, and Expandable Row Detail

**Files:**
- Modify: `src/history/history.ts` (replace placeholder `renderTable` and `setupSort`)

- [ ] **Step 1: Implement renderTable with expandable row detail**

Replace the `renderTable` placeholder. Each row is built with DOM construction (no innerHTML). Clicking a row toggles an expandable detail panel below it. Only one row expanded at a time.

```typescript
function renderTable(): void {
  const tbody = document.getElementById('history-tbody')!;
  tbody.innerHTML = '';

  for (const event of filteredEvents) {
    // Main data row
    const tr = document.createElement('tr');
    tr.dataset.eventId = event.id;

    const tdDate = document.createElement('td');
    tdDate.textContent = formatDate(event.timestamp);
    tr.appendChild(tdDate);

    const tdChannel = document.createElement('td');
    tdChannel.textContent = event.channel;
    tr.appendChild(tdChannel);

    const tdAmount = document.createElement('td');
    tdAmount.textContent = formatCurrency(event.priceWithTax);
    tr.appendChild(tdAmount);

    const tdOutcome = document.createElement('td');
    tdOutcome.textContent = event.outcome === 'cancelled' ? 'Cancelled' : 'Proceeded';
    tdOutcome.className = event.outcome === 'cancelled' ? 'outcome-cancelled' : 'outcome-proceeded';
    tr.appendChild(tdOutcome);

    const tdSaved = document.createElement('td');
    if (event.outcome === 'cancelled' && event.savedAmount != null) {
      tdSaved.textContent = formatCurrency(event.savedAmount);
      tdSaved.className = 'saved-value';
    } else {
      tdSaved.textContent = '—';
    }
    tr.appendChild(tdSaved);

    // Click to expand/collapse
    tr.addEventListener('click', () => toggleDetail(event, tr));
    tbody.appendChild(tr);

    // If this row was expanded, re-expand it
    if (expandedRowId === event.id) {
      appendDetailRow(event, tr);
    }
  }
}

function toggleDetail(event: InterceptEvent, tr: HTMLTableRowElement): void {
  const tbody = document.getElementById('history-tbody')!;

  // Remove any existing detail row
  const existingDetail = tbody.querySelector('.detail-row');
  if (existingDetail) existingDetail.remove();

  if (expandedRowId === event.id) {
    // Collapse
    expandedRowId = null;
    return;
  }

  // Expand
  expandedRowId = event.id;
  appendDetailRow(event, tr);
}

function appendDetailRow(event: InterceptEvent, afterRow: HTMLTableRowElement): void {
  const detailTr = document.createElement('tr');
  detailTr.className = 'detail-row';

  const detailTd = document.createElement('td');
  detailTd.colSpan = 5;

  const panel = document.createElement('div');
  panel.className = 'detail-panel';

  // Purchase Type
  if (event.purchaseType) {
    panel.appendChild(makeDetailField('Purchase Type', event.purchaseType));
  }

  // Raw Price
  if (event.rawPrice) {
    panel.appendChild(makeDetailField('Raw Price', event.rawPrice));
  }

  // Price with Tax
  if (event.priceWithTax != null) {
    panel.appendChild(makeDetailField('Price with Tax', formatCurrency(event.priceWithTax)));
  }

  // Cancelled at Step (only for cancelled events)
  if (event.outcome === 'cancelled' && event.cancelledAtStep !== undefined) {
    panel.appendChild(makeDetailField('Cancelled at Step', `Step ${event.cancelledAtStep}`));
  }

  // Purchase Reason (only if set)
  if (event.purchaseReason) {
    panel.appendChild(makeDetailField('Purchase Reason', event.purchaseReason));
  }

  detailTd.appendChild(panel);
  detailTr.appendChild(detailTd);
  afterRow.after(detailTr);
}

function makeDetailField(label: string, value: string): HTMLElement {
  const field = document.createElement('div');
  field.className = 'detail-field';

  const labelEl = document.createElement('span');
  labelEl.className = 'detail-field-label';
  labelEl.textContent = label;
  field.appendChild(labelEl);

  const valueEl = document.createElement('span');
  valueEl.className = 'detail-field-value';
  valueEl.textContent = value;
  field.appendChild(valueEl);

  return field;
}
```

- [ ] **Step 2: Implement setupSort**

Replace the `setupSort` placeholder. Clicking a column header toggles sort direction. Active column gets highlighted.

```typescript
function setupSort(): void {
  const headers = document.querySelectorAll<HTMLTableCellElement>('.history-table th.sortable');

  headers.forEach(th => {
    th.addEventListener('click', () => {
      const column = th.dataset.sort as typeof sortColumn;
      if (sortColumn === column) {
        sortAsc = !sortAsc;
      } else {
        sortColumn = column;
        sortAsc = column === 'channel'; // alpha defaults ascending; everything else descending
      }

      // Update header visual state
      headers.forEach(h => {
        h.classList.remove('active');
        const arrow = h.querySelector('.sort-arrow');
        if (arrow) arrow.textContent = '';
      });
      th.classList.add('active');
      const arrow = th.querySelector('.sort-arrow');
      if (arrow) arrow.textContent = sortAsc ? '▲' : '▼';

      sortEvents();
      renderTable();
    });
  });
}
```

- [ ] **Step 3: Remove the placeholder comment lines**

Delete the lines:
```
function applyFilters(): void { /* Task 6 */ }
function computeSummary(): void { /* Task 7 */ }
function renderTable(): void { /* Task 8 */ }
function setupFilters(): void { /* Task 6 */ }
function setupSort(): void { /* Task 8 */ }
```

These were the scaffolding placeholders and are now replaced by the real implementations from Tasks 6, 7, and 8.

- [ ] **Step 4: Verify the build compiles**

Run: `npm run build`
Expected: Build succeeds. Open `dist/history.html` — page renders (data requires extension context).

- [ ] **Step 5: Commit**

```bash
git add src/history/history.ts
git commit -m "feat: implement table rendering, sorting, and expandable row detail"
```

---

## Chunk 3: Version Bump, Build, and Post-Work Updates

### Task 9: Version Bump, Build, and Post-Work Updates

**Files:**
- Modify: `manifest.json` — bump version to `0.4.23`
- Modify: `package.json` — bump version to `0.4.23`
- Modify: `HypeControl-TODO.md` — mark Add-on 2 complete, update header

- [ ] **Step 1: Bump version in both files**

In `manifest.json`, change `"version"` from `"0.4.22"` to `"0.4.23"`.
In `package.json`, change `"version"` from `"0.4.22"` to `"0.4.23"`.

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: Build succeeds. All files present in `dist/`: `history.js`, `history.css`, `history.html`, plus all existing files.

If the build fails, **stop and tell the user** to run `npm run build` manually. Do not retry.

- [ ] **Step 3: Update HypeControl-TODO.md**

Update the header:
- `**Updated:** 2026-03-16` → `**Updated:** 2026-03-16` (keep if same day, update otherwise)
- `**Current Version:** 0.4.22` → `**Current Version:** 0.4.23`

Update the Quick Summary table:
- `| Add-on 2 — Spending History View         | 🔲 Not Started    |` → `| Add-on 2 — Spending History View         | ✅ Complete       |`

In the "In-Scope (Still To Build)" section, mark Add-on 2 as complete:
- `- [ ] **Add-on 2 — Spending Tracker (History View)** ⭐⭐` → `- [x] **Add-on 2 — Spending Tracker (History View)** ⭐⭐`

Update the footer timestamp to reflect the current date and version.

- [ ] **Step 4: Commit**

```bash
git add manifest.json package.json HypeControl-TODO.md
git commit -m "maint: bump version to 0.4.23, mark Add-on 2 complete"
```

- [ ] **Step 5: Final verification**

Run: `npm run build`
Expected: Clean build. `dist/manifest.json` shows version `0.4.23`.
