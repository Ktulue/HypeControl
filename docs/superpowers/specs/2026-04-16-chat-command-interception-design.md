# Chat Command Interception Design

**Date:** 2026-04-16
**Issue:** [#39](https://github.com/Ktulue/HypeControl/issues/39)
**Status:** Approved

## Problem

Twitch's `/gift <#>` and `/subscribe` chat commands bypass HC entirely. HC's existing interception relies on click-capture on DOM elements (buttons with `data-a-target` attributes, purchase modals). Chat commands go through Twitch's chat input system, never rendering a clickable button that HC can intercept before the payment flow starts.

A community member ([goproslowyo](https://github.com/Ktulue/HypeControl/issues/39#issuecomment-4257425437)) confirmed via a PoC that:

1. The chat input (`[data-a-target="chat-input"]`) is interceptable via `keydown` listeners.
2. After a `/gift` command sends, a `ReactModalPortal` purchase confirmation modal **does** appear — HC's `setupModalObserver` already detects it.

## Design Decisions

- **Two-layer defense:** Primary interception at the chat input (keydown), with a modal fallback safety net.
- **Known command list:** HC matches against a maintained list of purchase commands (`/gift`, `/subscribe`), not arbitrary chat input. Explicit and predictable — new commands are a one-line addition.
- **Exact pricing:** `/gift` and `/subscribe` are locked to Tier 1 ($5.99/sub). HC knows the exact price. No estimation, no ranges.
- **Same dollar tracking:** Slash-command purchases feed into `dailyTotal`/`weeklyTotal`/`monthlyTotal` normally since the price is exact. The only distinction is a `source: 'chat-command'` metadata tag on the `InterceptEvent`.
- **Power-user voice:** Anyone using slash commands is a power user. The friction overlay, log entries, and spending history use a different copy register — sharper, acknowledges that they know the shortcuts.
- **Separate module:** `chatCommandInterceptor.ts` owns its own MutationObserver and lifecycle, separate from the button interceptor. Different mechanism, different UX voice, clean boundaries.
- **Independent toggle:** Users can disable chat command interception without affecting button interception.

## Architecture

### New Module: `src/content/chatCommandInterceptor.ts`

**Lifecycle:**

1. On content script init, a `MutationObserver` watches `document.body` for `[data-a-target="chat-input"]` to appear.
2. When found, attaches a `keydown` listener (capture phase) to the chat input element.
3. On SPA navigation (Twitch channel change), the chat input gets destroyed and recreated — the observer detects removal and re-attaches when the new one appears.
4. `teardownChatInterceptor()` cleans up observer + listener (mirrors `teardownInterceptor()` pattern).

**Command detection:**

On `Enter` keypress, reads `chatInput.innerText.trim()` and matches against a `PURCHASE_COMMANDS` array:

```typescript
interface PurchaseCommand {
  pattern: RegExp;
  type: string;              // e.g. 'Gift A Sub (Chat)', 'Subscribe (Chat)'
  extractQuantity: (match: RegExpMatchArray) => number | null;
  pricePerUnit: number;      // $5.99 for Tier 1
}

const PURCHASE_COMMANDS: PurchaseCommand[] = [
  {
    pattern: /^\/gift\s+(\d+)$/i,
    type: 'Gift A Sub (Chat)',
    extractQuantity: (m) => parseInt(m[1], 10),
    pricePerUnit: 5.99,
  },
  {
    pattern: /^\/subscribe$/i,
    type: 'Subscribe (Chat)',
    extractQuantity: () => 1,
    pricePerUnit: 5.99,
  },
];
```

Adding a new command = one array entry.

**When a match is found:**

1. Load settings.
2. If `chatCommandInterception.enabled` is false, return immediately (let the command through — no `preventDefault`).
3. `event.preventDefault()` + `event.stopPropagation()` — blocks the message from sending.
4. Load spending tracker.
5. Check streaming mode bypass, whitelist, cooldown — same decision tree as `handleClick()`.
6. Determine friction level using the existing `determineFrictionLevel()` logic.
7. Build a `PurchaseAttempt` with exact pricing: `quantity * pricePerUnit`.
8. Show the friction overlay (power-user variant).
9. If user proceeds: dismiss overlay, store a `recentlyApproved` token. The user presses Enter again themselves to send the command.
10. On second Enter, the interceptor recognizes the approved token and lets it through.

**The `recentlyApproved` mechanism:**

After the user clicks "Proceed," module state stores:

```typescript
{ command: string, timestamp: number, channel: string }
```

On the next Enter keypress, if the command matches and timestamp is within 30 seconds, let it pass and clear the token. If 30 seconds expire, the token expires — they'd need to go through friction again.

### Modal Fallback Layer (Safety Net)

If the chat interceptor misses (listener not attached, new command format, race condition), the `ReactModalPortal` confirmation modal contains a purchase button. HC's existing click interceptor catches it.

**Implementation:**

1. Investigate the modal contents (DevTools inspection to identify the confirm button's `data-a-target`, aria-label, or text).
2. Add any missing selectors to `detector.ts` so `isPurchaseButton()` recognizes the button.
3. If the button already matches existing selectors (likely — gift sub modals use `gift-sub-confirm-button`), no changes needed.

**Double-friction prevention:**

- `chatCommandInterceptor.ts` exports `wasRecentlyChatApproved(channel: string): boolean`.
- `interceptor.ts`'s `handleClick()` calls this before starting friction. If true (same channel, within 30 seconds), it logs the event silently and lets the click through.
- If the chat interceptor did NOT fire, `wasRecentlyChatApproved()` returns false, and the modal button gets full friction as normal.

### Friction UX

**Same modal structure, different voice.** The overlay uses the same CSS, accessibility patterns, and dismiss behavior as button interceptions.

The friction flow is identical to button friction:

1. Main overlay with cost breakdown, cap bars, work-hours.
2. Comparison items (respecting scope/nudge settings).
3. Intensity-gated steps (reason selection, cooldown timer, type-to-confirm, math challenge) — all escalate normally based on the user's friction intensity setting.
4. Cap-exceedance escalation fires the same way.

**Power-user copy — examples by friction level:**

Low intensity (nudge):
> "You typed `/gift 5` — that's $29.95 before tax. Just because you know the shortcut doesn't mean your wallet agreed."

Medium intensity (full):
> "Caught a `/gift 5` headed for chat. That's $29.95 before tax. The command line doesn't have a cooling-off period. HC does."

High/Extreme intensity (escalated, cap-exceeded):
> "You're $12 over your weekly budget and you're typing `/gift 5` by hand. That's $29.95 you already decided not to spend. Remember?"

**Spending history — power-user entries:**

- Source badge: "via /gift" or "via /subscribe"
- Log line: `Typed /gift 5 on xQc's channel — $29.95 + tax`
- If cancelled: `Caught /gift 5 on xQc's channel — $31.75 saved`

Copy constants live in `chatCommandInterceptor.ts`, not mixed into existing overlay copy.

### Settings & Migration

**New setting:**

```typescript
chatCommandInterception: {
  enabled: boolean;  // default: true
}
```

**Settings UI:** A single toggle in `options.html`, grouped near existing friction/interception settings:

> **Chat Command Interception**
> Intercept purchase commands typed in chat (e.g. `/gift`, `/subscribe`)
> [toggle: on]

**Migration:** If `chatCommandInterception` is missing, default to `{ enabled: true }`. Standard migration pattern.

### Tracking

Slash-command purchases use exact pricing ($5.99 * quantity) and feed into the spending tracker dollar totals normally. The `InterceptEvent` gets additional metadata:

```typescript
{
  source: 'chat-command',       // distinguishes from 'button' (default)
  commandText: '/gift 5',       // raw command for the log
  quantity: 5,                  // parsed quantity
}
```

New fields on `InterceptEvent` in `src/shared/types.ts`:

- `source?: 'button' | 'chat-command'` — existing events default to `'button'` via migration
- `commandText?: string`
- `quantity?: number`

## File Map

### New files

| File | Purpose |
|------|---------|
| `src/content/chatCommandInterceptor.ts` | MutationObserver lifecycle, keydown listener, command matching, `recentlyApproved` management, `wasRecentlyChatApproved()` export, power-user copy constants |

### Modified files

| File | Changes |
|------|---------|
| `src/shared/types.ts` | Add `source`, `commandText`, `quantity` to `InterceptEvent`. Add `chatCommandInterception` to `UserSettings` + `DEFAULT_SETTINGS`. Handle in `migrateSettings()`. |
| `src/content/interceptor.ts` | Import `wasRecentlyChatApproved`. In `handleClick()`, check before starting friction — if true, log silently and let click through. |
| `src/content/detector.ts` | Add any new selectors discovered during modal investigation for `/gift` confirmation modal buttons. |
| `src/content/index.ts` | Import and call `setupChatInterceptor()` + `teardownChatInterceptor()`. |
| `src/options/options.ts` + `options.html` | Add chat command interception toggle. |
| `src/logs/logs.ts` | Display `source` badge on chat-command entries, power-user copy for log lines. |
| `src/shared/interceptLogger.ts` | Handle new `InterceptEvent` fields when writing/reading. |

### Files NOT touched

- `src/popup/popup.ts` / `popup.html` — stats aggregate all `InterceptEvent` records. `source` field is available for future use.
- `src/shared/spendingTracker.ts` — `recordPurchase()` works unchanged (exact price).
- `src/content/themeManager.ts` — chat command overlays use the same theming.
- `src/content/streamingMode.ts` — chat interceptor calls `shouldBypassFriction()` the same way.

## Out of Scope

- Per-command toggles (e.g. intercept `/gift` but not `/subscribe`). One switch controls all. Easy to add later if requested.
- Custom pricing override. The $5.99 Tier 1 price is a constant. Updated if Twitch changes it.
- Chat-command-specific friction intensity. The existing intensity setting governs everything.
- Changes to popup stats aggregation beyond the `source` metadata tag.
