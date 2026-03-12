# Settings UI Consolidation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate all HypeControl settings into a single 500×580px popup with a right-side scroll-spy nav and a pending-state save model, retiring the options page.

**Architecture:** A full rebuild of `popup.html/css/ts` into a scrollable 6-section page (Stats · Friction · Comparisons · Limits · Channels · Settings) with a sticky header/footer and a 110px right-side nav column. Each section is controlled by a dedicated TypeScript module. All form inputs write to an in-memory `pendingState` object; the footer Save button persists to `chrome.storage.sync`. The options page is retired.

**Tech Stack:** TypeScript, webpack (MiniCssExtractPlugin + CopyPlugin), chrome.storage.sync/local, IntersectionObserver, HTML5 drag-and-drop, Jest + ts-jest (pendingState unit tests only)

---

## Chunk 1: Foundation

### Task 1: Create feature branch

**Files:**
- No file changes — branch creation only

- [ ] **Step 1: Create and switch to feature branch**

```bash
git checkout -b feat/settings-ui-consolidation
```

Expected: `Switched to a new branch 'feat/settings-ui-consolidation'`

---

### Task 2: Add Jest + ts-jest test infrastructure

**Files:**
- Modify: `package.json`
- Create: `jest.config.js`
- Create: `tests/__mocks__/styleMock.js`
- Create: `tsconfig.test.json`

- [ ] **Step 1: Install jest dependencies**

```bash
npm install --save-dev jest ts-jest @types/jest
```

Expected: Packages added to `node_modules`, `package.json` devDependencies updated.

- [ ] **Step 2: Add test script to package.json**

In `package.json`, add `"test": "jest"` to `scripts` and add the three new devDependencies. Final `scripts` block:

```json
"scripts": {
  "build": "webpack --mode production",
  "dev": "webpack --mode development --watch",
  "clean": "rimraf dist",
  "postinstall": "npm run build",
  "test": "jest"
}
```

- [ ] **Step 3: Create jest.config.js**

```js
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleNameMapper: {
    '\\.css$': '<rootDir>/tests/__mocks__/styleMock.js',
  },
};
```

- [ ] **Step 4: Create CSS mock**

```js
// tests/__mocks__/styleMock.js
module.exports = {};
```

- [ ] **Step 5: Create tsconfig.test.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "esModuleInterop": true
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

Update `jest.config.js` to reference it:

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleNameMapper: {
    '\\.css$': '<rootDir>/tests/__mocks__/styleMock.js',
  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
    },
  },
};
```

- [ ] **Step 6: Verify jest runs (no tests yet)**

```bash
npm test -- --passWithNoTests
```

Expected: `Test Suites: 0 passed` — no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json jest.config.js tests/__mocks__/styleMock.js tsconfig.test.json
git commit -m "chore: add jest + ts-jest test infrastructure"
```

---

### Task 3: TDD — pendingState.ts

**Files:**
- Create: `tests/popup/pendingState.test.ts`
- Create: `src/popup/pendingState.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/popup/pendingState.test.ts
import { DEFAULT_SETTINGS } from '../../src/shared/types';

describe('pendingState', () => {
  let mod: typeof import('../../src/popup/pendingState');

  beforeEach(async () => {
    jest.resetModules();
    mod = await import('../../src/popup/pendingState');
  });

  test('getPending throws before initPending', () => {
    expect(() => mod.getPending()).toThrow('pendingState not initialized');
  });

  test('getPending returns a copy of initialized settings', () => {
    mod.initPending({ ...DEFAULT_SETTINGS });
    const p = mod.getPending();
    expect(p.frictionIntensity).toBe('medium');
  });

  test('setPendingField updates the pending copy', () => {
    mod.initPending({ ...DEFAULT_SETTINGS });
    mod.setPendingField('frictionIntensity', 'high');
    expect(mod.getPending().frictionIntensity).toBe('high');
  });

  test('setPendingField does not mutate the original object', () => {
    const original = { ...DEFAULT_SETTINGS };
    mod.initPending(original);
    mod.setPendingField('hourlyRate', 99);
    expect(original.hourlyRate).toBe(35);
  });

  test('resetPending restores to new base', () => {
    mod.initPending({ ...DEFAULT_SETTINGS });
    mod.setPendingField('frictionIntensity', 'extreme');
    mod.resetPending({ ...DEFAULT_SETTINGS });
    expect(mod.getPending().frictionIntensity).toBe('medium');
  });

  test('isDirty returns false when nothing changed', () => {
    const base = { ...DEFAULT_SETTINGS, comparisonItems: [...DEFAULT_SETTINGS.comparisonItems] };
    mod.initPending(base);
    expect(mod.isDirty(base)).toBe(false);
  });

  test('isDirty returns true after a field change', () => {
    const base = { ...DEFAULT_SETTINGS, comparisonItems: [...DEFAULT_SETTINGS.comparisonItems] };
    mod.initPending(base);
    mod.setPendingField('hourlyRate', 99);
    expect(mod.isDirty(base)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test
```

Expected: 7 failures — module not found or similar.

- [ ] **Step 3: Create src/popup/pendingState.ts**

```typescript
import type { UserSettings } from '../shared/types';

let pending: UserSettings | null = null;

export function initPending(settings: UserSettings): void {
  pending = { ...settings, comparisonItems: [...settings.comparisonItems] };
}

export function getPending(): UserSettings {
  if (!pending) throw new Error('pendingState not initialized');
  return pending;
}

export function setPendingField<K extends keyof UserSettings>(
  key: K,
  value: UserSettings[K]
): void {
  if (!pending) throw new Error('pendingState not initialized');
  pending = { ...pending, [key]: value };
}

export function resetPending(settings: UserSettings): void {
  initPending(settings);
}

export function isDirty(original: UserSettings): boolean {
  if (!pending) return false;
  return JSON.stringify(pending) !== JSON.stringify(original);
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test
```

Expected: `Tests: 7 passed, 7 total`

- [ ] **Step 5: Commit**

```bash
git add src/popup/pendingState.ts tests/popup/pendingState.test.ts
git commit -m "feat: add pendingState module with unit tests"
```

---

## Chunk 2: HTML/CSS Scaffold + scrollSpy

### Task 4: Rebuild popup.html

**Files:**
- Modify: `src/popup/popup.html`

- [ ] **Step 1: Replace popup.html with the new 500×580 structure**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Hype Control</title>
  <link rel="stylesheet" href="popup.css" />
