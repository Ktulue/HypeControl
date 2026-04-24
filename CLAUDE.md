## Versioning

After any successful code change, always bump the patch version in **all three** of these files before finishing the task:

- `manifest.json` (Chrome/Edge)
- `manifest.firefox.json` (Firefox AMO)
- `package.json`

All three must stay in lockstep — never bump one without the others. Only increment the patch number (e.g., `1.0.9` → `1.0.10`). Never bump the minor or major number unless explicitly instructed.

The bump must happen **before** `npm run build` so the `dist/` output reflects the new version. Attempt `npm run build` once after the bump; if it fails for any reason, do not retry — ask the user to run it manually.

## Currency Math

Always round currency values to 2 decimal places at computation time using `Math.round(value * 100) / 100`, not just at display time. This applies to all accumulated values like `dailyTotal` and `sessionTotal` in `SpendingTracker`.

## Storage Conventions

- User settings (`UserSettings`) are stored in `chrome.storage.sync`.
- Transient spending data (`SpendingTracker`) is stored in `chrome.storage.local`.

Do not mix these up. Settings sync across devices; spending data is local only.

## Settings Migration

When adding new settings fields:

1. Add the field to the `UserSettings` interface in `src/shared/types.ts`.
2. Provide a default value in `DEFAULT_SETTINGS`.
3. Handle the new field in `migrateSettings()` so existing users get the default on upgrade.

## Build

Attempt npm run build once after versioning. If the build fails for any reason (path issues, shell errors, etc.), do not retry. Instead, tell the user to run npm run build manually in their own terminal.

## Post-Work Updates

After completing any work, update these files before finishing:

- **docs/dev/HypeControl-TODO.md** — Mark completed items with `[x]`, update phase statuses, set the `Updated` date and `Current Version` in the header, and update the footer timestamp.
- **docs/dev/HC-Project-Document.md** — If a feature's status has changed (e.g., a previously unimplemented MVP part is now done), update the relevant section to reflect the current state.

---

## Design Context

### Users
Twitch viewers and streamers prone to impulse spending on gift subs, Bits, and subscriptions. They're using HypeControl voluntarily — they *want* to be stopped. Context of use: mid-session, emotionally engaged, often in the middle of a hype moment. The interface needs to cut through that energy without being annoying or preachy.

### Brand Personality
**Sharp, Cheeky, Honest.**

HypeControl has a full voice. It's the friend who grabs your wrist before you tap "confirm" and says "bro, that's 16 hot dogs." Not a lecture — a reality check with a smirk. The copy, comparison items, overlay labels, and tooltips all carry this personality. The tool is blunt by design; the tone makes it bearable.

### Aesthetic Direction
**Lives in Twitch's world, owns its corner of it.** Twitch owns `#9146FF` purple + Roobert + `#18181b`. After testing against the extension's own logo and icon, HypeControl adopted purple as its primary accent — not Twitch's exact shade, but a complementary one that harmonizes with the icon rather than clashing with it:

- **Primary accent:** Purple `#9147ff` (dark mode) / `#7c3aed` (light mode). Chosen to match the logo/icon palette after real-world testing.
- **Success/savings state:** Electric Green `#22C55E`. "You didn't spend it" should feel like a win.
- **Danger/warning:** Keep red (`#E91916`) — universally understood for stop/alert states.
- **Base palette:** Keep `#18181b` / `#1f1f23` / `#0e0e10` — the dark base is correct and fits the platform context.

**Typography:**
- **UI font:** Space Grotesk — geometric, sharp, personality-forward. Free on Google Fonts. Use for all headings, labels, and body text.
- **Numeric/currency font:** Space Grotesk Mono (or system monospace fallback) — keeps prices and spending totals visually distinct and precise.
- Load Space Grotesk from Google Fonts or bundle it; do not rely on system font fallback for headings.

**Visual tone:** Dark, high-contrast, deliberately uncomfortable in friction states. Clean and precise in settings/stats states. The overlay should feel like it costs something to dismiss — not because it's ugly, but because it's commanding.

### Design Principles

1. **Friction is the feature.** The discomfort is intentional. Don't smooth it away with soft shadows or apologetic copy. Own it.
2. **Numbers are the hero.** Currency values, work-hour conversions, and comparison items should always be the most prominent element on screen. Design around the data.
3. **Voice over chrome.** Personality lives in copy, not decoration. Avoid adding visual noise to compensate for bland text — write better text instead.
4. **Distinct, not foreign.** The extension lives inside Twitch. It should feel deliberate and purposeful against that backdrop — not jarring or broken. Dark base, sharp accents, no pastels.
5. **Green means saved.** The success color (`#22C55E`) should always signal money not spent. Use it consistently and only for that semantic meaning.
