# UI Polish & Rebrand — Design Spec
**Date:** 2026-03-13
**Branch:** `feat/ui-polish-rebrand`
**Version target:** 0.4.14
**Status:** Approved

---

## Overview

A single-branch, shippable pass that addresses all 16 issues identified in the Impeccable audit (2026-03-13). Covers two categories of work in one PR:

1. **Visual rebrand** — Replace Twitch purple with HypeControl's own brand identity (Space Grotesk font, Electric Teal primary, Electric Green success), unify the two CSS token systems, and eliminate ~30 hardcoded color values.
2. **Hardening & cleanup** — Security fix for XSS vector, accessibility fixes (focus rings, label associations, ARIA tab pattern), performance fixes (progress bar animation, `transition: all`), and structural cleanup (logs page extraction, options page).

The extension must visually validate in both light and dark mode before the PR is opened. No new features. No new tests. No logic changes beyond the two targeted TypeScript fixes.

---

## Execution Approach

**File-by-file (Approach B).** Each file is touched exactly once in a defined sequence. This minimizes context switching, produces clean per-file commits, and maps directly to parallel subagent tasks.

### Sequencing

| Order | File | Category |
|-------|------|----------|
| 0 | `assets/fonts/` *(new dir)* | Font bundling (prerequisite for all CSS work) |
| 1 | `src/content/interceptor.ts` | Security + Performance |
| 2 | `src/popup/popup.css` | Rebrand + A11y + Cleanup |
| 3 | `src/content/styles.css` | Rebrand + Token sweep + Performance |
| 4 | `src/popup/popup.html` | A11y (label associations) |
| 5 | `src/logs/logs.html` | A11y (ARIA tabs) + Structural |
| 6 | `src/logs/logs.ts` | A11y (tab switching ARIA state) |
| 7 | `src/logs/logs.css` *(new)* | Structural (extracted + tokenized styles) |
| 8 | `src/options/options.html` | Cleanup (vestigial file — see note) |

---

## Brand Token System

### New Color Palette

| Token | Dark mode | Light mode | Purpose |
|-------|-----------|------------|---------|
| `--accent` / `--hc-primary` | `#06B6D4` | `#0891B2` | Primary brand color (Electric Teal) |
| `--accent-hover` / `--hc-primary-dark` | `#0891B2` | `#0E7490` | Hover state |
| `--success` / `--hc-success` | `#22C55E` | `#16A34A` | Savings / cancel / positive state |
| `--danger` / `--hc-danger` | `#E91916` | `#E91916` | Warnings / destructive actions |
| `--hc-warning` | `#F97316` | `#EA580C` | Grace badge, price notes (formalized) |
| `--hc-primary-light` | `rgba(6,182,212,0.12)` | `rgba(8,145,178,0.12)` | Whitelist note tint background |

### RGB Companion Tokens (for alpha derivation)

| Token | Value | Usage |
|-------|-------|-------|
| `--accent-rgb` / `--hc-primary-rgb` | `6, 182, 212` | `rgba(var(--hc-primary-rgb), 0.1)` |
| `--danger-rgb` / `--hc-danger-rgb` | `233, 25, 22` | Alpha danger tints |
| `--success-rgb` / `--hc-success-rgb` | `34, 197, 94` | Alpha success tints |

### Typography

**Font:** Space Grotesk, loaded locally from `assets/fonts/`. Weights: 400, 500, 600, 700.

**Loading strategy:** Local `@font-face` declarations in `popup.css` and `logs.css`, referencing bundled `.woff2` files. No CDN. No CSP changes required. No external dependency.

**Critical path note — webpack emits CSS flat to `dist/`:** The URL in `@font-face` must be relative to the *emitted* CSS file location (`dist/popup.css`, `dist/logs.css`), not the source file. Both will resolve fonts from `dist/assets/fonts/`. The correct path in both files is:

```css
@font-face {
  font-family: 'Space Grotesk';
  src: url('assets/fonts/SpaceGrotesk-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
/* repeat for 500, 600, 700 */
```

