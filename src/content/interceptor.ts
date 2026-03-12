/**
 * Interceptor module - blocks purchase clicks and shows confirmation overlay
 * After the main overlay, each enabled comparison item becomes a separate
 * friction step that must be clicked through sequentially.
 */

import {
  PurchaseAttempt, OverlayDecision, OverlayCallback, UserSettings, DEFAULT_SETTINGS,
  FrictionLevel, SpendingTracker, DEFAULT_SPENDING_TRACKER, ComparisonItem, migrateSettings,
  WhitelistEntry, WhitelistBehavior,
} from '../shared/types';
import { isPurchaseButton, createPurchaseAttempt } from './detector';
import { shouldBypassFriction } from './streamingMode';
import { applyThemeToOverlay } from './themeManager';
import { log, debug } from '../shared/logger';
import { writeInterceptEvent } from '../shared/interceptLogger';

/** Result returned by runFrictionFlow */
interface FrictionResult {
  decision: OverlayDecision;
  cancelledAtStep?: number;
  purchaseReason?: string;
}

/** Storage keys */
const SETTINGS_KEY = 'hcSettings';
const SPENDING_KEY = 'hcSpending';

// ── Settings & Tracker ──────────────────────────────────────────────────

async function loadSettings(): Promise<UserSettings> {
  try {
    const result = await chrome.storage.sync.get(SETTINGS_KEY);
    return migrateSettings(result[SETTINGS_KEY] || {});
  } catch (e) {
    debug('Failed to load settings, using defaults:', e);
    return { ...DEFAULT_SETTINGS };
  }
}

async function loadSpendingTracker(): Promise<SpendingTracker> {
  try {
    const result = await chrome.storage.local.get(SPENDING_KEY);
    const tracker: SpendingTracker = result[SPENDING_KEY] || { ...DEFAULT_SPENDING_TRACKER };
    const today = new Date().toISOString().split('T')[0];
    if (tracker.dailyDate !== today) {
      tracker.dailyTotal = 0;
      tracker.dailyDate = today;
    }
    return tracker;
  } catch (e) {
    debug('Failed to load spending tracker:', e);
    return { ...DEFAULT_SPENDING_TRACKER };
  }
}

async function saveSpendingTracker(tracker: SpendingTracker): Promise<void> {
  try {
    await chrome.storage.local.set({ [SPENDING_KEY]: tracker });
  } catch (e) {
    debug('Failed to save spending tracker:', e);
  }
}

async function recordPurchase(priceValue: number | null, settings: UserSettings, tracker: SpendingTracker): Promise<void> {
  if (priceValue && priceValue > 0) {
    const priceWithTax = Math.round(priceValue * (1 + settings.taxRate / 100) * 100) / 100;
    const before = tracker.dailyTotal;
    tracker.dailyTotal = Math.round((tracker.dailyTotal + priceWithTax) * 100) / 100;
    tracker.sessionTotal = Math.round((tracker.sessionTotal + priceWithTax) * 100) / 100;
    tracker.dailyDate = new Date().toISOString().split('T')[0];
    log(`recordPurchase: +$${priceWithTax.toFixed(2)} (raw=$${priceValue.toFixed(2)}, tax=${settings.taxRate}%) — daily $${before.toFixed(2)} → $${tracker.dailyTotal.toFixed(2)}`);
  }
  tracker.lastProceedTimestamp = Date.now();
  await saveSpendingTracker(tracker);
}

// ── Cooldown & Friction Level ───────────────────────────────────────────

function checkCooldown(settings: UserSettings, tracker: SpendingTracker): { active: boolean; remainingMs: number } {
  if (!settings.cooldown.enabled || !tracker.lastProceedTimestamp) {
    return { active: false, remainingMs: 0 };
  }
  const cooldownMs = settings.cooldown.minutes * 60 * 1000;
  const remaining = cooldownMs - (Date.now() - tracker.lastProceedTimestamp);
  return { active: remaining > 0, remainingMs: Math.max(0, remaining) };
}

// ── Whitelist ────────────────────────────────────────────────────────────

function checkWhitelist(channel: string, settings: UserSettings): WhitelistEntry | null {
  if (!settings.whitelistedChannels || settings.whitelistedChannels.length === 0) return null;
  const normalized = channel.trim().toLowerCase();
  return settings.whitelistedChannels.find(e => e.username === normalized) ?? null;
}

function showWhitelistReducedToast(channel: string, priceDisplay: string, durationMs: number): void {
  document.getElementById('hc-whitelist-toast')?.remove();
  const toast = document.createElement('div');
  toast.id = 'hc-whitelist-toast';
  toast.className = 'hc-whitelist-toast';
  toast.textContent = `\u2705 Logged! ${priceDisplay} on ${channel} (whitelisted)`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hc-whitelist-toast--fade');
    setTimeout(() => toast.remove(), 300);
  }, durationMs);
}

function determineFrictionLevel(
  priceValue: number | null,
  settings: UserSettings,
  tracker: SpendingTracker,
): FrictionLevel {
  // Daily cap check FIRST — acts as a bypass floor (pre-approved spending allowance).
  // Only applies when price is known; unknown price falls through to full friction.
  if (settings.dailyCap.enabled && priceValue !== null && priceValue > 0) {
    const priceWithTax = Math.round(priceValue * (1 + settings.taxRate / 100) * 100) / 100;
    const newTotal = Math.round((tracker.dailyTotal + priceWithTax) * 100) / 100;
    if (newTotal >= settings.dailyCap.amount) {
      log(`Daily cap check: $${priceWithTax.toFixed(2)} would bring daily total to $${newTotal.toFixed(2)}, meeting/exceeding $${settings.dailyCap.amount.toFixed(2)} cap — full modal triggered`);
      return 'full';
    }
    log(`Daily cap bypass: $${priceWithTax.toFixed(2)} keeps daily total at $${newTotal.toFixed(2)}, under $${settings.dailyCap.amount.toFixed(2)} cap — bypassing friction`);
    return 'cap-bypass';
  }

  if (!settings.frictionThresholds.enabled) {
    log('Thresholds disabled — defaulting to full modal');
    return 'full';
  }
  if (priceValue === null || priceValue <= 0) return 'full';

  const priceWithTax = Math.round(priceValue * (1 + settings.taxRate / 100) * 100) / 100;
  const t1 = settings.frictionThresholds.thresholdFloor;
  const t2 = settings.frictionThresholds.thresholdCeiling;
  const price = `$${priceWithTax.toFixed(2)}`;

  if (priceWithTax < t1) {
    log(`Threshold check: ${price} is BELOW $${t1.toFixed(2)} floor — no friction applied`);
    return 'none';
  }
  if (priceWithTax < t2) {
    log(`Threshold check: ${price} is BETWEEN $${t1.toFixed(2)} floor and $${t2.toFixed(2)} ceiling — soft nudge triggered`);
    return 'nudge';
  }
  log(`Threshold check: ${price} is ABOVE $${t2.toFixed(2)} ceiling — full friction triggered`);
  return 'full';
}

// ── Formatting Helpers ──────────────────────────────────────────────────

function formatWorkTime(hours: number): string {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  return `${hours.toFixed(1)} hour${hours !== 1 ? 's' : ''}`;
}

function formatPurchaseType(type: string): string {
  return type || 'Purchase';
}

/** Display data for a single comparison step */
interface ComparisonDisplay {
  amountText: string;  // big top display  e.g. "~35", "~½", "~12%"
  labelText: string;   // label below amount  e.g. "Costco glizzies", "Bob Ross Paint Set"
  sentence: string;    // full contextual sentence (no trailing period)
}

