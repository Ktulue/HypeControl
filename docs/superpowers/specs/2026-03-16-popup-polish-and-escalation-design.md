# Popup Polish & Dynamic Intensity Escalation

**Date:** 2026-03-16
**Branch:** `maint/popup-polish-and-escalation`
**Status:** Approved

---

## Summary

Maintenance pass bundling 6 fixes: toggle alignment, tour button relocation, weekly reset day preference, history summary centering, dynamic intensity escalation based on spending thresholds, and history metric color parity with popup stats. Also changes the default friction intensity from Medium to Low to complement the new escalation system.

---

## Fix 1 — Toggle Vertical Alignment (CSS)

**Problem:** Toggle switches across Friction, Limits, and Channels sections don't align vertically because `.hc-label` uses `min-width: 110px`, which is too narrow for longer labels like "Spending cooldown".

**Solution:** Increase `.hc-label` `min-width` from `110px` to `140px` in `popup.css`. This accommodates the longest current label plus ~10px buffer, ensuring all toggles snap to the same vertical column.

**Files:** `src/popup/popup.css`

---

## Fix 2 — Relocate Replay Tour Button

**Problem:** The "Replay setup tour" button exists in two places (footer link + Settings section button), is squeezed between Bug/Ideas links and Save Settings, and competes visually with more important actions.

**Solution:**
- Remove `<a id="footer-replay-tour">↺ Tour</a>` from the footer in `popup.html`
- Remove `<div class="hc-row hc-row--replay">` and its button from the Settings section
- Add a single `↺ Replay Setup Tour` button as the **last element** inside `.hc-content`, below the Credits section
- Style subdued: secondary button, smaller font, generous `margin-top` (~24px) and `padding-bottom` so it breathes away from Credits
- Remove `.hc-row--replay` and `.btn-replay-tour` CSS rules; add new `.btn-replay-bottom` styles
- In `popup.ts`, remove the old `footer-replay-tour` click handler; wire the new button ID

**Files:** `src/popup/popup.html`, `src/popup/popup.css`, `src/popup/popup.ts`

---

## Fix 3 — Weekly Reset Day Preference

**Problem:** Weekly spending cap reset is hardcoded to Monday. Some users think in Sunday-start weeks.

**Solution:**
- Add `weeklyResetDay: 'monday' | 'sunday'` to `UserSettings` in `types.ts`, default `'monday'`
- Add migration in `migrateSettings()` for existing users (set to `'monday'`)
- Add a segmented control (Mon / Sun) in the Limits section of `popup.html`, visible when weekly cap is enabled (alongside the weekly cap amount input)
- Bind the control in `popup.ts` to pending state
- Update `getCurrentWeekStart()` in `src/content/interceptor.ts` to accept the reset day preference and compute either Monday-start or Sunday-start weeks
- Update the `weeklyStartDate` comment in `types.ts` (currently says "Monday") to reflect that it could be Sunday depending on preference

**Files:** `src/shared/types.ts`, `src/popup/popup.html`, `src/popup/popup.ts`, `src/popup/popup.css` (reuses `.segmented` styles, may need conditional visibility rule), `src/content/interceptor.ts`

---

## Fix 4 — History Summary Bar True-Center

**Problem:** The 6 metric cards in the spending history summary bar are horizontally centered (`text-align: center`) but not vertically centered. Cards with different value lengths (e.g., "0" vs "$1,234.56") look uneven.

**Solution:**
- Add `justify-content: center` and `align-items: center` to `.summary-metric` in `history.css`
- Add a consistent `min-height` (e.g., `80px`) so all cards are the same height and content is dead-center on both axes

**Files:** `src/history/history.css`

---

## Fix 5 — Dynamic Intensity Escalation

**Problem:** Friction intensity is static — users pick a level and it never changes regardless of how close they are to their spending limits. This means a user on Low gets the same friction at 5% of their cap as at 99%.

**Solution:** Intensity auto-escalates based on the highest threshold percentage across all active caps (daily/weekly/monthly):

