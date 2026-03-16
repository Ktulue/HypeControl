// src/popup/popup.ts
import './popup.css';
import { migrateSettings, ThemePreference, ONBOARDING_KEYS, PRESET_COMPARISON_ITEMS, DEFAULT_SETTINGS, UserSettings, SpendingTracker, DEFAULT_SPENDING_TRACKER } from '../shared/types';
import { computeEscalatedIntensity, computeMaxCapPercent } from '../shared/escalation';
import { initPending, getPending, setPendingField } from './pendingState';
import { initScrollSpy, ScrollSpyItem } from './scrollSpy';
import { initStats } from './sections/stats';
import { initFriction } from './sections/friction';
import { initComparisons } from './sections/comparisons';
import { initLimits } from './sections/limits';
import { initChannels } from './sections/channels';
import { initSettingsSection } from './sections/settings-section';
import { settingsLog, setVersion } from '../shared/logger';

const SETTINGS_KEY = 'hcSettings';

let activeMql: MediaQueryList | null = null;
let mqlHandler: (() => void) | null = null;

function applyTheme(theme: ThemePreference): void {
  // Always clean up any existing MQL listener first (for all theme values)
  if (activeMql && mqlHandler) {
    activeMql.removeEventListener('change', mqlHandler);
    activeMql = null;
    mqlHandler = null;
  }

  let resolved: 'light' | 'dark';
  if (theme === 'auto') {
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    resolved = mql.matches ? 'light' : 'dark'; // defaults to dark if media query unavailable
    mqlHandler = () => applyTheme('auto');
    activeMql = mql;
    mql.addEventListener('change', mqlHandler);
  } else {
    resolved = theme;
  }

  document.documentElement.dataset.theme = resolved;
}

const FRICTION_DESCRIPTIONS: Record<string, string> = {
  low: 'Main overlay only — one click to cancel',
  medium: 'Overlay + reason selection',
  high: 'Overlay + reason + cooldown timer',
  extreme: 'Everything + math challenge + type-to-confirm',
};

