/**
 * tourPanel.ts — Phase 2 onboarding tour
 *
 * Injects a non-blocking slide-out panel on Twitch pages when
 * hcOnboardingPhase2Pending is true. Two steps:
 *   Step 1: Highlight visible interceptable buttons
 *   Step 2: Fire triggerDemoOverlay() so user experiences the real overlay
 */

import { ONBOARDING_KEYS } from '../shared/types';
import { triggerDemoOverlay } from './interceptor';
import { log } from '../shared/logger';

/** Selectors used by detector.ts — kept in sync manually */
const INTERCEPTABLE_SELECTORS = [
  '[data-a-target="gift-button"]',
  '[data-a-target="gift-sub-confirm-button"]',
  'button[data-a-target="top-nav-get-bits-button"]',
  'button[aria-label="Bits"]',
  'button[data-a-target^="bits-purchase-button"]',
];

interface HighlightedButton {
  el: HTMLElement;
  ring: HTMLElement;
  label: HTMLElement;
}

let panelEl: HTMLElement | null = null;
let highlightedButtons: HighlightedButton[] = [];
let completionTimeout: ReturnType<typeof setTimeout> | null = null;

/** Mark onboarding as complete in storage */
async function markComplete(): Promise<void> {
  await chrome.storage.local.set({
    [ONBOARDING_KEYS.phase2Pending]: false,
    [ONBOARDING_KEYS.complete]: true,
  });
  log('Onboarding Phase 2 complete');
}

/** Remove all highlight rings from Twitch buttons */
function clearHighlights(): void {
  highlightedButtons.forEach(({ ring, label }) => {
    ring.remove();
    label.remove();
  });
  highlightedButtons = [];
}

/** Find interceptable buttons currently visible in the viewport */
function findVisibleInterceptableButtons(): HTMLElement[] {
  const found: HTMLElement[] = [];
  for (const selector of INTERCEPTABLE_SELECTORS) {
    document.querySelectorAll<HTMLElement>(selector).forEach(el => {
      const rect = el.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0 &&
        rect.top >= 0 && rect.bottom <= window.innerHeight;
      if (isVisible && !found.includes(el)) {
        found.push(el);
      }
    });
  }
  return found;
}

/** Get a human-readable label for a highlighted button */
function getLabelForButton(el: HTMLElement): string {
  const dataTarget = el.getAttribute('data-a-target') || '';
  const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();

  if (dataTarget.includes('gift')) return 'Gift Sub';
  if (dataTarget.includes('bits') || ariaLabel === 'bits') return 'Get Bits';

  // Bits purchase tier buttons
  if (dataTarget.startsWith('bits-purchase-button')) {
    const match = dataTarget.match(/bits-purchase-button-(\d+)/);
    return match ? `Buy ${Number(match[1]).toLocaleString()} Bits` : 'Get Bits';
  }

  return 'Purchase Button';
}

/** Apply highlight ring and floating label to a button */
function highlightButton(el: HTMLElement): HighlightedButton {
  const rect = el.getBoundingClientRect();

  const ring = document.createElement('div');
  ring.className = 'hc-tour-highlight-ring';
  ring.style.cssText = `
    position: fixed;
    top: ${rect.top - 4}px;
    left: ${rect.left - 4}px;
    width: ${rect.width + 8}px;
    height: ${rect.height + 8}px;
    pointer-events: none;
    z-index: 999997;
    border-radius: 6px;
  `;

  const label = document.createElement('div');
  label.className = 'hc-tour-highlight-label';
  label.textContent = getLabelForButton(el);
  label.style.cssText = `
    position: fixed;
    top: ${rect.top - 28}px;
    left: ${rect.left}px;
    pointer-events: none;
    z-index: 999998;
  `;

  document.body.appendChild(ring);
  document.body.appendChild(label);

  return { el, ring, label };
}

