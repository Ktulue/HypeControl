import { UserSettings, FrictionIntensity, DelayTimerConfig, FrictionThresholds, DEFAULT_SETTINGS } from '../../shared/types';
import { setPendingField, getPending } from '../pendingState';

export interface FrictionCallbacks {
  onIntensityChange: (value: FrictionIntensity) => void;
}

export interface FrictionController {
  render(settings: UserSettings): void;
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
      softNudgeSteps: parseInt(nudgeStepsEl.value, 10) || 1,
    };
    setPendingField('frictionThresholds', t);
  }
  floorEl.addEventListener('input', updateThresholds);
  ceilingEl.addEventListener('input', updateThresholds);
  nudgeStepsEl.addEventListener('input', updateThresholds);

  function render(settings: UserSettings): void {
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
  }

  return { render };
}
