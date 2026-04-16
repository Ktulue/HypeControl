# Fix: Scope HC to www.twitch.tv Only (#40)

**Date:** 2026-04-15
**Issue:** [#40](https://github.com/Ktulue/HypeControl/issues/40)
**Type:** Bug fix

## Problem

HC uses `https://*.twitch.tv/*` in both manifests, causing the content script to inject on every Twitch subdomain — `docs.twitch.tv`, `dashboard.twitch.tv`, `clips.twitch.tv`, etc. The HC shield appears on pages where no spending is possible.

## Decision

Manifest-only fix. Replace `https://*.twitch.tv/*` with `https://www.twitch.tv/*` in all match patterns. No runtime code changes.

### Alternatives considered

- **Runtime URL guard in content script:** Rejected. Solves a manifest problem with runtime code. Script still loads on every subdomain before bailing out.
- **Manifest + runtime guard:** Rejected. Redundant — manifest match is authoritative.

## Changes

### `manifest.json` — 3 locations

| Field | Before | After |
|---|---|---|
| `host_permissions` | `https://*.twitch.tv/*` | `https://www.twitch.tv/*` |
| `content_scripts[0].matches` | `https://*.twitch.tv/*` | `https://www.twitch.tv/*` |
| `web_accessible_resources[0].matches` | `https://*.twitch.tv/*` | `https://www.twitch.tv/*` |

### `manifest.firefox.json` — same 3 locations

Identical changes.

## Edge Cases

- **Bare `twitch.tv` (no www):** Twitch 301-redirects to `www.twitch.tv`. The manifest match catches it after redirect.
- **Future spending subdomains:** If Twitch moves purchases to a subdomain, add it to manifests in a future release.

## Testing

1. Load unpacked extension.
2. Visit `dashboard.twitch.tv` — no HC shield.
3. Visit `www.twitch.tv/<channel>` — HC shield present, interception works normally.
