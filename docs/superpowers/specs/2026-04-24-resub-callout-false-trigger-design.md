# Fix: Exclude Chat-Callout Surfaces From Purchase Detection (#44)

**Date:** 2026-04-24
**Issue:** [#44](https://github.com/Ktulue/HypeControl/issues/44)
**Type:** Bug fix

## Problem

When a user presses the "Share" button on a Twitch re-sub callout (the widget that posts "Thanks to @X for my sub gift!" into chat), HypeControl incorrectly shows a friction overlay. No purchase is actually in flight — the callout's primary action is a chat message.

Root cause: `isPurchaseButton()` in `src/content/detector.ts` uses label-keyword and text-fallback heuristics that fire on callout markup. The callout container's aggregated text and nested `tw-core-button-label-text` children contain terms ("gift", "sub", and in some cases "gift N sub" patterns from adjacent action buttons) that the detector treats as purchase signals. The callout is a distinct Twitch UI surface that is never a purchase button, but the detector has no concept of it.

## Decision

Add a context-level exclusion at the top of `isPurchaseButton()`. Any element inside a Twitch chat-callout surface (identified by `data-a-target`) short-circuits to `false` before any existing match path runs.

### Matcher

Two-part match against any ancestor's lowercased `data-a-target` (walked via `element.closest('[data-a-target]')` iteratively up the tree):

1. **Seed list** — known-safe callout dataTargets confirmed non-purchase:
   - `chat-private-callout` (issue #44, re-sub / gifted-sub share)
   - `chat-paid-pinned-chat-message` (paid pins)
   - `community-highlight-stack` (hype/first-sub/gift recap callouts)
2. **Suffix rule** — any dataTarget matching `/-callout(__|$)/`. Anchored on the `-callout` suffix (with optional `__<bem-suffix>` from Twitch's BEM-style naming) so it can't be tripped by unrelated `callout` substrings mid-string (e.g. a hypothetical `callout-confirm-purchase`).

A match on either condition returns `false`.

### Alternatives considered

- **Narrow: match only `chat-private-callout`.** Rejected. The callout widget is a family, not a single element. Fixing one surface while leaving siblings (paid pins, hype callouts) vulnerable means playing whack-a-mole.
- **Broad: flip detector to allowlist of known purchase surfaces.** Rejected for this fix — high-risk rewrite. Deferred to a follow-up (see Follow-ups).
- **Broader suffix `/callout/` substring match.** Rejected. Could match unrelated dataTargets Twitch might ship in purchase flows. Anchored suffix is safer.

## Changes

### `src/content/detector.ts`

Add two constants near the existing `INTERCEPT_KEYWORDS` / `IGNORE_LABELS`:

```ts
const CHAT_CALLOUT_SEED_DATATARGETS = [
  'chat-private-callout',
  'chat-paid-pinned-chat-message',
  'community-highlight-stack',
];

const CHAT_CALLOUT_SUFFIX_RE = /-callout(__|$)/;
```

Add a helper:

```ts
function isInsideChatCallout(element: HTMLElement): { matched: boolean; dataTarget: string | null } {
  let node: HTMLElement | null = element;
  while (node) {
    const ancestor = node.closest('[data-a-target]') as HTMLElement | null;
    if (!ancestor) return { matched: false, dataTarget: null };
    const dt = (ancestor.getAttribute('data-a-target') || '').toLowerCase();
    if (CHAT_CALLOUT_SEED_DATATARGETS.includes(dt) || CHAT_CALLOUT_SUFFIX_RE.test(dt)) {
      return { matched: true, dataTarget: dt };
    }
    node = ancestor.parentElement;
  }
  return { matched: false, dataTarget: null };
}
```

Wire into `isPurchaseButton`, immediately after the null-check and before the `IGNORE_LABELS` check. `elementInfo` construction moves up a few lines so the debug log has it:

```ts
const callout = isInsideChatCallout(element);
if (callout.matched) {
  debug('isPurchaseButton: IGNORED (chat-callout)', { ...elementInfo, calloutDataTarget: callout.dataTarget });
  return false;
}
```

### `tests/content/detector.test.ts` (new file)

jsdom-based tests using `document.createElement` + attribute/child setup.

**A. Callout-exclusion coverage (the fix):**

1. Button with `data-a-target="chat-private-callout__primary-button"` → not intercepted.
2. Nested DIV inside a `chat-private-callout` ancestor → not intercepted.
3. Button inside a `community-highlight-stack` ancestor → not intercepted.
4. Element with `data-a-target="hype-train-callout"` (suffix rule match) → not intercepted.
5. Element with `data-a-target="gift-sub-button"` inside a parent with `data-a-target="callout-confirm-purchase"` (mid-string `callout`, no suffix match) → still intercepted. Verifies suffix-anchoring.

**B. Baseline `isPurchaseButton` regression coverage:**

6. `top-nav-get-bits-button` → intercepted.
7. `bits-button` / `aria-label="Cheer"` → ignored.
8. `bits-purchase-button-100` → intercepted.
9. `data-a-target` containing `gift` (e.g. `gift-sub-button`) → intercepted.
10. Label "Gift 1 sub" (regex path) → intercepted.
11. Label "Gifted Subscriptions" (past-tense, issue #36 regression guard) → ignored.
12. Label "Cancel" / "Close" / "Dismiss" → ignored.
13. Combo button with `aria-label="Send Hearts Combo, 5 Bits"` → intercepted.
14. Button with `$4.99` text inside a `[role="dialog"]` → intercepted.
15. `null` element → returns `false`.

### `manifest.json` + `package.json`

Patch bump `1.0.9` → `1.0.10`.

`manifest.firefox.json` is **not bumped** in this fix — it sits at `1.0.2` and will be brought back into lockstep as part of the upcoming `1.1.0` release cut (separate PR). Bumping it to `1.0.10` here is wasted work because `1.1.0` will overwrite it.

### `CLAUDE.md`

The current versioning rule says "bump both files" — ambiguous, and why `manifest.firefox.json` drifted from `1.0.2` while Chrome moved to `1.0.9`. Consolidate the two overlapping sections ("Version Management" and "Versioning") into a single explicit rule naming all three files:

```markdown
## Versioning

After any successful code change, always bump the patch version in **all three** of these files before finishing the task:

- `manifest.json` (Chrome/Edge)
- `manifest.firefox.json` (Firefox AMO)
- `package.json`

All three must stay in lockstep — never bump one without the others. Only increment the patch number (e.g., `1.0.9` → `1.0.10`). Never bump the minor or major number unless explicitly instructed.

The bump must happen **before** `npm run build` so the `dist/` output reflects the new version. Attempt `npm run build` once after the bump; if it fails for any reason, do not retry — ask the user to run it manually.
```

Rationale: version numbers are release identifiers, not code-equivalence claims. Browser-specific fixes may produce "no-op" bumps in the other manifest — that's fine and expected. The rule prevents the drift class entirely.

### `docs/dev/HypeControl-TODO.md`

- Mark issue #44 as fixed (v1.0.10).
- Add deferred-work entry: "Detector: move to allowlist of known purchase surfaces (Option C from design 2026-04-24-resub-callout-false-trigger)."

## Edge Cases

- **`null` element:** Existing guard at top of `isPurchaseButton` handles this.
- **Detached DOM node:** `closest()` returns `null`; helper returns `{ matched: false, dataTarget: null }`. Falls through to existing logic.
- **Element IS the callout:** `closest()` includes the element itself. Matches naturally.
- **Shadow DOM:** `closest()` does not cross shadow boundaries. Twitch does not use shadow DOM for callouts today. If it ever does, we re-open. Documented as a one-line code comment in `isInsideChatCallout`.
- **Unusual casing in dataTarget:** Helper lowercases before comparison. Defensive, low cost.
- **Missing `data-a-target` attributes:** `closest('[data-a-target]')` only matches elements that have the attribute — safe by construction.
- **Performance:** One ancestor walk per click. Click events are human-paced; cost is negligible.

## Testing

1. `npm test` — all existing tests pass; 15 new detector tests pass.
2. `npm run build` — builds cleanly.
3. Manual verification on `www.twitch.tv`:
   - Trigger a re-sub callout (or use gifted-sub "say thanks" callout). Press "Share". Expected: message posts to chat, no HC friction overlay.
   - Click a real "Gift a Sub" button in any channel. Expected: HC friction overlay as normal.
   - Click a Bits purchase button. Expected: HC friction overlay as normal.

## Follow-ups / deferred work

The following are explicitly **out of scope** for this fix and captured here + in `docs/dev/HypeControl-TODO.md` so they don't get lost:

- **Detector allowlist rewrite** ("Option C"). Flip `isPurchaseButton` from "deny known non-purchases" to "allow known purchase surfaces." Long-term correct approach to prevent this entire class of false-positive, but a high-risk rewrite that deserves its own spec + plan cycle. The baseline test suite added here is a prerequisite: it gives the rewrite a regression net.
- **Require `BUTTON` tag for label-keyword path.** The bug logs show the label-keyword path firing on a DIV via `textContent`/`tw-core-button-label-text` child aggregation. Tightening that path to require an actual `<button>` element (or a role-scoped element) would reduce false-positive surface, but the callout-exclusion rule in this fix covers the reported symptom without touching hot paths. Revisit if new false-positives appear.
