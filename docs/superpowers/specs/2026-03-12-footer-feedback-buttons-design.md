# Footer Feedback Buttons — Design Spec
**Date:** 2026-03-12
**Status:** Approved

## Overview

Add two small external-link buttons to the popup footer: **Bug Report** and **Ideas**. These give users a direct path to report issues or submit feature suggestions on GitHub without leaving the extension.

## Layout

The footer currently has `💾 Save Settings` centered and a version string absolutely positioned to the right. The new layout:

```
[ 🐛 Bug  💡 Ideas ]       [ 💾 Save Settings ]       [ v0.4.8 ]
  left-aligned, small            centered               right, muted
```

- Footer height stays at **48px** — no change.
- `justify-content` changes from `center` to `space-between`.
- Save is re-centered using `position: absolute; left: 50%; transform: translateX(-50%)`.
- Version string stays `position: absolute; right: 12px`.

## Components

### HTML (`popup.html`)

A `<div class="footer-links">` wrapper is added to the left of the footer containing two `<a>` tags:

```html
<footer class="hc-footer">
  <div class="footer-links">
    <a class="footer-link" href="https://github.com/Ktulue/HypeControl/issues/new" target="_blank" rel="noopener noreferrer">🐛 Bug</a>
    <a class="footer-link" href="https://github.com/Ktulue/HypeControl/discussions/new?category=ideas" target="_blank" rel="noopener noreferrer">💡 Ideas</a>
  </div>
  <button class="btn-save" id="btn-save">💾 Save Settings</button>
  <span class="footer-version" id="footer-version"></span>
</footer>
```

### CSS (`popup.css`)

```css
/* Footer layout update.
   Only .footer-links is in normal flow — .btn-save and .footer-version are
   both position:absolute. space-between left-aligns the single in-flow child. */
.hc-footer {
  justify-content: space-between; /* was: center */
}

/* Save re-centered absolutely */
.btn-save {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 0; /* footer-links (z-index:1) sits above this */
}

/* Feedback link group */
.footer-links {
  display: flex;
  gap: 10px;
  align-items: center;
  z-index: 1; /* sits above the absolute-positioned save button's hit area */
}

.footer-link {
  font-size: 11px;
  color: var(--text-muted);
  text-decoration: none;
  cursor: pointer;
}

.footer-link:hover {
  text-decoration: underline;
  color: var(--text-primary);
}
```

### JS (`popup.ts`)

No changes required. The links are plain anchor tags with no JS interaction.

## URLs

| Button | Destination |
|--------|-------------|
| 🐛 Bug | `https://github.com/Ktulue/HypeControl/issues/new` |
| 💡 Ideas | `https://github.com/Ktulue/HypeControl/discussions/new?category=ideas` |

Both open in a new tab with `rel="noopener noreferrer"` for security.

## Scope

- **In scope:** `popup.html`, `popup.css`
- **Out of scope:** `popup.ts`, any other files
- **No new settings, storage, or migration needed**
- **Version bump:** patch (0.4.8 → 0.4.9) after implementation
