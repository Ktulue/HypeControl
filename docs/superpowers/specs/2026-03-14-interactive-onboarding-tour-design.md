# Interactive Onboarding Tour — Design Spec

**Date:** 2026-03-14
**Status:** Approved
**Version target:** Post-v0.4.20

---

## Overview

HypeControl has no guided onboarding. New users open the popup for the first time and land in a dense stats/settings panel with no context, no defaults explanation, and no demonstration of what the extension actually does. This spec defines a two-phase onboarding tour: a popup wizard on first open, followed by a Twitch-side live demo on first Twitch visit.

---

## Goals

- **Aha moment:** User completes config setup *and* experiences the real overlay
- **Time to value:** Under 2 minutes for the full flow
- **Respect advanced users:** One-click skip with a defaults summary
- **Replayability:** Always accessible for users returning after a break

---

## Users

Twitch viewers and streamers who installed HypeControl voluntarily. Mixed experience level — some first-time extension users, some power users who want to configure and go.

---

## Architecture

Three storage keys tracked via `chrome.storage.local`:

```
hcOnboardingWizardPending: boolean   // set false after Phase 1 completes or is skipped
hcOnboardingPhase2Pending: boolean   // set false when Phase 2 completes or is dismissed
hcOnboardingComplete: boolean        // set true when Phase 2 completes or is dismissed
```

All flags are boolean values written via `chrome.storage.local.set()`. "Cleared" throughout this spec means set to `false` — keys are never deleted.

Replaying resets all three flags. Phases are independently dismissable — dismissing either counts as completion of that phase.

---

## Phase 1 — Popup Wizard

### Trigger

`chrome.runtime.onInstalled` (reason: `"install"`) in `serviceWorker.ts` writes:
```
hcOnboardingWizardPending: true
hcOnboardingPhase2Pending: true
```

When the user opens the popup for the first time (user-initiated click on extension icon), `popup.ts` checks `hcOnboardingWizardPending`. If `true`, popup renders wizard state instead of the normal stats view.

**Why not `chrome.action.openPopup()`:** This API is restricted to user gesture contexts and is not available in `onInstalled`. Phase 1 fires on the first user-initiated popup open instead — the wizard is waiting for them when they click the icon.

### Skip Path

A `"Skip setup, I'll configure it myself →"` text link at the top of the wizard screen.

On click:
1. Write `DEFAULT_SETTINGS` values to `chrome.storage.sync` (ensures storage is initialized — same values already in defaults, but makes the write explicit)
2. Display inline defaults summary:
   > *"You're all set with defaults: $20/hr wage · 7% sales tax · Medium friction · Preset comparison items enabled. Update these in Settings anytime."*
3. Set `hcOnboardingWizardPending` to `false`
4. Leave `hcOnboardingPhase2Pending: true` (Phase 2 still activates on next Twitch visit)
5. Show a `"Got it →"` button that closes to normal popup view immediately. If the user does not interact, auto-close after 3 seconds as a fallback.

### Wizard Screen (single screen, beginner path)

**Hourly Rate**
- Pre-filled: `$20.00`
- Helper note beneath: *"$20/hr is our default — update this for accurate results"*
- Inline expander link: `"Calculate from salary →"` reveals two fields (Annual salary + Hours/week) that compute hourly rate using existing salary calculator logic. Collapses after rate is populated.

**Sales Tax Rate**
- Pre-filled: `7%`

**Friction Level**
- Segmented control: Low / Medium / High / Extreme
- Default: Medium
- One-line description below the control updates per selection:
  - Low: *"Main overlay only — one click to cancel"*
  - Medium: *"Overlay + reason selection"*
  - High: *"Overlay + reason + cooldown timer"*
  - Extreme: *"Everything + math challenge + type-to-confirm"*

**Comparison Items Preview**
- Read-only chip display of 3–4 representative enabled preset items (e.g., 🌮 🍕 ☕ 🌭)
- Label: *"These are your default comparisons. [Customize in Settings →]"* — "Customize in Settings" is a link that closes the wizard and navigates to the Comparisons section

**Continue →** button
1. Saves hourly rate, tax rate, and friction level to `chrome.storage.sync`
2. Sets `hcOnboardingWizardPending` to `false`
3. Closes popup (user opens it again if they want to see stats)

---

## Phase 2 — Twitch-Side Tour

### Trigger

On every Twitch page load, `index.ts` checks `hcOnboardingPhase2Pending`. If `true`, injects the tour panel after DOM readiness (see below).

**Why Phase 2 fires even when Phase 1 was skipped:** Skip only bypasses configuration. The Twitch-side product demo is the core aha moment and should always fire.

**If the user never visits Twitch:** `hcOnboardingPhase2Pending` remains `true` indefinitely. This is acceptable — the extension serves no purpose without Twitch, so the pending flag is harmless. No timeout or expiry is needed.

### DOM Readiness

Instead of a fixed 500ms delay, Phase 2 injection waits for a known stable Twitch selector to exist before injecting the tour panel. Use the same selector strategy as `detector.ts`. If the selector never appears within 10 seconds, skip injection silently for that page load and retry on next navigation.

### Slide-Out Panel

- DOM element injected into Twitch page body (same pattern as the friction overlay in `interceptor.ts`)
- Positioned: right side of viewport, fixed, non-blocking (does not dim or lock the page)
- Dismissable via X button at any point
- Dismissing sets `hcOnboardingComplete` to `true` and sets `hcOnboardingPhase2Pending` to `false`

### Step 1 — Button Highlights

**Panel content:**
> *"Here's what I watch for you"*

