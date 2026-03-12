# HypeControl Settings UI Redesign — Design Spec

**Date:** 2026-03-12
**Status:** Approved
**Version target:** post-0.4.7

---

## Problem Statement

HypeControl's settings are split across a popup (`popup.html`) and a separate options page (`options.html`). The options page is unreachable from the popup UI — there is no button or link to navigate there. The right-click → Options approach does not reliably work. Users cannot discover or access settings through normal extension interaction.

Additionally, the options page is a long flat scroll of ~50 controls across 12 sections with no grouping, navigation, or visual hierarchy.

---

## Goals

1. Make all settings reachable from a single left-click on the extension icon
2. Organize controls into logical sections with clear navigation
3. Give users a persistent "where am I" indicator as they scroll
4. Keep the dashboard (stats + live controls) immediately visible on open
5. Require explicit save so users always know when changes are pending

---

## Non-Goals

- Changing any existing setting behavior or storage logic
- Adding new settings fields (separate feature work)
- Changing the friction overlay or interception logic
- Rebuilding the logs page

---

## Architecture Decision

### Single consolidated popup

All settings move into an enlarged popup (`popup.html`). The options page (`options.html`) is retired — it will display a deprecation notice or be removed entirely.

**Popup dimensions:** 500px wide × 580px tall.

> **CSS implementation:** Set `body { width: 500px; height: 580px; overflow: hidden; display: flex; flex-direction: column; }`. The header and footer are fixed-height flex children. The content area uses `flex: 1; overflow-y: auto;` to fill the remaining space and scroll. This produces sticky header/footer with a scrollable middle without relying on `position: sticky` fighting the browser popup chrome.

**No more `chrome.runtime.openOptionsPage()` dependency.** Settings are accessible via left-click on the extension icon only.

---

## Layout

```
┌──────────────────────────────────────────┐  500px
│             Hype Control                 │  ← header (centered, fixed height ~48px)
├───────────────────────────┬──────────────┤
│                           │  ● Stats     │
│  scrollable content       │    Friction  │
│  (~390px wide,            │    Comparisons│
│   flex: 1, overflow-y)    │    Limits    │
│                           │    Channels  │
│                           │    Settings  │
├───────────────────────────┴──────────────┤
│       [ 💾 Save Settings ]       v0.x.x  │  ← footer (centered btn, version right, fixed height ~48px)
└──────────────────────────────────────────┘
```

### Header
- "Hype Control" title, centered
- Fixed height (~48px), does not scroll

### Right-side navigation (scroll-spy)
- Sticky column, ~110px wide, full height of content area
- Lists all 6 section names: Stats · Friction · Comparisons · Limits · Channels · Settings
- Active section highlighted as user scrolls (see Navigation Behavior for IntersectionObserver spec)
- Clicking a label smooth-scrolls to that section
- Always shows all 6 labels — no hiding or collapsing

### Content area
- ~390px wide, `flex: 1`, `overflow-y: auto`
- All 6 sections stacked vertically
- Each section has a visually distinct heading used as the IntersectionObserver target
- Section order matches nav order top-to-bottom

### Footer
- Fixed height (~48px), does not scroll
- `[ 💾 Save Settings ]` button — centered
- Version string (e.g., `v0.4.8`) — right-aligned within footer
- Changes are NOT persisted until Save is pressed (see Save Behavior)
- Footer is always visible to reinforce the save habit

---

## Sections

### Section 1 — Stats

Runtime dashboard. Visible immediately on popup open.

**Controls:**
- 4 stat tiles (read-only): Saved · Blocked · Cancel Rate · Best Step
- Streaming override button: toggles a 2-hour bypass window; shows countdown when active ("Active — 1h 45m remaining") or "No active override"
- Friction intensity quick-switch: segmented control `[Low] [Med] [High] [Extreme]`
- Threshold quick-toggle: `Thresholds: [●] enabled`