/**
 * Format a comparison display based on the ratio of purchaseAmount to item.price.
 *
 * Tiers:
 *   ratio >= 2          → "~N [plural]"           (rounded to nearest whole number)
 *   1.1 <= ratio < 2    → "~N.N [plural]"          (1 decimal place)
 *   1.0 <= ratio < 1.1  → "~1 [singular name]"
 *   0.5 <= ratio < 1.0  → "about half a [name]"
 *   0.25 <= ratio < 0.5 → "about a quarter of a [name]"
 *   ratio < 0.25        → "~N% of a [name]"
 */
function formatComparisonDisplay(item: ComparisonItem, purchaseAmount: number, taxPrice: string): ComparisonDisplay {
  if (item.price <= 0) {
    return { amountText: '~0', labelText: item.pluralLabel, sentence: `That ${taxPrice} can't buy any ${item.pluralLabel}` };
  }

  const ratio = purchaseAmount / item.price;

  if (ratio >= 2) {
    const count = Math.round(ratio);
    return {
      amountText: `~${count}`,
      labelText: item.pluralLabel,
      sentence: `That ${taxPrice} is worth ~${count} ${item.pluralLabel}`,
    };
  }

  if (ratio >= 1.1) {
    const count = (Math.round(ratio * 10) / 10).toFixed(1);
    return {
      amountText: `~${count}`,
      labelText: item.pluralLabel,
      sentence: `That ${taxPrice} is worth ~${count} ${item.pluralLabel}`,
    };
  }

  if (ratio >= 1.0) {
    return {
      amountText: '~1',
      labelText: item.name,
      sentence: `That ${taxPrice} is worth ~1 ${item.name}`,
    };
  }

  if (ratio >= 0.5) {
    return {
      amountText: '~\u00BD', // ½ (one-half)
      labelText: item.name,
      sentence: `That ${taxPrice} is only about half a ${item.name}`,
    };
  }

  if (ratio >= 0.25) {
    return {
      amountText: '~\u00BC', // ¼ (one-quarter)
      labelText: item.name,
      sentence: `That ${taxPrice} is only about a quarter of a ${item.name}`,
    };
  }

  const percent = Math.round(ratio * 100);
  return {
    amountText: `~${percent}%`,
    labelText: `of a ${item.name}`,
    sentence: `That ${taxPrice} is only ~${percent}% of a ${item.name}`,
  };
}

/**
 * Build the cost breakdown HTML (without comparison lines — those are separate steps now)
 */
function buildCostBreakdown(priceValue: number, settings: UserSettings, tracker: SpendingTracker): string {
  const priceWithTax = Math.round(priceValue * (1 + settings.taxRate / 100) * 100) / 100;
  const hoursOfWork = priceWithTax / settings.hourlyRate;

  let dailyInfo = '';
  if (settings.dailyCap.enabled) {
    const newTotal = Math.round((tracker.dailyTotal + priceWithTax) * 100) / 100;
    const percentage = Math.round((newTotal / settings.dailyCap.amount) * 100);
    const overBudget = newTotal > settings.dailyCap.amount;
    const dailyClass = overBudget ? 'hc-daily-over' : (percentage >= 80 ? 'hc-daily-warning' : '');
    dailyInfo = `
      <p class="hc-daily-tracker ${dailyClass}">
        Daily: $${newTotal.toFixed(2)} / $${settings.dailyCap.amount.toFixed(2)}
        ${overBudget ? ' \u2014 OVER BUDGET' : ` (${percentage}%)`}
      </p>
    `;
  }

  let sessionInfo = '';
  if (tracker.sessionTotal > 0) {
    sessionInfo = `<p class="hc-session-tracker">Session total: $${tracker.sessionTotal.toFixed(2)}</p>`;
  }

  return `
    <div class="hc-cost-breakdown">
      <p class="hc-cost-line">
        <span class="hc-cost-label">With ${settings.taxRate}% tax:</span>
        <span class="hc-cost-value">$${priceWithTax.toFixed(2)}</span>
      </p>
      <p class="hc-cost-line hc-cost-hours">
        That's <strong>${formatWorkTime(hoursOfWork)}</strong> of work
      </p>
      ${dailyInfo}
      ${sessionInfo}
    </div>
  `;
}

// ── Overlay State ───────────────────────────────────────────────────────

let overlayVisible = false;

let pendingPurchase: {
  attempt: PurchaseAttempt;
  originalEvent: MouseEvent;
} | null = null;

function removeOverlay(overlay: HTMLElement): void {
  overlay.remove();
  overlayVisible = false;
}

// ── Overlay: Helpers ────────────────────────────────────────────────────

/** Context passed to showModalPromise for dismissal logging */
interface ModalContext {
  type: string;
  rawPrice: string | null;
}

/**
 * Generic helper — show a modal and return a promise that resolves with the decision.
 * Handles backdrop click, Escape key, and button clicks.
 * Logs each dismissal method distinctly when context is provided.
 */
function showModalPromise(overlay: HTMLElement, context?: ModalContext): Promise<OverlayDecision> {
  return new Promise((resolve) => {
    let resolved = false;
    const previousFocus = document.activeElement as HTMLElement | null;
    const tag = context
      ? `(${context.type} - ${context.rawPrice || 'Price not detected'})`
      : '';

    const finish = (decision: OverlayDecision, method: string) => {
      if (resolved) return;
      resolved = true;
      if (context) {
        if (decision === 'proceed') {
          log(`User clicked Proceed Anyway ${tag}`);
        } else if (method === 'button') {
          log(`User clicked Cancel button ${tag}`);
        } else if (method === 'outside') {
          log(`User dismissed modal via outside click ${tag}`);
        } else if (method === 'escape') {
          log(`User dismissed modal via Escape key ${tag}`);
        }
      }
      document.removeEventListener('keydown', handleKeydown);
      removeOverlay(overlay);
      previousFocus?.focus();
      resolve(decision);
    };

    overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => finish('cancel', 'button'));
    overlay.querySelector('[data-action="proceed"]')?.addEventListener('click', () => finish('proceed', 'button'));

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish('cancel', 'outside');
    });

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        finish('cancel', 'escape');
        return;
      }
      if (e.key === 'Tab') {
        const focusableButtons = Array.from(overlay.querySelectorAll<HTMLButtonElement>('.hc-btn'));
        if (focusableButtons.length === 0) return;
        const first = focusableButtons[0];
        const last = focusableButtons[focusableButtons.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeydown);

    applyThemeToOverlay(overlay);
    document.body.appendChild(overlay);
    (overlay.querySelector('[data-action="cancel"]') as HTMLButtonElement)?.focus();
  });
}

// ── Overlay: Whitelist Quick-Add ────────────────────────────────────────

/** Behavior descriptions for the whitelist quick-add selector */
const WHITELIST_BEHAVIOR_LABELS: Record<WhitelistBehavior, { name: string; desc: string }> = {
  skip:    { name: 'Skip',    desc: 'No friction, silently logged' },
  reduced: { name: 'Reduced', desc: 'Toast notification only' },
  full:    { name: 'Full',    desc: 'Full friction flow with a whitelist note' },
};

/**
 * Replaces the quick-add button with an inline whitelist behavior selector.
 */
