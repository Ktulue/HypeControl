# Previews Extension — Settings UI Reference

> **Purpose:** UX reference only. Do NOT replicate Previews' architecture (it injects DOM overlays; Hype Control uses chrome.storage + options page). Use this for visual/organizational inspiration only.
>
> **Captured:** 2026-03-12 via Playwright inspection of previews-app.com v15.9 on Twitch

---

## Panel Structure & UX Patterns

The Previews settings panel is a **floating popup overlay** injected into the Twitch page. Key layout observations:

- **Header row:** Logo + version · Platform selector (Twitch / YouTube / Kick) · Language dropdown · Cloud/icon buttons · Minimize / Close
- **Filter bar:** "All Features" | "Recommended" (filters list to toggled-on recommended features only)
- **Left sidebar:** 8 category tab buttons — vertical stack, each ~43px tall
- **Main content area:** Scrollable feature list; each row = feature name + toggle switch + expand arrow (▼)
- **Expanded sub-settings:** Accordion — clicking ▼ reveals inputs, dropdowns, or action buttons inline
- **Right column:** Extension branding, Affiliates Program banner, Donate/Subscribe CTAs, social links

### Feature Row Anatomy
```
[Feature Name]  [Recommended! badge?]  [New! badge?]  ───────  [●●] toggle  [▼]
  └── (expanded) sub-setting label: [input / dropdown / button]
```

---

## Platform Tabs

The entire settings tree is replicated 3×, once per platform. Features are independently toggled per platform.

| Platform | Notes |
|---|---|
| **Twitch** | Full feature set (documented below) |
| **YouTube** | Parallel set — sidebar previews, player controls, chat features |
| **Kick** | Parallel set — previews, player controls, sidebar |

---

## Twitch Settings Tree

### Tab 1 — Previews

| Feature | Default | Sub-settings |
|---|---|---|
| **Sidebar Previews** | ✅ ON · Recommended! | Preview Size slider (px, default 440px) · Image Preview toggle · Volume: number input (0–1, default 0.5) |
| **Directory Previews** | ✅ ON · Recommended! | _(none visible)_ |
| **Clips Previews** | ✅ ON · Recommended! | _(none visible)_ |
| **Video Previews — Default Audio On** | ✅ ON | _(none visible)_ |
| **Sidebar Previews Hover Delay** | ❌ OFF | Hover delay: number input (seconds, default 0.25) |
| **Streaming — See Your Own Live Stream Thumbnail** | ❌ OFF | Stream name (english): text input |
| **Enable Hover Preview Animations** | ✅ ON · New! | _(none visible)_ |

---

### Tab 2 — Misc

| Feature | Default | Sub-settings |
|---|---|---|
| **Auto Channel Points Clicker** | ✅ ON · Recommended! | _(none visible)_ |
| **Multi-Stream & Multi-Chat** | ✅ ON · Recommended! | _(none visible)_ |
| **Advanced Video Embeds** | ❌ OFF · Recommended! | _(none visible)_ |
| **Clip Download Button** | ❌ OFF | _(none visible)_ |
| **Mute Auto-Playing Videos In Various Pages** | ❌ OFF | _(none visible)_ |

---

### Tab 3 — Sidebar

| Feature | Default | Sub-settings |
|---|---|---|
| **Sidebar Favorite Channels** | ❌ OFF · Recommended! | [Edit Favorites] button · [Edit Categories] button · Always show offline toggle · Hide original entries toggle · Use categories toggle |
| **Sidebar YouTube Channels** | ❌ OFF · Recommended! | [Edit YouTubers] button · Always show offline toggle · Use categories toggle |
| **Sidebar Kick Channels** | ❌ OFF | [Edit Kick Streamers] button · Always show offline toggle · Use categories toggle |
| **Auto Extend Sidebar (show more)** | ❌ OFF | Always extend toggle (sub-option) |
| **Sidebar Search Button** | ❌ OFF | _(none visible)_ |
| **Hide All Sidebar Sections Except Followed Channels** | ❌ OFF | _(none visible)_ |
| **Full Sidebar Channel Tooltips** | ❌ OFF · Recommended! | _(none visible)_ |

---

### Tab 4 — Player

