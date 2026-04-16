/**
 * Hype Control - Content Script Entry Point
 *
 * This script runs on all Twitch pages and sets up:
 * 1. Purchase detection via MutationObserver
 * 2. Click interception for purchase buttons
 * 3. Overlay display for confirmation
 */

import { setupInterceptor, triggerDemoOverlay } from './interceptor';
import { setupChatInterceptor } from './chatCommandInterceptor';
import { setupModalObserver, getCurrentChannel } from './detector';
import { checkAndUpdateLiveStatus, updateStreamingBadge } from './streamingMode';
import { initThemeManager } from './themeManager';
import { log, debug, error, setVersion, loadLogs } from '../shared/logger';
import { migrateSettings, DEFAULT_SETTINGS, ONBOARDING_KEYS } from '../shared/types';
import './styles.css';
import { initTourPanel } from './tourPanel';

const SETTINGS_KEY = 'hcSettings';

async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(SETTINGS_KEY);
    return migrateSettings(result[SETTINGS_KEY] || {});
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Current extension version */
const VERSION = '0.4.0';

// Set version immediately so logger can check for updates
setVersion(VERSION);
// Initialize logs (will clear if version changed)
loadLogs();

/**
 * Shows a small badge to confirm the extension is loaded
 */
function showLoadedIndicator(): void {
  const badge = document.createElement('div');
  badge.id = 'hc-loaded-badge';
  badge.innerHTML = '🛡️ HC Active';
  badge.style.cssText = `
    position: fixed;
    bottom: 10px;
    right: 10px;
    background: #9146ff;
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
    z-index: 999998;
    font-family: sans-serif;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    transition: opacity 0.3s;
  `;
  document.body.appendChild(badge);

  // Fade out after 3 seconds
  setTimeout(() => {
    badge.style.opacity = '0';
    setTimeout(() => badge.remove(), 300);
  }, 3000);
}

/**
 * Scans page for interceptable buttons and logs findings
 */
function scanForButtons(): void {
  // Selectors for interceptable elements
  const selectors = [
    '[data-a-target="gift-button"]',
    '[data-a-target="gift-sub-confirm-button"]',
    '[data-a-target="top-nav-get-bits-button"]',
    '[data-a-target^="bits-purchase-button"]',
  ];

  // Keywords we intercept (gifts, bits, and subscription management)
  const interceptKeywords = ['gift sub', 'gift a sub', 'gift subs', 'gift turbo', 'community gift', 'get bits', 'buy bits', 'manage your sub', 'manage sub'];

  log('=== Scanning for interceptable buttons (gifts & bits) ===');

  // Check specific selectors
  selectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        log(`Found ${elements.length} element(s) matching: ${selector}`);
        elements.forEach((el, i) => {
          const text = (el.textContent || '').trim().substring(0, 60);
          log(`  [${i}] INTERCEPTABLE: "${text}"`, el);
        });
      }
    } catch (e) {
      debug(`Selector error for ${selector}:`, e);
    }
  });

  // Also scan all buttons for intercept keywords
  const allButtons = document.querySelectorAll('button');
  log(`Total buttons on page: ${allButtons.length}`);

  let interceptCount = 0;
  allButtons.forEach(btn => {
    // Get the specific label text (not all nested content)
    const labelEl = btn.querySelector('[data-a-target="tw-core-button-label-text"]');
    const labelText = labelEl ? (labelEl.textContent || '').toLowerCase() : '';
    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
    const dataTarget = (btn.getAttribute('data-a-target') || '').toLowerCase();

    const hasKeyword = interceptKeywords.some(kw => labelText.includes(kw) || ariaLabel.includes(kw));
    const hasDataTarget = dataTarget.includes('gift') || dataTarget === 'top-nav-get-bits-button';

    if (hasKeyword || hasDataTarget) {
      interceptCount++;
      log('Found interceptable button:', {
        labelText: labelText.substring(0, 60) || '(no label)',
        ariaLabel: btn.getAttribute('aria-label'),
        dataTarget: btn.getAttribute('data-a-target'),
        element: btn
      });
    }
  });

  log(`=== Scan complete: ${interceptCount} interceptable button(s) found ===`);
}

