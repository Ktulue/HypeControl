# Add-on 2: Spending History View — Design Spec

**Date:** 2026-03-16
**Status:** Approved
**Complexity:** ⭐⭐

---

## Overview

A full extension page (opens in a new browser tab) showing a filterable, sortable table of all InterceptEvents from the last 90 days, with a 6-metric summary bar and expandable row details. Accessed via a "View Spending History" button in the popup.

This is the "look back" companion to the weekly/monthly spending limits (Add-on 3). Users set caps to control future spending; this view lets them understand past spending patterns.

---

## Access Point

A "View Spending History" button in the popup, alongside the existing "View Activity Logs" button. Opens via `chrome.tabs.create({ url: 'history.html' })`.

---

## Page Layout

```
+----------------------------------------------------------+
| Summary Bar (6 metrics, updates with filters)            |
+----------------------------------------------------------+
| Filters: [Date Range] [Channel ▾] [Outcome: All|C|P]    |
+----------------------------------------------------------+
| Table Header (sortable columns)                          |
|   Date/Time | Channel | Amount | Outcome | Saved         |
+----------------------------------------------------------+
| Row 1                                                    |
|   > Expanded detail (purchase type, raw price, step,     |
|     reason)                                              |
| Row 2                                                    |
| Row 3                                                    |
| ...                                                      |
+----------------------------------------------------------+
| [Future: Export toolbar area — reserved, not implemented] |
+----------------------------------------------------------+
```

Respects the user's theme setting (auto/light/dark) by reading `hcSettings.theme` from `chrome.storage.sync` and applying the `data-theme` attribute, matching the logs page pattern (`initTheme()` in logs.ts). Space Grotesk, dark backgrounds, purple accent. Full browser tab width.

---

## Summary Bar — 6 Metrics

All metrics are dynamically scoped to the current filter state. When filters change, the summary updates.

| Metric | Source | Display |
|--------|--------|---------|
| **Total Spent** | Sum of `priceWithTax` for proceeded events (null = $0) | `$XX.XX` |
| **Total Saved** | Sum of `savedAmount` for cancelled events (null = $0) | `$XX.XX` |
| **Cancel Rate** | `cancelled.length / total.length * 100` | `XX.X%` |
| **Event Count** | Total events matching filters | `N` |
| **Top Cancel Step** | Step number with highest cancel frequency | `Step N` or `—` |
| **Top Reason** | Most common `purchaseReason` among proceeded events | `[reason] (Nx)` or `—` |

**Top Cancel Step:** Displays as `Step N` (number only). The `InterceptEvent` stores `cancelledAtStep` but not the friction intensity that was active, so step numbers can't be reliably mapped to step names (step 3 could be "Reason selection" or a comparison item depending on intensity). Matching the popup's existing "Best Step" display pattern which also shows just the number. On ties, lowest step number wins.

**Top Reason:** Only counts proceeded events that have a `purchaseReason` set. If no events have reasons (e.g., all at low intensity), shows `—`.

**Currency math:** All sums use `Math.round(value * 100) / 100` at computation time.

---

## Table — 5 Visible Columns

| Column | Source Field | Format | Sortable |
|--------|-------------|--------|----------|
| **Date/Time** | `timestamp` | Local date + time (e.g., "Mar 16, 2026 8:42 PM") | Yes (default: newest first) |
| **Channel** | `channel` | Plain text | Yes (alphabetical) |
| **Amount** | `priceWithTax` | `$XX.XX` or `—` if null | Yes (numeric) |
| **Outcome** | `outcome` | "Cancelled" or "Proceeded" | Yes |
| **Saved** | `savedAmount` | `$XX.XX` for cancelled, `—` for proceeded | Yes (numeric) |

### Outcome Styling
- **Cancelled:** Green text (`#22C55E` dark / `#16A34A` light) — celebrates the save
- **Proceeded:** Muted text (`#adadb8` dark / `#53535f` light) — acknowledges without judging

### Sort Behavior
- Click column header to sort ascending; click again for descending
- Sort indicator arrow on the active column
- Default: Date/Time descending (newest first)
- Only one column sorted at a time

