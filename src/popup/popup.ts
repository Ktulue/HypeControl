// src/popup/popup.ts
import './popup.css';
import { migrateSettings } from '../shared/types';
import { initPending, getPending, setPendingField } from './pendingState';
import { initScrollSpy, ScrollSpyItem } from './scrollSpy';
import { initStats } from './sections/stats';
import { initFriction } from './sections/friction';
import { initComparisons } from './sections/comparisons';
import { initLimits } from './sections/limits';
import { initChannels } from './sections/channels';
import { initSettingsSection } from './sections/settings-section';

const SETTINGS_KEY = 'hcSettings';

async function main(): Promise<void> {
  // Load and migrate settings
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  const settings = migrateSettings(result[SETTINGS_KEY] ?? {});
  initPending(settings);

  // Section elements
  const statsEl = document.getElementById('section-stats')!;
  const frictionEl = document.getElementById('section-friction')!;
  const comparisonsEl = document.getElementById('section-comparisons')!;
  const limitsEl = document.getElementById('section-limits')!;
  const channelsEl = document.getElementById('section-channels')!;
  const settingsEl = document.getElementById('section-settings')!;

  // Init section controllers with bidirectional sync callbacks
  const friction = initFriction(frictionEl, {
    onIntensityChange: (v) => {
      // Stats intensity mirror — re-render Stats intensity control
      statsEl.querySelectorAll<HTMLButtonElement>('#stats-intensity .seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === v);
      });
    },
  });

  const limits = initLimits(limitsEl, {
    onThresholdToggle: (enabled) => {
      // Stats threshold toggle mirror
      const statsThresholdCb = statsEl.querySelector<HTMLInputElement>('#stats-thresholds-enabled');
      if (statsThresholdCb) statsThresholdCb.checked = enabled;
    },
  });

  const stats = initStats(statsEl, {
    onIntensityChange: (v) => {
      // Friction intensity mirror — re-render Friction intensity control
      frictionEl.querySelectorAll<HTMLButtonElement>('#friction-intensity .seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === v);
      });
    },
    onThresholdToggle: (enabled) => {
      // Limits threshold toggle mirror via setPendingField already done in stats.ts
      // Sync friction thresholds toggle
      const frictionThresholdsCb = frictionEl.querySelector<HTMLInputElement>('#friction-thresholds-enabled');
      const thresholdDetails = frictionEl.querySelector<HTMLElement>('#threshold-details');
      if (frictionThresholdsCb) frictionThresholdsCb.checked = enabled;
      if (thresholdDetails) thresholdDetails.hidden = !enabled;
    },
  });

  const comparisons = initComparisons(comparisonsEl);
  const channels = initChannels(channelsEl);
  const settingsSection = initSettingsSection(settingsEl);

  // Initial render of all sections
  function renderAll(): void {
    const s = getPending();
    stats.render(s);
    friction.render(s);
    comparisons.render(s);
    limits.render(s);
    channels.render(s);
    settingsSection.render(s);
  }
  renderAll();

  // Async data that doesn't come from pending state
  stats.refreshStats();
  limits.refreshTracker();

  // Scroll-spy
  const contentEl = document.getElementById('hc-content')!;
  const spyItems: ScrollSpyItem[] = [
    { id: 'stats',       sectionEl: statsEl,       headingEl: statsEl.querySelector('.section-heading')!,       navEl: document.querySelector('[data-nav-target="stats"]')! },
    { id: 'friction',    sectionEl: frictionEl,    headingEl: frictionEl.querySelector('.section-heading')!,    navEl: document.querySelector('[data-nav-target="friction"]')! },
    { id: 'comparisons', sectionEl: comparisonsEl, headingEl: comparisonsEl.querySelector('.section-heading')!, navEl: document.querySelector('[data-nav-target="comparisons"]')! },
    { id: 'limits',      sectionEl: limitsEl,      headingEl: limitsEl.querySelector('.section-heading')!,      navEl: document.querySelector('[data-nav-target="limits"]')! },
    { id: 'channels',    sectionEl: channelsEl,    headingEl: channelsEl.querySelector('.section-heading')!,    navEl: document.querySelector('[data-nav-target="channels"]')! },
    { id: 'settings',    sectionEl: settingsEl,    headingEl: settingsEl.querySelector('.section-heading')!,    navEl: document.querySelector('[data-nav-target="settings"]')! },
  ];
  initScrollSpy(contentEl, spyItems);

  // Version
  const versionEl = document.getElementById('footer-version');
  if (versionEl) versionEl.textContent = 'v' + chrome.runtime.getManifest().version;

  // Save button
  const saveBtnEl = document.getElementById('btn-save') as HTMLButtonElement;
  saveBtnEl.addEventListener('click', async () => {
    saveBtnEl.disabled = true;
    saveBtnEl.textContent = 'Saving…';
    try {
      await chrome.storage.sync.set({ [SETTINGS_KEY]: getPending() });
      saveBtnEl.textContent = '✓ Saved';
      setTimeout(() => {
        saveBtnEl.disabled = false;
        saveBtnEl.textContent = '💾 Save Settings';
      }, 1500);
    } catch {
      saveBtnEl.disabled = false;
      saveBtnEl.textContent = '💾 Save Settings';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => { main(); });
