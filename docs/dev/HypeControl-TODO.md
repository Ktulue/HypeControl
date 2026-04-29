# Hype Control - What's Left To Do

**Updated:** 2026-04-28
**Current Version:** 1.1.2
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
| Chat Command Interception (#39)           | ✅ Complete       |
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

- [ ] **Detector: allowlist of known purchase surfaces (Option C)** ⭐⭐⭐
      Flip `isPurchaseButton` in `src/content/detector.ts` from "deny known non-purchases" (current heuristic mix) to "allow known purchase surfaces." Long-term correct approach to prevent the chat-callout-style false-positive class. Deferred from the #44 fix — see `docs/superpowers/specs/2026-04-24-resub-callout-false-trigger-design.md` Follow-ups section. Baseline `isPurchaseButton` test suite added in that PR is a prerequisite regression net.

- [ ] **Detector: require real BUTTON tag for the label-keyword match path** ⭐⭐
      The #44 bug logs showed the label-keyword path firing on a DIV via `textContent` / `tw-core-button-label-text` child aggregation. Tightening that path to require `element.tagName === 'BUTTON'` (or a role-scoped element) would reduce false-positive surface beyond the callout-exclusion rule. Not required to close #44; revisit if a new false-positive report surfaces that the callout-exclusion doesn't cover.

- [x] **Manifest version lockstep catch-up (Chrome + Firefox)** ⭐ — **v1.1.0 (2026-04-24).** All three files (`manifest.json`, `manifest.firefox.json`, `package.json`) bumped to 1.1.0 in sync. Firefox caught up from 1.0.2. Chrome + AMO submissions pending.

- [ ] **CLAUDE.md: remove duplicate `## Build` section** ⭐
      The #44 PR consolidated the "Version Management" + "Versioning" sections into one rule that absorbs the build timing/retry guidance. The standalone `## Build` section (still present) now duplicates that guidance and can be removed in a future maint PR. Low priority — harmless duplication.

---

## CURRENT ROADMAP

### Recently Completed

- [x] **Dual-platform 1.1.0 release cut (2026-04-24)** — Lockstep version bump across `manifest.json`, `manifest.firefox.json`, `package.json` to 1.1.0. Firefox caught up from 1.0.2 (drift from the AMO port). Both Chrome and Firefox builds verified. Ready for Chrome Web Store + AMO submissions.
- [x] **Fix stream override storage mismatch (#32) — v1.0.4** — Override now short-circuits `shouldBypassFriction` globally (any channel), popup writes `streamingOverride` to `chrome.storage.sync` so the content script actually reads it. Purchases during bypass logged as `outcome: 'streaming'`. Replaced per-purchase toast with persistent `hc-streaming-badge` showing live countdown / live-on-channel / grace-period state.
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

## KNOWN LIMITATIONS

- **`/gift <#>` chat command bypass (#39) — FIXED in v1.0.9.** Two-layer interception: keydown listener on `[data-a-target="chat-input"]` catches `/gift` and `/subscribe` commands before they send, with modal fallback safety net. Power-user voice copy in logs. Uses exact Tier 1 pricing ($5.99/sub). Independent toggle in Friction settings.

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

## NAV LOCK DURING ONBOARDING (v1.0.7)

Sidebar nav was clickable during the onboarding wizard because `.hc-nav { display: flex }` overrode the `hidden` HTML attribute. Added `.hc-nav[hidden] { display: none; }` rule.

---

## SUBDOMAIN SCOPE FIX (v1.0.8)

Manifest match patterns narrowed from `*.twitch.tv` to `www.twitch.tv` in both Chrome and Firefox manifests. HC no longer activates on docs.twitch.tv, dashboard.twitch.tv, or other non-spending subdomains. (#40)

---

## CHAT COMMAND INTERCEPTION (v1.0.9)

Two-layer `/gift` and `/subscribe` chat command interception: keydown listener on the chat input catches commands before they send; modal-fallback safety net. Exact Tier 1 pricing. Independent toggle in Friction settings. (#39)

---

## RESUB CALLOUT FALSE-TRIGGER FIX (v1.0.10)

Chat-callout surfaces (resub share, gifted-sub thanks, paid pins, community highlight stacks) no longer trigger HC's friction overlay. `isPurchaseButton()` now short-circuits when the clicked element (or any ancestor) sits inside a Twitch chat-callout surface, identified by a seed list plus an anchored `-callout` suffix regex. Baseline regression test suite added for `isPurchaseButton`. (#44)

---

## DUAL-PLATFORM 1.1.0 RELEASE CUT (v1.1.0)

Lockstep minor bump across all three version files (`manifest.json`, `manifest.firefox.json`, `package.json`) to 1.1.0. Firefox manifest caught up from 1.0.2 — it had drifted during the AMO port and subsequent patch releases. Both Chrome and Firefox production builds verified. Ready for Chrome Web Store + AMO submissions.

---

## TYPE-TO-CONFIRM PASTE BYPASS FIX (v1.1.1)

Closed the copy/paste bypass on the type-to-confirm friction step. `paste`, `drop`, and paste-flavored `beforeinput` events on the input are now blocked; `.hc-confirm-phrase` flipped from `user-select: all` to `user-select: none` so the prompt itself can't be dragged into the input; three autofill-suppression attributes (`name="hc-no-autofill"`, `data-1p-ignore`, `data-lpignore="true"`) discourage password managers. Caught cheats trigger a Newman-flavored callout from a 4-line random pool — "Ah ah ah. You didn't type the magic phrase." (#49)

---

## SUB TIER DROPDOWN RE-TRIGGER FIX (v1.1.2)

Fixed a form-control short-circuit in `isPurchaseButton()` so tier-picker, combobox, and radio button clicks inside the sub modal payment screen no longer fire friction overlays. The detector now returns early for `HTMLSelectElement`, `HTMLInputElement[type="radio"]`, and form control ancestors to prevent triggering on secondary controls within subscription modals. (#48)

---

_Last updated 2026-04-28 against the v1.1.2 codebase. Sub tier dropdown re-trigger fix closed (#48)._
