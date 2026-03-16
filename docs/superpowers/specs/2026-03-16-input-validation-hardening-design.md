# Input Validation Hardening — Design Spec

**Date:** 2026-03-16
**Branch:** `maint/input-validation-hardening`
**Scope:** Defense-in-depth input validation across the entire HypeControl extension

---

## Problem

The app has inconsistent input validation. The options page has good UI-level validators, but the popup bypasses them entirely. Storage reads don't validate retrieved values. One confirmed XSS vector remains (comparison item names rendered via innerHTML). Twitch DOM price extraction doesn't guard against NaN/Infinity. Corrupted or tampered storage data loads unchecked.

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
| `frictionThresholds.floor` | 0 | 999.99 | Clamp |
| `frictionThresholds.ceiling` | 0.01 | 1000 | Clamp; if ≤ floor, set ceiling = floor + 0.01 |
| `frictionThresholds.softNudgeSteps` | 1 | 10 | Clamp |
| `dailyCap.amount` | 0 | 100000 | Clamp |
| `weeklyCap.amount` | 0 | 100000 | Clamp |
| `monthlyCap.amount` | 0 | 100000 | Clamp |
| `cooldown.durationMinutes` | 0 | 1440 | Clamp |
| `gracePeriodMinutes` | 0 | 60 | Clamp |
| `toastDuration` | 1 | 30 | Clamp |

All numeric fields also receive:
- `isNaN()` check → replace with `DEFAULT_SETTINGS` value
- `isFinite()` check → replace with `DEFAULT_SETTINGS` value
- `Math.round(val * 100) / 100` for currency values (hourlyRate, cap amounts, thresholds)

### Enum Validation Rules

| Field | Allowed Values | Fallback |
|-------|---------------|----------|
| `frictionIntensity` | `'low'`, `'medium'`, `'high'`, `'extreme'` | Default |
| `delayTimer.mode` | `'fixed'`, `'scaled'` | `'fixed'` |
| `delayTimer.baseSeconds` | `5`, `10`, `30`, `60` | `10` |
| `theme` | `'auto'`, `'light'`, `'dark'` | `'auto'` |
| `cooldown.behavior` | Valid enum values | Default |
| Whitelist entry `.behavior` | `'full'`, `'track-only'` | `'full'` |

Invalid enum values snap to their default.

### Comparison Items

- `item.name`: trim, cap at 50 chars, strip HTML tags as belt-and-suspenders
- `item.price`: positive, finite, ≤ 100000, rounded to 2 decimals
- `item.emoji`: cap at 2 grapheme characters
- Items that fail validation are removed entirely

### Whitelist Entries

- `entry.username`: must match `/^[a-z0-9_]{1,25}$/` — reject non-matching entries
- `entry.behavior`: must be valid enum — reject or default

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
- Date strings (`dailyDate`, `weeklyStartDate`, `monthlyMonth`): validate expected format, reset to current period start if invalid

**Call sites:**
- `interceptor.ts` — after loading `hcSpending` from `chrome.storage.local.get`
- `interceptor.ts` — before `chrome.storage.local.set` for spending data

---

## Layer 4: XSS Fix — DOM Construction for User Data

**File:** `src/options/options.ts` (~lines 207-222)

**Current:** Comparison item `item.name` rendered via innerHTML template literal:
```typescript
row.innerHTML = `...<span>${item.name}</span>...`;
```

**Fix:** Replace with `createElement` + `textContent` for user-controlled values. The HTML structure can still use innerHTML for the static skeleton, but `item.name` must be inserted via `textContent` on a DOM node.

---

## Layer 5: Detector Hardening — Twitch DOM Data

**File:** `src/content/detector.ts` — `extractPrice()` function

**Fix:** At each return path where `parseFloat()` is called:
- If `isNaN(value) || !isFinite(value)`, return `{ raw, value: null }`
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
- Test each boundary: NaN, Infinity, negative, zero, very large, HTML in strings
- Verify existing UI validators still show error messages (UX layer unchanged)
- Verify XSS fix: enter `<img src=x onerror=alert(1)>` as comparison item name, confirm no execution
