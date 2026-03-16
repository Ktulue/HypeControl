# Scope Contract
**Task:** Add-on 2 — Spending History View | **Spec:** `docs/superpowers/specs/2026-03-16-spending-history-view-design.md` | **Date:** 2026-03-16 | **Status:** ACTIVE

## In Scope
- **Files (new):** `src/history/history.html`, `src/history/history.ts`, `src/history/history.css`
- **Files (modify):** `webpack.config.js`, `src/popup/popup.html`, `src/popup/popup.ts`
- **Files (version bump):** `manifest.json`, `package.json`, `HypeControl-TODO.md`
- **Features:**
  - Full extension page with filterable/sortable table of InterceptEvents
  - 6-metric summary bar (Total Spent, Total Saved, Cancel Rate, Event Count, Top Cancel Step, Top Reason)
  - 3 filters (date range, channel, outcome)
  - Expandable row detail (purchase type, raw price, tax price, step, reason)
  - Sortable column headers (default: newest first)
  - Theme support (auto/light/dark)
  - "View Spending History" button in popup
  - Empty states
- **Explicit Boundaries:** No charts, no export, no new storage schemas

## Out of Scope
- Toggle alignment in popup (CSS fix — separate branch)
- Tour button placement (HTML reorder — separate branch)
- Weekly reset day preference (Sunday vs Monday — follow-up to PR #15)
- Data export (Add-on 6)
- Charts/visualizations (Add-ons 11/12)
- Any changes to interceptor.ts or the friction overlay

# Scope Change Log
| # | Category | What | Why | Decision | Outcome |
|---|----------|------|-----|----------|---------|
| 1 | user-expansion | Toggle alignment fix | User noticed misaligned toggles in popup | Defer | Follow-up task |
| 2 | user-expansion | Tour button move to right of Save | User wants different placement | Defer | Follow-up task |
| 3 | user-expansion | Weekly reset day (Sun vs Mon) | User questioning Monday default | Defer | Follow-up task |

# Follow-up Tasks
- [ ] Fix popup toggle alignment (CSS) — scope change #1
- [ ] Move Tour button to right of Save Settings — scope change #2
- [ ] Decide weekly reset start day (Sunday vs Monday) — scope change #3
