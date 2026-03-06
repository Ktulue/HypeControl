## Version Management

Always bump version in both files BEFORE attempting the build. The build must happen after versioning so the dist output reflects the new version.

## Versioning

After any successful code change, always bump the patch version in both `manifest.json` and `package.json` before finishing. Only increment the patch number (e.g., 0.3.17 -> 0.3.18). Never bump minor or major versions unless explicitly instructed.

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

- **MTS-TODO.md** — Mark completed items with `[x]`, update phase statuses, set the `Updated` date and `Current Version` in the header, and update the footer timestamp.
- **MTS-Project-Document.md** — If a feature's status has changed (e.g., a previously unimplemented MVP part is now done), update the relevant section to reflect the current state.