</head>
<body>
  <header class="hc-header">
    <h1 class="hc-title">Hype Control</h1>
  </header>

  <div class="hc-body">
    <div class="hc-content" id="hc-content">

      <!-- Section 1: Stats -->
      <section class="hc-section" id="section-stats">
        <h2 class="section-heading">Stats</h2>
        <div class="stat-tiles">
          <div class="stat-tile" id="stat-saved">—</div>
          <div class="stat-tile" id="stat-blocked">—</div>
          <div class="stat-tile" id="stat-rate">—</div>
          <div class="stat-tile" id="stat-step">—</div>
        </div>
        <div class="hc-row">
          <span class="override-status" id="override-status">No active override</span>
          <button class="btn-secondary" id="btn-override">Stream Override (2 hr)</button>
        </div>
        <div class="hc-row">
          <label class="hc-label">Intensity</label>
          <div class="segmented" id="stats-intensity" data-pending-field="frictionIntensity">
            <button class="seg-btn" data-value="low">Low</button>
            <button class="seg-btn" data-value="medium">Med</button>
            <button class="seg-btn" data-value="high">High</button>
            <button class="seg-btn" data-value="extreme">Extreme</button>
          </div>
        </div>
        <div class="hc-row">
          <label class="hc-label">Thresholds</label>
          <label class="toggle-wrap">
            <input type="checkbox" id="stats-thresholds-enabled" />
            <span class="toggle-track"></span>
            <span class="toggle-text">enabled</span>
          </label>
        </div>
      </section>

      <!-- Section 2: Friction -->
      <section class="hc-section" id="section-friction">
        <h2 class="section-heading">Friction</h2>
        <div class="hc-row">
          <label class="hc-label" for="friction-hourly-rate">Hourly rate ($/hr)</label>
          <input type="number" id="friction-hourly-rate" min="0" step="0.01" class="hc-input hc-input--sm" />
        </div>
        <div class="hc-row">
          <label class="hc-label" for="friction-tax-rate">Tax rate (%)</label>
          <input type="number" id="friction-tax-rate" min="0" max="100" step="0.1" class="hc-input hc-input--sm" />
        </div>
        <div class="hc-row">
          <label class="hc-label">Intensity</label>
          <div class="segmented" id="friction-intensity" data-pending-field="frictionIntensity">
            <button class="seg-btn" data-value="low">Low</button>
            <button class="seg-btn" data-value="medium">Med</button>
            <button class="seg-btn" data-value="high">High</button>
            <button class="seg-btn" data-value="extreme">Extreme</button>
          </div>
        </div>
        <div class="hc-row">
          <label class="hc-label">Delay timer</label>
          <label class="toggle-wrap">
            <input type="checkbox" id="delay-enabled" />
            <span class="toggle-track"></span>
          </label>
          <div class="segmented" id="delay-duration" data-pending-field="delayTimer.seconds" hidden>
            <button class="seg-btn" data-value="5">5s</button>
            <button class="seg-btn" data-value="10">10s</button>
            <button class="seg-btn" data-value="30">30s</button>
            <button class="seg-btn" data-value="60">60s</button>
          </div>
        </div>
        <div class="hc-row">
          <label class="hc-label">Thresholds</label>
          <label class="toggle-wrap">
            <input type="checkbox" id="friction-thresholds-enabled" />
            <span class="toggle-track"></span>
          </label>
        </div>
        <div id="threshold-details" hidden>
          <div class="hc-row">
            <label class="hc-label" for="threshold-floor">Floor ($)</label>
            <input type="number" id="threshold-floor" min="0" step="0.01" class="hc-input hc-input--sm" />
          </div>
          <div class="hc-row">
            <label class="hc-label" for="threshold-ceiling">Ceiling ($)</label>
            <input type="number" id="threshold-ceiling" min="0" step="0.01" class="hc-input hc-input--sm" />
          </div>
          <div class="hc-row">
            <label class="hc-label" for="threshold-nudge-steps">Soft nudge steps</label>
            <input type="number" id="threshold-nudge-steps" min="1" step="1" class="hc-input hc-input--sm" />
          </div>
        </div>
      </section>

      <!-- Section 3: Comparisons -->
      <section class="hc-section" id="section-comparisons">
        <h2 class="section-heading">Comparisons</h2>
        <ul class="comparison-list" id="comparison-list"></ul>
        <button class="btn-secondary" id="btn-add-comparison">+ Add Custom Item</button>
        <div class="comparison-subpanel" id="comparison-subpanel" hidden>
          <h3 class="subpanel-title" id="subpanel-title">Add Item</h3>
          <div class="hc-row">
            <label class="hc-label" for="sp-emoji">Emoji</label>
            <input type="text" id="sp-emoji" maxlength="4" class="hc-input hc-input--sm" placeholder="🛒" />
          </div>
          <div class="hc-row">
            <label class="hc-label" for="sp-name">Name</label>
            <input type="text" id="sp-name" class="hc-input" />
          </div>
          <div class="hc-row">
            <label class="hc-label" for="sp-price">Price ($)</label>
            <input type="number" id="sp-price" min="0.01" step="0.01" class="hc-input hc-input--sm" />
          </div>
          <div class="hc-row">
            <label class="hc-label" for="sp-plural">Plural label</label>
            <input type="text" id="sp-plural" class="hc-input" placeholder="e.g. hot dogs" />
          </div>
          <div class="similarity-warning" id="sp-similarity" hidden>
            <span id="sp-similarity-msg"></span>
            <button class="btn-sm btn-danger" id="sp-confirm">Confirm</button>
            <button class="btn-sm" id="sp-cancel-similarity">Cancel</button>
          </div>
          <div class="subpanel-actions">
            <button class="btn-primary btn-sm" id="sp-save">Save</button>
            <button class="btn-sm" id="sp-cancel">Cancel</button>
          </div>
        </div>
      </section>

      <!-- Section 4: Limits -->
      <section class="hc-section" id="section-limits">
        <h2 class="section-heading">Limits</h2>
        <div class="hc-row">
          <label class="hc-label">Daily cap</label>
          <label class="toggle-wrap">
            <input type="checkbox" id="daily-cap-enabled" />
            <span class="toggle-track"></span>
          </label>
          <input type="number" id="daily-cap-amount" min="0" step="0.01" class="hc-input hc-input--sm" hidden />
        </div>
        <div class="hc-row">
          <label class="hc-label">Spending cooldown</label>
          <label class="toggle-wrap">
            <input type="checkbox" id="cooldown-enabled" />
            <span class="toggle-track"></span>
          </label>
          <select id="cooldown-duration" class="hc-select" hidden>
            <option value="5">5 min</option>
            <option value="10">10 min</option>
            <option value="30">30 min</option>
          </select>
        </div>
        <div class="hc-group">
          <div class="hc-row">
            <span class="hc-label">Daily total</span>
            <span class="tracker-value" id="tracker-daily">—</span>
          </div>
          <div class="hc-row">
            <span class="hc-label">Session total</span>
            <span class="tracker-value" id="tracker-session">—</span>
          </div>
          <div class="hc-row">
            <button class="btn-danger btn-sm" id="btn-reset-tracker">Reset Tracker</button>
            <span class="confirm-reset" id="confirm-reset" hidden>
              Are you sure?
              <button class="btn-danger btn-sm" id="btn-reset-confirm">Yes, reset</button>
              <button class="btn-sm" id="btn-reset-cancel">Cancel</button>
            </span>
          </div>
        </div>
      </section>

      <!-- Section 5: Channels -->
      <section class="hc-section" id="section-channels">
        <h2 class="section-heading">Channels</h2>
        <div class="hc-row">
          <label class="hc-label">Streaming mode</label>
          <label class="toggle-wrap">
            <input type="checkbox" id="streaming-mode-enabled" />
            <span class="toggle-track"></span>
          </label>
        </div>
        <div id="streaming-mode-details" hidden>
          <div class="hc-row">
            <label class="hc-label" for="streaming-username">Twitch username</label>
            <input type="text" id="streaming-username" class="hc-input" />
          </div>
          <div class="hc-row">
            <label class="hc-label" for="streaming-grace">Grace period (min)</label>
            <input type="number" id="streaming-grace" min="0" step="1" class="hc-input hc-input--sm" />
          </div>
          <div class="hc-row">
            <label class="hc-label">Log bypassed</label>
            <label class="toggle-wrap">
              <input type="checkbox" id="streaming-log-bypassed" />
              <span class="toggle-track"></span>
            </label>
          </div>
        </div>
        <div class="hc-group">
          <h3 class="group-heading">Channel Whitelist</h3>
          <div class="hc-row">
            <input type="text" id="whitelist-username-input" class="hc-input" placeholder="username" />
            <button class="btn-secondary btn-sm" id="btn-add-channel">Add Channel</button>
          </div>
          <ul class="whitelist-list" id="whitelist-list"></ul>
          <div class="behavior-legend">
            <span><strong>Skip</strong> — no friction</span>
            <span><strong>Reduced</strong> — low intensity only</span>
            <span><strong>Full</strong> — full friction</span>
          </div>
        </div>
      </section>

      <!-- Section 6: Settings -->
      <section class="hc-section" id="section-settings">
        <h2 class="section-heading">Settings</h2>
        <div class="hc-row">
          <label class="hc-label" for="theme-select">Theme</label>
          <select id="theme-select" class="hc-select">
            <option value="auto">Auto</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <div class="hc-row">
          <label class="hc-label" for="toast-duration">Toast duration (sec)</label>
          <input type="number" id="toast-duration" min="1" max="30" step="1" class="hc-input hc-input--sm" />
        </div>
        <div class="hc-row">
          <button class="btn-secondary" id="btn-view-logs">View Activity Logs</button>
        </div>
      </section>

    </div><!-- /.hc-content -->

    <nav class="hc-nav" id="hc-nav" aria-label="Sections">
      <button class="nav-label" data-nav-target="stats">Stats</button>
      <button class="nav-label" data-nav-target="friction">Friction</button>
      <button class="nav-label" data-nav-target="comparisons">Comparisons</button>
      <button class="nav-label" data-nav-target="limits">Limits</button>
      <button class="nav-label" data-nav-target="channels">Channels</button>
      <button class="nav-label" data-nav-target="settings">Settings</button>
    </nav>

  </div><!-- /.hc-body -->

  <footer class="hc-footer">
    <button class="btn-save" id="btn-save">💾 Save Settings</button>
    <span class="footer-version" id="footer-version"></span>
  </footer>

  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify file is saved (no build yet)**

