# UI Polish Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six UI issues in the HypeControl popup: stat tile colors/sizing, scroll nav detection, light mode theme application, footer link visibility, nav width, and auto-detect Twitch channel from active tab.

**Architecture:** All changes are contained to the popup layer. CSS fixes are applied directly to `popup.css`. The stat tile restructure splits each tile into a value span (colored) and label span (static). Theme application is wired via a new `onThemeChange` callback added to `settings-section.ts`. URL detection in `channels.ts` uses an extracted pure function for testability.

**Tech Stack:** TypeScript, webpack, Chrome Extension MV3, Jest + ts-jest (testEnvironment: node), existing popup CSS custom properties system.

---

## Chunk 1: CSS Fixes + Stat Tiles

### Task 1: Create feature branch

**Files:**
- No files changed

- [ ] **Step 1: Create and switch to fix/ui-polish**

```bash
cd F:/GDriveClone/Claude_Code/HypeControl
git checkout -b fix/ui-polish
```

Expected: `Switched to a new branch 'fix/ui-polish'`

---

### Task 2: CSS one-liners — footer links + nav width (Fixes 4 & 5)

**Files:**
- Modify: `src/popup/popup.css`

These are two single-property changes with zero risk. Do them together in one commit.

- [ ] **Step 1: Fix footer link color**

In `src/popup/popup.css`, find the `.footer-link` rule:
```css
.footer-link {
  font-size: 11px;
  color: var(--text-muted);   /* ← change this */
  text-decoration: none;
  cursor: pointer;
}
```
Change `color: var(--text-muted)` to `color: var(--text-secondary)`.

- [ ] **Step 2: Fix nav width**

In `src/popup/popup.css`, find the `.hc-nav` rule:
```css
.hc-nav {
  flex-shrink: 0;
  width: 110px;   /* ← change this */
  ...
}
```
Change `width: 110px` to `width: 90px`.

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```
Expected: build succeeds, no errors. If it fails, do NOT retry — report to user.

- [ ] **Step 4: Commit**

```bash
git add src/popup/popup.css
git commit -m "fix: footer link visibility and nav width (#4 #5)"
```

---

### Task 3: Stat tiles — HTML restructure (Fix 1, part A)

**Files:**
- Modify: `src/popup/popup.html`

- [ ] **Step 1: Restructure the four stat tiles**

In `src/popup/popup.html`, find the `<div class="stat-tiles">` block (currently four bare divs):

```html
<div class="stat-tiles">
  <div class="stat-tile" id="stat-saved">—</div>
  <div class="stat-tile" id="stat-blocked">—</div>
  <div class="stat-tile" id="stat-rate">—</div>
  <div class="stat-tile" id="stat-step">—</div>
</div>
```

Replace with:

```html
<div class="stat-tiles">
  <div class="stat-tile stat-tile--saved" id="stat-saved">
    <span class="stat-value">—</span>
    <span class="stat-label">Saved</span>
  </div>
  <div class="stat-tile stat-tile--blocked" id="stat-blocked">
    <span class="stat-value">—</span>
    <span class="stat-label">Blocked</span>
  </div>
  <div class="stat-tile stat-tile--rate" id="stat-rate">
    <span class="stat-value">—</span>
    <span class="stat-label">Cancel Rate</span>
  </div>
  <div class="stat-tile stat-tile--step" id="stat-step">
    <span class="stat-value">—</span>
    <span class="stat-label">Best Step</span>
  </div>