**Notes:**
- The intensity quick-switch and threshold quick-toggle are **mirrors of the Friction and Limits section controls respectively**. They read from and write to the same in-memory pending state. They require Save to persist — they are not special-cased as immediate saves.
- The streaming override button **does save immediately** on click (it is runtime state, not a UserSettings field — see Save Behavior for the storage key).
- Stats tiles are read-only and never require saving.

---

### Section 2 — Friction

Configuration for the friction overlay behavior.

**Controls:**
- Hourly rate: number input ($/hour)
- Tax rate: number input (%)
- Friction intensity: segmented control `[Low] [Med] [High] [Extreme]` — same in-memory value as the Stats quick-switch; both controls reflect the same pending state field
- Delay timer: toggle + segmented duration `[5s] [10s] [30s] [60s]` (duration selector hidden when toggle is off)
- Threshold tiers: toggle + (when enabled):
  - Friction floor input ($)
  - Friction ceiling input ($)
  - Soft nudge steps input (number)

---

### Section 3 — Comparisons

Manage the comparison items library used in friction overlays.

**Controls:**
- Unified list of all items (presets + custom), displayed in user-defined order
- Each row contains:
  - Drag handle (leftmost) — reorder via drag-and-drop
  - Enable toggle
  - Emoji display
  - Item name + price
  - Friction scope selector: `[Nudge] [Full] [Both]` (visible only when item is enabled)
  - Edit button (pencil icon) — custom items only
  - Delete button (×) — custom items only
- "Add Custom Item" button below list
- Add/Edit sub-panel (slides in inline when Add or Edit is clicked):
  - Emoji input (4-char max)
  - Item name input
  - Price input
  - Plural label input
  - Similarity warning (if name is too close to existing item) with Confirm / Cancel
  - Save / Cancel buttons

**Comparison sub-panel save semantics:**
The sub-panel Save button commits the new/edited item to **in-memory pending state only** — not directly to `chrome.storage`. The item appears immediately in the list but is not persisted until the user presses the main `[ 💾 Save Settings ]` footer button. If the popup is closed without saving, the new/edited item is lost. This is consistent with the overall pending-state model. The sub-panel Cancel discards the form without modifying the list.

> **UX note:** Consider adding a subtle "unsaved changes" indicator (e.g., an asterisk on the footer button or a banner) so users know a save is needed — especially important after adding a comparison item.

**Future enhancement (noted, not in scope):**
- Positional dropdown on each row ("Move to position: [N▼]") as a complement to drag-and-drop for precision reordering and accessibility.

---

### Section 4 — Limits

Hard spending limits and cooldown controls.

**Controls:**
- Daily cap: toggle + amount input ($) (amount hidden when toggle is off)
- Spending cooldown: toggle + duration dropdown `[5 min] [10 min] [30 min]` (dropdown hidden when toggle is off)
- Spending tracker:
  - Daily total display (read-only)
  - Session total display (read-only)
  - Reset Tracker button (danger style, requires inline confirmation before executing)

---

### Section 5 — Channels

Per-channel and streaming configuration.

**Controls:**
- Streaming mode: toggle + (when enabled):
  - Twitch username input
  - Grace period input (minutes)
  - Log bypassed purchases toggle
- Channel whitelist:
  - Username input + "Add Channel" button
  - List of entries, each with:
    - Channel name (monospace)
    - Behavior dropdown: `[Skip] [Reduced] [Full]`
    - Delete button
  - Behavior legend (brief description of each mode)

---

### Section 6 — Settings

App preferences and utilities.

**Controls:**
- Theme preference: dropdown `[Auto] [Light] [Dark]`
- Toast duration: number input (1–30 seconds)
- View Activity Logs: button

> **View Logs implementation:** `chrome.tabs.create({ url: chrome.runtime.getURL('logs.html') })`. No additional manifest permissions required — `chrome.tabs.create` for extension-owned URLs does not require the `tabs` permission.

---

## Save Behavior

### Pending state model

