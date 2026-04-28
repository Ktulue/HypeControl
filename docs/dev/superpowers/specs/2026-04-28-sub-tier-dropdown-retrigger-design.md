# Sub Tier Dropdown Re-Trigger — Design Spec

**Issue:** [#48 — Sub tier drop down re-triggers hype-control after you've already been hype-controlled](https://github.com/Ktulue/HypeControl/issues/48)
**Date:** 2026-04-28
**Status:** Approved, ready for plan

## Problem

On Twitch's sub modal payment screen, after the user has already passed friction once, switching the **Sub Tier dropdown** (1 month / 3 month / 6 month) re-triggers the friction overlay. Reported on extension v1.1.0 against Firefox/Zen on macOS.

The reporter correctly noted that the displayed price *is* changing as the dropdown is switched, but the friction is firing on the dropdown interaction itself — before any new purchase has been committed.

## Root Cause

`isPurchaseButton()` in `src/content/detector.ts` includes a catch-all heuristic at line 442:

```js
if (/^\$[\d,]+\.\d{2}$/.test(buttonText) && element.closest('[role="dialog"], .modal, [data-a-target="gift-sub-modal"]'))
```

This matches *any* element whose visible text is exactly a dollar amount and which sits inside a `[role="dialog"]`. The tier-picker options inside Twitch's sub modal render as buttons whose text is just the price (e.g. `$4.99`, `$13.49`, `$24.99`), so they trip this rule even though they are configuration controls, not purchase commits.

The rule was originally added for gift-sub *quantity* buttons (which display as raw dollar amounts inside the gift modal). It is correct for that use case but too broad to distinguish a quantity-commit button from a tier-picker option.

## Mental Model

Friction should follow the actual **purchase commit**, never the configuration-changing clicks around it. A tier-picker option, a recipient selector, a quantity radio — all of these change *what* will be purchased but do not commit it. The user's friction tax has already been paid for the act of intending to buy; switching tier is part of the same intent. The actual final "Subscribe with $X.XX" confirm button is still a commit and still warrants friction (and *will* re-fire if the price has changed since the original friction — that's intentional, since the spend amount has changed).

The fix is to teach the detector to short-circuit on standard ARIA form-control patterns *before* any of the existing match heuristics run.

## Scope Decisions

- **Detector tightening only.** No changes to the firing logic, no new "this channel was just frictioned" grace window. Per the design discussion (Option B), suppression is at the *detection* layer, not the *firing* layer.
- **ARIA-role-based exclusion, not label-based.** Tier labels vary by locale and pricing format ("1 Month", "$4.99", localized strings, etc.); ARIA roles are stable across all of those.
- **Conservative — only standard form-control roles.** No attempt to fingerprint Twitch's specific tier-picker DOM. If the conservative rule misses, we add a more specific selector in a follow-up commit on the same branch before the PR opens.
- **No new settings, no storage, no migrations, no type changes.** Pure detection-rule change.
- **No telemetry counter.** A `debug()` log entry is sufficient for verification and one-time confirmation; this is a bug fix, not a long-running metric.
- **Re-firing friction at a new price after tier change is intentional.** If the user changes tier and then clicks the actual confirm at a different price, friction re-fires. The spend amount has changed; the friction-was-for-$X.XX contract is honoured.

## Changes by File

### 1. `src/content/detector.ts`

Inside `isPurchaseButton()`, add a new short-circuit block immediately **after** the chat-callout exclusion (`detector.ts:373-377`) and **before** the IGNORE_LABELS check (`detector.ts:380`):

```ts
// Form-control short-circuit: tier pickers, quantity radios, and other
// configuration controls inside purchase modals are never purchase commits.
// They often render as buttons whose text is just a price inside a dialog,
// which would otherwise trip the dollar-amount-in-dialog heuristic below (#48).
const FORM_CONTROL_SELECTOR = [
  'select', 'option', 'optgroup',
  '[role="option"]', '[role="combobox"]', '[role="listbox"]',
  '[role="radio"]', '[role="radiogroup"]',
  '[role="menuitem"]', '[role="menuitemradio"]',
].join(',');
if (element.matches(FORM_CONTROL_SELECTOR) || element.closest(FORM_CONTROL_SELECTOR)) {
  debug('isPurchaseButton: IGNORED (form-control)', elementInfo);
  return false;
}
```

