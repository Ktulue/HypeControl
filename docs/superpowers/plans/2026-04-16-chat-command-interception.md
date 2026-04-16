# Chat Command Interception Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Intercept Twitch `/gift` and `/subscribe` chat commands with friction overlays, power-user voice copy, and a modal fallback safety net.

**Architecture:** New `chatCommandInterceptor.ts` module with its own MutationObserver lifecycle watches for Enter keypresses on `[data-a-target="chat-input"]`, matches against a maintained list of purchase commands, and shows friction overlays before the command sends. A coordination mechanism prevents double-friction when the modal fallback layer also catches the resulting purchase confirmation modal.

**Tech Stack:** TypeScript, Chrome Extension MV3 APIs, existing HC overlay/friction/tracking infrastructure.

**Spec:** `docs/superpowers/specs/2026-04-16-chat-command-interception-design.md`

**Important for subagents:** Do NOT bump versions. Version bumps happen at the end of the full feature, not per-task.

---

## Task 1: Types & Migration

**Files:**
- Modify: `src/shared/types.ts`

Add new fields to `InterceptEvent`, add `chatCommandInterception` to `UserSettings`, update `DEFAULT_SETTINGS`, update `migrateSettings()`, update `sanitizeSettings()`.

- [ ] **Step 1: Add new fields to `InterceptEvent`**

In `src/shared/types.ts`, add three optional fields to the `InterceptEvent` interface:

```typescript
/** A single structured intercept event — stored in chrome.storage.local */
export interface InterceptEvent {
  id: string;               // Date.now().toString() + Math.random().toString(36).slice(2)
  timestamp: number;        // unix ms
  channel: string;
  purchaseType: string;
  rawPrice: string | null;
  priceWithTax: number | null;
  outcome: 'cancelled' | 'proceeded' | 'streaming';
  cancelledAtStep?: number; // which step the user cancelled at (1 = main modal, 2+ = subsequent)
  savedAmount?: number;     // set on cancelled entries = priceWithTax (or 0 if no price)
  purchaseReason?: string;  // set when reason-selection step is completed
  source?: 'button' | 'chat-command';  // NEW — how the purchase was initiated (default: 'button')
  commandText?: string;                // NEW — raw chat command e.g. '/gift 5' (chat-command only)
  quantity?: number;                   // NEW — parsed quantity e.g. 5 (chat-command only)
}
```

- [ ] **Step 2: Add `chatCommandInterception` to `UserSettings`**

Add the new setting interface and field. Place the field after `streamingMode` in the `UserSettings` interface:

```typescript
/** Chat command interception configuration */
export interface ChatCommandInterceptionConfig {
  enabled: boolean;
}
```

In the `UserSettings` interface, add:

```typescript
  chatCommandInterception: ChatCommandInterceptionConfig;
```

- [ ] **Step 3: Add default in `DEFAULT_SETTINGS`**

After the `streamingMode` default, add:

```typescript
  chatCommandInterception: {
    enabled: true,
  },
```

- [ ] **Step 4: Update `migrateSettings()`**

In the return object of `migrateSettings()`, add the new field. Place it after `streamingMode`:

```typescript
    chatCommandInterception: {
      ...DEFAULT_SETTINGS.chatCommandInterception,
      ...(saved.chatCommandInterception || {}),
    },
```

- [ ] **Step 5: Update `sanitizeSettings()`**

Add sanitization for the new field. In the `sanitizeSettings()` function, add after the `streamingMode` block:

```typescript
  const chatCommandInterception: ChatCommandInterceptionConfig = {
    enabled: strictBool(
      (s as any).chatCommandInterception?.enabled ?? true,
      true,
    ),
  };
```

Then include `chatCommandInterception` in the returned `result` object.

- [ ] **Step 6: Update `getFormSettings()` in `src/options/options.ts`**

