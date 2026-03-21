# README Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite README.md from developer-focused internal docs to a user-first, brand-voice public page for Chrome Web Store launch.

**Architecture:** Single-file rewrite of `README.md`. No code changes, no build required. The new README follows the 10-section structure defined in the spec, with brand voice in sections 1–4 and professional tone in sections 5–10.

**Tech Stack:** Markdown only. No version bump (content-only change). No build step.

**Spec:** `docs/dev/superpowers/specs/2026-03-21-readme-rewrite-design.md`

**Branch:** `maint/readme-rewrite` (already created, spec already committed)

**IMPORTANT:** Do NOT bump versions. This is a content-only change.

---

### Task 1: Write the new README

**Files:**
- Modify: `README.md` (full rewrite)

**Reference files (read for context, do not modify):**
- `CLAUDE.md` — Design context section has brand personality, aesthetic direction, and design principles
- `docs/dev/superpowers/specs/2026-03-21-readme-rewrite-design.md` — The approved spec
- `CONTRIBUTING.md` — Already exists, linked from new README

- [ ] **Step 1: Read the spec and current README**

Read both files to understand the full structure and approved copy.

- [ ] **Step 2: Write the complete new README.md**

Replace the entire file with the new 10-section structure. Follow these rules exactly:

**Section 1 — Title + Tagline + Hook (use verbatim from spec):**
```markdown
# Hype Control

*Friction between your wallet and the hype train.*

You love your streamers. You've also tipped more in one stream than you spent on groceries that week. Hype Control is a lightweight Chrome extension that adds a friction layer between you and impulse purchases — spending caps, cooldown timers, and confirmation prompts that give your future self a fighting chance.
```

**Section 2 — Install link (headingless, directly after hook):**
```markdown
**[Install from the Chrome Web Store](TODO(store-url))**
```

**Section 3 — Features:**
- `## Features` heading
- 9 bullet points as a flat list (no subgroup headings)
- Brand voice tone — lead with mechanic, follow with personality
- Cover these 9 mechanics in order:
  1. Real cost display (price + sales tax)
  2. Work-hours conversion
  3. Comparison items
  4. Multi-step confirmation scaling with price
  5. Daily/weekly/monthly spending caps
  6. Spending cooldown timer
  7. Activity log + savings calendar
  8. Streaming mode with toast notifications
  9. Channel whitelist (skip/reduce/full)
- Tone example from spec: "Daily spending cap — purchases under budget pass through silently; go over and the friction kicks in."
- Read `CLAUDE.md` Design Context for voice guidance: "sharp, cheeky, honest" — the friend who grabs your wrist, not a lecture

**Section 4 — How It Works:**
- `## How It Works` heading
- 3–5 sentences, user's perspective
- Flow: click buy → overlay with real cost + work hours → comparison items → confirmation steps scale with price → proceed deliberately or walk away
- Brand voice, no code, no technical details

**Section 5 — Privacy:**
- `## Privacy` heading
- Two sentences: all data local, nothing collected/transmitted/tracked
- Link to `https://ktulue.github.io/HypeControl/privacy.html`
- Professional tone

**Section 6 — Known Issues:**
- `## Known Issues` heading
- Bits Combo limitation only (copy from current README, keep as-is)
- Do NOT include emoji picker issues

**Section 7 — Contributing:**
```markdown
## Contributing

Want to contribute, report a bug, or run it locally? See [CONTRIBUTING.md](CONTRIBUTING.md).
```

**Section 8 — License:**
```markdown
## License

[GNU General Public License v3.0](LICENSE)
```

**Section 9 — Acknowledgments:**
```markdown
## Acknowledgments

- **HolmsB** — For helping name the extension "Hype Control"
- **Lanzirelli** — Logo & Icons design
```

**Section 10 — Support (canonical format from global CLAUDE.md):**
```markdown
---

## Support

☕ [Buy me a coffee on Ko-fi](http://ko-fi.com/ktulue)

Created by Ktulue | The Water Father 🌊
```

- [ ] **Step 3: Verify the TODO marker is greppable**

Run: `grep -n "TODO(store-url)" README.md`
Expected: Exactly 1 match on the install link line.

- [ ] **Step 4: Verify no removed sections remain**

Run: `grep -n "Tech Stack\|Project Structure\|Configuration\|emoji picker\|Emoji input" README.md`
Expected: No matches.

- [ ] **Step 5: Verify Support section matches global template**

Run: `grep -n "ko-fi.com/ktulue" README.md`
Expected: Exactly 1 match.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "maint: rewrite README for Chrome Web Store launch

Rewrites the README from developer-focused internal docs to a
user-first public page with brand voice, streamlined feature list,
and clean structure for the Chrome Web Store launch."
```

---

### Task 2: Update post-work docs

**Files:**
- Modify: `docs/dev/HypeControl-TODO.md`
- Modify: `docs/dev/HC-Project-Document.md` (only if README status is tracked there)

- [ ] **Step 1: Update TODO.md**

In `docs/dev/HypeControl-TODO.md`:
- Under the "CURRENT ROADMAP" section, note that the README rewrite is complete
- Update the `Updated` date in the header to `2026-03-21`
- Update the footer timestamp

- [ ] **Step 2: Check if HC-Project-Document.md references README**

Read `docs/dev/HC-Project-Document.md` and search for "README". If the project doc tracks README status, update it. If not, no changes needed.

- [ ] **Step 3: Commit**

```bash
git add docs/dev/HypeControl-TODO.md docs/dev/HC-Project-Document.md
git commit -m "maint: update post-work docs for README rewrite"
```
