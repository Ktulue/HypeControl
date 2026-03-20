# MVP Completion Design — Popup Stats + Friction Levels

**Date:** 2026-03-10
**Version:** 0.4.2 → next
**Goal:** Close out the remaining MVP gaps — popup stats panel and named friction levels — using a data-layer-first build order.

---

## Scope

Two features, built in this order:

1. **Data layer** — 90-day pruning, money-saved tracking, step-level cancel tracking
2. **Popup UI** — Core stats + streaming mode manual override
3. **Friction level setting** — Named Low/Medium/High/Extreme in options
4. **Friction overlay steps** — Four new steps gated by friction level

**Out of scope:** Peak spending hours, top channels analytics, full settings UI redesign, any Phase 4 add-ons.

---

## Section 1: Data Layer

### 90-Day Pruning

Replace the current 200-entry cap in the logger with a date-based filter. On each write, entries older than 90 days are dropped. Old entries age out naturally; no migration needed.

### Money-Saved Field

Add `savedAmount: number` to cancelled log entries, set equal to `priceWithTax` at cancel time. Old entries without this field contribute zero to the saved sum (correct — we have no data for them).

### Step-Level Cancel Tracking

Add `cancelledAtStep?: number` to log entries. The friction flow already runs as a sequential array; the current step index is passed into the cancel handler and written to the entry. Step numbering:

| Step | Number |
|------|--------|
| Main modal | 1 |
| Comparison step(s) | 2, 3, … |
| Reason-selection | next available |
| Cooldown timer | next available |
| Type-to-confirm | next available |
| Math challenge | next available |

### Log Entry Schema (additions)

```typescript
interface InterceptLogEntry {
  // existing fields unchanged ...
  savedAmount?: number;        // set on cancelled entries only
  cancelledAtStep?: number;    // which step user cancelled at
  purchaseReason?: string;     // set if reason-selection step was completed
}
```

---

## Section 2: Popup UI

### Files

- `src/popup/popup.html`
- `src/popup/popup.ts`
- `src/popup/popup.css`
- Manifest `action.default_popup` → `popup.html`

### Stats (last 90 days)

| Stat | Calculation |
|------|-------------|
| Saved | Sum of `savedAmount` from cancelled entries |
| Blocked | Count of cancelled entries |
| Cancel rate | cancelled / total intercepts × 100 |
| Most effective step | Step number with highest cancel count |

### Streaming Mode Override

- Button: "Enable manual override (2 hrs)"
- Sets `manualOverrideUntil = Date.now() + 7200000` in `chrome.storage.local`
- If override active: shows remaining time + "Cancel override" button
- Uses the existing `manualOverrideUntil` field already checked in `shouldBypassFriction()`

### Layout

- Fixed width: 360px
- Dark theme matching existing overlay aesthetic
- Footer: "View full logs →" (opens `logs.html`) + version number from manifest
- No external dependencies — plain CSS

---

## Section 3: Friction Level Setting

### Type Definition

```typescript
type FrictionLevel = 'low' | 'medium' | 'high' | 'extreme';
```

Added to `UserSettings` in `types.ts`, defaulting to `'medium'`. Handled in `migrateSettings()`.

### Options Page UI

Segmented 4-button radio group in the Friction section, above price threshold toggles.

| Level | Description shown |
|-------|-------------------|
| Low | Price + tax display only, no extra steps |
| Medium | Adds reason-selection step |
| High | Adds cooldown timer (10s) + type-to-confirm |
| Extreme | Adds math challenge, cooldown extends to 30s |

### Interaction with Price Thresholds

Thresholds (no-friction / nudge / full) control **whether** friction triggers. The named level controls **how intense** it is when it does trigger. A nudge tier at High level shows the cooldown + type-to-confirm; a full tier at Low just shows the main modal.

---

## Section 4: Friction Overlay Steps

Steps are appended to the existing `runFrictionFlow()` sequence after comparison steps.

### Step Sequence by Level

| Step | Low | Medium | High | Extreme |
|------|-----|--------|------|---------|
| Main modal | ✅ | ✅ | ✅ | ✅ |
| Comparison steps | ✅ | ✅ | ✅ | ✅ |
| Reason-selection | — | ✅ | ✅ | ✅ |
| Cooldown timer | — | — | 10s | 30s |
| Type-to-confirm | — | — | ✅ | ✅ |
| Math challenge | — | — | — | ✅ |

### Reason-Selection (Medium+)

Three buttons:
- "To support the streamer" → proceeds, logs reason
- "I genuinely want this" → proceeds, logs reason
- "Caught up in the moment" → auto-cancels with message: "No worries — the moment passes. Your wallet thanks you."

Logs `purchaseReason` on proceed.

### Cooldown Timer (High+)

- Progress bar counting down: 10s (High) / 30s (Extreme)
- Proceed button disabled and grayed until timer completes
- Cancel remains available throughout
- Driven by a single `setInterval`, cleared on cancel or completion

### Type-to-Confirm (High+)

- Input with placeholder "Type: I WANT THIS"
- Proceed button disabled until input matches (case-insensitive)
- Enter key submits when valid
- No timer

### Math Challenge (Extreme only)

- Simple two-operand arithmetic (e.g., "What is 7 × 8?")
- Numbers randomly generated; answer always < 100
- Wrong answer: shakes input, clears it, generates new problem
- Proceed enabled on correct answer

---

## Build Order

1. Update log schema (`types.ts`)
2. Update logger — 90-day pruning + write `savedAmount` + `cancelledAtStep`
3. Add `frictionLevel` to `UserSettings`, `DEFAULT_SETTINGS`, `migrateSettings()`
4. Build popup (`popup.html`, `popup.ts`, `popup.css`), wire to manifest
5. Add friction level segmented control to options page
6. Implement 4 new overlay steps in `interceptor.ts` / `frictionFlow.ts`
7. Wire `cancelledAtStep` into all cancel handlers
8. Build, version bump, update changelog and TODO

---

## Files Likely Touched

| File | Change |
|------|--------|
| `src/shared/types.ts` | Add `FrictionLevel`, extend `InterceptLogEntry`, extend `UserSettings` |
| `src/shared/logger.ts` | 90-day pruning, write `savedAmount`, write `cancelledAtStep` |
| `src/shared/settings.ts` | Default + migration for `frictionLevel` |
| `src/options/options.ts` | Friction level segmented control |
| `src/content/interceptor.ts` | New overlay steps, step counter |
| `src/popup/popup.html` | New file |
| `src/popup/popup.ts` | New file |
| `src/popup/popup.css` | New file |
| `manifest.json` | `action.default_popup`, `web_accessible_resources` if needed |
| `webpack.config.js` | New popup entry point |
