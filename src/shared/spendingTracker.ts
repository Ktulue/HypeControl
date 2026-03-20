import { UserSettings, SpendingTracker, DEFAULT_SPENDING_TRACKER, sanitizeTracker } from './types';
import { log, debug } from './logger';

export const SPENDING_KEY = 'hcSpending';

export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getCurrentWeekStart(date: Date = new Date(), resetDay: 'monday' | 'sunday' = 'monday'): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  if (resetDay === 'sunday') {
    // Sunday = 0, so offset is just -dayOfWeek
    d.setDate(d.getDate() - dayOfWeek);
  } else {
    // Monday start (ISO): Sunday needs -6, others need 1-dayOfWeek
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    d.setDate(d.getDate() + mondayOffset);
  }
  return formatLocalDate(d);
}

export function getCurrentMonth(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export async function loadSpendingTracker(settings: UserSettings): Promise<SpendingTracker> {
  try {
    const result = await chrome.storage.local.get(SPENDING_KEY);
    const tracker: SpendingTracker = sanitizeTracker(result[SPENDING_KEY] || { ...DEFAULT_SPENDING_TRACKER });

    // Backfill new fields for existing installs
    if (tracker.weeklyTotal === undefined) tracker.weeklyTotal = 0;
    if (!tracker.weeklyStartDate) tracker.weeklyStartDate = '';
    if (tracker.monthlyTotal === undefined) tracker.monthlyTotal = 0;
    if (!tracker.monthlyMonth) tracker.monthlyMonth = '';

    let dirty = false;

    const today = formatLocalDate(new Date());
    if (tracker.dailyDate !== today) {
      tracker.dailyTotal = 0;
      tracker.dailyDate = today;
      dirty = true;
    }

    const currentWeekStart = getCurrentWeekStart(new Date(), settings.weeklyResetDay ?? 'monday');
    if (tracker.weeklyStartDate !== currentWeekStart) {
      tracker.weeklyTotal = 0;
      tracker.weeklyStartDate = currentWeekStart;
      dirty = true;
    }

    const currentMonth = getCurrentMonth();
    if (tracker.monthlyMonth !== currentMonth) {
      tracker.monthlyTotal = 0;
      tracker.monthlyMonth = currentMonth;
      dirty = true;
    }

    if (dirty) {
      await saveSpendingTracker(tracker);
    }

    return tracker;
  } catch (e) {
    debug('Failed to load spending tracker:', e);
    return { ...DEFAULT_SPENDING_TRACKER };
  }
}

export async function saveSpendingTracker(tracker: SpendingTracker): Promise<void> {
  try {
    await chrome.storage.local.set({ [SPENDING_KEY]: sanitizeTracker(tracker) });
  } catch (e) {
    debug('Failed to save spending tracker:', e);
  }
}

export async function recordPurchase(
  priceValue: number | null,
  settings: UserSettings,
  tracker: SpendingTracker,
): Promise<void> {
  if (priceValue && priceValue > 0) {
    const priceWithTax = Math.round(priceValue * (1 + settings.taxRate / 100) * 100) / 100;
    const before = tracker.dailyTotal;
    tracker.dailyTotal = Math.round((tracker.dailyTotal + priceWithTax) * 100) / 100;
    tracker.weeklyTotal = Math.round((tracker.weeklyTotal + priceWithTax) * 100) / 100;
    tracker.monthlyTotal = Math.round((tracker.monthlyTotal + priceWithTax) * 100) / 100;
    tracker.dailyDate = formatLocalDate(new Date());
    log(`recordPurchase: +$${priceWithTax.toFixed(2)} (raw=$${priceValue.toFixed(2)}, tax=${settings.taxRate}%) — daily $${before.toFixed(2)} → $${tracker.dailyTotal.toFixed(2)}, weekly $${tracker.weeklyTotal.toFixed(2)}, monthly $${tracker.monthlyTotal.toFixed(2)}`);
  }
  tracker.lastProceedTimestamp = Date.now();
  await saveSpendingTracker(tracker);
}
