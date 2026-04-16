import { UserSettings, FrictionIntensity, FrictionTriggerMode, DelayTimerConfig, FrictionThresholds, DEFAULT_SETTINGS } from '../../shared/types';
import { setPendingField, getPending } from '../pendingState';

function parseLocaleNumber(str: string): number {
  return parseFloat(str.replace(/[^0-9.\-]/g, '')) || 0;
}

function formatLocaleSalary(value: number): string {
  if (!value || value <= 0) return '';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

export interface FrictionCallbacks {
  onIntensityChange: (value: FrictionIntensity) => void;
  onLockChange?: () => void;
}

export interface FrictionController {
  render(settings: UserSettings): void;
  showEscalation(base: FrictionIntensity, effective: FrictionIntensity): void;
}

export function initFriction(el: HTMLElement, callbacks: FrictionCallbacks): FrictionController {
  const hourlyRateEl = el.querySelector<HTMLInputElement>('#friction-hourly-rate')!;
  const taxRateEl = el.querySelector<HTMLInputElement>('#friction-tax-rate')!;
  const intensityEl = el.querySelector<HTMLElement>('#friction-intensity')!;
  const delayEnabledEl = el.querySelector<HTMLInputElement>('#delay-enabled')!;
  const delayDurationEl = el.querySelector<HTMLElement>('#delay-duration')!;
  const thresholdsEnabledEl = el.querySelector<HTMLInputElement>('#friction-thresholds-enabled')!;
  const thresholdDetailsEl = el.querySelector<HTMLElement>('#threshold-details')!;
  const floorEl = el.querySelector<HTMLInputElement>('#threshold-floor')!;
  const ceilingEl = el.querySelector<HTMLInputElement>('#threshold-ceiling')!;
  const nudgeStepsEl = el.querySelector<HTMLInputElement>('#threshold-nudge-steps')!;
  const lockEl = el.querySelector<HTMLInputElement>('#friction-intensity-lock')!;
  const triggerModeEl = el.querySelector<HTMLElement>('#friction-trigger-mode')!;
  const triggerModeDescEl = el.querySelector<HTMLElement>('#trigger-mode-hint')!;
  const escalationIndicatorEl = el.querySelector<HTMLElement>('#friction-escalation-indicator')!;
  const calcToggle = el.querySelector<HTMLAnchorElement>('#friction-calc-toggle')!;
  const salaryCalcPanel = el.querySelector<HTMLElement>('#friction-salary-calc')!;
  const annualSalaryEl = el.querySelector<HTMLInputElement>('#friction-annual-salary')!;
  const hoursPerWeekEl = el.querySelector<HTMLInputElement>('#friction-hours-per-week')!;
  const chatInterceptEnabledEl = el.querySelector<HTMLInputElement>('#chat-intercept-enabled')!;

  let currentSettings: UserSettings = { ...DEFAULT_SETTINGS };

  function renderSegmented(container: HTMLElement, value: string): void {
    container.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === value);
    });
  }

  const TRIGGER_MODE_DESCRIPTIONS: Record<FrictionTriggerMode, string> = {
    'price-guard': "Friction triggers only when a price is detected. If we can't read the number, you walk.",
    'zero-trust': "Friction on every purchase button — price or not. You asked for this.",
  };

  function updateTriggerModeDesc(mode: FrictionTriggerMode): void {
    triggerModeDescEl.textContent = TRIGGER_MODE_DESCRIPTIONS[mode];
  }

  // Hourly rate
  hourlyRateEl.addEventListener('input', () => {
    setPendingField('hourlyRate', parseFloat(hourlyRateEl.value) || DEFAULT_SETTINGS.hourlyRate);
  });

  // Salary calculator toggle + auto-compute
  calcToggle.addEventListener('click', (e) => {
    e.preventDefault();
    const isHidden = salaryCalcPanel.hasAttribute('hidden');
    if (isHidden) {
      salaryCalcPanel.removeAttribute('hidden');
      calcToggle.textContent = 'Hide calculator ↑';
    } else {
      salaryCalcPanel.setAttribute('hidden', '');
      calcToggle.textContent = 'Calculate from salary →';
    }
  });

  function updateHourlyFromSalary(): void {
    const salary = parseLocaleNumber(annualSalaryEl.value);
    const hours = parseFloat(hoursPerWeekEl.value) || 40;
    if (salary > 0 && hours > 0) {
      const computed = Math.round(salary / 52 / hours * 100) / 100;
      hourlyRateEl.value = String(computed);
      setPendingField('hourlyRate', computed);
    }
  }
  annualSalaryEl.addEventListener('input', updateHourlyFromSalary);
  annualSalaryEl.addEventListener('blur', () => {
    const val = parseLocaleNumber(annualSalaryEl.value);
    if (val > 0) annualSalaryEl.value = formatLocaleSalary(val);
  });
  annualSalaryEl.addEventListener('focus', () => {
    const val = parseLocaleNumber(annualSalaryEl.value);
    if (val > 0) annualSalaryEl.value = String(val);
  });
  hoursPerWeekEl.addEventListener('input', updateHourlyFromSalary);

  // Tax rate
  taxRateEl.addEventListener('input', () => {
    setPendingField('taxRate', parseFloat(taxRateEl.value) || 0);
  });

  // Intensity segmented
  intensityEl.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.value as FrictionIntensity;
      setPendingField('frictionIntensity', val);
      callbacks.onIntensityChange(val);
      renderSegmented(intensityEl, val);
    });
  });

  lockEl.addEventListener('change', () => {
    setPendingField('intensityLocked', lockEl.checked);
    callbacks.onLockChange?.();
  });

  // Trigger mode segmented
  triggerModeEl.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.value as FrictionTriggerMode;
      setPendingField('frictionTriggerMode', val);
      renderSegmented(triggerModeEl, val);
      updateTriggerModeDesc(val);
    });
  });

  // Delay timer toggle
  delayEnabledEl.addEventListener('change', () => {
    const enabled = delayEnabledEl.checked;
    delayDurationEl.hidden = !enabled;
    setPendingField('delayTimer', { ...getPending().delayTimer, enabled });
  });

  // Delay duration segmented
  delayDurationEl.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const secs = parseInt(btn.dataset.value ?? '10', 10) as DelayTimerConfig['seconds'];
      setPendingField('delayTimer', { ...getPending().delayTimer, seconds: secs });
      renderSegmented(delayDurationEl, String(secs));
    });
  });

  // Thresholds toggle
  thresholdsEnabledEl.addEventListener('change', () => {
    const enabled = thresholdsEnabledEl.checked;
    thresholdDetailsEl.hidden = !enabled;
    setPendingField('frictionThresholds', { ...getPending().frictionThresholds, enabled });
  });

  // Chat command interception toggle
  chatInterceptEnabledEl.addEventListener('change', () => {
    setPendingField('chatCommandInterception', {
      enabled: chatInterceptEnabledEl.checked,
    });
  });

  // Threshold fields
  function updateThresholds(): void {
    const t: FrictionThresholds = {
      enabled: getPending().frictionThresholds.enabled,
      thresholdFloor: parseFloat(floorEl.value) || 0,
      thresholdCeiling: parseFloat(ceilingEl.value) || 0,
      softNudgeSteps: Math.min(parseInt(nudgeStepsEl.value, 10) || 1, currentSettings.comparisonItems.length || 1),
    };
    setPendingField('frictionThresholds', t);
  }
  floorEl.addEventListener('input', updateThresholds);
  ceilingEl.addEventListener('input', updateThresholds);
  nudgeStepsEl.addEventListener('input', updateThresholds);

  function showEscalation(base: FrictionIntensity, effective: FrictionIntensity): void {
    const isEscalated = base !== effective;
    escalationIndicatorEl.hidden = !isEscalated;
    if (isEscalated) {
      const textEl = escalationIndicatorEl.querySelector('.escalation-text')!;
      textEl.textContent = `↑ Auto-escalated from ${base.charAt(0).toUpperCase() + base.slice(1)}`;
      intensityEl.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
        btn.classList.remove('escalated', 'base-indicator');
        btn.classList.toggle('active', btn.dataset.value === effective);
        if (btn.dataset.value === base) btn.classList.add('base-indicator');
        if (btn.dataset.value === effective) btn.classList.add('escalated');
      });
    } else {
      intensityEl.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
        btn.classList.remove('escalated', 'base-indicator');
      });
    }
  }

  function render(settings: UserSettings): void {
    currentSettings = settings;
    nudgeStepsEl.max = String(settings.comparisonItems.length);
    hourlyRateEl.value = String(settings.hourlyRate);
    taxRateEl.value = String(settings.taxRate);
    renderSegmented(intensityEl, settings.frictionIntensity);
    renderSegmented(triggerModeEl, settings.frictionTriggerMode);
    updateTriggerModeDesc(settings.frictionTriggerMode);
    delayEnabledEl.checked = settings.delayTimer.enabled;
    delayDurationEl.hidden = !settings.delayTimer.enabled;
    renderSegmented(delayDurationEl, String(settings.delayTimer.seconds));
    thresholdsEnabledEl.checked = settings.frictionThresholds.enabled;
    thresholdDetailsEl.hidden = !settings.frictionThresholds.enabled;
    floorEl.value = String(settings.frictionThresholds.thresholdFloor);
    ceilingEl.value = String(settings.frictionThresholds.thresholdCeiling);
    nudgeStepsEl.value = String(settings.frictionThresholds.softNudgeSteps);
    lockEl.checked = settings.intensityLocked ?? false;
    chatInterceptEnabledEl.checked = settings.chatCommandInterception.enabled;
  }

  return { render, showEscalation };
}