Open `src/popup/popup.html` in an editor and confirm the structure is present. No build needed yet.

---

### Task 5: Rebuild popup.css

**Files:**
- Modify: `src/popup/popup.css`

- [ ] **Step 1: Replace popup.css entirely**

```css
/* ─── Variables ─────────────────────────────────────────── */
:root {
  --bg-primary: #18181b;
  --bg-secondary: #1f1f23;
  --bg-input: #0e0e10;
  --border-color: #2d2d35;
  --accent: #9146ff;
  --accent-hover: #7c3dd1;
  --text-primary: #efeff1;
  --text-secondary: #adadb8;
  --text-muted: #6b6b80;
  --danger: #e91916;
  --danger-hover: #c71512;
  --success: #00c896;
  --radius: 6px;
  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* ─── Reset ──────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ─── Root layout ────────────────────────────────────────── */
body {
  width: 500px;
  height: 580px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font);
  font-size: 13px;
}

/* ─── Header ─────────────────────────────────────────────── */
.hc-header {
  flex-shrink: 0;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--border-color);
}
.hc-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.02em;
}

/* ─── Body row (content + nav) ───────────────────────────── */
.hc-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

/* ─── Scrollable content ─────────────────────────────────── */
.hc-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 16px;
  min-width: 0;
}
.hc-content::-webkit-scrollbar { width: 4px; }
.hc-content::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 2px; }

/* ─── Right-side nav ─────────────────────────────────────── */
.hc-nav {
  flex-shrink: 0;
  width: 110px;
  display: flex;
  flex-direction: column;
  padding: 8px 0;
  border-left: 1px solid var(--border-color);
  gap: 2px;
}
.nav-label {
  width: 100%;
  padding: 7px 10px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  border-radius: 0;
  transition: background 0.1s, color 0.1s;
}
.nav-label:hover { background: var(--bg-secondary); color: var(--text-secondary); }
.nav-label.active {
  color: var(--accent);
  background: rgba(145, 70, 255, 0.1);
  font-weight: 600;
}

/* ─── Footer ─────────────────────────────────────────────── */
.hc-footer {
  flex-shrink: 0;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 1px solid var(--border-color);
  position: relative;
  padding: 0 12px;
}
.footer-version {
  position: absolute;
  right: 12px;
  font-size: 11px;
  color: var(--text-muted);
}

/* ─── Sections ───────────────────────────────────────────── */
.hc-section {
  padding: 14px 0 10px;
  border-bottom: 1px solid var(--border-color);
}
.hc-section:last-child { border-bottom: none; }
.section-heading {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 10px;
}
.group-heading {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 10px 0 6px;
}
.hc-group {
  margin-top: 8px;
  padding: 8px;
  background: var(--bg-secondary);
  border-radius: var(--radius);
}

/* ─── Rows ───────────────────────────────────────────────── */
.hc-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  flex-wrap: wrap;
}
.hc-label {
  flex: 0 0 auto;
  min-width: 110px;
  color: var(--text-secondary);
  font-size: 12px;
}

/* ─── Inputs ─────────────────────────────────────────────── */
.hc-input {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  color: var(--text-primary);
  font-size: 12px;
  padding: 4px 7px;
  flex: 1;
  min-width: 0;
}
.hc-input--sm { flex: 0 0 80px; }
.hc-input:focus { outline: none; border-color: var(--accent); }
.hc-select {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  color: var(--text-primary);
  font-size: 12px;
  padding: 4px 7px;
}
.hc-select:focus { outline: none; border-color: var(--accent); }

/* ─── Toggle ─────────────────────────────────────────────── */
.toggle-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.toggle-wrap input[type="checkbox"] { display: none; }
.toggle-track {
  width: 32px;
  height: 18px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 9px;
  position: relative;
  transition: background 0.15s, border-color 0.15s;
  flex-shrink: 0;
}
.toggle-track::after {
  content: '';
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--text-muted);
  top: 2px;
  left: 2px;
  transition: transform 0.15s, background 0.15s;
}
.toggle-wrap input:checked + .toggle-track {
  background: var(--accent);
  border-color: var(--accent);
}
.toggle-wrap input:checked + .toggle-track::after {
  transform: translateX(14px);
  background: white;
}
.toggle-text { font-size: 12px; color: var(--text-secondary); }

/* ─── Segmented control ──────────────────────────────────── */
.segmented {
  display: flex;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  overflow: hidden;
}
.seg-btn {
  flex: 1;
  padding: 4px 6px;
  background: transparent;
  border: none;
  border-right: 1px solid var(--border-color);
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}
.seg-btn:last-child { border-right: none; }
.seg-btn:hover { background: var(--bg-secondary); color: var(--text-secondary); }
.seg-btn.active {
  background: var(--accent);
  color: white;
  font-weight: 600;
}

/* ─── Buttons ────────────────────────────────────────────── */
.btn-save {
  background: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 600;
  padding: 8px 20px;
  cursor: pointer;
  transition: background 0.1s;
}
.btn-save:hover { background: var(--accent-hover); }
.btn-primary {
  background: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius);
  font-size: 12px;
  padding: 5px 12px;
  cursor: pointer;
}
.btn-primary:hover { background: var(--accent-hover); }
.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  font-size: 12px;
  padding: 5px 10px;
  cursor: pointer;
}
.btn-secondary:hover { border-color: var(--accent); color: var(--text-primary); }
.btn-danger {
  background: var(--danger);
  color: white;
  border: none;
  border-radius: var(--radius);
  font-size: 12px;
  padding: 5px 10px;
  cursor: pointer;
}
.btn-danger:hover { background: var(--danger-hover); }
.btn-sm { padding: 3px 8px; font-size: 11px; }

/* ─── Stat tiles ─────────────────────────────────────────── */
.stat-tiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 10px;
}
.stat-tile {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 8px 10px;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
}

/* ─── Override status ────────────────────────────────────── */
.override-status {
  font-size: 12px;
  color: var(--text-muted);
  flex: 1;
}

/* ─── Comparisons ────────────────────────────────────────── */
.comparison-list {
  list-style: none;
  margin-bottom: 8px;
}
.comparison-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 4px;
  border-radius: var(--radius);
  cursor: default;
}
.comparison-row:hover { background: var(--bg-secondary); }
.comparison-row.dragging { opacity: 0.4; }
.comparison-row.drag-over { border-top: 2px solid var(--accent); }
.drag-handle {
  cursor: grab;
  color: var(--text-muted);
  font-size: 14px;
  padding: 0 2px;
  flex-shrink: 0;
}
.comparison-emoji { font-size: 16px; flex-shrink: 0; }
.comparison-info { flex: 1; min-width: 0; overflow: hidden; }
.comparison-name { font-size: 12px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.comparison-price { font-size: 11px; color: var(--text-muted); }
.comparison-scope .segmented { font-size: 10px; }
.comparison-actions { display: flex; gap: 4px; flex-shrink: 0; }
.btn-icon {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 13px;
}
.btn-icon:hover { color: var(--text-primary); background: var(--bg-secondary); }

/* ─── Subpanel ───────────────────────────────────────────── */
.comparison-subpanel {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 10px;
  margin-top: 8px;
}
.subpanel-title { font-size: 12px; font-weight: 600; margin-bottom: 8px; color: var(--text-secondary); }
.subpanel-actions { display: flex; gap: 6px; margin-top: 8px; }
.similarity-warning {
  background: rgba(233, 25, 22, 0.1);
  border: 1px solid var(--danger);
  border-radius: var(--radius);
  padding: 6px 8px;
  font-size: 11px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  flex-wrap: wrap;
}

/* ─── Whitelist ──────────────────────────────────────────── */
.whitelist-list { list-style: none; margin-top: 6px; }
.whitelist-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border-bottom: 1px solid var(--border-color);
}
.whitelist-row:last-child { border-bottom: none; }
.whitelist-name {
  flex: 1;
  font-family: monospace;
  font-size: 12px;
  color: var(--text-primary);
}

/* ─── Behavior legend ────────────────────────────────────── */
.behavior-legend {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-muted);
}

/* ─── Confirm reset ──────────────────────────────────────── */
.confirm-reset {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-secondary);
}
.tracker-value {
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 600;
}
```