function showWhitelistSelector(
  overlay: HTMLElement,
  channel: string,
  settings: UserSettings,
  onConfirm: (behavior: WhitelistBehavior) => Promise<void>,
): void {
  const existingEntry = settings.whitelistedChannels.find(
    e => e.username === channel.trim().toLowerCase()
  );

  const warningHTML = existingEntry
    ? `<div class="hc-whitelist-warning">
         ⚠️ Already whitelisted as <strong>${existingEntry.behavior}</strong>. Selecting a new behavior will update it.
       </div>`
    : '';

  const optionsHTML = (['skip', 'reduced', 'full'] as WhitelistBehavior[]).map(behavior => {
    const { name, desc } = WHITELIST_BEHAVIOR_LABELS[behavior];
    const selected = existingEntry?.behavior === behavior ? ' style="border-color: #9147ff;"' : '';
    return `
      <button class="hc-whitelist-option" data-behavior="${behavior}"${selected}>
        <span class="hc-whitelist-option-name">${name}</span>
        <span class="hc-whitelist-option-desc">${desc}</span>
      </button>
    `;
  }).join('');

  const selectorHTML = `
    <div class="hc-whitelist-selector">
      <p class="hc-whitelist-selector-title">Remember <strong>${channel}</strong> as:</p>
      ${warningHTML}
      <div class="hc-whitelist-options">
        ${optionsHTML}
      </div>
    </div>
  `;

  // Replace the quick-add wrap with the selector
  const wrap = overlay.querySelector('.hc-quick-add-wrap');
  if (wrap) wrap.outerHTML = selectorHTML;

  // Wire behavior buttons
  overlay.querySelectorAll<HTMLButtonElement>('[data-behavior]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const behavior = btn.dataset.behavior as WhitelistBehavior;
      log(`Whitelist quick-add: ${channel} → ${behavior}`);
      await onConfirm(behavior);
    });
  });
}

// ── Overlay: Main (Step 1) ──────────────────────────────────────────────

async function showMainOverlay(
  attempt: PurchaseAttempt,
  settings: UserSettings,
  tracker: SpendingTracker,
  whitelistNote?: string,
  onWhitelistAdd?: (behavior: WhitelistBehavior) => Promise<void>,
): Promise<OverlayDecision> {
  if (overlayVisible) return 'cancel';
  overlayVisible = true;

  const priceDisplay = attempt.rawPrice || 'Price not detected';

  let priceExtra = '';
  if (attempt.priceValue !== null && attempt.priceValue > 0) {
    priceExtra = buildCostBreakdown(attempt.priceValue, settings, tracker);
  } else {
    priceExtra = '<p class="hc-price-note">Unable to detect price. Proceed with caution.</p>';
  }

  const quickAddBtn = onWhitelistAdd
    ? `<div class="hc-quick-add-wrap">
         <button class="hc-btn-text" id="hc-quick-add-btn">
           ⭐ Remember this channel
         </button>
       </div>`
    : '';

  const overlay = document.createElement('div');
  overlay.id = 'hc-overlay';
  overlay.className = 'hc-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'hc-overlay-heading');
  overlay.setAttribute('aria-describedby', 'hc-overlay-desc');
  overlay.innerHTML = `
    <div class="hc-modal">
      <div class="hc-header">
        <span class="hc-icon">\u{1F6E1}\uFE0F</span>
        <h2 class="hc-title">Hype Control</h2>
      </div>
      <div class="hc-content">
        ${whitelistNote ? `<div class="hc-whitelist-note">${whitelistNote}</div>` : ''}
        <div class="hc-price-section" id="hc-overlay-desc">
          <p class="hc-label" id="hc-overlay-heading">You're about to spend:</p>
          <p class="hc-price">${priceDisplay}</p>
          ${priceExtra}
        </div>
        <div class="hc-info">
          <p class="hc-channel">Channel: <strong>${attempt.channel}</strong></p>
          <p class="hc-type">Type: <strong>${formatPurchaseType(attempt.type)}</strong></p>
        </div>
        <p class="hc-message">
          Take a moment to consider: Is this purchase intentional or impulsive?
        </p>
      </div>
      <div class="hc-actions">
        <button class="hc-btn hc-btn-cancel" data-action="cancel">Cancel</button>
        <button class="hc-btn hc-btn-proceed" data-action="proceed">Proceed Anyway</button>
      </div>
      ${quickAddBtn}
    </div>
  `;

  log('Step 1 — Main overlay shown:', {
    type: attempt.type,
    rawPrice: attempt.rawPrice,
    priceValue: attempt.priceValue,
    channel: attempt.channel,
  });

  // Wire quick-add button if callback provided
  if (onWhitelistAdd) {
    const quickAddBtnEl = overlay.querySelector('#hc-quick-add-btn') as HTMLButtonElement | null;
    quickAddBtnEl?.addEventListener('click', () => {
      showWhitelistSelector(overlay, attempt.channel, settings, onWhitelistAdd);
    });
  }

  return showModalPromise(overlay, { type: attempt.type, rawPrice: attempt.rawPrice });
}

// ── Overlay: Comparison Step ────────────────────────────────────────────

async function showComparisonStep(
  item: ComparisonItem,
  display: ComparisonDisplay,
  stepNumber: number,
  totalSteps: number,
  attempt: PurchaseAttempt,
): Promise<OverlayDecision> {
  if (overlayVisible) return 'cancel';
  overlayVisible = true;

  const overlay = document.createElement('div');
  overlay.id = 'hc-overlay';
  overlay.className = 'hc-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'hc-overlay-heading');
  overlay.setAttribute('aria-describedby', 'hc-overlay-desc');
  overlay.innerHTML = `
    <div class="hc-modal">
      <div class="hc-header">
        <span class="hc-icon">${item.emoji}</span>
        <h2 class="hc-title" id="hc-overlay-heading">STEP ${stepNumber} OF ${totalSteps}</h2>
      </div>
      <div class="hc-content">
        <div class="hc-comparison-step" id="hc-overlay-desc">
          <p class="hc-comparison-amount">${display.amountText}</p>
          <p class="hc-comparison-label">${display.labelText}</p>
        </div>
        <p class="hc-message">
          <strong>${display.sentence}</strong>. Still want to proceed?
        </p>
      </div>
      <div class="hc-actions">
        <button class="hc-btn hc-btn-cancel" data-action="cancel">Cancel</button>
        <button class="hc-btn hc-btn-proceed" data-action="proceed">Proceed Anyway</button>
      </div>
    </div>
  `;

  log(`Step ${stepNumber} — Comparison: ${item.name}`, {
    emoji: item.emoji,
    amountText: display.amountText,
    labelText: display.labelText,
    channel: attempt.channel,
    rawPrice: attempt.rawPrice,
  });

  return showModalPromise(overlay, { type: attempt.type, rawPrice: attempt.rawPrice });
}

