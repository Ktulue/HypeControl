# Sub Tier Dropdown Re-Trigger — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Do NOT bump versions mid-plan.** Only Task 7 touches version numbers. Subagents working on earlier tasks must leave `manifest.json`, `manifest.firefox.json`, and `package.json` alone.

**Goal:** Fix [#48](https://github.com/Ktulue/HypeControl/issues/48) — stop the Sub Tier dropdown (1mo / 3mo / 6mo) from re-triggering the friction overlay after the user has already passed friction once on Twitch's sub modal.

**Architecture:** Pure detector-rule change. Add a single short-circuit block in `isPurchaseButton()` (`src/content/detector.ts`) that returns `false` early when the click target is or sits inside a standard ARIA form-control (`<select>`, `<option>`, `[role="option"]`, `[role="combobox"]`, `[role="listbox"]`, `[role="radio"]`, `[role="radiogroup"]`, `[role="menuitem"]`, `[role="menuitemradio"]`). The block lives between the existing chat-callout exclusion and the IGNORE_LABELS check — same shape as the chat-callout short-circuit. No new files, no new settings, no UI changes.

**Tech Stack:** TypeScript, webpack, Chrome MV3, Firefox MV3, Jest + jsdom for unit tests on `isPurchaseButton`, manual in-browser verification for the live-DOM behaviour.

**Spec:** `docs/dev/superpowers/specs/2026-04-28-sub-tier-dropdown-retrigger-design.md`

**Branch:** `fix/sub-tier-dropdown-retrigger` (already created — spec already committed at `91e202c`)

---

## File Structure

**Modify:**
- `src/content/detector.ts` — add the form-control short-circuit inside `isPurchaseButton()` between the chat-callout exclusion (line ~377) and the IGNORE_LABELS check (line ~380)
- `tests/content/detector.test.ts` — add a new `describe` block with regression tests for the form-control exclusion AND a regression-guard test that the existing dollar-amount-in-dialog rule still fires for plain (non-form-control) buttons
- `manifest.json` + `manifest.firefox.json` + `package.json` — version bump 1.1.1 → 1.1.2 (Task 7 only)
- `docs/dev/HypeControl-TODO.md` — log the fix
- `CHANGELOG.md` + `docs/release-notes/v1.1.2.md` — written by `npm run release`, edited by hand

No new files.

---

## Task 1: Write failing unit tests for the form-control exclusion

The fix is small but well-suited to TDD because `isPurchaseButton` already has Jest + jsdom coverage at `tests/content/detector.test.ts`. We add the failing tests first, watch them fail, then add the implementation, then watch them pass. This proves both that the fix works and that the existing dollar-amount-in-dialog rule (which gift-sub quantity buttons depend on) still fires.

**Files:**
- Modify: `tests/content/detector.test.ts` — append a new `describe` block at the bottom

- [ ] **Step 1: Append the new test block to `tests/content/detector.test.ts`**

The existing file is 177 lines and ends at line 177 with a closing `});` for the prior `describe`. Append the block below at the end of the file (after line 177, with one blank line of separation).

The block contains seven tests. The first six exercise the new exclusion across the full role/tag matrix. The seventh is a **regression guard** that pins the existing gift-sub-quantity behaviour — a plain `<button>` displaying `$4.99` inside a `[role="dialog"]` *with no form-control role* must still match.

```ts
describe('isPurchaseButton — form-control exclusion (#48)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('does not intercept a click on a [role="option"] tier picker option inside a sub modal', () => {
    // Reproduces #48: Twitch's sub-tier picker renders options as buttons
    // whose visible text is just a price (e.g. "$4.99"), inside a
    // [role="dialog"]. Without the form-control short-circuit, the
    // dollar-amount-in-dialog heuristic would match.
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');

    const listbox = document.createElement('div');
    listbox.setAttribute('role', 'listbox');

    const option = document.createElement('button');
    option.setAttribute('role', 'option');
    option.textContent = '$4.99';

    listbox.appendChild(option);
    dialog.appendChild(listbox);
    document.body.appendChild(dialog);

    expect(isPurchaseButton(option)).toBe(false);
  });

  test('does not intercept a click on a child span inside a [role="option"] (closest() path)', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');

    const option = document.createElement('button');
    option.setAttribute('role', 'option');

    const inner = document.createElement('span');
    inner.textContent = '$13.49';
    option.appendChild(inner);

    dialog.appendChild(option);
    document.body.appendChild(dialog);

    expect(isPurchaseButton(inner)).toBe(false);
  });

  test('does not intercept a [role="combobox"] trigger button (the dropdown control itself)', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');

    const combobox = document.createElement('button');
    combobox.setAttribute('role', 'combobox');
    combobox.textContent = '$4.99';

    dialog.appendChild(combobox);
    document.body.appendChild(dialog);

    expect(isPurchaseButton(combobox)).toBe(false);
  });

  test('does not intercept a [role="radio"] tier option inside a [role="radiogroup"]', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');

    const group = document.createElement('div');
    group.setAttribute('role', 'radiogroup');

    const radio = document.createElement('button');
    radio.setAttribute('role', 'radio');
    radio.textContent = '$24.99';

    group.appendChild(radio);
    dialog.appendChild(group);
    document.body.appendChild(dialog);

    expect(isPurchaseButton(radio)).toBe(false);
  });

  test('does not intercept a native <option> inside a <select>', () => {
    const select = document.createElement('select');
    const option = document.createElement('option');
    option.textContent = '$4.99';
    select.appendChild(option);
    document.body.appendChild(select);

    expect(isPurchaseButton(option)).toBe(false);
  });

  test('does not intercept a [role="menuitem"] price option', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');

    const menuitem = document.createElement('button');
    menuitem.setAttribute('role', 'menuitem');
    menuitem.textContent = '$4.99';

    dialog.appendChild(menuitem);
    document.body.appendChild(dialog);

    expect(isPurchaseButton(menuitem)).toBe(false);
  });

  test('regression guard: still intercepts a plain $X.XX button inside a [role="dialog"] (gift-sub quantity picker — #48 must not break this)', () => {
    // Mirrors the existing test at the bottom of the chat-callout describe.
    // If this fails, the form-control exclusion is too broad and gift-sub
    // detection is regressed.
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');

    const button = document.createElement('button');
    button.textContent = '$4.99';

    dialog.appendChild(button);
    document.body.appendChild(dialog);

    expect(isPurchaseButton(button)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run: `npm test -- --testPathPattern=detector`

Expected output: the existing tests pass, but the six new exclusion tests **fail** (the regression guard at the bottom passes — that behaviour already works). Failure messages will look like `Expected: false, Received: true` for the option/combobox/radio/menuitem cases. This proves we are testing real new behaviour and not a no-op.

If any of the six exclusion tests pass before implementation, the test setup is wrong — re-read the test and confirm the role/tag really exists in the DOM you built.

If the regression guard fails, do **not** continue — something else is already broken in the detector. Stop and investigate.

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/content/detector.test.ts
git commit -m "test(detector): failing tests for form-control exclusion (#48)"
```

---

## Task 2: Implement the form-control short-circuit

Add the new exclusion block to `isPurchaseButton()`. Placement matters — it must run after the chat-callout short-circuit (so chat-callout exclusion wins for borderline cases) and before the IGNORE_LABELS / dollar-amount checks (so it short-circuits before any matching heuristic fires).

**Files:**
- Modify: `src/content/detector.ts` — insert ~12 lines after line 377

- [ ] **Step 1: Open `src/content/detector.ts` and locate the insertion point**

The file already has the chat-callout exclusion at lines 371-377:

```ts
  // Chat-callout surfaces (resub share, gifted-sub thanks, paid pins, community highlights)
  // are never purchase buttons. Short-circuit before any match heuristics run (#44).
  const callout = isInsideChatCallout(element);
  if (callout.matched) {
    debug('isPurchaseButton: IGNORED (chat-callout)', { ...elementInfo, calloutDataTarget: callout.dataTarget });
    return false;
  }
```

Followed immediately by the IGNORE_LABELS check at line 379:

```ts
  // Check if this is a button we should NEVER intercept (Close, Cancel, etc.)
  const isIgnoredLabel = IGNORE_LABELS.some(ignored => labelText === ignored || labelText.startsWith(ignored + ' '));
```

The new block goes **between** these two — after the closing `}` of the callout `if`, with one blank line on each side.

- [ ] **Step 2: Insert the form-control short-circuit**

Add the following block immediately after the chat-callout exclusion's closing `}` (i.e. after line 377), separated by one blank line above and below:

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

After insertion, the surrounding code should read:

```ts
  const callout = isInsideChatCallout(element);
  if (callout.matched) {
    debug('isPurchaseButton: IGNORED (chat-callout)', { ...elementInfo, calloutDataTarget: callout.dataTarget });
    return false;
  }

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

  // Check if this is a button we should NEVER intercept (Close, Cancel, etc.)
  const isIgnoredLabel = IGNORE_LABELS.some(ignored => labelText === ignored || labelText.startsWith(ignored + ' '));
```

- [ ] **Step 3: Run the detector tests and verify all pass**

Run: `npm test -- --testPathPattern=detector`

Expected: every test passes — the six exclusion tests added in Task 1 now pass, AND every existing test (including the regression guard and all the chat-callout / gift / dollar-amount tests) still passes.

If the regression guard at the bottom of the new block fails, the form-control exclusion is too broad — re-check that the test's plain `<button>` truly has no `role` attribute set to `option`/`combobox`/etc.

- [ ] **Step 4: Commit the implementation**

```bash
git add src/content/detector.ts
git commit -m "fix(detector): short-circuit on form-control roles to stop tier-picker re-trigger (#48)"
```

---

## Task 3: Run the full Jest suite

Belt-and-suspenders. The detector change is small but `isPurchaseButton` is exercised indirectly by other tests too. Confirm nothing broke.

**Files:** none.

- [ ] **Step 1: Run the full suite**

Run: `npm test`

Expected: all suites pass — `detector`, `pendingState`, `channels`, `friction`, `escalation`, `spendingTracker`, `types`. No new failures, no flaky output.

If anything fails, stop. Investigate the failure and only continue once green.

---

## Task 4: Manual verification on live Twitch

The unit tests prove the rule works against synthetic DOM. This task confirms the rule actually fires against Twitch's real markup. There is no automated path to substitute for this — Twitch's modal DOM cannot be reproduced faithfully in jsdom.

**Files:** none.

**Prerequisites:**
- Local dev build of the extension loaded into Chrome (and Firefox if convenient).
- A Twitch account with a payment method on file (you do not need to actually complete a purchase — cancel before the final confirm).
- A streamer you can subscribe to (any partner/affiliate works; pick a small streamer where you don't mind opening the sub modal).

- [ ] **Step 1: Build the extension**

Run: `npm run build`

This produces the Chrome bundle at `dist/`.

If you also want to test Firefox: `npm run build:firefox` (produces `dist-firefox/`).

- [ ] **Step 2: Reload the extension in Chrome**

Open `chrome://extensions`, find HypeControl, click the reload icon. Confirm the version still reads 1.1.1 (we have not bumped yet).

- [ ] **Step 3: Open the extension log viewer in a separate tab**

Right-click the HypeControl toolbar icon → "View logs" (or open `chrome-extension://<your-id>/logs.html` directly). Keep this tab visible alongside Twitch — you'll watch debug entries land in real time.

- [ ] **Step 4: Test the bug fix**

1. Navigate to a streamer's channel page on `twitch.tv`.
2. Click **Subscribe**. The friction overlay should appear.
3. Click **Proceed** through the friction flow (not Cancel).
4. Twitch's sub modal opens with the payment screen and the tier dropdown.
5. **Switch the tier dropdown.** Change from 1 month to 3 months, or 3 to 6 months.
6. **Expected:** no friction overlay appears. The price updates as expected.
7. Switch the dropdown one more time to be sure.

In the log viewer tab, expect at least one entry per dropdown click:

```
[debug] isPurchaseButton: IGNORED (form-control) {tagName: "...", labelText: "...", ...}
```

If those entries appear and no overlay fires → the fix works.

If no `IGNORED (form-control)` entries appear AND the overlay re-fires → the conservative role list missed Twitch's actual markup. **Stop here and pivot to Step 4a below.**

- [ ] **Step 4a (only if Step 4 fails): inspect Twitch's tier-picker DOM**

Right-click the tier dropdown trigger button → Inspect. Note:
- The trigger button's `data-a-target`, `aria-*`, `role`, and tag name.
- The expanded dropdown's container `role` / `data-a-target`.
- Each option's tag, `role`, and `data-a-target`.

Add a more specific selector to the `FORM_CONTROL_SELECTOR` list. Likely candidates:
- `[data-a-target*="tier"]`
- `[data-a-target*="subscription-tier"]`
- A specific container ancestor selector

Re-run Task 1's tests (they should still pass — adding selectors only adds exclusions). Re-run Task 4 from Step 1.

Loop until Step 4 succeeds.

- [ ] **Step 5: Verify the actual confirm button still fires friction**

Continuing from Step 4:

1. After switching the tier (e.g. to 3 months at $13.49), click the actual final **"Subscribe with $13.49"** confirm button.
2. **Expected:** the friction overlay appears. The price has changed; the user is committing to a new amount; friction is correct here per Option B's intentional behaviour.
3. Click **Cancel** on the friction overlay (do not actually buy).

If the confirm button does *not* fire friction, the form-control exclusion is incorrectly catching the confirm button itself — investigate. Likely the confirm button is wrapped in a `[role="..."]` container we excluded.

- [ ] **Step 6: Regression check — gift sub modal**

1. Navigate to any channel page.
2. Open the gift-sub modal (the "Gift Sub" button).
3. Click any quantity tile (e.g. "$4.99 — Gift 1 Sub" or the multi-tile variants).
4. **Expected:** friction overlay appears as before. Gift quantity buttons match via `dataTarget.includes('gift')` on the parent button, not via the form-control rule, so they should be unaffected.

Cancel the friction overlay; do not buy.

- [ ] **Step 7: Regression check — Bits**

1. Click the "Get Bits" button in the top nav.
2. Click any bit-bundle tile (e.g. "100 Bits — $1.40").
3. **Expected:** friction overlay appears as before. Bits purchase buttons match via `dataTarget.startsWith('bits-purchase-button')`.

Cancel; do not buy.

- [ ] **Step 8: Regression check — One-tap-store / combos (optional, skip if no channel has it active)**

If a streamer you watch has a one-tap store visible:

1. Click any combo tile.
2. **Expected:** friction overlay appears as before.

Cancel; do not buy.

- [ ] **Step 9 (optional): Repeat key tests on Firefox**

The original report came in on Firefox/Zen. Twitch ships the same DOM cross-browser, so Chrome alone is acceptable, but if Firefox is conveniently available, repeat Steps 4 and 5 there to remove ambiguity. Use `npm run build:firefox` and load `dist-firefox/` via `about:debugging`.

- [ ] **Step 10: Note manual test results**

Capture pass/fail for each of Steps 4, 5, 6, 7, and (if run) 8 and 9 in your notes — you'll paste these into the PR description in Task 8.

---

## Task 5: Update project docs

Per `CLAUDE.md`'s "Post-Work Updates" rule, the TODO file gets updated after every fix. The HC-Project-Document only updates if a feature's status changed; for a bug fix, it does not.

**Files:**
- Modify: `docs/dev/HypeControl-TODO.md`

- [ ] **Step 1: Open `docs/dev/HypeControl-TODO.md` and find the most recent fix log**

The file's pattern (per recent commits — see `aa1652d docs: log #49 paste-bypass fix in HypeControl-TODO`) is to add a short bullet under the relevant section, marked `[x]`, with the issue number, date, and version target.

- [ ] **Step 2: Add the entry**

Add a one-line entry near the existing #49 entry, in the same section. Match the prevailing style. A reasonable line:

```markdown
- [x] **#48 Sub tier dropdown re-trigger** (2026-04-28, v1.1.2) — Form-control short-circuit in `isPurchaseButton` so tier-picker / combobox / radio clicks no longer fire friction inside the sub modal payment screen.
```

Update the file header's `Updated` date and `Current Version` field to `2026-04-28` and `1.1.2` respectively. Update the footer timestamp.

- [ ] **Step 3: Commit the docs change**

```bash
git add docs/dev/HypeControl-TODO.md
git commit -m "docs: log #48 sub-tier dropdown fix in HypeControl-TODO"
```

---

## Task 6: Run security review

Per the project's stored feedback rule (`feedback_security_review_before_pr.md`): **always run `/security-review` on the branch before opening the PR**. This is non-negotiable, even for a small detector-rule change.

**Files:** none modified by this task; any findings get fixed in follow-up commits on the same branch.

- [ ] **Step 1: Invoke `/security-review`**

In the Claude Code session, run the `/security-review` command. It will analyze the diff against `main` and report any findings.

- [ ] **Step 2: Triage findings**

For each finding:
- **High/Medium severity related to the diff:** fix on this branch before continuing.
- **Pre-existing issues unrelated to this fix:** note them, don't fix here.
- **False positives:** acknowledge in plan notes, no action.

The expected outcome for this fix is "no findings" — we are only adding an early-return path that returns `false` more often, which strictly *reduces* attack surface (fewer matches → fewer overlay fires → fewer DOM operations on user-controlled input). If the review surfaces something unexpected, investigate.

- [ ] **Step 3: Commit any fixes**

If fixes were needed, commit them with messages like `fix(security): <specific issue>`. If no fixes (expected), skip.

---

## Task 7: Version bump and release artifacts

This is the only task that touches version numbers. It uses the project's `npm run release` script per `docs/dev/RELEASE-PROCESS.md` — never bump manifests by hand.

**Files (touched by the script, not directly):**
- Modify: `manifest.json`, `manifest.firefox.json`, `package.json` — patch bump 1.1.1 → 1.1.2
- Modify (script-generated): `CHANGELOG.md`, `docs/release-notes/v1.1.2.md`

- [ ] **Step 1: Run the release script**

Run: `npm run release`

The script will:
1. Lockstep-bump all three version files from 1.1.1 to 1.1.2
2. Scaffold a CHANGELOG entry
3. Scaffold a release-notes file at `docs/release-notes/v1.1.2.md`
4. Pause so you can edit the scaffolded notes

If the script aborts due to drift between the three version files, fix manually so all three read 1.1.1, then re-run. Do not allow drift.

- [ ] **Step 2: Edit the release notes**

Open `docs/release-notes/v1.1.2.md`. Add user-facing copy along these lines (adjust to match the project's release-note voice — see `docs/release-notes/v1.1.1.md` for tone):

> **#48 — Stopped the sub tier dropdown from re-triggering friction.** Once you've passed the friction check on a sub, switching tiers in the payment screen is silent. The actual confirm button still fires friction if you change the price — that's intentional, since you're committing to a different amount.

Save.

- [ ] **Step 3: Continue the release script**

Run: `npm run release -- --continue`

The script will run `npm run build` and `npm run build:firefox` back to back. **If either build fails, the script aborts. Do not retry — ask the user to run the failing build manually in their own terminal** (per CLAUDE.md). If both succeed, the script produces the dual-platform bundles.

- [ ] **Step 4: Commit the release artifacts**

Check `git status` first to see exactly which files the release script wrote, then:

```bash
git add manifest.json manifest.firefox.json package.json CHANGELOG.md docs/release-notes/v1.1.2.md
git commit -m "maint: cut v1.1.2 — sub-tier dropdown re-trigger fix (#48)"
```

(Adjust the file list if `npm run release` writes additional bookkeeping files — `git status` is the source of truth.)

---

## Task 8: Open the PR (do not merge)

Per the user's global git workflow (CLAUDE.md): **always open the PR and stop. Never run `gh pr merge` without explicit user approval.** This applies even though this plan lists a release commit — the merge decision is the user's, separate step, separate go-ahead.

**Files:** none modified.

- [ ] **Step 1: Push the branch**

Run: `git push -u origin fix/sub-tier-dropdown-retrigger`

Expected: branch published, PR-create URL printed.

- [ ] **Step 2: Open the PR**

Run:

```bash
gh pr create --title "fix: stop sub tier dropdown from re-triggering friction (#48)" --body "$(cat <<'EOF'
## Summary

- Closes #48 — Sub tier dropdown re-triggers hype-control after passing friction
- Adds a form-control short-circuit in `isPurchaseButton` so clicks on `<select>`, `<option>`, `[role="option"]`, `[role="combobox"]`, `[role="listbox"]`, `[role="radio"]`, `[role="radiogroup"]`, `[role="menuitem"]`, and `[role="menuitemradio"]` (or anything inside them) never fire friction
- Tier-picker clicks now silent; the actual final confirm button still fires friction if the price changed (intentional)
- Six new unit tests cover the new exclusion; one regression-guard test pins the existing gift-sub quantity-button behaviour
- Patch bump: 1.1.1 → 1.1.2

## Test plan

- [x] Sub modal: switching tier dropdown after passing friction is silent
- [x] Sub modal: clicking final "Subscribe with $X.XX" still fires friction at the new price
- [x] Gift-sub modal: quantity tiles still fire friction
- [x] Get Bits modal: bit-bundle tiles still fire friction
- [x] One-tap-store combos still fire friction (if observed)
- [x] All Jest suites pass (`npm test`)
- [x] Extension log viewer shows `isPurchaseButton: IGNORED (form-control)` debug entries on each dropdown click
EOF
)"
```

The PR description deliberately omits any robot/AI emoji per the project's stored "no robot emoji in PRs" feedback rule.

- [ ] **Step 3: Stop**

Print the PR URL to the user. Say: "PR #N is open — ready to merge when you give the word." Do **not** run `gh pr merge`. Wait for the user.

---

## Self-Review (run after writing the plan)

This section is a checklist for the plan-writer (you) to run before handoff.

**Spec coverage:**

| Spec section | Covered by |
|---|---|
| Problem (tier-picker re-trigger on sub modal) | Task 4 (manual repro), Task 1 (synthetic test) |
| Root cause (`isPurchaseButton` dollar-in-dialog over-broad match) | Task 2 (the fix lives next to that rule) |
| Mental model (friction follows commit, not config) | Task 4 Step 5 (confirm button still fires), Task 1 (option/combobox/etc. don't fire) |
| Detector tightening only — no firing-logic change | Task 2 (only edits `detector.ts`) |
| ARIA-role-based, not label-based | Task 1 + Task 2 (selector list is roles + tags, no labels) |
| Conservative — standard form-control roles only | Task 1's selector set is exactly the spec's set |
| No new settings / storage / migrations | No task touches `types.ts`, `DEFAULT_SETTINGS`, storage |
| No telemetry counter | Only a `debug()` log entry, matching chat-callout precedent |
| Re-firing at new price after tier change is intentional | Task 4 Step 5 explicitly verifies this |
| Detector.ts edit at the specified location | Task 2 Step 1 + Step 2 specify the exact insertion site |
| Testing plan steps 1-9 | Task 4 (Steps 1-9 of that task map 1:1 to the spec's steps 1-9) |
| Version bump 1.1.1 → 1.1.2 via `npm run release` | Task 7 |
| Follow-up: if conservative selector misses, add specific selector | Task 4 Step 4a |

All sections covered.

**Placeholder scan:** No "TBD", "TODO", or vague handwaving. Every code block is complete. The release-notes copy is suggested, not "fill in here".

**Type consistency:** No new types introduced; the existing `isPurchaseButton(element: HTMLElement | null): boolean` signature is unchanged. The `FORM_CONTROL_SELECTOR` constant is local to the function and consistent across the test file (Task 1) and the implementation (Task 2).

**Ambiguity check:** The selector list is identical between Task 1 (used as the basis for what the tests assume will fail) and Task 2 (the actual implementation). Insertion location in Task 2 is pinned by quoting the surrounding code — not by line number, which can drift. Task 4 Step 4a explicitly handles the "tests pass but live DOM differs" path so the engineer is not stuck.

No re-review needed. Plan is ready.
