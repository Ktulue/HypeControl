# Quick Wins Bundle Design

**Date:** 2026-03-10
**Goal:** Ship three small independent features in one release: a standalone delay timer, whitelist quick-add from the overlay, and per-item comparison scope assignment (nudge vs full).

---

## Scope

Three self-contained features, no shared architecture:

1. **Delay Timer** — configurable final-step pause before purchase fires
2. **Whitelist Quick-Add** — "Remember this channel" button inside the main overlay
3. **Comparison Nudge/Full Assignment** — per-item scope control in options

Each touches different files and can be implemented in any order.

---

## Feature 1: Delay Timer

### Settings

New field in `UserSettings`:

```typescript
delayTimer: {
  enabled: boolean;   // default: false
  seconds: 5 | 10 | 30 | 60;  // default: 10
}
```

Migrated in `migrateSettings()`. Added to `DEFAULT_SETTINGS`.

### Options Page UI

New "Delay Timer" section with:
- Enable/disable toggle
- 4-button segmented control: **5s / 10s / 30s / 60s** (only visible when enabled)

### Flow

Runs as the **final step** in `runFrictionFlow`, after all friction steps complete (main modal → comparisons → intensity steps). Only shown if the user makes it all the way through.

- Full-screen modal with a progress bar counting down the configured duration
- Cancel always available — if cancelled, writes `InterceptEvent` with `outcome: 'cancelled', cancelledAtStep: <last step + 1>`
- Timer completes → purchase proceeds normally

**Distinction from spending cooldown:** The spending cooldown blocks purchases for minutes after the last one (anti-repeat). The delay timer is a short per-purchase final pause — always shown when enabled, regardless of how recently the user bought something.

### Files Touched

| File | Change |
|------|--------|
| `src/shared/types.ts` | Add `DelayTimerConfig` interface, add `delayTimer` to `UserSettings`, update `DEFAULT_SETTINGS`, update `migrateSettings()` |
| `src/content/interceptor.ts` | Add `showDelayTimerStep()` function; call it at end of `runFrictionFlow` when enabled |
| `src/options/options.html` | Add Delay Timer section |
| `src/options/options.ts` | Load/save `delayTimer`; wire segmented control |

---

## Feature 2: Whitelist Quick-Add

### UI

A subtle "Remember this channel" button added to the bottom of the **main overlay** (Step 1), below the Cancel/Proceed buttons. Secondary styling — smaller, visually subordinate to the primary actions.

### Flow — Channel Not Yet Whitelisted

1. User clicks "Remember this channel"
2. Overlay content is replaced inline with a compact behavior selector:
   - **Skip** — no friction, silently logged
   - **Reduced** — toast notification only
   - **Full** — full friction with whitelist note
3. Short description shown below each option
4. User confirms → saves to `whitelistedChannels` in `chrome.storage.sync` → overlay dismisses → purchase proceeds

### Flow — Channel Already Whitelisted

1. User clicks "Remember this channel"
2. Inline warning banner shown:
   > ⚠️ **Already whitelisted** — this channel is set to [current behavior]. Changing it here will update the existing entry.
3. Selector appears with current behavior pre-selected
4. User can update or dismiss without changes
5. No duplicate entries — updates in place via `Array.find()` on the existing whitelist

### Files Touched

| File | Change |
|------|--------|
| `src/content/interceptor.ts` | Add "Remember this channel" button to main overlay HTML; add inline selector logic; handle save + channel already whitelisted path |

---

## Feature 3: Comparison Item Nudge/Full Assignment

### Settings Change

Each `ComparisonItem` gains a new field:

```typescript
frictionScope: 'nudge' | 'full' | 'both';  // default: 'both'
```

Default `'both'` for all existing items — preserves current behavior exactly, no migration breakage.

### Options Page UI

Below each comparison item's existing enabled toggle, a subordinate 3-button segmented control:

**Nudge / Full / Both**

- Only visible when the item is enabled (disabled items hide the control)
- Persisted on save alongside the rest of the item

### Interceptor Behavior

Updated item pool logic in `runFrictionFlow`:

| Mode | Current | Updated |
|------|---------|---------|
| Nudge | `enabled` items, limited to `softNudgeSteps` | `enabled && (frictionScope === 'nudge' \|\| frictionScope === 'both')`, limited to `softNudgeSteps` |
| Full | all items | `enabled && (frictionScope === 'full' \|\| frictionScope === 'both')` |

This allows users to route cheap/quick comparisons (Costco hot dog) to nudge moments, and heavier comparisons (hours of work) to full friction only.

### Files Touched

| File | Change |
|------|--------|
| `src/shared/types.ts` | Add `frictionScope` field to `ComparisonItem` interface; update `PRESET_COMPARISON_ITEMS` defaults; handle migration |
| `src/content/interceptor.ts` | Update item pool filter logic in `runFrictionFlow` |
| `src/options/options.html` | Add scope segmented control per item |
| `src/options/options.ts` | Render and wire scope control; save with item |

---

## Build Order

1. `types.ts` — add all three features' new fields in one pass
2. Delay Timer — options UI + interceptor step
3. Whitelist Quick-Add — overlay button + inline selector logic
4. Comparison Scope — options UI + interceptor filter update
5. Version bump, changelog, TODO update
