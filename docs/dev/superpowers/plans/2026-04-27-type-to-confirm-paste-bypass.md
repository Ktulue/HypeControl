# Type-to-Confirm Paste Bypass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Do NOT bump versions mid-plan.** Only the final task touches version numbers. Subagents working on earlier tasks must leave `manifest.json`, `manifest.firefox.json`, and `package.json` alone.

**Goal:** Fix [#49](https://github.com/Ktulue/HypeControl/issues/49) — close the copy/paste bypass on the type-to-confirm friction step. Block paste, drop, and `beforeinput` paste-flavored events on the input; make the displayed phrase unselectable; flash a Newman-flavored callout when a cheat attempt is caught.

**Architecture:** Pure UI/event hardening inside `showTypeToConfirmStep()`. One CSS change closes the drag-the-prompt vector; three event listeners route through a single `triggerCheatCallout()` helper that clears the input, re-disables Confirm, and flashes a randomized line from a fixed copy pool via `textContent`. No new settings, types, storage, or migrations.

**Tech Stack:** TypeScript, webpack, Chrome MV3, Firefox MV3, no test framework for content scripts — verify in-browser per the spec's manual test plan.

**Spec:** `docs/dev/superpowers/specs/2026-04-27-type-to-confirm-paste-bypass-design.md`

**Branch:** `fix/type-to-confirm-paste-bypass` (already created — spec already committed)

---

## File Structure

**Modify:**
- `src/content/styles.css` — flip `.hc-confirm-phrase` to `user-select: none`; add `.hc-cheat-callout` styles
- `src/content/interceptor.ts` — add cheat-callout pool + picker; modify the rendered HTML inside `showTypeToConfirmStep()`; wire paste/drop/beforeinput listeners; hide callout on legitimate input
- `manifest.json` + `manifest.firefox.json` + `package.json` — version bump (final task only)
- `docs/dev/HypeControl-TODO.md` — mark issue #49 fix completed
- `docs/dev/HC-Project-Document.md` — update friction-overlay section if status text changed

No new files.

---

## Task 1: Make displayed phrase unselectable (CSS)

This task lands first because it's a one-line change that closes the drag-the-prompt bypass entirely. Even if everything else stalled, this would be a partial fix on its own.

**Files:**
- Modify: `src/content/styles.css:718-730` (the `.hc-confirm-phrase` rule)

- [ ] **Step 1: Flip `user-select` from `all` to `none` and add the WebKit prefix**

In `src/content/styles.css`, locate the `.hc-confirm-phrase` rule (around line 718). Change the last property line and add a sibling property:

Before:
```css
.hc-confirm-phrase {
  display: inline-block;
  font-family: var(--hc-font);
  font-size: 16px;
  font-weight: 700;
  color: var(--hc-primary-text);
  background: rgba(var(--hc-primary-rgb), 0.12);
  border: 1px solid rgba(var(--hc-primary-rgb), 0.3);
  border-radius: 4px;
  padding: 6px 14px;
  margin: 12px 0 16px;
  user-select: all;
}
```

After:
```css
.hc-confirm-phrase {
  display: inline-block;
  font-family: var(--hc-font);
  font-size: 16px;
  font-weight: 700;
  color: var(--hc-primary-text);
  background: rgba(var(--hc-primary-rgb), 0.12);
  border: 1px solid rgba(var(--hc-primary-rgb), 0.3);
  border-radius: 4px;
  padding: 6px 14px;
  margin: 12px 0 16px;
  user-select: none;
  -webkit-user-select: none;
}
```

- [ ] **Step 2: Verify the change builds**

Run: `npm run build`

Expected: webpack completes with no errors. The CSS bundle in `dist/` reflects the change. (You don't need to load the extension yet — Task 7 covers manual verification.)

- [ ] **Step 3: Commit**

```bash
git add src/content/styles.css
git commit -m "fix(ui): make type-to-confirm phrase unselectable (#49)"
```

---

## Task 2: Add `.hc-cheat-callout` styles

**Files:**
- Modify: `src/content/styles.css` (insert a new rule directly after `.hc-confirm-input::placeholder` at ~line 754)

- [ ] **Step 1: Append the new rule**

In `src/content/styles.css`, immediately after the `.hc-confirm-input::placeholder` block (which ends around line 754), insert:

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

This rule sits between the type-to-confirm inputs and the math-challenge styles. The `--hc-font` and `--hc-danger` tokens already exist in the project's CSS variables (used elsewhere in the same file).

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: clean compile.

- [ ] **Step 3: Commit**

```bash
git add src/content/styles.css
git commit -m "fix(ui): add cheat-callout style for type-to-confirm (#49)"
```

---

## Task 3: Add the cheat-callout copy pool and picker

**Files:**
- Modify: `src/content/interceptor.ts` (just below `TYPE_TO_CONFIRM_PHRASE` at line 1106)

- [ ] **Step 1: Insert the constants**

In `src/content/interceptor.ts`, find this line (around line 1106):

```typescript
const TYPE_TO_CONFIRM_PHRASE = 'I want to buy this';
```

Immediately after it, add:

```typescript
const CHEAT_CALLOUT_LINES: readonly string[] = [
  "Ah ah ah. You didn't type the magic phrase.",
  "Ah ah ah — pasting isn't typing.",
  'The friction is the feature. Hands on keyboard.',
  'Nice try. Hands on keyboard.',
];

function pickCheatLine(): string {
  return CHEAT_CALLOUT_LINES[Math.floor(Math.random() * CHEAT_CALLOUT_LINES.length)];
}
```

Note the mixed quote styles: lines containing apostrophes (`didn't`, `isn't`) use double quotes to avoid escaping; the others use single quotes to match the rest of the file.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: no new errors. The constants are declared but not yet referenced — TS treats unused module-scoped consts as valid.

- [ ] **Step 3: Commit**

```bash
git add src/content/interceptor.ts
git commit -m "fix(interceptor): add cheat-callout copy pool and picker (#49)"
```

---

## Task 4: Update the rendered HTML inside `showTypeToConfirmStep()`

This task hardens the input element against autofill/password-manager fills and adds the callout DOM node. The listeners come in Task 5.

**Files:**
- Modify: `src/content/interceptor.ts:1116-1141` (the template literal in `showTypeToConfirmStep`)

- [ ] **Step 1: Replace the rendered HTML**

In `src/content/interceptor.ts`, find the `overlay.innerHTML = ...` block at the start of `showTypeToConfirmStep` (around line 1116). The current block looks like:

```typescript
  overlay.innerHTML = `
    <div class="hc-modal">
      <div class="hc-header">
        <span class="hc-icon">⌨️</span>
        <h2 class="hc-title" id="hc-overlay-heading">Type to confirm</h2>
      </div>
      <div class="hc-content" id="hc-overlay-desc" style="text-align: center;">
        <p class="hc-message">To proceed, type the following phrase exactly:</p>
        <p class="hc-confirm-phrase">${TYPE_TO_CONFIRM_PHRASE}</p>
        <input
          type="text"
          class="hc-confirm-input"
          id="hc-confirm-input"
          placeholder="Type the phrase above..."
          autocomplete="off"
          spellcheck="false"
        />
      </div>
      <div class="hc-actions">
        <button class="hc-btn hc-btn-cancel" data-action="cancel">Cancel</button>
        <button class="hc-btn hc-btn-proceed" data-action="proceed" disabled aria-disabled="true" style="opacity: 0.4; cursor: not-allowed;">
          Confirm
        </button>
      </div>
    </div>
  `;
```

Replace it with:

```typescript
  overlay.innerHTML = `
    <div class="hc-modal">
      <div class="hc-header">
        <span class="hc-icon">⌨️</span>
        <h2 class="hc-title" id="hc-overlay-heading">Type to confirm</h2>
      </div>
      <div class="hc-content" id="hc-overlay-desc" style="text-align: center;">
        <p class="hc-message">To proceed, type the following phrase exactly:</p>
        <p class="hc-confirm-phrase">${TYPE_TO_CONFIRM_PHRASE}</p>
        <input
          type="text"
          class="hc-confirm-input"
          id="hc-confirm-input"
          placeholder="Type the phrase above..."
          autocomplete="off"
          spellcheck="false"
          name="hc-no-autofill"
          data-1p-ignore
          data-lpignore="true"
        />
        <p class="hc-cheat-callout" id="hc-cheat-callout" role="alert" style="display: none;"></p>
      </div>
      <div class="hc-actions">
        <button class="hc-btn hc-btn-cancel" data-action="cancel">Cancel</button>
        <button class="hc-btn hc-btn-proceed" data-action="proceed" disabled aria-disabled="true" style="opacity: 0.4; cursor: not-allowed;">
          Confirm
        </button>
      </div>
    </div>
  `;
```

Three changes:
- Three new attributes on the `<input>`: `name="hc-no-autofill"`, `data-1p-ignore`, `data-lpignore="true"`. These tell 1Password / LastPass / Bitwarden to skip the field.
- One new element after the input: `<p class="hc-cheat-callout" id="hc-cheat-callout" role="alert" style="display: none;"></p>`. Empty `textContent` — the listeners populate it.
- The `${TYPE_TO_CONFIRM_PHRASE}` interpolation is unchanged. It's a hard-coded module constant, not user input — no XSS risk.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/content/interceptor.ts
git commit -m "fix(interceptor): add callout element and autofill-suppression attrs (#49)"
```

---

## Task 5: Wire paste/drop/beforeinput listeners and `triggerCheatCallout()`

This is the core behavior change. Three new event listeners route through one shared helper.

**Files:**
- Modify: `src/content/interceptor.ts:1145-1202` (the `Promise` body inside `showTypeToConfirmStep`)

- [ ] **Step 1: Add the `calloutEl` reference and `triggerCheatCallout()` helper**

Find the `return new Promise((resolve) => {` block inside `showTypeToConfirmStep` (around line 1145). After the existing `proceedBtn` lookup line and before the `finish` declaration, the structure becomes:

```typescript
  return new Promise((resolve) => {
    let resolved = false;
    const previousFocus = document.activeElement as HTMLElement | null;
    const inputEl = overlay.querySelector('#hc-confirm-input') as HTMLInputElement | null;
    const proceedBtn = overlay.querySelector('[data-action="proceed"]') as HTMLButtonElement | null;
    const calloutEl = overlay.querySelector('#hc-cheat-callout') as HTMLElement | null;

    const triggerCheatCallout = () => {
      if (!inputEl) return;
      inputEl.value = '';
      if (proceedBtn) {
        proceedBtn.disabled = true;
        proceedBtn.setAttribute('aria-disabled', 'true');
        proceedBtn.style.opacity = '0.4';
        proceedBtn.style.cursor = 'not-allowed';
      }
      if (calloutEl) {
        calloutEl.textContent = pickCheatLine();
        calloutEl.style.display = '';
      }
      inputEl.focus();
      log('Type-to-confirm: paste/drop bypass attempt blocked');
    };

    const finish = (decision: 'cancel' | 'proceed') => {
```

Three additions: the `calloutEl` lookup, the `triggerCheatCallout` helper, and an empty line before `finish`. Everything else in the block stays identical.

The helper uses `textContent` (not `innerHTML`) per the project's stored XSS feedback rule. The lines in the pool are static module constants, but the project's policy is "always `textContent` for dynamic strings" — follow it for consistency.

- [ ] **Step 2: Wire `paste` and `drop` listeners**

Below the existing `inputEl?.addEventListener('input', ...)` block (which currently handles match-checking around line 1160), add two new listeners. The diff is:

Before (current, around lines 1160-1168):
```typescript
    inputEl?.addEventListener('input', () => {
      const matches = (inputEl.value.trim().toLowerCase() === TYPE_TO_CONFIRM_PHRASE.toLowerCase());
      if (proceedBtn) {
        proceedBtn.disabled = !matches;
        proceedBtn.setAttribute('aria-disabled', String(!matches));
        proceedBtn.style.opacity = matches ? '' : '0.4';
        proceedBtn.style.cursor = matches ? '' : 'not-allowed';
      }
    });
```

After:
```typescript
    inputEl?.addEventListener('input', () => {
      if (calloutEl) calloutEl.style.display = 'none';
      const matches = (inputEl.value.trim().toLowerCase() === TYPE_TO_CONFIRM_PHRASE.toLowerCase());
      if (proceedBtn) {
        proceedBtn.disabled = !matches;
        proceedBtn.setAttribute('aria-disabled', String(!matches));
        proceedBtn.style.opacity = matches ? '' : '0.4';
        proceedBtn.style.cursor = matches ? '' : 'not-allowed';
      }
    });

    inputEl?.addEventListener('paste', (e) => {
      e.preventDefault();
      triggerCheatCallout();
    });

    inputEl?.addEventListener('drop', (e) => {
      e.preventDefault();
      triggerCheatCallout();
    });

    inputEl?.addEventListener('beforeinput', (e) => {
      const ev = e as InputEvent;
      if (
        ev.inputType === 'insertFromPaste' ||
        ev.inputType === 'insertFromDrop' ||
        ev.inputType === 'insertReplacementText'
      ) {
        e.preventDefault();
        triggerCheatCallout();
      }
    });
```

Two specific changes inside the `input` listener and three brand-new listeners:
1. The new `if (calloutEl) calloutEl.style.display = 'none';` line at the top of the existing `input` listener hides the callout on every legitimate keystroke.
2. The new `paste`, `drop`, and `beforeinput` listeners each call `e.preventDefault()` and route through `triggerCheatCallout()`.

The `beforeinput` listener filters by `inputType` so legitimate keystrokes (which have `inputType === 'insertText'`) pass through untouched. It catches `execCommand('insertText')`, drag-drop replacements, and exotic IME paste paths.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: no errors. `InputEvent` is a built-in DOM type; no import needed.

- [ ] **Step 4: Verify webpack build (Chrome target)**

Run: `npm run build`

Expected: clean compile, `dist/` rebuilt.

- [ ] **Step 5: Verify webpack build (Firefox target)**

Run: `npm run build:firefox`

Expected: clean compile. The Firefox build path is mandatory because the issue reporter is on Zen/Firefox; we must not regress that target.

- [ ] **Step 6: Commit**

```bash
git add src/content/interceptor.ts
git commit -m "fix(interceptor): block paste/drop/beforeinput on type-to-confirm (#49)"
```

---

## Task 6: Run Jest suite (regression check)

The fix doesn't add tests, but the existing Jest suite must still pass — `interceptor.ts` is imported transitively by some shared modules' test paths via type imports.

**Files:** none modified.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: all suites pass. If anything breaks, the failure is unrelated to this fix (no production code in the test paths was touched) — investigate before proceeding.

---

## Task 7: Manual verification in-browser

Follow the spec's 11-point testing plan. This is the primary verification — there are no automated tests for content-script overlay behavior in this project.

**Files:** none modified.

- [ ] **Step 1: Load the unpacked extension (Chrome)**

In Chrome: `chrome://extensions` → Developer Mode on → "Load unpacked" → select the `dist/` folder. Reload the extension if it was already loaded.

- [ ] **Step 2: Trigger a friction overlay that includes the type-to-confirm step**

Configure friction in the extension popup so the type-to-confirm step appears (e.g., set friction intensity to whatever level includes the typing step in the project's current friction ladder — refer to `src/content/interceptor.ts` step ordering if unsure). On Twitch, attempt a Bits cheer or sub gift to trigger the overlay. Click through any preceding steps until the type-to-confirm step is shown.

- [ ] **Step 3: Walk the spec's 11-point manual test plan**

Open `docs/dev/superpowers/specs/2026-04-27-type-to-confirm-paste-bypass-design.md` and run each numbered test in the "Testing Plan" section:

1. Keyboard paste blocked
2. Right-click paste blocked
3. Drag-and-drop the prompt phrase blocked (CSS prevents selection)
4. Drag-and-drop external text blocked
5. `beforeinput` defense-in-depth (devtools `execCommand('insertText', false, ...)`)
6. Autofill / password manager
7. Legitimate typing still works
8. Callout hides on resumed typing
9. Rapid repeated paste attempts (callout text rotates)
10. Cancel still works
11. No regression in math challenge

For each item, confirm the expected result. If any test fails, fix before proceeding.

- [ ] **Step 4: Repeat in Firefox**

Build the Firefox bundle (`npm run build:firefox` already produced it), then load `dist/` via `about:debugging` → "This Firefox" → "Load Temporary Add-on" → select any file in `dist/`. Re-run the same 11-point plan in Firefox. The reporter's environment is Zen (Firefox-based), so a Firefox pass is non-negotiable.

- [ ] **Step 5: No commit needed**

Manual verification has no diff. Move on if all tests pass.

---

## Task 8: Update project docs

Per project convention (CLAUDE.md "Post-Work Updates"), update the TODO and project document before bumping the version.

**Files:**
- Modify: `docs/dev/HypeControl-TODO.md`
- Modify: `docs/dev/HC-Project-Document.md` (only if a status changed)

- [ ] **Step 1: Update HypeControl-TODO.md**

Open `docs/dev/HypeControl-TODO.md`. Update:
- The `Updated` date in the header to today (2026-04-27)
- The `Current Version` field to `1.1.1`
- Add (or check off, if already listed) an entry for "Issue #49 — Type-to-confirm paste bypass closed (paste/drop/beforeinput blocked, displayed phrase unselectable, cheeky callout)" under whatever section matches the project's recent-fixes structure
- Update the footer timestamp

- [ ] **Step 2: Update HC-Project-Document.md (only if status changed)**

Open `docs/dev/HC-Project-Document.md`. If it documents a "type-to-confirm step" or "friction step inventory" with status text, update it to reflect that the paste bypass is closed. If no such section exists or its content is still accurate, skip this step.

- [ ] **Step 3: Commit**

```bash
git add docs/dev/HypeControl-TODO.md docs/dev/HC-Project-Document.md
git commit -m "docs: log #49 paste-bypass fix in TODO and project doc"
```

(If `HC-Project-Document.md` had no changes, omit it from the `git add`.)

---

## Task 9: Run security review

Per the project's stored feedback rule (`feedback_security_review_before_pr.md`): **always run `/security-review` on the branch before opening the PR**. This is non-negotiable.

**Files:** none modified by this task; any findings get fixed in follow-up commits on the same branch.

- [ ] **Step 1: Invoke `/security-review`**

In the Claude Code session, run the `/security-review` command. It will analyze the diff against `main` and report any findings.

- [ ] **Step 2: Triage findings**

For each finding:
- **High/Medium severity related to the diff:** fix on this branch before continuing.
- **Pre-existing issues unrelated to this fix:** note them, but don't fix here. Open a separate ticket if not already tracked.
- **False positives:** acknowledge in plan notes, no action.

- [ ] **Step 3: Commit any fixes**

If fixes were needed, commit them with messages like `fix(security): <specific issue>`. If no fixes, skip.

---

## Task 10: Version bump and release artifacts

This is the only task that touches version numbers. It uses the project's `npm run release` script per `docs/dev/RELEASE-PROCESS.md` — never bump manifests by hand.

**Files (touched by the script, not directly):**
- Modify: `manifest.json`, `manifest.firefox.json`, `package.json` — patch bump 1.1.0 → 1.1.1
- Modify (script-generated): `CHANGELOG.md`, `docs/release-notes/v1.1.1.md`

- [ ] **Step 1: Run the release script**

Run: `npm run release`

The script will:
1. Lockstep-bump all three version files from 1.1.0 to 1.1.1
2. Scaffold a CHANGELOG entry
3. Scaffold a release-notes file at `docs/release-notes/v1.1.1.md`
4. Pause so you can edit the scaffolded notes

If the script aborts due to drift between the three version files, fix manually so all three read 1.1.0, then re-run. Do not allow drift.

- [ ] **Step 2: Edit the release notes**

Open `docs/release-notes/v1.1.1.md`. Add user-facing copy along these lines (adjust to match the project's release-note voice — see `docs/release-notes/v1.1.0.md` for tone):

> **#49 — Closed the copy/paste bypass on the type-to-confirm friction step.** Pasting, dragging, and autofilling the confirmation phrase no longer enables the Confirm button. Caught a cheat? You'll get a Newman-flavored callout. Friction is the feature.

Save.

- [ ] **Step 3: Continue the release script**

Run: `npm run release -- --continue`

The script will run `npm run build` and `npm run build:firefox` back to back. **If either build fails, the script aborts. Do not retry — ask the user to run the failing build manually in their own terminal** (per CLAUDE.md). If both succeed, the script produces the dual-platform bundles.

- [ ] **Step 4: Commit the release artifacts**

```bash
git add manifest.json manifest.firefox.json package.json CHANGELOG.md docs/release-notes/v1.1.1.md
git commit -m "maint: cut v1.1.1 — paste-bypass fix (#49)"
```

(Adjust the file list if `npm run release` writes additional bookkeeping files; check `git status` first.)

---

## Task 11: Open the PR (do not merge)

Per the user's global git workflow (CLAUDE.md): **always open the PR and stop. Never run `gh pr merge` without explicit user approval.**

**Files:** none modified.

- [ ] **Step 1: Push the branch**

Run: `git push -u origin fix/type-to-confirm-paste-bypass`

Expected: branch published, PR-create URL printed.

- [ ] **Step 2: Open the PR**

Run:

```bash
gh pr create --title "fix: close type-to-confirm paste bypass (#49)" --body "$(cat <<'EOF'
## Summary

- Closes #49 — copy/paste bypass on the type-to-confirm friction step
- Blocks `paste`, `drop`, and paste-flavored `beforeinput` events on the input
- Makes `.hc-confirm-phrase` unselectable so the prompt itself can't be dragged/copied
- Adds three autofill-suppression attributes (`name="hc-no-autofill"`, `data-1p-ignore`, `data-lpignore="true"`)
- Flashes a Newman-flavored cheeky callout when a cheat attempt is caught
- Patch bump: 1.1.0 → 1.1.1

## Test plan

- [ ] Keyboard paste (Ctrl/Cmd+V) blocked, callout flashes, input stays empty
- [ ] Right-click paste blocked
- [ ] Displayed phrase cannot be selected by mouse
- [ ] Drag-and-drop external text into input blocked
- [ ] `execCommand('insertText', ...)` from devtools is caught by `beforeinput` listener
- [ ] Password manager (1Password / LastPass / Bitwarden) does not auto-fill
- [ ] Legitimate typing still enables Confirm
- [ ] Callout hides as soon as user resumes typing
- [ ] Repeated pastes rotate copy randomly
- [ ] Cancel and Escape still work
- [ ] Math-challenge step unchanged (out of scope)
- [ ] All 11 manual tests pass on Chrome and Firefox
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
| Block keyboard paste (Ctrl/Cmd+V) | Task 5 (paste listener) |
| Block right-click paste | Task 5 (paste listener fires for context-menu paste) |
| Block drop event | Task 5 (drop listener) |
| Block `beforeinput` paste-flavored inputType | Task 5 (beforeinput listener with inputType filter) |
| Make displayed phrase unselectable | Task 1 (CSS) |
| Newman-flavored callout copy pool of 4 lines | Task 3 |
| Random pick on each attempt | Task 3 (`pickCheatLine`) |
| `textContent` only (not innerHTML) | Task 5 (`triggerCheatCallout`) |
| Re-disable Confirm on cheat attempt | Task 5 (`triggerCheatCallout`) |
| Hide callout on resumed typing | Task 5 (input listener prefix) |
| `role="alert"` on callout | Task 4 (HTML) |
| `--hc-danger` red color | Task 2 (CSS) |
| Autofill suppression attrs | Task 4 (HTML) |
| Math-challenge step out of scope | Task 7 step 11 (regression check) |
| Patch bump to 1.1.1 via `npm run release` | Task 10 |
| Manual test on Chrome and Firefox | Task 7 |
| Security review before PR | Task 9 |
| Open PR, do not merge | Task 11 |

No gaps.

**Placeholder scan:** None of "TBD", "TODO", "appropriate error handling", "similar to Task N" appear. Every code step shows actual code; every command step shows the actual command and expected output.

**Type consistency:** `triggerCheatCallout` defined once (Task 5) and called from three listeners in the same task. `pickCheatLine` defined once (Task 3) and called once (Task 5). `CHEAT_CALLOUT_LINES` defined once (Task 3) and consumed by `pickCheatLine` only. No naming drift.