| Feature | Default | Sub-settings |
|---|---|---|
| **Auto Refresh On Twitch Player Error** | ✅ ON · Recommended! | _(none visible — covers errors #1000–#5000)_ |
| **Auto Set Twitch Player To Selected Quality** | ❌ OFF · Recommended! · New! | Primary quality dropdown: `highest / 1440p60 / 1080p60 / 720p60 / 720p30 / 480p / 360p / 160p / lowest` · Fallback quality dropdown: same options |
| **Prevent Video Quality Change When In Background** | ❌ OFF | _(none visible)_ |
| **Full Screen + Chat Button** | ✅ ON · Recommended! | [Edit Shortcut] button |
| **Fast-Forward Button** | ✅ ON · Recommended! | [Edit Shortcut] button |
| **Seek Streams Using Keyboard Arrow Keys** | ❌ OFF · Recommended! | [Edit Shortcut] button |
| **Playback Speed Controls** | ✅ ON · Recommended! | [Edit Shortcut] button |
| **Picture In Picture Button** | ✅ ON · Recommended! | [Edit Shortcut] button |
| **Screenshot Stream Button** | ❌ OFF | [Edit Shortcut] button · Screenshot Format: `png / webp` |
| **Record Stream Button** | ❌ OFF | [Edit Shortcut] button |
| **FlashBang Defender Button** | ✅ ON · Recommended! | [Edit Shortcut] button |
| **Hide Twitch Extensions Overlays** | ❌ OFF | _(none visible)_ |
| **Hide Volume Percentage Indicator** | ❌ OFF | _(none visible)_ |

---

### Tab 5 — Chat

| Feature | Default | Sub-settings |
|---|---|---|
| **Voice Typing** | ✅ ON · Recommended! · New! | Language: dropdown (~90+ locale options, default `en-US`) · Auto-send toggle |
| **Clear Chat Button** | ❌ OFF | _(none visible)_ |
| **Incognito Chat Button** | ❌ OFF | _(none visible — shows if banned)_ |

---

### Tab 6 — Raids

| Feature | Default | Sub-settings |
|---|---|---|
| **Auto Leave Raids** | ❌ OFF · New! | _(none visible)_ |
| **Raid Random Favorite Streamer Instead** | ❌ OFF · New! | _(none visible)_ |

---

### Tab 7 — Predictions

| Feature | Default | Sub-settings |
|---|---|---|
| **Predictions Notifications** | ❌ OFF | Sound enabled toggle (`TP_popup_isPredictionsNotificationsSoundEnabled_checkbox`) |
| **Predictions Sniper** | ❌ OFF | Bet: % of points input · Max points cap input · Min vote margin % input · Seconds before close input · Vote selection: `Most Votes / Least Votes / Highest Return Ratio / Lowest Return Ratio` |

---

### Tab 8 — Settings

| Feature | Default | Sub-settings |
|---|---|---|
| **Import/Export Settings** | — | Local: [Export] / [Import] buttons · Cloud: [Export] / [Import] buttons · _(expand arrow reveals settings-selection checkboxes)_ |
| **Save Settings to Cloud** | ❌ OFF | _(auto-sync settings via cloud)_ |
| **Edit Keyboard Shortcuts** | — | [Edit Shortcut] button per feature |
| **Edit Favorite Streamers** | — | [Edit Favorites] · [Edit (top)] buttons |
| **Edit Favorite Categories** | — | [Edit Categories] button |
| **Edit Blocked Streamers** | — | [Edit Blocked] button |

---

## YouTube Settings Tree (selected differences)

| Tab | Notable YouTube-Specific Features |
|---|---|
| **Previews** | Sidebar Previews · Video Previews Audio · Hover Delay |
| **Sidebar** | Sidebar Favorites (BETA) · Go Directly To Live Streams · Show Live View-Count In Sidebar · Sidebar Kick Channels |
| **Player** | Auto Set YouTube Quality (options: highest / 4320p(8k) / 2160p(4K) / 1440p / 1080p / 720p / 480p / 360p / 240p / 144p / auto) · Theater/Full Screen + Chat · Fast-Forward · Playback Speed · PiP · Screenshot · Record · FlashBang Defender · Prevent Click-To-Pause · Auto Theater Mode · Copy URL At Current Time |
| **Chat** | Voice Typing · Auto Hide Chat · Dynamic Chat Button |
| **Misc** | Multi-Stream & Multi-Chat |

---

## Kick Settings Tree (selected differences)

| Tab | Notable Kick-Specific Features |
|---|---|
| **Previews** | Sidebar Previews · Directory Previews · Video Previews Audio · Hover Delay · Animations |
| **Sidebar** | Sidebar Favorites · Hide Sections · Auto Extend |
| **Player** | Full Screen + Chat · Fast-Forward · Seek · Playback Speed · PiP · Screenshot · Record · FlashBang Defender · Prevent Quality Change |
| **Chat** | Voice Typing |

---

## Key UX Takeaways for HypeControl Settings Redesign

1. **Category tabs as the primary navigation.** 8 categories keep each screen focused. Never more than ~7 features per category.

2. **Toggle-first rows.** Every feature is a single toggle row; sub-settings live behind an expand arrow. The list stays scannable even with 30+ features.

3. **"Recommended" filter.** Lets new users see only the important stuff. Reduces overwhelm without hiding power features.

4. **Per-feature keyboard shortcuts.** Editable shortcuts are a sub-setting of the relevant feature, not a global page. Contextual.

5. **Right-column "meta" panel.** Keeps version info, links, and actions (donate, sub) separate from settings — no clutter in the feature list.

6. **Accordion expansion, not navigation.** Sub-settings expand in-place rather than navigating to a new screen. Preserves context.

7. **Badge labeling.** `Recommended!` and `New!` badges serve as discoverability tools without requiring separate onboarding flows.

8. **Consistent toggle control.** All features use the same iOS-style switch toggle. No mix of checkboxes, radio buttons, and toggles — visual consistency throughout.
