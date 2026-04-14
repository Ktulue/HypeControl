/**
 * Streaming Mode — bypass friction when the user is live on their own channel.
 * Handles live detection, grace period, state persistence, and badge display.
 */

import { UserSettings } from '../shared/types';
import { getCurrentChannel } from './detector';
import { log } from '../shared/logger';

const STREAMING_STATE_KEY = 'hcStreamingState';

interface StreamingState {
  streamEndedAt: number | null;
}

async function loadStreamingState(): Promise<StreamingState> {
  try {
    const result = await chrome.storage.local.get(STREAMING_STATE_KEY);
    return result[STREAMING_STATE_KEY] || { streamEndedAt: null };
  } catch {
    return { streamEndedAt: null };
  }
}

async function saveStreamingState(state: StreamingState): Promise<void> {
  try {
    await chrome.storage.local.set({ [STREAMING_STATE_KEY]: state });
  } catch { /* ignore */ }
}

/**
 * Detect if the current page shows a live stream.
 * Checks the Twitch live status text indicator first, then falls back to
 * legacy data-a-target attributes and JSON-LD schema metadata.
 */
export function detectIfLive(): boolean {
  // Primary: Twitch channel status text — look for a <span> containing "LIVE"
  // inside p.tw-channel-status-text-indicator (inside the Stream Information section).
  // Use innerText to match only visible text, avoiding hidden/aria text.
  const statusEl = document.querySelector('p.tw-channel-status-text-indicator');
  if (statusEl) {
    const span = statusEl.querySelector('span');
    if (span && (span as HTMLElement).innerText?.includes('LIVE')) return true;
    // Fallback: check the p element itself in case the span layer is absent
    if ((statusEl as HTMLElement).innerText?.includes('LIVE')) return true;
  }

  // Secondary: stream information section aria-label (present while live)
  const streamInfo = document.querySelector('#live-channel-stream-information[aria-label="Stream Information"]');
  if (streamInfo) {
    // Confirm "LIVE" text is visible inside the section to avoid VOD false positives
    if ((streamInfo as HTMLElement).innerText?.includes('LIVE')) return true;
  }

  // Legacy fallbacks (may appear in embedded or older page layouts)
  if (document.querySelector('[data-a-target="live-indicator"]')) return true;
  if (document.querySelector('[data-a-target="player-state-live"]')) return true;

  // JSON-LD schema.org fallback
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const s of scripts) {
    try {
      const data = JSON.parse(s.textContent || '');
      if (data.isLiveBroadcast === true) return true;
    } catch { /* ignore */ }
  }
  return false;
}

/**
 * Returns true if the current purchase attempt should skip the friction overlay.
 * Requires: streaming mode enabled, username configured, on that channel's page,
 * and either currently live or within the grace period.
 */
export async function shouldBypassFriction(settings: UserSettings): Promise<boolean> {
  const enabled = settings.streamingMode.enabled;
  const username = settings.streamingMode.twitchUsername.trim().toLowerCase();
  const currentChannel = getCurrentChannel()?.toLowerCase() || '';
  const onOwnChannel = !!username && currentChannel === username;
  const channelIsLive = onOwnChannel ? detectIfLive() : false;

  const logResult = (result: boolean | string) =>
    log(`Streaming mode check: enabled=${enabled}, onOwnChannel=${onOwnChannel}, channelIsLive=${channelIsLive}, result=${result}`);

  // Manual override from popup — global, no channel or streaming-mode-enabled gate
  const override = settings.streamingOverride;
  if (override && typeof override.expiresAt === 'number' && Date.now() < override.expiresAt) {
    logResult('true (manual override)');
    return true;
  }

  if (!enabled || !username || !onOwnChannel) {
    logResult(false);
    return false;
  }

  const state = await loadStreamingState();

  if (channelIsLive) {
    logResult('true (live)');
    return true;
  }

  // Grace period after stream ended
  if (state.streamEndedAt) {
    const elapsed = Date.now() - state.streamEndedAt;
    const inGrace = elapsed < settings.streamingMode.gracePeriodMinutes * 60000;
    logResult(`${inGrace} (grace period, elapsed=${Math.round(elapsed / 1000)}s)`);
    return inGrace;
  }

  logResult(false);
  return false;
}

// Track the previous live state to detect transitions
let _wasLive = false;

/**
 * Called on a 30s polling interval.
 * Detects live→offline transitions and saves state accordingly.
 */
export async function checkAndUpdateLiveStatus(settings: UserSettings): Promise<void> {
  if (!settings.streamingMode.enabled) return;
  const username = settings.streamingMode.twitchUsername.trim().toLowerCase();
  if (!username) return;
  const currentChannel = getCurrentChannel()?.toLowerCase();
  if (!currentChannel || currentChannel !== username) return;

  const isLive = detectIfLive();

  if (_wasLive && !isLive) {
    // Stream just ended — start grace period
    const state = await loadStreamingState();
    await saveStreamingState({ ...state, streamEndedAt: Date.now() });
    log('Stream ended — grace period started');
    _wasLive = false;
  } else if (isLive && !_wasLive) {
    // Stream started / resumed — clear any previous end timestamp
    const state = await loadStreamingState();
    await saveStreamingState({ ...state, streamEndedAt: null });
    log('Stream detected live');
    _wasLive = true;
  }

  await updateStreamingBadge(settings);
}

/**
 * Show or update the unified streaming-mode status badge in the page corner.
 * Covers manual override, live-on-own-channel, and grace-period states.
 * Badge is removed when no bypass reason is active.
 */
export async function updateStreamingBadge(settings: UserSettings): Promise<void> {
  const BADGE_ID = 'hc-streaming-badge';
  const existing = document.getElementById(BADGE_ID);

  const reason = await computeBadgeReason(settings);
  if (!reason) {
    existing?.remove();
    return;
  }

  const badge = existing || document.createElement('div');
  badge.id = BADGE_ID;
  badge.className = 'hc-streaming-badge';
  badge.textContent = reason;
  if (!existing) {
    document.body.appendChild(badge);
  }
}

/**
 * Return the human-readable badge text for the current bypass state,
 * or null if no bypass reason is active.
 * Priority: manual override > live on own channel > grace period.
 */
async function computeBadgeReason(settings: UserSettings): Promise<string | null> {
  // Manual override
  const override = settings.streamingOverride;
  if (override && typeof override.expiresAt === 'number' && override.expiresAt > Date.now()) {
    const remainingMs = override.expiresAt - Date.now();
    const totalMin = Math.floor(remainingMs / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
    return `⏸ HC paused — override (${timeStr})`;
  }

  // Auto-detect (gated on own channel)
  const enabled = settings.streamingMode.enabled;
  const username = settings.streamingMode.twitchUsername.trim().toLowerCase();
  const currentChannel = getCurrentChannel()?.toLowerCase() || '';
  const onOwnChannel = !!username && currentChannel === username;
  if (!enabled || !onOwnChannel) return null;

  if (detectIfLive()) {
    return `🔴 HC paused — live on ${currentChannel}`;
  }

  const state = await loadStreamingState();
  if (state.streamEndedAt) {
    const elapsed = Date.now() - state.streamEndedAt;
    const gracePeriodMs = settings.streamingMode.gracePeriodMinutes * 60000;
    const remaining = gracePeriodMs - elapsed;
    if (remaining > 0) {
      const minutesLeft = Math.ceil(remaining / 60000);
      return `⏳ HC paused — grace period (${minutesLeft}m)`;
    }
  }

  return null;
}
