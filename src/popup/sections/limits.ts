import { UserSettings, DEFAULT_SPENDING_TRACKER } from '../../shared/types';
import { getPending, setPendingField } from '../pendingState';

const TRACKER_KEY = 'hcSpending'; // Matches interceptor.ts SPENDING_KEY

export interface LimitsController {
  render(settings: UserSettings): void;
  refreshTracker(): Promise<void>;
}

export function initLimits(el: HTMLElement): LimitsController {
  const dailyCapEnabledEl = el.querySelector<HTMLInputElement>('#daily-cap-enabled')!;
  const dailyCapAmountEl = el.querySelector<HTMLInputElement>('#daily-cap-amount')!;
  const cooldownEnabledEl = el.querySelector<HTMLInputElement>('#cooldown-enabled')!;
  const cooldownDurationEl = el.querySelector<HTMLSelectElement>('#cooldown-duration')!;
  const trackerDailyEl = el.querySelector<HTMLElement>('#tracker-daily')!;
  const trackerSessionEl = el.querySelector<HTMLElement>('#tracker-session')!;
  const resetBtnEl = el.querySelector<HTMLButtonElement>('#btn-reset-tracker')!;
  const confirmResetEl = el.querySelector<HTMLElement>('#confirm-reset')!;
  const resetConfirmBtnEl = el.querySelector<HTMLButtonElement>('#btn-reset-confirm')!;
  const resetCancelBtnEl = el.querySelector<HTMLButtonElement>('#btn-reset-cancel')!;
  const weeklyCapEnabledEl = el.querySelector<HTMLInputElement>('#weekly-cap-enabled')!;
  const weeklyCapAmountEl = el.querySelector<HTMLInputElement>('#weekly-cap-amount')!;
  const monthlyCapEnabledEl = el.querySelector<HTMLInputElement>('#monthly-cap-enabled')!;
  const monthlyCapAmountEl = el.querySelector<HTMLInputElement>('#monthly-cap-amount')!;
  const trackerWeeklyEl = el.querySelector<HTMLElement>('#tracker-weekly')!;
  const trackerWeeklyRowEl = el.querySelector<HTMLElement>('#tracker-weekly-row')!;
  const trackerMonthlyEl = el.querySelector<HTMLElement>('#tracker-monthly')!;
  const trackerMonthlyRowEl = el.querySelector<HTMLElement>('#tracker-monthly-row')!;

  // Daily cap
  dailyCapEnabledEl.addEventListener('change', () => {
    const enabled = dailyCapEnabledEl.checked;
    dailyCapAmountEl.hidden = !enabled;
    setPendingField('dailyCap', { ...getPending().dailyCap, enabled });
  });
  dailyCapAmountEl.addEventListener('input', () => {
    setPendingField('dailyCap', {
      ...getPending().dailyCap,
      amount: parseFloat(dailyCapAmountEl.value) || 0,
    });
  });

  // Weekly cap
  weeklyCapEnabledEl.addEventListener('change', () => {
    const enabled = weeklyCapEnabledEl.checked;
    weeklyCapAmountEl.hidden = !enabled;
    setPendingField('weeklyCap', { ...getPending().weeklyCap, enabled });
  });
  weeklyCapAmountEl.addEventListener('input', () => {
    setPendingField('weeklyCap', {
      ...getPending().weeklyCap,
      amount: parseFloat(weeklyCapAmountEl.value) || 0,
    });
  });

  // Monthly cap
  monthlyCapEnabledEl.addEventListener('change', () => {
    const enabled = monthlyCapEnabledEl.checked;
    monthlyCapAmountEl.hidden = !enabled;
    setPendingField('monthlyCap', { ...getPending().monthlyCap, enabled });
  });
  monthlyCapAmountEl.addEventListener('input', () => {
    setPendingField('monthlyCap', {
      ...getPending().monthlyCap,
      amount: parseFloat(monthlyCapAmountEl.value) || 0,
    });
  });

  // Cooldown
  cooldownEnabledEl.addEventListener('change', () => {
    const enabled = cooldownEnabledEl.checked;
    cooldownDurationEl.hidden = !enabled;
    setPendingField('cooldown', { ...getPending().cooldown, enabled });
  });
  cooldownDurationEl.addEventListener('change', () => {
    setPendingField('cooldown', {
      ...getPending().cooldown,
      minutes: parseInt(cooldownDurationEl.value, 10),
    });
  });

  // Reset tracker (inline confirmation)
  resetBtnEl.addEventListener('click', () => {
    resetBtnEl.hidden = true;
    confirmResetEl.hidden = false;
  });
  resetCancelBtnEl.addEventListener('click', () => {
    confirmResetEl.hidden = true;
    resetBtnEl.hidden = false;
  });
  resetConfirmBtnEl.addEventListener('click', async () => {
    await chrome.storage.local.set({ [TRACKER_KEY]: DEFAULT_SPENDING_TRACKER });
    confirmResetEl.hidden = true;
    resetBtnEl.hidden = false;
    await refreshTracker();
  });

  async function refreshTracker(): Promise<void> {
    const result = await chrome.storage.local.get(TRACKER_KEY);
    const tracker = result[TRACKER_KEY];
    if (tracker) {
      trackerDailyEl.textContent = `$${(tracker.dailyTotal ?? 0).toFixed(2)}`;
      trackerSessionEl.textContent = `$${(tracker.sessionTotal ?? 0).toFixed(2)}`;

      // Show weekly/monthly tracker rows only when their cap is enabled
      const settings = await chrome.storage.sync.get('hcSettings');
      const userSettings = settings['hcSettings'];

      if (tracker.weeklyTotal !== undefined) {
        trackerWeeklyEl.textContent = `$${(tracker.weeklyTotal ?? 0).toFixed(2)}`;
      }
      if (tracker.monthlyTotal !== undefined) {
        trackerMonthlyEl.textContent = `$${(tracker.monthlyTotal ?? 0).toFixed(2)}`;
      }

      // Show/hide rows based on whether caps are enabled
      const weeklyEnabled = userSettings?.weeklyCap?.enabled ?? false;
      const monthlyEnabled = userSettings?.monthlyCap?.enabled ?? false;
      trackerWeeklyRowEl.hidden = !weeklyEnabled;
      trackerMonthlyRowEl.hidden = !monthlyEnabled;
    }
  }

  function render(settings: UserSettings): void {
    dailyCapEnabledEl.checked = settings.dailyCap.enabled;
    dailyCapAmountEl.hidden = !settings.dailyCap.enabled;
    dailyCapAmountEl.value = String(settings.dailyCap.amount);
    cooldownEnabledEl.checked = settings.cooldown.enabled;
    cooldownDurationEl.hidden = !settings.cooldown.enabled;
    cooldownDurationEl.value = String(settings.cooldown.minutes);
    weeklyCapEnabledEl.checked = settings.weeklyCap.enabled;
    weeklyCapAmountEl.hidden = !settings.weeklyCap.enabled;
    weeklyCapAmountEl.value = String(settings.weeklyCap.amount);
    monthlyCapEnabledEl.checked = settings.monthlyCap.enabled;
    monthlyCapAmountEl.hidden = !settings.monthlyCap.enabled;
    monthlyCapAmountEl.value = String(settings.monthlyCap.amount);
  }

  return { render, refreshTracker };
}
