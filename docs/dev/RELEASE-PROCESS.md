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
