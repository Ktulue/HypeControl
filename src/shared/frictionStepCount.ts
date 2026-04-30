import { FrictionIntensity } from './types';

/**
 * Total number of friction windows the user will see for a given configuration.
 *
 * The friction flow consists of:
 * - 1 main overlay (always)
 * - N comparison-item overlays (only when a price was detected)
 * - intensity-gated overlays:
 *     - medium: reason selection (1 step)
 *     - high: reason + cooldown + type-to-confirm (3 steps)
 *     - extreme: reason + cooldown + math + type-to-confirm (4 steps)
 * - 1 delay-timer overlay (only when delayTimer.enabled)
 */
export function computeTotalSteps(
  priceWithTax: number | null,
  comparisonItemCount: number,
  intensity: FrictionIntensity,
  delayTimerEnabled: boolean,
): number {
  let total = 1; // main overlay
  if (priceWithTax !== null) total += comparisonItemCount;
  if (intensity !== 'low')     total += 1; // reason
  if (intensity === 'high')    total += 2; // cooldown + type-to-confirm
  if (intensity === 'extreme') total += 3; // cooldown + math + type-to-confirm
  if (delayTimerEnabled)       total += 1; // delay timer
  return total;
}