**Content script limitation:** `styles.css` is injected into Twitch pages as a content script. It does not share the font context with extension pages (popup, logs), so `@font-face` declared in `popup.css` is not available to it. Adding `--hc-font: 'Space Grotesk', sans-serif` to `styles.css` is still done for semantic consistency, but toast elements using `var(--hc-font)` will render in the browser's system `sans-serif` on Twitch pages. This is an acceptable fallback — the toast copy still reads with the correct voice. Loading the font in content script context requires `web_accessible_resources` manifest changes, which is out of scope for this branch.

**CSS variable update:**
- `popup.css`: `--font: 'Space Grotesk', sans-serif`
- `styles.css`: `--hc-font: 'Space Grotesk', sans-serif` (new token, applied to toast `font-family` — falls back to system sans-serif on Twitch pages; see content script limitation above)

---

## File-by-File Change Specifications

### 0. `assets/fonts/` *(new directory — do first)*

Download from Google Fonts static download (not CDN). Commit these four files:
- `SpaceGrotesk-Regular.woff2` (400)
- `SpaceGrotesk-Medium.woff2` (500)
- `SpaceGrotesk-SemiBold.woff2` (600)
- `SpaceGrotesk-Bold.woff2` (700)

License: SIL Open Font License 1.1 — safe to bundle and distribute in a Chrome extension.

Also verify `webpack.config.js` CopyPlugin includes `assets/fonts/` → `dist/assets/fonts/` in its patterns. If not present, add the copy rule.

---

### 1. `src/content/interceptor.ts`

**Issues addressed:** C-01 (XSS), H-01 (progress bar animation)

**C-01 — Reason button DOM construction:**

The XSS vector is the `${reason}` value interpolated into both `data-reason="${reason}"` and the button's text content inside `overlay.innerHTML`. The fix: remove reason buttons from the innerHTML template entirely, then build and append them via DOM construction after setting the modal shell.

```typescript
// Step 1: Set the modal shell via innerHTML WITHOUT reason buttons.
// The template should include an empty container element, e.g.:
// <div class="hc-reason-buttons" id="hc-reason-container"></div>
overlay.innerHTML = `...modal shell with empty #hc-reason-container...`;

// Step 2: Build and append reason buttons safely via DOM construction.
const container = overlay.querySelector('#hc-reason-container');
reasons.forEach(reason => {
  const btn = document.createElement('button');
  btn.className = 'hc-reason-btn';
  btn.setAttribute('data-reason', reason);  // setAttribute escapes attribute context
  btn.textContent = reason;                 // textContent escapes HTML context
  container.appendChild(btn);
});
```

All other `innerHTML` assignments in `interceptor.ts` interpolate only numeric values (step counts, timer durations, percentages) or internally-generated strings — no further changes required for those.

**H-01 — Progress bar animation:**

Replace `progressEl.style.width = \`${pct}%\`` at ~lines 734 and 942 with:
```typescript
progressEl.style.transform = `scaleX(${pct / 100})`;
```
The element needs `transform-origin: left` set in CSS (handled in Step 3 — `styles.css`). The JS update loop runs ~10×/sec — `transform` avoids layout recalculation on every tick.

---

### 2. `src/popup/popup.css`

**Issues addressed:** H-02 (font), H-03 (rebrand), H-05 (focus rings), M-06 (touch targets), L-01 (cursor)

- Add `@font-face` blocks for Space Grotesk 400/500/600/700 (use `assets/fonts/` path — see Typography section)
- Update `--font: 'Space Grotesk', sans-serif`
- Replace `--accent: #9146ff` → `#06B6D4`; `--accent-hover` → `#0891B2`
- Replace `--success: #00c896` → `#22C55E`
- Add `--accent-rgb: 6, 182, 212`, `--danger-rgb: 233, 25, 22`, `--success-rgb: 34, 197, 94` tokens
- Update `[data-theme="light"]` block: add teal/green light-mode variants (`--accent: #0891B2`, `--accent-hover: #0E7490`, `--success: #16A34A`)
- **Fix hardcoded rgba on `.nav-label.active`** (audit issue, line ~106): replace `rgba(145, 70, 255, 0.1)` → `rgba(var(--accent-rgb), 0.1)`
- Fix `.hc-input:focus`, `.hc-select:focus`: replace `outline: none` → `outline: 2px solid var(--accent); outline-offset: 2px`
- Bump `.seg-btn` padding: `4px 6px` → `8px 10px` (improves touch target height from ~20px to ~32px; full 44px not achievable without redesigning the segmented control — noted as accepted limitation)
- Bump `.btn-primary`, `.btn-secondary`, `.btn-danger` padding: `5px 12px` → `8px 14px`
- Remove `cursor: pointer` from `.footer-link` (redundant on `<a>`)

