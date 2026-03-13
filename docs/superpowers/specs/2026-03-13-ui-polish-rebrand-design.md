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

The extension must visually validate in both light and dark mode before the PR is opened. No new features. No new tests. No logic changes.

---

## Execution Approach

**File-by-file (Approach B).** Each file is touched exactly once in a defined sequence. This minimizes context switching, produces clean per-file commits, and maps directly to parallel subagent tasks.

### Sequencing

| Order | File | Category |
|-------|------|----------|
| 1 | `src/content/interceptor.ts` | Security + Performance |
| 2 | `src/popup/popup.css` | Rebrand + A11y + Cleanup |
| 3 | `src/content/styles.css` | Rebrand + Token sweep + Performance |
| 4 | `src/popup/popup.html` | A11y (label associations) |
| 5 | `src/logs/logs.html` | A11y (ARIA tabs) + Structural |
| 6 | `src/logs/logs.css` *(new)* | Structural (extracted + tokenized styles) |
| 7 | `src/options/options.html` | Cleanup |
| — | `assets/fonts/` *(new dir)* | Font bundling (prerequisite for CSS work) |

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

```css
@font-face {
  font-family: 'Space Grotesk';
  src: url('../../assets/fonts/SpaceGrotesk-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
/* repeat for 500, 600, 700 */
```

**CSS variable update:**
- `popup.css`: `--font: 'Space Grotesk', sans-serif`
- `styles.css`: `--hc-font: 'Space Grotesk', sans-serif` (new token, applied to toast `font-family`)

---

## File-by-File Change Specifications

### 1. `src/content/interceptor.ts`

**Issues addressed:** C-01 (XSS), H-01 (progress bar animation)

**C-01 — Reason button DOM construction:**
Replace the `${reason}` innerHTML template literal at ~line 775 with explicit DOM construction:
```typescript
// BEFORE (unsafe)
reasonButtonsHTML += `<button class="hc-reason-btn" data-reason="${reason}">${reason}</button>`;

// AFTER (safe)
const btn = document.createElement('button');
btn.className = 'hc-reason-btn';
btn.setAttribute('data-reason', reason);
btn.textContent = reason;
reasonContainer.appendChild(btn);
```
All other `innerHTML` assignments in this file use numeric or internally-generated values — no changes required.

**H-01 — Progress bar animation:**
Replace `progressEl.style.width = \`${pct}%\`` at ~lines 734 and 942 with:
```typescript
progressEl.style.transform = `scaleX(${pct / 100})`;
```
The element needs `transform-origin: left` set in CSS. The JS update loop runs ~10×/sec — using transform avoids layout recalculation on every tick.

---

### 2. `src/popup/popup.css`

**Issues addressed:** H-02 (font), H-03 (rebrand), H-05 (focus rings), M-06 (touch targets), L-01 (cursor)

- Add `@font-face` blocks for Space Grotesk 400/500/600/700
- Update `--font` variable
- Replace `--accent: #9146ff` → `#06B6D4`; `--accent-hover` → `#0891B2`
- Replace `--success: #00c896` → `#22C55E`
- Add `--accent-rgb`, `--danger-rgb`, `--success-rgb` tokens
- Update `[data-theme="light"]` block: teal/green variants at reduced brightness for contrast on white
- Fix `.hc-input:focus`, `.hc-select:focus`: replace `outline: none` with `outline: 2px solid var(--accent); outline-offset: 2px`
- Bump `.seg-btn` padding: `4px 6px` → `8px 10px` (improves touch target height from ~20px to ~32px; full 44px not achievable without redesigning the segmented control)
- Bump `.btn-primary`, `.btn-secondary`, `.btn-danger` padding: `5px 12px` → `8px 14px`
- Remove `cursor: pointer` from `.footer-link` (redundant on `<a>`)

---

### 3. `src/content/styles.css`

**Issues addressed:** H-03 (rebrand), H-04 (hardcoded colors), M-04 (transition: all), M-05 (toast font), L-02 (color typo), L-04 (undeclared tokens)

- Update `--hc-primary: #9146ff` → `#06B6D4`; `--hc-primary-dark` → `#0891B2`
- Update `--hc-success: #00c853` → `#22C55E`
- Add: `--hc-font`, `--hc-primary-rgb`, `--hc-danger-rgb`, `--hc-success-rgb`, `--hc-warning`, `--hc-primary-light`
- Replace all ~30 hardcoded color instances with variable references (full sweep of lines 37, 41, 142, 220, 222, 226–228, 232–234, 308, 404, 423, 442, 461, 473, 486, 494, 533, 543, 553, 560, 569)
- Update `[data-theme="light"]` overrides: replace hardcoded `#6b2fd6` whitelist tint → `var(--hc-primary-light)` equivalent; retain `#c47600` amber for price note (semantic, not brand)
- Replace `.hc-btn { transition: all 0.2s ease }` → `transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease`
- Update progress bar CSS: `transition: width 0.1s linear` → `transition: transform 0.1s linear`; add `transform-origin: left` to `.hc-progress-bar`
- Update toast `font-family: sans-serif` → `font-family: var(--hc-font)` on all 4 toast elements (lines 411, 430, 449, 481)
- Normalize color typo: all instances of `#9147ff` → corrected to new teal token

