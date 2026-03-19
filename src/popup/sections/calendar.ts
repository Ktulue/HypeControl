import { InterceptEvent, UserSettings } from '../../shared/types';
import { readInterceptEvents } from '../../shared/interceptLogger';
import { pickMessage, ZERO_MESSAGES, GRASS_MESSAGES, WITHIN_LIMIT_MESSAGES, OVER_LIMIT_MESSAGES } from '../calendarMessages';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DaySummary {
  saved: number;      // sum of savedAmount from cancelled events
  spent: number;      // sum of priceWithTax from proceeded events
  hasEvents: boolean;
}

type Tier = 'zero' | 'grass' | 'within' | 'over' | 'empty';

// ─── Data Aggregation ────────────────────────────────────────────────────────

/** Aggregate InterceptEvents into per-day summaries keyed by YYYY-MM-DD */
function aggregateByDay(events: InterceptEvent[]): Map<string, DaySummary> {
  const map = new Map<string, DaySummary>();
  for (const e of events) {
    const d = new Date(e.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const entry = map.get(key) ?? { saved: 0, spent: 0, hasEvents: false };
    entry.hasEvents = true;
    if (e.outcome === 'cancelled') {
      entry.saved = Math.round((entry.saved + (e.savedAmount ?? 0)) * 100) / 100;
    } else {
      entry.spent = Math.round((entry.spent + (e.priceWithTax ?? 0)) * 100) / 100;
    }
    map.set(key, entry);
  }
  return map;
}

function getTier(summary: DaySummary | undefined, dailyCap: number | null, isFuture: boolean): Tier {
  if (isFuture) return 'empty';
  if (!summary || !summary.hasEvents) return 'grass'; // past day, no events = chill day
  if (summary.spent === 0) return 'zero'; // had intercepts, cancelled them all
  if (dailyCap !== null && summary.spent > dailyCap) return 'over';
  return 'within';
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_ABBREVS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function tierAriaDescription(tier: Tier, summary: DaySummary | undefined): string {
  if (tier === 'empty') return 'no activity';
  if (tier === 'grass') return '$0 spent, no purchase attempts';
  if (tier === 'zero') return '$0 spent, resisted temptation';
  if (!summary) return '';
  if (tier === 'over') return `$${summary.spent.toFixed(2)} spent, over limits`;
  return `$${summary.spent.toFixed(2)} spent, within limits`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface CalendarController {
  toggle(): void;
  destroy(): void;
}

export function initCalendar(
  container: HTMLElement,
  getSettings: () => Promise<UserSettings>,
): CalendarController {
  // Internal state
  let events: InterceptEvent[] = [];
  let dayMap: Map<string, DaySummary> = new Map();
  let dailyCap: number | null = null;
  let viewYear: number = new Date().getFullYear();
  let viewMonth: number = new Date().getMonth(); // 0-indexed
  let visible: boolean = false;
  let selectedKey: string | null = null;

  // Cached DOM refs that survive re-renders
  let calendarRoot: HTMLElement | null = null;
  let detailPanel: HTMLElement | null = null;
  let clickOutsideHandler: ((e: MouseEvent) => void) | null = null;

  // ─── Click-outside listener ──────────────────────────────────────────────

  function addClickOutsideListener(): void {
    clickOutsideHandler = (e: MouseEvent) => {
      const target = e.target as Node;
      const calBtn = document.getElementById('btn-calendar');
      if (
        !container.contains(target) &&
        !(calBtn && calBtn.contains(target))
      ) {
        hide();
      }
    };
    // Use setTimeout to avoid immediately closing on the same click that opens
    setTimeout(() => {
      document.addEventListener('click', clickOutsideHandler!);
    }, 0);
  }

  function removeClickOutsideListener(): void {
    if (clickOutsideHandler) {
      document.removeEventListener('click', clickOutsideHandler);
      clickOutsideHandler = null;
    }
  }

  // ─── Show / hide ─────────────────────────────────────────────────────────

  function show(): void {
    container.hidden = false;
    visible = true;
    addClickOutsideListener();
  }

  function hide(): void {
    container.hidden = true;
    visible = false;
    removeClickOutsideListener();
  }

  // ─── Detail panel update ─────────────────────────────────────────────────

  function updateDetail(dateKey: string, date: Date, summary: DaySummary, tier: Tier): void {
    if (!detailPanel) return;

    // Clear old content
    while (detailPanel.firstChild) {
      detailPanel.removeChild(detailPanel.firstChild);
    }

    const amountsDiv = document.createElement('div');
    amountsDiv.className = 'calendar-detail-amounts';

    const savedSpan = document.createElement('span');
    savedSpan.className = 'calendar-detail-saved';
    savedSpan.textContent = `Saved $${summary.saved.toFixed(2)}`;
    amountsDiv.appendChild(savedSpan);

    const spentSpan = document.createElement('span');
    spentSpan.className = 'calendar-detail-spent';
    spentSpan.textContent = `Spent $${summary.spent.toFixed(2)}`;
    amountsDiv.appendChild(spentSpan);

    detailPanel.appendChild(amountsDiv);

    const msgEl = document.createElement('p');
    msgEl.className = 'calendar-detail-message';

    let pool: readonly string[];
    if (tier === 'grass') {
      pool = GRASS_MESSAGES;
    } else if (tier === 'zero') {
      pool = ZERO_MESSAGES;
    } else if (tier === 'over') {
      pool = OVER_LIMIT_MESSAGES;
    } else {
      pool = WITHIN_LIMIT_MESSAGES;
    }

    const rawMsg = pickMessage(pool, date);
    msgEl.textContent = rawMsg.replace('$X', `$${summary.spent.toFixed(2)}`);

    detailPanel.appendChild(msgEl);
    detailPanel.hidden = false;

    // Highlight selected
    if (calendarRoot) {
      calendarRoot.querySelectorAll<HTMLElement>('.calendar-cell').forEach(cell => {
        cell.classList.toggle('selected', cell.dataset.dateKey === dateKey);
      });
    }
  }

  // ─── Boundary helpers ────────────────────────────────────────────────────

  function isCurrentMonth(year: number, month: number): boolean {
    const now = new Date();
    return year === now.getFullYear() && month === now.getMonth();
  }

  function isBeforeWindow(year: number, month: number): boolean {
    // The 90-day window cutoff date
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    // A month is entirely before the window if its last day is before the cutoff
    const lastDayOfMonth = new Date(year, month + 1, 0); // day 0 = last day of previous month
    return lastDayOfMonth < cutoff;
  }

  // ─── Grid renderer ───────────────────────────────────────────────────────

  function renderGrid(): void {
    // Clear container
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    selectedKey = null;
    detailPanel = null;
    calendarRoot = null;

    // Empty state check
    if (events.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'calendar-empty-state';
      emptyDiv.textContent =
        'No spending data yet \u2014 HypeControl will start tracking here once it intercepts a purchase.';
      container.appendChild(emptyDiv);
      return;
    }

    // ── Outer calendar wrapper ──
    const calWrap = document.createElement('div');
    calWrap.className = 'calendar';
    calendarRoot = calWrap;

    // ── Header ──
    const header = document.createElement('div');
    header.className = 'calendar-header';

    const btnPrev = document.createElement('button');
    btnPrev.type = 'button';
    btnPrev.className = 'calendar-nav';
    btnPrev.setAttribute('aria-label', 'Previous month');
    btnPrev.textContent = '\u2039'; // ‹
    const prevDisabled = isBeforeWindow(viewYear, viewMonth);
    btnPrev.disabled = prevDisabled;
    if (prevDisabled) btnPrev.setAttribute('aria-disabled', 'true');

    const heading = document.createElement('span');
    heading.textContent = `${MONTH_NAMES[viewMonth]} ${viewYear}`;

    const btnNext = document.createElement('button');
    btnNext.type = 'button';
    btnNext.className = 'calendar-nav';
    btnNext.setAttribute('aria-label', 'Next month');
    btnNext.textContent = '\u203A'; // ›
    const nextDisabled = isCurrentMonth(viewYear, viewMonth);
    btnNext.disabled = nextDisabled;
    if (nextDisabled) btnNext.setAttribute('aria-disabled', 'true');

    header.appendChild(btnPrev);
    header.appendChild(heading);
    header.appendChild(btnNext);
    calWrap.appendChild(header);

    // Navigation handlers
    btnPrev.addEventListener('click', () => {
      if (btnPrev.disabled) return;
      viewMonth -= 1;
      if (viewMonth < 0) {
        viewMonth = 11;
        viewYear -= 1;
      }
      renderGrid();
    });

    btnNext.addEventListener('click', () => {
      if (btnNext.disabled) return;
      viewMonth += 1;
      if (viewMonth > 11) {
        viewMonth = 0;
        viewYear += 1;
      }
      renderGrid();
    });

    // ── Day-of-week headers ──
    const grid = document.createElement('div');
    grid.className = 'calendar-grid';
    grid.setAttribute('role', 'grid');

    for (const abbrev of DAY_ABBREVS) {
      const dow = document.createElement('div');
      dow.className = 'calendar-dow';
      dow.setAttribute('aria-hidden', 'true');
      dow.textContent = abbrev;
      grid.appendChild(dow);
    }

    // ── Day cells ──
    const today = new Date();
    const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

    // First day of the displayed month (0=Sun … 6=Sat)
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    // Number of days in month
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    // Leading empty cells
    for (let i = 0; i < firstDayOfMonth; i++) {
      const empty = document.createElement('div');
      empty.className = 'calendar-cell tier-empty';
      empty.setAttribute('role', 'gridcell');
      empty.setAttribute('aria-hidden', 'true');
      grid.appendChild(empty);
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = formatDateKey(viewYear, viewMonth, day);
      const summary = dayMap.get(dateKey);
      const date = new Date(viewYear, viewMonth, day);
      const isFuture = date > today;
      const tier = getTier(summary, dailyCap, isFuture);

      const cell = document.createElement('div');
      cell.className = `calendar-cell tier-${tier}`;
      cell.setAttribute('role', 'gridcell');
      cell.dataset.dateKey = dateKey;

      const ariaDesc = tierAriaDescription(tier, summary);
      cell.setAttribute(
        'aria-label',
        `${MONTH_NAMES[viewMonth]} ${day}${ariaDesc ? ' \u2014 ' + ariaDesc : ''}`,
      );

      if (dateKey === todayKey) {
        cell.classList.add('today');
      }

      const dayNum = document.createElement('span');
      dayNum.textContent = String(day);
      cell.appendChild(dayNum);

      // Default: not keyboard-focusable; roving tabindex will promote one cell
      cell.setAttribute('tabindex', '-1');

      // All non-empty (non-future) cells are clickable
      if (tier !== 'empty') {
        cell.style.cursor = 'pointer';
        const capturedSummary = summary ?? { saved: 0, spent: 0, hasEvents: false };
        const capturedDate = date;
        const capturedKey = dateKey;
        const capturedTier = tier;

        cell.addEventListener('click', () => {
          selectedKey = capturedKey;
          updateDetail(capturedKey, capturedDate, capturedSummary, capturedTier);
        });
      }

      grid.appendChild(cell);
    }

    // ── Roving tabindex: promote initial focused cell ──
    // Prefer today's cell if visible, else first numbered cell.
    const allCells = Array.from(grid.querySelectorAll<HTMLElement>('.calendar-cell'));
    // Only real day cells (those with a data-date-key) participate in keyboard nav.
    const dayCells = allCells.filter(c => c.dataset.dateKey !== undefined);
    const todayCell = dayCells.find(c => c.dataset.dateKey === todayKey);
    const initialCell = todayCell ?? dayCells[0] ?? null;
    if (initialCell) {
      initialCell.setAttribute('tabindex', '0');
    }

    // ── Keyboard navigation handler ──
    grid.addEventListener('keydown', (e: KeyboardEvent) => {
      const key = e.key;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(key)) {
        return;
      }

      // Find which day cell currently holds tabindex="0"
      const cells = Array.from(grid.querySelectorAll<HTMLElement>('.calendar-cell'))
        .filter(c => c.dataset.dateKey !== undefined);

      if (cells.length === 0) return;

      const currentIndex = cells.findIndex(c => c.getAttribute('tabindex') === '0');
      if (currentIndex === -1) return;

      if (key === 'Enter' || key === ' ') {
        e.preventDefault();
        cells[currentIndex].click();
        return;
      }

      e.preventDefault();

      let nextIndex = currentIndex;

      if (key === 'ArrowLeft') {
        // Search backward for a real cell
        for (let i = currentIndex - 1; i >= 0; i--) {
          nextIndex = i;
          break;
        }
      } else if (key === 'ArrowRight') {
        for (let i = currentIndex + 1; i < cells.length; i++) {
          nextIndex = i;
          break;
        }
      } else if (key === 'ArrowUp') {
        // Move back 7 positions (one week)
        const target = currentIndex - 7;
        if (target >= 0) nextIndex = target;
      } else if (key === 'ArrowDown') {
        // Move forward 7 positions (one week)
        const target = currentIndex + 7;
        if (target < cells.length) nextIndex = target;
      }

      if (nextIndex !== currentIndex) {
        cells[currentIndex].setAttribute('tabindex', '-1');
        cells[nextIndex].setAttribute('tabindex', '0');
        cells[nextIndex].focus();
      }
    });

    calWrap.appendChild(grid);

    // ── Detail panel ──
    const detail = document.createElement('div');
    detail.className = 'calendar-detail';
    detail.hidden = true;
    detailPanel = detail;
    calWrap.appendChild(detail);

    container.appendChild(calWrap);
  }

  // ─── Toggle (public) ─────────────────────────────────────────────────────

  async function toggle(): Promise<void> {
    if (visible) {
      hide();
      return;
    }

    // Load fresh data on every open
    events = await readInterceptEvents();
    dayMap = aggregateByDay(events);

    const settings = await getSettings();
    dailyCap = settings.dailyCap.enabled ? settings.dailyCap.amount : null;

    // Reset view to current month
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    selectedKey = null;

    renderGrid();
    show();
  }

  // ─── Destroy (public) ────────────────────────────────────────────────────

  function destroy(): void {
    removeClickOutsideListener();
  }

  // Initialize: make sure container is hidden at start
  container.hidden = true;

  return { toggle, destroy };
}
