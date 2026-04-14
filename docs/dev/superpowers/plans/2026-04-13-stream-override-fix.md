# Stream Override Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Do NOT bump versions mid-plan.** Only Task 10 touches version numbers. Subagents working on Tasks 1–9 must leave `manifest.json` and `package.json` versions alone.

**Goal:** Fix [#32](https://github.com/Ktulue/HypeControl/issues/32) — wire the popup's Stream Override button to actually bypass friction, log every intercepted purchase during bypass as `outcome: 'streaming'`, and replace the transient toast with a persistent status badge.

**Architecture:** Treat "streaming bypass" as one state with two activation paths — manual (`settings.streamingOverride.expiresAt`) and auto-detect (live on own channel + grace period). `shouldBypassFriction()` short-circuits on manual override before the existing own-channel gates. The interceptor's bypass branch gains `recordPurchase()` + `writeInterceptEvent({ outcome: 'streaming' })`. A unified persistent badge replaces the per-purchase toast and the old grace-period badge.

**Tech Stack:** TypeScript, webpack, Chrome MV3 storage APIs, Jest (unit tests for shared modules only), no test framework for content scripts — verify those in-browser.

**Spec:** `docs/dev/superpowers/specs/2026-04-13-stream-override-fix-design.md`

**Branch:** `fix/stream-override-bug-32` (already created)

---

## File Structure

**Modify:**
- `src/shared/types.ts` — extend `InterceptEvent.outcome` union; sanitizer update
- `src/content/streamingMode.ts` — override short-circuit, drop dead `manualOverrideUntil`, unify badge function
- `src/content/interceptor.ts` — log purchases during bypass, remove toast call
- `src/content/styles.css` — retire toast + grace-badge styles, add unified badge styles
- `src/history/history.ts` — render `'streaming'` outcome rows with distinct label/color
- `src/history/history.html` — add "Streaming" filter button
- `src/history/history.css` — add `.outcome-streaming` + `.amount-streaming` styles
- `tests/shared/types.test.ts` — type tests for new outcome value (if a suitable test file exists; otherwise add assertions to the interceptLogger path)
- `manifest.json` + `package.json` — version bump
- `docs/dev/HypeControl-TODO.md` — mark fix completed
- `docs/dev/HC-Project-Document.md` — update streaming mode section if status changed

No new files. This is a bug fix + small feature addition, not a new subsystem.

---

## Task 1: Extend `InterceptEvent.outcome` type

**Files:**
- Modify: `src/shared/types.ts:235`

- [ ] **Step 1: Update the outcome union**

In `src/shared/types.ts`, change line 235 from:

```typescript
  outcome: 'cancelled' | 'proceeded';
```

to:

```typescript
  outcome: 'cancelled' | 'proceeded' | 'streaming';
```

- [ ] **Step 2: Verify TypeScript still compiles**

Run: `npx tsc --noEmit`

Expected: No new errors. Existing call sites in `interceptor.ts` and `history.ts` don't break because they compare against string literals.

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add 'streaming' outcome to InterceptEvent type"
```

---

## Task 2: Fix `shouldBypassFriction` — honor manual override globally

**Files:**
- Modify: `src/content/streamingMode.ts` (the `shouldBypassFriction` function, lines 76–114, and the `StreamingState` interface lines 12–15)

- [ ] **Step 1: Add the global override short-circuit**

In `src/content/streamingMode.ts`, replace the existing `shouldBypassFriction` function body with:

```typescript
export async function shouldBypassFriction(settings: UserSettings): Promise<boolean> {
  const enabled = settings.streamingMode.enabled;
  const username = settings.streamingMode.twitchUsername.trim().toLowerCase();
  const currentChannel = getCurrentChannel()?.toLowerCase() || '';
  const onOwnChannel = !!username && currentChannel === username;
  const channelIsLive = onOwnChannel ? detectIfLive() : false;

  const logResult = (result: boolean | string) =>
    log(`Streaming mode check: enabled=${enabled}, onOwnChannel=${onOwnChannel}, channelIsLive=${channelIsLive}, result=${result}`);

  // Manual override from popup — global, no channel or streaming-mode-enabled gate
  const override = settings.streamingOverride;
  if (override && typeof override.expiresAt === 'number' && Date.now() < override.expiresAt) {
    logResult('true (manual override)');
    return true;
  }

  if (!enabled || !username || !onOwnChannel) {
    logResult(false);
    return false;
  }

  const state = await loadStreamingState();

  if (channelIsLive) {
    logResult('true (live)');
    return true;
  }

  // Grace period after stream ended
  if (state.streamEndedAt) {
    const elapsed = Date.now() - state.streamEndedAt;
    const inGrace = elapsed < settings.streamingMode.gracePeriodMinutes * 60000;
    logResult(`${inGrace} (grace period, elapsed=${Math.round(elapsed / 1000)}s)`);
    return inGrace;
  }

  logResult(false);
  return false;
}
```

Key changes:
- Override check runs first, before the `enabled/username/onOwnChannel` gate.
- The old `if (state.manualOverrideUntil && ...)` block is removed — that field is never written.

- [ ] **Step 2: Remove the dead `manualOverrideUntil` field from `StreamingState`**

Replace lines 12–15:

```typescript
interface StreamingState {
  streamEndedAt: number | null;
  manualOverrideUntil: number | null;
}
```

with:

```typescript
interface StreamingState {
  streamEndedAt: number | null;
}
```

Then update `loadStreamingState` (lines 17–24) to drop the field:

```typescript
async function loadStreamingState(): Promise<StreamingState> {
  try {
    const result = await chrome.storage.local.get(STREAMING_STATE_KEY);
    return result[STREAMING_STATE_KEY] || { streamEndedAt: null };
  } catch {
    return { streamEndedAt: null };
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors. The only caller of `state.manualOverrideUntil` was in `shouldBypassFriction` and has been removed.

- [ ] **Step 4: Commit**

```bash
git add src/content/streamingMode.ts
git commit -m "fix: honor streamingOverride in shouldBypassFriction (#32)"
```

---

## Task 3: Log intercepted purchases during bypass

**Files:**
- Modify: `src/content/interceptor.ts:1847-1860`

- [ ] **Step 1: Replace the streaming bypass block with one that records the event**

In `src/content/interceptor.ts`, replace lines 1847–1860 (the block beginning `// Streaming mode bypass check`) with:

```typescript
  // Streaming mode bypass check
  const streamingBypass = await shouldBypassFriction(settings);
  if (streamingBypass) {
    const tracker = await loadSpendingTracker(settings);
    const whitelistOverridden = checkWhitelist(attempt.channel, settings);
    if (whitelistOverridden) {
      log(`Streaming mode active \u2014 whitelist setting for ${attempt.channel} ignored`);
    }
    if (settings.streamingMode.logBypassed) {
      log('Streaming mode bypass:', { type: attempt.type, rawPrice: attempt.rawPrice, wasStreamingMode: true });
    }
    const priceWithTax = Math.round((attempt.priceValue ?? 0) * (1 + settings.taxRate / 100) * 100) / 100;
    await recordPurchase(attempt.priceValue, settings, tracker);
    await writeInterceptEvent({
      channel: attempt.channel,
      purchaseType: attempt.type,
      rawPrice: attempt.rawPrice,
      priceWithTax: attempt.priceValue == null ? null : priceWithTax,
      outcome: 'streaming',
    });
    allowNextClick(actualButton);
    return;
  }
```

Key changes vs before:
- `loadSpendingTracker(settings)` called inside the block (it is redundant with the `loadSpendingTracker` at line 1862 for the non-bypass path; that remains unchanged — each branch loads its own).
- `recordPurchase` + `writeInterceptEvent` added.
- `showStreamingModeToast(...)` call removed — persistent badge (Task 5) replaces it.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors. `recordPurchase`, `writeInterceptEvent`, `loadSpendingTracker` are already imported in this file (confirm by searching imports at the top of `interceptor.ts` if needed; they are used in the whitelist-skip block around line 1869).

- [ ] **Step 3: Commit**

```bash
git add src/content/interceptor.ts
git commit -m "feat: log purchases during streaming bypass as outcome 'streaming'"
```

---

## Task 4: Remove dead toast function and styles

**Files:**
- Modify: `src/content/interceptor.ts:1755-1770`
- Modify: `src/content/styles.css:498-515`

- [ ] **Step 1: Delete `showStreamingModeToast`**

In `src/content/interceptor.ts`, delete the entire function block at lines 1755–1770 (the `// ── Streaming Mode Toast ─` section through the closing brace of `showStreamingModeToast`).

- [ ] **Step 2: Delete the toast CSS**

In `src/content/styles.css`, delete lines 498–515 (the `/* Streaming mode toast */` block and both `.hc-streaming-toast` / `.hc-streaming-toast--fade` rules).

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors. No callers of `showStreamingModeToast` remain after Task 3.

- [ ] **Step 4: Commit**

```bash
git add src/content/interceptor.ts src/content/styles.css
git commit -m "refactor: remove showStreamingModeToast (superseded by persistent badge)"
```

---

## Task 5: Add persistent streaming badge

**Files:**
- Modify: `src/content/streamingMode.ts` (replace `updateGracePeriodBadge`, add `updateStreamingBadge`, update `checkAndUpdateLiveStatus`, and add a dedicated poll for the override countdown)
- Modify: `src/content/styles.css` (add `.hc-streaming-badge` styles; remove old `.hc-grace-badge` styles if present)

- [ ] **Step 1: Replace `updateGracePeriodBadge` with `updateStreamingBadge`**

In `src/content/streamingMode.ts`, replace the entire `updateGracePeriodBadge` function (lines 153–179) with:

```typescript
/**
 * Show or update the unified streaming-mode status badge in the page corner.
 * Covers manual override, live-on-own-channel, and grace-period states.
 * Badge is removed when no bypass reason is active.
 */
export async function updateStreamingBadge(settings: UserSettings): Promise<void> {
  const BADGE_ID = 'hc-streaming-badge';
  const existing = document.getElementById(BADGE_ID);

  const reason = await computeBadgeReason(settings);
  if (!reason) {
    existing?.remove();
    return;
  }

  const badge = existing || document.createElement('div');
  badge.id = BADGE_ID;
  badge.className = 'hc-streaming-badge';
  badge.textContent = reason;
  if (!existing) {
    document.body.appendChild(badge);
  }
}

/**
 * Return the human-readable badge text for the current bypass state,
 * or null if no bypass reason is active.
 * Priority: manual override > live on own channel > grace period.
 */
async function computeBadgeReason(settings: UserSettings): Promise<string | null> {
  // Manual override
  const override = settings.streamingOverride;
  if (override && typeof override.expiresAt === 'number' && override.expiresAt > Date.now()) {
    const remainingMs = override.expiresAt - Date.now();
    const totalMin = Math.floor(remainingMs / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
    return `⏸ HC paused — override (${timeStr})`;
  }

  // Auto-detect (gated on own channel)
  const enabled = settings.streamingMode.enabled;
  const username = settings.streamingMode.twitchUsername.trim().toLowerCase();
  const currentChannel = getCurrentChannel()?.toLowerCase() || '';
  const onOwnChannel = !!username && currentChannel === username;
  if (!enabled || !onOwnChannel) return null;

  if (detectIfLive()) {
    return `🔴 HC paused — live on ${currentChannel}`;
  }

  const state = await loadStreamingState();
  if (state.streamEndedAt) {
    const elapsed = Date.now() - state.streamEndedAt;
    const gracePeriodMs = settings.streamingMode.gracePeriodMinutes * 60000;
    const remaining = gracePeriodMs - elapsed;
    if (remaining > 0) {
      const minutesLeft = Math.ceil(remaining / 60000);
      return `⏳ HC paused — grace period (${minutesLeft}m)`;
    }
  }

  return null;
}
```

- [ ] **Step 2: Rewire `checkAndUpdateLiveStatus` to call the new badge function**

In `src/content/streamingMode.ts`, find the existing call at the end of `checkAndUpdateLiveStatus` (line 146, `updateGracePeriodBadge(settings);`) and change it to:

```typescript
  await updateStreamingBadge(settings);
```

- [ ] **Step 3: Verify call sites**

Search for any remaining references to `updateGracePeriodBadge`:

Run: `grep -rn "updateGracePeriodBadge" src/`

Expected: No results. If any remain, update them to `updateStreamingBadge` (and `await` the call).

- [ ] **Step 4: Add badge styles; remove grace-badge styles if present**

In `src/content/styles.css`, find any existing `#hc-grace-badge` or `.hc-grace-badge` rules and delete them. Append these new rules (near the other badge/toast rules):

```css
/* Unified streaming-mode status badge */
.hc-streaming-badge {
  position: fixed;
  bottom: 48px;
  right: 10px;
  background: var(--hc-accent, #9147ff);
  color: white;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  font-family: var(--hc-font);
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  pointer-events: none;
  z-index: 2147483646;
}
```

(The color uses `--hc-accent` if defined, falling back to the brand purple `#9147ff` from CLAUDE.md's design notes. Purple reads as "paused/informational" rather than red "alert" — matches the spec.)

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/content/streamingMode.ts src/content/styles.css
git commit -m "feat: unified persistent streaming-mode badge (#32)"
```

---

## Task 6: Poll the badge so manual override countdown stays fresh off-channel

**Files:**
- Modify: wherever the content script's polling loop is initialized. Find the existing 30s interval that calls `checkAndUpdateLiveStatus`.

- [ ] **Step 1: Locate the polling setup**

Run: `grep -rn "checkAndUpdateLiveStatus" src/content/`

Expected: Find the setInterval call that drives the 30s live-status poll. Note the file and line.

- [ ] **Step 2: Add a badge-only tick that runs even when not on own channel**

At the location found in Step 1, add (alongside the existing poll — do not replace it) a second short interval that refreshes the badge regardless of channel context. Example shape, to be inserted near the existing interval:

```typescript
// Refresh streaming badge every 30s so manual-override countdown stays current
// off-own-channel (checkAndUpdateLiveStatus only runs when on own channel).
setInterval(async () => {
  const settings = await loadSettings();
  await updateStreamingBadge(settings);
}, 30000);

// Also run once immediately so the badge appears without waiting 30s
(async () => {
  const settings = await loadSettings();
  await updateStreamingBadge(settings);
})();
```

Use the local helper for loading settings that the content script already uses (if unsure, search `loadSettings` in the same file — it is defined in `interceptor.ts` near the top of the initialization section). Import `updateStreamingBadge` from `./streamingMode` if not already imported.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/content/
git commit -m "feat: poll streaming badge off-channel for override countdown"
```

---

## Task 7: Render `'streaming'` outcome in the history page

**Files:**
- Modify: `src/history/history.ts` (the `renderTable` and `computeSummary` functions, and the sort switch if needed)
- Modify: `src/history/history.html:59-66` (add a Streaming filter button)
- Modify: `src/history/history.css` (add `.outcome-streaming` + `.amount-streaming` styles)

- [ ] **Step 1: Update `renderTable` to handle the new outcome**

In `src/history/history.ts`, replace the outcome cell block inside `renderTable` (lines 340–343) with:

```typescript
    const tdOutcome = document.createElement('td');
    if (event.outcome === 'cancelled') {
      tdOutcome.textContent = 'Cancelled';
      tdOutcome.className = 'outcome-cancelled';
    } else if (event.outcome === 'streaming') {
      tdOutcome.textContent = 'Streaming';
      tdOutcome.className = 'outcome-streaming';
    } else {
      tdOutcome.textContent = 'Proceeded';
      tdOutcome.className = 'outcome-proceeded';
    }
    tr.appendChild(tdOutcome);
```

Also update the amount cell (lines 333–338) so streaming rows get a distinct styling class (not red, not default):

```typescript
    const tdAmount = document.createElement('td');
    tdAmount.textContent = formatCurrency(event.priceWithTax);
    if (event.outcome === 'proceeded') {
      tdAmount.className = 'amount-proceeded';
    } else if (event.outcome === 'streaming') {
      tdAmount.className = 'amount-streaming';
    }
    tr.appendChild(tdAmount);
```

- [ ] **Step 2: Confirm `computeSummary` needs no change**

Read lines 195–252. `computeSummary` already filters by `outcome === 'proceeded'` and `outcome === 'cancelled'`. Streaming events are naturally excluded from `totalSpent`, `totalSaved`, `cancelRate`, `topStep`, and `topReason`. `eventCount` uses `filteredEvents.length` — streaming events count toward the event total only (correct: they are real events).

No edit needed. Note this in the commit message.

- [ ] **Step 3: Add the "Streaming" filter button to history.html**

In `src/history/history.html`, replace lines 61–66 (the `outcome-toggle` block) with:

```html
        <div class="outcome-toggle" id="outcome-toggle" role="group" aria-label="Outcome filter">
          <button class="outcome-btn active" data-value="all">All</button>
          <button class="outcome-btn" data-value="cancelled">Cancelled</button>
          <button class="outcome-btn" data-value="proceeded">Proceeded</button>
          <button class="outcome-btn" data-value="streaming">Streaming</button>
        </div>
```

The existing `applyFilters` logic at history.ts:176 (`event.outcome !== outcomeFilter`) already handles the new value — no code change needed for filtering.

- [ ] **Step 4: Add outcome styles**

In `src/history/history.css`, find the existing `.outcome-cancelled` / `.outcome-proceeded` rules. Add sibling rules:

```css
.outcome-streaming {
  color: #3aa3ff; /* teal-blue — distinct from success-green and danger-red */
  font-weight: 600;
}

.amount-streaming {
  color: #3aa3ff;
}
```

(If the existing file uses CSS variables for colors, match that pattern and add a variable if warranted. Otherwise the literal hex above is fine — the history page is not themed with the intense brand palette of the overlays.)

- [ ] **Step 5: Build and verify visually**

Attempt: `npm run build`

If the build fails for any reason, stop and tell the user to run `npm run build` manually — do not retry (per `CLAUDE.md`).

If the build succeeds, load the unpacked `dist/` in the browser, open the history page, and confirm:
- The "Streaming" filter button is present and filters correctly.
- When test events exist with `outcome: 'streaming'` (see Task 9 test plan), the row renders with the "Streaming" label in the new color.

- [ ] **Step 6: Commit**

```bash
git add src/history/history.ts src/history/history.html src/history/history.css
git commit -m "feat: render 'streaming' outcome in history page with filter"
```

---

## Task 8: Unit test the type + logger round-trip

**Files:**
- Modify or create: `tests/shared/types.test.ts` (add an assertion for the new outcome)

- [ ] **Step 1: Check what `types.test.ts` covers**

Run: `cat tests/shared/types.test.ts | head -50`

If the file does not test `InterceptEvent.outcome` values directly (it likely tests `UserSettings`), add a minimal test that proves the type union accepts `'streaming'`. If the file doesn't exist or isn't appropriate, skip to Step 3.

- [ ] **Step 2: Add a type-level assertion test**

Append to `tests/shared/types.test.ts`:

```typescript
import { InterceptEvent } from '../../src/shared/types';

describe('InterceptEvent outcome', () => {
  it('accepts the streaming outcome value', () => {
    const event: InterceptEvent = {
      id: 'test-id',
      timestamp: Date.now(),
      channel: 'example',
      purchaseType: 'cheer',
      rawPrice: '$1.00',
      priceWithTax: 1.07,
      outcome: 'streaming',
    };
    expect(event.outcome).toBe('streaming');
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npm test -- types.test.ts`

Expected: The new test passes. Existing tests continue to pass.

- [ ] **Step 4: Commit**

```bash
git add tests/shared/types.test.ts
git commit -m "test: InterceptEvent accepts 'streaming' outcome"
```

---

## Task 9: Manual test pass in-browser

This task has no code changes — it is a gate that must be passed before version bump.

- [ ] **Step 1: Build the extension**

Attempt: `npm run build`

If the build fails, stop and tell the user to run it manually. Do not retry.

- [ ] **Step 2: Load `dist/` as an unpacked extension**

Load via `chrome://extensions` → "Load unpacked" → select `dist/`.

- [ ] **Step 3: Run through the test scenarios from the spec**

Execute each scenario from `docs/dev/superpowers/specs/2026-04-13-stream-override-fix-design.md` section "Testing Plan" and confirm expected behavior:

1. Override activates bypass on any channel — click button on someone else's channel, attempt a purchase, confirm no friction + event logged as `streaming`.
2. Override persists across reloads and channel changes — badge still visible, countdown still correct.
3. Override expires correctly — mock by setting `expiresAt` to a near-future timestamp via devtools, watch badge disappear.
4. Cancel override button works — badge disappears within one poll tick.
5. Auto-detect still works — own channel going live shows `🔴 HC paused — live on …` badge.
6. Grace period still works — after a simulated stream end, badge reads `⏳ HC paused — grace period (Xm)`.
7. History page shows streaming events with new label/color.
8. History summary stats (`Total Spent`, `Total Saved`, `Cancel Rate`) do not move for `streaming` events.

- [ ] **Step 4: If any scenario fails**

Do not proceed. Open a follow-up task with a clear repro, and either fix it or report back. A failing manual test is a blocker for the version bump.

- [ ] **Step 5: Commit (empty commit documenting manual test)**

Only if all scenarios pass:

```bash
git commit --allow-empty -m "test: manual in-browser test pass for streaming override fix"
```

---

## Task 10: Version bump, docs, open PR

**Files:**
- Modify: `manifest.json` (version field — currently `1.0.3`, bump to `1.0.4`)
- Modify: `package.json` (version field — currently `1.0.3`, bump to `1.0.4`)
- Modify: `docs/dev/HypeControl-TODO.md` — mark issue #32 fix complete, update `Current Version` and `Updated` header fields
- Modify: `docs/dev/HC-Project-Document.md` — update streaming mode / override section to reflect the fix if the doc currently claims these are "future" or "broken"

- [ ] **Step 1: Bump versions in both files**

Change `"version": "1.0.3"` to `"version": "1.0.4"` in both `manifest.json` and `package.json`.

- [ ] **Step 2: Rebuild**

Attempt: `npm run build`

If the build fails, stop and tell the user to run it manually — do not retry.

- [ ] **Step 3: Update docs**

In `docs/dev/HypeControl-TODO.md`:
- Set `Current Version: 1.0.4` in the header.
- Set `Updated: 2026-04-13` in the header.
- Add/mark a bullet for issue #32 as `[x]`.
- Update the footer timestamp.

In `docs/dev/HC-Project-Document.md`:
- If the doc has a streaming mode / override section that describes the feature as broken or aspirational, update it to reflect the now-working state. Otherwise no edit is needed.

- [ ] **Step 4: Commit**

```bash
git add manifest.json package.json docs/dev/HypeControl-TODO.md docs/dev/HC-Project-Document.md
git commit -m "fix: stream override actually disables friction (#32)

Resolves the storage-location mismatch between popup (writes
streamingOverride to chrome.storage.sync) and streamingMode.ts (was
reading a never-written manualOverrideUntil key from
chrome.storage.local). Override now short-circuits shouldBypassFriction
globally — works on any channel, regardless of streaming mode config.

Every intercepted purchase during bypass (manual override or
auto-detect live / grace period) is now recorded via writeInterceptEvent
with outcome: 'streaming' and counted in the spending tracker, so users
can review post-override spending in the history page.

Replaces the per-purchase toast with a persistent status badge that
shows the reason (override / live / grace) and a live countdown for
manual override. Badge polls every 30s so the countdown stays current
even when the user isn't on their own channel."
```

- [ ] **Step 5: Push branch and open PR**

```bash
git push -u origin fix/stream-override-bug-32
gh pr create --title "fix: stream override actually disables friction (#32)" --body "$(cat <<'EOF'
## Summary

- Wire popup's Stream Override button to actually bypass friction (it was reading from the wrong storage location).
- Log every intercepted purchase during bypass as `outcome: 'streaming'` so users can review spending after the fact.
- Replace per-purchase toast with a persistent status badge showing live countdown / live-on-channel / grace-period state.

Closes #32.

## Test plan

- [ ] Stream Override button on a non-own channel skips friction and logs the attempt as `streaming`.
- [ ] Badge persists across page reloads and channel navigation with correct remaining time.
- [ ] Cancel Override removes the badge and restores friction within one poll tick.
- [ ] Auto-detect live / grace period still drive the badge on own channel.
- [ ] History page shows streaming events with distinct label and filter button.
- [ ] `Total Spent` / `Total Saved` / `Cancel Rate` in history summary are unaffected by streaming events.
EOF
)"
```

- [ ] **Step 6: Stop**

Per the global git-workflow rule in `CLAUDE.md`: "Always open the PR and stop." Report the PR URL and wait for user approval before merging. Do not run `gh pr merge`.

---

## Self-Review Results

1. **Spec coverage** — every section of the spec has a task:
   - `types.ts` outcome union → Task 1
   - `streamingMode.ts` override short-circuit + dead field removal → Task 2
   - `interceptor.ts` bypass logging → Task 3
   - Toast removal → Task 4
   - Persistent badge (function + poll) → Tasks 5, 6
   - Badge styles → Task 5
   - `history.ts`/`html`/`css` streaming row rendering + filter → Task 7
   - Stats semantics verified unchanged → Task 7 Step 2
   - Version bump + docs → Task 10
   - Manual test gate → Task 9

2. **Placeholder scan** — no TBDs or "add appropriate error handling"-style placeholders. Every code step shows the code.

3. **Type consistency** — `updateStreamingBadge`, `computeBadgeReason`, `shouldBypassFriction`, `InterceptEvent.outcome` are referenced consistently across tasks with matching signatures.

4. **One note corrected inline:** current `package.json` is already at `1.0.3`, not `1.0.2` (the spec said "bump to 1.0.3" based on the issue reporter's version). Task 10 correctly bumps to `1.0.4`.