// ── Overlay: Cooldown Block ─────────────────────────────────────────────

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function showCooldownBlock(remainingMs: number): void {
  if (overlayVisible) return;
  overlayVisible = true;

  const expiresAt = Date.now() + remainingMs;
  const previousFocus = document.activeElement as HTMLElement | null;

  const overlay = document.createElement('div');
  overlay.id = 'hc-overlay';
  overlay.className = 'hc-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'hc-overlay-heading');
  overlay.setAttribute('aria-describedby', 'hc-overlay-desc');
  overlay.innerHTML = `
    <div class="hc-modal hc-cooldown-modal">
      <div class="hc-header" style="background: linear-gradient(135deg, var(--hc-danger), var(--hc-danger-dark));">
        <span class="hc-icon">\u231B</span>
        <h2 class="hc-title" id="hc-overlay-heading">COOLDOWN ACTIVE</h2>
      </div>
      <div class="hc-content" id="hc-overlay-desc" style="text-align: center;">
        <p class="hc-label">You recently made a purchase.</p>
        <p class="hc-price" id="hc-cooldown-timer" style="font-size: 24px;">${formatCountdown(remainingMs)} remaining</p>
        <p class="hc-message">Take a breather. This cooldown helps you avoid impulse spending.</p>
      </div>
      <div class="hc-actions">
        <button class="hc-btn hc-btn-cancel" data-action="cancel" style="flex: 1;">OK, I'll Wait</button>
      </div>
    </div>
  `;

  let intervalId: ReturnType<typeof setInterval> | null = null;

  const dismiss = () => {
    if (intervalId !== null) clearInterval(intervalId);
    document.removeEventListener('keydown', handleKeydown);
    removeOverlay(overlay);
    previousFocus?.focus();
  };

  overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', dismiss);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) dismiss(); });

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { dismiss(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      (overlay.querySelector('[data-action="cancel"]') as HTMLButtonElement)?.focus();
    }
  };
  document.addEventListener('keydown', handleKeydown);

  // Live countdown tick
  const timerEl = overlay.querySelector('#hc-cooldown-timer') as HTMLElement;
  const btnEl = overlay.querySelector('[data-action="cancel"]') as HTMLButtonElement;
  intervalId = setInterval(() => {
    const left = expiresAt - Date.now();
    if (left <= 0) {
      if (intervalId !== null) clearInterval(intervalId);
      intervalId = null;
      if (timerEl) timerEl.textContent = 'Cooldown complete!';
      if (btnEl) btnEl.textContent = 'Cooldown Complete \u2014 Continue';
      return;
    }
    if (timerEl) timerEl.textContent = `${formatCountdown(left)} remaining`;
  }, 1000);

  applyThemeToOverlay(overlay);
  document.body.appendChild(overlay);
  (overlay.querySelector('[data-action="cancel"]') as HTMLButtonElement)?.focus();
}

// ── Overlay: Standalone Delay Timer Step ───────────────────────────────

async function showDelayTimerStep(
  durationSeconds: number,
  attempt: PurchaseAttempt,
): Promise<OverlayDecision> {
  if (overlayVisible) return 'cancel';
  overlayVisible = true;

  const overlay = document.createElement('div');
  overlay.id = 'hc-overlay';
  overlay.className = 'hc-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'hc-overlay-heading');
  overlay.setAttribute('aria-describedby', 'hc-overlay-desc');
  overlay.innerHTML = `
    <div class="hc-modal">
      <div class="hc-header">
        <span class="hc-icon">⏱️</span>
        <h2 class="hc-title" id="hc-overlay-heading">Last Chance to Reconsider</h2>
      </div>
      <div class="hc-content" id="hc-overlay-desc" style="text-align: center;">
        <p class="hc-message">Waiting ${durationSeconds} seconds before this purchase goes through.</p>
        <div class="hc-progress-wrap">
          <div class="hc-progress-bar" id="hc-delay-progress"></div>
        </div>
        <p class="hc-countdown" id="hc-delay-countdown">${durationSeconds}s remaining</p>
      </div>
      <div class="hc-actions">
        <button class="hc-btn hc-btn-cancel" data-action="cancel">Cancel Purchase</button>
        <button class="hc-btn hc-btn-proceed" data-action="proceed" disabled aria-disabled="true" style="opacity: 0.4; cursor: not-allowed;">
          Waiting...
        </button>
      </div>
    </div>
  `;

  log(`Delay timer step (${durationSeconds}s) started`, { channel: attempt.channel });

  return new Promise((resolve) => {
    let resolved = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const previousFocus = document.activeElement as HTMLElement | null;
    const expiresAt = Date.now() + durationSeconds * 1000;

    const finish = (decision: OverlayDecision) => {
      if (resolved) return;
      resolved = true;
      if (intervalId !== null) clearInterval(intervalId);
      document.removeEventListener('keydown', handleKeydown);
      removeOverlay(overlay);
      previousFocus?.focus();
      resolve(decision);
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { finish('cancel'); return; }
      if (e.key === 'Tab') {
        const focusable = Array.from(
          overlay.querySelectorAll<HTMLButtonElement>('.hc-btn:not([disabled])')
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKeydown);

    overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => finish('cancel'));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish('cancel'); });

    const progressEl = overlay.querySelector('#hc-delay-progress') as HTMLElement | null;
    const countdownEl = overlay.querySelector('#hc-delay-countdown') as HTMLElement | null;
    const proceedBtn = overlay.querySelector('[data-action="proceed"]') as HTMLButtonElement | null;

    intervalId = setInterval(() => {
      const left = expiresAt - Date.now();
      const elapsed = durationSeconds * 1000 - left;
      const pct = Math.min(100, (elapsed / (durationSeconds * 1000)) * 100);
      if (progressEl) progressEl.style.width = `${pct}%`;

      if (left <= 0) {
        if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
        if (countdownEl) countdownEl.textContent = 'Time\'s up — proceed when ready';
        if (proceedBtn) {
          proceedBtn.disabled = false;
          proceedBtn.removeAttribute('aria-disabled');
          proceedBtn.style.opacity = '';
          proceedBtn.style.cursor = '';
          proceedBtn.textContent = 'Proceed';
          proceedBtn.addEventListener('click', () => finish('proceed'));
          proceedBtn.focus();
        }
        return;
      }

      const sec = Math.ceil(left / 1000);
      if (countdownEl) countdownEl.textContent = `${sec}s remaining`;
    }, 100);

    applyThemeToOverlay(overlay);
    document.body.appendChild(overlay);
    (overlay.querySelector('[data-action="cancel"]') as HTMLButtonElement)?.focus();
  });
}

// ── Overlay: Reason Selection Step ─────────────────────────────────────

const PURCHASE_REASONS = [
  'I planned this purchase',
  "It's a good deal / limited time",
  'I deserve a treat',
  'Supporting a creator I love',
  'Just browsing, why not',
] as const;

async function showReasonSelectionStep(
  overlay: HTMLElement,
): Promise<{ decision: 'cancel' | 'proceed'; reason?: string }> {
  const reasonButtonsHTML = PURCHASE_REASONS.map(reason => `
    <button class="hc-reason-btn" data-reason="${reason}">${reason}</button>
  `).join('');

  overlay.innerHTML = `
    <div class="hc-modal">
      <div class="hc-header">
        <span class="hc-icon">🤔</span>
        <h2 class="hc-title" id="hc-overlay-heading">Why are you buying this?</h2>
      </div>
      <div class="hc-content" id="hc-overlay-desc">
        <p class="hc-message">Select a reason to continue.</p>
        <div class="hc-reason-list">
          ${reasonButtonsHTML}
        </div>
      </div>
      <div class="hc-actions hc-actions--column">
        <button class="hc-btn hc-btn-proceed" data-action="proceed" disabled aria-disabled="true" style="opacity: 0.4; cursor: not-allowed;">
          Continue
        </button>
        <button class="hc-btn hc-btn-cancel" data-action="cancel">No, cancel</button>
      </div>
    </div>
  `;

  log('Reason selection step shown');

  return new Promise((resolve) => {
    let resolved = false;
    let selectedReason: string | undefined;
    const previousFocus = document.activeElement as HTMLElement | null;
    const proceedBtn = overlay.querySelector('[data-action="proceed"]') as HTMLButtonElement | null;

    const finish = (decision: 'cancel' | 'proceed') => {
      if (resolved) return;
      resolved = true;
      document.removeEventListener('keydown', handleKeydown);
      removeOverlay(overlay);
      previousFocus?.focus();
      if (decision === 'proceed') {
        resolve({ decision: 'proceed', reason: selectedReason });
      } else {
        resolve({ decision: 'cancel' });
      }
    };

    // Wire reason buttons
    overlay.querySelectorAll<HTMLButtonElement>('.hc-reason-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // Deselect all, select clicked
        overlay.querySelectorAll<HTMLButtonElement>('.hc-reason-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedReason = btn.dataset.reason;
        // Enable proceed button
        if (proceedBtn) {
          proceedBtn.disabled = false;
          proceedBtn.removeAttribute('aria-disabled');
          proceedBtn.style.opacity = '';
          proceedBtn.style.cursor = '';
        }
      });
    });

    overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => finish('cancel'));
    overlay.querySelector('[data-action="proceed"]')?.addEventListener('click', () => {
      if (selectedReason) finish('proceed');
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish('cancel');
    });

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { finish('cancel'); return; }
      if (e.key === 'Tab') {
        const focusable = Array.from(
          overlay.querySelectorAll<HTMLButtonElement>('.hc-btn:not([disabled]), .hc-reason-btn')
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKeydown);

    applyThemeToOverlay(overlay);
    document.body.appendChild(overlay);
    (overlay.querySelector('.hc-reason-btn') as HTMLButtonElement)?.focus();
  });
}

