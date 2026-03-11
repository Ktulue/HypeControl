/**
 * Hype Control — Logs page
 * Displays extension and settings logs from chrome.storage.local
 */

import {
  getExtensionLogs,
  getSettingsLogs,
  clearExtensionLogs,
  clearSettingsLogs,
  LogEntry,
} from '../shared/logger';

let activeTab: 'extension' | 'settings' = 'extension';

function levelLabel(level: LogEntry['level']): string {
  return level.toUpperCase().padEnd(5);
}

function renderLogs(entries: LogEntry[]): void {
  const container = document.getElementById('log-container')!;
  if (entries.length === 0) {
    container.innerHTML = '<p class="empty">No log entries.</p>';
    return;
  }

  // Newest first
  const reversed = [...entries].reverse();
  container.innerHTML = reversed.map(e => {
    const dataStr = e.data !== undefined
      ? `<span class="log-data">${JSON.stringify(e.data)}</span>`
      : '';
    return `
      <div class="log-entry ${e.level}">
        <span class="log-ts">${e.timestamp}</span>
        <span class="log-level">${levelLabel(e.level)}</span>
        ${e.message}${dataStr}
      </div>
    `;
  }).join('');
}

async function loadAndRender(): Promise<void> {
  const container = document.getElementById('log-container')!;
  container.innerHTML = '<p class="empty">Loading...</p>';
  const entries = activeTab === 'extension'
    ? await getExtensionLogs()
    : await getSettingsLogs();
  renderLogs(entries);
}

function setupTabs(): void {
  document.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab as 'extension' | 'settings';
      loadAndRender();
    });
  });
}

function setupControls(): void {
  document.getElementById('btn-refresh')?.addEventListener('click', loadAndRender);

  document.getElementById('btn-clear')?.addEventListener('click', async () => {
    if (!confirm(`Clear the ${activeTab} log?`)) return;
    if (activeTab === 'extension') {
      clearExtensionLogs();
    } else {
      clearSettingsLogs();
    }
    setTimeout(loadAndRender, 200);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupControls();
  loadAndRender();
});