| Threshold Range | Color  | Escalated Intensity |
|----------------|--------|-------------------- |
| Under 60%      | Green  | No change (base)    |
| 60–79%         | Yellow | Medium              |
| 80–99%         | Orange | High                |
| 100%+          | Red    | Extreme             |

**Rules:**
- Escalation only goes **up** from the user's base intensity, never below it
- The **highest %** across all active caps determines the tier
- When any spending period resets (daily/weekly/monthly), intensity resets to the user's base setting
- When **no caps are enabled**, no escalation occurs — the user's base intensity is used as-is
- A **lock toggle** on the right side of the Intensity segmented control prevents all auto-escalation when engaged
- An **info icon** (ⓘ) next to the lock explains the feature on hover: "Intensity auto-adjusts as you approach your spending limits. Lock to keep your chosen level."

**New settings fields:**
- `intensityLocked: boolean` — default `false`
- Add `intensityLocked` to `migrateSettings()` with default `false` for existing users
- Existing `frictionIntensity` serves as the user's base/floor

**Default intensity change:**
- `DEFAULT_SETTINGS.frictionIntensity` changes from `'medium'` to `'low'`
- Onboarding wizard: move `active` class from `data-value="medium"` to `data-value="low"` button
- Onboarding wizard: update skip-confirmation text from "Medium friction" to "Low friction"
- Onboarding wizard: update `wizard-friction-desc` default text to match Low description
- Existing users are NOT migrated — their chosen intensity is preserved

**UI treatment for escalated state:**
Both Intensity segmented controls (Stats `#stats-intensity` and Friction `#friction-intensity`) need to reflect escalated state:
- When escalation is active, the **escalated level** button gets a distinct highlight (e.g., pulsing border or different accent color like the threshold tier color) while the **user's base level** retains a subtle underline or dot indicator
- A small label appears below the control: "↑ Auto-escalated from Low" (showing the base level)
- When locked, the lock icon is filled/highlighted and no escalation visual appears
- Both controls must stay in sync — changing intensity on either updates both + the pending state

**Implementation:**
- New function `computeEscalatedIntensity(baseIntensity, maxPercent, locked)` in `src/content/interceptor.ts` alongside existing spending logic
- After computing max % across all active caps, this function returns the effective intensity
- The popup and overlay both read the effective intensity (not the raw setting) when determining friction level
- The escalated intensity is NOT written back to `UserSettings` — it's computed on the fly so the user's base preference is never overwritten

**Files:** `src/shared/types.ts`, `src/content/interceptor.ts`, `src/popup/popup.html`, `src/popup/popup.ts`, `src/popup/popup.css`

---

## Fix 6 — History Summary Metric Colors Match Popup Stats

**Problem:** The spending history summary bar only colors the "Total Saved" metric green. The other metrics (Cancel Rate, Top Cancel Step, etc.) use default text color, while the popup stat tiles have distinct colors for each: Saved = green, Cancel Rate = amber, Best Step = purple, Blocked = default.

**Solution:** Add color overrides to `history.css` matching the popup's stat tile scheme:
- `#metric-saved .metric-value` — `var(--success)` (already done)
- `#metric-cancel-rate .metric-value` — `#f59e0b` (amber, matches `.stat-tile--rate`)
- `#metric-top-step .metric-value` — `var(--accent)` (purple, matches `.stat-tile--step`)
- `#metric-spent .metric-value` — `var(--danger)` (red — spent money is the "warning" counterpart to saved)
- `#metric-count .metric-value` and `#metric-top-reason .metric-value` — keep default (no direct popup equivalent)

**Files:** `src/history/history.css`

---

## Files Summary

| File | Fixes |
|------|-------|
| `src/popup/popup.css` | 1, 2, 3, 5 |
| `src/popup/popup.html` | 2, 3, 5 |
| `src/popup/popup.ts` | 2, 3, 5 |
| `src/shared/types.ts` | 3, 5 |
| `src/content/interceptor.ts` | 3, 5 |
| `src/history/history.css` | 4, 6 |
| `manifest.json` | version bump |
| `package.json` | version bump |
| `HypeControl-TODO.md` | post-work update |