// ── Overlay: Friction Cooldown Step ────────────────────────────────────

/**
 * Mandatory waiting step — the user must wait for the full countdown before
 * the Proceed button becomes available. Cancel is always enabled.
 */
async function showFrictionCooldownStep(
  overlay: HTMLElement,
  durationSeconds: number,
): Promise<'cancel' | 'proceed'> {
  overlay.innerHTML = `
    <div class="hc-modal">
      <div class="hc-header">
        <span class="hc-icon">⏳</span>
        <h2 class="hc-title" id="hc-overlay-heading">Take a moment to reflect...</h2>
      </div>
      <div class="hc-content" id="hc-overlay-desc" style="text-align: center;">
        <p class="hc-message">Please wait ${durationSeconds} seconds before continuing.</p>
        <div class="hc-progress-wrap">
          <div class="hc-progress-bar" id="hc-cooldown-progress"></div>
        </div>
        <p class="hc-countdown" id="hc-cooldown-countdown">${durationSeconds}s remaining</p>
      </div>
      <div class="hc-actions">
        <button class="hc-btn hc-btn-cancel" data-action="cancel">Cancel Purchase</button>
        <button class="hc-btn hc-btn-proceed" data-action="proceed" disabled aria-disabled="true" style="opacity: 0.4; cursor: not-allowed;">
          Waiting...
        </button>
      </div>
    </div>
  `;

  log(`Friction cooldown step (${durationSeconds}s) shown`);

  return new Promise((resolve) => {
    let resolved = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const previousFocus = document.activeElement as HTMLElement | null;
    const expiresAt = Date.now() + durationSeconds * 1000;

    const finish = (decision: 'cancel' | 'proceed') => {
      if (resolved) return;
      resolved = true;
      if (intervalId !== null) clearInterval(intervalId);
      document.removeEventListener('keydown', handleKeydown);
      previousFocus?.focus();
      resolve(decision);
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { finish('cancel'); return; }
      if (e.key === 'Tab') {
        const focusable = Array.from(
          overlay.querySelectorAll<HTMLButtonElement>('.hc-btn:not([disabled])')
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKeydown);

    overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => finish('cancel'));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish('cancel'); });

    const progressEl = overlay.querySelector('#hc-cooldown-progress') as HTMLElement | null;
    const countdownEl = overlay.querySelector('#hc-cooldown-countdown') as HTMLElement | null;
    const proceedBtn = overlay.querySelector('[data-action="proceed"]') as HTMLButtonElement | null;

    intervalId = setInterval(() => {
      const left = expiresAt - Date.now();
      const elapsed = durationSeconds * 1000 - left;
      const pct = Math.min(100, (elapsed / (durationSeconds * 1000)) * 100);
      if (progressEl) progressEl.style.width = `${pct}%`;

      if (left <= 0) {
        if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
        if (countdownEl) countdownEl.textContent = 'Ready to proceed';
        if (proceedBtn) {
          proceedBtn.disabled = false;
          proceedBtn.removeAttribute('aria-disabled');
          proceedBtn.style.opacity = '';
          proceedBtn.style.cursor = '';
          proceedBtn.textContent = 'Proceed';
          proceedBtn.addEventListener('click', () => finish('proceed'));
          proceedBtn.focus();
        }
        return;
      }

      const sec = Math.ceil(left / 1000);
      if (countdownEl) countdownEl.textContent = `${sec}s remaining`;
    }, 100);

    applyThemeToOverlay(overlay);
    (overlay.querySelector('[data-action="cancel"]') as HTMLButtonElement)?.focus();
  });
}

// ── Overlay: Type-to-Confirm Step ──────────────────────────────────────

const TYPE_TO_CONFIRM_PHRASE = 'I want to buy this';

/**
 * Friction step that requires the user to type a specific phrase before
 * the Confirm button becomes enabled. Cancel/Escape/backdrop all resolve
 * with 'cancel'. Confirm resolves with 'proceed' only when input matches.
 */
async function showTypeToConfirmStep(
  overlay: HTMLElement,
): Promise<'cancel' | 'proceed'> {
  overlay.innerHTML = `
    <div class="hc-modal">
      <div class="hc-header">
        <span class="hc-icon">⌨️</span>
        <h2 class="hc-title" id="hc-overlay-heading">Type to confirm</h2>
      </div>
      <div class="hc-content" id="hc-overlay-desc" style="text-align: center;">
        <p class="hc-message">To proceed, type the following phrase exactly:</p>
        <p class="hc-confirm-phrase">${TYPE_TO_CONFIRM_PHRASE}</p>
        <input
          type="text"
          class="hc-confirm-input"
          id="hc-confirm-input"
          placeholder="Type the phrase above..."
          autocomplete="off"
          spellcheck="false"
        />
      </div>
      <div class="hc-actions">
        <button class="hc-btn hc-btn-cancel" data-action="cancel">Cancel</button>
        <button class="hc-btn hc-btn-proceed" data-action="proceed" disabled aria-disabled="true" style="opacity: 0.4; cursor: not-allowed;">
          Confirm
        </button>
      </div>
    </div>
  `;

  log('Type-to-confirm step shown');

  return new Promise((resolve) => {
    let resolved = false;
    const previousFocus = document.activeElement as HTMLElement | null;
    const inputEl = overlay.querySelector('#hc-confirm-input') as HTMLInputElement | null;
    const proceedBtn = overlay.querySelector('[data-action="proceed"]') as HTMLButtonElement | null;

    const finish = (decision: 'cancel' | 'proceed') => {
      if (resolved) return;
      resolved = true;
      document.removeEventListener('keydown', handleKeydown);
      previousFocus?.focus();
      resolve(decision);
    };

    // Real-time validation: enable Confirm only when input matches phrase (case-insensitive)
    inputEl?.addEventListener('input', () => {
      const matches = (inputEl.value.trim().toLowerCase() === TYPE_TO_CONFIRM_PHRASE.toLowerCase());
      if (proceedBtn) {
        proceedBtn.disabled = !matches;
        proceedBtn.setAttribute('aria-disabled', String(!matches));
        proceedBtn.style.opacity = matches ? '' : '0.4';
        proceedBtn.style.cursor = matches ? '' : 'not-allowed';
      }
    });

    overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => finish('cancel'));
    overlay.querySelector('[data-action="proceed"]')?.addEventListener('click', () => {
      const matches = (inputEl?.value.trim().toLowerCase() === TYPE_TO_CONFIRM_PHRASE.toLowerCase());
      if (matches) finish('proceed');
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish('cancel');
    });

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { finish('cancel'); return; }
      if (e.key === 'Enter') {
        const matches = inputEl?.value.trim().toLowerCase() === TYPE_TO_CONFIRM_PHRASE.toLowerCase();
        if (matches) finish('proceed');
        return;
      }
      if (e.key === 'Tab') {
        const focusable = Array.from(
          overlay.querySelectorAll<HTMLElement>('.hc-btn:not([disabled]), #hc-confirm-input')
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKeydown);

    applyThemeToOverlay(overlay);
    inputEl?.focus();
  });
}

