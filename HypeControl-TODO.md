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
| MVP Part 4 — Multi-Step Friction Levels   | ✅ Complete       |
| MVP Part 4b — Analytics & Popup Stats     | ✅ Complete       |
| MVP Part 5 — Streaming Mode               | ✅ Complete       |
| MVP Part 6 — Integration Testing & Polish | ✅ Complete       |
| Add-on 5 — Streamer Whitelist             | ✅ Complete       |
| Add-on 1 — Delay Timer                   | ✅ Complete       |
| Add-on 4 — Custom Comparison Items       | ✅ Complete       |
| Add-on 2 — Spending History View         | 🔲 Not Started    |
| Add-on 3 — Weekly/Monthly Limits         | 🔲 Not Started    |
| Interactive Onboarding Tour              | 🔲 Not Started    |
| Firefox AMO Port                         | 🔲 Not Started    |
| Add-ons 6–12 — Future Enhancements       | ⏸️ Deferred       |

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
- [x] **Type-to-confirm step (High+)** — User must type "I want to buy this" (case-insensitive) to proceed. For Extreme: final step (step 6) after math challenge. Enter key supported.
- [x] **Math challenge step (Extreme only)** — Simple arithmetic problem (step 5); wrong answer generates a new problem, correct answer advances to type-to-confirm. Enter key supported.
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
- [x] ~~**Keyboard: Enter to confirm**~~ — ✅ Implemented: Enter key support added to `showTypeToConfirmStep` and `showMathChallengeStep` (see `interceptor.ts`)
- [x] ~~**ARIA attributes audit**~~ — ✅ All overlay modals (main, comparison, cooldown) have `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and `aria-describedby`
- [x] ~~**"No price detected" fallback**~~ — ✅ Verified: overlay shows "Price not detected" as the price display and "Unable to detect price. Proceed with caution." when `priceValue` is null (see `interceptor.ts:355-361`)

---

## SECURITY FIXES

### Stored XSS in Logs Page (High Priority)

Two confirmed stored XSS vulnerabilities in `src/logs/logs.ts` found via security review. Both execute in the `chrome-extension://` page context, which has access to `chrome.storage.sync` and other extension APIs.

- [x] **Fix `e.message` injection (logs.ts:37)** — ✅ Fixed in v0.4.9: `renderLogs()` rewritten with DOM construction (`createElement`, `textContent`, `appendChild`).
- [x] **Fix `JSON.stringify(e.data)` injection (logs.ts:31)** — ✅ Fixed in v0.4.9: `e.data` field rendered via `textContent` on a `<span>` element.

Both fixes: `container.innerHTML` template replaced with full DOM construction.

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

### Completed Add-ons

- [x] **Add-on 1 — Delay Timer (Standalone)** — Configurable mandatory wait before any purchase can proceed, independent of friction level.
- [x] **Add-on 4 — Custom Comparison Items (Enhanced)** — Drag-to-reorder for preset and custom items (persisted). Per-item scope (Nudge only / Full only / Both).
- [x] **Add-on 5 — Streamer Whitelist** — Per-channel whitelist with Skip / Reduced / Full behavior modes and quick-add from overlay.

### In-Scope (Still To Build)

- [ ] **Add-on 2 — Spending Tracker (History View)** ⭐⭐
      Full-page view of all logged intercept events. Filter by date range, channel, outcome (cancelled/proceeded). Sort controls. Totals row (total spent, total blocked, total "saved").

- [ ] **Add-on 3 — Weekly/Monthly Spending Limits** ⭐⭐
      The daily cap exists but weekly and monthly limits are still needed. Progress bar in overlay: "You've spent $X of $Y this week." Warning at 80%, hard block at 100% with override option (extra friction).

### Deferred (Future Enhancements)

- [ ] **Add-on 6 — Export Data (CSV/JSON)** ⭐⭐
- [ ] **Add-on 7 — Accountability Partner** ⭐⭐⭐
- [ ] **Add-on 8 — Discord Webhook Integration** ⭐⭐⭐
- [ ] **Add-on 9 — Weekly Email Summary** ⭐⭐⭐
- [ ] **Add-on 10 — Regret Scoring (24-Hour Check-in)** ⭐⭐⭐⭐
- [ ] **Add-on 11 — Monthly Budget & Rollover System** ⭐⭐⭐⭐
- [ ] **Add-on 12 — Reporting Dashboard + Google Sheets** ⭐⭐⭐⭐⭐

---

## CURRENT ROADMAP

### Next Up (In Order)

1. **Add-on 2 — Spending History View** — Full-page view of all logged intercept events. Filter by date range, channel, outcome. Sort controls. Totals row.
2. **Add-on 3 — Weekly/Monthly Spending Limits** — Weekly and monthly caps with progress bar in overlay. Warning at 80%, hard block at 100% with override option.
3. **Interactive Onboarding Tour** — Guided first-install walkthrough. Highlights interceptable Twitch elements, slide-out explainer panel, beginner/advanced toggle.
4. **Firefox AMO Port** — Adapt extension for Firefox. Requires `browser_specific_settings` in manifest, MV3 background script adjustment, `browser.*` API compatibility review, and AMO submission assets.

### Deferred to Future Enhancements

Add-ons 6–12 are out of scope for the current build phase:

- Add-on 6 — Export Data (CSV/JSON)
- Add-on 7 — Accountability Partner
- Add-on 8 — Discord Webhook Integration
- Add-on 9 — Weekly Email Summary
- Add-on 10 — Regret Scoring (24-Hour Check-in)
- Add-on 11 — Monthly Budget & Rollover System
- Add-on 12 — Reporting Dashboard + Google Sheets

---

---

## FIREFOX AMO PORT

**Status:** 🔲 Not Started — Planned as final release milestone after all in-scope add-ons are complete.

Firefox supports MV3 (since Firefox 109), so this is an adaptation rather than a rewrite. Key differences to address:

- [ ] Add `browser_specific_settings` block to `manifest.json` with a Firefox extension ID (e.g. `hypecontrol@ktulue`)
- [ ] Adjust background script: Firefox MV3 uses `background.scripts` array alongside `service_worker`
- [ ] Audit all `chrome.*` API calls — swap to `browser.*` or add the `webextension-polyfill` package for cross-browser compatibility
- [ ] Verify content script injection and `host_permissions` work identically on Firefox
- [ ] Use `assets/icons/FirefoxAMO/` icons (16, 32, 48, 64, 128px) for AMO listing — already present
- [ ] Create AMO listing: screenshots, description, privacy policy
- [ ] Submit to addons.mozilla.org for review

---

## COMMUNITY ITEMS (From Planning Doc)

- [x] **Icon Design Contest** — ✅ Complete. Custom icons designed and added to `assets/icons/ChromeWebStore/` (16, 48, 128px) and `assets/icons/FirefoxAMO/` (16, 32, 48, 64, 128px).

---

_Last updated 2026-03-12 against the v0.4.9 codebase. Roadmap updated: Add-ons 6–12 deferred, Firefox AMO port added as final milestone._
