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

// ── Friction Flow (placeholder — fully implemented in Task 3) ─────────────────

async function runChatFrictionFlow(
  _attempt: PurchaseAttempt,
  _settings: UserSettings,
  _matched: MatchedCommand,
): Promise<boolean> {
  // Task 3 replaces this with the real friction flow
  return true;
}

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

  // Block synchronously BEFORE any async work — otherwise the browser may
  // dispatch Enter to Twitch during the await gap (race condition).
  event.preventDefault();
  event.stopPropagation();

  // Now safe to go async — check if feature is enabled
  const settings = await loadSettings();
  if (!settings.chatCommandInterception.enabled) {
    // Feature disabled — user must re-press Enter (unavoidable since we
    // already blocked synchronously; can't un-preventDefault).
    debug('Chat command interception disabled — command blocked, user must re-press');
    return;
  }

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

  // Run the friction flow
  const proceeded = await runChatFrictionFlow(attempt, settings, matched);

  if (proceeded) {
    setApproved(matched.rawCommand, channel);
    log(`Chat command approved — waiting for user re-press: ${matched.rawCommand}`);
  } else {
    log(`Chat command cancelled: ${matched.rawCommand}`);
  }
}

// ── MutationObserver Lifecycle ────────────────────────────────────────────────

let observer: MutationObserver | null = null;
let currentChatInput: HTMLElement | null = null;

function attachListener(chatInput: HTMLElement): void {
  if (currentChatInput === chatInput) return; // already attached
  detachListener();
  currentChatInput = chatInput;
  chatInput.addEventListener('keydown', handleKeydown as unknown as EventListener, { capture: true });
  log('Chat command interceptor attached to chat input');
}

function detachListener(): void {
  if (currentChatInput) {
    currentChatInput.removeEventListener('keydown', handleKeydown as unknown as EventListener, { capture: true });
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
