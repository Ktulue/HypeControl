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

// ─── Filter helpers ─────────────────────────────────────────
function updateChannelDropdown(channelEl: HTMLSelectElement): void {
  const startEl = document.getElementById('filter-start') as HTMLInputElement;
  const endEl = document.getElementById('filter-end') as HTMLInputElement;
  const startDate = startEl.value ? new Date(startEl.value + 'T00:00:00') : null;
  const endDate = endEl.value ? new Date(endEl.value + 'T23:59:59.999') : null;

  const channelsInRange = new Set<string>();
  for (const event of allEvents) {
    if (startDate && event.timestamp < startDate.getTime()) continue;
    if (endDate && event.timestamp > endDate.getTime()) continue;
    channelsInRange.add(event.channel);
  }

  const previousValue = channelEl.value;
  channelEl.replaceChildren();

  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = 'All Channels';
  channelEl.appendChild(allOption);

  const sorted = [...channelsInRange].sort((a, b) => a.localeCompare(b));
  for (const ch of sorted) {
    const opt = document.createElement('option');
    opt.value = ch;
    opt.textContent = ch;
    channelEl.appendChild(opt);
  }

  if (channelsInRange.has(previousValue)) {
    channelEl.value = previousValue;
  } else {
    channelEl.value = '';
  }
}

function updateEmptyStates(): void {
  const noDataEl = document.getElementById('empty-no-data')!;
  const noMatchEl = document.getElementById('empty-no-match')!;
  const tableContainer = document.querySelector('.table-container') as HTMLElement;

  if (allEvents.length === 0) {
    noDataEl.removeAttribute('hidden');
    noMatchEl.setAttribute('hidden', '');
    tableContainer.style.display = 'none';
  } else if (filteredEvents.length === 0) {
    noDataEl.setAttribute('hidden', '');
    noMatchEl.removeAttribute('hidden');
    tableContainer.style.display = 'none';
  } else {
    noDataEl.setAttribute('hidden', '');
    noMatchEl.setAttribute('hidden', '');
    tableContainer.style.display = '';
  }
}

function sortEvents(): void {
  filteredEvents.sort((a, b) => {
    let cmp = 0;
    switch (sortColumn) {
      case 'timestamp':
        cmp = a.timestamp - b.timestamp;
        break;
      case 'channel':
        cmp = a.channel.localeCompare(b.channel);
        break;
      case 'amount':
        cmp = (a.priceWithTax ?? 0) - (b.priceWithTax ?? 0);
        break;
      case 'outcome':
        cmp = a.outcome.localeCompare(b.outcome);
        break;
      case 'saved':
        cmp = (a.savedAmount ?? 0) - (b.savedAmount ?? 0);
        break;
    }
    return sortAsc ? cmp : -cmp;
  });
}

function setupFilters(): void {
  const startEl = document.getElementById('filter-start') as HTMLInputElement;
  const endEl = document.getElementById('filter-end') as HTMLInputElement;
  const channelEl = document.getElementById('filter-channel') as HTMLSelectElement;
  const outcomeToggle = document.getElementById('outcome-toggle')!;

  // Default date range: last 30 days
  const today = new Date();
  const thirtyAgo = new Date(today);
  thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  startEl.value = toDateInputValue(thirtyAgo);
  endEl.value = toDateInputValue(today);

  startEl.addEventListener('change', () => applyFilters());
  endEl.addEventListener('change', () => applyFilters());
  channelEl.addEventListener('change', () => applyFilters());

  outcomeToggle.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.outcome-btn') as HTMLButtonElement | null;
    if (!btn) return;
    outcomeToggle.querySelectorAll('.outcome-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilters();
  });
}

