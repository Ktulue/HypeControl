# Hype Control - What's Left To Do

**Updated:** 2026-03-12
**Current Version:** 0.4.9
**Based On:** MTS-Project-Document.md vs. actual codebase audit (MTS was the original project codename)

---

## Quick Summary

| Phase                                     | Status            |
| ----------------------------------------- | ----------------- |
| MVP Part 1 — Foundation & Detection       | ✅ Complete       |
| MVP Part 2 — Options Page & Settings      | ✅ Complete       |
| MVP Part 3 — Tax + Hours + Comparisons    | ✅ Complete       |
| MVP Part 4 — Multi-Step Friction Levels   | ✅ Complete        |
| MVP Part 4b — Analytics & Popup Stats     | ✅ Complete        |
| MVP Part 5 — Streaming Mode               | ✅ Complete        |
| MVP Part 6 — Integration Testing & Polish | ⚠️ Partially Done |
| Add-on 5 — Streamer Whitelist             | ✅ Complete        |
| Phase 4 — Other Add-ons                   | ⚠️ Partially Done |

---

## MVP GAP ANALYSIS

### ✅ MVP Part 1 — Foundation & Detection (COMPLETE)

All core features are working:

- Manifest V3 setup, TypeScript, webpack build
- MutationObserver-based purchase detection
- Click interception (capture phase)
- Overlay with Cancel / Proceed buttons
- Price extraction from DOM

---

### ✅ MVP Part 2 — Options Page (COMPLETE)

Working:

- Hourly rate and salary-to-hourly conversion
- Sales tax rate input
- Chrome storage sync (save/load)
- Comparison items (preset + custom CRUD with similarity detection)
- Friction thresholds by price
- Spending cooldown setting
- Daily spending cap setting
- Streaming Mode settings (username, grace period, log bypassed)
- Channel Whitelist management (add/remove/behavior-change)
- Toast notification duration setting

---

### ✅ MVP Part 3 — Calculations (COMPLETE)

Working:

- Price + tax calculation
- Work-hours equivalent
- Comparison items in overlay steps
- Daily spending progress display

---

### ✅ MVP Part 4 — Multi-Step Friction Levels (COMPLETE)

**What's implemented:** Friction tiers by price threshold (no-friction / nudge / full), with comparison items displayed as sequential steps. Full named intensity setting (Low/Medium/High/Extreme) with all four overlay steps.

- [x] **Named friction level setting** — Low / Medium / High / Extreme segmented control on options page, stored in `frictionIntensity` setting
- [x] **Reason-selection step (Medium+)** — "Why are you buying this?" modal with 5 reasons; proceed requires selecting one
- [x] **Cooldown timer step (High+)** — Progress bar countdown (10s for High, 30s for Extreme), proceed button disabled until timer completes
- [x] **Type-to-confirm step (High only)** — User must type "I want to buy this" (case-insensitive) to proceed
- [x] **Math challenge step (Extreme only)** — Simple arithmetic problem; wrong answer generates a new problem, correct answer allows proceed
- [x] **Step-level cancellation tracking** — `cancelledAtStep` field on `FrictionResult`, written to `InterceptEvent` in storage

---

### ✅ MVP Part 4b — Analytics & Popup Stats (COMPLETE)

**What's implemented:** Structured `InterceptEvent` store with 90-day auto-pruning. Popup stats panel showing computed insights. Streaming override accessible from popup.

- [x] **Popup with stats** — `popup.html` shows saved total, blocked count, cancel rate, most effective friction step. Clicking extension icon opens popup (not options page).
- [x] **"Money saved" calculation** — `savedAmount` on each cancelled `InterceptEvent`; `computePopupStats()` sums them
- [x] **Cancel-rate insight** — % of intercepts cancelled, displayed in popup
- [x] **Most effective step insight** — Step with highest cancel rate shown in popup
- [x] **Auto-prune to 90 days** — `interceptLogger.ts` prunes events older than 90 days on every write
- [ ] **Peak spending hours** — Hour-of-day bucketing (not implemented — deferred to Add-on 2)
- [ ] **Top channels** — Per-channel stats (not implemented — deferred to Add-on 2)

