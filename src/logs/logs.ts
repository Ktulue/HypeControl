/**
 * Hype Control — Logs page
 * Displays extension and settings logs from chrome.storage.local
 */

import './logs.css';
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

  const reversed = [...entries].reverse();
  container.innerHTML = '';

  reversed.forEach(e => {
    const row = document.createElement('div');
    row.className = `log-entry ${e.level}`;

    const ts = document.createElement('span');
    ts.className = 'log-ts';
    ts.textContent = e.timestamp;

    const level = document.createElement('span');
    level.className = 'log-level';
    level.textContent = levelLabel(e.level);

    const msg = document.createElement('span');
    msg.className = 'log-message';
    msg.textContent = e.message;

    row.appendChild(ts);
    row.appendChild(level);
    row.appendChild(msg);

    if (e.data !== undefined) {
      const data = document.createElement('span');
      data.className = 'log-data';
      data.textContent = JSON.stringify(e.data);
      row.appendChild(data);
    }

    container.appendChild(row);
  });
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
  const panel = document.getElementById('log-container')!;
  document.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      panel.setAttribute('aria-labelledby', btn.id);
      activeTab = btn.dataset.tab as 'extension' | 'settings';
      loadAndRender();
    });
  });
}

function formatLogsAsText(entries: LogEntry[]): string {
  const reversed = [...entries].reverse();
  return reversed.map(e => {
    const parts = [e.timestamp, levelLabel(e.level), e.message];
    if (e.data !== undefined) parts.push(JSON.stringify(e.data));
    return parts.join('\t');
  }).join('\n');
}

function setupControls(): void {
  document.getElementById('btn-refresh')?.addEventListener('click', loadAndRender);

  document.getElementById('btn-copy')?.addEventListener('click', async () => {
    const entries = activeTab === 'extension'
      ? await getExtensionLogs()
      : await getSettingsLogs();
    const text = formatLogsAsText(entries);
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById('btn-copy')!;
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = original; }, 1500);
  });

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

async function initTheme(): Promise<void> {
  try {
    const result = await chrome.storage.sync.get('hcSettings');
    const theme = result?.hcSettings?.theme;
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else if (theme === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches) {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  } catch {
    // non-extension context — ignore
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupTabs();
  setupControls();
  loadAndRender();
});