---

### 3. `src/content/styles.css`

**Issues addressed:** H-03 (rebrand), H-04 (hardcoded colors), M-04 (transition: all), M-05 (toast font), L-02 (color typo), L-04 (undeclared tokens)

- Update `--hc-primary: #9146ff` → `#06B6D4`; `--hc-primary-dark: #772ce8` → `#0891B2`
- Update `--hc-success: #00c853` → `#22C55E`
- Add to `:root`: `--hc-font: 'Space Grotesk', sans-serif`, `--hc-primary-rgb: 6, 182, 212`, `--hc-danger-rgb: 233, 25, 22`, `--hc-success-rgb: 34, 197, 94`, `--hc-warning: #F97316`, `--hc-primary-light: rgba(6,182,212,0.12)`
- Update `[data-theme="light"]` block: `--hc-primary: #0891B2`, `--hc-primary-dark: #0E7490`, `--hc-success: #16A34A`, `--hc-warning: #EA580C`, `--hc-primary-light: rgba(8,145,178,0.12)`. Replace hardcoded `#6b2fd6` whitelist tint → `var(--hc-primary-light)`. Retain `#c47600` amber for price note (semantic, not brand).
- Replace all ~30 hardcoded color instances with variable references. Specific lines: 37, 41, 142, 220, 222, 226–228, 232–234, 308, 404, 423, 442, 461, 473, 486, 494, 533, 543, 553, 560, 569. The `#9147ff` typo instances (lines 533, 543) are included in this count — they are part of the ~30, not additional. For alpha tints, use `rgba(var(--hc-primary-rgb), 0.1)` pattern.
- Replace `.hc-btn { transition: all 0.2s ease }` → `transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease`
- Update progress bar CSS: `transition: width 0.1s linear` → `transition: transform 0.1s linear`; add `transform-origin: left` to `.hc-progress-bar`
- Update toast `font-family: sans-serif` → `font-family: var(--hc-font)` on all 4 toast elements (lines ~411, 430, 449, 481). Note: falls back to system sans-serif in content script context — acceptable.

---

### 4. `src/popup/popup.html`

**Issues addressed:** M-01 (label associations)

Fix 7 unassociated `<label class="hc-label">` elements. No visual change — purely structural HTML. The `id` values below are verified against the current source.

| Location | Label text | Current | Fix |
|----------|-----------|---------|-----|
| Stats section, line 50 | "Intensity" | `<label class="hc-label">` (no `for`) | `<fieldset>` + `<legend>Intensity</legend>` wrapping `#stats-intensity` segmented control |
| Friction section, line 72 | "Intensity" | `<label class="hc-label">` (no `for`) | `<fieldset>` + `<legend>Intensity</legend>` wrapping `#friction-intensity` segmented control |
| Friction section, line 81 | "Delay timer" | `<label class="hc-label">` (no `for`) | Add `for="delay-enabled"` to the existing label element |
| Friction section, line 94 | "Thresholds" | `<label class="hc-label">` (no `for`) | Add `for="friction-thresholds-enabled"` to the existing label element |
| Limits section, line 156 | "Daily cap" | `<label class="hc-label">` (no `for`) | Add `for="daily-cap-enabled"` to the existing label element |
| Limits section, line 164 | "Spending cooldown" | `<label class="hc-label">` (no `for`) | Add `for="cooldown-enabled"` to the existing label element |
| Channels section, line 199 | "Streaming mode" | `<label class="hc-label">` (no `for`) | Add `for="streaming-mode-enabled"` to the existing label element |

