# Type-to-Confirm Paste Bypass — Design Spec

**Issue:** [#49 — Friction dialog that makes me type should not allow me to copy/paste](https://github.com/Ktulue/HypeControl/issues/49)
**Date:** 2026-04-27
**Status:** Approved, ready for plan

## Problem

The "Type to confirm" friction step asks the user to type the phrase `I want to buy this` before the Confirm button enables. The check is purely value-based — it accepts any value that matches the phrase, regardless of how it got into the input. As reported on issue #49, users can paste the phrase to defeat the friction in one keystroke. The reporter also called out the "drag/select" path and assumed it was OS-level; it isn't — the extension's own CSS makes the displayed phrase one-click selectable, which actively assists the bypass.

## Root Cause

Two contributing factors in the existing implementation (`src/content/interceptor.ts:1106-1203` and `src/content/styles.css:718-730`):

1. **No paste-vector blocking on the input.** `showTypeToConfirmStep()` registers an `input` listener that checks the value against the phrase, but it does not listen for `paste`, `drop`, or `beforeinput` events. Any path that lands matching text in the value (clipboard paste, drag-drop, browser autofill, programmatic `execCommand`) flips the Confirm button to enabled.
2. **The displayed phrase is one-click selectable.** `.hc-confirm-phrase` has `user-select: all`, which means a single click selects the entire prompt text, making it trivial to copy or drag into the input. This was a UX choice for readability that turned out to enable the bypass.

## Mental Model

The friction in this step is the act of typing — the muscle memory pause and the keystrokes themselves. The input value matching the phrase is a *proxy* for "the user typed it." Any path that produces the matching value without typing defeats the friction. The fix is to:

- **Block non-typing inputs.** Anything from the clipboard, a drop event, autofill, or `beforeinput` with a paste-flavored `inputType` is rejected.
- **Make the source un-grabbable.** The displayed phrase is the obvious thing to copy; it should not select on click.
- **Call out the cheat in brand voice.** Per the project's "Friction is the feature" principle, a paste attempt is a beat in the friction experience, not just a silently-blocked event. A short Newman-flavored ("Ah ah ah…") callout flashes inline, the input clears, and the user is back at zero.

## Scope Decisions

- **Type-to-confirm step only.** The math-challenge step (`showMathChallengeStep`, same file) is *not* hardened. The math problem is generated freshly on each open and the answer is 2–3 digits; pasting "42" defeats nothing meaningful, because the friction there is solving the problem, not typing it.
- **No new settings, no storage, no migrations, no type changes.** The fix is pure UI/event hardening.
- **Right-click contextmenu is NOT blocked.** The `paste` event already fires on context-menu paste, so blocking is redundant and removing the menu would also remove "Inspect Element" for power users — heavy-handed for no marginal gain.
- **Telemetry-only logging.** A blocked paste attempt is logged via the existing `log()` helper at the same severity as the existing "Type-to-confirm step shown" log. No new event types, no new storage.
- **No copy rotation state.** The cheeky callout line is picked at random from a fixed pool on each attempt; we do not track "which line was shown last" — randomness is fine and avoids state.

## Changes by File

### 1. `src/content/interceptor.ts`

Inside `showTypeToConfirmStep()` (~line 1113):

- Add a module-scoped `CHEAT_CALLOUT_LINES: readonly string[]` array near `TYPE_TO_CONFIRM_PHRASE` with four Newman-flavored lines:
  - `"Ah ah ah. You didn't type the magic phrase."`
  - `"Ah ah ah — pasting isn't typing."`
  - `"The friction is the feature. Hands on keyboard."`
  - `"Nice try. Hands on keyboard."`
- Add a small helper `pickCheatLine()` that returns a random entry from the pool.
- In the rendered HTML, add three attributes to the input to discourage password managers and autofill:
  - `name="hc-no-autofill"`
  - `data-1p-ignore` (1Password)
  - `data-lpignore="true"` (LastPass)
- After the input element in the rendered HTML, add a hidden inline callout element:
  ```html
  <p class="hc-cheat-callout" id="hc-cheat-callout" role="alert" style="display: none;"></p>
  ```
- Inside the existing `Promise` body, after the `inputEl` and `proceedBtn` references are obtained, add a `calloutEl` reference and a `triggerCheatCallout()` helper that:
  1. Clears `inputEl.value`.
  2. Re-disables the Confirm button (mirrors the existing disabled-state styling).
  3. Sets the callout's `textContent` to a freshly picked line and unhides it. **Use `textContent`, never `innerHTML`** — per the project's stored XSS feedback memory, all user-facing dynamic strings are written via `textContent`.
  4. Refocuses the input.
  5. Calls `log('Type-to-confirm: paste/drop bypass attempt blocked')`.
- Wire three event listeners on the input, all routing to `triggerCheatCallout()` after `preventDefault()`:
  - `paste`
  - `drop`
  - `beforeinput` — only when `inputType` is one of `'insertFromPaste'`, `'insertFromDrop'`, or `'insertReplacementText'` (defense-in-depth for `execCommand` and exotic IME paths).
- In the existing `input` listener, hide the callout on every legitimate keystroke: `if (calloutEl) calloutEl.style.display = 'none';` before the existing match-checking logic.

### 2. `src/content/styles.css`

- `.hc-confirm-phrase` (line 718): change `user-select: all;` to `user-select: none;` and add `-webkit-user-select: none;`. The phrase remains visually present and screen-reader-readable; only mouse-selection is suppressed.
- Add a new `.hc-cheat-callout` rule positioned below the input:
  ```css
  .hc-cheat-callout {
    margin-top: 8px;
    font-family: var(--hc-font);
    font-size: 13px;
    color: var(--hc-danger);
    font-weight: 600;
    text-align: center;
  }
  ```
  Color uses the existing `--hc-danger` token (red) — the universal "stop, you're caught" semantic, consistent with the design system's red-for-warning rule.

## Out of Scope

- Hardening the math-challenge step.
- Hardening the whitelist channel-name input or any other text input in the extension.
- Per-attempt copy rotation tracking (random pick is sufficient).
- Disabling browser-level keyboard shortcuts other than via `paste` event preventDefault (which already covers Ctrl/Cmd+V).
- Devtools-driven attacks (programmatic `inputEl.value = '...'` from console). A determined adversary with devtools is not the target user; HypeControl is opt-in friction for the user themself.

## Accessibility

- The displayed phrase remains in the DOM with the same text and the same accessible name. `user-select: none` affects pointer/keyboard selection only, not screen-reader rendering.
- The callout element uses `role="alert"` so screen readers announce it when it becomes visible.
- The input remains fully keyboard-typable, which is the only path screen-reader users would take. Paste-via-keyboard for AT users is a legitimate concern in general but is exactly the workflow this feature is designed to disrupt — friction is the point.

## Testing Plan

1. **Keyboard paste blocked.** Open the type-to-confirm step. Copy `I want to buy this` to the clipboard. Press Ctrl/Cmd+V in the input. **Expected:** input stays empty, Confirm stays disabled, callout flashes a Newman line.
2. **Right-click paste blocked.** Same as above, via right-click → Paste menu. **Expected:** identical behavior.
3. **Drag-and-drop the prompt phrase blocked.** Try to select the displayed phrase with the mouse. **Expected:** selection does not occur (CSS).
4. **Drag-and-drop external text blocked.** Select arbitrary text on the page (e.g., from the description) and drag it into the input. **Expected:** drop event prevented, callout flashes.
5. **`beforeinput` defense-in-depth.** Verifies the listener — not a user-facing scenario. With the input focused, run `document.execCommand('insertText', false, 'I want to buy this')` from devtools. **Expected:** input stays empty, callout flashes. (`beforeinput` with `inputType === 'insertReplacementText'` catches this.) Note: this test exercises the safety net; an adversary with devtools can always bypass via direct `inputEl.value` assignment, which is intentionally out of scope.
6. **Autofill / password manager.** With 1Password (or any installed manager) active, open the modal. **Expected:** the field is not auto-filled (or, if a manager is sufficiently aggressive to ignore the hints, the `paste` / `beforeinput` listeners catch the fill).
7. **Legitimate typing still works.** Type the phrase character by character. **Expected:** Confirm enables when the value matches; pressing Enter or clicking Confirm resolves with `'proceed'`.
8. **Callout hides on resumed typing.** Trigger a paste (callout visible), then type one character. **Expected:** callout hides immediately on first keystroke.
9. **Rapid repeated paste attempts.** Paste five times in a row. **Expected:** input stays empty each time; callout text rotates randomly across attempts; no duplicate-listener leaks; modal stays responsive.
10. **Cancel still works.** Trigger a paste, then click Cancel (or press Escape). **Expected:** modal closes, decision resolves to `'cancel'`.
11. **No regression in math challenge.** Open the math challenge step in a separate intercept. **Expected:** unchanged behavior — paste still works there (intentional, out of scope).

## Version Bump

Current version is 1.1.0 (per `manifest.json` and `package.json`). Bump patch to **1.1.1** at the end of implementation per the project's lockstep release process documented in `docs/dev/RELEASE-PROCESS.md`. Use `npm run release` — do not bump manifests by hand.
