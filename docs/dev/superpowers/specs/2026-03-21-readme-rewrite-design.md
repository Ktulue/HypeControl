# README Rewrite — Design Spec

**Date:** 2026-03-21
**Status:** Approved
**Branch:** `maint/readme-rewrite`

---

## Goal

Rewrite the README from a developer-focused internal doc to a user-first public-facing page for the Chrome Web Store launch. The README is the first thing potential users see on GitHub — it needs to sell the extension, carry the brand voice, and guide users to install.

---

## Audience Priority

**Users first, developers second.** The README leads with value and personality. Developer setup is a single link to `CONTRIBUTING.md` near the bottom.

---

## Tone Calibration

- **Sections 1–4** (header through How It Works): Brand voice — sharp, cheeky, honest. Previews the actual experience of using HypeControl.
- **Sections 5–10** (privacy through support): Clean and professional. No jokes in privacy, license, or contributor info.

---

## Final Structure

### 1. Title + Tagline + Hook

```
# Hype Control

*Friction between your wallet and the hype train.*

You love your streamers. You've also tipped more in one stream than you spent
on groceries that week. Hype Control is a lightweight Chrome extension that adds
a friction layer between you and impulse purchases — spending caps, cooldown
timers, and confirmation prompts that give your future self a fighting chance.
```

Title is the extension name. Tagline is italicized subtitle. Hook is the opening body paragraph — approved copy, use verbatim.

### 2. Install Link

Headingless bold link on its own line, directly after the hook paragraph (no `##` heading). Keeps the flow from hook → CTA → features without a section break.

```markdown
**[Install from the Chrome Web Store](TODO(store-url))**
```

The `TODO(store-url)` marker is easy to grep for when the listing goes live.

### 3. Features

9 bullet points with brand-voice descriptions. No subgroup headings in the final output — present as a flat list under `## Features`. The grouping below is for the implementer's reference only.

**Friction flow (4 bullets):**
1. Real cost display (price + sales tax)
2. Work-hours conversion ("That's 2.5 hours of your life")
3. Comparison items ("That's 16 Costco hot dogs")
4. Multi-step confirmation that scales with price (nudge → cooldown → type-to-confirm → math challenge)

**Spending awareness (3 bullets):**
5. Daily/weekly/monthly spending caps with progress tracking
6. Spending cooldown timer between purchases
7. Activity log + savings calendar — full history of what you blocked and what you saved

**Smart bypasses (2 bullets):**
8. Streaming mode (auto-detects when you're live, bypasses friction with toast notification)
9. Channel whitelist (skip/reduce/full friction per channel)

Each bullet should be 1–2 lines. Lead with the mechanic, follow with the personality. Example tone: not "Configurable daily spending cap with silent bypass below threshold" but something like "Daily spending cap — purchases under budget pass through silently; go over and the friction kicks in."

Copy for these bullets is left to the implementer but must match the brand voice established in section 1. The CLAUDE.md design context ("sharp, cheeky, honest") and the hook paragraph set the tone target.

### 4. How It Works

One short paragraph (3–5 sentences) walking through the friction flow from the user's perspective: you click buy → overlay appears with real cost and work hours → comparison items make you think twice → confirmation steps scale with price → you either proceed deliberately or walk away. No code, no technical details.

### 5. Privacy

Two sentences max:
- All data stays on your device (`chrome.storage.local` and `chrome.storage.sync`). Nothing is collected, transmitted, or tracked.
- Link to full privacy policy: `https://ktulue.github.io/HypeControl/privacy.html`

### 6. Known Issues

**Keep:** Bits Combo limitation (user-facing — explains why animated Bits cheering can't be intercepted).

**Cut:** Emoji picker platform quirks (not user-facing enough for the README).

### 7. Contributing

One-liner invitation + link to `CONTRIBUTING.md`:

```markdown
## Contributing

Want to contribute, report a bug, or run it locally? See [CONTRIBUTING.md](CONTRIBUTING.md).
```

No dev setup, no branch conventions — `CONTRIBUTING.md` already covers all of that.

### 8. License

One-liner + link. No verbose explanation of GPL rights/restrictions:

```markdown
## License

[GNU General Public License v3.0](LICENSE)
```

### 9. Acknowledgments

Keep as-is:
- **HolmsB** — naming the extension
- **Lanzirelli** — logo & icons design

### 10. Support

Required per global instructions. Normalize to the global `CLAUDE.md` template format:

```markdown
---

## Support

☕ [Buy me a coffee on Ko-fi](http://ko-fi.com/ktulue)

Created by Ktulue | The Water Father 🌊
```

Check for `ko-fi.com/ktulue` before appending. If present, replace with the canonical format above.

---

## What Gets Removed

| Current Section | Reason |
|---|---|
| Configuration (field-by-field settings list) | The popup UI is self-explanatory |
| Tech Stack | Developer-only; visible in `package.json` |
| Project Structure (file tree) | Developer-only; visible in the repo itself |
| Emoji picker known issues | Too granular for user-facing README |
| Verbose license explanation | Replaced with one-liner + link |
| Development setup steps | Already in `CONTRIBUTING.md` |

---

## What Stays the Same

- `CONTRIBUTING.md` (not modified — already solid)
- Acknowledgments section (HolmsB, Lanzirelli)
- Support/Ko-fi section
- LICENSE file

---

## Placeholder Strategy

Chrome Web Store URL uses `TODO(store-url)` — grep-friendly marker. Single location (the install link near the top). Swap in the real URL once the listing goes live.

---

## No Screenshots

No screenshot section in the README. Visual marketing handled by:
- Chrome Web Store listing (screenshots required for submission)
- GitHub Pages landing page (`docs/index.html`)
- Future promo video content (YouTube, short clips — post-launch)

The README sells with copy, not images.

---

## Tagline Decision

"Friction between your wallet and the hype train" is the README tagline. Whether the logo's "Mindful Twitch Spending" subtitle also changes is a separate decision outside this spec's scope.
