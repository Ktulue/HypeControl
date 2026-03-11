import { computePopupStats } from '../shared/interceptLogger';
import './popup.css';
import { UserSettings } from '../shared/types';

const SETTINGS_KEY = 'hcSettings';

async function renderStats(): Promise<void> {
  const stats = await computePopupStats();

  const savedEl = document.getElementById('stat-saved');
  const blockedEl = document.getElementById('stat-blocked');
  const rateEl = document.getElementById('stat-rate');
  const stepEl = document.getElementById('stat-step');

  if (savedEl) {
    savedEl.textContent = `$${stats.savedTotal.toFixed(2)} saved`;
  }
  if (blockedEl) {
    blockedEl.textContent = `${stats.blockedCount} blocked`;
  }
  if (rateEl) {
    rateEl.textContent = `${Math.round(stats.cancelRate)}% cancel rate`;
  }
  if (stepEl) {
    stepEl.textContent =
      stats.mostEffectiveStep != null ? `Step ${stats.mostEffectiveStep}` : '—';
  }
}

async function renderStreamingOverride(): Promise<void> {
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  const settings: Partial<UserSettings> = result[SETTINGS_KEY] ?? {};

  const statusEl = document.getElementById('streaming-status');
  const btnEl = document.getElementById('btn-streaming-override') as HTMLButtonElement | null;

  const override = settings.streamingOverride;
  const now = Date.now();
  const isActive = !!(override && override.expiresAt > now);

  if (statusEl) {
    if (isActive && override) {
      const remainingMs = override.expiresAt - now;
      const totalMinutes = Math.floor(remainingMs / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      statusEl.textContent = `Active — ${timeStr} remaining`;
    } else {
      statusEl.textContent = 'No active override';
    }
  }

  if (btnEl) {
    btnEl.textContent = isActive ? 'Cancel Override' : 'Stream Override (2 hr)';

    // Remove any previous listener by replacing the button's clone
    const newBtn = btnEl.cloneNode(true) as HTMLButtonElement;
    btnEl.parentNode?.replaceChild(newBtn, btnEl);

    newBtn.addEventListener('click', async () => {
      const freshResult = await chrome.storage.sync.get(SETTINGS_KEY);
      const freshSettings: Partial<UserSettings> = freshResult[SETTINGS_KEY] ?? {};

      const freshOverride = freshSettings.streamingOverride;
      const freshNow = Date.now();
      const freshActive = !!(freshOverride && freshOverride.expiresAt > freshNow);

      if (freshActive) {
        await chrome.storage.sync.set({
          [SETTINGS_KEY]: { ...freshSettings, streamingOverride: undefined },
        });
      } else {
        await chrome.storage.sync.set({
          [SETTINGS_KEY]: {
            ...freshSettings,
            streamingOverride: { expiresAt: Date.now() + 2 * 60 * 60 * 1000 },
          },
        });
      }

      await renderStreamingOverride();
    });
  }
}

function renderVersion(): void {
  const versionEl = document.getElementById('popup-version');
  if (versionEl) {
    versionEl.textContent = 'v' + chrome.runtime.getManifest().version;
  }
}

function setupLogsLink(): void {
  const logsEl = document.getElementById('link-logs') as HTMLAnchorElement | null;
  if (logsEl) {
    logsEl.href = `chrome-extension://${chrome.runtime.id}/logs.html`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderStats();
  renderStreamingOverride();
  renderVersion();
  setupLogsLink();
});
