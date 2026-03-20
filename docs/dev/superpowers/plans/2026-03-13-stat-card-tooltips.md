# Stat Card Tooltips Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ⓘ icons with hover tooltips to all 4 stat tiles in the popup Stats section.

**Architecture:** CSS-only hover tooltips. No JS required. Each stat tile gets two new child elements — a `.stat-info` icon and a `.stat-tooltip` bubble — styled with absolute positioning inside the tile's `position: relative` container.

**Tech Stack:** HTML, CSS, Chrome Extension MV3

**Spec:** `docs/superpowers/specs/2026-03-13-round-2-feedback-design.md` (Enhancement 8)

**Prerequisite:** `fix/round-2-bugs` must be merged to `main` first (version becomes 0.4.12). Branch off that updated `main`. If `fix/round-2-bugs` has not merged, **do not start this plan** — wait for the merge.

---

## Chunk 0: Branch setup

### Task 0: Create feature branch

- [ ] **Step 1: Confirm prerequisite and create branch**

```bash
git checkout main
git pull
```

Check `manifest.json` — version must be `"0.4.12"`. If it still shows `0.4.11`, `fix/round-2-bugs` has not merged yet. Stop here and wait.

Once confirmed:
```bash
git checkout -b feat/stat-card-tooltips
```

---

## Chunk 1: HTML — Add tooltip markup to all 4 stat tiles

### Task 1: Add `.stat-info` and `.stat-tooltip` to each tile

**Files:**
- Modify: `src/popup/popup.html`

The stat tiles are inside `.stat-tiles` (a 2×2 CSS grid). Each tile currently looks like:
```html
<div class="stat-tile stat-tile--saved" id="stat-saved">
  <span class="stat-value">—</span>
  <span class="stat-label">Saved</span>
</div>
```

The two new `<span>` elements are `position: absolute`, so they are removed from flex flow and do not affect tile height or the gap between flex children.

- [ ] **Step 1: Update `#stat-saved`**

```html
<div class="stat-tile stat-tile--saved" id="stat-saved">
  <span class="stat-value">—</span>
  <span class="stat-label">Saved</span>
  <span class="stat-info">ⓘ</span>
  <span class="stat-tooltip">Total dollars saved by cancelling intercepted purchases</span>
</div>
```

- [ ] **Step 2: Update `#stat-blocked`**

```html
<div class="stat-tile stat-tile--blocked" id="stat-blocked">
  <span class="stat-value">—</span>
  <span class="stat-label">Blocked</span>
  <span class="stat-info">ⓘ</span>
  <span class="stat-tooltip">Number of purchases you chose not to complete</span>
</div>
```

- [ ] **Step 3: Update `#stat-rate`**

```html
<div class="stat-tile stat-tile--rate" id="stat-rate">
  <span class="stat-value">—</span>
  <span class="stat-label">Cancel Rate</span>
  <span class="stat-info">ⓘ</span>
  <span class="stat-tooltip">How often you cancel when Hype Control intervenes</span>
</div>
```

- [ ] **Step 4: Update `#stat-step`**

```html
<div class="stat-tile stat-tile--step" id="stat-step">
  <span class="stat-value">—</span>
  <span class="stat-label">Best Step</span>
  <span class="stat-info">ⓘ</span>
  <span class="stat-tooltip">The friction step where you most often decide to cancel</span>
</div>
```

- [ ] **Step 5: Commit HTML changes**

```bash
git add src/popup/popup.html
git commit -m "feat: add stat card tooltip markup (#8)"
```

---

## Chunk 2: CSS — Tooltip styles

### Task 2: Add tooltip CSS to `popup.css`

**Files:**
- Modify: `src/popup/popup.css`

- [ ] **Step 1: Add `position: relative` to `.stat-tile`**

Find the `.stat-tile` rule. It does NOT currently have `position: relative`. Add it without changing any other property:

```css
.stat-tile {
  position: relative; /* anchors .stat-info and .stat-tooltip */
  /* all existing properties unchanged */
}
```

- [ ] **Step 2: Add `.stat-info` styles**

```css
/* ─── Stat card info icon & tooltip ─────────────────────── */
.stat-info {
  position: absolute;
  bottom: 4px;
  right: 6px;
  font-size: 10px;
  color: var(--text-muted);
  cursor: default;
  line-height: 1;
  user-select: none;
}
.stat-tile:hover .stat-info {
  color: var(--text-secondary);
}
```

- [ ] **Step 3: Add `.stat-tooltip` styles**

The tooltip is 140px wide (narrower than 160px to reduce overflow risk on the ~195px tile). It is centered over the tile with `left: 50%; transform: translateX(-50%)`. The parent `.hc-content` has `overflow-y: auto` — tooltips may be clipped if they overflow horizontally. After building, load the extension and hover over edge tiles (top-left, top-right) to verify the tooltips are fully visible. Adjust `width` or `left` if they clip.

```css
.stat-tooltip {
  display: none;
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  width: 140px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.4;
  padding: 6px 8px;
  z-index: 10;
  text-align: center;
  pointer-events: none;
}
.stat-tile:hover .stat-tooltip {
  display: block;
}
```

- [ ] **Step 4: Commit CSS**

```bash
git add src/popup/popup.css
git commit -m "feat: add stat card tooltip styles (#8)"
```

---

## Chunk 3: Version bump, test run, PR

### Task 3: Version bump and final build

**Files:**
- Modify: `manifest.json`
- Modify: `package.json`
- Modify: `HypeControl-TODO.md`
- Modify: `HC-Project-Document.md`

- [ ] **Step 1: Bump to 0.4.13**

`manifest.json`: `"version": "0.4.13"`
`package.json`: `"version": "0.4.13"`

- [ ] **Step 2: Run full test suite**

```bash
npm test -- --no-coverage
```

Expected: all tests pass.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: clean build at v0.4.13. If build fails for any reason, stop and tell the user to run `npm run build` manually in their terminal.

- [ ] **Step 4: Commit version bump**

```bash
git add manifest.json package.json
git commit -m "maint: bump version to 0.4.13"
```

- [ ] **Step 5: Update `HypeControl-TODO.md`**

- Set `Updated` date to 2026-03-13
- Set `Current Version` to 0.4.13
- Add an entry for Enhancement 8 (stat card tooltips) and mark it `[x]` complete
- Update footer timestamp

```bash
git add HypeControl-TODO.md
git commit -m "docs: update TODO for v0.4.13 stat card tooltips"
```

- [ ] **Step 6: Update `HC-Project-Document.md`**

If any section tracks popup UX or stats panel features, update it to reflect the stat card tooltips addition.

```bash
git add HC-Project-Document.md
git commit -m "docs: update project doc for v0.4.13"
```

- [ ] **Step 7: Push and open PR**

```bash
git push -u origin feat/stat-card-tooltips
```

PR title: `feat: stat card hover tooltips (v0.4.13)` targeting `main`.
