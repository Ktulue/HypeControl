# Input Validation Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add defense-in-depth input validation with sanitize gates on both storage write and read paths, fix the remaining XSS vector, and harden Twitch DOM price extraction.

**Architecture:** Two shared sanitizer functions (`sanitizeSettings()` and `sanitizeTracker()`) gate every storage write and read path. `sanitizeSettings()` clamps numerics, validates enums and booleans, sanitizes strings, and filters invalid array entries. `migrateSettings()` calls it as the read-side gate. The XSS fix converts one innerHTML template to DOM construction. The detector fix guards `parsePrice()` against NaN/Infinity.

**Tech Stack:** TypeScript, Chrome Extension MV3, webpack

**Spec:** `docs/superpowers/specs/2026-03-16-input-validation-hardening-design.md`

**IMPORTANT: Do NOT bump versions. The version bump happens once at the end, not per-task.**

---

## Chunk 1: Core Sanitizers

### Task 1: Implement `sanitizeSettings()` in types.ts

**Files:**
- Modify: `src/shared/types.ts` (after `migrateSettings()`, ~line 321)

- [ ] **Step 1: Add helper functions**

Add these private helpers above `sanitizeSettings()` in `src/shared/types.ts`:

```typescript
/** Clamp a number to [min, max], replacing NaN/Infinity with fallback */
function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  const n = typeof val === 'number' ? val : fallback;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** Round to 2 decimal places (currency) */
function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

/** Force a value to strict boolean (=== true) */
function strictBool(val: unknown, fallback: boolean = false): boolean {
  return val === true ? true : fallback;
}

/** Validate a value is one of the allowed options */
function validEnum<T>(val: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(val as T) ? (val as T) : fallback;
}

/** Strip HTML tags from a string */
function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}
```

- [ ] **Step 2: Implement sanitizeSettings()**

Add below the helpers:

