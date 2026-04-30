/**
 * Determine the color tier for a cap progress bar.
 * Green < 60%, Yellow 60–79%, Orange 80–99%, Red 100%+
 */
export function getCapColorClass(percentage: number): string {
  if (percentage >= 100) return 'hc-cap-red';
  if (percentage >= 80) return 'hc-cap-orange';
  if (percentage >= 60) return 'hc-cap-yellow';
  return 'hc-cap-green';
}

/**
 * Build a single cap progress bar HTML string.
 *
 * Label is constrained to known static values — never user-controlled.
 * Numeric values are computed internally. innerHTML of this string is safe.
 *
 * Returns '' (empty string) when `capAmount <= 0`. Callers must treat empty
 * output as "no bar to render" and skip emitting it. This guards against
 * divide-by-zero displays when a cap is enabled but its amount has not been
 * set, and is used by both the friction overlay and the popup Limits section.
 *
 * @param label Hardcoded period label: 'Daily' | 'Weekly' | 'Monthly'.
 * @param currentTotal Already-spent amount for the period.
 * @param purchaseAmount Additional amount being attempted (overlay) or 0 (popup).
 * @param capAmount Configured cap for the period.
 */
export function buildCapProgressBar(
  label: 'Daily' | 'Weekly' | 'Monthly',
  currentTotal: number,
  purchaseAmount: number,
  capAmount: number,
): string {
  if (capAmount <= 0) return '';

  const newTotal = Math.round((currentTotal + purchaseAmount) * 100) / 100;
  const percentage = Math.round((newTotal / capAmount) * 100);
  const barWidth = Math.min(percentage, 100);
  const colorClass = getCapColorClass(percentage);
  const overBudget = newTotal > capAmount;

  return `
    <div class="hc-cap-bar ${colorClass}">
      <div class="hc-cap-bar__header">
        <span class="hc-cap-bar__label">${label}</span>
        <span class="hc-cap-bar__value">$${newTotal.toFixed(2)} / $${capAmount.toFixed(2)}${overBudget ? ' — OVER BUDGET' : ` (${percentage}%)`}</span>
      </div>
      <div class="hc-cap-bar__track">
        <div class="hc-cap-bar__fill" style="width: ${barWidth}%"></div>
      </div>
    </div>
  `;
}