- [ ] **Step 2: Build to confirm CSS compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeds. (There will be TS errors in popup.ts since it still references old DOM ids — that is expected at this stage.)

If build fails with unresolvable errors, tell the user to run `npm run build` manually and proceed.

---

### Task 6: Create scrollSpy.ts

**Files:**
- Create: `src/popup/scrollSpy.ts`

- [ ] **Step 1: Create the scrollSpy module**

```typescript
// src/popup/scrollSpy.ts

export interface ScrollSpyItem {
  id: string;
  sectionEl: HTMLElement;
  headingEl: HTMLElement;
  navEl: HTMLElement;
}

/**
 * Sets up IntersectionObserver-based scroll-spy.
 * Returns a disconnect function to clean up.
 */
export function initScrollSpy(
  contentEl: HTMLElement,
  items: ScrollSpyItem[]
): () => void {
  let activeId: string | null = null;

  function activate(id: string): void {
    if (id === activeId) return;
    if (activeId) {
      items.find(i => i.id === activeId)?.navEl.classList.remove('active');
    }
    items.find(i => i.id === id)?.navEl.classList.add('active');
    activeId = id;
  }

  // Activate first section immediately
  if (items.length > 0) activate(items[0].id);

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const id = (entry.target as HTMLElement).dataset.sectionId;
          if (id) { activate(id); break; }
        }
      }
    },
    {
      root: contentEl,
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0,
    }
  );

  items.forEach(item => {
    item.headingEl.dataset.sectionId = item.id;
    observer.observe(item.headingEl);

    item.navEl.addEventListener('click', () => {
      item.sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  return () => observer.disconnect();
}
```

- [ ] **Step 2: Commit scaffold progress**

```bash
git add src/popup/popup.html src/popup/popup.css src/popup/scrollSpy.ts
git commit -m "feat: scaffold 500px popup layout, CSS, and scrollSpy module"
```

---

## Chunk 3: Section Controllers

### Task 7: Stats section controller

**Files:**
- Create: `src/popup/sections/stats.ts`

- [ ] **Step 1: Create src/popup/sections/stats.ts**

```typescript
// src/popup/sections/stats.ts
import { computePopupStats } from '../../shared/interceptLogger';
import { UserSettings } from '../../shared/types';
import { setPendingField, getPending } from '../pendingState';

const SETTINGS_KEY = 'hcSettings';

export interface StatsCallbacks {
  onIntensityChange: (value: UserSettings['frictionIntensity']) => void;
  onThresholdToggle: (enabled: boolean) => void;
}

export interface StatsController {
  render(settings: UserSettings): void;
  refreshStats(): Promise<void>;
}

export function initStats(el: HTMLElement, callbacks: StatsCallbacks): StatsController {
  const savedEl = el.querySelector<HTMLElement>('#stat-saved')!;
  const blockedEl = el.querySelector<HTMLElement>('#stat-blocked')!;
  const rateEl = el.querySelector<HTMLElement>('#stat-rate')!;
  const stepEl = el.querySelector<HTMLElement>('#stat-step')!;
  const overrideStatusEl = el.querySelector<HTMLElement>('#override-status')!;
  const overrideBtnEl = el.querySelector<HTMLButtonElement>('#btn-override')!;
  const intensityEl = el.querySelector<HTMLElement>('#stats-intensity')!;
  const thresholdsCbEl = el.querySelector<HTMLInputElement>('#stats-thresholds-enabled')!;

  function renderSegmented(container: HTMLElement, value: string): void {
    container.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === value);
    });
  }

  function renderOverride(settings: Partial<UserSettings>): void {
    const override = settings.streamingOverride;
    const now = Date.now();
    const isActive = !!(override && override.expiresAt > now);
    if (isActive && override) {
      const ms = override.expiresAt - now;
      const totalMin = Math.floor(ms / 60000);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      overrideStatusEl.textContent = `Active — ${h > 0 ? `${h}h ` : ''}${m}m remaining`;
    } else {
      overrideStatusEl.textContent = 'No active override';
    }
    overrideBtnEl.textContent = isActive ? 'Cancel Override' : 'Stream Override (2 hr)';
  }

  // Wire intensity segmented control
  intensityEl.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.value as UserSettings['frictionIntensity'];
      setPendingField('frictionIntensity', val);
      callbacks.onIntensityChange(val);
      renderSegmented(intensityEl, val);
    });
  });

  // Wire threshold toggle
  thresholdsCbEl.addEventListener('change', () => {
    const enabled = thresholdsCbEl.checked;
    setPendingField('frictionThresholds', {
      ...getPending().frictionThresholds,
      enabled,
    });
    callbacks.onThresholdToggle(enabled);
  });

  // Wire override button (immediate save — bypasses pending state)
  overrideBtnEl.addEventListener('click', async () => {
    const result = await chrome.storage.sync.get(SETTINGS_KEY);
    const current: Partial<UserSettings> = result[SETTINGS_KEY] ?? {};
    const isActive = !!(current.streamingOverride && current.streamingOverride.expiresAt > Date.now());
    if (isActive) {
      const updated = { ...current };
      delete updated.streamingOverride;
      await chrome.storage.sync.set({ [SETTINGS_KEY]: updated });
    } else {
      await chrome.storage.sync.set({
        [SETTINGS_KEY]: { ...current, streamingOverride: { expiresAt: Date.now() + 2 * 60 * 60 * 1000 } },
      });
    }
    const fresh = await chrome.storage.sync.get(SETTINGS_KEY);
    renderOverride(fresh[SETTINGS_KEY] ?? {});
  });

  async function refreshStats(): Promise<void> {
    const stats = await computePopupStats();
    savedEl.textContent = `$${stats.savedTotal.toFixed(2)} saved`;
    blockedEl.textContent = `${stats.blockedCount} blocked`;
    rateEl.textContent = `${Math.round(stats.cancelRate)}% cancel rate`;
    stepEl.textContent = stats.mostEffectiveStep != null ? `Step ${stats.mostEffectiveStep}` : '—';
  }

  function render(settings: UserSettings): void {
    renderSegmented(intensityEl, settings.frictionIntensity);
    thresholdsCbEl.checked = settings.frictionThresholds.enabled;
    renderOverride(settings);
  }

  return { render, refreshStats };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/popup/sections/stats.ts
git commit -m "feat: add stats section controller"
```

---

### Task 8: Friction section controller

**Files:**
- Create: `src/popup/sections/friction.ts`

- [ ] **Step 1: Create src/popup/sections/friction.ts**

