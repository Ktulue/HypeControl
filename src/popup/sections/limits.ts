import { UserSettings, DEFAULT_SPENDING_TRACKER, migrateSettings } from '../../shared/types';
import { loadSpendingTracker, SPENDING_KEY } from '../../shared/spendingTracker';
import { initCalendar } from './calendar';
import { getPending, setPendingField } from '../pendingState';

export interface LimitsController {
  render(settings: UserSettings): void;
  refreshTracker(): Promise<void>;
}

export interface LimitsCallbacks {
  onCapChange?: () => void;
}

export function initLimits(el: HTMLElement, callbacks: LimitsCallbacks = {}): LimitsController {
  const dailyCapEnabledEl = el.querySelector<HTMLInputElement>('#daily-cap-enabled')!;
  const dailyCapAmountEl = el.querySelector<HTMLInputElement>('#daily-cap-amount')!;
  const cooldownEnabledEl = el.querySelector<HTMLInputElement>('#cooldown-enabled')!;
  const cooldownDurationEl = el.querySelector<HTMLSelectElement>('#cooldown-duration')!;
  const trackerDailyEl = el.querySelector<HTMLElement>('#tracker-daily')!;
  const resetBtnEl = el.querySelector<HTMLButtonElement>('#btn-reset-tracker')!;
  const confirmResetEl = el.querySelector<HTMLElement>('#confirm-reset')!;
  const resetConfirmBtnEl = el.querySelector<HTMLButtonElement>('#btn-reset-confirm')!;
  const resetCancelBtnEl = el.querySelector<HTMLButtonElement>('#btn-reset-cancel')!;
  const weeklyCapEnabledEl = el.querySelector<HTMLInputElement>('#weekly-cap-enabled')!;
  const weeklyCapAmountEl = el.querySelector<HTMLInputElement>('#weekly-cap-amount')!;
  const weeklyResetDayRowEl = el.querySelector<HTMLElement>('#weekly-reset-day-row')!;
  const weeklyResetDayEl = el.querySelector<HTMLElement>('#weekly-reset-day')!;
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
    callbacks.onCapChange?.();
  });
  dailyCapAmountEl.addEventListener('input', () => {
    setPendingField('dailyCap', {
      ...getPending().dailyCap,
      amount: parseFloat(dailyCapAmountEl.value) || 0,
    });
    callbacks.onCapChange?.();
  });

  // Weekly cap
  weeklyCapEnabledEl.addEventListener('change', () => {
    const enabled = weeklyCapEnabledEl.checked;
    weeklyCapAmountEl.hidden = !enabled;
    weeklyResetDayRowEl.hidden = !enabled;
    setPendingField('weeklyCap', { ...getPending().weeklyCap, enabled });
    callbacks.onCapChange?.();
  });
  weeklyCapAmountEl.addEventListener('input', () => {
    setPendingField('weeklyCap', {
      ...getPending().weeklyCap,
      amount: parseFloat(weeklyCapAmountEl.value) || 0,
    });
    callbacks.onCapChange?.();
  });

  // Weekly reset day
  weeklyResetDayEl.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.value as 'monday' | 'sunday';
      setPendingField('weeklyResetDay', val);
      weeklyResetDayEl.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.value === val);
      });
    });
  });

  // Monthly cap
  monthlyCapEnabledEl.addEventListener('change', () => {
    const enabled = monthlyCapEnabledEl.checked;
    monthlyCapAmountEl.hidden = !enabled;
    setPendingField('monthlyCap', { ...getPending().monthlyCap, enabled });
    callbacks.onCapChange?.();
  });
  monthlyCapAmountEl.addEventListener('input', () => {
    setPendingField('monthlyCap', {
      ...getPending().monthlyCap,
      amount: parseFloat(monthlyCapAmountEl.value) || 0,
    });
    callbacks.onCapChange?.();
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

  // Reset tracker (inline confirmation with dynamic summary)
  const resetSummaryEl = el.querySelector<HTMLElement>('#reset-summary')!;

  resetBtnEl.addEventListener('click', async () => {
    const result = await chrome.storage.local.get(SPENDING_KEY);
    const tracker = result[SPENDING_KEY];
    const parts: string[] = [];
    const daily = tracker?.dailyTotal ?? 0;
    const weekly = tracker?.weeklyTotal ?? 0;
    const monthly = tracker?.monthlyTotal ?? 0;

    if (daily > 0) parts.push(`daily $${daily.toFixed(2)}`);
    if (weekly > 0) parts.push(`weekly $${weekly.toFixed(2)}`);
    if (monthly > 0) parts.push(`monthly $${monthly.toFixed(2)}`);

    if (parts.length === 0) {
      resetSummaryEl.textContent = 'All totals are already $0. Reset anyway?';
    } else {
      resetSummaryEl.textContent = `This wipes ${parts.join(', ')} back to $0. Cooldown timer resets too.`;
    }

    resetBtnEl.hidden = true;
    confirmResetEl.hidden = false;
  });
  resetCancelBtnEl.addEventListener('click', () => {
    confirmResetEl.hidden = true;
    resetBtnEl.hidden = false;
  });
  resetConfirmBtnEl.addEventListener('click', async () => {
    await chrome.storage.local.set({ [SPENDING_KEY]: DEFAULT_SPENDING_TRACKER });
    confirmResetEl.hidden = true;
    resetBtnEl.hidden = false;
    await refreshTracker();
  });

  // Savings calendar
  const calendarBtnEl = el.querySelector<HTMLButtonElement>('#btn-calendar')!;
  const calendarContainerEl = el.querySelector<HTMLElement>('#calendar-container')!;

  const calendar = initCalendar(calendarContainerEl, async () => {
    const result = await chrome.storage.sync.get('hcSettings');
    return migrateSettings(result['hcSettings'] || {});
  });

  calendarBtnEl.addEventListener('click', () => {
    calendar.toggle();
  });

  async function refreshTracker(): Promise<void> {
    const settingsResult = await chrome.storage.sync.get('hcSettings');
    const userSettings = migrateSettings(settingsResult['hcSettings'] || {});
    const tracker = await loadSpendingTracker(userSettings);

    trackerDailyEl.textContent = `$${(tracker.dailyTotal ?? 0).toFixed(2)}`;

    trackerWeeklyEl.textContent = `$${(tracker.weeklyTotal ?? 0).toFixed(2)}`;
    trackerMonthlyEl.textContent = `$${(tracker.monthlyTotal ?? 0).toFixed(2)}`;

    const weeklyEnabled = userSettings.weeklyCap?.enabled ?? false;
    const monthlyEnabled = userSettings.monthlyCap?.enabled ?? false;
    trackerWeeklyRowEl.hidden = !weeklyEnabled;
    trackerMonthlyRowEl.hidden = !monthlyEnabled;
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
    weeklyResetDayRowEl.hidden = !settings.weeklyCap.enabled;
    weeklyResetDayEl.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === settings.weeklyResetDay);
    });
    monthlyCapEnabledEl.checked = settings.monthlyCap.enabled;
    monthlyCapAmountEl.hidden = !settings.monthlyCap.enabled;
    monthlyCapAmountEl.value = String(settings.monthlyCap.amount);
  }

  return { render, refreshTracker };
}
