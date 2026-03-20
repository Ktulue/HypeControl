# Footer Feedback Buttons Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 🐛 Bug and 💡 Ideas anchor links to the popup footer, left-aligned, so users can report issues or submit feature suggestions directly from the extension.

**Architecture:** Pure HTML/CSS change. Two `<a>` tags grouped in a `.footer-links` div are added to the existing footer. The Save button is repositioned with `position: absolute` to stay centered. No JS, no new settings, no storage changes.

**Tech Stack:** HTML, CSS (CSS custom properties already defined in popup.css)

---

## Chunk 1: HTML + CSS + Version Bump

**Spec:** `docs/superpowers/specs/2026-03-12-footer-feedback-buttons-design.md`

### Task 1: Add footer links to popup.html

**Files:**
- Modify: `src/popup/popup.html:257-260`

- [ ] **Step 1: Add `.footer-links` wrapper with two anchor tags inside the footer**

Open `src/popup/popup.html`. Replace the existing footer block:

```html
  <footer class="hc-footer">
    <button class="btn-save" id="btn-save">💾 Save Settings</button>
    <span class="footer-version" id="footer-version"></span>
  </footer>
```

With:

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

- [ ] **Step 2: Verify the HTML is correct**

Open `src/popup/popup.html` and confirm:
- `.footer-links` div is the first child of `<footer>`
- Both `<a>` tags have `target="_blank"` and `rel="noopener noreferrer"`
- The Save button and version span are unchanged

---

### Task 2: Update footer CSS

**Files:**
- Modify: `src/popup/popup.css:99-114` (footer section), `src/popup/popup.css:247-258` (btn-save section)

- [ ] **Step 1: Change `.hc-footer` justify-content and add a comment**

In `src/popup/popup.css`, replace:

```css
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
```

With:

```css
.hc-footer {
  flex-shrink: 0;
  height: 48px;
  display: flex;
  align-items: center;
  /* Only .footer-links is in normal flow; .btn-save and .footer-version are
     position:absolute. space-between left-aligns the single in-flow child. */
  justify-content: space-between;
  border-top: 1px solid var(--border-color);
  position: relative;
  padding: 0 12px;
}
```

- [ ] **Step 2: Add `.footer-links` and `.footer-link` styles after `.footer-version`**

In `src/popup/popup.css`, find the `.footer-version` block (ends at line ~114). Immediately after it, add:

```css
.footer-links {
  display: flex;
  gap: 10px;
  align-items: center;
  z-index: 1;
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

- [ ] **Step 3: Absolutely position `.btn-save` so it stays centered**

In `src/popup/popup.css`, replace only the `.btn-save` block (not the `.btn-save:hover` rule on the following line — leave that unchanged):

```css
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
```

With:

```css
.btn-save {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 0;
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
```

The `.btn-save:hover { background: var(--accent-hover); }` rule on the next line is **not** part of this replacement — leave it as-is.

- [ ] **Step 4: Verify CSS is correct**

Open `src/popup/popup.css` and confirm:
- `.hc-footer` has `justify-content: space-between`
- `.footer-links`, `.footer-link`, `.footer-link:hover` blocks exist after `.footer-version`
- `.btn-save` has `position: absolute; left: 50%; transform: translateX(-50%); z-index: 0;`

---

### Task 3: Bump version

**Files:**
- Modify: `manifest.json`
- Modify: `package.json`

- [ ] **Step 1: Bump version in manifest.json**

In `manifest.json`, change:
```json
"version": "0.4.8"
```
To:
```json
"version": "0.4.9"
```

- [ ] **Step 2: Bump version in package.json**

In `package.json`, change:
```json
"version": "0.4.8"
```
To:
```json
"version": "0.4.9"
```

---

### Task 4: Build and verify

- [ ] **Step 1: Run the build**

```bash
npm run build
```

Expected: build completes with no errors, `dist/` is updated.

> If the build fails for any reason, do NOT retry. Tell the user to run `npm run build` manually in their terminal.

- [ ] **Step 2: Load the extension and verify visually**

In Chrome:
1. Go to `chrome://extensions/`
2. Click "Reload" on HypeControl
3. Open the popup
4. Confirm footer shows: `🐛 Bug  💡 Ideas` on the left, `💾 Save Settings` centered, version string on the right
5. Click 🐛 Bug — should open `https://github.com/Ktulue/HypeControl/issues/new` in a new tab
6. Click 💡 Ideas — should open `https://github.com/Ktulue/HypeControl/discussions/new?category=ideas` in a new tab
7. Confirm footer height has not changed (still compact, no wrapping)

---

### Task 5: Update docs and commit

**Files:**
- Modify: `HypeControl-TODO.md`

- [ ] **Step 1: Create the feature branch before committing**

```bash
git checkout -b feat/footer-feedback-buttons
```

- [ ] **Step 2: Mark the feature complete in HypeControl-TODO.md**

Add an entry under the appropriate section noting footer feedback buttons are complete in v0.4.9.

- [ ] **Step 3: Commit everything**

```bash
git add src/popup/popup.html src/popup/popup.css manifest.json package.json HypeControl-TODO.md
git commit -m "feat: add Bug Report and Ideas footer links (v0.4.9)"
```

- [ ] **Step 4: Push and open a PR**

```bash
git push -u origin feat/footer-feedback-buttons
gh pr create --title "feat: add Bug Report and Ideas footer links" --body "Adds 🐛 Bug and 💡 Ideas anchor links to the popup footer. No JS changes."
```
