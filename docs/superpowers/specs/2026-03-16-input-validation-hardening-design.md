# Input Validation Hardening — Design Spec

**Date:** 2026-03-16
**Branch:** `maint/input-validation-hardening`
**Scope:** Defense-in-depth input validation across the entire HypeControl extension

---

## Problem

The app has inconsistent input validation. The options page has good UI-level validators, but the popup bypasses them entirely. Storage reads don't validate retrieved values. One confirmed XSS vector remains (comparison item names and related fields rendered via innerHTML). Twitch DOM price extraction doesn't guard against NaN/Infinity. Corrupted or tampered storage data loads unchecked.

## Approach: Defense-in-Depth (Option C)

Instead of sprinkling validation at every individual input, we create **two chokepoints** — one on the write path, one on the read path — plus targeted fixes for XSS and external data parsing.

### Architecture

```
User Input (popup/options)
    │
    ▼
[UI validators — UX error messages, unchanged]
    │
    ▼
sanitizeSettings(settings) ← WRITE GATE (new)
    │
    ▼
chrome.storage.sync.set()
    │
    ...
    │
chrome.storage.sync.get()
    │
    ▼
migrateSettings(saved) → sanitizeSettings(result) ← READ GATE (enhanced)
    │
    ▼
App uses validated settings
```

Same pattern for SpendingTracker via `sanitizeTracker()`.

---

## Layer 1: `sanitizeSettings()` — Shared Validation Function

**Location:** `src/shared/types.ts` (next to `migrateSettings()`)

**Signature:** `function sanitizeSettings(settings: UserSettings): UserSettings`

Returns a clean copy. Does not mutate the input.

### Numeric Validation Rules

| Field | Min | Max | Fallback |
|-------|-----|-----|----------|
| `hourlyRate` | 0.01 | 1000 | Clamp to nearest bound |
| `taxRate` | 0 | 25 | Clamp to nearest bound |
| `frictionThresholds.thresholdFloor` | 0 | 999.99 | Clamp |
| `frictionThresholds.thresholdCeiling` | 0.01 | 1000 | Clamp; if ≤ floor, set ceiling = floor + 0.01 |
| `frictionThresholds.softNudgeSteps` | 1 | 10 | Clamp |
| `dailyCap.amount` | 0 | 100000 | Clamp |
| `weeklyCap.amount` | 0 | 100000 | Clamp |
| `monthlyCap.amount` | 0 | 100000 | Clamp |
| `cooldown.minutes` | 0 | 1440 | Clamp |
| `streamingMode.gracePeriodMinutes` | 0 | 60 | Clamp |
| `toastDurationSeconds` | 1 | 30 | Clamp |

All numeric fields also receive:
- `isNaN()` check → replace with `DEFAULT_SETTINGS` value
- `isFinite()` check → replace with `DEFAULT_SETTINGS` value
- `Math.round(val * 100) / 100` for currency values (hourlyRate, cap amounts, thresholds)

### Boolean Validation Rules

All boolean fields must be `=== true` or default to `false`. This prevents string `"true"`, number `1`, or other truthy-but-not-boolean values from persisting.

**Fields:**
- `frictionThresholds.enabled`
- `cooldown.enabled`
- `dailyCap.enabled`
- `weeklyCap.enabled`
- `monthlyCap.enabled`
- `delayTimer.enabled`
- `streamingMode.enabled`
- `streamingMode.logBypassed` (default: `true`)
- `intensityLocked`

### Enum Validation Rules

| Field | Allowed Values | Fallback |
|-------|---------------|----------|
| `frictionIntensity` | `'low'`, `'medium'`, `'high'`, `'extreme'` | Default |
| `delayTimer.seconds` | `5`, `10`, `30`, `60` | `10` |
| `theme` | `'auto'`, `'light'`, `'dark'` | `'auto'` |
| `weeklyResetDay` | `'monday'`, `'sunday'` | `'monday'` |
| Whitelist entry `.behavior` | `'skip'`, `'reduced'`, `'full'` | `'full'` |

Invalid enum values snap to their default.

### Comparison Items

- `item.id`: must be a non-empty string; enforce uniqueness (deduplicate by ID, keep first)
- `item.name`: trim, cap at 50 chars, strip HTML tags as belt-and-suspenders
- `item.pluralLabel`: trim, cap at 50 chars, strip HTML tags (same treatment as `name`)
- `item.price`: positive, finite, ≤ 100000, rounded to 2 decimals
- `item.emoji`: cap at 2 grapheme characters
- `item.frictionScope`: must be `'nudge'` | `'full'` | `'both'` — default to `'both'`
- `item.enabled`: boolean validation (=== true or false)
- `item.isPreset`: boolean validation (=== true or false)
- Items with invalid `id`, `name`, or `price` after sanitization are removed entirely