```typescript
// src/popup/sections/friction.ts
import { UserSettings, FrictionIntensity, DelayTimerConfig, FrictionThresholds } from '../../shared/types';
import { setPendingField, getPending } from '../pendingState';

export interface FrictionCallbacks {
  onIntensityChange: (value: FrictionIntensity) => void;
}

export interface FrictionController {
  render(settings: UserSettings): void;
}

export function initFriction(el: HTMLElement, callbacks: FrictionCallbacks): FrictionController {
  const hourlyRateEl = el.querySelector<HTMLInputElement>('#friction-hourly-rate')!;
  const taxRateEl = el.querySelector<HTMLInputElement>('#friction-tax-rate')!;
  const intensityEl = el.querySelector<HTMLElement>('#friction-intensity')!;
  const delayEnabledEl = el.querySelector<HTMLInputElement>('#delay-enabled')!;
  const delayDurationEl = el.querySelector<HTMLElement>('#delay-duration')!;
  const thresholdsEnabledEl = el.querySelector<HTMLInputElement>('#friction-thresholds-enabled')!;
  const thresholdDetailsEl = el.querySelector<HTMLElement>('#threshold-details')!;
  const floorEl = el.querySelector<HTMLInputElement>('#threshold-floor')!;
  const ceilingEl = el.querySelector<HTMLInputElement>('#threshold-ceiling')!;
  const nudgeStepsEl = el.querySelector<HTMLInputElement>('#threshold-nudge-steps')!;

  function renderSegmented(container: HTMLElement, value: string): void {
    container.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === value);
    });
  }

  // Hourly rate
  hourlyRateEl.addEventListener('input', () => {
    setPendingField('hourlyRate', parseFloat(hourlyRateEl.value) || 0);
  });

  // Tax rate
  taxRateEl.addEventListener('input', () => {
    setPendingField('taxRate', parseFloat(taxRateEl.value) || 0);
  });

  // Intensity segmented
  intensityEl.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.value as FrictionIntensity;
      setPendingField('frictionIntensity', val);
      callbacks.onIntensityChange(val);
      renderSegmented(intensityEl, val);
    });
  });

  // Delay timer toggle
  delayEnabledEl.addEventListener('change', () => {
    const enabled = delayEnabledEl.checked;
    delayDurationEl.hidden = !enabled;
    setPendingField('delayTimer', { ...getPending().delayTimer, enabled });
  });

  // Delay duration segmented
  delayDurationEl.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const secs = parseInt(btn.dataset.value ?? '10', 10) as DelayTimerConfig['seconds'];
      setPendingField('delayTimer', { ...getPending().delayTimer, seconds: secs });
      renderSegmented(delayDurationEl, String(secs));
    });
  });

  // Thresholds toggle
  thresholdsEnabledEl.addEventListener('change', () => {
    const enabled = thresholdsEnabledEl.checked;
    thresholdDetailsEl.hidden = !enabled;
    setPendingField('frictionThresholds', { ...getPending().frictionThresholds, enabled });
  });

  // Threshold fields
  function updateThresholds(): void {
    const t: FrictionThresholds = {
      enabled: getPending().frictionThresholds.enabled,
      thresholdFloor: parseFloat(floorEl.value) || 0,
      thresholdCeiling: parseFloat(ceilingEl.value) || 0,
      softNudgeSteps: parseInt(nudgeStepsEl.value, 10) || 1,
    };
    setPendingField('frictionThresholds', t);
  }
  floorEl.addEventListener('input', updateThresholds);
  ceilingEl.addEventListener('input', updateThresholds);
  nudgeStepsEl.addEventListener('input', updateThresholds);

  function render(settings: UserSettings): void {
    hourlyRateEl.value = String(settings.hourlyRate);
    taxRateEl.value = String(settings.taxRate);
    renderSegmented(intensityEl, settings.frictionIntensity);
    delayEnabledEl.checked = settings.delayTimer.enabled;
    delayDurationEl.hidden = !settings.delayTimer.enabled;
    renderSegmented(delayDurationEl, String(settings.delayTimer.seconds));
    thresholdsEnabledEl.checked = settings.frictionThresholds.enabled;
    thresholdDetailsEl.hidden = !settings.frictionThresholds.enabled;
    floorEl.value = String(settings.frictionThresholds.thresholdFloor);
    ceilingEl.value = String(settings.frictionThresholds.thresholdCeiling);
    nudgeStepsEl.value = String(settings.frictionThresholds.softNudgeSteps);
  }

  return { render };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/popup/sections/friction.ts
git commit -m "feat: add friction section controller"
```

---

### Task 9: Comparisons section controller

**Files:**
- Create: `src/popup/sections/comparisons.ts`

- [ ] **Step 1: Create src/popup/sections/comparisons.ts**

```typescript
// src/popup/sections/comparisons.ts
import { ComparisonItem, UserSettings } from '../../shared/types';
import { getPending, setPendingField } from '../pendingState';

export interface ComparisonsController {
  render(settings: UserSettings): void;
}

export function initComparisons(el: HTMLElement): ComparisonsController {
  const listEl = el.querySelector<HTMLUListElement>('#comparison-list')!;
  const addBtnEl = el.querySelector<HTMLButtonElement>('#btn-add-comparison')!;
  const subpanelEl = el.querySelector<HTMLElement>('#comparison-subpanel')!;
  const subpanelTitleEl = el.querySelector<HTMLElement>('#subpanel-title')!;
  const spEmoji = el.querySelector<HTMLInputElement>('#sp-emoji')!;
  const spName = el.querySelector<HTMLInputElement>('#sp-name')!;
  const spPrice = el.querySelector<HTMLInputElement>('#sp-price')!;
  const spPlural = el.querySelector<HTMLInputElement>('#sp-plural')!;
  const spSimilarityEl = el.querySelector<HTMLElement>('#sp-similarity')!;
  const spSimilarityMsg = el.querySelector<HTMLElement>('#sp-similarity-msg')!;
  const spSaveBtnEl = el.querySelector<HTMLButtonElement>('#sp-save')!;
  const spCancelBtnEl = el.querySelector<HTMLButtonElement>('#sp-cancel')!;
  const spConfirmBtnEl = el.querySelector<HTMLButtonElement>('#sp-confirm')!;
  const spCancelSimilarityBtnEl = el.querySelector<HTMLButtonElement>('#sp-cancel-similarity')!;

  let editingId: string | null = null;
  let dragSrcIdx: number | null = null;

  function generateId(): string {
    return 'custom-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function isSimilar(name: string, items: ComparisonItem[], ignoreId?: string): string | null {
    const norm = name.trim().toLowerCase();
    const existing = items.find(i => i.id !== ignoreId && (i.name.toLowerCase().includes(norm) || norm.includes(i.name.toLowerCase())));
    return existing?.name ?? null;
  }

  function openSubpanel(title: string, item?: ComparisonItem): void {
    subpanelTitleEl.textContent = title;
    spEmoji.value = item?.emoji ?? '';
    spName.value = item?.name ?? '';
    spPrice.value = item?.price != null ? String(item.price) : '';
    spPlural.value = item?.pluralLabel ?? '';
    spSimilarityEl.hidden = true;
    subpanelEl.hidden = false;
    addBtnEl.hidden = true;
    spName.focus();
  }

  function closeSubpanel(): void {
    subpanelEl.hidden = true;
    addBtnEl.hidden = false;
    editingId = null;
    spSimilarityEl.hidden = true;
  }

  function commitSubpanel(force = false): void {
    const name = spName.value.trim();
    const price = parseFloat(spPrice.value);
    if (!name || isNaN(price) || price <= 0) return;

    const items = getPending().comparisonItems;
    if (!force) {
      const similar = isSimilar(name, items, editingId ?? undefined);
      if (similar) {
        spSimilarityMsg.textContent = `"${name}" is similar to existing item "${similar}"`;
        spSimilarityEl.hidden = false;
        return;
      }
    }

    const newItem: ComparisonItem = {
      id: editingId ?? generateId(),
      emoji: spEmoji.value.trim() || '📦',
      name,
      price: Math.round(price * 100) / 100,
      pluralLabel: spPlural.value.trim() || name + 's',
      enabled: true,
      isPreset: false,
      frictionScope: 'both',
    };

    let updated: ComparisonItem[];
    if (editingId) {
      updated = items.map(i => i.id === editingId ? newItem : i);
    } else {
      updated = [...items, newItem];
    }
    setPendingField('comparisonItems', updated);
    closeSubpanel();
    renderList(updated);
  }

  spSaveBtnEl.addEventListener('click', () => commitSubpanel(false));
  spConfirmBtnEl.addEventListener('click', () => commitSubpanel(true));
  spCancelSimilarityBtnEl.addEventListener('click', () => { spSimilarityEl.hidden = true; });
  spCancelBtnEl.addEventListener('click', closeSubpanel);

  addBtnEl.addEventListener('click', () => {
    editingId = null;
    openSubpanel('Add Item');
  });

  function renderScopeSegmented(container: HTMLElement, value: ComparisonItem['frictionScope']): void {
    container.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === value);
    });
  }

  function makeEl<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs: Record<string, string> = {},
    text?: string
  ): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function renderList(items: ComparisonItem[]): void {
    listEl.innerHTML = '';
    items.forEach((item, idx) => {
      const li = document.createElement('li');
      li.className = 'comparison-row';
      li.draggable = true;
      li.dataset.idx = String(idx);

      // Drag handle
      li.appendChild(makeEl('span', { class: 'drag-handle', title: 'Drag to reorder' }, '⠿'));

      // Enable toggle
      const toggleLabel = makeEl('label', { class: 'toggle-wrap', title: 'Enable/disable' });
      const toggleEl = makeEl('input', { type: 'checkbox', class: 'item-toggle' });
      toggleEl.checked = item.enabled;
      toggleLabel.appendChild(toggleEl);
      toggleLabel.appendChild(makeEl('span', { class: 'toggle-track' }));
      li.appendChild(toggleLabel);

      // Emoji (textContent is safe)
      li.appendChild(makeEl('span', { class: 'comparison-emoji' }, item.emoji));

      // Name + price
      const info = makeEl('div', { class: 'comparison-info' });
      info.appendChild(makeEl('div', { class: 'comparison-name' }, item.name));
      info.appendChild(makeEl('div', { class: 'comparison-price' }, `$${item.price.toFixed(2)}`));
      li.appendChild(info);

      // Scope segmented (only when enabled)
      if (item.enabled) {
        const scopeWrap = makeEl('div', { class: 'comparison-scope' });
        const segmented = makeEl('div', { class: 'segmented', style: 'font-size:10px;' });
        (['nudge', 'full', 'both'] as ComparisonItem['frictionScope'][]).forEach(val => {
          const btn = makeEl('button', { class: `seg-btn${item.frictionScope === val ? ' active' : ''}`, 'data-value': val }, val.charAt(0).toUpperCase() + val.slice(1));
          btn.addEventListener('click', () => {
            const updated = getPending().comparisonItems.map((ci, i) =>
              i === idx ? { ...ci, frictionScope: val } : ci
            );
            setPendingField('comparisonItems', updated);
            renderScopeSegmented(segmented, val);
          });
          segmented.appendChild(btn);
        });
        scopeWrap.appendChild(segmented);
        li.appendChild(scopeWrap);
      }

      // Edit / Delete (custom items only)
      if (!item.isPreset) {
        const actions = makeEl('div', { class: 'comparison-actions' });
        const editBtn = makeEl('button', { class: 'btn-icon', title: 'Edit' }, '✏️');
        editBtn.addEventListener('click', () => {
          editingId = item.id;
          openSubpanel('Edit Item', item);
        });
        const deleteBtn = makeEl('button', { class: 'btn-icon', title: 'Delete' }, '×');
        deleteBtn.addEventListener('click', () => {
          const updated = getPending().comparisonItems.filter((_, i) => i !== idx);
          setPendingField('comparisonItems', updated);
          renderList(getPending().comparisonItems);
        });
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        li.appendChild(actions);
      }

      // Toggle enable/disable
      toggleEl.addEventListener('change', () => {
        const updated = getPending().comparisonItems.map((ci, i) =>
          i === idx ? { ...ci, enabled: toggleEl.checked } : ci
        );
        setPendingField('comparisonItems', updated);
        renderList(getPending().comparisonItems);
      });

      // Drag-and-drop
      li.addEventListener('dragstart', () => {
        dragSrcIdx = idx;
        li.classList.add('dragging');
      });
      li.addEventListener('dragend', () => {
        li.classList.remove('dragging');
        listEl.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      });
      li.addEventListener('dragover', (e) => {
        e.preventDefault();
        li.classList.add('drag-over');
      });
      li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        li.classList.remove('drag-over');
        if (dragSrcIdx === null || dragSrcIdx === idx) return;
        const updated = [...getPending().comparisonItems];
        const [moved] = updated.splice(dragSrcIdx, 1);
        updated.splice(idx, 0, moved);
        setPendingField('comparisonItems', updated);
        renderList(updated);
        dragSrcIdx = null;
      });

      listEl.appendChild(li);
    });
  }

  function render(settings: UserSettings): void {
    renderList(settings.comparisonItems);
  }

  return { render };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/popup/sections/comparisons.ts
git commit -m "feat: add comparisons section controller with drag-drop and sub-panel"
```