---

### ✅ MVP Part 5 — Streaming Mode (COMPLETE)

**What's implemented:**

- ✅ `streamingMode.ts` module with `detectIfLive()`, `shouldBypassFriction()`, `checkAndUpdateLiveStatus()`, `updateGracePeriodBadge()`
- ✅ `getCurrentChannel()` imported from `./detector`
- ✅ Multiple live-detection DOM selectors: `p.tw-channel-status-text-indicator`, `#live-channel-stream-information`, legacy `data-a-target` fallbacks, JSON-LD `isLiveBroadcast`
- ✅ Grace period logic — elapsed/remaining math, state persisted to `chrome.storage.local`
- ✅ Toast notification on bypass (`showStreamingModeToast()`)
- ✅ Grace period badge (`updateGracePeriodBadge()`)
- ✅ Bypassed purchases logged with `wasStreamingMode: true`
- ✅ Twitch username field in options
- ✅ Enable toggle in options (default: on)
- ✅ Grace period setting in options (default: 15 min)
- ✅ Log bypassed purchases toggle in options (default: on)

**What is still MISSING:**

- [x] **Manual override button** in popup — `popup.html` has a "Stream Override (2 hr)" button that sets a 2-hour streaming override window. Clears automatically when expired.

---

### ⚠️ MVP Part 6 — Polish & Edge Cases (PARTIALLY DONE)

**What's implemented:** Error handling, multiple DOM fallback selectors, debounced saves, escape-key dismissal, backdrop click to cancel, version tracking, debug functions (`HC.testOverlay()`, `HC.scanButtons()`), inline field validation with error messages, overlay entrance animations (fadeIn + slideIn CSS keyframes). Options page UI polish: responsive two/three-column grid layout on wider screens, centered section headers, styled footer with centered buttons and version number, comparison item deduplication in migration.

**What is still MISSING:**

- [x] ~~**Fresh-install onboarding**~~ — ✅ Implemented: `chrome.runtime.onInstalled` handler in `serviceWorker.ts` opens the options page on first install
- [x] ~~**Focus trap in overlay**~~ — ✅ Implemented: Tab/Shift+Tab wraps between first and last buttons in all modals (see `interceptor.ts`)
- [x] ~~**Overlay entrance animation**~~ — ✅ Implemented: `hc-fadeIn` on backdrop, `hc-slideIn` on modal (see `styles.css`)
- [ ] **Keyboard: Enter to confirm** — Where applicable (e.g., type-to-confirm step, final step). Steps now exist — this is implementable
- [x] ~~**ARIA attributes audit**~~ — ✅ All overlay modals (main, comparison, cooldown) have `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and `aria-describedby`
- [x] ~~**"No price detected" fallback**~~ — ✅ Verified: overlay shows "Price not detected" as the price display and "Unable to detect price. Proceed with caution." when `priceValue` is null (see `interceptor.ts:355-361`)

---

## SECURITY FIXES

### Stored XSS in Logs Page (High Priority)

Two confirmed stored XSS vulnerabilities in `src/logs/logs.ts` found via security review. Both execute in the `chrome-extension://` page context, which has access to `chrome.storage.sync` and other extension APIs.

- [ ] **Fix `e.message` injection (logs.ts:37)** — `renderLogs()` interpolates `e.message` into `innerHTML` unsanitized. Attack path: malicious Twitch URL path (`/channel`) → logged by interceptor.ts → stored in `chrome.storage.local` → rendered via `innerHTML` in logs page. Fix: build log entry DOM nodes with `textContent` instead of `innerHTML`.
- [ ] **Fix `JSON.stringify(e.data)` injection (logs.ts:31)** — `JSON.stringify` does not escape `<`/`>`. Attack path: custom comparison item name with HTML payload (only length-validated) → `settingsLog()` in options.ts → stored in `chrome.storage.local` → `${JSON.stringify(e.data)}` rendered via `innerHTML`. Fix: use `textContent` on a `<span>` element instead.

