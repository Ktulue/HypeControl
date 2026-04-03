# Firefox AMO Port — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Firefox build target so the extension can be submitted to Firefox Add-ons (AMO) without changing the Chrome build.

**Architecture:** Dual-manifest approach — `manifest.json` stays as the Chrome manifest (zero disruption to existing CWS workflow), `manifest.firefox.json` is the Firefox variant. Webpack accepts `--env target=firefox` to select manifest and inject the icon directory constant at build time via DefinePlugin. No runtime browser detection needed; the build is statically targeted.

**Tech Stack:** webpack (existing), webpack.DefinePlugin (new), existing TypeScript + MV3

---

### Task 1: Create the Firefox manifest

**Files:**
- Create: `manifest.firefox.json`

- [ ] **Step 1: Create `manifest.firefox.json`**

Copy the current `manifest.json` and apply three changes:

1. Add `browser_specific_settings` block
2. Point all icon paths to `assets/icons/FirefoxAMO/`
3. Add `32` and `64` icon sizes (Firefox uses these)
4. Update `web_accessible_resources` to reference `FirefoxAMO` icon

```json
{
  "manifest_version": 3,
  "name": "Hype Control",
  "version": "1.0.1",
  "description": "Friction between your wallet and the hype train. Spending caps, cooldown timers, and reality checks before Twitch purchases.",
  "browser_specific_settings": {
    "gecko": {
      "id": "hypecontrol@ktulue",
      "strict_min_version": "109.0"
    }
  },
  "icons": {
    "16": "assets/icons/FirefoxAMO/HC_icon_16px.png",
    "32": "assets/icons/FirefoxAMO/HC_icon_32px.png",
    "48": "assets/icons/FirefoxAMO/HC_icon_48px.png",
    "64": "assets/icons/FirefoxAMO/HC_icon_64px.png",
    "128": "assets/icons/FirefoxAMO/HC_icon_128px.png"
  },
  "permissions": [
    "storage",
    "activeTab",
    "tabs"
  ],
  "host_permissions": [
    "https://*.twitch.tv/*"
  ],
  "background": {
    "scripts": ["serviceWorker.js"]
  },
  "content_scripts": [
    {
      "matches": ["https://*.twitch.tv/*"],
      "js": ["content.js"],
      "css": ["content.css"],
      "run_at": "document_idle"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": [
        "assets/icons/FirefoxAMO/HC_icon_48px.png",
        "assets/fonts/SpaceGrotesk-Regular.woff2",
        "assets/fonts/SpaceGrotesk-Medium.woff2",
        "assets/fonts/SpaceGrotesk-SemiBold.woff2",
        "assets/fonts/SpaceGrotesk-Bold.woff2"
      ],
      "matches": ["https://*.twitch.tv/*"]
    }
  ],
  "action": {
    "default_title": "Hype Control - Click for settings",
    "default_popup": "popup.html",
    "default_icon": {
      "16": "assets/icons/FirefoxAMO/HC_icon_16px.png",
      "32": "assets/icons/FirefoxAMO/HC_icon_32px.png",
      "48": "assets/icons/FirefoxAMO/HC_icon_48px.png",
      "64": "assets/icons/FirefoxAMO/HC_icon_64px.png",
      "128": "assets/icons/FirefoxAMO/HC_icon_128px.png"
    }
  }
}
```

Note the `background` key uses `"scripts"` array instead of `"service_worker"` — Firefox MV3 prefers this form.

- [ ] **Step 2: Commit**

```bash
git add manifest.firefox.json
git commit -m "maint: add Firefox AMO manifest"
```

---

### Task 2: Make webpack target-aware

**Files:**
- Modify: `webpack.config.js`

- [ ] **Step 1: Convert module.exports to a function**

Webpack supports `module.exports = (env) => ({...})` to receive `--env` flags. Update `webpack.config.js` to:

```js
const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const pkg = require('./package.json');

module.exports = (env = {}) => {
  const target = env.target || 'chrome';
  const manifestFile = target === 'firefox' ? 'manifest.firefox.json' : 'manifest.json';
  const iconDir = target === 'firefox' ? 'FirefoxAMO' : 'ChromeWebStore';

  return {
    entry: {
      content: './src/content/index.ts',
      history: './src/history/history.ts',
      logs: './src/logs/logs.ts',
      popup: './src/popup/popup.ts',
      serviceWorker: './src/background/serviceWorker.ts',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, { loader: 'css-loader', options: { url: false } }],
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    plugins: [
      new webpack.DefinePlugin({
        __ICON_DIR__: JSON.stringify(iconDir),
      }),
      new MiniCssExtractPlugin({
        filename: '[name].css',
      }),
      new CopyPlugin({
        patterns: [
          {
            from: manifestFile,
            to: 'manifest.json',
            transform(content) {
              const manifest = JSON.parse(content.toString());
              manifest.version = pkg.version;
              return JSON.stringify(manifest, null, 2);
            },
          },
          { from: 'src/history/history.html', to: 'history.html' },
          { from: 'src/logs/logs.html', to: 'logs.html' },
          { from: 'src/popup/popup.html', to: 'popup.html' },
          { from: 'assets', to: 'assets', noErrorOnMissing: true },
        ],
      }),
    ],
    devtool: 'cheap-module-source-map',
  };
};
```

Key changes:
- `module.exports` is now a function receiving `env`
- `target` defaults to `'chrome'` when not specified (preserves existing `npm run build` behavior)
- `manifestFile` selects the right source manifest
- `DefinePlugin` injects `__ICON_DIR__` as a compile-time constant
- `require('webpack')` added at the top

- [ ] **Step 2: Verify Chrome build still works**

Run: `npm run build`
Expected: Succeeds with no errors. `dist/manifest.json` contains no `browser_specific_settings`.

- [ ] **Step 3: Commit**

```bash
git add webpack.config.js
git commit -m "maint: make webpack target-aware for Firefox build"
```

---

### Task 3: Add Firefox build scripts to package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add Firefox build scripts**

Add two new scripts:

```json
"build:firefox": "webpack --mode production --env target=firefox",
"dev:firefox": "webpack --mode development --watch --env target=firefox"
```