```typescript
/** Sanitize a UserSettings object — clamps numerics, validates enums/booleans, filters arrays */
export function sanitizeSettings(s: UserSettings): UserSettings {
  // Numeric fields (currency values get round2)
  const hourlyRate = round2(clampNum(s.hourlyRate, 0.01, 1000, DEFAULT_SETTINGS.hourlyRate));
  const taxRate = round2(clampNum(s.taxRate, 0, 25, DEFAULT_SETTINGS.taxRate));

  // Friction thresholds
  let thresholdFloor = round2(clampNum(s.frictionThresholds.thresholdFloor, 0, 999.99, DEFAULT_SETTINGS.frictionThresholds.thresholdFloor));
  let thresholdCeiling = round2(clampNum(s.frictionThresholds.thresholdCeiling, 0.01, 1000, DEFAULT_SETTINGS.frictionThresholds.thresholdCeiling));
  if (thresholdCeiling <= thresholdFloor) {
    thresholdCeiling = round2(thresholdFloor + 0.01);
  }

  // Cap amounts
  const dailyCapAmount = round2(clampNum(s.dailyCap.amount, 0, 100000, DEFAULT_SETTINGS.dailyCap.amount));
  const weeklyCapAmount = round2(clampNum(s.weeklyCap.amount, 0, 100000, DEFAULT_SETTINGS.weeklyCap.amount));
  const monthlyCapAmount = round2(clampNum(s.monthlyCap.amount, 0, 100000, DEFAULT_SETTINGS.monthlyCap.amount));

  // Other numerics
  const cooldownMinutes = clampNum(s.cooldown.minutes, 0, 1440, DEFAULT_SETTINGS.cooldown.minutes);
  const gracePeriodMinutes = clampNum(s.streamingMode.gracePeriodMinutes, 0, 60, DEFAULT_SETTINGS.streamingMode.gracePeriodMinutes);
  const toastDurationSeconds = clampNum(s.toastDurationSeconds, 1, 30, DEFAULT_SETTINGS.toastDurationSeconds);
  const softNudgeSteps = clampNum(s.frictionThresholds.softNudgeSteps, 1, 10, DEFAULT_SETTINGS.frictionThresholds.softNudgeSteps);

  // Enum fields
  const frictionIntensity = validEnum(s.frictionIntensity, ['low', 'medium', 'high', 'extreme'] as const, DEFAULT_SETTINGS.frictionIntensity);
  const delaySeconds = validEnum(s.delayTimer.seconds, [5, 10, 30, 60] as const, DEFAULT_SETTINGS.delayTimer.seconds);
  const theme = validEnum(s.theme, ['auto', 'light', 'dark'] as const, DEFAULT_SETTINGS.theme);
  const weeklyResetDay = validEnum(s.weeklyResetDay, ['monday', 'sunday'] as const, DEFAULT_SETTINGS.weeklyResetDay);

  // Comparison items — sanitize each, deduplicate, remove invalid
  const seenIds = new Set<string>();
  const comparisonItems = s.comparisonItems
    .map(item => sanitizeComparisonItem(item))
    .filter((item): item is ComparisonItem => {
      if (item === null) return false;
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });

  // Whitelist entries — validate and filter
  const whitelistedChannels = s.whitelistedChannels
    .filter(e => /^[a-z0-9_]{1,25}$/.test(e.username))
    .map(e => ({
      username: e.username,
      behavior: validEnum(e.behavior, ['skip', 'reduced', 'full'] as const, 'full' as WhitelistBehavior),
    }));

  // Streaming mode username
  const twitchUsername = /^[a-z0-9_]{0,25}$/.test(s.streamingMode.twitchUsername)
    ? s.streamingMode.twitchUsername
    : '';

  // Streaming override
  const streamingOverride = s.streamingOverride
    && typeof s.streamingOverride.expiresAt === 'number'
    && Number.isFinite(s.streamingOverride.expiresAt)
    && s.streamingOverride.expiresAt > 0
    ? { expiresAt: s.streamingOverride.expiresAt }
    : undefined;

  const result: UserSettings = {
    hourlyRate,
    taxRate,
    comparisonItems,
    cooldown: {
      enabled: strictBool(s.cooldown.enabled),
      minutes: cooldownMinutes,
    },
    dailyCap: {
      enabled: strictBool(s.dailyCap.enabled),
      amount: dailyCapAmount,
    },
    weeklyCap: {
      enabled: strictBool(s.weeklyCap.enabled),
      amount: weeklyCapAmount,
    },
    monthlyCap: {
      enabled: strictBool(s.monthlyCap.enabled),
      amount: monthlyCapAmount,
    },
    frictionThresholds: {
      enabled: strictBool(s.frictionThresholds.enabled),
      thresholdFloor,
      thresholdCeiling,
      softNudgeSteps,
    },
    frictionIntensity,
    delayTimer: {
      enabled: strictBool(s.delayTimer.enabled),
      seconds: delaySeconds,
    },
    streamingMode: {
      enabled: strictBool(s.streamingMode.enabled),
      twitchUsername,
      gracePeriodMinutes,
      logBypassed: strictBool(s.streamingMode.logBypassed, true),
    },
    toastDurationSeconds,
    whitelistedChannels,
    theme,
    weeklyResetDay,
    intensityLocked: strictBool(s.intensityLocked),
  };

  if (streamingOverride) {
    result.streamingOverride = streamingOverride;
  }

  return result;
}
```

- [ ] **Step 3: Add sanitizeComparisonItem() helper**

Add above `sanitizeSettings()`:

```typescript
/** Sanitize a single comparison item. Returns null if the item is invalid and should be removed. */
function sanitizeComparisonItem(item: ComparisonItem): ComparisonItem | null {
  // ID must be a non-empty string
  if (typeof item.id !== 'string' || item.id.trim() === '') return null;

  // Name: trim, strip HTML, cap at 50 chars
  const name = stripHtml((typeof item.name === 'string' ? item.name : '').trim()).slice(0, 50);
  if (name === '') return null;

  // Price: must be positive, finite, ≤ 100000
  const price = round2(clampNum(item.price, 0.01, 100000, 0));
  if (price <= 0) return null;

  // PluralLabel: same treatment as name
  const pluralLabel = stripHtml((typeof item.pluralLabel === 'string' ? item.pluralLabel : '').trim()).slice(0, 50);

  // Emoji: cap at 2 grapheme characters
  const emojiStr = typeof item.emoji === 'string' ? item.emoji : '';
  const emoji = [...emojiStr].slice(0, 2).join('');

  return {
    id: item.id,
    emoji,
    name,
    price,
    pluralLabel: pluralLabel || name,
    enabled: strictBool(item.enabled),
    isPreset: strictBool(item.isPreset),
    frictionScope: validEnum(item.frictionScope, ['nudge', 'full', 'both'] as const, 'both'),
  };
}
```