// ── Overlay: Math Challenge Step ────────────────────────────────────────

interface MathProblem {
  question: string;
  answer: number;
}

/**
 * Generates a simple arithmetic problem using two integers in [2, 20].
 * Operations: addition, subtraction (result always positive), multiplication.
 * Uses Unicode × (U+00D7) and − (U+2212) for display.
 */
function generateMathProblem(): MathProblem {
  const ops = ['+', '-', '×'] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a = Math.floor(Math.random() * 19) + 2; // [2, 20]
  let b = Math.floor(Math.random() * 19) + 2;

  if (op === '-' && a < b) {
    // Ensure a >= b so result is positive
    [a, b] = [b, a];
  }

  let answer: number;
  let question: string;

  switch (op) {
    case '+':
      answer = a + b;
      question = `${a} + ${b} = ?`;
      break;
    case '-':
      answer = a - b;
      question = `${a} \u2212 ${b} = ?`;
      break;
    case '×':
    default:
      answer = a * b;
      question = `${a} \u00D7 ${b} = ?`;
      break;
  }

  return { question, answer };
}

/**
 * Friction step that requires the user to solve a math problem before
 * proceeding. On wrong answer: shows an error, generates a new problem,
 * clears the input, and keeps the modal open.
 * Cancel/Escape/backdrop resolve with 'cancel'.
 * Correct answer resolves with 'proceed'.
 */
async function showMathChallengeStep(
  overlay: HTMLElement,
): Promise<'cancel' | 'proceed'> {
  let problem = generateMathProblem();

  const renderContent = () => `
    <div class="hc-modal">
      <div class="hc-header">
        <span class="hc-icon">🧮</span>
        <h2 class="hc-title" id="hc-overlay-heading">Solve to proceed</h2>
      </div>
      <div class="hc-content" id="hc-overlay-desc" style="text-align: center;">
        <p class="hc-math-question" id="hc-math-question">${problem.question}</p>
        <input
          type="number"
          class="hc-math-input"
          id="hc-math-input"
          placeholder="Your answer..."
          autocomplete="off"
          inputmode="numeric"
        />
        <p class="hc-math-error" id="hc-math-error" style="display: none;">Incorrect \u2014 try again</p>
      </div>
      <div class="hc-actions">
        <button class="hc-btn hc-btn-cancel" data-action="cancel">Cancel</button>
        <button class="hc-btn hc-btn-proceed" data-action="proceed" disabled aria-disabled="true" style="opacity: 0.4; cursor: not-allowed;">
          Submit
        </button>
      </div>
    </div>
  `;

  overlay.innerHTML = renderContent();
  log('Math challenge step shown');

  return new Promise((resolve) => {
    let resolved = false;
    const previousFocus = document.activeElement as HTMLElement | null;

    const finish = (decision: 'cancel' | 'proceed') => {
      if (resolved) return;
      resolved = true;
      document.removeEventListener('keydown', handleKeydown);
      previousFocus?.focus();
      resolve(decision);
    };

    const getElements = () => ({
      inputEl: overlay.querySelector('#hc-math-input') as HTMLInputElement | null,
      proceedBtn: overlay.querySelector('[data-action="proceed"]') as HTMLButtonElement | null,
      errorEl: overlay.querySelector('#hc-math-error') as HTMLElement | null,
      questionEl: overlay.querySelector('#hc-math-question') as HTMLElement | null,
    });

    const wireInput = () => {
      const { inputEl, proceedBtn } = getElements();

      inputEl?.addEventListener('input', () => {
        const hasValue = inputEl.value.trim() !== '';
        if (proceedBtn) {
          proceedBtn.disabled = !hasValue;
          proceedBtn.setAttribute('aria-disabled', String(!hasValue));
          proceedBtn.style.opacity = hasValue ? '' : '0.4';
          proceedBtn.style.cursor = hasValue ? '' : 'not-allowed';
        }
      });

      overlay.querySelector('[data-action="proceed"]')?.addEventListener('click', () => {
        const { inputEl: inp, errorEl, questionEl } = getElements();
        const submitted = parseInt(inp?.value ?? '', 10);
        if (submitted === problem.answer) {
          finish('proceed');
        } else {
          // Wrong answer: show error, generate new problem, clear input
          if (errorEl) errorEl.style.display = '';
          problem = generateMathProblem();
          if (questionEl) questionEl.textContent = problem.question;
          if (inp) {
            inp.value = '';
            inp.focus();
          }
          const { proceedBtn: btn } = getElements();
          if (btn) {
            btn.disabled = true;
            btn.setAttribute('aria-disabled', 'true');
            btn.style.opacity = '0.4';
            btn.style.cursor = 'not-allowed';
          }
        }
      });

      inputEl?.focus();
    };

    overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => finish('cancel'));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish('cancel');
    });

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { finish('cancel'); return; }
      if (e.key === 'Enter') {
        const { inputEl: inp } = getElements();
        if (inp && inp.value.trim() !== '') {
          overlay.querySelector<HTMLButtonElement>('[data-action="proceed"]')?.click();
        }
        return;
      }
      if (e.key === 'Tab') {
        const focusable = Array.from(
          overlay.querySelectorAll<HTMLElement>('.hc-btn:not([disabled]), #hc-math-input')
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKeydown);

    applyThemeToOverlay(overlay);
    wireInput();
  });
}

// ── Multi-Step Friction Flow ────────────────────────────────────────────

/**
 * Runs the friction flow:
 *   Step 1: Main overlay (cost breakdown, channel, type)
 *   Step 2+: One modal per comparison item (limited by maxComparisons)
 *
 * @param maxComparisons — max comparison steps to show (undefined = all enabled items)
 *   Soft nudge passes 1, full friction passes undefined.
 *
 * Returns 'proceed' only if user clicks through ALL steps.
 * Returns 'cancel' if they bail at any step.
 */