---

### 4. `src/popup/popup.html`

**Issues addressed:** M-01 (label associations)

Fix 7 unassociated `<span class="hc-label">` elements:

| Label text | Current | Fix |
|-----------|---------|-----|
| "Intensity" (friction) | `<span>` | `<fieldset>` + `<legend>` wrapping the segmented control |
| "Intensity" (delay) | `<span>` | `<fieldset>` + `<legend>` |
| "Delay timer" | `<span>` | `<label for="delay-timer-toggle">` |
| "Thresholds" | `<span>` | `<fieldset>` + `<legend>` wrapping threshold inputs |
| "Daily cap" | `<span>` | `<label for="daily-cap-toggle">` |
| "Spending cooldown" | `<span>` | `<label for="cooldown-toggle">` |
| "Streaming mode" | `<span>` | `<label for="streaming-mode-toggle">` |

Segmented controls and threshold groups use `<fieldset>`/`<legend>` because they label a group, not a single input. Toggle labels use `<label for>` because they target a single checkbox.

---

### 5. `src/logs/logs.html`

**Issues addressed:** M-02 (ARIA tabs), M-03 (extract embedded styles)

- Remove entire `<style>` block
- Add `<link rel="stylesheet" href="logs.css">`
- Add Space Grotesk font reference (via `@font-face` in `logs.css`)
- Implement ARIA tab pattern:

```html
<!-- BEFORE -->
<button class="tab-btn active" onclick="showTab('ext')">Extension Log</button>
<button class="tab-btn" onclick="showTab('settings')">Settings Log</button>
<div id="ext-log">...</div>
<div id="settings-log">...</div>

<!-- AFTER -->
<div role="tablist" aria-label="Log type">
  <button role="tab" aria-selected="true" aria-controls="ext-log" id="tab-ext" class="tab-btn active">Extension Log</button>
  <button role="tab" aria-selected="false" aria-controls="settings-log" id="tab-settings" class="tab-btn">Settings Log</button>
</div>
<div role="tabpanel" id="ext-log" aria-labelledby="tab-ext">...</div>
<div role="tabpanel" id="settings-log" aria-labelledby="tab-settings" hidden>...</div>
```

The existing JS tab-switching logic also needs to toggle `aria-selected` and `hidden` attributes on switch.

---

### 6. `src/logs/logs.css` *(new file)*

**Issues addressed:** M-03 (extracted styles), L-02 (color typo/normalization)

- Full extraction of the embedded `<style>` block from `logs.html`
- All colors replaced with CSS variable tokens matching the main palette
- Active tab uses `var(--accent)` (teal) instead of hardcoded `#9147ff`
- Error color uses `var(--danger)` instead of `#f44336`
- Warning color uses `var(--hc-warning)` instead of `#ff9800`
- `@font-face` blocks for Space Grotesk included in this file

---

### 7. `src/options/options.html`

**Issues addressed:** L-03 (hardcoded inline styles)

- Remove inline `style` attributes
- Add `<link rel="stylesheet" href="../popup/popup.css">` so the page inherits the main token system and Space Grotesk
- Verify the redirect message still renders correctly with the linked stylesheet

---

### 8. `assets/fonts/` *(new directory)*

Download from Google Fonts (static download, not CDN):
- `SpaceGrotesk-Regular.woff2` (400)
- `SpaceGrotesk-Medium.woff2` (500)
- `SpaceGrotesk-SemiBold.woff2` (600)
- `SpaceGrotesk-Bold.woff2` (700)

License: SIL Open Font License 1.1 — safe to bundle and distribute in a Chrome extension.

---

## Validation Plan

### Build verification
- `npm run build` must complete with zero TypeScript errors after all changes

### Visual validation (manual — required before PR)
- **Dark mode:** Open popup, verify teal accent on all interactive surfaces (buttons, toggles, segmented controls, active nav, focus rings). Open overlay on Twitch, verify teal throughout, smooth progress bar animation, reason buttons render and function correctly.
- **Light mode:** Toggle `[data-theme="light"]`, inspect all sections for contrast issues. Flag anything that loses legibility — this requires a human visual pass.
- **Logs page:** Verify Space Grotesk loads, tab keyboard navigation works, ARIA roles present in DevTools accessibility panel.
- **Options page:** Verify redirect message renders with correct dark background and typography.

### Accessibility spot-check
- Tab through the full popup with keyboard only — every control reachable, focus ring visible at each step
- Tab through logs page — tab buttons announce role/selected state, panels switch correctly

### What is NOT in scope
- New Jest tests (no logic changes)
- Playwright e2e changes
- Version bump (done at end of branch per CLAUDE.md)

---

## Out of Scope

- Merging the two CSS variable namespaces (`--accent` vs `--hc-primary`) into a single shared file — they are aligned semantically but kept in their respective files to avoid a large structural refactor in this PR
- Any new features or UI additions
- Changes to TypeScript logic beyond the two targeted fixes in `interceptor.ts`
