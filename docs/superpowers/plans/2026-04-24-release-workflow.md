# Release Workflow & CHANGELOG Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a repeatable release workflow (two-phase `npm run release` script + CHANGELOG.md + per-version user-facing release notes) and backfill the v1.0.0 → v1.1.0 history with retroactive tags and content.

**Architecture:** Dual-artifact model — `CHANGELOG.md` is canonical technical record; `docs/release-notes/vX.Y.Z.md` is user-facing brand-voice copy for store listings. `scripts/release.js` scaffolds both artifacts in Phase 1, then bumps manifests in lockstep + builds Chrome and Firefox zips in Phase 2. Seven retroactive git tags anchor the backfilled history.

**Tech Stack:** Node.js (release script), webpack (existing build), `archiver` npm package (zip creation), Jest (script tests), git tags.

**Spec reference:** `docs/superpowers/specs/2026-04-24-release-workflow-design.md`

---

## Task 1: Scaffold directories + .gitignore

**Files:**
- Create: `docs/release-notes/.gitkeep`
- Create: `scripts/.gitkeep`
- Create: `releases/.gitkeep`
- Modify: `.gitignore`

- [ ] **Step 1: Create empty directories with .gitkeep placeholders**

```bash
mkdir -p docs/release-notes scripts releases
touch docs/release-notes/.gitkeep scripts/.gitkeep releases/.gitkeep
```

- [ ] **Step 2: Read current .gitignore to find a good insertion point**

Use the Read tool on `.gitignore`.

- [ ] **Step 3: Append `releases/` entry to .gitignore**

Append a new block at the end of `.gitignore`:

```
# Release build artifacts (built by scripts/release.js)
releases/
```

Note: `releases/.gitkeep` stays tracked because `.gitkeep` lines are not ignored by the `releases/` glob pattern — verify by reading after the edit.

- [ ] **Step 4: Verify git status shows the new folders but not their future zip contents**

Run: `git status`
Expected: three new `.gitkeep` files staged (releases/, scripts/, docs/release-notes/), plus modified `.gitignore`. No `.zip` files.

- [ ] **Step 5: Commit**

```bash
git add .gitignore docs/release-notes/.gitkeep scripts/.gitkeep releases/.gitkeep
git commit -m "maint: scaffold release workflow directories"
```

---

## Task 2: Write release-notes template

**Files:**
- Create: `docs/release-notes/_template.md`

- [ ] **Step 1: Write the template file**

Create `docs/release-notes/_template.md` with this exact content:

```markdown
# vX.Y.Z — Month DD, YYYY

<!-- TODO: hero paragraph -->

**<Hero sentence in brand voice — the headline that sells this version. One to three sentences of prose. Voice: Sharp, Cheeky, Honest. No bullets in the hero.>**

- **Added:** <new feature or capability>
- **Fixed:** <bug fix>
- **Changed:** <behavior change>
- **Under the hood:** <technical note relevant to curious users, optional>

_Platforms: Chrome · Firefox_

<!--
Rules:
- Hero paragraph is always prose, voice-forward, never a bullet.
- Omit category bullets entirely if empty (no "Fixed: (none)").
- "Under the hood" is optional — reserve for detector internals, storage migrations, etc.
- Platforms footer: "Chrome", "Firefox", or "Chrome · Firefox" depending on what shipped.
- Delete this HTML comment block before publishing.
-->
```

- [ ] **Step 2: Commit**

```bash
git add docs/release-notes/_template.md
git commit -m "maint: add release notes template"
```

---

## Task 3: Write release-notes README

**Files:**
- Create: `docs/release-notes/README.md`

- [ ] **Step 1: Write README explaining the folder's purpose**

Create `docs/release-notes/README.md`:

```markdown
# Release Notes

User-facing release notes, one file per version: `vX.Y.Z.md`.

These files are the source of truth for:
- GitHub Release body (`gh release create --notes-file docs/release-notes/vX.Y.Z.md`)
- Chrome Web Store "What's new in this version" field
- Firefox AMO "What's new in this version" field

## Format

Every file follows the shape defined in `_template.md`:

- **Hero paragraph** (required) — brand-voice prose that headlines the release. One to three sentences. No bullets.
- **Category bullets** (optional, omit if empty) — `Added`, `Fixed`, `Changed`, `Under the hood`.
- **Platforms footer** — `Chrome`, `Firefox`, or `Chrome · Firefox`.

## Brand voice reference

See `CLAUDE.md` → Design Context → Brand Personality. Voice is **Sharp, Cheeky, Honest** — the friend grabbing your wrist before you tap confirm. Not a lecture.

## When a Firefox submission skips versions

Firefox AMO shipped 1.0.2 and held there for two weeks while Chrome moved through 1.0.3 → 1.0.10. When Firefox finally shipped 1.1.0, Firefox users needed to see *everything* that changed since 1.0.2.

The convention: the version-catching-up file (in that case `v1.1.0.md`) includes an extra section after the bullets titled **"What Firefox users missed since vX.Y.Z"** that aggregates hero lines from skipped versions. Chrome users paste hero + bullets; Firefox users paste the full file including the catch-up section.

## Relationship to CHANGELOG.md

`CHANGELOG.md` is the technical record — every version, every change, dev-facing voice. This folder is the user-facing layer. Both artifacts are mandatory for every release; the `npm run release` script scaffolds both.
```

- [ ] **Step 2: Commit**

```bash
git add docs/release-notes/README.md
git commit -m "docs: add release notes folder README"
```

---

## Task 4: Write v1.0.0 release notes (Chrome Web Store launch)

**Files:**
- Create: `docs/release-notes/v1.0.0.md`

Context for this file: this was the public launch on Chrome Web Store on 2026-03-23. Commit `f3b4d30`. Platforms: Chrome only (Firefox AMO port happened in 1.0.2).

- [ ] **Step 1: Review git log for v1.0.0's scope**

Run: `git log --oneline f3b4d30~10..f3b4d30` (last 10 commits before v1.0.0 bump).
Read each commit message to understand what's in the launch.

- [ ] **Step 2: Write v1.0.0.md**

Create `docs/release-notes/v1.0.0.md`:

```markdown
# v1.0.0 — March 23, 2026

**We're on the Chrome Web Store.** After months of private testing, Hype Control is public — the friendly wrist-grab before Twitch takes your paycheck. Same friction you've been helping us refine, now one click away for everyone.

- **Added:** Public Chrome Web Store listing — Hype Control is now installable from the store
- **Added:** Landing page + README aligned with brand voice
- **Added:** Issue templates (bug report, feature request) and public GitHub infrastructure
- **Changed:** Repo sanitized for public launch — internal test artifacts removed

_Platforms: Chrome_
```

- [ ] **Step 3: Commit**

```bash
git add docs/release-notes/v1.0.0.md
git commit -m "docs(release-notes): backfill v1.0.0 (Chrome Web Store launch)"
```

---

## Task 5: Write v1.0.2 release notes (Firefox AMO port)

**Files:**
- Create: `docs/release-notes/v1.0.2.md`

Context: First Firefox AMO submission. Commit `e02bd1a`. Firefox skipped 1.0.1 (Chrome-only patch). Platform: Firefox (first release).

- [ ] **Step 1: Review git log for v1.0.2's scope**

Run: `git log --oneline f3b4d30..e02bd1a`
Key commits: `04a0376 maint: Firefox AMO build support (#28)`, `ba3cc0a fix: bug report link now opens with template pre-selected (#27)`.

- [ ] **Step 2: Write v1.0.2.md**

Create `docs/release-notes/v1.0.2.md`:

```markdown
# v1.0.2 — April 10, 2026

**Firefox users, welcome in.** Hype Control is now live on Firefox AMO — same wallet-math, same wrist-grab, same mid-hype reality checks. If you've been waiting for us to leave Chrome exclusivity behind, the wait's over.

- **Added:** Firefox AMO build target — `npm run build:firefox` produces a Manifest V3 Firefox-compatible extension
- **Added:** Firefox-specific icon assets (5 sizes) and `browser_specific_settings.gecko` manifest fields
- **Fixed:** Bug report link now opens with the issue template pre-selected

_Platforms: Firefox_
```

- [ ] **Step 3: Commit**

```bash
git add docs/release-notes/v1.0.2.md
git commit -m "docs(release-notes): backfill v1.0.2 (Firefox AMO port)"
```