### Whitelist Entries

- `entry.username`: must match `/^[a-z0-9_]{1,25}$/` — reject non-matching entries
- `entry.behavior`: must be `'skip'` | `'reduced'` | `'full'` — reject or default to `'full'`

### Streaming Mode

- `streamingMode.twitchUsername`: must match `/^[a-z0-9_]{0,25}$/` (allows empty string) — reset to `''` if invalid
- `streamingMode.gracePeriodMinutes`: covered in numeric table above
- `streamingMode.enabled` / `streamingMode.logBypassed`: covered in boolean table above

### Streaming Override

- `streamingOverride`: if present, `expiresAt` must be a positive finite number; remove the override entirely if invalid

---

## Layer 2: Harden `migrateSettings()`

At the end of `migrateSettings()`, before returning the final object, pipe it through `sanitizeSettings()`. This catches:
- Data saved before this hardening existed
- Storage corrupted via sync conflicts
- Manual tampering via devtools

---

## Layer 3: `sanitizeTracker()` — SpendingTracker Validation

**Location:** `src/shared/types.ts` or co-located with tracker logic

**Rules:**
- All totals (`dailyTotal`, `weeklyTotal`, `monthlyTotal`, `sessionTotal`): `isNaN`/`isFinite` → 0, must be ≥ 0, round to 2 decimals
- `lastProceedTimestamp`: must be `null` or a positive finite number — reset to `null` if invalid
- `sessionChannel`: must be a string — reset to `''` if not a string (no strict format validation needed since channel names come from URL paths)
- Date strings (`dailyDate`, `weeklyStartDate`, `monthlyMonth`): validate expected format, reset to `''` if invalid (empty string triggers a fresh period reset on next use)

**Call sites:**
- `interceptor.ts` — after loading `hcSpending` from `chrome.storage.local.get`
- `interceptor.ts` — before `chrome.storage.local.set` for spending data

---

## Layer 4: XSS Fix — DOM Construction for User Data

**File:** `src/options/options.ts` (~lines 200-222)

**Current:** Comparison item rendering uses innerHTML template literal with multiple user-controlled values:
- `item.name` in `<span>` text
- `item.name` in `aria-label` attribute
- `item.emoji` in display
- `item.id` in `data-item-id` attribute

**Fix:** Replace with `createElement` + `textContent` for all user-controlled values. The HTML structure can still use innerHTML for the static skeleton (with placeholder elements), then populate user data via `textContent` and `setAttribute` on DOM nodes. This covers `item.name`, `item.emoji`, `item.pluralLabel`, and `item.id`.

---

## Layer 5: Detector Hardening — Twitch DOM Data

**File:** `src/content/detector.ts` — `parsePrice()` helper function

**Fix:** Add a guard inside `parsePrice()` itself (single fix point, cleanest approach):
- After `parseFloat()`, if `isNaN(value) || !isFinite(value)`, return `null`
- `extractPrice()` already handles null returns from its price parsing paths, so no ripple effect
- This prevents NaN/Infinity from propagating into spending calculations

---

## Integration Points

### Write-side call sites (sanitizeSettings)

1. **Popup** — `pendingState.ts` before `chrome.storage.sync.set`
2. **Options page** — `options.ts` `saveSettings()` before `chrome.storage.sync.set`

### Read-side call site (sanitizeSettings)

3. **`migrateSettings()`** — at the end, before returning

### SpendingTracker call sites (sanitizeTracker)

4. **`interceptor.ts`** — after `chrome.storage.local.get` for `hcSpending`
5. **`interceptor.ts`** — before `chrome.storage.local.set` for `hcSpending`

### What does NOT change

- Existing UI validators in `options.ts` — they handle UX error messages
- Popup segmented buttons and select dropdowns — constrained by HTML
- `interceptLogger.ts` — events are app-written, not user input
- `tourPanel.ts` — all hardcoded content

---

## Testing Strategy

- Unit-style manual testing: set invalid values via Chrome devtools in storage, reload extension, verify sanitized values
- Test each boundary: NaN, Infinity, negative, zero, very large, HTML in strings, string "true" for booleans
- Verify existing UI validators still show error messages (UX layer unchanged)
- Verify XSS fix: enter `<img src=x onerror=alert(1)>` as comparison item name, confirm no execution
- Verify corrupted whitelist entries (invalid usernames, bad behavior values) are stripped on load
- Verify SpendingTracker with negative totals, NaN dates, invalid timestamps gets sanitized