</div>
```

Note: the `id` attributes stay on the outer div — `stats.ts` queries by these IDs and then uses `.querySelector('.stat-value')` to reach the inner span.

- [ ] **Step 2: Commit HTML only**

```bash
git add src/popup/popup.html
git commit -m "fix: restructure stat tiles for value/label split (#1 html)"
```

---

### Task 4: Stat tiles — CSS (Fix 1, part B)

**Files:**
- Modify: `src/popup/popup.css`

- [ ] **Step 1: Update `.stat-tiles` container**

Find:
```css
.stat-tiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 10px;
}
```
Change `gap: 6px` → `gap: 8px` and `margin-bottom: 10px` → `margin-bottom: 12px`.

- [ ] **Step 2: Replace `.stat-tile` rule**

Find:
```css
.stat-tile {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 8px 10px;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
}
```

Replace entirely with:
```css
.stat-tile {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 12px 10px;
  min-height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.stat-value {
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
  color: var(--text-primary);
}
.stat-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}
.stat-tile--saved .stat-value  { color: var(--success); }
.stat-tile--rate  .stat-value  { color: #f59e0b; }
.stat-tile--step  .stat-value  { color: var(--accent); }
/* stat-tile--blocked intentionally has no override — inherits var(--text-primary) from .stat-value default */
```

- [ ] **Step 3: Build to verify**

```bash
npm run build
```
Expected: succeeds. If it fails, do NOT retry — report to user.

- [ ] **Step 4: Commit**

```bash
git add src/popup/popup.css
git commit -m "fix: stat tile sizing and color coding (#1 css)"
```

---

### Task 5: Stat tiles — TypeScript (Fix 1, part C)

**Files:**
- Modify: `src/popup/sections/stats.ts`

- [ ] **Step 1: Update refreshStats() to target .stat-value children**

In `src/popup/sections/stats.ts`, find the `refreshStats` **inner function declared inside `initStats()`** (approximately lines 87–93 of the file — it is not a top-level function, it is a closure inside the `initStats` factory function):

```ts
async function refreshStats(): Promise<void> {
  const stats = await computePopupStats();
  savedEl.textContent = `$${stats.savedTotal.toFixed(2)} saved`;
  blockedEl.textContent = `${stats.blockedCount} blocked`;
  rateEl.textContent = `${Math.round(stats.cancelRate)}% cancel rate`;
  stepEl.textContent = stats.mostEffectiveStep != null ? `Step ${stats.mostEffectiveStep}` : '—';
}
```

Replace with:

```ts
async function refreshStats(): Promise<void> {
  const stats = await computePopupStats();
  const sv = (el: HTMLElement) => el.querySelector<HTMLElement>('.stat-value');
  sv(savedEl)?.textContent !== undefined && (sv(savedEl)!.textContent = `$${stats.savedTotal.toFixed(2)}`);
  sv(blockedEl)!.textContent = `${stats.blockedCount}`;
  sv(rateEl)!.textContent   = `${Math.round(stats.cancelRate)}%`;
  sv(stepEl)!.textContent   = stats.mostEffectiveStep != null ? `Step ${stats.mostEffectiveStep}` : '—';
}
```

Actually, keep it readable — use direct optional chaining:

```ts
async function refreshStats(): Promise<void> {
  const stats = await computePopupStats();
  const saved = savedEl.querySelector<HTMLElement>('.stat-value');
  const blocked = blockedEl.querySelector<HTMLElement>('.stat-value');
  const rate = rateEl.querySelector<HTMLElement>('.stat-value');
  const step = stepEl.querySelector<HTMLElement>('.stat-value');
  if (saved)   saved.textContent   = `$${stats.savedTotal.toFixed(2)}`;
  if (blocked) blocked.textContent = `${stats.blockedCount}`;
  if (rate)    rate.textContent    = `${Math.round(stats.cancelRate)}%`;
  if (step)    step.textContent    = stats.mostEffectiveStep != null
    ? `Step ${stats.mostEffectiveStep}`
    : '—';
}
```

- [ ] **Step 2: Build to verify**

```bash
npm run build
```
Expected: succeeds. If it fails, do NOT retry — report to user.

- [ ] **Step 3: Commit**

```bash
git add src/popup/sections/stats.ts
git commit -m "fix: stat tiles target .stat-value child for text (#1 ts)"
```

---

## Chunk 2: Scroll Spy + Theme + Channel Detection + Wrap-up

### Task 6: Scroll spy rootMargin fix (Fix 2)

**Files:**
- Modify: `src/popup/scrollSpy.ts`

- [ ] **Step 1: Change rootMargin**

In `src/popup/scrollSpy.ts`, find the `IntersectionObserver` constructor call:

```ts
const observer = new IntersectionObserver(
  (entries) => { ... },
  {
    root: contentEl,
    rootMargin: '-20% 0px -70% 0px',
    threshold: 0,
  }
);
```

Change `rootMargin: '-20% 0px -70% 0px'` to `rootMargin: '0px 0px -80% 0px'`.

- [ ] **Step 2: Build to verify**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/popup/scrollSpy.ts
git commit -m "fix: scroll spy rootMargin so Stats nav re-activates on scroll up (#2)"
```

---

### Task 7: Light mode CSS variables (Fix 3, part A)

**Files:**
- Modify: `src/popup/popup.css`

- [ ] **Step 1: Add light mode CSS block**

In `src/popup/popup.css`, immediately after the closing `}` of the `:root { ... }` block (after line 17), add:

```css
/* ─── Light mode overrides ───────────────────────────────── */
[data-theme="light"] {
  --bg-primary:    #ffffff;
  --bg-secondary:  #f4f4f5;
  --bg-input:      #e9e9ec;
  --border-color:  #d4d4d8;
  --text-primary:  #18181b;
  --text-secondary:#3f3f46;
  --text-muted:    #71717a;
}
```

Only these seven variables. `--accent`, `--danger`, `--success`, `--radius`, `--font` are intentionally left at dark-mode values for this pass.

- [ ] **Step 2: Build to verify**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/popup/popup.css
git commit -m "fix: add light mode CSS variable overrides (#3 css)"
```

---

### Task 8: Theme wiring — settings callback + applyTheme (Fix 3, part B)

**Files:**
- Modify: `src/popup/sections/settings-section.ts`
- Modify: `src/popup/popup.ts`

#### Part A — settings-section.ts

- [ ] **Step 1: Add SettingsSectionCallbacks interface and onThemeChange**

In `src/popup/sections/settings-section.ts`:

1. Import `ThemePreference` — it's already imported: `import { UserSettings, ThemePreference } from '../../shared/types';` (verify this; if not imported, add it).

2. Add a callbacks interface after the existing `SettingsSectionController` interface:

```ts
export interface SettingsSectionCallbacks {
  onThemeChange?: (theme: ThemePreference) => void;
}
```

3. Change the function signature from:
```ts
export function initSettingsSection(el: HTMLElement): SettingsSectionController {
```
to:
```ts
export function initSettingsSection(el: HTMLElement, callbacks: SettingsSectionCallbacks = {}): SettingsSectionController {
```

4. In the existing `themeEl.addEventListener('change', ...)` handler, add a call to the callback **before** `setPendingField`:

Current handler:
```ts
themeEl.addEventListener('change', () => {
  setPendingField('theme', themeEl.value as ThemePreference);
});
```

Replace with:
```ts
themeEl.addEventListener('change', () => {
  const theme = themeEl.value as ThemePreference;
  callbacks.onThemeChange?.(theme);
  setPendingField('theme', theme);
});
```

#### Part B — popup.ts

- [ ] **Step 2: Add applyTheme to popup.ts**

In `src/popup/popup.ts`, find the existing import from `'../shared/types'` (line 3):
```ts
import { migrateSettings } from '../shared/types';
```
Add `ThemePreference` to it — do NOT add a second import from the same module:
```ts
import { migrateSettings, ThemePreference } from '../shared/types';
```

Then add the following **before** the `async function main()` declaration:

```ts
let activeMql: MediaQueryList | null = null;
let mqlHandler: (() => void) | null = null;

function applyTheme(theme: ThemePreference): void {
  // Always clean up any existing MQL listener first
  if (activeMql && mqlHandler) {
    activeMql.removeEventListener('change', mqlHandler);
    activeMql = null;
    mqlHandler = null;
  }

  let resolved: 'light' | 'dark';
  if (theme === 'auto') {
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    resolved = mql.matches ? 'light' : 'dark';
    mqlHandler = () => applyTheme('auto');
    activeMql = mql;
    mql.addEventListener('change', mqlHandler);
  } else {
    resolved = theme;
  }

  document.documentElement.dataset.theme = resolved;
}
```

Note: `ThemePreference` is already defined in `src/shared/types.ts` as `'light' | 'dark' | 'auto'`. Verify the import path is correct relative to `popup.ts` location (`src/popup/`).

- [ ] **Step 3: Wire applyTheme on load and on change**

In `popup.ts`, find the `initSettingsSection(settingsEl)` call:

```ts
const settingsSection = initSettingsSection(settingsEl);
```

Replace with:

```ts
const settingsSection = initSettingsSection(settingsEl, {
  onThemeChange: (v) => applyTheme(v),
});
```

Then, after `renderAll()` in `main()`, add:

```ts
applyTheme(settings.theme);
```

- [ ] **Step 4: Build to verify**

```bash
npm run build
```
Expected: no TypeScript errors, build succeeds. If it fails, do NOT retry — report to user.

- [ ] **Step 5: Commit**

```bash
git add src/popup/sections/settings-section.ts src/popup/popup.ts
git commit -m "fix: wire theme application to DOM via applyTheme (#3 ts)"
```

---

### Task 9: Auto-detect channel from active tab (Fix 6)

**Files:**
- Modify: `src/popup/sections/channels.ts`
- Create: `tests/popup/sections/channels.test.ts`

The URL parsing logic is extracted as a pure exported function so it can be unit tested without mocking Chrome APIs.

- [ ] **Step 1: Write the failing test**

Create `tests/popup/sections/channels.test.ts` — note this requires creating the `tests/popup/sections/` subdirectory (it does not yet exist). The import path `'../../../src/popup/sections/channels'` is correct for this three-level-deep location.

```ts
import { extractTwitchSlug } from '../../../src/popup/sections/channels';

describe('extractTwitchSlug', () => {
  test('returns channel slug from standard twitch.tv URL', () => {
    expect(extractTwitchSlug('https://www.twitch.tv/somechannel')).toBe('somechannel');
  });

  test('returns channel slug from twitch.tv without www', () => {
    expect(extractTwitchSlug('https://twitch.tv/anotherchannel')).toBe('anotherchannel');
  });

  test('returns null for reserved path: directory', () => {
    expect(extractTwitchSlug('https://www.twitch.tv/directory')).toBeNull();
  });

  test('returns null for reserved path: search', () => {
    expect(extractTwitchSlug('https://www.twitch.tv/search')).toBeNull();
  });

  test('returns null for reserved path: clips', () => {
    expect(extractTwitchSlug('https://www.twitch.tv/clips/someclip')).toBeNull();
  });

  test('returns null for reserved path: settings', () => {
    expect(extractTwitchSlug('https://www.twitch.tv/settings/profile')).toBeNull();
  });

  test('returns null for non-twitch URL', () => {
    expect(extractTwitchSlug('https://www.youtube.com/watch?v=abc')).toBeNull();
  });

  test('returns null for lookalike domain (endsWith check would incorrectly match)', () => {
    // notwitch.tv ends with "twitch.tv" — implementation must use === or .endsWith('.twitch.tv')
    expect(extractTwitchSlug('https://notwitch.tv/channel')).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(extractTwitchSlug('')).toBeNull();
  });

  test('returns null for undefined/malformed URL', () => {
    expect(extractTwitchSlug('not-a-url')).toBeNull();
  });

  test('lowercases the slug', () => {
    expect(extractTwitchSlug('https://www.twitch.tv/SomeChannel')).toBe('somechannel');
  });

  test('returns null when only the root twitch.tv path', () => {
    expect(extractTwitchSlug('https://www.twitch.tv/')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest tests/popup/sections/channels.test.ts --no-coverage
```
Expected: FAIL — `extractTwitchSlug is not exported` or similar. If it passes, something is wrong — stop and investigate.

- [ ] **Step 3: Export extractTwitchSlug from channels.ts**

At the top of `src/popup/sections/channels.ts`, after the imports, add the reserved paths set and the pure function:

```ts
const RESERVED_TWITCH_PATHS = new Set([
  'directory', 'search', 'following', 'subscriptions', 'wallet',
  'settings', 'downloads', 'jobs', 'p', 'products', 'videos',
  'clips', 'schedule', 'about', 'moderator', 'login', 'signup',
  'friends', 'inbox', 'drops', 'prime',
]);

/**
 * Extracts a Twitch channel slug from a URL string.
 * Returns null if the URL is not a Twitch channel page.
 * Exported for unit testing.
 */
export function extractTwitchSlug(url: string): string | null {
  try {
    const parsed = new URL(url);
    const h = parsed.hostname;
    // Must be exactly twitch.tv or a subdomain (.twitch.tv)
    // NOT just .endsWith('twitch.tv') — that incorrectly matches notwitch.tv
    if (h !== 'twitch.tv' && !h.endsWith('.twitch.tv')) return null;
    const slug = parsed.pathname.split('/')[1]?.toLowerCase();
    if (!slug || RESERVED_TWITCH_PATHS.has(slug)) return null;
    return slug;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest tests/popup/sections/channels.test.ts --no-coverage
```
Expected: all 12 tests PASS.

- [ ] **Step 5: Add auto-detect call in initChannels()**

In `src/popup/sections/channels.ts`, inside `initChannels()`, after the line where `whitelistInputEl` is assigned (after all `el.querySelector` calls, before the event listeners), add:

```ts
// Auto-detect current Twitch channel from active tab
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs.length) return;
  const slug = extractTwitchSlug(tabs[0]?.url ?? '');
  if (slug) whitelistInputEl.value = slug;
});
```

- [ ] **Step 6: Run full test suite**

```bash
npx jest --no-coverage
```
Expected: all tests pass.

- [ ] **Step 7: Build to verify**

```bash
npm run build
```

- [ ] **Step 8: Commit**

```bash
git add src/popup/sections/channels.ts tests/popup/sections/channels.test.ts
git commit -m "fix: auto-detect Twitch channel slug from active tab (#6)"
```

---

### Task 10: Version bump + final build

**Files:**
- Modify: `manifest.json`
- Modify: `package.json`

Per CLAUDE.md: bump version in both files BEFORE the build. Only bump patch. Current version: `0.4.10` → `0.4.11`.

- [ ] **Step 1: Bump version in manifest.json**

In `manifest.json`, change:
```json
"version": "0.4.10"
```
to:
```json
"version": "0.4.11"
```

- [ ] **Step 2: Bump version in package.json**

In `package.json`, change:
```json
"version": "0.4.10"
```
to:
```json
"version": "0.4.11"
```

- [ ] **Step 3: Build**

```bash
npm run build
```
Expected: succeeds. If it fails, do NOT retry — report to user to run manually.

- [ ] **Step 4: Update HypeControl-TODO.md**

In `HypeControl-TODO.md`:
- Update `**Current Version:**` in the header — it currently reads `0.4.9` (stale) — overwrite it with `0.4.11`
- Update `_Last updated_` footer date to today's date (2026-03-12)

- [ ] **Step 5: Final commit**

```bash
git add manifest.json package.json HypeControl-TODO.md
git commit -m "chore: bump to v0.4.11 — UI polish fixes"
```

---

## Manual Verification Checklist

After the build, load the unpacked extension in Chrome (`chrome://extensions` → Load unpacked → select `dist/`) and verify:

- [ ] Stat tiles show colored values (green saved, white blocked, amber rate, purple step) with uppercase labels below
- [ ] Stat tiles have more breathing room than before
- [ ] Scrolling down past Stats section and scrolling back up re-highlights "Stats" in the nav
- [ ] Settings → Theme → Light mode applies a light background/text throughout the popup
- [ ] Settings → Theme → Auto respects OS preference
- [ ] Settings → Theme → Dark returns to dark mode
- [ ] Bug and Ideas links in footer are clearly readable (not dim)
- [ ] Right nav is slightly narrower, main content area has more room
- [ ] Opening popup while on a Twitch channel page (e.g. twitch.tv/somestreamer) → Channels section whitelist input is pre-populated with the channel name
- [ ] Opening popup while NOT on Twitch → whitelist input is empty
- [ ] Opening popup on twitch.tv/directory or twitch.tv/search → whitelist input is empty