---

## Task 6: Write v1.0.3 release notes (friction trigger mode)

**Files:**
- Create: `docs/release-notes/v1.0.3.md`

Context: Added Price Guard vs Zero Trust friction trigger modes. Commit `0879faa`. Platform: Chrome.

- [ ] **Step 1: Review the v1.0.3 spec for context**

Read: `docs/superpowers/specs/2026-04-13-friction-trigger-mode-design.md`

- [ ] **Step 2: Write v1.0.3.md**

Create `docs/release-notes/v1.0.3.md`:

```markdown
# v1.0.3 — April 13, 2026

**Two ways to fire the friction now.** Price Guard only steps in when we actually see a dollar amount on the button — fewer false alarms, cleaner flow. Zero Trust is the paranoid mode: if it looks like a purchase button, it gets friction, price or no price. Pick your vibe in Settings.

- **Added:** Friction trigger mode setting with two options: Price Guard (default) and Zero Trust
- **Changed:** Default detection behavior now Price Guard — Twitch buttons without a detected price pass through silently
- **Under the hood:** Stream override path now actually disables friction (was a no-op on 1.0.0)

_Platforms: Chrome_
```

- [ ] **Step 3: Commit**

```bash
git add docs/release-notes/v1.0.3.md
git commit -m "docs(release-notes): backfill v1.0.3 (friction trigger mode)"
```

---

## Task 7: Write v1.0.8 release notes (subdomain scope fix)

**Files:**
- Create: `docs/release-notes/v1.0.8.md`

Context: Scoped host permissions to www.twitch.tv only. Commit `db76215`. Platform: Chrome.

- [ ] **Step 1: Review the v1.0.8 spec for context**

Read: `docs/superpowers/specs/2026-04-15-scope-twitch-subdomain-design.md`

- [ ] **Step 2: Write v1.0.8.md**

Create `docs/release-notes/v1.0.8.md`:

```markdown
# v1.0.8 — April 15, 2026

**Dashboard got a hall pass.** Hype Control used to run on every twitch.tv subdomain — including your own streaming dashboard, where you don't need friction on your own buttons. Now it's strictly `www.twitch.tv`. Your dashboard, mobile, and dev subdomains are off-limits.

- **Fixed:** Host permissions narrowed from `*.twitch.tv` to `www.twitch.tv` only — no more friction on dashboard.twitch.tv
- **Changed:** Both Chrome and Firefox manifests updated in lockstep

_Platforms: Chrome_
```

- [ ] **Step 3: Commit**

```bash
git add docs/release-notes/v1.0.8.md
git commit -m "docs(release-notes): backfill v1.0.8 (subdomain scope)"
```

---

## Task 8: Write v1.0.9 release notes (chat command interception)

**Files:**
- Create: `docs/release-notes/v1.0.9.md`

Context: `/gift` and `/subscribe` chat commands now trigger friction. Commit `d915309`. Platform: Chrome.

- [ ] **Step 1: Review the v1.0.9 spec for context**

Read: `docs/superpowers/specs/2026-04-16-chat-command-interception-design.md`

- [ ] **Step 2: Write v1.0.9.md**

Create `docs/release-notes/v1.0.9.md`:

```markdown
# v1.0.9 — April 20, 2026

**Chat commands were the loophole.** Power users were typing `/gift` and `/subscribe` straight into chat to dodge the purchase buttons and the friction that comes with them. Not anymore. Both commands now go through the same cooldowns, caps, and reality checks as clicking. Because typing was how you were cheating.

- **Added:** Interception for `/gift` and `/subscribe` chat commands — Enter is held hostage until friction clears
- **Added:** Chat command interception toggle in the popup (on by default)
- **Fixed:** Race condition where Enter could reach Twitch during the async settings load
- **Under the hood:** Enter replays correctly after pass-through paths (none/cap-bypass/whitelist/streaming) so approved commands actually send

_Platforms: Chrome_
```

- [ ] **Step 3: Commit**

```bash
git add docs/release-notes/v1.0.9.md
git commit -m "docs(release-notes): backfill v1.0.9 (chat command interception)"
```

---

## Task 9: Write v1.0.10 release notes (chat-callout false-trigger fix)

**Files:**
- Create: `docs/release-notes/v1.0.10.md`

Context: Fixed resub callout false-triggering the detector. Commit `77a2334`. Platform: Chrome (Firefox held at 1.0.2).

- [ ] **Step 1: Review the v1.0.10 spec for context**

Read: `docs/superpowers/specs/2026-04-24-resub-callout-false-trigger-design.md`

- [ ] **Step 2: Write v1.0.10.md**

Create `docs/release-notes/v1.0.10.md`:

```markdown
# v1.0.10 — April 23, 2026

**Resub callouts aren't purchases.** When someone's sub auto-renewed, Twitch was showing a "Gift 1 sub back" callout — and our detector was falling for it like it was a real purchase. Now the detector knows chat-callout surfaces (resub share, hype train callouts, community highlights) are display UI, not checkout buttons.

- **Fixed:** Resub share callouts no longer false-trigger "Gift 1 sub back" interception
- **Fixed:** Hype train callouts, community highlight stacks, and paid pins are now correctly excluded from purchase detection
- **Under the hood:** Added `isInsideChatCallout()` helper + `jest-environment-jsdom` for DOM-based unit tests. Baseline `isPurchaseButton` regression suite now in place.

_Platforms: Chrome_
```

- [ ] **Step 3: Commit**

```bash
git add docs/release-notes/v1.0.10.md
git commit -m "docs(release-notes): backfill v1.0.10 (chat-callout fix)"
```

---

## Task 10: Write v1.1.0 release notes (dual-platform + Firefox catch-up)

**Files:**
- Create: `docs/release-notes/v1.1.0.md`

Context: Dual-platform release cut. Commit `c160fff`. Firefox catches up from 1.0.2. Platforms: Chrome + Firefox. **This is the only backfill file with a catch-up section.**

- [ ] **Step 1: Review the v1.1.0 cut commit body**

Run: `git show c160fff --stat`
Read the commit message to confirm the "catch up from 1.0.2 drift" framing.

- [ ] **Step 2: Write v1.1.0.md including Firefox catch-up section**

Create `docs/release-notes/v1.1.0.md`:

```markdown
# v1.1.0 — April 24, 2026

**Chrome and Firefox, lockstep at last.** Firefox AMO quietly held at 1.0.2 while Chrome shipped five patches of actual work. This release ends that drift — both stores now run the same version, with the same features, on the same day.

- **Changed:** Minor-version bump to mark dual-platform parity — all three manifests (`manifest.json`, `manifest.firefox.json`, `package.json`) now synchronized to 1.1.0
- **Under the hood:** Versioning process rewritten to prevent future drift (see new `docs/dev/RELEASE-PROCESS.md`)

## What Firefox users missed since 1.0.2

Firefox AMO last saw version 1.0.2. Here's the whole backlog, landing all at once:

- **v1.0.3 — Friction trigger mode.** Two detection modes: Price Guard (friction only when we see a price) and Zero Trust (friction on anything that looks like a purchase). Default is Price Guard.
- **v1.0.8 — Dashboard subdomain got a hall pass.** Host permissions narrowed to `www.twitch.tv` — your own streaming dashboard is now friction-free.
- **v1.0.9 — Chat commands were the loophole.** `/gift` and `/subscribe` typed into chat now go through the same friction as clicking a button. Toggle in the popup if you need to turn it off.
- **v1.0.10 — Resub callouts stop false-triggering.** Detector now correctly excludes chat-callout surfaces (resub share, hype train, community highlights) from purchase detection.

_Platforms: Chrome · Firefox_
```

- [ ] **Step 3: Commit**

```bash
git add docs/release-notes/v1.1.0.md
git commit -m "docs(release-notes): backfill v1.1.0 (dual-platform release)"
```

---

## Task 11: Backfill CHANGELOG.md entries

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Read current CHANGELOG.md to find the insertion point**

Use Read on `CHANGELOG.md`. The existing `## [0.4.5] - 2026-03-10` block is at the top of the entries. New entries insert ABOVE it, newest first.

- [ ] **Step 2: Gather commit data for each milestone**

For each of 0.4.28 (consolidated), 1.0.0, 1.0.2, 1.0.3, 1.0.8, 1.0.9, 1.0.10, 1.1.0, run:

```bash
git log --oneline <prev>..<this>
```

Note the scope of each version from the commit list.

- [ ] **Step 3: Insert backfilled entries above the existing 0.4.5 block**

Insert the following block between the `---` separator after the preamble and the existing `## [0.4.5]` line:

```markdown
## [1.1.0] - 2026-04-24

### Changed
- **Dual-platform release cut** — lockstep bump across `manifest.json`, `manifest.firefox.json`, and `package.json` to 1.1.0. Firefox manifest catches up from 1.0.2 drift.
- **Release workflow introduced** — `npm run release` two-phase script, `docs/release-notes/` folder for user-facing notes, `docs/dev/RELEASE-PROCESS.md` documenting the workflow, `.github/pull_request_template.md` with lockstep checklist.

### Added
- `docs/release-notes/` folder with per-version user-facing notes for v1.0.0 → v1.1.0 (backfilled) and going forward.
- `scripts/release.js` — automated lockstep manifest bump + dual-platform build + zip + tag.
- Retroactive git tags: v1.0.0, v1.0.2, v1.0.3, v1.0.8, v1.0.9, v1.0.10, v1.1.0.

---

## [1.0.10] - 2026-04-23

### Fixed
- **Chat-callout surfaces excluded from purchase detection** (#44/#45) — resub share callouts were false-triggering `isPurchaseButton` via the "Gift 1 sub back" text. Added `isInsideChatCallout()` helper + `CHAT_CALLOUT_SEED_DATATARGETS` + `CHAT_CALLOUT_SUFFIX_RE`. Covers resub share, gifted-sub thanks, paid pins, community highlight stacks, hype-train callouts.

### Added
- `jest-environment-jsdom` for DOM-based detector unit tests.
- Baseline `isPurchaseButton` regression test suite (locks down existing behavior for a future allowlist rewrite).

### Changed
- `CLAUDE.md` versioning rule consolidated — now explicitly names all three manifest files (Chrome, Firefox, package.json) as lockstep. Fixes the ambiguity that caused 1.0.2 / 1.0.9 drift.

### Note
- Chrome-only release. Firefox AMO held at 1.0.2 pending lockstep reconciliation in 1.1.0.

---

## [1.0.9] - 2026-04-20

### Added
- **Chat command interception** (#39/#43) — `/gift` and `/subscribe` typed into chat now go through the full friction flow. Keydown listener on chat input blocks Enter synchronously before async settings load.
- Chat command interception toggle in popup settings (`chatCommandInterception`, on by default).
- `InterceptEvent` extended with `source` and `command` fields.

### Fixed
- Race condition where Enter could reach Twitch during async settings load.
- Double-friction prevention — modal approval doesn't re-trigger overlays after chat interceptor already handled the command.
- Enter replays correctly after pass-through paths (none/cap-bypass/whitelist/streaming) so approved commands actually send.

---

## [1.0.8] - 2026-04-15

### Fixed
- **Subdomain scope narrowed** (#40/#42) — host permissions and content script matches changed from `*.twitch.tv` to `https://www.twitch.tv/*` only. Prevents HC from running on dashboard, mobile, dev subdomains.
- Both Chrome and Firefox manifests updated in lockstep.

---

## [1.0.3] - 2026-04-13