The selector list is constructed inline (joined once per call). `isPurchaseButton` runs on click, not in a hot loop, so this is fine; do not hoist to module scope unless a profile shows otherwise.

`element.matches(...)` covers the case where the click landed directly on the option element. `element.closest(...)` covers the case where the click landed on a `<span>` text node or inner element of an option, or on a combobox trigger button.

No other changes to this file.

## Out of Scope

- Hardening the math challenge or any other input control.
- Introducing a "this channel was recently frictioned" grace window analogous to `wasRecentlyChatApproved` in `src/content/chatCommandInterceptor.ts`.
- Live telemetry / metrics for how often the new exclusion fires.
- Devtools-driven attacks (a user clicking through their own friction is the entire target user; bypass by manual DOM manipulation is out of scope).
- Localization-specific selectors. Roles are locale-stable.
- Refactoring `isPurchaseButton` (it is long but the responsibilities are coherent and the cost of refactor is high relative to the benefit; flag for a future sweep, not this PR).

## Accessibility

The change is in detection logic only — no UI surface added or removed. No ARIA, focus, or screen-reader behaviour is affected.

## Testing Plan

Manual verification on live Twitch is required. There is no faithful unit-test path for Twitch's modal DOM.

1. **Baseline reproduction (pre-fix).** On v1.1.1 build (no fix), navigate to a streamer's channel, click Subscribe, pass friction (e.g., click Proceed on the soft nudge or full friction flow), then change the tier dropdown. **Expected:** friction overlay re-appears. Confirms the bug locally before measuring the fix.
2. **Build with fix, reload extension, repeat.** Same flow. **Expected:** changing the tier dropdown is silent — no overlay. Tier value updates as expected.
3. **Confirm button still fires.** After step 2, click the actual final "Subscribe with $X.XX" button. **Expected:** friction overlay appears (because the price has changed since the original friction). This is option B's intentional behaviour.
4. **Confirm button at original price still fires.** Open a fresh sub modal, pass friction, do *not* change tier, click final confirm. **Expected:** friction overlay re-appears (same reasoning — separate purchase commit).
5. **Verification log.** During steps 2 and 3, open `logs.html` (the extension log viewer). **Expected:** at least one `isPurchaseButton: IGNORED (form-control)` debug entry per dropdown click. If those entries are absent and the bug persists, the conservative role list missed Twitch's actual markup → DOM-inspect the picker, add a more specific selector in a follow-up commit on this branch.
6. **Gift sub regression.** Open a gift-sub modal (any channel). Click a quantity tile (e.g., "$4.99 — Gift 1 Sub"). **Expected:** friction overlay appears as before. The gift-quantity buttons match via `dataTarget.includes('gift')` on the parent button, not via the dollar-amount-in-dialog rule, so they should be unaffected — but verify.
7. **Bits regression.** Open the Bits purchase modal. Click any bit-bundle tile. **Expected:** friction overlay appears as before. These match via `dataTarget.startsWith('bits-purchase-button')`.
8. **One-tap-store / combo regression.** If the channel has a one-tap store, click a combo tile. **Expected:** friction overlay appears as before. These match via `combo` aria-label or one-tap-store container path.
9. **Cross-browser sanity.** Steps 2 and 3 on the other browser if convenient (issue was reported on Firefox/Zen; Chrome alone is acceptable since Twitch ships the same DOM cross-browser, but covering both removes ambiguity).

## Version Bump

Current version is 1.1.1 (per `manifest.json` / `manifest.firefox.json` / `package.json`). Bump patch to **1.1.2** at the end of implementation via `npm run release` per the lockstep process in `docs/dev/RELEASE-PROCESS.md`. Do not bump manifests by hand.

## Follow-ups

- If step 5 of testing shows the conservative role list missed Twitch's tier-picker markup, add a `data-a-target` or container-based selector in a follow-up commit on the same branch *before* opening the PR.
- Future broader sweep: `isPurchaseButton` is now ~120 lines with several layered heuristics. Not in scope here, but worth flagging in `docs/dev/HypeControl-TODO.md` as a candidate for a focused refactor pass once a few more detector bugs accrete (do not do that here — three rules ago is not enough signal for a refactor).