---

## Expandable Row Detail

Click any row to expand/collapse a detail panel below it. Only one row expanded at a time (clicking another collapses the previous).

**Detail fields:**

| Field | Source | Display |
|-------|--------|---------|
| **Purchase Type** | `purchaseType` | Plain text (e.g., "Gift a Sub") |
| **Raw Price** | `rawPrice` | Original string from Twitch (e.g., "$4.99") |
| **Price with Tax** | `priceWithTax` | `$XX.XX` (computed value) |
| **Cancelled at Step** | `cancelledAtStep` | `Step N` (only for cancelled events) |
| **Purchase Reason** | `purchaseReason` | Plain text (only if set) |

Fields with no data (null/undefined) are omitted from the detail panel, not shown as blank.

**Security:** All field values rendered via `textContent`, never innerHTML. Channel names and purchase types come from Twitch DOM / storage and must not be interpolated into HTML.

---

## Filters — 3 Controls

Positioned between the summary bar and the table. All filters apply immediately on change (no "Apply" button).

### Date Range
- Two date inputs: start date and end date
- Default: last 30 days (today minus 30 days through today)
- Max range: 90 days (limited by data retention)
- Changing dates re-filters the table and updates the summary bar

### Channel
- Dropdown / select element
- Auto-populated from unique channel names in the current data set
- Default: "All Channels"
- Updates when date range changes (only shows channels with events in the selected range)
- If the currently selected channel has no events in the new date range, resets to "All Channels"

### Outcome
- Three-state toggle or segmented control: All / Cancelled / Proceeded
- Default: All
- Visual styling matches the outcome column colors

---

## Data Source

- Reads from `chrome.storage.local` via the existing `readInterceptEvents()` function from `src/shared/interceptLogger.ts`
- No new storage schemas or write paths needed
- 90-day rolling window maintained by existing pruning logic
- All filtering, sorting, and aggregation happens client-side in the page's TypeScript

---

## Empty States

- **No events at all:** "No spending activity recorded yet. HypeControl will log purchases as you browse Twitch."
- **No events matching filters:** "No events match your filters. Try adjusting the date range or clearing filters."
- **No price data:** Some events may have `priceWithTax: null` (price not detected). These show `—` in the Amount column and sort as 0.

---

## File Structure

New files (following existing patterns):
- `src/history/history.html` — page HTML
- `src/history/history.ts` — page logic (filtering, sorting, rendering). Must `import './history.css'` at top for webpack CSS extraction (matches logs.ts pattern).
- `src/history/history.css` — page styles

Modified files:
- `webpack.config.js` — add `history` entry point AND CopyPlugin pattern: `{ from: 'src/history/history.html', to: 'history.html' }` (matches existing logs.html pattern)
- `src/popup/popup.html` — add "View Spending History" button in the Settings section, adjacent to the existing "View Activity Logs" button
- `src/popup/popup.ts` — wire button to open history page via `chrome.tabs.create()`

---

## Design Principles Applied

1. **Numbers are the hero.** Summary bar metrics and the Amount/Saved columns are visually prominent.
2. **Voice over chrome.** The empty states carry personality without decorative elements.
3. **Green means saved.** Cancelled outcomes and saved amounts use the success color consistently.
4. **Distinct, not foreign.** Dark theme, Space Grotesk, purple accent — matches the extension and lives comfortably in Twitch's world.
5. **Friction is the feature.** The Top Cancel Step metric reinforces which friction steps actually work.

---

## Out of Scope

- **Data export (CSV/JSON/PDF)** — Deferred to Add-on 6. Page layout reserves space for a future export toolbar.
- **Charts/visualizations** — Deferred to Add-ons 11/12. The table and summary bar are sufficient for the data volume.
- **Peak spending hours / time bucketing** — Noted in TODO as deferred to this add-on, but the raw timestamp data in the table covers this. Dedicated time analysis can come with the analytics dashboard.
- **Cross-device sync** — InterceptEvents are in `chrome.storage.local` (device-only). This is by design.