**Rules:**
- Segmented controls (`#stats-intensity`, `#friction-intensity`) label a group of buttons, so they use `<fieldset>`/`<legend>`. The `<label>` element becomes `<legend>` inside the fieldset; the segmented div becomes the fieldset's content.
- Toggle labels ("Delay timer", "Thresholds", "Daily cap", "Spending cooldown", "Streaming mode") each target a single `<input type="checkbox">`. Simply add `for="<id>"` to the existing `<label class="hc-label">` element. The `<label class="toggle-wrap">` wrapping the checkbox may remain — two labels for one input is valid HTML.
- The "Thresholds" threshold input rows (`#threshold-floor`, `#threshold-ceiling`, `#threshold-nudge-steps`) already have correct individual labels — no change needed there.

---

### 5. `src/logs/logs.html`

**Issues addressed:** M-02 (ARIA tabs), M-03 (extract embedded styles)

- Remove entire `<style>` block
- Add `<link rel="stylesheet" href="logs.css">`
- Implement ARIA tab pattern on the tab controls and panels:

```html
<!-- BEFORE -->
<button class="tab-btn active" onclick="showTab('ext')">Extension Log</button>
<button class="tab-btn" onclick="showTab('settings')">Settings Log</button>
<div id="ext-log">...</div>
<div id="settings-log" style="display:none">...</div>

<!-- AFTER -->
<div role="tablist" aria-label="Log type">
  <button role="tab" id="tab-ext" aria-selected="true" aria-controls="ext-log" class="tab-btn active">Extension Log</button>
  <button role="tab" id="tab-settings" aria-selected="false" aria-controls="settings-log" class="tab-btn">Settings Log</button>
</div>
<div role="tabpanel" id="ext-log" aria-labelledby="tab-ext">...</div>
<div role="tabpanel" id="settings-log" aria-labelledby="tab-settings" hidden>...</div>
```

Note: Replace `style="display:none"` on the settings log panel with the `hidden` attribute for semantic correctness. The tab buttons must also retain their existing `data-tab` attributes (`data-tab="extension"` / `data-tab="settings"`) since `logs.ts` reads `btn.dataset.tab` to set `activeTab`. The `logs.ts` JS is updated in Step 6 to manage ARIA state on switch.

---

### 6. `src/logs/logs.ts`

**Issues addressed:** M-02 (ARIA tab state management)

The existing `setupTabs()` function reads `btn.dataset.tab` and calls `loadAndRender()`. It is updated in-place to additionally manage ARIA state. The `data-tab` attribute on tab buttons is retained as-is.

```typescript
function setupTabs(): void {
  const tabs = document.querySelectorAll<HTMLButtonElement>('[role="tab"]');

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active class (existing behaviour)
      tabs.forEach(t => t.classList.remove('active'));
      btn.classList.add('active');

      // Update ARIA selected state (new)
      tabs.forEach(t => t.setAttribute('aria-selected', 'false'));
      btn.setAttribute('aria-selected', 'true');

      // Update panel visibility via aria-controls (new — replaces display toggling)
      const targetPanelId = btn.getAttribute('aria-controls');
      document.querySelectorAll('[role="tabpanel"]').forEach(panel => {
        if (panel.id === targetPanelId) {
          panel.removeAttribute('hidden');
        } else {
          panel.setAttribute('hidden', '');
        }
      });

      // Update activeTab and reload (existing behaviour)
      activeTab = btn.dataset.tab as 'extension' | 'settings';
      loadAndRender();
    });
  });
}
```

The `[role="tab"]` selector replaces `.tab-btn` as the query target — both select the same elements after the HTML update in Step 5.

---

### 7. `src/logs/logs.css` *(new file)*

**Issues addressed:** M-03 (extracted styles), L-02 (color normalization)

This is a standalone stylesheet — it does not inherit variables from `popup.css` or `styles.css`. It **must declare its own `:root` block** with all tokens it uses, plus `[data-theme="light"]` overrides.

