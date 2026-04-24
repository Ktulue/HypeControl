# Release Workflow & CHANGELOG Backfill — Design Spec

**Date:** 2026-04-24
**Branch:** `maint/release-workflow`
**Related:** v1.1.0 dual-platform cut (`c160fff`)

---

## Problem

Hype Control has shipped 30+ versions with no git tags, no release notes artifact, and a `CHANGELOG.md` that stops at v0.4.5. The one-time Firefox 1.0.2 / Chrome 1.0.9 manifest drift happened because lockstep version bumps were a convention with no enforcement. Going forward, we need:

1. A canonical technical changelog (what shipped in each version).
2. User-facing release notes per version, written in brand voice, ready to paste into Chrome Web Store and Firefox AMO "What's new" fields.
3. A repeatable mechanical process for cutting releases that prevents lockstep drift, missed zip steps, and untagged versions.
4. A backfill that retroactively tags and documents v1.0.0 → v1.1.0 so the new process starts from a consistent state.

## Audience & Artifact Separation

Two distinct readers, two distinct files:

| Reader              | File                               | Voice       |
|---------------------|------------------------------------|-------------|
| Developers, future-self, debuggers | `CHANGELOG.md`           | Technical   |
| End users on store listings        | `docs/release-notes/vX.Y.Z.md` | Brand-voice ("Sharp, Cheeky, Honest") |

`CHANGELOG.md` is the spine — every version gets an entry, regardless of platform. Release notes files exist per version and carry the store-listing copy.

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  Developer runs `npm run release` on maint/vX.Y.Z-release │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌────────────────────────────────────┐
        │  scripts/release.js (Phase 1)      │
        │  - Preflight checks                │
        │  - Compute next version            │
        │  - Scaffold CHANGELOG block        │
        │  - Scaffold vX.Y.Z.md from template│
        │  - Pause; user fills in prose      │
        └────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│  Developer writes CHANGELOG entry + release notes prose    │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌────────────────────────────────────┐
        │  scripts/release.js (Phase 2)      │
        │  invoked with --continue           │
        │  - Verify placeholders replaced    │
        │  - Lockstep bump all 3 manifests   │
        │  - npm run build → Chrome zip      │
        │  - npm run build:firefox → FF zip  │
        │  - Git commit + tag (local only)   │
        │  - Print next-step remote commands │
        └────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│  Developer pushes branch → PR → merge → push tags →        │
│  gh release create → manual store uploads                  │
└────────────────────────────────────────────────────────────┘
```

## File Layout

```
CHANGELOG.md                              (existing — backfill + ongoing)
docs/release-notes/
  README.md                               (new — folder overview + format rules)
  _template.md                            (new — copied by release script)
  v1.0.0.md                               (new — Chrome Web Store launch)
  v1.0.2.md                               (new — Firefox AMO port)
  v1.0.3.md                               (new — friction trigger mode)
  v1.0.8.md                               (new — subdomain scope fix)
  v1.0.9.md                               (new — chat command interception)
  v1.0.10.md                              (new — chat-callout false-trigger fix)
  v1.1.0.md                               (new — dual-platform release + Firefox catch-up)
docs/dev/RELEASE-PROCESS.md               (new — workflow documentation)
scripts/release.js                        (new — release automation)
.github/pull_request_template.md          (new — checklist with CHANGELOG/notes items)
releases/                                 (new — gitignored build artifact output)
.gitignore                                (edit — add releases/)
CLAUDE.md                                 (edit — replace Versioning section with pointer to RELEASE-PROCESS.md)
package.json                              (edit — add "release" script + archiver or JSZip dependency)
```

## Release Notes Format

Every `docs/release-notes/vX.Y.Z.md` follows this shape:

```markdown
# vX.Y.Z — Month DD, YYYY

**<Hero sentence in brand voice — the headline that sells the version.>** <One to three sentences of prose reinforcing the why. No bullets in the hero paragraph.>

- **Added:** <thing>
- **Fixed:** <thing>
- **Changed:** <thing>
- **Under the hood:** <technical note relevant to curious users, optional>