All UserSettings form inputs write to an **in-memory pending state object** (a local copy of UserSettings), not directly to `chrome.storage`. Pressing `[ 💾 Save Settings ]` calls `chrome.storage.sync.set({ hcSettings: pendingState })`.

If the user closes the popup without saving, pending changes are discarded with no confirmation dialog. The persistent footer button is the reminder.

### Immediate saves (exceptions to pending state)

Two interactions bypass the pending state model and write directly to storage:

| Interaction | Storage | Key |
|---|---|---|
| Streaming override button | `chrome.storage.sync` | `hcSettings.streamingOverride` (a field within the existing `UserSettings` object stored under key `hcSettings`) |
| Reset Tracker button | `chrome.storage.local` | Existing tracker key (unchanged from current implementation) |

> **Clarification on streaming override storage:** `streamingOverride` is a field of `UserSettings` (type `{ expiresAt: number } | undefined`) and is stored inside `hcSettings` in `chrome.storage.sync`. The streaming override button writes `{ ...currentSettings, streamingOverride: { expiresAt: Date.now() + 7200000 } }` (or removes the field to cancel) directly to `chrome.storage.sync` without going through the pending state, since it is a runtime toggle with no other pending fields to conflict with.

### Bidirectional sync (intensity + threshold)

The Stats section intensity quick-switch and the Friction section intensity control share a single field in the in-memory pending state (`frictionIntensity`). Both controls read from and write to this same pending state field. No special sync mechanism is needed — updating either control updates the shared value, and both controls re-render from that value. Same applies to the threshold enabled toggle shared between Stats and Limits (`frictionThresholds.enabled`).

---

## Navigation Behavior

### Scroll-spy implementation

```
root:       the scrollable content div (not window/viewport)
rootMargin: "-20% 0px -70% 0px"
threshold:  0
targets:    the <h2> or section heading element of each of the 6 sections
```

When a section heading enters the intersection zone (top 30% of the content div), the corresponding nav label becomes active. This fires reliably for short sections at the top and long sections in the middle. Only one label is active at a time — when a new section activates, the previous one deactivates.

### Direct navigation

Clicking a right-side nav label calls `sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' })` on the section's container element (not just the heading).

### No Back/Next buttons

Scroll is the primary navigation in this implementation. Back/Next buttons are not included (see Future Polish for the animated approach that would reintroduce them).

---

## Future Polish (noted, out of scope)

**Approach B — Animated section transitions**
When clicking a nav label, use a horizontal slide animation (150ms, direction-aware — scrolling down slides content up, scrolling up slides content down). Makes navigation feel fluid and communicates spatial position.

**Approach C — Numbered stepper nav**
The right-side nav becomes a numbered stepper (1 · Stats, 2 · Friction, etc.) with active highlight and visited-state indicators. Back/Next buttons return as sequential navigation controls.

**Positional dropdown for Comparisons reorder**
Each comparison item row gets a "Move to position: [N▼]" dropdown as a complement to drag-and-drop. Useful for precision reordering and keyboard/accessibility use cases.

---

## Files Affected

| File | Change |
|---|---|
| `src/popup/popup.html` | Full rebuild — new layout, all sections |
| `src/popup/popup.ts` | Full rebuild — scroll-spy, save logic, section controllers |
| `src/popup/popup.css` | Full rebuild — 500px layout, flex column, right-side nav |
| `src/options/options.html` | Retire — replace with deprecation notice or delete |
| `src/options/options.ts` | Retire — logic migrates to popup.ts |
| `src/options/options.css` | Retire |
| `src/shared/types.ts` | No changes expected |
| `manifest.json` | Remove `options_page` / `options_ui` entry + version bump |
| `package.json` | Version bump only |

---

## Out of Scope

- Security fix for XSS in `logs.ts` (tracked separately as `fix/logs-xss`)
- Spending History View (Add-on 2)
- Weekly/Monthly Limits (Add-on 3)
- Any new UserSettings fields
