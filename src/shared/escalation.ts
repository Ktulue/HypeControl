import { FrictionIntensity, UserSettings, SpendingTracker } from './types';

/** Ordered intensity levels from lowest to highest */
const INTENSITY_ORDER: FrictionIntensity[] = ['low', 'medium', 'high', 'extreme'];

/**
 * Compute the highest spending percentage across all active caps.
 * Returns 0 when no caps are enabled.
 */
export function computeMaxCapPercent(settings: UserSettings, tracker: SpendingTracker): number {
  const percentages: number[] = [];

  if (settings.dailyCap.enabled && settings.dailyCap.amount > 0) {
    percentages.push(Math.round(tracker.dailyTotal / settings.dailyCap.amount * 10000) / 100);
  }
  if (settings.weeklyCap.enabled && settings.weeklyCap.amount > 0) {
    percentages.push(Math.round(tracker.weeklyTotal / settings.weeklyCap.amount * 10000) / 100);
  }
  if (settings.monthlyCap.enabled && settings.monthlyCap.amount > 0) {
    percentages.push(Math.round(tracker.monthlyTotal / settings.monthlyCap.amount * 10000) / 100);
  }

  return percentages.length === 0 ? 0 : Math.max(...percentages);
}

/**
 * Compute the effective friction intensity based on spending threshold escalation.
 *
 * Escalation tiers:
 * - Under 60%: no change (base)
 * - 60-79%: Medium
 * - 80-99%: High
 * - 100%+: Extreme
 *
 * Rules:
 * - Only escalates UP from base, never down
 * - Returns base immediately if locked
 * - Returns base if maxPercent is 0 (no caps enabled)
 */
export function computeEscalatedIntensity(
  base: FrictionIntensity,
  maxPercent: number,
  locked: boolean,
): FrictionIntensity {
  if (locked || maxPercent === 0) return base;

  let tier: FrictionIntensity;
  if (maxPercent >= 100) {
    tier = 'extreme';
  } else if (maxPercent >= 80) {
    tier = 'high';
  } else if (maxPercent >= 60) {
    tier = 'medium';
  } else {
    return base; // Under 60% — no escalation
  }

  // Only escalate up: if base is already higher than tier, keep base
  const baseIndex = INTENSITY_ORDER.indexOf(base);
  const tierIndex = INTENSITY_ORDER.indexOf(tier);
  return tierIndex > baseIndex ? tier : base;
}
