/**
 * Playwright extension test — Quick Wins Bundle (v0.4.5)
 * Tests: Delay Timer UI, Comparison Scope UI, Whitelist Quick-Add, Logs page
 *
 * Run: node test-ext.js
 */

const { chromium } = require('playwright');
const path = require('path');

const DIST = path.join(__dirname, 'dist');

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const INFO = '\x1b[36mℹ\x1b[0m';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ${PASS} ${label}`);
    passed++;
  } else {
    console.log(`  ${FAIL} ${label}`);
    failed++;
  }
}

async function getExtensionId(context) {
  await new Promise(r => setTimeout(r, 800));
  // Try service workers first
  const workers = context.serviceWorkers();
  for (const w of workers) {
    const m = w.url().match(/chrome-extension:\/\/([^/]+)\//);
    if (m) return m[1];
  }
  // Try background pages
  const pages = context.backgroundPages();
  for (const p of pages) {
    const m = p.url().match(/chrome-extension:\/\/([^/]+)\//);
    if (m) return m[1];
  }
  // Try chrome://extensions page
  const page = await context.newPage();
  await page.goto('chrome://extensions/');
  await page.waitForTimeout(1000);
  // Enable developer mode to see IDs
  try {
    await page.click('extensions-manager >>> #devMode', { timeout: 2000 });
    await page.waitForTimeout(500);
  } catch {}
  const id = await page.evaluate(() => {
    const root = document.querySelector('extensions-manager')?.shadowRoot;
    if (!root) return null;
    const itemList = root.querySelector('extensions-item-list')?.shadowRoot;
    if (!itemList) return null;
    const items = itemList.querySelectorAll('extensions-item');
    for (const item of items) {
      const name = item.shadowRoot?.querySelector('#name')?.textContent || '';
      if (name.toLowerCase().includes('hype')) {
        return item.id;
      }
    }
    return null;
  }).catch(() => null);
  await page.close();
  if (id) return id;
  throw new Error('Could not find extension ID');
}

async function run() {
  console.log('\n\x1b[1mHype Control v0.4.5 — Extension Tests\x1b[0m');
  console.log('='.repeat(45));

  const userDataDir = path.join(__dirname, '.test-profile');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${DIST}`,
      `--load-extension=${DIST}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
    viewport: { width: 1280, height: 900 },
  });

  let extId;
  try {
    extId = await getExtensionId(context);
    console.log(`\n${INFO} Extension ID: ${extId}\n`);
  } catch (e) {
    console.error('Could not get extension ID:', e.message);
    await context.close();
    process.exit(1);
  }

  const optionsUrl = `chrome-extension://${extId}/options.html`;
  const page = await context.newPage();
  await page.goto(optionsUrl);
  await page.waitForTimeout(1000);

  // ── [1] Page loads ──────────────────────────────────────────────────
  console.log('\x1b[1m[1] Options Page Load\x1b[0m');
  const title = await page.title();
  assert(title === 'Hype Control Settings', `Title: "${title}"`);

  const bodyText = await page.textContent('body');
  assert(bodyText.includes('Delay Timer'), 'Delay Timer section present');
  assert(bodyText.includes('Comparison Items'), 'Comparison Items section present');
  assert(bodyText.includes('Channel Whitelist'), 'Channel Whitelist section present');

  // ── [2] Delay Timer ──────────────────────────────────────────────────
  console.log('\n\x1b[1m[2] Delay Timer\x1b[0m');

  const subsection = await page.$('#delay-timer-subsection');
  assert(!!subsection, 'Subsection element exists');

  const initialDisplay = await page.$eval('#delay-timer-subsection', el => el.style.display);
  assert(initialDisplay === 'none', `Hidden on load (display="${initialDisplay}")`);

  // Enable
  await page.click('label[for="delay-timer-enabled"]');
  await page.waitForTimeout(300);
  const enabledDisplay = await page.$eval('#delay-timer-subsection', el => el.style.display);
  assert(enabledDisplay === 'block', `Shows after enabling (display="${enabledDisplay}")`);

  const durationBtns = await page.$$('#delay-timer-group .intensity-btn');
  assert(durationBtns.length === 4, `4 duration buttons (got ${durationBtns.length})`);

  const expectedDelays = ['5', '10', '30', '60'];
  const actualDelays = await page.$$eval('#delay-timer-group .intensity-btn', btns =>
    btns.map(b => b.dataset.delay)
  );
  assert(JSON.stringify(actualDelays) === JSON.stringify(expectedDelays),
    `Button values: ${actualDelays.join(', ')}`);

  // Default active = 10
  const defaultActive = await page.$eval(
    '#delay-timer-group .intensity-btn[aria-pressed="true"]',
    el => el.dataset.delay
  ).catch(() => 'none');
  assert(defaultActive === '10', `Default selected: ${defaultActive}s`);

  // Click 30s
  await page.click('#delay-timer-group .intensity-btn[data-delay="30"]');
  await page.waitForTimeout(200);
  const active30 = await page.$eval(
    '#delay-timer-group .intensity-btn[data-delay="30"]',
    el => el.getAttribute('aria-pressed')
  );
  assert(active30 === 'true', '30s activates on click');

  const deselected10 = await page.$eval(
    '#delay-timer-group .intensity-btn[data-delay="10"]',
    el => el.getAttribute('aria-pressed')
  );
  assert(deselected10 === 'false', '10s deselects');

  // Disable
  await page.click('label[for="delay-timer-enabled"]');
  await page.waitForTimeout(300);
  const hiddenAgain = await page.$eval('#delay-timer-subsection', el => el.style.display);
  assert(hiddenAgain === 'none', `Hides on disable (display="${hiddenAgain}")`);

  // ── [3] Comparison Scope ─────────────────────────────────────────────
  console.log('\n\x1b[1m[3] Comparison Item Scope\x1b[0m');

  const itemCount = await page.$$eval('#comparison-items-list .comparison-item', els => els.length).catch(() => 0);
  console.log(`  ${INFO} ${itemCount} comparison item(s) in storage`);

  if (itemCount > 0) {
    const scopeGroups = await page.$$('.scope-group');
    assert(scopeGroups.length > 0, `Scope groups rendered (${scopeGroups.length})`);

    const firstBothBtn = await page.$('.scope-group .scope-btn[data-scope="both"]');
    assert(!!firstBothBtn, 'Both button exists');
    const bothPressed = await firstBothBtn.getAttribute('aria-pressed');
    assert(bothPressed === 'true', `Default scope is "Both" (aria-pressed="${bothPressed}")`);

    // Click Nudge
    await page.click('.scope-group:first-of-type .scope-btn[data-scope="nudge"]');
    await page.waitForTimeout(200);
    const nudgeActive = await page.$eval(
      '.scope-group:first-of-type .scope-btn[data-scope="nudge"]',
      el => el.getAttribute('aria-pressed')
    );
    assert(nudgeActive === 'true', 'Nudge activates');
    const bothInactive = await page.$eval(
      '.scope-group:first-of-type .scope-btn[data-scope="both"]',
      el => el.getAttribute('aria-pressed')
    );
    assert(bothInactive === 'false', '"Both" deselects');
  } else {
    // Verify scope CSS exists at least
    const hasScopeCSS = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          if (rules.some(r => r.selectorText && r.selectorText.includes('scope-btn'))) return true;
        } catch {}
      }
      return false;
    });
    assert(hasScopeCSS, 'scope-btn CSS rules present');
    console.log(`  ${INFO} No items in storage — testing Add Custom Item instead`);
    await page.click('#btn-add-item');
    await page.waitForTimeout(300);
    const formVisible = await page.evaluate(() => {
      const f = document.getElementById('add-item-form');
      return f ? f.classList.contains('visible') : false;
    });
    assert(formVisible, 'Add item form visible after clicking "+ Add Custom Item"');
    // Close it
    await page.click('#btn-cancel-item').catch(() => {});
    await page.waitForTimeout(200);
  }

  // ── [4] Whitelist section ────────────────────────────────────────────
  console.log('\n\x1b[1m[4] Channel Whitelist UI\x1b[0m');
  const wlInput = await page.$('#whitelist-username-input');
  assert(!!wlInput, 'Whitelist input exists');
  const addChannelBtn = await page.$('button:has-text("Add Channel")');
  assert(!!addChannelBtn, '"Add Channel" button exists');

  // ── [5] Logs page ────────────────────────────────────────────────────
  console.log('\n\x1b[1m[5] Logs Page\x1b[0m');
  const logsUrl = `chrome-extension://${extId}/logs.html`;
  await page.goto(logsUrl);
  await page.waitForTimeout(600);

  assert(await page.title() === 'Hype Control Logs', 'Logs page title correct');

  const extTab = await page.$('.tab-btn[data-tab="extension"]');
  const settingsTab = await page.$('.tab-btn[data-tab="settings"]');
  assert(!!extTab, 'Extension Log tab exists');
  assert(!!settingsTab, 'Settings Log tab exists');

  const extTabActive = await extTab.getAttribute('class');
  assert(extTabActive.includes('active'), 'Extension Log tab active by default');

  await settingsTab.click();
  await page.waitForTimeout(300);
  const settingsActive = await settingsTab.getAttribute('class');
  assert(settingsActive.includes('active'), 'Settings tab activates on click');

  const refreshBtn = await page.$('#btn-refresh');
  const clearBtn = await page.$('#btn-clear');
  assert(!!refreshBtn, 'Refresh button exists');
  assert(!!clearBtn, 'Clear button exists');

  const container = await page.$('#log-container');
  assert(!!container, 'Log container exists');
  const containerText = await container.textContent();
  assert(containerText.trim().length > 0, `Log container has content: "${containerText.trim().substring(0, 40)}..."`);

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(45));
  const total = passed + failed;
  if (failed === 0) {
    console.log(`\x1b[32m✓ All ${total} tests passed\x1b[0m\n`);
  } else {
    console.log(`\x1b[33m${passed} passed, \x1b[31m${failed} failed\x1b[0m (${total} total)\n`);
  }

  await page.waitForTimeout(1000);
  await context.close();

  // Clean up test profile to avoid stale state next run
  const fs = require('fs');
  try { fs.rmSync(path.join(__dirname, '.test-profile'), { recursive: true, force: true }); } catch {}

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(async err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
