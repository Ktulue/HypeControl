import { UserSettings, FrictionIntensity, DelayTimerConfig, FrictionThresholds, DEFAULT_SETTINGS } from '../../shared/types';
import { setPendingField, getPending } from '../pendingState';

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
  const escalationIndicatorEl = el.querySelector<HTMLElement>('#friction-escalation-indicator')!;

  let currentSettings: UserSettings = { ...DEFAULT_SETTINGS };

  function renderSegmented(container: HTMLElement, value: string): void {
    container.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === value);
    });
  }

  // Hourly rate
  hourlyRateEl.addEventListener('input', () => {
    setPendingField('hourlyRate', parseFloat(hourlyRateEl.value) || DEFAULT_SETTINGS.hourlyRate);
  });

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
    const statsLock = document.querySelector<HTMLInputElement>('#stats-intensity-lock');
    if (statsLock) statsLock.checked = lockEl.checked;
    callbacks.onLockChange?.();
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
    delayEnabledEl.checked = settings.delayTimer.enabled;
    delayDurationEl.hidden = !settings.delayTimer.enabled;
    renderSegmented(delayDurationEl, String(settings.delayTimer.seconds));
    thresholdsEnabledEl.checked = settings.frictionThresholds.enabled;
    thresholdDetailsEl.hidden = !settings.frictionThresholds.enabled;
    floorEl.value = String(settings.frictionThresholds.thresholdFloor);
    ceilingEl.value = String(settings.frictionThresholds.thresholdCeiling);
    nudgeStepsEl.value = String(settings.frictionThresholds.softNudgeSteps);
    lockEl.checked = settings.intensityLocked ?? false;
  }

  return { render, showEscalation };
}