_Platforms: Chrome · Firefox_
```

Rules:
- Hero paragraph is always prose, always voice-forward, never a bullet. This is the "headline" that sells the version and gets pasted as the lead line on store listings.
- Category bullets (`Added` / `Fixed` / `Changed` / `Under the hood`) are omitted entirely if empty — no "Fixed: (none)".
- `Under the hood` is reserved for things curious devs or power users will grep for (detector internals, storage migrations). Optional.
- Platforms footer is `Chrome`, `Firefox`, or `Chrome · Firefox` based on which store builds actually shipped that version.

### v1.1.0 special case — Firefox catch-up section

Because Firefox AMO shipped 1.0.2 and held there while Chrome moved through 1.0.3 → 1.0.10, Firefox users jumping to 1.1.0 get the whole backlog at once. `v1.1.0.md` is the only backfilled file that does double duty:

```markdown
# v1.1.0 — April 24, 2026

**<Hero for the dual-platform release itself.>**

- <bullets for v1.1.0 work>

## What Firefox users missed since 1.0.2

<Hero lines from v1.0.3, v1.0.8, v1.0.9, v1.0.10 aggregated as a changelog recap>

_Platforms: Chrome · Firefox_
```

This pattern becomes the documented precedent in `docs/release-notes/README.md` for any future skipped-version scenarios.

## `scripts/release.js` Behavior

Invocation: `npm run release` (patch default), `npm run release -- --minor`, `npm run release -- --major`, `npm run release -- --continue`.

### Phase 1 — Preflight + scaffold

1. **Preflight checks** (abort with clear message on any failure):
   - `git status --porcelain` is empty (clean working tree).
   - Current branch is NOT `main` or `master`.
   - All three manifests (`manifest.json`, `manifest.firefox.json`, `package.json`) agree on current version. If they drift, print the drift and abort — user fixes manually before re-running.
2. **Compute next version** from current `package.json` version:
   - Default: patch bump.
   - `--minor`: minor bump, patch resets to 0.
   - `--major`: major bump, minor + patch reset to 0.
3. **Scaffold artifacts:**
   - Append a `## [X.Y.Z] — YYYY-MM-DD` skeleton to the top of `CHANGELOG.md` below the header. Stubs for `### Added` / `### Fixed` / `### Changed`. Include a comment `<!-- TODO: fill in from git log below -->` and a fenced code block containing the output of `git log <last-tag>..HEAD --oneline` as raw material.
   - Copy `docs/release-notes/_template.md` → `docs/release-notes/vX.Y.Z.md` with date + version filled in. Hero paragraph is the literal placeholder `<!-- TODO: hero paragraph -->`.
   - Print instructions: "Edit the two files above, then run `npm run release -- --continue`."
4. **Exit** (no manifest changes yet — fully reversible).

### Phase 2 — Continue (ship)

1. **Verify scaffolds filled in:**
   - `docs/release-notes/vX.Y.Z.md` must not contain `<!-- TODO: hero paragraph -->`.
   - `CHANGELOG.md`'s latest block must not contain `<!-- TODO: fill in from git log below -->`.
   - If either check fails, abort with a pointer to the unfilled file.
2. **Lockstep bump manifests** — edit `manifest.json`, `manifest.firefox.json`, `package.json` to new version. Verify all three write successfully.
3. **Build Chrome:** `npm run build`. Verify `dist/manifest.json` version matches the bump. Zip `dist/` contents to `releases/hype-control-chrome-vX.Y.Z.zip`.
4. **Build Firefox:** `npm run build:firefox`. Verify `dist/manifest.json` version matches the bump. Zip `dist/` contents to `releases/hype-control-firefox-vX.Y.Z.zip`.
5. **Commit + tag locally:**
   - Stage only the files this release touched, by path — NOT `git add -A`:
     - `manifest.json`, `manifest.firefox.json`, `package.json` (manifest bumps)
     - `CHANGELOG.md` (new entry)
     - `docs/release-notes/vX.Y.Z.md` (new file)
   - `git commit -m "maint: cut vX.Y.Z release"`.
   - `git tag vX.Y.Z`.
6. **Print next steps** (script does NOT push):
   ```
   Local release cut complete.
   Branch: maint/vX.Y.Z-release
   Tag: vX.Y.Z (local only)
   Zips: releases/hype-control-chrome-vX.Y.Z.zip
         releases/hype-control-firefox-vX.Y.Z.zip

   Next steps (run manually):
     git push -u origin maint/vX.Y.Z-release
     gh pr create --title "maint: cut vX.Y.Z release" --body-file docs/release-notes/vX.Y.Z.md
     (after PR merge)
     git push origin vX.Y.Z
     gh release create vX.Y.Z --notes-file docs/release-notes/vX.Y.Z.md \
       releases/hype-control-chrome-vX.Y.Z.zip \
       releases/hype-control-firefox-vX.Y.Z.zip
     Upload zips to Chrome Web Store + Firefox AMO dashboards.
   ```

