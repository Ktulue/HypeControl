# Hype Control - What's Left To Do

**Updated:** 2026-04-13
**Current Version:** 1.0.3
**Based On:** HC-Project-Document.md vs. actual codebase audit (MTS was the original project codename)

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
| Add-on 2 — Spending History View         | ✅ Complete       |
| Add-on 3 — Weekly/Monthly Limits         | ✅ Complete       |
| Interactive Onboarding Tour              | ✅ Complete        |
| Firefox AMO Port                         | ✅ Complete       |
| Friction Trigger Mode (Price Guard / Zero Trust) | ✅ Complete |
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
- [x] ~~**Peak spending hours**~~ — Deferred to future enhancement (not part of Add-on 2 final scope)
- [x] ~~**Top channels**~~ — Deferred to future enhancement (not part of Add-on 2 final scope)

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

### ✅ MVP Part 6 — Polish & Edge Cases (COMPLETE)

**What's implemented:** Error handling, multiple DOM fallback selectors, debounced saves, escape-key dismissal, backdrop click to cancel, version tracking, debug functions (`HC.testOverlay()`, `HC.scanButtons()`), inline field validation with error messages, overlay entrance animations (fadeIn + slideIn CSS keyframes). Options page UI polish: responsive two/three-column grid layout on wider screens, centered section headers, styled footer with centered buttons and version number, comparison item deduplication in migration.

**What is still MISSING:**