/**
 * Checks if the Phase 2 onboarding tour should run on this page load.
 * Waits for a known stable Twitch selector before injecting.
 * Times out silently after 10 seconds if selector never appears.
 */
async function maybeInitTourPanel(): Promise<void> {
  try {
    const state = await chrome.storage.local.get(ONBOARDING_KEYS.phase2Pending);
    if (!state[ONBOARDING_KEYS.phase2Pending]) return;

    // Wait for a stable Twitch selector (same strategy as detector.ts uses)
    // NOTE: This selector targets the top-nav avatar present for logged-in users.
    // Logged-out users will not have this element, causing the tour to silently
    // skip on that page load and retry on the next navigation. This is acceptable —
    // HypeControl only intercepts purchases, which require a logged-in Twitch account.
    const STABLE_SELECTOR = '[data-a-target="top-nav-avatar"]';
    const TIMEOUT_MS = 10_000;
    const POLL_MS = 300;

    await new Promise<void>((resolve, reject) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (document.querySelector(STABLE_SELECTOR)) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - start > TIMEOUT_MS) {
          clearInterval(interval);
          reject(new Error('Twitch selector timeout'));
        }
      }, POLL_MS);
    });

    initTourPanel();
  } catch (e) {
    // Timeout or storage error — skip silently, retry on next navigation
    debug('Tour panel init skipped:', e);
  }
}

// Extension initialization
function init(): void {
  try {
    log('Hype Control initializing...');
    log('URL:', window.location.href);
    log('Current channel:', getCurrentChannel());

    // Show visual confirmation
    showLoadedIndicator();

    // Initialize theme detection
    initThemeManager();

    // Set up the click interceptor
    setupInterceptor();
    log('Click interceptor active');

    // Set up chat command interceptor (/gift, /subscribe)
    setupChatInterceptor();
    log('Chat command interceptor active');

    // Phase 2 onboarding tour (fires on first Twitch visit after install)
    maybeInitTourPanel();

    // Start streaming mode polling (every 30s)
    const startStreamingPoller = async () => {
      const settings = await loadSettings();
      await checkAndUpdateLiveStatus(settings);
    };
    startStreamingPoller();
    setInterval(startStreamingPoller, 30000);

    // Refresh streaming badge every 30s so manual-override countdown stays current
    // off-own-channel (checkAndUpdateLiveStatus only runs when on own channel).
    setInterval(async () => {
      const settings = await loadSettings();
      await updateStreamingBadge(settings);
    }, 30000);

    // Run once immediately so the badge appears without waiting 30s
    (async () => {
      const settings = await loadSettings();
      await updateStreamingBadge(settings);
    })();

    // Set up modal observer for dynamically loaded content
    setupModalObserver((modal) => {
      log('New modal detected:', modal);
    });

    // Initial scan for buttons
    setTimeout(() => {
      scanForButtons();
    }, 2000);

    log('Extension active and watching for purchases');
    log('Open DevTools Console to see debug messages (filter by [HC])');
  } catch (err) {
    error('Failed to initialize:', err);
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Re-initialize on SPA navigation (Twitch is a single-page app)
let lastUrl = location.href;
const urlObserver = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    log('URL changed to:', location.href);
    log('Current channel:', getCurrentChannel());

    // Re-scan for buttons after navigation
    setTimeout(() => {
      scanForButtons();
    }, 2000);
  }
});

urlObserver.observe(document.body, {
  childList: true,
  subtree: true,
});

// Expose debug functions to window for console testing
declare global {
  interface Window {
    HC: {
      testOverlay: () => void;
      scanButtons: () => void;
      version: string;
    };
  }
}

/**
 * Test function to show overlay without clicking a button
 * Call from console: HC.testOverlay()
 */
function testOverlay(): void {
  log('Testing overlay display via triggerDemoOverlay()...');
  triggerDemoOverlay().catch((e) => log('testOverlay error:', e));
}

// Expose to window
window.HC = {
  testOverlay,
  scanButtons: scanForButtons,
  version: VERSION,
};

log('Debug functions available: HC.testOverlay(), HC.scanButtons()');