### Why two phases

The user must write release notes content by hand — it's a creative act, not automatable. Phase 1 scaffolds; Phase 2 tags and builds. This prevents the footgun of "tag pushed before notes were written."

### Why the script doesn't push or create GitHub releases

Per the user's global CLAUDE.md: remote-affecting actions (pushes, PR creation, GitHub Releases) require explicit user approval. The script does everything local-and-reversible, prints the exact remote commands for the user to run.

### Zip implementation

Use `archiver` npm package as a `devDependency`. It's the standard Node library for zip creation, cross-platform on Windows, and has no native compile step. Node built-in `zlib` doesn't produce zip archives directly, so `archiver` is the correct tool.

### Edge case: no prior tags

The very first Phase 1 run (before backfill adds retroactive tags) won't find a `<last-tag>`. In this case, `git log <last-tag>..HEAD` fails. Handle gracefully: if `git describe --tags --abbrev=0` returns non-zero, fall back to the last 30 commits (`git log -n 30 --oneline`) for the scaffold block and print a one-line notice. After backfill merges and v1.1.0 is tagged on the remote, this fallback path is no longer reachable in practice.

## Pull Request Template

`.github/pull_request_template.md` contents — shown whenever a PR is opened via `gh pr create` or the GitHub UI:

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

The template is not enforced by CI — GitHub renders it as the PR body default. The author can delete items that don't apply. Its purpose is to surface the CHANGELOG / release-notes / lockstep requirements at PR-creation time, which is the point where the 1.0.2 / 1.0.9 drift could have been caught.

## Backfill Content Plan

### Version mapping

| Version | Commit    | Date       | Platforms         | Headline theme                                                                          |
|---------|-----------|------------|-------------------|-----------------------------------------------------------------------------------------|
| v1.0.0  | `f3b4d30` | 2026-03-23 | Chrome            | Public launch on Chrome Web Store. End of private testing, start of public friction.   |
| v1.0.2  | `e02bd1a` | 2026-04-10 | Firefox (first)   | Firefox users, welcome in. Same friction, same math, now on AMO.                        |
| v1.0.3  | `0879faa` | 2026-04-13 | Chrome            | Two ways to trigger: Price Guard (only when we see a price) or Zero Trust (everything). |
| v1.0.8  | `db76215` | 2026-04-15 | Chrome            | Dashboard subdomain no longer gets friction when you're running your own stream.        |
| v1.0.9  | `d915309` | 2026-04-20 | Chrome            | Chat commands were the loophole. `/gift` and `/subscribe` now go through friction too.  |
| v1.0.10 | `77a2334` | 2026-04-23 | Chrome            | Resub callouts were false-triggering. Detector now knows chat-callouts aren't purchases.|
| v1.1.0  | `c160fff` | 2026-04-24 | Chrome + Firefox  | Dual-platform parity. Firefox catches up with everything since 1.0.2.                   |

Dates are best-effort from git log and may need adjustment when writing the files — authoritative source is the commit date.

### CHANGELOG backfill approach

- Append new entries above the existing `## [0.4.5]` block so newest-first ordering is preserved.
- Final ordering after backfill: `## [1.1.0]` → `## [1.0.10]` → `## [1.0.9]` → `## [1.0.8]` → `## [1.0.3]` → `## [1.0.2]` → `## [1.0.0]` → `## [0.4.28]` (consolidated) → `## [0.4.5]` → rest.
- Each backfilled entry uses the existing dev-facing format (`### Added` / `### Fixed` / `### Changed`). Technical voice only — the engineering record, not the user-facing copy.
- The 0.4.6 → 0.4.28 gap is covered by one consolidated `## [0.4.28] — 2026-03-22` entry summarizing pre-launch polish (spending history, savings calendar, input validation, tracker-reset fix, UI rebrand, onboarding tour). No reconstruction of 23 intermediate patches.

### Retroactive git tags