---

### Task 10: Limits section controller

**Files:**
- Create: `src/popup/sections/limits.ts`

- [ ] **Step 1: Create src/popup/sections/limits.ts**

```typescript
// src/popup/sections/limits.ts
import { UserSettings, DEFAULT_SPENDING_TRACKER } from '../../shared/types';
import { getPending, setPendingField } from '../pendingState';

const TRACKER_KEY = 'hcSpending'; // Matches interceptor.ts SPENDING_KEY

export interface LimitsCallbacks {
  onThresholdToggle: (enabled: boolean) => void;
}

export interface LimitsController {
  render(settings: UserSettings): void;
  refreshTracker(): Promise<void>;
}

export function initLimits(el: HTMLElement, callbacks: LimitsCallbacks): LimitsController {
  const dailyCapEnabledEl = el.querySelector<HTMLInputElement>('#daily-cap-enabled')!;
  const dailyCapAmountEl = el.querySelector<HTMLInputElement>('#daily-cap-amount')!;
  const cooldownEnabledEl = el.querySelector<HTMLInputElement>('#cooldown-enabled')!;
  const cooldownDurationEl = el.querySelector<HTMLSelectElement>('#cooldown-duration')!;
  const trackerDailyEl = el.querySelector<HTMLElement>('#tracker-daily')!;
  const trackerSessionEl = el.querySelector<HTMLElement>('#tracker-session')!;
  const resetBtnEl = el.querySelector<HTMLButtonElement>('#btn-reset-tracker')!;
  const confirmResetEl = el.querySelector<HTMLElement>('#confirm-reset')!;
  const resetConfirmBtnEl = el.querySelector<HTMLButtonElement>('#btn-reset-confirm')!;
  const resetCancelBtnEl = el.querySelector<HTMLButtonElement>('#btn-reset-cancel')!;

  // Daily cap
  dailyCapEnabledEl.addEventListener('change', () => {
    const enabled = dailyCapEnabledEl.checked;
    dailyCapAmountEl.hidden = !enabled;
    setPendingField('dailyCap', { ...getPending().dailyCap, enabled });
  });
  dailyCapAmountEl.addEventListener('input', () => {
    setPendingField('dailyCap', {
      ...getPending().dailyCap,
      amount: parseFloat(dailyCapAmountEl.value) || 0,
    });
  });

  // Cooldown
  cooldownEnabledEl.addEventListener('change', () => {
    const enabled = cooldownEnabledEl.checked;
    cooldownDurationEl.hidden = !enabled;
    setPendingField('cooldown', { ...getPending().cooldown, enabled });
  });
  cooldownDurationEl.addEventListener('change', () => {
    setPendingField('cooldown', {
      ...getPending().cooldown,
      minutes: parseInt(cooldownDurationEl.value, 10),
    });
  });

  // Reset tracker (inline confirmation)
  resetBtnEl.addEventListener('click', () => {
    resetBtnEl.hidden = true;
    confirmResetEl.hidden = false;
  });
  resetCancelBtnEl.addEventListener('click', () => {
    confirmResetEl.hidden = true;
    resetBtnEl.hidden = false;
  });
  resetConfirmBtnEl.addEventListener('click', async () => {
    await chrome.storage.local.set({ [TRACKER_KEY]: DEFAULT_SPENDING_TRACKER });
    confirmResetEl.hidden = true;
    resetBtnEl.hidden = false;
    await refreshTracker();
  });

  async function refreshTracker(): Promise<void> {
    const result = await chrome.storage.local.get(TRACKER_KEY);
    const tracker = result[TRACKER_KEY];
    if (tracker) {
      trackerDailyEl.textContent = `$${(tracker.dailyTotal ?? 0).toFixed(2)}`;
      trackerSessionEl.textContent = `$${(tracker.sessionTotal ?? 0).toFixed(2)}`;
    }
  }

  function render(settings: UserSettings): void {
    dailyCapEnabledEl.checked = settings.dailyCap.enabled;
    dailyCapAmountEl.hidden = !settings.dailyCap.enabled;
    dailyCapAmountEl.value = String(settings.dailyCap.amount);
    cooldownEnabledEl.checked = settings.cooldown.enabled;
    cooldownDurationEl.hidden = !settings.cooldown.enabled;
    cooldownDurationEl.value = String(settings.cooldown.minutes);
  }

  return { render, refreshTracker };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/popup/sections/limits.ts
git commit -m "feat: add limits section controller"
```