function showWizard(onComplete: () => void): void {
  const wizard = document.getElementById('hc-wizard')!;
  const form = document.getElementById('wizard-form')!;
  const skipLink = document.getElementById('wizard-skip')!;
  const skipConfirm = document.getElementById('wizard-skip-confirm')!;
  const gotItBtn = document.getElementById('wizard-got-it')!;
  const hourlyInput = document.getElementById('wizard-hourly-rate') as HTMLInputElement;
  const taxInput = document.getElementById('wizard-tax-rate') as HTMLInputElement;
  const calcToggle = document.getElementById('wizard-calc-toggle')!;
  const salaryCalc = document.getElementById('wizard-salary-calc')!;
  const salaryInput = document.getElementById('wizard-annual-salary') as HTMLInputElement;
  const hoursInput = document.getElementById('wizard-hours-per-week') as HTMLInputElement;
  const frictionSeg = document.getElementById('wizard-friction-seg')!;
  const frictionDesc = document.getElementById('wizard-friction-desc')!;
  const chips = document.getElementById('wizard-chips')!;
  const continueBtn = document.getElementById('wizard-continue')!;
  const customizeLink = document.getElementById('wizard-customize-link')!;

  // Show wizard, hide main content
  wizard.removeAttribute('hidden');
  const content = document.getElementById('hc-content')!;
  const nav = document.getElementById('hc-nav')!;
  content.setAttribute('hidden', '');
  nav.setAttribute('hidden', '');

  // Populate comparison chips (first 4 enabled presets)
  const previewItems = PRESET_COMPARISON_ITEMS.filter(i => i.enabled).slice(0, 4);
  chips.innerHTML = '';
  previewItems.forEach(item => {
    const chip = document.createElement('span');
    chip.className = 'hc-wizard-chip';
    chip.textContent = `${item.emoji} ${item.name}`;
    chips.appendChild(chip);
  });

  // Salary calculator toggle
  calcToggle.addEventListener('click', (e) => {
    e.preventDefault();
    const isHidden = salaryCalc.hasAttribute('hidden');
    if (isHidden) {
      salaryCalc.removeAttribute('hidden');
      calcToggle.textContent = 'Hide calculator ↑';
    } else {
      salaryCalc.setAttribute('hidden', '');
      calcToggle.textContent = 'Calculate from salary →';
    }
  });

  // Salary calculator: auto-compute hourly rate
  function updateHourlyFromSalary(): void {
    const salary = parseFloat(salaryInput.value);
    const hours = parseFloat(hoursInput.value) || 40;
    if (salary > 0 && hours > 0) {
      hourlyInput.value = (salary / 52 / hours).toFixed(2);
    }
  }
  salaryInput.addEventListener('input', updateHourlyFromSalary);
  hoursInput.addEventListener('input', updateHourlyFromSalary);

  // Friction segmented control
  frictionSeg.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.hc-wizard-seg-btn') as HTMLButtonElement | null;
    if (!btn) return;
    frictionSeg.querySelectorAll('.hc-wizard-seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    frictionDesc.textContent = FRICTION_DESCRIPTIONS[btn.dataset.value ?? 'medium'] ?? '';
  });

  // Skip path
  skipLink.addEventListener('click', async (e) => {
    e.preventDefault();
    // Write defaults to storage
    await chrome.storage.sync.set({ hcSettings: DEFAULT_SETTINGS });
    // Clear wizard pending flag; leave phase2 pending
    await chrome.storage.local.set({ [ONBOARDING_KEYS.wizardPending]: false });
    // Show skip confirmation
    form.setAttribute('hidden', '');
    skipLink.setAttribute('hidden', '');
    skipConfirm.removeAttribute('hidden');
    // Auto-close after 3s fallback
    const autoClose = setTimeout(() => closeWizard(), 3000);
    gotItBtn.addEventListener('click', () => {
      clearTimeout(autoClose);
      closeWizard();
    });
  });

  // Customize link — close wizard and navigate to Comparisons section
  customizeLink.addEventListener('click', (e) => {
    e.preventDefault();
    closeWizard();
    // Scroll to comparisons section
    setTimeout(() => {
      document.getElementById('section-comparisons')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  });

  // Continue button
  continueBtn.addEventListener('click', async () => {
    const hourlyRate = parseFloat(hourlyInput.value) || 20;
    const taxRate = parseFloat(taxInput.value) || 7;
    const activeBtn = frictionSeg.querySelector<HTMLButtonElement>('.hc-wizard-seg-btn.active');
    const frictionIntensity = (activeBtn?.dataset.value ?? 'low') as UserSettings['frictionIntensity'];

    // Load current settings (handles reinstall case — prefills from existing)
    const result = await chrome.storage.sync.get('hcSettings');
    const current = migrateSettings(result.hcSettings ?? {});
    const updated = { ...current, hourlyRate, taxRate, frictionIntensity };
    await chrome.storage.sync.set({ hcSettings: updated });
    await chrome.storage.local.set({ [ONBOARDING_KEYS.wizardPending]: false });
    closeWizard();
  });

  function closeWizard(): void {
    wizard.setAttribute('hidden', '');
    content.removeAttribute('hidden');
    nav.removeAttribute('hidden');
    onComplete();
  }
}

async function triggerReplay(): Promise<void> {
  await chrome.storage.local.set({
    [ONBOARDING_KEYS.wizardPending]: true,
    [ONBOARDING_KEYS.phase2Pending]: true,
    [ONBOARDING_KEYS.complete]: false,
  });
  // Re-render wizard in place.
  // On completion, reload the popup window to avoid double-initializing
  // section controllers and event listeners (main() already ran once).
  showWizard(() => window.location.reload());
}

async function main(): Promise<void> {
  // Check if onboarding wizard should be shown (first open)
  const onboardingState = await chrome.storage.local.get([
    ONBOARDING_KEYS.wizardPending,
  ]);
  if (onboardingState[ONBOARDING_KEYS.wizardPending] === true) {
    // Show wizard; when complete, re-run main() to populate normal popup state
    showWizard(() => main());
    return;
  }

  // Load and migrate settings
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  const settings = migrateSettings(result[SETTINGS_KEY] ?? {});
  initPending(settings);
  setVersion(chrome.runtime.getManifest().version);

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

  const limits = initLimits(limitsEl);

  const stats = initStats(statsEl, {
    onIntensityChange: (v) => {
      // Friction intensity mirror — re-render Friction intensity control
      frictionEl.querySelectorAll<HTMLButtonElement>('#friction-intensity .seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === v);
      });
    },
  });

  const comparisons = initComparisons(comparisonsEl);
  const channels = initChannels(channelsEl);
  const settingsSection = initSettingsSection(settingsEl, {
    onThemeChange: (v) => applyTheme(v),
  });

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
  applyTheme(settings.theme);

  // Async data that doesn't come from pending state
  stats.refreshStats();
  limits.refreshTracker();

  // Compute escalation state from tracker + settings
  async function updateEscalation(): Promise<void> {
    const trackerResult = await chrome.storage.local.get('hcSpending');
    const tracker: SpendingTracker = { ...DEFAULT_SPENDING_TRACKER, ...trackerResult['hcSpending'] };
    const s = getPending();
    const maxPercent = computeMaxCapPercent(s, tracker);
    const effective = computeEscalatedIntensity(s.frictionIntensity, maxPercent, s.intensityLocked);
    stats.showEscalation(s.frictionIntensity, effective);
    friction.showEscalation(s.frictionIntensity, effective);
  }
  await updateEscalation();

  // Scroll-spy
  const contentEl = document.getElementById('hc-content')!;
  const creditsEl = document.getElementById('section-credits')!;

  const spyItems: ScrollSpyItem[] = [
    { id: 'stats',       sectionEl: statsEl,       headingEl: statsEl.querySelector('.section-heading')!,       navEl: document.querySelector('[data-nav-target="stats"]')! },
    { id: 'friction',    sectionEl: frictionEl,    headingEl: frictionEl.querySelector('.section-heading')!,    navEl: document.querySelector('[data-nav-target="friction"]')! },
    { id: 'comparisons', sectionEl: comparisonsEl, headingEl: comparisonsEl.querySelector('.section-heading')!, navEl: document.querySelector('[data-nav-target="comparisons"]')! },
    { id: 'limits',      sectionEl: limitsEl,      headingEl: limitsEl.querySelector('.section-heading')!,      navEl: document.querySelector('[data-nav-target="limits"]')! },
    { id: 'channels',    sectionEl: channelsEl,    headingEl: channelsEl.querySelector('.section-heading')!,    navEl: document.querySelector('[data-nav-target="channels"]')! },
    { id: 'settings',    sectionEl: settingsEl,    headingEl: settingsEl.querySelector('.section-heading')!,    navEl: document.querySelector('[data-nav-target="settings"]')! },
    { id: 'credits',     sectionEl: creditsEl,     headingEl: creditsEl.querySelector('.section-heading')!,     navEl: document.querySelector('[data-nav-target="credits"]')! },
  ];
  const spy = initScrollSpy(contentEl, spyItems);

  // If navigated back from another page with a hash, jump to that section
  const hash = window.location.hash.slice(1);
  if (hash) spy.jumpTo(hash);

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
      settingsLog('Settings saved via popup', { snapshot: getPending() });
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

  // Replay tour trigger
  document.getElementById('btn-replay-bottom')?.addEventListener('click', async () => {
    await triggerReplay();
  });
}

document.addEventListener('DOMContentLoaded', () => { main(); });