- [ ] **Step 4: Build and verify no compile errors**

Run: `npm run build`
Expected: Successful build with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add sanitizeSettings() with helpers for input validation"
```

---

### Task 2: Implement `sanitizeTracker()` in types.ts

**Files:**
- Modify: `src/shared/types.ts` (after `sanitizeSettings()`)

- [ ] **Step 1: Add sanitizeTracker()**

Add after `sanitizeSettings()`:

```typescript
/** Sanitize a SpendingTracker object — clamps totals, validates dates and timestamps */
export function sanitizeTracker(t: SpendingTracker): SpendingTracker {
  const sanitizeTotal = (val: unknown): number => {
    const n = typeof val === 'number' ? val : 0;
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 100) / 100;
  };

  // Validate date strings — reset to '' if invalid format
  const validDate = (val: unknown, pattern: RegExp): string => {
    if (typeof val !== 'string') return '';
    return pattern.test(val) ? val : '';
  };

  // lastProceedTimestamp: null or positive finite number
  let lastProceedTimestamp: number | null = null;
  if (typeof t.lastProceedTimestamp === 'number'
    && Number.isFinite(t.lastProceedTimestamp)
    && t.lastProceedTimestamp > 0) {
    lastProceedTimestamp = t.lastProceedTimestamp;
  }

  return {
    lastProceedTimestamp,
    dailyTotal: sanitizeTotal(t.dailyTotal),
    dailyDate: validDate(t.dailyDate, /^\d{4}-\d{2}-\d{2}$/),
    sessionTotal: sanitizeTotal(t.sessionTotal),
    sessionChannel: typeof t.sessionChannel === 'string' ? t.sessionChannel : '',
    weeklyTotal: sanitizeTotal(t.weeklyTotal),
    weeklyStartDate: validDate(t.weeklyStartDate, /^\d{4}-\d{2}-\d{2}$/),
    monthlyTotal: sanitizeTotal(t.monthlyTotal),
    monthlyMonth: validDate(t.monthlyMonth, /^\d{4}-\d{2}$/),
  };
}
```

- [ ] **Step 2: Build and verify no compile errors**

Run: `npm run build`
Expected: Successful build with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add sanitizeTracker() for spending data validation"
```

---

### Task 3: Wire `sanitizeSettings()` into `migrateSettings()` (read-side gate)

**Files:**
- Modify: `src/shared/types.ts:321` (end of `migrateSettings()`)

- [ ] **Step 1: Add sanitizeSettings() call at end of migrateSettings()**

In `migrateSettings()`, the return statement starts at line 273. Replace the final `return { ... };` by wrapping the entire object in `sanitizeSettings()`:

Change the last line of `migrateSettings()` from:
```typescript
  return {
    hourlyRate: saved.hourlyRate ?? DEFAULT_SETTINGS.hourlyRate,
    ...
  };
```

To:
```typescript
  return sanitizeSettings({
    hourlyRate: saved.hourlyRate ?? DEFAULT_SETTINGS.hourlyRate,
    ...
  });
```