**Required `:root` tokens:**
```css
:root {
  --bg-primary: #18181b;
  --bg-secondary: #1f1f23;
  --text-primary: #efeff1;
  --text-secondary: #adadb8;
  --text-muted: #6b6b80;
  --border-color: #2d2d35;
  --accent: #06B6D4;
  --danger: #E91916;
  --success: #22C55E;       /* included for completeness — not currently used in log styles */
  --hc-warning: #F97316;
  --font: 'Space Grotesk', sans-serif;
}

[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f4f4f5;
  --text-primary: #18181b;
  --text-secondary: #3f3f46;
  --text-muted: #71717a;
  --border-color: #d4d4d8;
  --accent: #0891B2;
  --success: #16A34A;
  --hc-warning: #EA580C;
}
```

**`@font-face` declarations** for Space Grotesk 400/500/600/700 must be included in this file (same `assets/fonts/` path as `popup.css` — webpack emits `logs.css` flat to `dist/`).

**Style extraction:** All embedded log styles become external rules. Token substitutions:
- Active tab background: `#9147ff` → `var(--accent)`
- Error log color: `#f44336` → `var(--danger)`
- Warn log color: `#ff9800` → `var(--hc-warning)`
- Debug/timestamp muted colors: `#888` / `#666` → `var(--text-muted)`
- All background/text/border values → corresponding tokens

---

### 8. `src/options/options.html`

**Issues addressed:** L-03 (hardcoded inline styles)

**Note:** `options.html` is vestigial dead code. There is no `options_page` or `options_ui` entry in `manifest.json`, and no CopyPlugin rule copies it to `dist/`. The file is not shipped in the extension. Changes here are archival only — clean up the inline styles for consistency, but do not add a manifest entry or CopyPlugin rule (that would be a feature change).

- Remove inline `style` attributes from all elements
- Add `<link rel="stylesheet" href="../popup/popup.css">` so the file would render correctly if ever activated

**Validation:** No visual validation step required for this file — it is not accessible in the built extension.

---

## Validation Plan

### Build verification
- `npm run build` must complete with zero TypeScript errors and zero webpack warnings after all changes

### Visual validation (manual — required before PR)
- **Dark mode:** Open popup, verify teal accent on all interactive surfaces (buttons, toggles, segmented controls, active nav item background tint, focus rings on inputs). Trigger a friction overlay on Twitch: verify teal throughout, smooth progress bar animation (no layout jank), reason buttons render and function correctly.
- **Light mode:** Toggle `[data-theme="light"]`, inspect all popup sections. Flag anything that loses legibility — this requires a human visual pass before the PR is opened.
- **Logs page:** Verify Space Grotesk loads, tab keyboard navigation works (arrow keys between tabs, Enter to activate), ARIA roles visible in Chrome DevTools Accessibility panel.
- **Options page:** Not validated — file is not shipped.

### Accessibility spot-check
- Tab through the full popup with keyboard only — every control reachable, focus ring visible at each step
- Tab through logs page — tab buttons announce `role="tab"` and `aria-selected` state, panels switch on Enter

### What is NOT in scope
- New Jest tests (no logic changes)
- Playwright e2e changes
- Version bump (done at end of branch per CLAUDE.md)

---

## Out of Scope

- **Merging the two CSS variable namespaces** (`--accent` vs `--hc-primary`) into a single shared file — they are aligned semantically but kept in their respective files to avoid a large structural refactor in this PR
- **Space Grotesk in content script (toasts)** — Loading extension fonts in a content script requires `web_accessible_resources` manifest changes; deferred to a future pass. Toasts will use system `sans-serif` as fallback.
- **Full 44px touch targets** — The segmented control cannot reach 44px height without a redesign. Padding is improved but the limitation is accepted for this pass.
- **Activating `options.html`** — The page is vestigial; adding it to the manifest is a feature decision, not a cleanup task.
- Any new features or UI additions
- Changes to TypeScript logic beyond the two targeted fixes in `interceptor.ts` and the ARIA state update in `logs.ts`