### Added
- **Friction trigger mode** (#33) — new setting with two options: Price Guard (default — friction only when price detected) and Zero Trust (friction on anything purchase-like, price or no price).

### Fixed
- **Stream override actually disables friction** (#32/#34) — was a no-op on 1.0.0.
- **Gifted Subscriptions tab no longer false-triggers interception** (#36).
- **Reset / Wipe / Nevermind buttons render on the same row** (#37).
- **Sidebar nav locked during onboarding wizard** (#38) — users can't escape mid-tour.

---

## [1.0.2] - 2026-04-10

### Added
- **Firefox AMO build support** (#28) — `manifest.firefox.json` with MV3 `browser_specific_settings.gecko`, `scripts` array background, Firefox-specific icon assets. `npm run build:firefox` produces AMO-compatible zip.
- "Chrome extension" → "browser extension" copy update throughout (#30).
- `.gitignore` zip artifacts, Firefox port plan doc (#29).

### Fixed
- Bug report link opens with issue template pre-selected (#27).

### Note
- First Firefox AMO release. Chrome skipped 1.0.1 (Chrome-only patch that never shipped to store).

---

## [1.0.0] - 2026-03-23

### Added
- **Public Chrome Web Store launch** — Hype Control is now installable from the Chrome Web Store.
- Landing page copy aligned with brand voice (#25).
- README rewrite for Chrome Web Store launch (#24).
- GitHub infrastructure for public launch — issue templates, PR conventions (#23).
- Repo sanitization (removed internal test artifacts, old branches, etc.) (#22).

### Changed
- Repo flipped public.

---

## [0.4.28] - 2026-03-22

### Summary (consolidated)

Pre-launch polish between 0.4.6 and 0.4.28. Individual patch-level detail lives in the git history; this entry summarizes the work that shipped as the 1.0.0 Chrome Web Store launch.

### Added
- Spending history view (Add-on 2).
- Weekly / monthly spending limits with escalated friction and calendar-aligned resets (Add-on 3).
- Savings calendar in popup with 3-tier day classification and 90 motivational messages.
- Interactive onboarding tour / setup wizard.
- Dynamic intensity escalation based on spending.
- Popup polish (stat card tooltips, credits section, layout improvements).
- Friction overlay steps: type-to-confirm, math challenge, cooldown timer, reason selection.

### Changed
- UI rebrand to purple accent (`#9147ff` dark / `#7c3aed` light).
- Extracted tracker load/save into shared `src/shared/spendingTracker.ts` module — reset checks run on every read. `sessionTotal` / `sessionChannel` removed entirely.
- Input validation hardening: `sanitizeSettings()` / `sanitizeTracker()` gates on all storage read/write paths. XSS fix in `options.ts` comparison items. `parsePrice()` NaN/Infinity guard.
- XSS fix in `interceptor.ts` `showWhitelistSelector()` — channel name was interpolated into `outerHTML`. Fixed with DOM construction + `textContent`.

### Fixed
- Silent-proceed paths (cap-bypass, no-friction, whitelist-skip/reduced) now call `writeInterceptEvent()` for spending history accuracy.

---
```

- [ ] **Step 4: Verify CHANGELOG.md reads cleanly from top to bottom**

Use Read on `CHANGELOG.md`. Confirm the ordering is:
- Preamble + separator
- `## [1.1.0]` → `## [1.0.10]` → `## [1.0.9]` → `## [1.0.8]` → `## [1.0.3]` → `## [1.0.2]` → `## [1.0.0]` → `## [0.4.28]` → `## [0.4.5]` → rest.

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: backfill CHANGELOG for v0.4.28 -> v1.1.0"
```

---

## Task 12: Write RELEASE-PROCESS.md

**Files:**
- Create: `docs/dev/RELEASE-PROCESS.md`

- [ ] **Step 1: Write the release process document**

Create `docs/dev/RELEASE-PROCESS.md`:

````markdown
# Release Process

How to cut a release of Hype Control. The `npm run release` script handles the mechanics; you handle the prose.

## TL;DR

```bash
git checkout -b maint/vX.Y.Z-release
npm run release                      # Phase 1: scaffolds CHANGELOG + release-notes stubs
# ... edit docs/release-notes/vX.Y.Z.md and CHANGELOG.md ...
npm run release -- --continue        # Phase 2: bumps, builds, zips, tags
git push -u origin maint/vX.Y.Z-release
gh pr create                         # wait for merge
git push origin vX.Y.Z
gh release create vX.Y.Z --notes-file docs/release-notes/vX.Y.Z.md \
  releases/hype-control-chrome-vX.Y.Z.zip \
  releases/hype-control-firefox-vX.Y.Z.zip
# Upload zips to Chrome Web Store + Firefox AMO dashboards manually.
```

## The Two Artifacts

Every release produces two documents:

| File                                 | Audience         | Voice     |
|--------------------------------------|------------------|-----------|
| `CHANGELOG.md` (entry appended)      | Developers       | Technical |
| `docs/release-notes/vX.Y.Z.md` (new) | End users        | Brand ("Sharp, Cheeky, Honest") |

Both are **mandatory**. The release script won't proceed to Phase 2 until both are filled in (placeholder checks enforce this).

## Phase 1: Scaffold

`npm run release` (optionally `-- --minor` or `-- --major`) does the following:

1. Preflight checks (clean tree, feature branch, manifests in lockstep) — aborts on any failure.
2. Computes next version from `package.json`.
3. Appends a stub to `CHANGELOG.md` with a fenced block of `git log <last-tag>..HEAD --oneline` as raw material.
4. Copies `docs/release-notes/_template.md` → `docs/release-notes/vX.Y.Z.md` with version and date filled in.
5. Exits with instructions pointing at both scaffolded files.

Phase 1 makes **no manifest changes**. Fully reversible — delete the scaffolded files and you're back to where you started.

## Edit the scaffolded files

- **Release notes (`docs/release-notes/vX.Y.Z.md`)** — hero paragraph in brand voice, then category bullets, then platforms footer. See `docs/release-notes/README.md` for format rules. Delete the `<!-- TODO: hero paragraph -->` comment once you've written the hero.
- **CHANGELOG entry** — technical voice, `### Added` / `### Fixed` / `### Changed` sections. The fenced `git log` block is scratch — replace it with real entries, then remove the `<!-- TODO: fill in from git log below -->` comment.

## Phase 2: Cut

`npm run release -- --continue`:

1. Checks both scaffolds are filled (placeholder markers must be gone).
2. Bumps all three manifests in lockstep.
3. Runs `npm run build` (Chrome) → zips to `releases/hype-control-chrome-vX.Y.Z.zip`.
4. Runs `npm run build:firefox` (Firefox) → zips to `releases/hype-control-firefox-vX.Y.Z.zip`.
5. Verifies each `dist/manifest.json` version matches the bump.
6. Commits (`maint: cut vX.Y.Z release`) with only the files touched — NOT `git add -A`.
7. Tags locally (`git tag vX.Y.Z`). Does NOT push.
8. Prints next-step commands.

## After the script: push, PR, release

The script stops at local commit + tag. You run:

```bash
git push -u origin maint/vX.Y.Z-release
gh pr create --title "maint: cut vX.Y.Z release"
```

**Run `/security-review` on the branch before `gh pr create`** — this is a non-negotiable pre-push gate.

After PR merge:

```bash
git push origin vX.Y.Z
gh release create vX.Y.Z --notes-file docs/release-notes/vX.Y.Z.md \
  releases/hype-control-chrome-vX.Y.Z.zip \
  releases/hype-control-firefox-vX.Y.Z.zip
```

Then upload the zips manually to:
- **Chrome Web Store** — https://chrome.google.com/webstore/devconsole/ → Hype Control → Upload new package
- **Firefox AMO** — https://addons.mozilla.org/en-US/developers/addons → Hype Control → Upload new version

Paste `docs/release-notes/vX.Y.Z.md` content into each store's "What's new in this version" field.

## When Firefox falls behind Chrome

If Firefox AMO misses a version while Chrome ships, the next Firefox AMO submission's `vX.Y.Z.md` gets an extra section titled **"What Firefox users missed since vA.B.C"** that aggregates hero lines from the skipped versions. See `v1.1.0.md` for the precedent.

## Versioning rules

- **Patch** (default `npm run release`) — bug fixes, copy tweaks, small UI adjustments.
- **Minor** (`-- --minor`) — new features, behavior changes, platform additions.
- **Major** (`-- --major`) — breaking changes that require user re-configuration, settings migrations that can't auto-upgrade.

All three manifest files (`manifest.json`, `manifest.firefox.json`, `package.json`) must always match. The script enforces this; the PR template reminds you.

## Conventional Commits

Commit messages use `feat:` / `fix:` / `maint:` prefixes. This is a convention (documented, not enforced by hook) — it exists to make `git log` readable and to signal intent in PR titles.

- `feat:` — new feature or capability
- `fix:` — bug fix
- `maint:` — refactor, docs, dependency bump, release cut, housekeeping

Do NOT use `chore:` / `docs:` / `refactor:` prefixes — see CLAUDE.md.
````

- [ ] **Step 2: Commit**

```bash
git add docs/dev/RELEASE-PROCESS.md
git commit -m "docs: add release process documentation"
```

---

## Task 13: Write PR template

**Files:**
- Create: `.github/pull_request_template.md`

- [ ] **Step 1: Write the PR template**

Create `.github/pull_request_template.md`:

```markdown
## Summary

<!-- One to three bullets describing what this PR changes and why. -->

## Type of change

- [ ] Bug fix (`fix:`)
- [ ] New feature (`feat:`)
- [ ] Maintenance / refactor / docs (`maint:`)
- [ ] Release cut (version bump)

## Checklist

- [ ] Branch is `feat/` / `fix/` / `maint/` prefixed (not `chore/` / `docs/` / `refactor/`)
- [ ] `CHANGELOG.md` entry added under the appropriate version block
- [ ] If this PR bumps versions: `docs/release-notes/vX.Y.Z.md` exists and is filled in
- [ ] If this PR bumps versions: all three manifests (`manifest.json`, `manifest.firefox.json`, `package.json`) are in lockstep
- [ ] Security review run on branch (`/security-review`) before merge

## Test plan

<!-- Bulleted checklist of manual/automated verification steps. -->
```

- [ ] **Step 2: Commit**

```bash
git add .github/pull_request_template.md
git commit -m "maint: add PR template with CHANGELOG + lockstep checklist"
```

---

## Task 14: Update CLAUDE.md to point at RELEASE-PROCESS.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Read current CLAUDE.md to find the Versioning + Build sections**

Use Read on `CLAUDE.md`. Locate the `## Versioning` section (top of file) and the `## Build` section below it.

- [ ] **Step 2: Replace the Versioning + Build sections with a consolidated pointer**

Replace the existing `## Versioning` section and the existing `## Build` section with this single block:

```markdown
## Versioning & Release Process

All releases follow the process in `docs/dev/RELEASE-PROCESS.md`. The short version:

- **Lockstep bump** — patch version bumps must happen in `manifest.json`, `manifest.firefox.json`, AND `package.json` together. Never bump one without the others. Drift between them is a known failure mode (Firefox 1.0.2 / Chrome 1.0.9 incident).
- **Only increment patch** (e.g. `1.1.0` → `1.1.1`) unless explicitly instructed to bump minor or major.
- **`npm run release`** handles the bump, CHANGELOG scaffold, release-notes scaffold, lockstep enforcement, and dual-platform builds. Don't bump manifests by hand.
- **Build attempt** — `npm run release -- --continue` runs both `npm run build` and `npm run build:firefox`. If either fails, the script aborts. Do not retry — ask the user to run the failing build manually in their own terminal.
```

- [ ] **Step 3: Verify CLAUDE.md still reads coherently**

Use Read on `CLAUDE.md`. Confirm the replacement fits naturally — the sections below (Currency Math, Storage Conventions, Settings Migration, Post-Work Updates, Design Context) should all still be present and in their original order.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): point versioning/build sections at RELEASE-PROCESS.md"
```

---

## Task 15: Add archiver dependency + npm scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install archiver as a dev dependency**

Run:

```bash
npm install --save-dev archiver
```

Verify `package.json` now has `"archiver"` under `devDependencies`.

- [ ] **Step 2: Add the `release` script to package.json**

Edit `package.json` scripts section. Add a new key:

```json
"release": "node scripts/release.js"
```

The full scripts block should now look like (order may vary — keep alphabetical if that's the existing pattern):

```json
"scripts": {
  "build": "webpack --mode production",
  "build:firefox": "webpack --mode production --env target=firefox",
  "clean": "rimraf dist",
  "dev": "webpack --mode development --watch",
  "dev:firefox": "webpack --mode development --watch --env target=firefox",
  "postinstall": "npm run build",
  "release": "node scripts/release.js",
  "test": "jest"
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "maint: add archiver devDep + npm run release script entry"
```

---

## Task 16: Release script — preflight checks (TDD)

**Files:**
- Create: `scripts/release.js`
- Create: `tests/scripts/release.test.js`

The release script grows organically across Tasks 16–20. Each task adds one logical piece (preflight → version compute → scaffold → continue → entry point wiring) with tests.

- [ ] **Step 1: Create the test file with failing preflight tests**

Create `tests/scripts/release.test.js`:

```javascript
/**
 * @jest-environment node
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { preflight } = require('../../scripts/release.js');

describe('release.js preflight', () => {
  test('preflight throws when working tree is dirty', () => {
    // Mock execSync to return non-empty git status
    const mockExec = jest.fn((cmd) => {
      if (cmd.includes('git status --porcelain')) return ' M package.json\n';
      if (cmd.includes('git branch --show-current')) return 'maint/foo\n';
      return '';
    });
    expect(() => preflight({ exec: mockExec, readJson: () => ({ version: '1.1.0' }) }))
      .toThrow(/working tree is not clean/i);
  });

  test('preflight throws when on main branch', () => {
    const mockExec = jest.fn((cmd) => {
      if (cmd.includes('git status --porcelain')) return '';
      if (cmd.includes('git branch --show-current')) return 'main\n';
      return '';
    });
    expect(() => preflight({ exec: mockExec, readJson: () => ({ version: '1.1.0' }) }))
      .toThrow(/must not be on main or master/i);
  });

  test('preflight throws when on master branch', () => {
    const mockExec = jest.fn((cmd) => {
      if (cmd.includes('git status --porcelain')) return '';
      if (cmd.includes('git branch --show-current')) return 'master\n';
      return '';
    });
    expect(() => preflight({ exec: mockExec, readJson: () => ({ version: '1.1.0' }) }))
      .toThrow(/must not be on main or master/i);
  });

  test('preflight throws when manifests drift', () => {
    const mockExec = jest.fn((cmd) => {
      if (cmd.includes('git status --porcelain')) return '';
      if (cmd.includes('git branch --show-current')) return 'maint/foo\n';
      return '';
    });
    const mockReadJson = jest.fn((p) => {
      if (p.endsWith('package.json')) return { version: '1.1.0' };
      if (p.endsWith('manifest.json')) return { version: '1.1.0' };
      if (p.endsWith('manifest.firefox.json')) return { version: '1.0.2' };
      throw new Error('unexpected read: ' + p);
    });
    expect(() => preflight({ exec: mockExec, readJson: mockReadJson }))
      .toThrow(/manifests drift/i);
  });

  test('preflight passes on a clean feature branch with aligned manifests', () => {
    const mockExec = jest.fn((cmd) => {
      if (cmd.includes('git status --porcelain')) return '';
      if (cmd.includes('git branch --show-current')) return 'maint/release-workflow\n';
      return '';
    });
    const mockReadJson = jest.fn(() => ({ version: '1.1.0' }));
    expect(() => preflight({ exec: mockExec, readJson: mockReadJson })).not.toThrow();
    // Returns the current version for downstream use
    expect(preflight({ exec: mockExec, readJson: mockReadJson })).toEqual({ currentVersion: '1.1.0' });
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails (module doesn't exist)**

Run: `npx jest tests/scripts/release.test.js`
Expected: FAIL with "Cannot find module '../../scripts/release.js'".

- [ ] **Step 3: Write the minimum release.js with preflight only**

Create `scripts/release.js`:

```javascript
#!/usr/bin/env node
/**
 * HypeControl release script.
 * Phase 1: preflight + scaffold.
 * Phase 2 (--continue): lockstep bump + build + zip + tag.
 *
 * Exported functions are testable in isolation via dependency injection.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATHS = [
  path.join(ROOT, 'package.json'),
  path.join(ROOT, 'manifest.json'),
  path.join(ROOT, 'manifest.firefox.json'),
];

function defaultExec(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8' });
}

function defaultReadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/**
 * Preflight checks before either phase runs.
 * @returns {{currentVersion: string}}
 * @throws if any precondition fails
 */
function preflight({ exec = defaultExec, readJson = defaultReadJson } = {}) {
  const status = exec('git status --porcelain').trim();
  if (status) {
    throw new Error(`Working tree is not clean:\n${status}\nCommit or stash changes before running release.`);
  }

  const branch = exec('git branch --show-current').trim();
  if (branch === 'main' || branch === 'master') {
    throw new Error(`Current branch is "${branch}". Release work must not be on main or master — cut a maint/vX.Y.Z-release branch first.`);
  }

  const versions = MANIFEST_PATHS.map((p) => ({
    path: path.relative(ROOT, p),
    version: readJson(p).version,
  }));
  const distinct = new Set(versions.map((v) => v.version));
  if (distinct.size > 1) {
    const summary = versions.map((v) => `  ${v.path}: ${v.version}`).join('\n');
    throw new Error(`Manifests drift — versions do not match:\n${summary}\nFix drift before running release.`);
  }

  return { currentVersion: versions[0].version };
}

module.exports = { preflight };
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx jest tests/scripts/release.test.js`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/release.js tests/scripts/release.test.js
git commit -m "feat(release): add preflight checks with TDD coverage"
```

---

## Task 17: Release script — version compute (TDD)

**Files:**
- Modify: `scripts/release.js`
- Modify: `tests/scripts/release.test.js`

- [ ] **Step 1: Add version bump tests**

Append to `tests/scripts/release.test.js`:

```javascript
const { computeNextVersion } = require('../../scripts/release.js');

describe('release.js computeNextVersion', () => {
  test('patch bump (default)', () => {
    expect(computeNextVersion('1.1.0', 'patch')).toBe('1.1.1');
    expect(computeNextVersion('0.4.28', 'patch')).toBe('0.4.29');
  });

  test('minor bump resets patch', () => {
    expect(computeNextVersion('1.1.0', 'minor')).toBe('1.2.0');
    expect(computeNextVersion('1.0.10', 'minor')).toBe('1.1.0');
  });

  test('major bump resets minor + patch', () => {
    expect(computeNextVersion('1.1.0', 'major')).toBe('2.0.0');
    expect(computeNextVersion('0.4.28', 'major')).toBe('1.0.0');
  });

  test('rejects non-semver input', () => {
    expect(() => computeNextVersion('v1.1.0', 'patch')).toThrow(/invalid version/i);
    expect(() => computeNextVersion('1.1', 'patch')).toThrow(/invalid version/i);
    expect(() => computeNextVersion('1.1.0-beta', 'patch')).toThrow(/invalid version/i);
  });

  test('rejects unknown bump type', () => {
    expect(() => computeNextVersion('1.1.0', 'mega')).toThrow(/unknown bump type/i);
  });
});
```

- [ ] **Step 2: Run to confirm fail**

Run: `npx jest tests/scripts/release.test.js`
Expected: 5 new tests fail with "computeNextVersion is not a function".

- [ ] **Step 3: Implement computeNextVersion**

In `scripts/release.js`, add before `module.exports`:

```javascript
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * Compute the next version string given the current one and a bump type.
 * @param {string} current - Current version like "1.1.0"
 * @param {'patch'|'minor'|'major'} bumpType
 * @returns {string}
 */
function computeNextVersion(current, bumpType) {
  const m = SEMVER_RE.exec(current);
  if (!m) {
    throw new Error(`Invalid version: "${current}". Expected MAJOR.MINOR.PATCH with no prefix or suffix.`);
  }
  const [, majStr, minStr, patStr] = m;
  const major = parseInt(majStr, 10);
  const minor = parseInt(minStr, 10);
  const patch = parseInt(patStr, 10);

  switch (bumpType) {
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'major': return `${major + 1}.0.0`;
    default:
      throw new Error(`Unknown bump type: "${bumpType}". Expected patch, minor, or major.`);
  }
}
```

Update the exports line:

```javascript
module.exports = { preflight, computeNextVersion };
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx jest tests/scripts/release.test.js`
Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/release.js tests/scripts/release.test.js
git commit -m "feat(release): add semver-aware version compute"
```

---

## Task 18: Release script — Phase 1 scaffold (TDD)

**Files:**
- Modify: `scripts/release.js`
- Modify: `tests/scripts/release.test.js`

- [ ] **Step 1: Add scaffold tests**

Append to `tests/scripts/release.test.js`:

```javascript
const { scaffoldChangelogEntry, scaffoldReleaseNotes, getChangelogScaffold, getReleaseNotesScaffold } = require('../../scripts/release.js');

describe('release.js scaffold helpers', () => {
  test('getChangelogScaffold produces a dated version block with git-log comment', () => {
    const out = getChangelogScaffold({
      version: '1.1.1',
      date: '2026-05-01',
      gitLogLines: ['abc1234 fix: something'],
    });
    expect(out).toContain('## [1.1.1] - 2026-05-01');
    expect(out).toContain('<!-- TODO: fill in from git log below -->');
    expect(out).toContain('abc1234 fix: something');
    expect(out).toMatch(/### Added[\s\S]*### Fixed[\s\S]*### Changed/);
  });

  test('getReleaseNotesScaffold fills version and date into template', () => {
    const template = '# vX.Y.Z — Month DD, YYYY\n\n<!-- TODO: hero paragraph -->\n';
    const out = getReleaseNotesScaffold({
      template,
      version: '1.1.1',
      date: 'May 1, 2026',
    });
    expect(out).toContain('# v1.1.1 — May 1, 2026');
    expect(out).toContain('<!-- TODO: hero paragraph -->');
    expect(out).not.toContain('vX.Y.Z');
    expect(out).not.toContain('Month DD, YYYY');
  });

  test('scaffoldChangelogEntry inserts new block above existing entries', () => {
    const existing = '# Changelog\n\n---\n\n## [1.1.0] - 2026-04-24\n\n### Changed\n- prior\n';
    const out = scaffoldChangelogEntry({
      existing,
      scaffold: '## [1.1.1] - 2026-05-01\n\n### Fixed\n- new\n',
    });
    const firstHeader = out.indexOf('## [1.1.1]');
    const oldHeader = out.indexOf('## [1.1.0]');
    expect(firstHeader).toBeGreaterThan(-1);
    expect(firstHeader).toBeLessThan(oldHeader);
    // preamble + separator preserved
    expect(out.startsWith('# Changelog\n\n---\n\n')).toBe(true);
  });

  test('scaffoldReleaseNotes writes a new file when it does not exist', () => {
    const written = {};
    const fakeFs = {
      existsSync: () => false,
      writeFileSync: (p, content) => { written[p] = content; },
      readFileSync: () => '# vX.Y.Z\n<!-- TODO: hero paragraph -->',
    };
    scaffoldReleaseNotes({
      version: '1.1.1',
      date: 'May 1, 2026',
      fs: fakeFs,
      root: '/tmp/hc',
    });
    const expectedPath = '/tmp/hc/docs/release-notes/v1.1.1.md';
    expect(written[expectedPath]).toContain('# v1.1.1 — May 1, 2026');
  });

  test('scaffoldReleaseNotes refuses to overwrite existing file', () => {
    const fakeFs = {
      existsSync: () => true,
      writeFileSync: () => { throw new Error('should not write'); },
      readFileSync: () => '',
    };
    expect(() => scaffoldReleaseNotes({
      version: '1.1.1',
      date: 'May 1, 2026',
      fs: fakeFs,
      root: '/tmp/hc',
    })).toThrow(/already exists/i);
  });

  test('no-prior-tags fallback: getChangelogScaffold handles empty gitLogLines', () => {
    const out = getChangelogScaffold({
      version: '1.0.0',
      date: '2026-03-23',
      gitLogLines: [],
    });
    expect(out).toContain('## [1.0.0] - 2026-03-23');
    expect(out).toContain('(no git-log output — no prior tag)');
  });
});
```

- [ ] **Step 2: Run to confirm fail**

Run: `npx jest tests/scripts/release.test.js`
Expected: 6 new tests fail with "X is not a function".

- [ ] **Step 3: Implement the scaffold helpers**

Add to `scripts/release.js` before the exports:

```javascript
function getChangelogScaffold({ version, date, gitLogLines }) {
  const logBlock = gitLogLines.length
    ? gitLogLines.join('\n')
    : '(no git-log output — no prior tag)';
  return [
    `## [${version}] - ${date}`,
    '',
    '<!-- TODO: fill in from git log below -->',
    '',
    '### Added',
    '-',
    '',
    '### Fixed',
    '-',
    '',
    '### Changed',
    '-',
    '',
    '<!--',
    'Raw material — commits since the last tag:',
    '```',
    logBlock,
    '```',
    '-->',
    '',
    '---',
    '',
  ].join('\n');
}

function getReleaseNotesScaffold({ template, version, date }) {
  return template
    .replace(/vX\.Y\.Z/g, `v${version}`)
    .replace(/Month DD, YYYY/g, date);
}

function scaffoldChangelogEntry({ existing, scaffold }) {
  // Find the first "## [" block header and insert scaffold immediately before it.
  const firstHeaderIdx = existing.indexOf('\n## [');
  if (firstHeaderIdx === -1) {
    // No existing version entries — append at end after preamble.
    return existing.trimEnd() + '\n\n' + scaffold;
  }
  const insertAt = firstHeaderIdx + 1; // After the newline, before "## ["
  return existing.slice(0, insertAt) + scaffold + existing.slice(insertAt);
}

function scaffoldReleaseNotes({ version, date, fs: injectedFs = fs, root = ROOT }) {
  const templatePath = path.join(root, 'docs/release-notes/_template.md');
  const outPath = path.join(root, 'docs/release-notes', `v${version}.md`);
  if (injectedFs.existsSync(outPath)) {
    throw new Error(`Release notes already exist: ${outPath}`);
  }
  const template = injectedFs.readFileSync(templatePath, 'utf8');
  const filled = getReleaseNotesScaffold({ template, version, date });
  injectedFs.writeFileSync(outPath, filled);
  return outPath;
}
```

Update exports:

```javascript
module.exports = {
  preflight,
  computeNextVersion,
  getChangelogScaffold,
  getReleaseNotesScaffold,
  scaffoldChangelogEntry,
  scaffoldReleaseNotes,
};
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx jest tests/scripts/release.test.js`
Expected: 16 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/release.js tests/scripts/release.test.js
git commit -m "feat(release): add Phase 1 scaffold helpers"
```

---

## Task 19: Release script — Phase 2 continue checks (TDD)

**Files:**
- Modify: `scripts/release.js`
- Modify: `tests/scripts/release.test.js`

- [ ] **Step 1: Add Phase 2 verification tests**

Append to `tests/scripts/release.test.js`:

```javascript
const { verifyScaffoldsFilled, bumpManifests } = require('../../scripts/release.js');

describe('release.js Phase 2 continue', () => {
  test('verifyScaffoldsFilled throws if changelog still has TODO marker', () => {
    const fakeFs = {
      readFileSync: (p) => {
        if (p.endsWith('CHANGELOG.md')) return '## [1.1.1]\n<!-- TODO: fill in from git log below -->\n';
        if (p.endsWith('v1.1.1.md')) return '# v1.1.1\nHero text.\n';
        return '';
      },
    };
    expect(() => verifyScaffoldsFilled({ version: '1.1.1', fs: fakeFs, root: '/tmp/hc' }))
      .toThrow(/CHANGELOG.*placeholder/i);
  });

  test('verifyScaffoldsFilled throws if release notes still has TODO hero', () => {
    const fakeFs = {
      readFileSync: (p) => {
        if (p.endsWith('CHANGELOG.md')) return '## [1.1.1]\n### Fixed\n- real entry\n';
        if (p.endsWith('v1.1.1.md')) return '# v1.1.1\n<!-- TODO: hero paragraph -->\n';
        return '';
      },
    };
    expect(() => verifyScaffoldsFilled({ version: '1.1.1', fs: fakeFs, root: '/tmp/hc' }))
      .toThrow(/release notes.*placeholder/i);
  });

  test('verifyScaffoldsFilled passes when both files are clean', () => {
    const fakeFs = {
      readFileSync: (p) => {
        if (p.endsWith('CHANGELOG.md')) return '## [1.1.1]\n### Fixed\n- real\n';
        if (p.endsWith('v1.1.1.md')) return '# v1.1.1\nReal hero paragraph.\n';
        return '';
      },
    };
    expect(() => verifyScaffoldsFilled({ version: '1.1.1', fs: fakeFs, root: '/tmp/hc' })).not.toThrow();
  });

  test('bumpManifests writes new version to all three JSON files', () => {
    const written = {};
    const fakeFs = {
      readFileSync: () => JSON.stringify({ version: '1.1.0', otherField: 'keep' }, null, 2),
      writeFileSync: (p, content) => { written[p] = content; },
    };
    bumpManifests({ newVersion: '1.1.1', fs: fakeFs, root: '/tmp/hc' });
    const paths = Object.keys(written);
    expect(paths.length).toBe(3);
    for (const p of paths) {
      const parsed = JSON.parse(written[p]);
      expect(parsed.version).toBe('1.1.1');
      expect(parsed.otherField).toBe('keep');
    }
  });
});
```

- [ ] **Step 2: Run to confirm fail**

Run: `npx jest tests/scripts/release.test.js`
Expected: 4 new tests fail.

- [ ] **Step 3: Implement Phase 2 helpers**

Add to `scripts/release.js`:

```javascript
function verifyScaffoldsFilled({ version, fs: injectedFs = fs, root = ROOT }) {
  const changelogPath = path.join(root, 'CHANGELOG.md');
  const notesPath = path.join(root, 'docs/release-notes', `v${version}.md`);

  const changelog = injectedFs.readFileSync(changelogPath, 'utf8');
  if (changelog.includes('<!-- TODO: fill in from git log below -->')) {
    throw new Error(
      `CHANGELOG.md contains placeholder marker. Fill in the v${version} entry before running --continue.`
    );
  }

  const notes = injectedFs.readFileSync(notesPath, 'utf8');
  if (notes.includes('<!-- TODO: hero paragraph -->')) {
    throw new Error(
      `Release notes file ${notesPath} contains placeholder marker. Fill in the hero paragraph before running --continue.`
    );
  }
}

function bumpManifests({ newVersion, fs: injectedFs = fs, root = ROOT }) {
  for (const rel of ['package.json', 'manifest.json', 'manifest.firefox.json']) {
    const p = path.join(root, rel);
    const obj = JSON.parse(injectedFs.readFileSync(p, 'utf8'));
    obj.version = newVersion;
    injectedFs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
  }
}
```

Update exports:

```javascript
module.exports = {
  preflight,
  computeNextVersion,
  getChangelogScaffold,
  getReleaseNotesScaffold,
  scaffoldChangelogEntry,
  scaffoldReleaseNotes,
  verifyScaffoldsFilled,
  bumpManifests,
};
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx jest tests/scripts/release.test.js`
Expected: 20 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/release.js tests/scripts/release.test.js
git commit -m "feat(release): add Phase 2 scaffold verification + manifest bump"
```

---

## Task 20: Release script — entry point (Phase 1 + Phase 2 glue)

**Files:**
- Modify: `scripts/release.js`

This task wires the tested helpers into a working CLI. End-to-end behavior is verified by the dry-run in Task 21 (manual) rather than by more unit tests, since the wiring calls webpack + archiver which are awkward to mock meaningfully.

- [ ] **Step 1: Add the main CLI entry point at the bottom of scripts/release.js**

Append to `scripts/release.js` (before the `module.exports` block):

```javascript
function getLastTag({ exec = defaultExec }) {
  try {
    return exec('git describe --tags --abbrev=0').trim();
  } catch (err) {
    return null;
  }
}

function getGitLogSinceTag({ tag, exec = defaultExec }) {
  if (tag) {
    return exec(`git log ${tag}..HEAD --oneline`).trim().split('\n').filter(Boolean);
  }
  // Fallback: no prior tag exists
  console.log('[release] No prior git tag found — falling back to last 30 commits for raw material.');
  return exec('git log -n 30 --oneline').trim().split('\n').filter(Boolean);
}

function isoDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prettyDate() {
  const d = new Date();
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

async function runPhase1({ bumpType }) {
  const { currentVersion } = preflight();
  const newVersion = computeNextVersion(currentVersion, bumpType);
  console.log(`[release] ${currentVersion} → ${newVersion} (${bumpType})`);

  const lastTag = getLastTag({ exec: defaultExec });
  const gitLogLines = getGitLogSinceTag({ tag: lastTag, exec: defaultExec });

  // CHANGELOG scaffold
  const changelogPath = path.join(ROOT, 'CHANGELOG.md');
  const existing = fs.readFileSync(changelogPath, 'utf8');
  const scaffold = getChangelogScaffold({
    version: newVersion,
    date: isoDate(),
    gitLogLines,
  });
  const updated = scaffoldChangelogEntry({ existing, scaffold });
  fs.writeFileSync(changelogPath, updated);
  console.log(`[release] Scaffolded CHANGELOG.md entry for v${newVersion}`);

  // Release notes scaffold
  const notesPath = scaffoldReleaseNotes({
    version: newVersion,
    date: prettyDate(),
  });
  console.log(`[release] Scaffolded ${path.relative(ROOT, notesPath)}`);

  console.log([
    '',
    'Phase 1 complete. Now:',
    `  1. Edit CHANGELOG.md — replace the <!-- TODO: fill in from git log below --> block with real entries`,
    `  2. Edit ${path.relative(ROOT, notesPath)} — write the hero paragraph, fill in category bullets`,
    `  3. Run: npm run release -- --continue`,
  ].join('\n'));
}

async function runPhase2() {
  preflight();
  const { version: currentVersion } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  // Figure out the "next" version from the latest scaffolded CHANGELOG entry
  const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  const m = /^## \[(\d+\.\d+\.\d+)\]/m.exec(changelog);
  if (!m) throw new Error('Could not find a ## [X.Y.Z] header in CHANGELOG.md.');
  const newVersion = m[1];
  if (newVersion === currentVersion) {
    throw new Error(`CHANGELOG top entry is ${newVersion} but manifests are already at ${newVersion}. Did Phase 1 run?`);
  }

  verifyScaffoldsFilled({ version: newVersion });
  console.log('[release] Scaffolds verified filled in.');

  bumpManifests({ newVersion });
  console.log(`[release] Bumped all three manifests to ${newVersion}`);

  // Build Chrome
  console.log('[release] Building Chrome...');
  defaultExec('npm run build');
  assertDistVersion(newVersion, 'chrome');
  await zipDist(newVersion, 'chrome');

  // Build Firefox (wipes dist/ — sequential is mandatory)
  console.log('[release] Building Firefox...');
  defaultExec('npm run build:firefox');
  assertDistVersion(newVersion, 'firefox');
  await zipDist(newVersion, 'firefox');

  // Commit + tag
  defaultExec(`git add package.json manifest.json manifest.firefox.json CHANGELOG.md docs/release-notes/v${newVersion}.md`);
  defaultExec(`git commit -m "maint: cut v${newVersion} release"`);
  defaultExec(`git tag v${newVersion}`);

  console.log([
    '',
    `Local release cut complete.`,
    `  Branch: ${defaultExec('git branch --show-current').trim()}`,
    `  Tag: v${newVersion} (local only)`,
    `  Zips:`,
    `    releases/hype-control-chrome-v${newVersion}.zip`,
    `    releases/hype-control-firefox-v${newVersion}.zip`,
    '',
    'Next steps (run manually):',
    `  git push -u origin ${defaultExec('git branch --show-current').trim()}`,
    `  gh pr create --title "maint: cut v${newVersion} release"`,
    `  (after PR merge)`,
    `  git push origin v${newVersion}`,
    `  gh release create v${newVersion} --notes-file docs/release-notes/v${newVersion}.md \\`,
    `    releases/hype-control-chrome-v${newVersion}.zip \\`,
    `    releases/hype-control-firefox-v${newVersion}.zip`,
    '  Upload zips to Chrome Web Store + Firefox AMO dashboards.',
  ].join('\n'));
}

function assertDistVersion(expected, target) {
  const distManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist/manifest.json'), 'utf8'));
  if (distManifest.version !== expected) {
    throw new Error(`dist/manifest.json version (${distManifest.version}) does not match expected ${expected} for ${target} build.`);
  }
}

function zipDist(version, target) {
  return new Promise((resolve, reject) => {
    const archiver = require('archiver');
    const zipPath = path.join(ROOT, 'releases', `hype-control-${target}-v${version}.zip`);
    fs.mkdirSync(path.dirname(zipPath), { recursive: true });
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => {
      console.log(`[release] Wrote ${path.relative(ROOT, zipPath)} (${archive.pointer()} bytes)`);
      resolve();
    });
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(path.join(ROOT, 'dist'), false);
    archive.finalize();
  });
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.includes('--continue')) return { phase: 2 };
  if (args.includes('--major')) return { phase: 1, bumpType: 'major' };
  if (args.includes('--minor')) return { phase: 1, bumpType: 'minor' };
  return { phase: 1, bumpType: 'patch' };
}

async function main() {
  const { phase, bumpType } = parseArgs(process.argv);
  try {
    if (phase === 1) await runPhase1({ bumpType });
    else await runPhase2();
  } catch (err) {
    console.error(`[release] FAILED: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
```

- [ ] **Step 2: Re-run existing tests to confirm no regression**

Run: `npx jest tests/scripts/release.test.js`
Expected: 20 tests still pass (new code is entry-point glue, not exported helpers).

- [ ] **Step 3: Verify the script loads without errors**

Run: `node -e "require('./scripts/release.js')"`
Expected: No output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/release.js
git commit -m "feat(release): wire Phase 1 + Phase 2 CLI entry points"
```

---

## Task 21: Dry-run verification

**Files:**
- None (verification only)

- [ ] **Step 1: Save current state hashes for revert check**

Run: `git stash --include-untracked`
(This captures any work-in-progress before the dry run.)

Actually — preferred approach: commit everything first (done in Task 20), then use a throwaway branch for the dry run.

Run: `git checkout -b dry-run-verify`

- [ ] **Step 2: Run Phase 1 as if bumping to 1.1.1**

Run: `npm run release`
Expected:
- Preflight passes.
- `[release] 1.1.0 → 1.1.1 (patch)` printed.
- `CHANGELOG.md` has a new `## [1.1.1]` block inserted above `## [1.1.0]`.
- `docs/release-notes/v1.1.1.md` exists with the template filled in.
- Instructions printed for next steps.

- [ ] **Step 3: Verify Phase 2 fails with unfilled scaffolds**

Run: `npm run release -- --continue`
Expected: Exits with `[release] FAILED: CHANGELOG.md contains placeholder marker...`

- [ ] **Step 4: Fake-fill the scaffolds and re-run Phase 2**

Manually edit `CHANGELOG.md` — remove the `<!-- TODO: fill in from git log below -->` comment from the v1.1.1 block.
Manually edit `docs/release-notes/v1.1.1.md` — replace `<!-- TODO: hero paragraph -->` with a dummy hero line like `**Dry run.**`.

Run: `npm run release -- --continue`
Expected:
- `[release] Scaffolds verified filled in.`
- All three manifests bump to 1.1.1.
- Chrome build succeeds, `releases/hype-control-chrome-v1.1.1.zip` written.
- Firefox build succeeds, `releases/hype-control-firefox-v1.1.1.zip` written.
- Local commit `maint: cut v1.1.1 release`.
- Local tag `v1.1.1`.
- Next-steps instructions printed.

- [ ] **Step 5: Clean up — discard the dry run**

Run:
```bash
git checkout maint/release-workflow
git branch -D dry-run-verify
git tag -d v1.1.1
rm -rf releases/hype-control-chrome-v1.1.1.zip releases/hype-control-firefox-v1.1.1.zip
```

Verify `git log --oneline -5` still shows the Task 20 commit at the top (not the dry-run commit).

Verify `git tag -l` does NOT show `v1.1.1`.

If the dry run revealed any script bugs, fix them by amending earlier tasks' implementations, then re-run Task 21 from Step 2.

- [ ] **Step 6: No commit** — this task produces no artifacts.

---

## Task 22: Create retroactive git tags locally

**Files:**
- None (tagging only)

- [ ] **Step 1: Create all 7 retroactive tags**

Run:

```bash
git tag v1.0.0 f3b4d30
git tag v1.0.2 e02bd1a
git tag v1.0.3 0879faa
git tag v1.0.8 db76215
git tag v1.0.9 d915309
git tag v1.0.10 77a2334
git tag v1.1.0 c160fff
```

- [ ] **Step 2: Verify tags point at the right commits**

Run: `git tag -l --sort=-v:refname`
Expected: v1.1.0 through v1.0.0 listed.

For each tag, run: `git rev-parse <tag>`
Expected: resolves to the commit listed above.

- [ ] **Step 3: Do NOT push tags yet**

Tags will be pushed after the release workflow PR merges to `main`. Pushing before merge would publicize tags pointing at commits on an unmerged branch.

- [ ] **Step 4: No commit** — tags are git refs, not tracked files.

---

## Final Task: Open the PR

- [ ] **Step 1: Run security review on the branch**

Run: `/security-review`
Address any findings before proceeding.

- [ ] **Step 2: Push the branch**

```bash
git push -u origin maint/release-workflow
```

- [ ] **Step 3: Create the PR**

```bash
gh pr create --title "maint: add release workflow + backfill v1.0.0 -> v1.1.0 history" --body "$(cat <<'EOF'
## Summary

- Introduces `npm run release` two-phase script (Phase 1: scaffold, Phase 2: build/zip/tag).
- Adds `docs/release-notes/` user-facing notes folder with backfilled v1.0.0 → v1.1.0 files, plus `_template.md` and `README.md`.
- Backfills `CHANGELOG.md` with consolidated 0.4.28 entry + individual entries for 1.0.0, 1.0.2, 1.0.3, 1.0.8, 1.0.9, 1.0.10, 1.1.0.
- Adds `docs/dev/RELEASE-PROCESS.md` documenting the workflow.
- Adds `.github/pull_request_template.md` with lockstep checklist.
- Updates `CLAUDE.md` to point at RELEASE-PROCESS.md.
- 20 Jest tests covering release script helpers (preflight, version compute, scaffolds, Phase 2 checks, manifest bump).

## Type of change

- [x] Maintenance / refactor / docs (`maint:`)

## Test plan

- [x] Jest tests pass: `npm test`
- [x] Dry-run Phase 1 + Phase 2 against a hypothetical v1.1.1 bump (cleaned up post-run)
- [x] Retroactive tags created locally for v1.0.0 through v1.1.0 (push after merge)
- [ ] Reviewer: confirm release notes copy matches brand voice (Sharp, Cheeky, Honest)
- [ ] Reviewer: confirm CHANGELOG backfill ordering is correct

## Post-merge

After merge:
- `git push origin --tags` to publish all 7 retroactive tags
- First "real" use of `npm run release` will be v1.1.1
EOF
)"
```

- [ ] **Step 4: Report PR URL to user and stop**

Do not run `gh pr merge`. Do not push tags. Per global CLAUDE.md: PR merge and tag push require explicit user approval.

Print: `PR #<N> is open — ready to merge when you give the word.`

---

## Self-Review

Spec coverage check:
- ✅ Dual-artifact model (CHANGELOG + release-notes) → Tasks 2-11
- ✅ Release notes format (hero + bullets + platforms) → Task 2 (template), Tasks 4-10 (content)
- ✅ Firefox catch-up section convention → Task 10 (v1.1.0) + Task 3 (README precedent)
- ✅ Release script two-phase behavior → Tasks 16-20
- ✅ Preflight (clean tree / not main / manifests lockstep) → Task 16
- ✅ Version bump default + flags → Task 17
- ✅ Phase 1 scaffold (CHANGELOG + release notes) → Task 18
- ✅ Phase 2 verification + lockstep bump → Task 19
- ✅ Edge case: no prior tags → Task 18 (test + implementation)
- ✅ Zip implementation with archiver → Task 15 (dep), Task 20 (wiring)
- ✅ Specific file staging (not `git add -A`) → Task 20 (runPhase2 git add line)
- ✅ Script stops at local commit + tag → Task 20 (no push call)
- ✅ PR template content → Task 13
- ✅ `.gitignore` updates for releases/ → Task 1
- ✅ `CLAUDE.md` pointer to RELEASE-PROCESS.md → Task 14
- ✅ Retroactive tags for 7 milestones → Task 22
- ✅ Dry-run verification → Task 21
- ✅ Backfill content (all 7 release notes + CHANGELOG) → Tasks 4-11

Placeholder scan: no TBD/TODO/"implement later" patterns in task steps. All code is shown in full.

Type consistency: `preflight`, `computeNextVersion`, `getChangelogScaffold`, `getReleaseNotesScaffold`, `scaffoldChangelogEntry`, `scaffoldReleaseNotes`, `verifyScaffoldsFilled`, `bumpManifests` — names consistent across tasks 16 → 20.

Scope: 22 tasks is a single cohesive plan for one branch. No subsystem decomposition needed.