async function runFrictionFlow(
  attempt: PurchaseAttempt,
  settings: UserSettings,
  tracker: SpendingTracker,
  maxComparisons?: number,
  whitelistNote?: string,
  onWhitelistAdd?: (behavior: WhitelistBehavior) => Promise<void>,
): Promise<FrictionResult> {
  let purchaseReason: string | undefined;

  // Step 1: Main overlay
  const mainDecision = await showMainOverlay(attempt, settings, tracker, whitelistNote, onWhitelistAdd);
  if (mainDecision === 'cancel') {
    log('Friction flow: cancelled at Step 1 (main overlay)');
    return { decision: 'cancel', cancelledAtStep: 1 };
  }

  // Build comparison steps — only when price is detected
  const priceWithTax = (attempt.priceValue && attempt.priceValue > 0)
    ? Math.round(attempt.priceValue * (1 + settings.taxRate / 100) * 100) / 100
    : null;

  if (priceWithTax === null) {
    log('Friction flow: no price detected, skipping comparison steps');
    return { decision: 'proceed', purchaseReason };
  }

  // nudge: enabled items where scope is 'nudge' or 'both', limited to softNudgeSteps
  // full: enabled items where scope is 'full' or 'both' (scope replaces the old "all items" behavior)
  const itemPool = maxComparisons !== undefined
    ? settings.comparisonItems
        .filter(i => i.enabled && (i.frictionScope ?? 'both') !== 'full')
        .slice(0, maxComparisons)
    : settings.comparisonItems
        .filter(i => i.enabled && (i.frictionScope ?? 'both') !== 'nudge');

  const taxPrice = `$${priceWithTax.toFixed(2)}`;
  const comparisonSteps: { item: ComparisonItem; display: ComparisonDisplay }[] = [];

  for (const item of itemPool) {
    const display = formatComparisonDisplay(item, priceWithTax, taxPrice);
    comparisonSteps.push({ item, display });
  }

  // Total steps = 1 (main) + N (comparisons)
  const totalSteps = 1 + comparisonSteps.length;

  log(`Friction flow: ${comparisonSteps.length} comparison step(s) (${maxComparisons !== undefined ? 'nudge/enabled only' : 'full/all items'}), priceWithTax=${taxPrice}`);

  // Steps 2+: Each comparison item
  // We need a reference to the last overlay shown so we can pass it to subsequent steps.
  // Comparison steps each create their own overlay element; after the loop we need
  // the most-recently-created overlay for the intensity steps below.
  // showComparisonStep creates its own overlay internally, so we capture it via a
  // wrapper that returns it. For now, we create a placeholder overlay to reuse for
  // the intensity steps (it will be re-populated by each step function).
  let intensityOverlay: HTMLElement | null = null;

  for (let i = 0; i < comparisonSteps.length; i++) {
    const { item, display } = comparisonSteps[i];
    const stepNumber = i + 2; // Step 1 was the main overlay

    const decision = await showComparisonStep(item, display, stepNumber, totalSteps, attempt);
    if (decision === 'cancel') {
      log(`Friction flow: cancelled at Step ${stepNumber} (${item.name})`, {
        stepsCompleted: stepNumber - 1,
        totalSteps,
      });
      return { decision: 'cancel', cancelledAtStep: stepNumber };
    }
  }

  log('Friction flow: completed all comparison steps', {
    totalSteps,
    channel: attempt.channel,
    rawPrice: attempt.rawPrice,
  });

  // ── Intensity-gated steps ─────────────────────────────────────────────
  // For steps 3+, we reuse a shared overlay element that each step re-populates.
  // Note: showReasonSelectionStep appends and removes the overlay itself.
  // The subsequent steps (cooldown, type-to-confirm, math) expect the overlay to
  // already be in the DOM (they only set innerHTML and apply theme).
  // So after reason selection proceeds we must re-append before the next step.
  const intensity = settings.frictionIntensity ?? 'low';

  if (intensity === 'medium' || intensity === 'high' || intensity === 'extreme') {
    // Create the shared overlay element for intensity steps
    intensityOverlay = document.createElement('div');
    intensityOverlay.id = 'hc-overlay';
    intensityOverlay.className = 'hc-overlay';
    intensityOverlay.setAttribute('role', 'dialog');
    intensityOverlay.setAttribute('aria-modal', 'true');
    intensityOverlay.setAttribute('aria-labelledby', 'hc-overlay-heading');
    intensityOverlay.setAttribute('aria-describedby', 'hc-overlay-desc');

    // Step 3: Reason selection
    // showReasonSelectionStep manages its own append/remove lifecycle.
    log('Friction flow: starting reason selection step (step 3)');
    const reasonResult = await showReasonSelectionStep(intensityOverlay);
    if (reasonResult.decision === 'cancel') {
      // Overlay was already removed by showReasonSelectionStep; nothing to clean up.
      return { decision: 'cancel', cancelledAtStep: 3 };
    }
    purchaseReason = reasonResult.reason;
  }

  if (intensity === 'high' || intensity === 'extreme') {
    // showReasonSelectionStep removed the overlay from DOM after resolving.
    // Re-append so cooldown step can operate on it.
    overlayVisible = true;
    document.body.appendChild(intensityOverlay!);

    const cooldownSecs = intensity === 'extreme' ? 30 : 10;
    log(`Friction flow: starting friction cooldown step (${cooldownSecs}s, step 4)`);
    const cooldownResult = await showFrictionCooldownStep(intensityOverlay!, cooldownSecs);
    if (cooldownResult === 'cancel') {
      removeOverlay(intensityOverlay!);
      return { decision: 'cancel', cancelledAtStep: 4 };
    }
  }

  if (intensity === 'high') {
    // intensityOverlay is still in the DOM (cooldown step didn't remove it).
    log('Friction flow: starting type-to-confirm step (step 5)');
    const typeResult = await showTypeToConfirmStep(intensityOverlay!);
    if (typeResult === 'cancel') {
      removeOverlay(intensityOverlay!);
      return { decision: 'cancel', cancelledAtStep: 5 };
    }
    // All intensity steps done for 'high' — clean up overlay.
    removeOverlay(intensityOverlay!);
  }

  if (intensity === 'extreme') {
    // intensityOverlay is still in the DOM (cooldown step didn't remove it).
    log('Friction flow: starting math challenge step (step 5)');
    const mathResult = await showMathChallengeStep(intensityOverlay!);
    if (mathResult === 'cancel') {
      removeOverlay(intensityOverlay!);
      return { decision: 'cancel', cancelledAtStep: 5 };
    }
    // Math passed — proceed to type-to-confirm (step 6). Overlay stays in DOM.
    log('Friction flow: starting type-to-confirm step (step 6)');
    const typeResult = await showTypeToConfirmStep(intensityOverlay!);
    if (typeResult === 'cancel') {
      removeOverlay(intensityOverlay!);
      return { decision: 'cancel', cancelledAtStep: 6 };
    }
    // All intensity steps done for 'extreme' — clean up overlay.
    removeOverlay(intensityOverlay!);
  }

  // For 'medium' intensity: reason step removed overlay itself; no extra cleanup needed.

  // ── Standalone Delay Timer (final step) ──────────────────────────────
  if (settings.delayTimer?.enabled) {
    log(`Delay timer step starting (${settings.delayTimer.seconds}s)`);
    const delayDecision = await showDelayTimerStep(
      settings.delayTimer.seconds,
      attempt,
    );
    if (delayDecision === 'cancel') {
      log('Friction flow: cancelled at delay timer step');
      return { decision: 'cancel' };
    }
  }

  return { decision: 'proceed', purchaseReason };
}

// ── Streaming Mode Toast ────────────────────────────────────────────────

function showStreamingModeToast(channel: string, durationMs: number): void {
  document.getElementById('hc-streaming-toast')?.remove();

  const toast = document.createElement('div');
  toast.id = 'hc-streaming-toast';
  toast.className = 'hc-streaming-toast';
  toast.textContent = `🔴 LIVE — Streaming mode active on ${channel}`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hc-streaming-toast--fade');
    setTimeout(() => toast.remove(), 300);
  }, durationMs);
}

function showDailyBudgetToast(remaining: number, capAmount: number, durationMs: number): void {
  document.getElementById('hc-budget-toast')?.remove();

  const toast = document.createElement('div');
  toast.id = 'hc-budget-toast';
  toast.className = 'hc-budget-toast';
  toast.textContent = `✅ $${remaining.toFixed(2)} remaining of $${capAmount.toFixed(2)} daily budget`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hc-budget-toast--fade');
    setTimeout(() => toast.remove(), 300);
  }, durationMs);
}

// ── Click Handling ──────────────────────────────────────────────────────