After backfill merges to `main`:
- `git tag v1.0.0 f3b4d30`
- `git tag v1.0.2 e02bd1a`
- `git tag v1.0.3 0879faa`
- `git tag v1.0.8 db76215`
- `git tag v1.0.9 d915309`
- `git tag v1.0.10 77a2334`
- `git tag v1.1.0 c160fff`
- `git push origin --tags`

The release script's preflight "last tag exists" check works from v1.1.0 forward once these are pushed.

## Implementation Order

1. Scaffold folder structure: `docs/release-notes/`, `scripts/`, `releases/` (with `.gitkeep`).
2. Write `docs/release-notes/_template.md` and `docs/release-notes/README.md`.
3. Write release notes prose for v1.0.0, v1.0.2, v1.0.3, v1.0.8, v1.0.9, v1.0.10, v1.1.0 (with v1.1.0 including the Firefox catch-up section).
4. Write CHANGELOG entries: consolidated 0.4.28 summary, then 1.0.0 → 1.1.0 milestones in technical voice.
5. Write `docs/dev/RELEASE-PROCESS.md` documenting the two-phase `npm run release` flow.
6. Write `scripts/release.js`.
7. Write `.github/pull_request_template.md`.
8. Edit `CLAUDE.md`: replace the existing `## Versioning` + `## Build` sections with a pointer to `RELEASE-PROCESS.md` (keep the lockstep rule visible as a one-liner for quick reference).
9. Edit `package.json`: add `"release"` script entry, add `archiver` devDependency.
10. Edit `.gitignore`: add `releases/`.
11. Dry-run: simulate a `v1.1.1` bump, verify all phases, revert (no commit).
12. Commit the full backfill.
13. Open PR. After merge, push the 7 retroactive tags in one `git push origin --tags` call.

## Small Decisions (Locked In)

- **Conventional Commits:** documented as convention in `RELEASE-PROCESS.md`, NOT enforced via git hook. Existing informal usage (`feat:` / `fix:` / `maint:`) is already good enough.
- **Version bump default:** patch. `--minor` / `--major` flags override. Matches existing CLAUDE.md rule to "only increment patch" unless explicitly instructed.
- **Script aborts if on `main` / `master`:** enforces the global branching rule that all work (including release cuts) lives on a feature branch.
- **Zip naming:** `hype-control-chrome-vX.Y.Z.zip` / `hype-control-firefox-vX.Y.Z.zip`. Matches `package.json` name slug and the existing Firefox AMO convention. Chrome zips change from `hypecontrol-` to `hype-control-chrome-` going forward.
- **`releases/` folder:** gitignored, local-only build output. Not checked into the repo.
- **No release script auto-push:** script stops at local commit + tag. User runs push commands manually (per global rule on remote-affecting actions).
- **No GitHub Actions automation in this spec:** CI-based releases are out of scope (Option C rejected in brainstorming — manual store upload blocks most of the value).

## Out of Scope

- GitHub Actions / CI release pipeline.
- Conventional Commits enforcement via commit hooks.
- Reconstructing individual 0.4.6 → 0.4.27 CHANGELOG entries (covered by consolidated 0.4.28 summary).
- Chrome Web Store API upload automation (requires manual dashboard consent regardless).
- Firefox AMO API upload automation (same reason).
- `release-please` / `changesets` tooling.
- Backfilling release notes for 0.x versions — only the 1.0.x → 1.1.0 milestones get notes files.
- Renaming prior Chrome zip uploads on the Chrome Web Store (naming change applies going forward only).

## Success Criteria

- `npm run release` + `npm run release -- --continue` cuts a working local release with both zips, correct manifests, correct tag.
- `git tag -l` shows all 7 retroactive tags after backfill merges.
- `CHANGELOG.md` has continuous entries from v0.4.5 (oldest kept) through v1.1.0 (newest).
- `docs/release-notes/v1.1.0.md` is the file you paste into both Chrome Web Store and Firefox AMO "What's new" boxes with zero editing (Chrome gets hero + bullets, Firefox gets hero + bullets + catch-up section).
- `.github/pull_request_template.md` has checkboxes that catch a missing CHANGELOG or release notes file before a version-bump PR gets merged.
- Future `npm run release -- --minor` cuts produce store-ready artifacts with no manual ceremony beyond writing the prose.
