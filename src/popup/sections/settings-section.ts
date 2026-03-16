// src/popup/sections/settings-section.ts
import { UserSettings, ThemePreference } from '../../shared/types';
import { setPendingField } from '../pendingState';

export interface SettingsSectionCallbacks {
  onThemeChange?: (theme: ThemePreference) => void;
}

export interface SettingsSectionController {
  render(settings: UserSettings): void;
}

export function initSettingsSection(el: HTMLElement, callbacks: SettingsSectionCallbacks = {}): SettingsSectionController {
  const themeEl = el.querySelector<HTMLSelectElement>('#theme-select')!;
  const toastEl = el.querySelector<HTMLInputElement>('#toast-duration')!;
  const historyBtn = el.querySelector<HTMLButtonElement>('#btn-view-history')!;
  const logsBtn = el.querySelector<HTMLButtonElement>('#btn-view-logs')!;

  themeEl.addEventListener('change', () => {
    const theme = themeEl.value as ThemePreference;
    callbacks.onThemeChange?.(theme);
    setPendingField('theme', theme);
  });

  toastEl.addEventListener('input', () => {
    setPendingField('toastDurationSeconds', parseInt(toastEl.value, 10) || 15);
  });

  historyBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
  });

  logsBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('logs.html') });
  });

  function render(settings: UserSettings): void {
    themeEl.value = settings.theme;
    toastEl.value = String(settings.toastDurationSeconds);
  }

  return { render };
}