/** Render Step 2 content into the panel */
function renderStep2(panel: HTMLElement): void {
  const body = panel.querySelector('.hc-tour-body')!;
  body.innerHTML = `
    <p class="hc-tour-heading">Here's what happens when you click one</p>
    <p class="hc-tour-sub">No real purchase will be made.</p>
    <button class="hc-tour-btn-primary" id="hc-tour-try-btn">Try it now</button>
  `;

  panel.querySelector('#hc-tour-try-btn')?.addEventListener('click', async () => {
    // Collapse panel to tab while overlay is active
    panel.classList.add('hc-tour-panel--collapsed');

    try {
      await triggerDemoOverlay();
    } finally {
      // Re-expand after overlay is dismissed (triggerDemoOverlay resolves after user interacts)
      panel.classList.remove('hc-tour-panel--collapsed');
      showCompletion(panel);
    }
  });
}

/** Show completion message and auto-dismiss */
function showCompletion(panel: HTMLElement): void {
  const body = panel.querySelector('.hc-tour-body')!;
  body.innerHTML = `<p class="hc-tour-complete">That's it. You're protected. 🛡️</p>`;

  completionTimeout = setTimeout(async () => {
    await markComplete();
    panel.remove();
    panelEl = null;
  }, 3000);
}

/** Build and inject the tour panel into the page */
function createPanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.id = 'hc-tour-panel';
  panel.className = 'hc-tour-panel';
  panel.setAttribute('role', 'complementary');
  panel.setAttribute('aria-label', 'Hype Control onboarding tour');

  panel.innerHTML = `
    <div class="hc-tour-header">
      <img class="hc-tour-icon" src="${chrome.runtime.getURL('assets/icons/ChromeWebStore/HC_icon_48px.png')}" width="20" height="20" alt="">
      <span class="hc-tour-title">Hype Control</span>
      <button class="hc-tour-close" id="hc-tour-close" aria-label="Dismiss tour">✕</button>
    </div>
    <div class="hc-tour-body">
      <!-- Content injected per step -->
    </div>
    <!-- Collapsed tab state -->
    <div class="hc-tour-tab">
      <img src="${chrome.runtime.getURL('assets/icons/ChromeWebStore/HC_icon_48px.png')}" width="16" height="16" alt="HC">
      <span>…</span>
    </div>
  `;

  // Dismiss / close
  panel.querySelector('#hc-tour-close')?.addEventListener('click', async () => {
    if (completionTimeout) clearTimeout(completionTimeout);
    clearHighlights();
    await markComplete();
    panel.remove();
    panelEl = null;
  });

  return panel;
}

/** Run Step 1: find and highlight buttons, show panel */
function runStep1(panel: HTMLElement): void {
  const buttons = findVisibleInterceptableButtons();
  const body = panel.querySelector('.hc-tour-body')!;

  if (buttons.length > 0) {
    // Highlight each visible button
    buttons.forEach(btn => {
      highlightedButtons.push(highlightButton(btn));
    });

    body.innerHTML = `
      <p class="hc-tour-heading">Here's what I watch for you</p>
      <p class="hc-tour-sub">${buttons.length} interceptable button${buttons.length !== 1 ? 's' : ''} on this page</p>
      <button class="hc-tour-btn-primary" id="hc-tour-next-btn">Show me what happens →</button>
    `;

    panel.querySelector('#hc-tour-next-btn')?.addEventListener('click', () => {
      clearHighlights();
      renderStep2(panel);
    });
  } else {
    // No buttons visible — skip to step 2
    body.innerHTML = `
      <p class="hc-tour-heading">Navigate to a channel to see what I protect</p>
      <p class="hc-tour-sub">Or try a demo now.</p>
      <button class="hc-tour-btn-primary" id="hc-tour-next-btn">Show me anyway →</button>
    `;

    panel.querySelector('#hc-tour-next-btn')?.addEventListener('click', () => {
      renderStep2(panel);
    });
  }
}

/**
 * Initialize the Phase 2 onboarding tour panel.
 * Call from index.ts after DOM readiness check passes.
 */
export function initTourPanel(): void {
  if (panelEl) return; // Already initialized

  panelEl = createPanel();
  document.body.appendChild(panelEl);
  runStep1(panelEl);
  log('Onboarding Phase 2 tour panel initialized');
}
