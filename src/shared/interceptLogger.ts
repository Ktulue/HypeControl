/**
 * Structured intercept event logger for Hype Control.
 *
 * Stores purchase intercept outcomes as structured events in chrome.storage.local.
 * Applies 90-day rolling window on every write (replaces old 200-entry cap).
 *
 * Storage key: hcInterceptEvents
 * Storage location: chrome.storage.local (transient, not synced)
 */

import { InterceptEvent } from './types';

const INTERCEPT_EVENTS_KEY = 'hcInterceptEvents';
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/** Generate a unique ID for an intercept event */
function makeId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 7);
}

/** Prune entries older than 90 days */
function pruneOld(events: InterceptEvent[]): InterceptEvent[] {
  const cutoff = Date.now() - NINETY_DAYS_MS;
  return events.filter(e => e.timestamp >= cutoff);
}

/**
 * Write a new intercept event to storage.
 * Automatically prunes entries older than 90 days.
 */
export async function writeInterceptEvent(
  partial: Omit<InterceptEvent, 'id' | 'timestamp'>
): Promise<void> {
  const event: InterceptEvent = {
    ...partial,
    id: makeId(),
    timestamp: Date.now(),
  };

  try {
    const result = await chrome.storage.local.get(INTERCEPT_EVENTS_KEY);
    let events: InterceptEvent[] = result[INTERCEPT_EVENTS_KEY] ?? [];
    events = pruneOld(events);
    events.push(event);
    await chrome.storage.local.set({ [INTERCEPT_EVENTS_KEY]: events });
  } catch (e) {
    console.error('[HC] Failed to write intercept event:', e);
  }
}

/**
 * Read all intercept events (already pruned on write, but prune again on read for safety).
 */
export async function readInterceptEvents(): Promise<InterceptEvent[]> {
  try {
    const result = await chrome.storage.local.get(INTERCEPT_EVENTS_KEY);
    const events: InterceptEvent[] = result[INTERCEPT_EVENTS_KEY] ?? [];
    return pruneOld(events);
  } catch (e) {
    console.error('[HC] Failed to read intercept events:', e);
    return [];
  }
}

/** Stats computed from intercept events for the popup */
export interface PopupStats {
  savedTotal: number;       // sum of savedAmount from cancelled entries
  blockedCount: number;     // count of cancelled entries
  totalCount: number;       // total intercept events
  cancelRate: number;       // 0–100 (percentage, rounded to 1 decimal)
  mostEffectiveStep: number | null; // step number with highest cancel count, or null if no data
}

/**
 * Compute popup stats from all stored intercept events.
 */
export async function computePopupStats(): Promise<PopupStats> {
  const events = await readInterceptEvents();

  const cancelled = events.filter(e => e.outcome === 'cancelled');
  const blockedCount = cancelled.length;
  const totalCount = events.length;
  const savedTotal = Math.round(
    cancelled.reduce((sum, e) => sum + (e.savedAmount ?? 0), 0) * 100
  ) / 100;
  const cancelRate = totalCount === 0
    ? 0
    : Math.round((blockedCount / totalCount) * 1000) / 10; // 1 decimal

  // Find most effective step
  const stepCounts: Record<number, number> = {};
  for (const e of cancelled) {
    if (e.cancelledAtStep !== undefined) {
      stepCounts[e.cancelledAtStep] = (stepCounts[e.cancelledAtStep] ?? 0) + 1;
    }
  }
  let mostEffectiveStep: number | null = null;
  let maxCount = 0;
  for (const [step, count] of Object.entries(stepCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostEffectiveStep = Number(step);
    }
  }

  return { savedTotal, blockedCount, totalCount, cancelRate, mostEffectiveStep };
}