function applyFilters(): void {
  const startEl = document.getElementById('filter-start') as HTMLInputElement;
  const endEl = document.getElementById('filter-end') as HTMLInputElement;
  const channelEl = document.getElementById('filter-channel') as HTMLSelectElement;
  const outcomeToggle = document.getElementById('outcome-toggle')!;
  const activeOutcome = outcomeToggle.querySelector('.outcome-btn.active') as HTMLButtonElement;
  const outcomeFilter = activeOutcome?.dataset.value ?? 'all';

  const startDate = startEl.value ? new Date(startEl.value + 'T00:00:00') : null;
  const endDate = endEl.value ? new Date(endEl.value + 'T23:59:59.999') : null;

  filteredEvents = allEvents.filter(event => {
    if (startDate && event.timestamp < startDate.getTime()) return false;
    if (endDate && event.timestamp > endDate.getTime()) return false;
    if (channelEl.value && event.channel !== channelEl.value) return false;
    if (outcomeFilter !== 'all' && event.outcome !== outcomeFilter) return false;
    return true;
  });

  updateChannelDropdown(channelEl);
  sortEvents();
  computeSummary();
  renderTable();
  updateEmptyStates();
}

// ─── Summary bar ────────────────────────────────────────────
function setMetricValue(metricId: string, value: string): void {
  const el = document.getElementById(metricId);
  if (!el) return;
  const valueEl = el.querySelector('.metric-value');
  if (valueEl) valueEl.textContent = value;
}

function computeSummary(): void {
  const proceeded = filteredEvents.filter(e => e.outcome === 'proceeded');
  const cancelled = filteredEvents.filter(e => e.outcome === 'cancelled');

  const totalSpent = Math.round(
    proceeded.reduce((sum, e) => sum + (e.priceWithTax ?? 0), 0) * 100
  ) / 100;

  const totalSaved = Math.round(
    cancelled.reduce((sum, e) => sum + (e.savedAmount ?? 0), 0) * 100
  ) / 100;

  const cancelRate = filteredEvents.length === 0
    ? 0
    : Math.round((cancelled.length / filteredEvents.length) * 1000) / 10;

  const eventCount = filteredEvents.length;

  const stepCounts: Record<number, number> = {};
  for (const e of cancelled) {
    if (e.cancelledAtStep !== undefined) {
      stepCounts[e.cancelledAtStep] = (stepCounts[e.cancelledAtStep] ?? 0) + 1;
    }
  }
  let topStep: number | null = null;
  let maxStepCount = 0;
  for (const [step, count] of Object.entries(stepCounts)) {
    const stepNum = Number(step);
    if (count > maxStepCount || (count === maxStepCount && topStep !== null && stepNum < topStep)) {
      maxStepCount = count;
      topStep = stepNum;
    }
  }

  const reasonCounts: Record<string, number> = {};
  for (const e of proceeded) {
    if (e.purchaseReason) {
      reasonCounts[e.purchaseReason] = (reasonCounts[e.purchaseReason] ?? 0) + 1;
    }
  }
  let topReason: string | null = null;
  let topReasonCount = 0;
  for (const [reason, count] of Object.entries(reasonCounts)) {
    if (count > topReasonCount) {
      topReasonCount = count;
      topReason = reason;
    }
  }

  setMetricValue('metric-spent', formatCurrency(totalSpent));
  setMetricValue('metric-saved', formatCurrency(totalSaved));
  setMetricValue('metric-cancel-rate', cancelRate.toFixed(1) + '%');
  setMetricValue('metric-count', String(eventCount));
  setMetricValue('metric-top-step', topStep !== null ? `Step ${topStep}` : '—');
  setMetricValue('metric-top-reason',
    topReason ? `${topReason} (${topReasonCount}x)` : '—'
  );
}

// ─── Table rendering ─────────────────────────────────────────
function makeDetailField(label: string, value: string): HTMLElement {
  const field = document.createElement('div');
  field.className = 'detail-field';

  const labelEl = document.createElement('span');
  labelEl.className = 'detail-field-label';
  labelEl.textContent = label;
  field.appendChild(labelEl);

  const valueEl = document.createElement('span');
  valueEl.className = 'detail-field-value';
  valueEl.textContent = value;
  field.appendChild(valueEl);

  return field;
}