---

### Task 11: Channels section controller

**Files:**
- Create: `src/popup/sections/channels.ts`

- [ ] **Step 1: Create src/popup/sections/channels.ts**

```typescript
// src/popup/sections/channels.ts
import { UserSettings, WhitelistBehavior, WhitelistEntry } from '../../shared/types';
import { getPending, setPendingField } from '../pendingState';

export interface ChannelsController {
  render(settings: UserSettings): void;
}

export function initChannels(el: HTMLElement): ChannelsController {
  const streamingEnabledEl = el.querySelector<HTMLInputElement>('#streaming-mode-enabled')!;
  const streamingDetailsEl = el.querySelector<HTMLElement>('#streaming-mode-details')!;
  const usernameEl = el.querySelector<HTMLInputElement>('#streaming-username')!;
  const graceEl = el.querySelector<HTMLInputElement>('#streaming-grace')!;
  const logBypassedEl = el.querySelector<HTMLInputElement>('#streaming-log-bypassed')!;
  const whitelistInputEl = el.querySelector<HTMLInputElement>('#whitelist-username-input')!;
  const addChannelBtnEl = el.querySelector<HTMLButtonElement>('#btn-add-channel')!;
  const whitelistListEl = el.querySelector<HTMLUListElement>('#whitelist-list')!;

  function updateStreaming(): void {
    setPendingField('streamingMode', {
      enabled: streamingEnabledEl.checked,
      twitchUsername: usernameEl.value.trim(),
      gracePeriodMinutes: parseInt(graceEl.value, 10) || 0,
      logBypassed: logBypassedEl.checked,
    });
  }

  streamingEnabledEl.addEventListener('change', () => {
    streamingDetailsEl.hidden = !streamingEnabledEl.checked;
    updateStreaming();
  });
  usernameEl.addEventListener('input', updateStreaming);
  graceEl.addEventListener('input', updateStreaming);
  logBypassedEl.addEventListener('change', updateStreaming);

  function normalizeUsername(raw: string): string {
    return raw.trim().toLowerCase().replace(/^https?:\/\/(?:www\.)?twitch\.tv\//i, '');
  }

  function renderWhitelist(entries: WhitelistEntry[]): void {
    whitelistListEl.innerHTML = '';
    entries.forEach((entry, idx) => {
      const li = document.createElement('li');
      li.className = 'whitelist-row';

      // textContent is safe — no innerHTML for user data
      const nameSpan = document.createElement('span');
      nameSpan.className = 'whitelist-name';
      nameSpan.textContent = entry.username;

      const behaviorSelect = document.createElement('select');
      behaviorSelect.className = 'hc-select';
      (['skip', 'reduced', 'full'] as WhitelistBehavior[]).forEach(val => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = val.charAt(0).toUpperCase() + val.slice(1);
        opt.selected = entry.behavior === val;
        behaviorSelect.appendChild(opt);
      });
      behaviorSelect.addEventListener('change', () => {
        const behavior = behaviorSelect.value as WhitelistBehavior;
        const updated = getPending().whitelistedChannels.map((ch, i) =>
          i === idx ? { ...ch, behavior } : ch
        );
        setPendingField('whitelistedChannels', updated);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-icon';
      deleteBtn.title = 'Remove';
      deleteBtn.textContent = '×';
      deleteBtn.addEventListener('click', () => {
        const updated = getPending().whitelistedChannels.filter((_, i) => i !== idx);
        setPendingField('whitelistedChannels', updated);
        renderWhitelist(updated);
      });

      li.appendChild(nameSpan);
      li.appendChild(behaviorSelect);
      li.appendChild(deleteBtn);
      whitelistListEl.appendChild(li);
    });
  }

  addChannelBtnEl.addEventListener('click', () => {
    const raw = whitelistInputEl.value;
    const username = normalizeUsername(raw);
    if (!username) return;
    const exists = getPending().whitelistedChannels.some(ch => ch.username === username);
    if (exists) return;
    const updated: WhitelistEntry[] = [...getPending().whitelistedChannels, { username, behavior: 'full' }];
    setPendingField('whitelistedChannels', updated);
    whitelistInputEl.value = '';
    renderWhitelist(updated);
  });

  whitelistInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addChannelBtnEl.click();
  });

  function render(settings: UserSettings): void {
    streamingEnabledEl.checked = settings.streamingMode.enabled;
    streamingDetailsEl.hidden = !settings.streamingMode.enabled;
    usernameEl.value = settings.streamingMode.twitchUsername;
    graceEl.value = String(settings.streamingMode.gracePeriodMinutes);
    logBypassedEl.checked = settings.streamingMode.logBypassed;
    renderWhitelist(settings.whitelistedChannels);
  }

  return { render };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/popup/sections/channels.ts
git commit -m "feat: add channels section controller"
```

---

### Task 12: Settings section controller

**Files:**
- Create: `src/popup/sections/settings-section.ts`

- [ ] **Step 1: Create src/popup/sections/settings-section.ts**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/popup/sections/settings-section.ts
git commit -m "feat: add settings section controller"
```

---

## Chunk 4: Orchestrator + Cleanup + Build

### Task 13: Rebuild popup.ts orchestrator

**Files:**
- Modify: `src/popup/popup.ts`

- [ ] **Step 1: Replace popup.ts entirely**

```typescript
// src/popup/popup.ts
import './popup.css';
import { migrateSettings } from '../shared/types';
import { initPending, getPending, setPendingField } from './pendingState';
import { initScrollSpy, ScrollSpyItem } from './scrollSpy';
import { initStats } from './sections/stats';
import { initFriction } from './sections/friction';
import { initComparisons } from './sections/comparisons';
import { initLimits } from './sections/limits';
import { initChannels } from './sections/channels';
import { initSettingsSection } from './sections/settings-section';

const SETTINGS_KEY = 'hcSettings';