- Dynamically detects which interceptable buttons are currently visible using existing `detector.ts` selectors (Subscribe, Gift Sub, Get Bits)
- Applies a highlight ring (CSS `outline` + subtle glow using `--hc-primary` accent color) to each visible button
- Small floating label adjacent to each: *"Gift Sub"*, *"Subscribe"*, *"Get Bits"*
- If no interceptable buttons currently visible:
  > *"Navigate to a channel to see what I protect — or try a demo now."*
  — Skip Step 1, go directly to Step 2
- Panel CTA: `"Show me what happens →"` advances to Step 2
- Highlight rings removed when advancing

### Step 2 — Live Demo

**Panel content:**
> *"Here's what happens when you click one"*
> *"No real purchase will be made."*

- CTA: `"Try it now"` button calls `triggerDemoOverlay()` (see Demo Overlay section below)
- Panel collapses to a small tab fixed to the right viewport edge while the overlay is active (prevents visual competition with the overlay). The tab shows only the HypeControl icon and a `"…"` label. The panel does not intercept clicks while collapsed.
- After user clicks Cancel or Proceed in the overlay:
  - Panel re-expands to its full width automatically
  - Shows: *"That's it. You're protected."*
  - Auto-dismisses after 3 seconds
  - Sets `hcOnboardingComplete` to `true`
  - Sets `hcOnboardingPhase2Pending` to `false`

### Demo Overlay

`HC.testOverlay()` is a debug-only function with no stability guarantees. Instead, define a stable entrypoint:

```typescript
// interceptor.ts
export function triggerDemoOverlay(): void {
  const sampleEvent: InterceptEvent = {
    type: 'sub',
    channel: 'example_channel',
    priceValue: 4.99,
    priceWithTax: 5.34,
    hoursEquivalent: 0.27,
    timestamp: Date.now(),
    isDemoMode: true,
  };
  runFrictionFlow(sampleEvent);
}
```

`HC.testOverlay()` can call `triggerDemoOverlay()` internally. The onboarding tour always calls `triggerDemoOverlay()` directly. This isolates onboarding from future changes to the debug helper.

Add `isDemoMode?: boolean` to the `InterceptEvent` type so the overlay can display a *"Demo mode — no real purchase"* badge.

**`isDemoMode` behavior in `runFrictionFlow()`:** When `isDemoMode` is `true`, the friction flow must:
- Skip writing to `hcInterceptEvents` (no event logged to history)
- Skip updating `dailyTotal` and `sessionTotal` in `SpendingTracker`
- Skip cooldown timer writes
- Still run the full friction UI (all steps, the real overlay experience)

This prevents demo interactions from contaminating spending data or triggering daily cap warnings.

---

## Replayability

### Settings entry point
`"↺ Replay setup tour"` link in the Settings section of the popup (bottom of Settings nav).

### Popup footer entry point
`"↺ Tour"` link in the popup footer, alongside the existing Bug / Ideas links.

### Replay behavior
On click (from either entry point):
1. Set `hcOnboardingWizardPending: true`
2. Set `hcOnboardingPhase2Pending: true`
3. Set `hcOnboardingComplete: false`
4. Re-render popup to wizard state **in place** (no close/reopen required) — wizard state is driven by a local variable in `popup.ts`, not by polling storage, so it updates reactively
5. Phase 2 will activate on their next Twitch page load

---

## Defaults Applied

When Phase 1 is completed or skipped, these values are written to `chrome.storage.sync`:

| Setting | Default Value |
|---------|--------------|
| `hourlyRate` | `20.00` |
| `taxRate` | `7` |
| `frictionIntensity` | `"medium"` |
| Preset comparison items | All enabled (existing `DEFAULT_SETTINGS` behavior) |

If settings already exist (reinstall scenario), wizard pre-fills from existing stored values instead of defaults.

---

## Storage Summary

| Key | Store | Type | Set to `true` | Set to `false` |
|-----|-------|------|----------------|----------------|
| `hcOnboardingWizardPending` | `chrome.storage.local` | boolean | `onInstalled`, replay | Phase 1 complete or skipped |
| `hcOnboardingPhase2Pending` | `chrome.storage.local` | boolean | `onInstalled`, replay | Phase 2 complete or dismissed |
| `hcOnboardingComplete` | `chrome.storage.local` | boolean | Phase 2 complete or dismissed | Replay |

---

## Files Affected

| File | Change |
|------|--------|
| `src/background/serviceWorker.ts` | Add `onInstalled` handler: set `hcOnboardingWizardPending` and `hcOnboardingPhase2Pending` |
| `src/popup/popup.ts` | Wizard state rendering, skip logic, defaults write, replay trigger, in-place re-render |
| `src/popup/popup.html` | Wizard markup, footer replay link |
| `src/popup/popup.css` | Wizard styles |
| `src/content/index.ts` | Phase 2 pending check on page load, DOM readiness wait |
| `src/content/tourPanel.ts` | New file — slide-out panel component, step logic, highlight ring injection |
| `src/content/styles.css` | Highlight ring styles, tour panel styles |
| `src/content/interceptor.ts` | Add `triggerDemoOverlay()` stable export; `HC.testOverlay()` delegates to it |
| `src/shared/types.ts` | Add `isDemoMode?: boolean` to `InterceptEvent`; add `OnboardingStorageKeys` constants |

---

## What This Is Not

- **Not a separate tutorial mode** — Phase 2 uses `triggerDemoOverlay()` which calls the real `runFrictionFlow()`. No mock UI.
- **Not blocking** — Neither phase prevents product use. Both are independently dismissable.
- **Not repeated** — Once complete, never shown again unless explicitly replayed.
- **Not auto-opening** — Phase 1 fires on first user-initiated popup open, not automatically on install (MV3 does not allow programmatic popup open from service workers).
