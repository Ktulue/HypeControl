/**
 * Hype Control — Spending History page
 * Full-tab view of InterceptEvents with filtering, sorting, and summary metrics.
 */

import './history.css';
import { InterceptEvent } from '../shared/types';
import { readInterceptEvents } from '../shared/interceptLogger';

// ─── State ──────────────────────────────────────────────────
let allEvents: InterceptEvent[] = [];
let filteredEvents: InterceptEvent[] = [];
let sortColumn: 'timestamp' | 'channel' | 'amount' | 'outcome' | 'saved' = 'timestamp';
let sortAsc = false; // default: newest first (descending)
let expandedRowId: string | null = null;

// ─── Theme ──────────────────────────────────────────────────
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

// ─── Formatting helpers ─────────────────────────────────────
function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  return '$' + value.toFixed(2);
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }) + ' ' + d.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── Placeholder functions (filled in by subsequent tasks) ──
function applyFilters(): void { /* Task 6 */ }
function computeSummary(): void { /* Task 7 */ }
function renderTable(): void { /* Task 8 */ }
function setupFilters(): void { /* Task 6 */ }
function setupSort(): void { /* Task 8 */ }

// ─── Entry point ────────────────────────────────────────────
async function main(): Promise<void> {
  await initTheme();
  allEvents = await readInterceptEvents();

  setupFilters();
  setupSort();
  applyFilters();
}

document.addEventListener('DOMContentLoaded', () => { main(); });
