import { computePopupStats } from '../../shared/interceptLogger';
import { UserSettings, FrictionIntensity } from '../../shared/types';
import { setPendingField } from '../pendingState';

const SETTINGS_KEY = 'hcSettings';

export interface StatsCallbacks {
  onIntensityChange: (value: UserSettings['frictionIntensity']) => void;
  onLockChange?: () => void;
}

export interface StatsController {
  render(settings: UserSettings): void;
  refreshStats(): Promise<void>;
  showEscalation(base: FrictionIntensity, effective: FrictionIntensity): void;
}

export function initStats(el: HTMLElement, callbacks: StatsCallbacks): StatsController {
  const savedEl = el.querySelector<HTMLElement>('#stat-saved')!;
  const blockedEl = el.querySelector<HTMLElement>('#stat-blocked')!;
  const rateEl = el.querySelector<HTMLElement>('#stat-rate')!;
  const stepEl = el.querySelector<HTMLElement>('#stat-step')!;
  const overrideStatusEl = el.querySelector<HTMLElement>('#override-status')!;
  const overrideBtnEl = el.querySelector<HTMLButtonElement>('#btn-override')!;
  const intensityEl = el.querySelector<HTMLElement>('#stats-intensity')!;
  const lockEl = el.querySelector<HTMLInputElement>('#stats-intensity-lock')!;
  const escalationIndicatorEl = el.querySelector<HTMLElement>('#stats-escalation-indicator')!;
  function renderSegmented(container: HTMLElement, value: string): void {
    container.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === value);
    });
  }

  function renderOverride(settings: Partial<UserSettings>): void {
    const override = settings.streamingOverride;
    const now = Date.now();
    const isActive = !!(override && override.expiresAt > now);
    if (isActive && override) {
      const ms = override.expiresAt - now;
      const totalMin = Math.floor(ms / 60000);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      overrideStatusEl.textContent = `Active — ${h > 0 ? `${h}h ` : ''}${m}m remaining`;
    } else {
      overrideStatusEl.textContent = 'No active override';
    }
    overrideBtnEl.textContent = isActive ? 'Cancel Override' : 'Stream Override (2 hr)';
  }

  // Wire intensity segmented control
  intensityEl.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.value as UserSettings['frictionIntensity'];
      setPendingField('frictionIntensity', val);
      callbacks.onIntensityChange(val);
      renderSegmented(intensityEl, val);
    });
  });

  lockEl.addEventListener('change', () => {
    setPendingField('intensityLocked', lockEl.checked);
    const frictionLock = document.querySelector<HTMLInputElement>('#friction-intensity-lock');
    if (frictionLock) frictionLock.checked = lockEl.checked;
    callbacks.onLockChange?.();
  });

  // Wire override button (immediate save — bypasses pending state)
  overrideBtnEl.addEventListener('click', async () => {
    const result = await chrome.storage.sync.get(SETTINGS_KEY);
    const current: Partial<UserSettings> = result[SETTINGS_KEY] ?? {};
    const isActive = !!(current.streamingOverride && current.streamingOverride.expiresAt > Date.now());
    if (isActive) {
      const updated = { ...current };
      delete updated.streamingOverride;
      await chrome.storage.sync.set({ [SETTINGS_KEY]: updated });
    } else {
      await chrome.storage.sync.set({
        [SETTINGS_KEY]: { ...current, streamingOverride: { expiresAt: Date.now() + 2 * 60 * 60 * 1000 } },
      });
    }
    const fresh = await chrome.storage.sync.get(SETTINGS_KEY);
    renderOverride(fresh[SETTINGS_KEY] ?? {});
  });

  async function refreshStats(): Promise<void> {
    const stats = await computePopupStats();
    const saved = savedEl.querySelector<HTMLElement>('.stat-value');
    const blocked = blockedEl.querySelector<HTMLElement>('.stat-value');
    const rate = rateEl.querySelector<HTMLElement>('.stat-value');
    const step = stepEl.querySelector<HTMLElement>('.stat-value');
    if (saved)   saved.textContent   = `$${stats.savedTotal.toFixed(2)}`;
    if (blocked) blocked.textContent = `${stats.blockedCount}`;
    if (rate)    rate.textContent    = `${Math.round(stats.cancelRate)}%`;
    if (step)    step.textContent    = stats.mostEffectiveStep != null
      ? `Step ${stats.mostEffectiveStep}`
      : '—';
  }

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
    renderSegmented(intensityEl, settings.frictionIntensity);
    renderOverride(settings);
    lockEl.checked = settings.intensityLocked ?? false;
  }

  return { render, refreshStats, showEscalation };
}