function appendDetailRow(event: InterceptEvent, afterRow: HTMLTableRowElement): void {
  const detailTr = document.createElement('tr');
  detailTr.className = 'detail-row';

  const detailTd = document.createElement('td');
  detailTd.colSpan = 5;

  const panel = document.createElement('div');
  panel.className = 'detail-panel';

  if (event.purchaseType) {
    panel.appendChild(makeDetailField('Purchase Type', event.purchaseType));
  }
  if (event.rawPrice) {
    panel.appendChild(makeDetailField('Raw Price', event.rawPrice));
  }
  if (event.priceWithTax != null) {
    panel.appendChild(makeDetailField('Price with Tax', formatCurrency(event.priceWithTax)));
  }
  if (event.outcome === 'cancelled' && event.cancelledAtStep !== undefined) {
    panel.appendChild(makeDetailField('Cancelled at Step', `Step ${event.cancelledAtStep}`));
  }
  if (event.purchaseReason) {
    panel.appendChild(makeDetailField('Purchase Reason', event.purchaseReason));
  }

  detailTd.appendChild(panel);
  detailTr.appendChild(detailTd);
  afterRow.after(detailTr);
}

function toggleDetail(event: InterceptEvent, tr: HTMLTableRowElement): void {
  const tbody = document.getElementById('history-tbody')!;
  const existingDetail = tbody.querySelector('.detail-row');
  if (existingDetail) existingDetail.remove();

  if (expandedRowId === event.id) {
    expandedRowId = null;
    return;
  }

  expandedRowId = event.id;
  appendDetailRow(event, tr);
}

function renderTable(): void {
  const tbody = document.getElementById('history-tbody')!;
  tbody.replaceChildren();

  for (const event of filteredEvents) {
    const tr = document.createElement('tr');
    tr.dataset.eventId = event.id;

    const tdDate = document.createElement('td');
    tdDate.textContent = formatDate(event.timestamp);
    tr.appendChild(tdDate);

    const tdChannel = document.createElement('td');
    tdChannel.textContent = event.channel;
    tr.appendChild(tdChannel);

    const tdAmount = document.createElement('td');
    tdAmount.textContent = formatCurrency(event.priceWithTax);
    if (event.outcome === 'proceeded') {
      tdAmount.className = 'amount-proceeded';
    }
    tr.appendChild(tdAmount);

    const tdOutcome = document.createElement('td');
    tdOutcome.textContent = event.outcome === 'cancelled' ? 'Cancelled' : 'Proceeded';
    tdOutcome.className = event.outcome === 'cancelled' ? 'outcome-cancelled' : 'outcome-proceeded';
    tr.appendChild(tdOutcome);

    const tdSaved = document.createElement('td');
    if (event.outcome === 'cancelled' && event.savedAmount != null) {
      tdSaved.textContent = formatCurrency(event.savedAmount);
      tdSaved.className = 'saved-value';
    } else {
      tdSaved.textContent = '—';
    }
    tr.appendChild(tdSaved);

    tr.addEventListener('click', () => toggleDetail(event, tr));
    tbody.appendChild(tr);

    if (expandedRowId === event.id) {
      appendDetailRow(event, tr);
    }
  }
}

function setupSort(): void {
  const headers = document.querySelectorAll<HTMLTableCellElement>('.history-table th.sortable');

  headers.forEach(th => {
    th.addEventListener('click', () => {
      const column = th.dataset.sort as typeof sortColumn;
      if (sortColumn === column) {
        sortAsc = !sortAsc;
      } else {
        sortColumn = column;
        sortAsc = column === 'channel'; // alpha defaults ascending; everything else descending
      }

      headers.forEach(h => {
        h.classList.remove('active');
        const arrow = h.querySelector('.sort-arrow');
        if (arrow) arrow.textContent = '';
      });
      th.classList.add('active');
      const arrow = th.querySelector('.sort-arrow');
      if (arrow) arrow.textContent = sortAsc ? '▲' : '▼';

      sortEvents();
      renderTable();
    });
  });
}

// ─── Entry point ────────────────────────────────────────────
async function main(): Promise<void> {
  await initTheme();
  allEvents = await readInterceptEvents();

  setupFilters();
  setupSort();
  applyFilters();
}

document.addEventListener('DOMContentLoaded', () => { main(); });
