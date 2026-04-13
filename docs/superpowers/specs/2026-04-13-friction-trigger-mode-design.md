# Friction Trigger Mode — Design Spec

**Date:** 2026-04-13
**Branch:** `feat/friction-trigger-mode`
**Status:** Approved

---

## Summary

HypeControl currently triggers friction on every intercepted purchase button click, regardless of whether a price was detected. This design introduces a **Friction Trigger Mode** setting that lets users choose between two behaviors:

- **Price Guard** (new default): Friction only fires when a price is detected. No price = silent pass.
- **Zero Trust**: Friction fires on every purchase button — price or not. Includes rotating no-price overlay messages.

## Motivation

The current "always friction" approach was a deliberate conservative choice during MVP. Now that the extension is stable and shipping, users should be able to choose: most users benefit from price-gated friction (no false positives on unreadable buttons), while users who want maximum accountability can opt into Zero Trust.

---

## New Setting: `frictionTriggerMode`

### Type Definition

```typescript
frictionTriggerMode: 'price-guard' | 'zero-trust'
```

- **Default:** `'price-guard'`
- **Storage:** `chrome.storage.sync` (user preference)
- **Migration:** Existing users receive `'price-guard'` via `migrateSettings()`. This is an intentional behavior change — the new default is the desired direction.

### Settings UI

Segmented control in the Friction section, near the existing intensity picker. Two buttons:

| Label | Description |
|---|---|
| **Price Guard** | "Friction triggers only when a price is detected. If we can't read the number, you walk." |
| **Zero Trust** | "Friction on every purchase button — price or not. You asked for this." |

---

## Behavior Change: `determineFrictionLevel()`

### Current Logic (line 155 of interceptor.ts)

```
priceValue === null → return 'full'
```

### New Logic

```
priceValue === null →
  if triggerMode === 'zero-trust' → return 'full'
  if triggerMode === 'price-guard' → return 'none'
```

### What Does NOT Change

- **Cap checks** — already gate on `priceValue !== null`. Null-price clicks skip cap logic regardless of mode.
- **Threshold checks** — already require a numeric price. In Zero Trust, null-price clicks bypass thresholds and go straight to `'full'`.
- **Whitelist / streaming mode / cooldown** — run before `determineFrictionLevel()`, unaffected.
- **Intensity steps** (reason selection, cooldown timer, math challenge, type-to-confirm) — fire based on `frictionIntensity` / escalation, independent of trigger mode. A Zero Trust no-price overlay at extreme intensity gets the full gauntlet.
- **Comparison steps** — already skipped when `priceValue === null` (line 1539-1541 in `runFrictionFlow`). No change needed.

### Price Guard `'none'` Path

When Price Guard silently passes a no-price click, it still logs an intercept event (`outcome: 'proceeded'`, `price: null`) so history stays complete.

---

## Zero Trust No-Price Overlay

When Zero Trust fires on a null-price click, the overlay shows a stripped-down layout.

### Shown

- Channel name
- Purchase type (button text)
- One rotating message from the pool (randomly selected)
- "Cancel" and "Proceed Anyway" buttons
- All intensity steps fire after the main overlay (based on `frictionIntensity` setting)

### Not Shown

- Cost breakdown (no price)
- Work-time calculation
- Cap progress bars
- Comparison steps

### Rotating Message Pool (~16 messages, two buckets)

Selection logic: random pick, no back-to-back duplicate. Alternates between buckets to avoid tonal clusters.

**Matter-of-fact bucket:**

1. "No price detected. That doesn't mean it's free."
2. "We couldn't read a number. You're in Zero Trust — so we showed up anyway."
3. "Price? No idea. But you told us to stop you every time."
4. "Can't see what this costs. Can you?"
5. "No price tag on this one. Zero Trust doesn't care."
6. "We don't know the price. That's exactly why we're here."
7. "Price not found. Zero Trust mode doesn't take days off."
8. "Unknown cost. Known impulse risk."

**Cheeky bucket:**

1. "Zero Trust means zero exceptions. Even this one."
2. "No price tag? Suspicious."
3. "Flying blind on the cost. Good thing you brought a parachute."
4. "Couldn't find a price. Found you clicking though."
5. "The price is a mystery. Your spending habits are not."
6. "No number to crunch. Just a button to question."
7. "We can't tell you what this costs. We can tell you to think about it."
8. "Price unknown. Wallet concern: very known."

---

## Files Touched

| File | Change |
|---|---|
| `src/shared/types.ts` | Add `frictionTriggerMode` to `UserSettings`, `DEFAULT_SETTINGS`, `migrateSettings()`, `sanitizeSettings()` |
| `src/content/interceptor.ts` | Update `determineFrictionLevel()` to check trigger mode. Replace static no-price copy with rotating message pool + selection logic. |
| `src/options/options.html` | Add segmented control for trigger mode in the Friction section |
| `src/options/options.ts` | Wire up trigger mode control — read/write/save, aria-pressed state |
| `docs/dev/HypeControl-TODO.md` | Mark feature complete, update version/date |
| `docs/dev/HC-Project-Document.md` | Update friction system description to reflect trigger modes |

### Files NOT Touched

- `spendingTracker.ts` — no tracker logic affected
- `interceptLogger.ts` — already handles null-price events
- `popup.ts` / `popup.html` — no display changes
- `logs.ts` / `logs.html` — already renders null-price events
- `escalation.ts` — intensity escalation is independent of trigger mode
- `detector.ts` — price detection logic unchanged