In `getFormSettings()`, add preservation of the new field (it's managed in the popup, not in options). Add after the `frictionTriggerMode` preservation line:

```typescript
    chatCommandInterception: cachedSettings?.chatCommandInterception ?? DEFAULT_SETTINGS.chatCommandInterception,
```

- [ ] **Step 7: Build to verify**

Run: `npm run build`
Expected: Clean build, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/shared/types.ts src/options/options.ts
git commit -m "feat(types): add InterceptEvent source/command fields and chatCommandInterception setting (#39)"
```

---

## Task 2: Chat Command Interceptor Module (Core)

**Files:**
- Create: `src/content/chatCommandInterceptor.ts`

Build the module skeleton: MutationObserver lifecycle, keydown listener, command matching, `recentlyApproved` token, and the `wasRecentlyChatApproved()` export.

- [ ] **Step 1: Create the module with types and constants**

Create `src/content/chatCommandInterceptor.ts`:

```typescript
/**
 * Chat Command Interceptor — catches /gift and /subscribe in Twitch chat input.
 *
 * Because anyone typing purchase commands by hand is a power user operating at a
 * higher level, HC cannot capture the actual known pricing from the UI. Instead,
 * HC uses Twitch's current Tier 1 pricing ($5.99/sub) since slash commands are
 * locked to Tier 1. The friction overlay, log entries, and spending history use
 * a sharper, power-user voice that acknowledges the user knows the shortcuts.
 */

import { PurchaseAttempt, UserSettings, DEFAULT_SETTINGS, migrateSettings } from '../shared/types';
import { getCurrentChannel } from './detector';
import { log, debug } from '../shared/logger';

// ── Purchase Command Definitions ──────────────────────────────────────────────
// Adding a new command = one array entry.

interface PurchaseCommand {
  pattern: RegExp;
  type: string;
  extractQuantity: (match: RegExpMatchArray) => number;
  pricePerUnit: number;
}

/** Tier 1 sub price — slash commands are locked to Tier 1 */
const TIER_1_PRICE = 5.99;

const PURCHASE_COMMANDS: PurchaseCommand[] = [
  {
    pattern: /^\/gift\s+(\d+)$/i,
    type: 'Gift A Sub (Chat)',
    extractQuantity: (m) => parseInt(m[1], 10),
    pricePerUnit: TIER_1_PRICE,
  },
  {
    pattern: /^\/subscribe$/i,
    type: 'Subscribe (Chat)',
    extractQuantity: () => 1,
    pricePerUnit: TIER_1_PRICE,
  },
];

// ── Chat Input Selector ───────────────────────────────────────────────────────

const CHAT_INPUT_SELECTOR = '[data-a-target="chat-input"]';

// ── Settings ──────────────────────────────────────────────────────────────────

const SETTINGS_KEY = 'hcSettings';

async function loadSettings(): Promise<UserSettings> {
  try {
    const result = await chrome.storage.sync.get(SETTINGS_KEY);
    return migrateSettings(result[SETTINGS_KEY] || {});
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

// ── Recently Approved Token ───────────────────────────────────────────────────
// After the user clicks Proceed on the chat friction overlay, we store a token
// so the next Enter keypress lets the command through without re-triggering.
// Also exported so interceptor.ts can check it for double-friction prevention.

const APPROVAL_TTL_MS = 30_000; // 30 seconds

interface ApprovalToken {
  command: string;
  channel: string;
  timestamp: number;
}

let recentlyApproved: ApprovalToken | null = null;

function setApproved(command: string, channel: string): void {
  recentlyApproved = { command, channel, timestamp: Date.now() };
}

function checkAndClearApproval(command: string, channel: string): boolean {
  if (!recentlyApproved) return false;
  const { command: cmd, channel: ch, timestamp } = recentlyApproved;
  if (cmd === command && ch === channel && (Date.now() - timestamp) < APPROVAL_TTL_MS) {
    recentlyApproved = null;
    return true;
  }
  // Expired — clear it
  if ((Date.now() - timestamp) >= APPROVAL_TTL_MS) {
    recentlyApproved = null;
  }
  return false;
}

/**
 * Check if a chat-command friction overlay was recently approved for this channel.
 * Used by interceptor.ts to prevent double-friction on the modal confirmation button.
 */
export function wasRecentlyChatApproved(channel: string): boolean {
  if (!recentlyApproved) return false;
  const { channel: ch, timestamp } = recentlyApproved;
  return ch === channel && (Date.now() - timestamp) < APPROVAL_TTL_MS;
}

// ── Command Matching ──────────────────────────────────────────────────────────

interface MatchedCommand {
  definition: PurchaseCommand;
  match: RegExpMatchArray;
  quantity: number;
  totalPrice: number;
  rawCommand: string;
}

function matchCommand(text: string): MatchedCommand | null {
  for (const cmd of PURCHASE_COMMANDS) {
    const match = text.match(cmd.pattern);
    if (match) {
      const quantity = cmd.extractQuantity(match);
      if (quantity <= 0 || !Number.isFinite(quantity)) continue;
      const totalPrice = Math.round(quantity * cmd.pricePerUnit * 100) / 100;
      return { definition: cmd, match, quantity, totalPrice, rawCommand: text };
    }
  }
  return null;
}
```

- [ ] **Step 2: Add the keydown handler**

Append to the same file:

```typescript
// ── Keydown Handler ───────────────────────────────────────────────────────────

async function handleKeydown(event: KeyboardEvent): Promise<void> {
  if (event.key !== 'Enter') return;

  const chatInput = event.currentTarget as HTMLElement;
  const text = chatInput.innerText.trim();
  if (!text) return;

  const matched = matchCommand(text);
  if (!matched) return;

  const channel = getCurrentChannel();

  // Check recently-approved token — let the re-press through
  if (checkAndClearApproval(matched.rawCommand, channel)) {
    log(`Chat command approved (re-press): ${matched.rawCommand} on ${channel}`);
    return;
  }

  // Load settings — check if feature is enabled BEFORE blocking
  const settings = await loadSettings();
  if (!settings.chatCommandInterception.enabled) return;

  // Block the command from sending
  event.preventDefault();
  event.stopPropagation();

  log(`Chat command intercepted: ${matched.rawCommand}`, {
    type: matched.definition.type,
    quantity: matched.quantity,
    totalPrice: matched.totalPrice,
    channel,
  });

  // Build a PurchaseAttempt with exact Tier 1 pricing
  const attempt: PurchaseAttempt = {
    type: matched.definition.type,
    rawPrice: `$${matched.totalPrice.toFixed(2)}`,
    priceValue: matched.totalPrice,
    channel,
    timestamp: new Date(),
    element: chatInput,
  };

  // Run the friction flow — this will be wired in Task 3
  const proceeded = await runChatFrictionFlow(attempt, settings, matched);

  if (proceeded) {
    setApproved(matched.rawCommand, channel);
    log(`Chat command approved — waiting for user re-press: ${matched.rawCommand}`);
  } else {
    log(`Chat command cancelled: ${matched.rawCommand}`);
  }
}
```

- [ ] **Step 3: Add the placeholder friction flow function**

This will be fully implemented in Task 3. For now, add a stub that returns true (proceed) so the module compiles:

```typescript
// ── Friction Flow (placeholder — fully implemented in Task 3) ─────────────────

async function runChatFrictionFlow(
  _attempt: PurchaseAttempt,
  _settings: UserSettings,
  _matched: MatchedCommand,
): Promise<boolean> {
  // TODO: Task 3 replaces this with the real friction flow
  return true;
}
```

- [ ] **Step 4: Add the MutationObserver lifecycle**

Append to the same file:

```typescript
// ── MutationObserver Lifecycle ────────────────────────────────────────────────

let observer: MutationObserver | null = null;
let currentChatInput: HTMLElement | null = null;

function attachListener(chatInput: HTMLElement): void {
  if (currentChatInput === chatInput) return; // already attached
  detachListener();
  currentChatInput = chatInput;
  chatInput.addEventListener('keydown', handleKeydown as EventListener, { capture: true });
  log('Chat command interceptor attached to chat input');
}

function detachListener(): void {
  if (currentChatInput) {
    currentChatInput.removeEventListener('keydown', handleKeydown as EventListener, { capture: true });
    debug('Chat command interceptor detached from chat input');
    currentChatInput = null;
  }
}

function scanForChatInput(): void {
  const chatInput = document.querySelector<HTMLElement>(CHAT_INPUT_SELECTOR);
  if (chatInput) {
    attachListener(chatInput);
  } else if (currentChatInput) {
    // Chat input was removed (SPA navigation)
    detachListener();
  }
}

export function setupChatInterceptor(): void {
  // Initial scan
  scanForChatInput();

  // Watch for chat input appearing/disappearing
  observer = new MutationObserver(() => {
    scanForChatInput();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  log('Chat command interceptor set up — watching for chat input');
}

export function teardownChatInterceptor(): void {
  detachListener();
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  recentlyApproved = null;
  log('Chat command interceptor removed');
}
```

- [ ] **Step 5: Build to verify**

Run: `npm run build`
Expected: Clean build. The module compiles but isn't wired into the content script yet.

- [ ] **Step 6: Commit**

```bash
git add src/content/chatCommandInterceptor.ts
git commit -m "feat: add chat command interceptor module with lifecycle and command matching (#39)"
```

---

## Task 3: Friction Flow Integration

**Files:**
- Modify: `src/content/chatCommandInterceptor.ts`

Replace the placeholder `runChatFrictionFlow` with the real implementation that runs the full friction pipeline: streaming bypass, whitelist, cooldown, friction level, overlay, tracking.

- [ ] **Step 1: Add required imports**

At the top of `chatCommandInterceptor.ts`, add these imports alongside the existing ones:

```typescript
import { shouldBypassFriction } from './streamingMode';
import { writeInterceptEvent } from '../shared/interceptLogger';
import { loadSpendingTracker, recordPurchase } from '../shared/spendingTracker';
```

Note: The friction overlay functions (`showMainOverlay`, `runFrictionFlow`, etc.) are not currently exported from `interceptor.ts`. Rather than modifying that file's export surface, we will import the shared utilities and call the overlay from `interceptor.ts` via a new thin export. See Step 2.

- [ ] **Step 2: Export `runFrictionFlowForAttempt` from `interceptor.ts`**

In `src/content/interceptor.ts`, add this export at the bottom of the file (before the `setupInterceptor` export):

```typescript
/**
 * Run the friction flow for an externally-constructed PurchaseAttempt.
 * Used by chatCommandInterceptor to reuse the full overlay pipeline.
 * Returns the FrictionResult (decision + metadata).
 */
export async function runFrictionFlowForAttempt(
  attempt: PurchaseAttempt,
  settings: UserSettings,
  tracker: SpendingTracker,
  maxComparisons?: number,
  whitelistNote?: string,
  onWhitelistAdd?: (behavior: WhitelistBehavior) => Promise<void>,
): Promise<FrictionResult> {
  return runFrictionFlow(attempt, settings, tracker, maxComparisons, whitelistNote, onWhitelistAdd);
}
```

Also export the `FrictionResult` interface and the helper functions needed. Add `export` to the `FrictionResult` interface declaration:

```typescript
export interface FrictionResult {
  decision: OverlayDecision;
  cancelledAtStep?: number;
  purchaseReason?: string;
}
```

And export `checkWhitelist`, `checkCooldown`, `determineFrictionLevel`, `showCooldownBlock`, `checkCapExceedance`, and `showCapExceedanceStep` by adding `export` to their function declarations.

- [ ] **Step 3: Replace the placeholder friction flow**

In `chatCommandInterceptor.ts`, replace the placeholder `runChatFrictionFlow` function with the full implementation:

First, add these imports at the **top** of `chatCommandInterceptor.ts` alongside the existing imports:

```typescript
import {
  runFrictionFlowForAttempt,
  checkWhitelist,
  checkCooldown,
  determineFrictionLevel,
  showCooldownBlock,
  checkCapExceedance,
  showCapExceedanceStep,
} from './interceptor';
import { WhitelistBehavior, sanitizeSettings, SpendingTracker } from '../shared/types';
```

Then replace the placeholder `runChatFrictionFlow` function with:

```typescript
async function runChatFrictionFlow(
  attempt: PurchaseAttempt,
  settings: UserSettings,
  matched: MatchedCommand,
): Promise<boolean> {
  const tracker = await loadSpendingTracker(settings);
  const channel = attempt.channel;
  const priceWithTax = Math.round(attempt.priceValue! * (1 + settings.taxRate / 100) * 100) / 100;

  // Streaming mode bypass
  const streamingBypass = await shouldBypassFriction(settings);
  if (streamingBypass) {
    if (settings.streamingMode.logBypassed) {
      log('Chat command — streaming mode bypass:', { type: attempt.type, rawPrice: attempt.rawPrice });
    }
    await recordPurchase(attempt.priceValue, settings, tracker);
    await writeInterceptEvent({
      channel,
      purchaseType: attempt.type,
      rawPrice: attempt.rawPrice,
      priceWithTax,
      outcome: 'streaming',
      source: 'chat-command',
      commandText: matched.rawCommand,
      quantity: matched.quantity,
    });
    return true; // let the command through
  }

  // Whitelist check
  const whitelistEntry = checkWhitelist(channel, settings);
  if (whitelistEntry) {
    log(`Chat command — whitelisted channel: ${channel} (${whitelistEntry.behavior})`);

    if (whitelistEntry.behavior === 'skip') {
      await recordPurchase(attempt.priceValue, settings, tracker);
      await writeInterceptEvent({
        channel,
        purchaseType: attempt.type,
        rawPrice: attempt.rawPrice,
        priceWithTax,
        outcome: 'proceeded',
        source: 'chat-command',
        commandText: matched.rawCommand,
        quantity: matched.quantity,
      });
      return true;
    }

    if (whitelistEntry.behavior === 'reduced') {
      await recordPurchase(attempt.priceValue, settings, tracker);
      await writeInterceptEvent({
        channel,
        purchaseType: attempt.type,
        rawPrice: attempt.rawPrice,
        priceWithTax,
        outcome: 'proceeded',
        source: 'chat-command',
        commandText: matched.rawCommand,
        quantity: matched.quantity,
      });
      return true;
    }
    // 'full' falls through to normal friction
  }

  // Cooldown check
  const cooldownStatus = checkCooldown(settings, tracker);
  if (cooldownStatus.active) {
    showCooldownBlock(cooldownStatus.remainingMs);
    return false;
  }

  // Friction level
  const frictionLevel = determineFrictionLevel(attempt.priceValue, settings, tracker);

  if (frictionLevel === 'cap-bypass' || frictionLevel === 'none') {
    await recordPurchase(attempt.priceValue, settings, tracker);
    await writeInterceptEvent({
      channel,
      purchaseType: attempt.type,
      rawPrice: attempt.rawPrice,
      priceWithTax,
      outcome: 'proceeded',
      source: 'chat-command',
      commandText: matched.rawCommand,
      quantity: matched.quantity,
    });
    return true;
  }

  // Run full friction flow
  const maxComparisons = frictionLevel === 'nudge' ? settings.frictionThresholds.softNudgeSteps : undefined;
  const whitelistNote = whitelistEntry?.behavior === 'full'
    ? '\u2B50 Whitelisted Channel \u2014 This channel is on your whitelist'
    : undefined;

  const frictionResult = await runFrictionFlowForAttempt(
    attempt, settings, tracker, maxComparisons, whitelistNote,
  );

  if (frictionResult.decision === 'proceed') {
    // Cap exceedance check
    const capExceedance = checkCapExceedance(attempt.priceValue, settings, tracker);
    if (capExceedance.weeklyExceeded || capExceedance.monthlyExceeded) {
      log('Chat command — cap exceedance detected, showing escalated friction');
      const escalatedDecision = await showCapExceedanceStep(capExceedance, settings, tracker);
      if (escalatedDecision === 'cancel') {
        await writeInterceptEvent({
          channel,
          purchaseType: attempt.type,
          rawPrice: attempt.rawPrice,
          priceWithTax,
          outcome: 'cancelled',
          savedAmount: priceWithTax,
          source: 'chat-command',
          commandText: matched.rawCommand,
          quantity: matched.quantity,
          purchaseReason: frictionResult.purchaseReason,
        });
        return false;
      }
    }

    log('Chat command — user completed all friction steps');
    await recordPurchase(attempt.priceValue, settings, tracker);
    await writeInterceptEvent({
      channel,
      purchaseType: attempt.type,
      rawPrice: attempt.rawPrice,
      priceWithTax,
      outcome: 'proceeded',
      source: 'chat-command',
      commandText: matched.rawCommand,
      quantity: matched.quantity,
      purchaseReason: frictionResult.purchaseReason,
    });
    return true;
  }

  // Cancelled
  await writeInterceptEvent({
    channel,
    purchaseType: attempt.type,
    rawPrice: attempt.rawPrice,
    priceWithTax,
    outcome: 'cancelled',
    cancelledAtStep: frictionResult.cancelledAtStep,
    savedAmount: priceWithTax,
    source: 'chat-command',
    commandText: matched.rawCommand,
    quantity: matched.quantity,
    purchaseReason: frictionResult.purchaseReason,
  });
  return false;
}
```

- [ ] **Step 4: Build to verify**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 5: Commit**

```bash
git add src/content/chatCommandInterceptor.ts src/content/interceptor.ts
git commit -m "feat: wire chat command interceptor into full friction flow pipeline (#39)"
```

---

## Task 4: Double-Friction Prevention in `interceptor.ts`

**Files:**
- Modify: `src/content/interceptor.ts`

Add the `wasRecentlyChatApproved` check to `handleClick()` so the modal fallback doesn't re-show friction after the chat interceptor already handled it.

- [ ] **Step 1: Add the import**

At the top of `interceptor.ts`, add:

```typescript
import { wasRecentlyChatApproved } from './chatCommandInterceptor';
```

- [ ] **Step 2: Add the check in `handleClick()`**

In the `handleClick()` function, add the check right after the line `const attempt = createPurchaseAttempt(actualButton);` (around line 1825). Insert before the `const settings = await loadSettings();` line:

```typescript
  // Double-friction prevention: if the chat command interceptor already
  // showed friction for this channel, let the modal click through silently.
  if (wasRecentlyChatApproved(attempt.channel)) {
    log('Chat command already approved — skipping modal friction', {
      channel: attempt.channel,
      type: attempt.type,
    });
    allowNextClick(actualButton);
    return;
  }
```

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add src/content/interceptor.ts
git commit -m "feat: add double-friction prevention for chat-approved purchases (#39)"
```

---

## Task 5: Wire Into Content Script

**Files:**
- Modify: `src/content/index.ts`

Bootstrap the chat interceptor alongside the existing click interceptor.

- [ ] **Step 1: Add imports**

At the top of `src/content/index.ts`, add:

```typescript
import { setupChatInterceptor, teardownChatInterceptor } from './chatCommandInterceptor';
```

- [ ] **Step 2: Call `setupChatInterceptor()` in `init()`**

In the `init()` function, after the line `log('Click interceptor active');` (around line 185), add:

```typescript
    // Set up chat command interceptor (/gift, /subscribe)
    setupChatInterceptor();
    log('Chat command interceptor active');
```

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: Clean build. The chat interceptor is now live in the content script.

- [ ] **Step 4: Commit**

```bash
git add src/content/index.ts
git commit -m "feat: bootstrap chat command interceptor in content script (#39)"
```

---

## Task 6: Settings UI Toggle

**Files:**
- Modify: `src/popup/popup.html`
- Modify: `src/popup/sections/friction.ts`

Add the chat command interception toggle to the Friction section of the popup.

- [ ] **Step 1: Add the toggle HTML**

In `src/popup/popup.html`, inside the `section-friction` section, add the toggle after the thresholds block (after the closing `</div>` of `threshold-details`, around line 214). Place it before the `</section>` closing tag:

```html
        <div class="hc-row">
          <label class="hc-label" for="chat-intercept-enabled">Chat commands</label>
          <label class="toggle-wrap">
            <input type="checkbox" id="chat-intercept-enabled" />
            <span class="toggle-track"></span>
          </label>
          <span class="hc-hint hc-hint--inline">Intercept /gift, /subscribe</span>
        </div>
```

- [ ] **Step 2: Wire the toggle in `friction.ts`**

In `src/popup/sections/friction.ts`, inside the `initFriction()` function, add the element query alongside the other element queries at the top:

```typescript
  const chatInterceptEnabledEl = el.querySelector<HTMLInputElement>('#chat-intercept-enabled')!;
```

Add the event listener after the existing threshold wiring:

```typescript
  // Chat command interception toggle
  chatInterceptEnabledEl.addEventListener('change', () => {
    setPendingField('chatCommandInterception', {
      enabled: chatInterceptEnabledEl.checked,
    });
  });
```

In the `render()` function, add after the threshold rendering:

```typescript
    // Chat command interception
    chatInterceptEnabledEl.checked = settings.chatCommandInterception.enabled;
```

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add src/popup/popup.html src/popup/sections/friction.ts
git commit -m "feat: add chat command interception toggle to popup settings (#39)"
```

---

## Task 7: Power-User Log Display

**Files:**
- Modify: `src/logs/logs.ts`

Display the `source` badge and power-user copy for chat-command entries in the extension logs.

Note: The logs page (`logs.ts`) displays raw `LogEntry` records from the shared logger, not `InterceptEvent` records. The power-user copy is already embedded in the log messages written by `chatCommandInterceptor.ts` (e.g., "Chat command intercepted: /gift 5"). The structured `InterceptEvent` records with `source: 'chat-command'` are stored separately and consumed by `computePopupStats()`.

The logs page therefore does not need modifications for this feature — the chat interceptor's `log()` calls already produce correctly formatted log entries that show up in the extension log tab.

However, if spending history is ever surfaced (it uses `readInterceptEvents()`), the `source` field will be available for filtering and styling.

- [ ] **Step 1: Verify no changes needed**

The extension log page (`src/logs/logs.ts`) renders `LogEntry` records from the shared logger. Chat command interceptions produce log entries via the `log()` function in `chatCommandInterceptor.ts`. These already appear correctly in the logs.

No code changes needed for this task.

- [ ] **Step 2: Commit (skip if no changes)**

No commit needed. This task is documentation-only confirmation.

---

## Task 8: Build, Version Bump & Post-Work Updates

**Files:**
- Modify: `manifest.json`
- Modify: `package.json`
- Modify: `docs/dev/HypeControl-TODO.md`
- Modify: `docs/dev/HC-Project-Document.md`

- [ ] **Step 1: Bump patch version in both `manifest.json` and `package.json`**

Read the current version from `manifest.json`, increment the patch number, and update both files.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Clean build with the new version.

If the build fails, do NOT retry. Tell the user to run `npm run build` manually.

- [ ] **Step 3: Update `docs/dev/HypeControl-TODO.md`**

Mark any related items as completed. Add the chat command interception feature under the appropriate phase. Update the `Updated` date and `Current Version` in the header. Update the footer timestamp.

- [ ] **Step 4: Update `docs/dev/HC-Project-Document.md`**

Update the relevant section to reflect that chat command interception is now implemented. If there's a "Known Limitations" section mentioning `/gift` bypass, update it to reflect the fix.

- [ ] **Step 5: Commit**

```bash
git add manifest.json package.json docs/dev/HypeControl-TODO.md docs/dev/HC-Project-Document.md
git commit -m "maint: bump version and update docs for chat command interception (#39)"
```