Specifically, change line 273 from `return {` to `return sanitizeSettings({` and line 320 from `};` to `});`.

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: Successful build.

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: wire sanitizeSettings() into migrateSettings() as read-side gate"
```

---

## Chunk 2: Write-Side Gates

### Task 4: Gate popup settings saves with `sanitizeSettings()`

**Files:**
- Modify: `src/popup/popup.ts:301` (main save button)
- Modify: `src/popup/popup.ts:153` (wizard skip save)
- Modify: `src/popup/popup.ts:169` (wizard complete save)

- [ ] **Step 1: Add import**

At the top of `src/popup/popup.ts`, find the import from `../shared/types` and add `sanitizeSettings`:

```typescript
import { ..., sanitizeSettings } from '../shared/types';
```

- [ ] **Step 2: Gate the main save path (line 301)**

Change line 301 from:
```typescript
await chrome.storage.sync.set({ [SETTINGS_KEY]: getPending() });
```

To:
```typescript
await chrome.storage.sync.set({ [SETTINGS_KEY]: sanitizeSettings(getPending()) });
```

- [ ] **Step 3: Gate the wizard complete save (line 169)**

Change line 169 from:
```typescript
await chrome.storage.sync.set({ hcSettings: updated });
```

To:
```typescript
await chrome.storage.sync.set({ hcSettings: sanitizeSettings(updated) });
```

- [ ] **Step 4: Build and verify**

Run: `npm run build`
Expected: Successful build. (Line 153 saves `DEFAULT_SETTINGS` directly — no sanitization needed since defaults are trusted constants.)

- [ ] **Step 5: Commit**

```bash
git add src/popup/popup.ts
git commit -m "feat: gate popup settings saves with sanitizeSettings()"
```

---

### Task 5: Gate options page saves with `sanitizeSettings()`

**Files:**
- Modify: `src/options/options.ts:38` (saveSettings function)

- [ ] **Step 1: Add import**

At the top of `src/options/options.ts`, add `sanitizeSettings` to the existing types import:

```typescript
import { ..., sanitizeSettings } from '../shared/types';
```

- [ ] **Step 2: Gate saveSettings()**

Change the `saveSettings` function (line 37-39) from:
```typescript
async function saveSettings(settings: UserSettings): Promise<void> {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
}
```

To:
```typescript
async function saveSettings(settings: UserSettings): Promise<void> {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: sanitizeSettings(settings) });
}
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Successful build.

- [ ] **Step 4: Commit**

```bash
git add src/options/options.ts
git commit -m "feat: gate options page saves with sanitizeSettings()"
```

---

### Task 6: Gate interceptor whitelist save with `sanitizeSettings()`

**Files:**
- Modify: `src/content/interceptor.ts:1988` (onWhitelistAdd save)

- [ ] **Step 1: Add import**

At the top of `src/content/interceptor.ts`, add `sanitizeSettings` to the existing types import:

```typescript
import { ..., sanitizeSettings } from '../shared/types';
```

- [ ] **Step 2: Gate the whitelist quick-add save (line 1988)**

Change line 1988 from:
```typescript
await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
```

To:
```typescript
await chrome.storage.sync.set({ [SETTINGS_KEY]: sanitizeSettings(settings) });
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Successful build.

- [ ] **Step 4: Commit**

```bash
git add src/content/interceptor.ts
git commit -m "feat: gate interceptor whitelist save with sanitizeSettings()"
```

---

### Task 7: Gate popup streaming override saves with `sanitizeSettings()`

**Files:**
- Modify: `src/popup/sections/stats.ts:36-48` (streaming override toggle)

**Note:** The current code loads settings as `Partial<UserSettings>` (line 38). Since `sanitizeSettings()` requires a full `UserSettings`, we must load via `migrateSettings()` first to get a complete object.

- [ ] **Step 1: Add imports**

At the top of `src/popup/sections/stats.ts`, update the types import:

```typescript
import { UserSettings, migrateSettings, sanitizeSettings } from '../../shared/types';
```

- [ ] **Step 2: Refactor the override button handler to use migrateSettings()**

Replace the click handler block (lines 36-51) with:

```typescript
  // Wire override button (immediate save — bypasses pending state)
  overrideBtnEl.addEventListener('click', async () => {
    const result = await chrome.storage.sync.get(SETTINGS_KEY);
    const current = migrateSettings(result[SETTINGS_KEY] ?? {});
    const isActive = !!(current.streamingOverride && current.streamingOverride.expiresAt > Date.now());
    if (isActive) {
      const updated = { ...current };
      delete updated.streamingOverride;
      await chrome.storage.sync.set({ [SETTINGS_KEY]: sanitizeSettings(updated) });
    } else {
      await chrome.storage.sync.set({
        [SETTINGS_KEY]: sanitizeSettings({ ...current, streamingOverride: { expiresAt: Date.now() + 2 * 60 * 60 * 1000 } }),
      });
    }
    const fresh = await chrome.storage.sync.get(SETTINGS_KEY);
    renderOverride(fresh[SETTINGS_KEY] ?? {});
  });