- [x] ~~**Fresh-install onboarding**~~ — ✅ Implemented: `chrome.runtime.onInstalled` handler in `serviceWorker.ts` opens the options page on first install
- [x] ~~**Focus trap in overlay**~~ — ✅ Implemented: Tab/Shift+Tab wraps between first and last buttons in all modals (see `interceptor.ts`)
- [x] ~~**Overlay entrance animation**~~ — ✅ Implemented: `hc-fadeIn` on backdrop, `hc-slideIn` on modal (see `styles.css`)
- [x] ~~**Keyboard: Enter to confirm**~~ — ✅ Implemented: Enter key support added to `showTypeToConfirmStep` and `showMathChallengeStep` (see `interceptor.ts`)
- [x] ~~**ARIA attributes audit**~~ — ✅ All overlay modals (main, comparison, cooldown) have `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and `aria-describedby`
- [x] ~~**"No price detected" fallback**~~ — ✅ Verified: overlay shows "Price not detected" as the price display and "Unable to detect price. Proceed with caution." when `priceValue` is null (see `interceptor.ts:355-361`)

---

## SECURITY FIXES (v0.4.9, v0.4.21)

Stored XSS vulnerabilities in logs.ts and interceptor.ts resolved via DOM construction (textContent). All user-controlled and storage values now use safe rendering.

---

## ROUND 2 BUG FIXES (v0.4.12)

7 issues fixed: duplicate thresholds toggle, popup scroll, nudge step capping, settings log, logs centering, emoji hint, whitelist copy.

---

## STAT CARD TOOLTIPS (v0.4.13)

Added ⓘ hover tooltips to all 4 stat tiles.

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
      
### ✅ Interactive Onboarding Tour (COMPLETE — Popup Wizard)

**What was implemented:** First-run setup wizard in the popup with hourly rate, tax rate, friction level, and comparison item selection. Skip option with defaults summary. Replay button at bottom of popup.

**What was deferred (full Twitch-page tour):**
The original design called for a guided overlay on the Twitch page highlighting each interceptable element. This was descoped in favor of the popup wizard approach. If revisited, it would be a future enhancement.

### ✅ Add-on 5 — Streamer Whitelist (COMPLETE)

**What's implemented:** Full per-channel whitelist with three behaviors — `skip` (no friction, silent log), `reduced` (toast only), `full` (full friction with a note). Add/remove/behavior-change UI in options. URL normalization on input. Whitelist note shown in the main overlay for full-friction channels. Behavior legend in options explains each mode. Disclaimer note that channels are not validated against Twitch.

- [x] **Quick-add from the overlay** — "Remember this channel" button within the friction modal, with inline behavior selector (Skip/Reduced/Full), duplicate detection, and update support

---

### Completed Add-ons

- [x] **Add-on 1 — Delay Timer (Standalone)** — Configurable mandatory wait before any purchase can proceed, independent of friction level.
- [x] **Add-on 4 — Custom Comparison Items (Enhanced)** — Drag-to-reorder for preset and custom items (persisted). Per-item scope (Nudge only / Full only / Both).
- [x] **Add-on 5 — Streamer Whitelist** — Per-channel whitelist with Skip / Reduced / Full behavior modes and quick-add from overlay.

### In-Scope (Still To Build)

- [x] **Add-on 2 — Spending Tracker (History View)** ⭐⭐
      Full-page view of all logged intercept events with 6-metric summary bar, filterable by date range, channel, and outcome. Sortable table with expandable row detail. Accessed via popup button.

- [x] **Add-on 3 — Weekly/Monthly Spending Limits** ⭐⭐
      Weekly and monthly caps with independent toggles, 4-tier color progress bars in overlay (green < 60%, yellow 60–79%, orange 80–99%, red 100%+), escalated friction at 100% (doubled delay + acknowledgment checkbox), calendar-aligned resets (Monday/1st), unified budget toast.

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

### Recently Completed

- [x] **Firefox AMO Port (2026-04-02)** — v1.0.2. Dual-manifest build (`manifest.firefox.json`), webpack target flag, build-time icon directory constant. AMO submission pending.
- [x] **Chrome Web Store Launch (2026-03-23)** — v1.0.0 release. Version bump, brand-voice alignment across manifest/landing page/store listing, build and submission.
- [x] **Landing Page Brand Voice (2026-03-23)** — Aligned docs/index.html copy with README's sharp/cheeky tone.
- [x] **README Rewrite (2026-03-21)** — Rewrote README.md from developer-focused internal docs to a user-first, brand-voice public page for the Chrome Web Store launch.

### Future Enhancements

- Add-on 6 — Export Data (CSV/JSON)
- Add-on 7 — Accountability Partner
- Add-on 8 — Discord Webhook Integration
- Add-on 9 — Weekly Email Summary
- Add-on 10 — Regret Scoring (24-Hour Check-in)
- Add-on 11 — Monthly Budget & Rollover System
- Add-on 12 — Reporting Dashboard + Google Sheets
- Peak spending hours (hour-of-day bucketing)
- Top channels (per-channel stats)
- Full Twitch-page onboarding tour (overlay-based walkthrough)

---

## FIREFOX AMO PORT

**Status:** ✅ Build support complete (v1.0.2) — AMO submission pending (manual step).

Firefox supports MV3 (since Firefox 109). Dual-manifest build implemented:

- [x] Add `browser_specific_settings` block to `manifest.firefox.json` with gecko ID `hypecontrol@ktulue`
- [x] Adjust background script: Firefox manifest uses `background.scripts` array
- [x] Audit all `chrome.*` API calls — Firefox supports `chrome.*` namespace natively, no polyfill needed
- [x] Verify content script injection and `host_permissions` work identically on Firefox
- [x] Use `assets/icons/FirefoxAMO/` icons (16, 32, 48, 64, 128px) via build-time `__ICON_DIR__` constant
- [x] Webpack target-aware build: `npm run build:firefox` / `npm run dev:firefox`
- [ ] Create AMO listing: screenshots, description, privacy policy
- [ ] Submit to addons.mozilla.org for review

---

## COMMUNITY ITEMS (From Planning Doc)

- [x] **Icon Design Contest** — ✅ Complete. Custom icons designed and added to `assets/icons/ChromeWebStore/` (16, 48, 128px) and `assets/icons/FirefoxAMO/` (16, 32, 48, 64, 128px).

---

## UI POLISH & REBRAND (v0.4.14)

Space Grotesk typography, teal/green token system, ARIA label associations, light mode fixes.

---

## MAINTENANCE PASS (v0.4.24)

Toggle alignment, history summary centering, metric color parity, tour button relocation, escalation logic, weekly reset day, wizard default changed to Low.

---

## INPUT VALIDATION HARDENING (v0.4.25)

sanitizeSettings()/sanitizeTracker() gates on all storage paths, XSS fix in options comparison items, parsePrice() NaN/Infinity guard.

---

## BUG FIX & LOGS ENHANCEMENT (v0.4.26)

Silent-proceed bypass paths now record to spending history. Logs page Copy All button added.

---

## SAVINGS CALENDAR (v0.4.27)

Interactive calendar in popup Limits section with 3-tier day classification, 90 motivational messages, keyboard navigation, 90-day rolling window.

---

## TRACKER RESET FIX & SESSION REMOVAL (v0.4.28)

Shared spendingTracker module, daily/weekly/monthly reset fix for popup, session total removed.

---

_Last updated 2026-04-02 against the v1.0.2 codebase. Firefox AMO port._
