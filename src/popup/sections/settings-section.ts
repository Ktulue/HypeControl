// src/popup/sections/settings-section.ts
import { UserSettings, ThemePreference } from '../../shared/types';
import { setPendingField } from '../pendingState';

export interface SettingsSectionController {
  render(settings: UserSettings): void;
}

export function initSettingsSection(el: HTMLElement): SettingsSectionController {
  const themeEl = el.querySelector<HTMLSelectElement>('#theme-select')!;
  const toastEl = el.querySelector<HTMLInputElement>('#toast-duration')!;
  const logsBtn = el.querySelector<HTMLButtonElement>('#btn-view-logs')!;

  themeEl.addEventListener('change', () => {
    setPendingField('theme', themeEl.value as ThemePreference);
  });

  toastEl.addEventListener('input', () => {
    setPendingField('toastDurationSeconds', parseInt(toastEl.value, 10) || 15);
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