```

This ensures `current` is a full `UserSettings` (via `migrateSettings()`) before passing to `sanitizeSettings()`.

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Successful build.

- [ ] **Step 4: Commit**

```bash
git add src/popup/sections/stats.ts
git commit -m "feat: gate popup streaming override saves with sanitizeSettings()"
```

---

## Chunk 3: SpendingTracker Gates

### Task 8: Gate spending tracker load and save with `sanitizeTracker()`

**Files:**
- Modify: `src/content/interceptor.ts:85-119` (loadSpendingTracker)
- Modify: `src/content/interceptor.ts:121-127` (saveSpendingTracker)

- [ ] **Step 1: Add import**

In `src/content/interceptor.ts`, add `sanitizeTracker` to the types import (may already have `sanitizeSettings` from Task 6):

```typescript
import { ..., sanitizeSettings, sanitizeTracker } from '../shared/types';
```

- [ ] **Step 2: Gate the load path**

In `loadSpendingTracker()` (~line 86), after loading from storage and before the backfill logic, apply sanitization. Change:

```typescript
const tracker: SpendingTracker = result[SPENDING_KEY] || { ...DEFAULT_SPENDING_TRACKER };
```

To:

```typescript
const tracker: SpendingTracker = sanitizeTracker(result[SPENDING_KEY] || { ...DEFAULT_SPENDING_TRACKER });
```

- [ ] **Step 3: Gate the save path**

In `saveSpendingTracker()` (~line 123), change:

```typescript
await chrome.storage.local.set({ [SPENDING_KEY]: tracker });
```

To:

```typescript
await chrome.storage.local.set({ [SPENDING_KEY]: sanitizeTracker(tracker) });
```

- [ ] **Step 4: Build and verify**

Run: `npm run build`
Expected: Successful build.

- [ ] **Step 5: Commit**

```bash
git add src/content/interceptor.ts
git commit -m "feat: gate spending tracker load/save with sanitizeTracker()"
```

---

## Chunk 4: XSS Fix & Detector Hardening

### Task 9: Fix XSS in options.ts comparison item rendering

**Files:**
- Modify: `src/options/options.ts:196-224` (renderComparisonItems innerHTML template)

- [ ] **Step 1: Replace innerHTML template with DOM construction**

In `renderComparisonItems()`, the current code (~lines 196-224) builds `scopeGroup` and `customControls` as HTML strings, then sets `row.innerHTML`. Replace this with DOM construction for all user-controlled values.

Replace the block from the `const customControls = ...` line through the `row.innerHTML = ...` closing backtick with:

```typescript
    // Build static skeleton — no user data interpolated
    const dragHandle = document.createElement('span');
    dragHandle.className = 'drag-handle';
    dragHandle.title = 'Drag to reorder';
    dragHandle.innerHTML = '&#x2261;';

    const toggleWrap = document.createElement('div');
    toggleWrap.className = 'item-toggle-wrap';

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'toggle-switch';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.itemId = item.id;
    if (item.enabled) checkbox.checked = true;
    const slider = document.createElement('span');
    slider.className = 'toggle-slider';
    toggleLabel.append(checkbox, slider);
    toggleWrap.appendChild(toggleLabel);

    if (item.enabled) {
      const scopeGroupEl = document.createElement('div');
      scopeGroupEl.className = 'scope-group';
      scopeGroupEl.dataset.scopeGroup = item.id;
      scopeGroupEl.setAttribute('role', 'radiogroup');
      scopeGroupEl.setAttribute('aria-label', `Friction scope for ${item.name}`);
      for (const scope of ['nudge', 'full', 'both'] as const) {
        const btn = document.createElement('button');
        btn.className = 'scope-btn';
        btn.dataset.scope = scope;
        btn.setAttribute('aria-pressed', item.frictionScope === scope ? 'true' : 'false');
        btn.textContent = scope.charAt(0).toUpperCase() + scope.slice(1);
        scopeGroupEl.appendChild(btn);
      }
      toggleWrap.appendChild(scopeGroupEl);
    }

    const infoSpan = document.createElement('span');
    infoSpan.className = 'comparison-item-info';
    const emojiSpan = document.createElement('span');
    emojiSpan.textContent = item.emoji;
    const nameSpan = document.createElement('span');
    nameSpan.textContent = item.name;
    const priceSpan = document.createElement('span');
    priceSpan.className = 'toggle-price';
    priceSpan.textContent = priceText;
    infoSpan.append(emojiSpan, nameSpan, priceSpan);

    row.append(dragHandle, toggleWrap, infoSpan);

    if (!item.isPreset) {
      const badge = document.createElement('span');
      badge.className = 'custom-badge';
      badge.textContent = 'custom';
      const editBtn = document.createElement('button');
      editBtn.className = 'btn-icon';
      editBtn.dataset.editId = item.id;
      editBtn.title = 'Edit';
      editBtn.innerHTML = '&#9998;';
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-icon danger';
      deleteBtn.dataset.deleteId = item.id;
      deleteBtn.title = 'Delete';
      deleteBtn.innerHTML = '&#10005;';
      row.append(badge, editBtn, deleteBtn);
    }