The existing `build` and `dev` scripts stay untouched — they continue to build for Chrome by default.

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "maint: add Firefox build scripts"
```

---

### Task 4: Replace hardcoded icon paths with build-time constant

**Files:**
- Modify: `src/content/interceptor.ts:545,1359`
- Modify: `src/content/tourPanel.ts:163,172`

There are 4 hardcoded references to `ChromeWebStore` in content scripts. These need to use the `__ICON_DIR__` constant injected by DefinePlugin.

- [ ] **Step 1: Add the global type declaration**

Create a declaration so TypeScript knows about `__ICON_DIR__`. Add to the top of `src/shared/types.ts`:

```ts
declare const __ICON_DIR__: string;
```

- [ ] **Step 2: Update `src/content/interceptor.ts` line 545**

Replace:
```ts
<img class="hc-icon" src="${chrome.runtime.getURL('assets/icons/ChromeWebStore/HC_icon_48px.png')}" width="32" height="32" alt="Hype Control">
```

With:
```ts
<img class="hc-icon" src="${chrome.runtime.getURL(`assets/icons/${__ICON_DIR__}/HC_icon_48px.png`)}" width="32" height="32" alt="Hype Control">
```

- [ ] **Step 3: Update `src/content/interceptor.ts` line 1359**

Replace:
```ts
headerIcon.src = chrome.runtime.getURL('assets/icons/ChromeWebStore/HC_icon_48px.png');
```

With:
```ts
headerIcon.src = chrome.runtime.getURL(`assets/icons/${__ICON_DIR__}/HC_icon_48px.png`);
```

- [ ] **Step 4: Update `src/content/tourPanel.ts` line 163**

Replace:
```ts
<img class="hc-tour-icon" src="${chrome.runtime.getURL('assets/icons/ChromeWebStore/HC_icon_48px.png')}" width="20" height="20" alt="">
```

With:
```ts
<img class="hc-tour-icon" src="${chrome.runtime.getURL(`assets/icons/${__ICON_DIR__}/HC_icon_48px.png`)}" width="20" height="20" alt="">
```

- [ ] **Step 5: Update `src/content/tourPanel.ts` line 172**

Replace:
```ts
<img src="${chrome.runtime.getURL('assets/icons/ChromeWebStore/HC_icon_48px.png')}" width="16" height="16" alt="HC">
```

With:
```ts
<img src="${chrome.runtime.getURL(`assets/icons/${__ICON_DIR__}/HC_icon_48px.png`)}" width="16" height="16" alt="HC">
```

- [ ] **Step 6: Build and verify Chrome build**

Run: `npm run build`
Expected: Succeeds. In `dist/content.js`, grep for `ChromeWebStore` — it should appear (substituted at build time). No `__ICON_DIR__` literal should remain.

- [ ] **Step 7: Build and verify Firefox build**

Run: `npm run build:firefox`
Expected: Succeeds. In `dist/content.js`, grep for `FirefoxAMO` — it should appear. `dist/manifest.json` should contain `browser_specific_settings.gecko`.

- [ ] **Step 8: Commit**

```bash
git add src/shared/types.ts src/content/interceptor.ts src/content/tourPanel.ts
git commit -m "maint: use build-time icon directory constant for cross-browser support"
```

---

### Task 5: Version bump

**Files:**
- Modify: `manifest.json` (version field)
- Modify: `manifest.firefox.json` (version field)
- Modify: `package.json` (version field)

- [ ] **Step 1: Bump version to 1.0.2 in all three files**

Update `"version": "1.0.1"` → `"version": "1.0.2"` in:
- `package.json`
- `manifest.json`
- `manifest.firefox.json`

- [ ] **Step 2: Final build (Chrome)**

Run: `npm run build`
Expected: Succeeds. `dist/manifest.json` shows version `1.0.2`.

- [ ] **Step 3: Final build (Firefox)**

Run: `npm run build:firefox`
Expected: Succeeds. `dist/manifest.json` shows version `1.0.2` and contains `browser_specific_settings`.

- [ ] **Step 4: Commit**

```bash
git add package.json manifest.json manifest.firefox.json
git commit -m "maint: bump to v1.0.2 for Firefox AMO port"
```

---

### Task 6: Update project docs

**Files:**
- Modify: `docs/dev/HypeControl-TODO.md`
- Modify: `docs/dev/HC-Project-Document.md`

- [ ] **Step 1: Update HypeControl-TODO.md**

- Set header `Updated` to `2026-04-02`, `Current Version` to `1.0.2`
- Change `Firefox AMO Port` row in Quick Summary to `✅ Complete`
- In the `FIREFOX AMO PORT` section, check all items that are done (manifest, background script, icon paths, build scripts). Leave the AMO listing/submission items unchecked — those are manual.
- Update the `CURRENT ROADMAP` section to move Firefox AMO Port from "Next Up" to "Recently Completed"

- [ ] **Step 2: Update HC-Project-Document.md**

Update the header status line to reflect that Firefox build support is ready. Note that AMO submission is pending (manual step).

- [ ] **Step 3: Commit**

```bash
git add docs/dev/HypeControl-TODO.md docs/dev/HC-Project-Document.md
git commit -m "maint: update project docs for Firefox AMO port"
```

---

## Notes for AMO Submission (Manual Steps — Not Part of This Plan)

These are post-implementation steps the developer handles manually:

1. **Create AMO developer account** at [addons.mozilla.org/developers](https://addons.mozilla.org/developers)
2. **Run `npm run build:firefox`** and zip the `dist/` folder
3. **Upload to AMO** — they'll ask for source code (zip the repo minus `node_modules/` and `dist/`)
4. **Provide build instructions** — "Run `npm install && npm run build:firefox`"
5. **AMO listing assets** — screenshots, description, privacy policy
6. **Review time** — typically 1-5 days for new extensions