async function handleClick(event: MouseEvent): Promise<void> {
  const target = event.target as HTMLElement;
  const button = target.closest('button') || target;

  if (button.tagName === 'BUTTON' || target.tagName === 'BUTTON') {
    debug('Button clicked:', {
      tagName: button.tagName,
      text: button.textContent?.trim().substring(0, 50),
      ariaLabel: button.getAttribute('aria-label'),
      dataTarget: button.getAttribute('data-a-target'),
      className: button.className,
    });
  }

  if (!isPurchaseButton(button as HTMLElement)) {
    return;
  }

  // Always block synchronously — we'll replay if friction is 'none'
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const actualButton = (button.closest('button') || button) as HTMLElement;

  log('Purchase attempt intercepted:', {
    clickedElement: target.tagName,
    actualButton: actualButton.tagName,
    buttonText: actualButton.textContent?.trim().substring(0, 50),
  });

  const attempt = createPurchaseAttempt(actualButton);
  attempt.element = actualButton;

  const settings = await loadSettings();

  // Streaming mode bypass check
  const streamingBypass = await shouldBypassFriction(settings);
  if (streamingBypass) {
    const whitelistOverridden = checkWhitelist(attempt.channel, settings);
    if (whitelistOverridden) {
      log(`Streaming mode active \u2014 whitelist setting for ${attempt.channel} ignored`);
    }
    if (settings.streamingMode.logBypassed) {
      log('Streaming mode bypass:', { type: attempt.type, rawPrice: attempt.rawPrice, wasStreamingMode: true });
    }
    showStreamingModeToast(attempt.channel, settings.toastDurationSeconds * 1000);
    allowNextClick(actualButton);
    return;
  }

  const tracker = await loadSpendingTracker();

  // Update session channel
  if (tracker.sessionChannel !== attempt.channel) {
    tracker.sessionTotal = 0;
    tracker.sessionChannel = attempt.channel;
  }

  // Whitelist check
  const whitelistEntry = checkWhitelist(attempt.channel, settings);
  if (whitelistEntry) {
    log(`Whitelisted channel detected: ${attempt.channel} (behavior: ${whitelistEntry.behavior})`);

    if (whitelistEntry.behavior === 'skip') {
      log(`Purchase on whitelisted channel — silently logged (${attempt.rawPrice ?? 'price unknown'})`);
      await recordPurchase(attempt.priceValue, settings, tracker);
      allowNextClick(actualButton);
      return;
    }

    if (whitelistEntry.behavior === 'reduced') {
      const priceDisplay = attempt.rawPrice || 'purchase';
      log(`Purchase on whitelisted channel — toast displayed (${priceDisplay})`);
      await recordPurchase(attempt.priceValue, settings, tracker);
      showWhitelistReducedToast(attempt.channel, priceDisplay, settings.toastDurationSeconds * 1000);
      allowNextClick(actualButton);
      return;
    }

    // full falls through to normal friction with a note in the overlay
    log(`Whitelist check — full on ${attempt.channel}, applying full friction with whitelist note`);
  } else {
    log(`Whitelist check — channel not whitelisted, applying normal friction`);
  }

  // Cooldown check
  const cooldownStatus = checkCooldown(settings, tracker);
  if (cooldownStatus.active) {
    showCooldownBlock(cooldownStatus.remainingMs);
    return;
  }

  // Friction level
  const frictionLevel = determineFrictionLevel(attempt.priceValue, settings, tracker);

  // Daily cap bypass: under the pre-approved budget — record silently and show remaining toast
  if (frictionLevel === 'cap-bypass') {
    const priceWithTax = Math.round((attempt.priceValue ?? 0) * (1 + settings.taxRate / 100) * 100) / 100;
    const remaining = Math.round((settings.dailyCap.amount - (tracker.dailyTotal + priceWithTax)) * 100) / 100;
    log(`Daily cap bypass — proceeding silently, $${remaining.toFixed(2)} remaining of $${settings.dailyCap.amount.toFixed(2)} budget`);
    await recordPurchase(attempt.priceValue, settings, tracker);
    showDailyBudgetToast(remaining, settings.dailyCap.amount, settings.toastDurationSeconds * 1000);
    allowNextClick(actualButton);
    return;
  }

  // No friction: track silently and let through
  if (frictionLevel === 'none') {
    await recordPurchase(attempt.priceValue, settings, tracker);
    allowNextClick(actualButton);
    return;
  }

  // Store for proceeding
  pendingPurchase = { attempt, originalEvent: event };

  // Soft nudge: main overlay + 1 comparison item
  // Full friction: main overlay + ALL comparison items
  const maxComparisons = frictionLevel === 'nudge' ? settings.frictionThresholds.softNudgeSteps : undefined;
  const whitelistNote = whitelistEntry?.behavior === 'full'
    ? '\u2B50 Whitelisted Channel \u2014 This is a planned support channel'
    : undefined;
  const onWhitelistAdd = async (behavior: WhitelistBehavior): Promise<void> => {
    const normalized = attempt.channel.trim().toLowerCase();
    const existing = settings.whitelistedChannels.findIndex(e => e.username === normalized);
    const newEntry: WhitelistEntry = { username: normalized, behavior };
    if (existing >= 0) {
      settings.whitelistedChannels[existing] = newEntry;
    } else {
      settings.whitelistedChannels.push(newEntry);
    }
    await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
    log(`Whitelist quick-add saved: ${normalized} → ${behavior}`);
  };

  log(`Friction flow starting: level=${frictionLevel}, maxComparisons=${maxComparisons ?? 'all'}${whitelistNote ? ', full whitelist' : ''}`);
  const frictionResult = await runFrictionFlow(attempt, settings, tracker, maxComparisons, whitelistNote, onWhitelistAdd);
  const priceWithTax = (attempt.priceValue && attempt.priceValue > 0)
    ? Math.round(attempt.priceValue * (1 + settings.taxRate / 100) * 100) / 100
    : null;

  if (frictionResult.decision === 'proceed' && pendingPurchase) {
    log('User completed all friction steps — proceeding with purchase');
    await recordPurchase(attempt.priceValue, settings, tracker);
    allowNextClick(pendingPurchase.attempt.element);
    await writeInterceptEvent({
      channel: attempt.channel,
      purchaseType: attempt.type,
      rawPrice: attempt.rawPrice,
      priceWithTax,
      outcome: 'proceeded',
      purchaseReason: frictionResult.purchaseReason,
    });
  } else {
    log('User cancelled the purchase');
    await writeInterceptEvent({
      channel: attempt.channel,
      purchaseType: attempt.type,
      rawPrice: attempt.rawPrice,
      priceWithTax,
      outcome: 'cancelled',
      cancelledAtStep: frictionResult.cancelledAtStep,
      savedAmount: priceWithTax ?? 0,
      purchaseReason: frictionResult.purchaseReason,
    });
  }
  pendingPurchase = null;
}

// ── Click Allow-Through ─────────────────────────────────────────────────

let allowClick = false;

function allowNextClick(element: HTMLElement): void {
  const button = element.closest('button') || element;

  log('Attempting to proceed with click on:', {
    originalElement: element.tagName,
    buttonFound: button.tagName,
    buttonText: button.textContent?.trim().substring(0, 50),
  });

  allowClick = true;

  if (button instanceof HTMLButtonElement) {
    debug('Using native .click() on button');
    button.click();
  } else {
    debug('Dispatching MouseEvent');
    const rect = button.getBoundingClientRect();
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      button: 0,
      buttons: 1,
    });
    button.dispatchEvent(clickEvent);
  }

  setTimeout(() => { allowClick = false; }, 200);
}

function clickHandler(event: MouseEvent): void {
  if (allowClick) return;
  handleClick(event);
}

// ── Setup / Teardown ────────────────────────────────────────────────────

export function setupInterceptor(): void {
  document.addEventListener('click', clickHandler, { capture: true });
  log('Interceptor set up - watching for purchase clicks');
}

export function teardownInterceptor(): void {
  document.removeEventListener('click', clickHandler, { capture: true });
  log('Interceptor removed');
}