```

Also remove the now-unused `customControls` and `scopeGroup` string variables.

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: Successful build with no TypeScript errors.

- [ ] **Step 3: Visually verify in browser**

Load the extension, open the options page, verify comparison items render correctly — toggles, scope buttons, drag handles, edit/delete buttons all present and functional.

- [ ] **Step 4: Commit**

```bash
git add src/options/options.ts
git commit -m "fix: replace innerHTML with DOM construction for comparison items (XSS)"
```

---

### Task 10: Harden `parsePrice()` in detector.ts

**Files:**
- Modify: `src/content/detector.ts:203` (parsePrice function)

- [ ] **Step 1: Add NaN/Infinity guard**

Change `parsePrice()` (~line 201-203) from:

```typescript
function parsePrice(priceStr: string): number {
  return parseFloat(priceStr.replace(/,/g, ''));
}
```

To:

```typescript
function parsePrice(priceStr: string): number | null {
  const val = parseFloat(priceStr.replace(/,/g, ''));
  return Number.isFinite(val) ? val : null;
}
```

- [ ] **Step 2: Verify call sites need no changes**

`extractPrice()` already returns `{ raw: string | null; value: number | null }`. Since `parsePrice()` now returns `number | null` instead of `number`, all call sites (~lines 218, 227, 255, 267) are already type-compatible. No call-site changes needed.

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Successful build.

- [ ] **Step 4: Commit**

```bash
git add src/content/detector.ts
git commit -m "fix: guard parsePrice() against NaN/Infinity from Twitch DOM"
```

---

## Chunk 5: Version Bump, Build & Docs

### Task 11: Version bump, final build, and doc updates

**Files:**
- Modify: `manifest.json` (version bump)
- Modify: `package.json` (version bump)
- Modify: `MTS-TODO.md` (mark items complete)
- Modify: `MTS-Project-Document.md` (update status if applicable)

- [ ] **Step 1: Bump patch version in both files**

Increment the patch version (current → next patch) in both `manifest.json` and `package.json`. Check the current version first.

- [ ] **Step 2: Run final build**

Run: `npm run build`
Expected: Successful build. If this fails, do NOT retry — tell the user to run `npm run build` manually.

- [ ] **Step 3: Update MTS-TODO.md**

Mark any input-validation-related items as complete. Update the header date and version.

- [ ] **Step 4: Update MTS-Project-Document.md**

If there's a section about security or input validation, update it to reflect the hardening is complete.

- [ ] **Step 5: Commit all changes**

```bash
git add manifest.json package.json MTS-TODO.md MTS-Project-Document.md dist/
git commit -m "maint: version bump, update docs for input validation hardening"
```