Both fixes: replace `container.innerHTML = ...` template with DOM construction (`createElement`, `textContent`, `appendChild`).

---

## PHASE 4 — OPTIONAL ADD-ONS

## UX ENHANCEMENTS

### ✅ Footer Feedback Buttons (COMPLETE — v0.4.9)

Added 🐛 Bug and 💡 Ideas anchor links to the popup footer (left-aligned). Bug links to GitHub Issues new form; Ideas links to GitHub Discussions with the Ideas category pre-selected. Pure HTML/CSS change, no JS.

---

### ✅ Settings UI Consolidation (COMPLETE — v0.4.8)

All settings consolidated into a single 500×580px popup with right-side scroll-spy nav and pending-state save model. Options page retired.

- [x] Consolidated popup: 6 sections (Stats · Friction · Comparisons · Limits · Channels · Settings)
- [x] Right-side scroll-spy nav (IntersectionObserver) with active section highlight
- [x] Pending-state model — footer Save button persists all changes to chrome.storage.sync
- [x] Drag-and-drop comparison item reordering with inline Add/Edit sub-panel
- [x] Bidirectional intensity + threshold sync between Stats and Friction/Limits sections
- [x] Options page retired (deprecation notice), removed from manifest and webpack
- [x] Jest + ts-jest test infrastructure with 9 unit tests for pendingState module
      
### Interactive Onboarding Tour (Long-term Milestone)

**Complexity:** ⭐⭐⭐⭐⭐ Very Hard
**Dependencies:** Settings UI Redesign

Guided first-install walkthrough that overlays the Twitch page and highlights each interceptable element (Gift Sub, Subscribe, Get Bits) one at a time. Slide-out explainer panel shows what HC does at each point and where the related setting lives in the options page. Beginner/Advanced toggle so experienced users can skip the tour entirely.

**Reference:** Previews extension slide-out changelog panel pattern.

- [ ] First-install detection triggers tour
- [ ] Beginner / Advanced mode selection
- [ ] Sequential element highlighting on Twitch page
- [ ] Slide-out explainer panel per highlighted element
- [ ] Links from tour steps to relevant settings sections

### ✅ Add-on 5 — Streamer Whitelist (COMPLETE)

**What's implemented:** Full per-channel whitelist with three behaviors — `skip` (no friction, silent log), `reduced` (toast only), `full` (full friction with a note). Add/remove/behavior-change UI in options. URL normalization on input. Whitelist note shown in the main overlay for full-friction channels. Behavior legend in options explains each mode. Disclaimer note that channels are not validated against Twitch.

- [x] **Quick-add from the overlay** — "Remember this channel" button within the friction modal, with inline behavior selector (Skip/Reduced/Full), duplicate detection, and update support

---

### Remaining Add-ons (Not Started)

Listed in order of complexity per the planning doc.

#### ⭐ Easy

- [x] **Add-on 1 — Delay Timer (Standalone)**
      A configurable mandatory wait (5/10/30/60 seconds) before _any_ purchase can proceed, independent of friction level. Single progress bar, cancel allowed at any time.

- [x] **Add-on 4 — Custom Comparison Items (Enhanced)**
      Basic CRUD is done. Drag-to-reorder is now implemented for both preset and custom items (persisted to storage). Per-item scope (Nudge only / Full only / Both) is now implemented.

#### ⭐⭐ Medium

- [ ] **Add-on 2 — Spending Tracker (History View)**
      Full-page view of all logged intercept events. Filter by date range, channel, outcome (cancelled/proceeded). Sort controls. Totals row (total spent, total blocked, total "saved").

