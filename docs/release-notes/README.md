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