async function main(): Promise<void> {
  // Load and migrate settings
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  const settings = migrateSettings(result[SETTINGS_KEY] ?? {});
  initPending(settings);

  // Section elements
  const statsEl = document.getElementById('section-stats')!;
  const frictionEl = document.getElementById('section-friction')!;
  const comparisonsEl = document.getElementById('section-comparisons')!;
  const limitsEl = document.getElementById('section-limits')!;
  const channelsEl = document.getElementById('section-channels')!;
  const settingsEl = document.getElementById('section-settings')!;

  // Init section controllers with bidirectional sync callbacks
  const friction = initFriction(frictionEl, {
    onIntensityChange: (v) => {
      // Stats intensity mirror — re-render Stats intensity control
      statsEl.querySelectorAll<HTMLButtonElement>('#stats-intensity .seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === v);
      });
    },
  });

  const limits = initLimits(limitsEl, {
    onThresholdToggle: (enabled) => {
      // Stats threshold toggle mirror
      const statsThresholdCb = statsEl.querySelector<HTMLInputElement>('#stats-thresholds-enabled');
      if (statsThresholdCb) statsThresholdCb.checked = enabled;
    },
  });

  const stats = initStats(statsEl, {
    onIntensityChange: (v) => {
      // Friction intensity mirror — re-render Friction intensity control
      frictionEl.querySelectorAll<HTMLButtonElement>('#friction-intensity .seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === v);
      });
    },
    onThresholdToggle: (enabled) => {
      // Limits threshold toggle mirror via setPendingField already done in stats.ts
      // Sync friction thresholds toggle
      const frictionThresholdsCb = frictionEl.querySelector<HTMLInputElement>('#friction-thresholds-enabled');
      const thresholdDetails = frictionEl.querySelector<HTMLElement>('#threshold-details');
      if (frictionThresholdsCb) frictionThresholdsCb.checked = enabled;
      if (thresholdDetails) thresholdDetails.hidden = !enabled;
    },
  });

  const comparisons = initComparisons(comparisonsEl);
  const channels = initChannels(channelsEl);
  const settingsSection = initSettingsSection(settingsEl);

  // Initial render of all sections
  function renderAll(): void {
    const s = getPending();
    stats.render(s);
    friction.render(s);
    comparisons.render(s);
    limits.render(s);
    channels.render(s);
    settingsSection.render(s);
  }
  renderAll();

  // Async data that doesn't come from pending state
  stats.refreshStats();
  limits.refreshTracker();

  // Scroll-spy
  const contentEl = document.getElementById('hc-content')!;
  const spyItems: ScrollSpyItem[] = [
    { id: 'stats',       sectionEl: statsEl,       headingEl: statsEl.querySelector('.section-heading')!,       navEl: document.querySelector('[data-nav-target="stats"]')! },
    { id: 'friction',    sectionEl: frictionEl,    headingEl: frictionEl.querySelector('.section-heading')!,    navEl: document.querySelector('[data-nav-target="friction"]')! },
    { id: 'comparisons', sectionEl: comparisonsEl, headingEl: comparisonsEl.querySelector('.section-heading')!, navEl: document.querySelector('[data-nav-target="comparisons"]')! },
    { id: 'limits',      sectionEl: limitsEl,      headingEl: limitsEl.querySelector('.section-heading')!,      navEl: document.querySelector('[data-nav-target="limits"]')! },
    { id: 'channels',    sectionEl: channelsEl,    headingEl: channelsEl.querySelector('.section-heading')!,    navEl: document.querySelector('[data-nav-target="channels"]')! },
    { id: 'settings',    sectionEl: settingsEl,    headingEl: settingsEl.querySelector('.section-heading')!,    navEl: document.querySelector('[data-nav-target="settings"]')! },
  ];
  initScrollSpy(contentEl, spyItems);

  // Version
  const versionEl = document.getElementById('footer-version');
  if (versionEl) versionEl.textContent = 'v' + chrome.runtime.getManifest().version;

  // Save button
  const saveBtnEl = document.getElementById('btn-save') as HTMLButtonElement;
  saveBtnEl.addEventListener('click', async () => {
    saveBtnEl.disabled = true;
    saveBtnEl.textContent = 'Saving…';
    try {
      await chrome.storage.sync.set({ [SETTINGS_KEY]: getPending() });
      saveBtnEl.textContent = '✓ Saved';
      setTimeout(() => {
        saveBtnEl.disabled = false;
        saveBtnEl.textContent = '💾 Save Settings';
      }, 1500);
    } catch {
      saveBtnEl.disabled = false;
      saveBtnEl.textContent = '💾 Save Settings';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => { main(); });
```

- [ ] **Step 2: Attempt build**

```bash
npm run build 2>&1 | tail -30
```

Expected: Build succeeds with no TypeScript errors. If it fails, do NOT retry — report the error output to the user.

- [ ] **Step 3: Commit**

```bash
git add src/popup/popup.ts
git commit -m "feat: rebuild popup.ts orchestrator, wire all sections and scroll-spy"
```

---

### Task 14: Retire options page + update manifest and webpack

**Files:**
- Modify: `src/options/options.html`
- Modify: `webpack.config.js`
- Modify: `manifest.json`

- [ ] **Step 1: Replace options.html with a deprecation notice**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Hype Control</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #18181b; color: #efeff1; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .msg { text-align: center; max-width: 380px; }
    .msg h2 { margin-bottom: 8px; }
    .msg p { color: #adadb8; font-size: 14px; }
  </style>
</head>
<body>
  <div class="msg">
    <h2>Settings Moved</h2>
    <p>All settings are now in the extension popup. Click the Hype Control icon in your toolbar to open them.</p>
  </div>
</body>
</html>
```

- [ ] **Step 2: Remove options entry from webpack.config.js**

In `webpack.config.js`, remove the `options` entry from `entry` and the `options.html` pattern from `CopyPlugin`.

Before:
```js
entry: {
  content: './src/content/index.ts',
  logs: './src/logs/logs.ts',
  options: './src/options/options.ts',
  popup: './src/popup/popup.ts',
  serviceWorker: './src/background/serviceWorker.ts',
},
```

After:
```js
entry: {
  content: './src/content/index.ts',
  logs: './src/logs/logs.ts',
  popup: './src/popup/popup.ts',
  serviceWorker: './src/background/serviceWorker.ts',
},
```

Remove from CopyPlugin patterns:
```js
{ from: 'src/options/options.html', to: 'options.html' },
```

- [ ] **Step 3: Remove options_page from manifest.json**

Remove the line:
```json
"options_page": "options.html",
```

- [ ] **Step 4: Attempt build to confirm options is cleanly removed**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeds, no `options.js` or `options.css` in `dist/`. If it fails, do NOT retry — report the error to the user.

- [ ] **Step 5: Commit**

```bash
git add src/options/options.html webpack.config.js manifest.json
git commit -m "feat: retire options page, remove from manifest and webpack"
```

---

### Task 15: Version bump + final build verification

**Files:**
- Modify: `manifest.json`
- Modify: `package.json`

- [ ] **Step 1: Bump version in both files**

In `manifest.json`, change `"version": "0.4.7"` to `"version": "0.4.8"`.

In `package.json`, change `"version": "0.4.7"` to `"version": "0.4.8"`.

- [ ] **Step 2: Final build**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeds. `dist/` contains: `popup.js`, `popup.css`, `popup.html`, `manifest.json` (with version 0.4.8), `content.js`, `logs.js`, `logs.html`, `serviceWorker.js`. No `options.js` or `options.css`.

- [ ] **Step 3: Run tests one last time**

```bash
npm test
```

Expected: `Tests: 7 passed, 7 total`

- [ ] **Step 4: Commit version bump**

```bash
git add manifest.json package.json
git commit -m "chore: bump version to 0.4.8"
```

---

### Task 16: Update TODO + open PR

**Files:**
- Modify: `HypeControl-TODO.md`

- [ ] **Step 1: Mark settings UI work complete in HypeControl-TODO.md**

Find the settings UI redesign entry and mark it `[x]`. Update the header `Current Version` to `0.4.8` and footer timestamp to `2026-03-12`.

- [ ] **Step 2: Commit TODO update**

```bash
git add HypeControl-TODO.md
git commit -m "docs: mark settings UI consolidation complete in TODO"
```

- [ ] **Step 3: Push branch and open PR**

```bash
git push -u origin feat/settings-ui-consolidation
gh pr create \
  --title "feat: consolidate settings into 500px popup, retire options page (v0.4.8)" \
  --body "$(cat <<'EOF'
## Summary
- Rebuilds popup as a 500×580px single-page UI with 6 sections (Stats · Friction · Comparisons · Limits · Channels · Settings)
- Right-side scroll-spy nav with IntersectionObserver highlights active section
- Pending-state save model — all inputs write to in-memory state, footer Save button persists to chrome.storage.sync
- Drag-and-drop comparison item reordering with inline Add/Edit sub-panel
- Retires options page (replaced with deprecation notice), removes from manifest and webpack
- Adds Jest + ts-jest with 7 unit tests for pendingState module

## Test plan
- [ ] Load extension in Chrome — popup opens at 500×580px with 6 sections visible
- [ ] Scroll through sections — right-side nav label activates for each section
- [ ] Click a nav label — content smooth-scrolls to that section
- [ ] Edit hourly rate, click Save — reload popup, verify value persisted
- [ ] Change intensity in Stats section — Friction section intensity control updates to match (bidirectional sync)
- [ ] Toggle threshold in Stats — Friction thresholds toggle updates to match
- [ ] Add a custom comparison item — appears in list; close popup without saving — item is gone on reopen
- [ ] Add comparison item then Save — item persists after reopen
- [ ] Drag comparison item to reorder — order changes, Save, reopen — order persists
- [ ] Click Stream Override button — status text updates immediately (no Save needed)
- [ ] Click Reset Tracker — inline confirmation appears; confirm — tracker resets to $0.00
- [ ] Right-click extension icon → Options — shows deprecation notice
- [ ] Run `npm test` — 7 tests pass
- [ ] Run `npm run build` — succeeds, no options.js/css in dist/

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Run /security-review on the PR before merging**

Per project git workflow (memory): run `/security-review` on this PR before merging to main.