- [ ] **Add-on 3 — Weekly/Monthly Spending Limits**
      The daily cap exists but the doc also calls for weekly and monthly limits. Progress bar in overlay showing "You've spent $X of $Y this week." Warning at 80%, hard block at 100% with override option (with extra friction).

- [ ] **Add-on 6 — Export Data (CSV/JSON)**
      Button in history view or options page to export all stored log data. Choose date range. Toggle whether to include cancelled-only or all events.

#### ⭐⭐⭐ Medium-Hard

- [ ] **Add-on 7 — Accountability Partner**
      Shareable read-only dashboard link. Partner sees total spent, recent purchases, blocked count. Optional: partner can nudge friction level. Requires a small backend or a service like Firebase.

- [ ] **Add-on 8 — Discord Webhook Integration**
      Configure a webhook URL in options. Post a formatted message to Discord when a purchase proceeds (or optionally on every intercept). Configurable trigger: all / over $X / only when friction was bypassed. Rate-limiting to prevent spam.

  Example message:

  ```
  🎮 Twitch Spending Alert
  Josh just spent $26.86 on twitch.tv/ktulue
  That's 46 minutes of work!
  Made it through 3 friction steps before proceeding.
  Monthly total: $127.50 / $150.00 budget (85%)
  ```

- [ ] **Add-on 9 — Weekly Email Summary**
      Via Google Apps Script (no dedicated server). Weekly digest: spent, blocked, saved, top channels, trend vs. prior week. Configurable delivery day/time.

#### ⭐⭐⭐⭐ Hard

- [ ] **Add-on 10 — Regret Scoring (24-Hour Check-in)**
      24 hours after a proceeded purchase, show a browser notification: "How do you feel about this?" with a 😊 / 😐 / 😞 scale. Track regret rates over time. Surface insight: "You regret 60% of purchases over $20."

- [ ] **Add-on 11 — Monthly Budget & Rollover System**
      Set a monthly Twitch budget. Track blocked/cancelled amounts as "saved" money. Roll unused budget forward to next month (with a cap). Overlay shows budget status during purchase flow. Strict mode blocks purchases that would exceed remaining budget.

#### ⭐⭐⭐⭐⭐ Very Hard

- [ ] **Add-on 12 — Reporting Dashboard + Google Sheets**
      Full-page chart-based analytics dashboard. Auto-sync to Google Sheets via Apps Script. Track multi-year spending. Month-over-month and year-over-year comparisons. Pre-built pivot tables and charts in the sheet.

---

## RECOMMENDED FOCUS FOR "WRAP UP" SESSION

### Must-Haves to Call MVP Complete

1. **Popup stats panel** (Part 4b) — Adds real value, visible every time user clicks the icon; also unblocks the streaming mode manual override button
2. **Fresh-install onboarding** (Part 6) — Important UX for first-time users

### Nice-to-Haves If Time Allows

3. **Friction level setting** (Part 4) — Named Low/Medium/High/Extreme with the full step flow
4. **Money saved calculation** (Part 4b) — Makes the popup stats meaningful
5. **Focus trap + ARIA audit** (Part 6) — Polish pass
6. **Whitelist quick-add from overlay** (Add-on 5) — Small addition since the whitelist is already built

### Phase 4 Add-ons to Consider (Pick 1-2 for the stream)

- **Discord Webhook (Add-on 8)** — High streamer appeal, demonstrates webhook integration
- **Spending History View (Add-on 2)** — Visually satisfying, completes the analytics story
- **Export Data (Add-on 6)** — Easy win, useful for users who track finances externally

---

## COMMUNITY ITEMS (From Planning Doc)

- [ ] **Icon Design Contest** — Currently using placeholder icons. Planning doc suggested a community contest (submit via Discord, vote on stream, winner gets credit in README). Icon sizes needed: 16×16, 32×32, 48×48, 128×128 PNG.

---

_Last updated 2026-03-12 against the v0.4.9 codebase._
