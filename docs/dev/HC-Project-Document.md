# Hype Control (HC)

## Chrome Extension Project Document

---

**Created:** January 2026  
**Author:** Josh (Ktulue) + Claude  
**Status:** v1.0.2 — Chrome Web Store + Firefox AMO Build Ready  
**License:** GPL v3  
**Repository:** Ktulue/MTS

---

## Document Navigation

This document is organized into **four phases** that mirror the software development lifecycle:

| Phase                       | Purpose                   | Stream Content                                          |
| --------------------------- | ------------------------- | ------------------------------------------------------- |
| **Phase 1: Discovery**      | Why are we building this? | Problem identification, psychology, personal motivation |
| **Phase 2: Design**         | What are we building?     | Features, UX flows, architecture decisions              |
| **Phase 3: Implementation** | How do we build it?       | MVP parts, prompts for Claude, validation steps         |
| **Phase 4: Enhancement**    | How do we make it better? | Optional add-ons ordered by complexity                  |

---

# Phase 1: Discovery & Research

_"Before writing any code, understand the problem deeply."_

---

## The Problem This Solves

### Twitch's Hype Train Psychology

Twitch has engineered powerful psychological triggers that encourage impulsive spending:

1. **Social Proof** - "127 people contributed!" creates FOMO
2. **Time Pressure** - Countdown timers force quick decisions
3. **Gamification** - Progress bars trigger completion bias
4. **Community Identity** - "Support your streamer" ties spending to belonging
5. **Dopamine Loops** - Immediate on-screen recognition rewards spending

### The Impulse Spending Pattern

```
See Hype Train → Feel excitement/FOMO → Click gift →
Instant dopamine hit → Regret 10 minutes later → Repeat
```

The entire flow from impulse to purchase takes **under 5 seconds**. There's no friction, no pause to consider the real cost.

---

## Personal Context

Why Josh needs this:

- Identified Twitch spending as a weakness in overall financial discipline
- Successfully manages spending elsewhere, but Twitch bypasses normal defenses
- Tends to "go crazy" with dropping subs or subscribing during streams
- Wants to force himself through extra hoops to interrupt the impulse cycle
- Read a Reddit post about someone building a similar extension for their wife's Amazon spending

**Goal:** Not to stop spending entirely, but to make it **intentional** rather than **impulsive**.

---

## Research: Inspiration & Prior Art

### The Reddit Amazon Extension

A developer created a Chrome extension for their wife that:

- Intercepted Amazon checkout flows
- Showed the purchase total converted to hours of work
- Required multiple confirmation steps
- Successfully reduced impulse purchases

This proves the concept works for changing spending behavior.

### Existing Solutions

| Solution                  | Why It Doesn't Work                        |
| ------------------------- | ------------------------------------------ |
| Browser spending trackers | Show data AFTER spending, not BEFORE       |
| Twitch spending limits    | Don't exist natively                       |
| General budgeting apps    | Too removed from the moment of decision    |
| Self-control              | Doesn't work against engineered psychology |

**Gap:** No solution creates friction at the exact moment of Twitch impulse.

---

## Research: Behavioral Economics

### Key Concepts We'll Leverage

**1. Friction Design**
Adding small obstacles dramatically reduces impulsive behavior. Studies show even a 10-second delay can reduce impulse purchases by 50%+.

**2. Reframing Value**
"$6.99" feels abstract. "42 minutes of your work" feels real. Converting currency to time worked creates visceral understanding.

**3. Commitment Devices**
Pre-committing to rules (like daily limits) is more effective than relying on in-the-moment willpower.

**4. Cooling Off Periods**
Mandatory delays between decision and action allow rational thinking to engage.

**5. Loss Aversion**
Showing how spending affects debt repayment ("This pushes your debt-free date back 2 days") is more motivating than showing cost alone.

---

## Research: Technical Feasibility

### What We CAN Do

- ✅ Detect when Twitch purchase modals appear (MutationObserver)
- ✅ Extract prices from the DOM
- ✅ Block/intercept click events before they complete
- ✅ Show custom overlays on Twitch pages
- ✅ Store user settings (Chrome storage API)
- ✅ Detect if user's channel is live (Twitch DOM or API)
- ✅ Export data to CSV/JSON
- ✅ Send webhooks to Discord

### What We CAN'T Do (Easily)

- ❌ Actually prevent payment if user finds workarounds
- ❌ Access Twitch's internal payment APIs
- ❌ Work on mobile Twitch app
- ❌ Guarantee Twitch won't change their DOM structure

### Platform Scope

**Desktop Chrome only** for MVP because:

- Chrome has 65%+ browser market share
- Extension APIs are well-documented
- TypeScript tooling is excellent
- Mobile Twitch app can't run extensions (fundamental limitation)

---

# Phase 2: Design & Architecture

_"Design the solution before writing code."_

---

## Core Concept

A Chrome extension that creates **intentional friction** before Twitch spending:

1. **Detect** purchase attempts (subscribe, gift subs, bits)
2. **Intercept** the click before it completes
3. **Calculate** true cost (with tax, in work hours)
4. **Present** escalating confirmation prompts
5. **Track** spending and blocked attempts
6. **Bypass** when streaming (so you can gift to your own community)

---

## User Configuration Options

### Required Settings

```
Take-home hourly rate: $__.__
  - OR -
Annual salary: $______
  → Calculates hourly automatically (salary ÷ 2080 hours × 0.7 for taxes)

Sales tax rate: _.__%
  (Default: 7.5% for Ohio)
  - OR -
ZIP code: _____
  → Auto-lookup tax rate

Your Twitch username: ________
  (For streaming mode detection)
```

### Optional Settings

```
[ ] Enable streaming mode (bypass when live)
    Grace period after stream ends: __ minutes (default: 15)

[ ] Enable daily spending limit: $__.__
[ ] Enable weekly spending limit: $__.__

Friction level: ( ) Low  ( ) Medium  (•) High  ( ) Extreme

[ ] Track purchases even when bypassed
[ ] Send Discord webhook on purchases
```

---

## The Confirmation Flow (UX Design)

### Friction Levels

**Low Friction:**

```
┌─────────────────────────────────────────┐
│  You're about to spend $6.99            │
│  With tax: $7.51                        │
│  That's 0.21 hours of work (13 min)     │
│                                         │
│  [Cancel]              [I Understand]   │
└─────────────────────────────────────────┘
```

**Medium Friction:**

```
Step 1: Show cost + hours
Step 2: "Why do you want to make this purchase?"
        [To support the streamer]
        [I genuinely want this]
        [Caught up in the moment] ← Suggests canceling
Step 3: Final confirmation
```

**High Friction (Recommended):**

```
Step 1: Show cost + hours + custom comparisons
        "This equals 2.5 gallons of gas"
        "This is 15% of your daily Twitch budget"

Step 2: Mandatory 10-second countdown
        "Take a breath. Do you still want this?"
        [Cancel]  [Yes, I've thought about it] (disabled for 10s)

Step 3: Type confirmation
        "Type 'I WANT THIS' to proceed"
        [________________]
```

**Extreme Friction:**

- All of High Friction, plus:
- 30-second countdown
- Shows impact on debt repayment timeline
- Requires solving a simple math problem
- Sends notification to accountability partner

### Friction Trigger Mode

Users choose when friction activates via the **Trigger Mode** setting:

- **Price Guard** (default) — Friction triggers only when a price is detected on the purchase button. If the extension can't read the price, the click passes through silently (still logged).
- **Zero Trust** — Friction triggers on every purchase button regardless of price detection. No-price overlays show rotating contextual messages from two tonal buckets (matter-of-fact and cheeky, 16 messages total). All intensity steps (reason selection, cooldown timer, math challenge, type-to-confirm) still apply based on the user's intensity setting.

### Chat Command Interception

Intercepts `/gift <#>` and `/subscribe` typed directly in Twitch chat — commands that previously bypassed HC's click-based interception entirely (#39).

- **Two-layer defense:** Primary keydown listener on `[data-a-target="chat-input"]` catches commands before they send. Modal fallback safety net catches the purchase confirmation button if the primary layer misses.
- **Exact pricing:** Slash commands are locked to Tier 1 ($5.99/sub). HC knows the exact price — no estimation needed.
- **Full friction pipeline:** Same decision tree as button clicks (streaming bypass, whitelist, cooldown, caps, intensity escalation). All events tracked with `source: 'chat-command'` metadata.
- **Power-user voice:** Log entries and spending history use sharper copy that acknowledges the user knows the shortcuts.
- **Independent toggle:** "Chat commands" toggle in Friction settings. Enabled by default.
- **Maintained command list:** Adding a new Twitch purchase command is a one-line addition to the `PURCHASE_COMMANDS` array.

---

## Technical Architecture

### Project Structure

```
twitch-spending-guardian/
├── manifest.json                 # Chrome extension manifest (V3)
├── package.json                  # Node dependencies
├── tsconfig.json                 # TypeScript configuration
├── webpack.config.js             # Build configuration
├── src/
│   ├── content/                  # Injected into Twitch pages
│   │   ├── detector.ts           # Watches for purchase modals
│   │   ├── interceptor.ts        # Blocks clicks, shows overlay
│   │   ├── streamingMode.ts      # Detects if user is live
│   │   └── styles.css            # Overlay styling
│   ├── background/
│   │   └── serviceWorker.ts      # Background tasks, storage
│   ├── options/
│   │   ├── options.html          # Settings page
│   │   └── options.ts            # Settings logic
│   ├── popup/
│   │   ├── popup.html            # Quick stats popup
│   │   └── popup.ts              # Popup logic
│   └── shared/
│       ├── types.ts              # TypeScript interfaces
│       ├── storage.ts            # Chrome storage helpers
│       ├── calculations.ts       # Tax, hours, comparisons
│       └── constants.ts          # Magic numbers, selectors
├── assets/
│   └── icons/                    # Extension icons
└── dist/                         # Compiled output
```

### Key Technical Challenges

**1. Detecting Twitch Purchases**

Twitch uses dynamic modals. We'll use MutationObserver to watch for:

- Subscribe button clicks
- Gift sub modal appearances
- Bits purchase flows

```typescript
// Simplified detection logic
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (isPurchaseModal(mutation.target)) {
      interceptPurchase(mutation.target);
    }
  }
});
```

**2. Intercepting Before Completion**

Use event capture phase to catch clicks before Twitch's handlers:

```typescript
document.addEventListener(
  "click",
  (e) => {
    if (isPurchaseButton(e.target)) {
      e.preventDefault();
      e.stopPropagation();
      showFrictionOverlay(extractPrice(e.target));
    }
  },
  { capture: true },
); // Capture phase = runs first
```

**3. Streaming Mode Detection**

Multiple detection methods:

```typescript
// Method 1: Live indicator in DOM
const liveBadge = document.querySelector('[data-a-target="live-indicator"]');

// Method 2: Player state
const livePlayer = document.querySelector(
  '[data-a-target="player-state-live"]',
);

// Method 3: JSON-LD metadata
const scripts = document.querySelectorAll('script[type="application/ld+json"]');
// Parse for: data.publication.isLiveBroadcast === true

// Method 4: URL + DOM combination
const isOwnChannel = window.location.pathname === `/${username}`;
const isLive = !!liveBadge;
```

---

## Streaming Mode Logic

```
Is USER on their OWN channel?
   │
   ├─ NO → Normal friction (doesn't matter if channel is live)
   │
   └─ YES → Is the channel LIVE?
            │
            ├─ YES → 🎮 STREAMING MODE ACTIVE
            │        • Bypass friction
            │        • Log purchase silently
            │        • Show toast: "Streaming Mode - Logged"
            │
            └─ NO → Was channel live recently? (grace period)
                    │
                    ├─ YES (within grace period) →
                    │   🎮 GRACE PERIOD ACTIVE
                    │   • Bypass friction
                    │   • Show: "Grace period: X min remaining"
                    │
                    └─ NO (grace period expired) →
                        🛡️ GUARDIAN ACTIVE
                        • Normal friction
```

### Grace Period

After stream ends, allow a configurable window (default 15 minutes) for:

- Raid gifting
- Final community engagement
- Post-stream thank-you subs

---

# Phase 3: Implementation - MVP

_"Build the core product first, validate it works, then enhance."_

The MVP is broken into 6 parts, each designed to be completed in roughly one stream session.

---

## MVP Part 1: Project Foundation & Detection

**Complexity:** Foundation  
**Estimated Time:** 1.5-2 hours  
**Goal:** Extension loads, detects purchases, shows basic blocking overlay.

### Features

- [ ] Basic manifest.json setup (Manifest V3)
- [ ] Project structure with TypeScript configuration
- [ ] Content script that loads on Twitch pages
- [ ] Detect subscribe/gift sub button clicks using MutationObserver
- [ ] Block the click and show a simple overlay
- [ ] Display the detected price (raw extraction)
- [ ] "Cancel" and "Proceed Anyway" buttons
- [ ] Basic styling so it doesn't look terrible

### Prompt for Claude

```
I'm building a Chrome extension called "Hype Control" using TypeScript
and Manifest V3. I need you to create the foundation which includes:

1. A manifest.json configured for Manifest V3 that:
   - Runs a content script on twitch.tv pages
   - Has appropriate permissions for storage and activeTab
   - Includes basic extension icons (placeholder is fine)

2. A content script (detector.ts) that:
   - Uses MutationObserver to watch for Twitch's subscribe/gift modals
   - Detects clicks on purchase-related buttons (subscribe, gift subs, bits)
   - Extracts the price displayed on the page using DOM selectors

3. An interceptor system (interceptor.ts) that:
   - Prevents the default click action using event capture phase
   - Displays a blocking overlay with the detected price
   - Has "Cancel" and "Proceed Anyway" buttons
   - Removes the overlay and allows the action if user confirms

4. Basic CSS styling for the overlay that:
   - Centers on screen with a dark backdrop
   - Is clearly visible and not easily dismissed
   - Looks clean and intentional

Please set up the full project structure with TypeScript config, package.json,
and explain the key concepts as you build so I can learn. Structure should be:

twitch-spending-guardian/
├── manifest.json
├── src/
│   ├── content/
│   │   ├── detector.ts
│   │   ├── interceptor.ts
│   │   └── styles.css
│   └── shared/
│       └── types.ts
├── package.json
└── tsconfig.json
```

### Success Criteria

- [ ] Extension loads in Chrome without errors
- [ ] Navigating to Twitch shows content script is active (console log)
- [ ] Clicking a sub/gift button shows the overlay
- [ ] Cancel dismisses overlay and blocks the purchase
- [ ] Proceed allows the purchase to continue
- [ ] Price is extracted and displayed (even if not perfect for all cases)

### Validation Steps

1. Load unpacked extension in Chrome (chrome://extensions)
2. Enable Developer Mode
3. Navigate to any Twitch channel
4. Click Subscribe button - overlay should appear
5. Click Cancel - should return to normal, no purchase
6. Click Subscribe again, then Proceed - should allow normal flow

---

## MVP Part 2: Options Page & Income Calculator

**Complexity:** ⭐ Easy  
**Estimated Time:** 45-60 minutes  
**Dependencies:** MVP Part 1 complete  
**Goal:** Let users configure their hourly rate and tax rate.

### Features

- [ ] Options page (options.html) accessible from extension menu
- [ ] Input fields for:
  - Take-home hourly rate (direct entry)
  - OR Annual salary (auto-calculates hourly)
  - Local sales tax rate (default 7.5% for Ohio)
  - OR ZIP code for tax lookup
- [ ] Save settings to Chrome storage
- [ ] Load settings when extension runs
- [ ] Visual feedback when settings are saved

### Prompt for Claude

```
I have the MVP foundation of my Hype Control extension working.
Now I need to add an Options page where users can configure their settings.

Create an options page that includes:

1. options.html with a clean, simple form containing:
   - Two input modes for income (radio button toggle):
     a) "Take-home hourly rate" input (number, e.g., 35.00)
     b) "Annual salary" input (auto-calculates hourly assuming 2080 hours
        and 30% total tax burden)
   - Two input modes for tax (radio button toggle):
     a) "Sales tax rate" input (percentage, default 7.5)
     b) "ZIP code" input (we'll add lookup later, store ZIP for now)
   - Save button
   - Visual feedback when settings are saved ("Settings saved!")

2. options.ts that:
   - Loads existing settings from chrome.storage.sync on page load
   - Saves settings when the form is submitted
   - Validates inputs (positive numbers, reasonable ranges)
   - Calculates hourly rate from salary when that mode is selected

3. Update manifest.json to include the options page

4. Create a shared storage.ts utility with:
   - TypeScript interface for UserSettings
   - Helper functions: saveSettings(), loadSettings()
   - Default values if no settings exist

5. Update the content script to load these settings and use them
   (we'll use them for calculations in the next part)

Keep the styling minimal but professional. Use CSS that matches the
overlay styling from Part 1.
```

### Success Criteria

- [ ] Can access options from extension right-click menu
- [ ] Both income input modes work correctly
- [ ] Settings persist after browser restart
- [ ] Content script can read the saved settings
- [ ] Validation prevents invalid inputs

---

## 🎨 Icon Note: Community Contest Idea

For MVP Parts 1-2, use **placeholder icons** (purple squares with "HC" text or a simple shield shape). Claude Code can generate these.

**Later: "Design the HC Icon" Community Contest**

Once the extension is functional, engage your community:

1. Announce during a Software Saturday stream
2. Give chat ~1 week to submit designs via Discord or a form
3. Requirements:
   - Must be legible at 16x16 (toolbar size)
   - Shield/guardian theme encouraged
   - Bonus points for Twitch purple (#9146FF)
4. Review submissions on stream, let chat vote
5. Winner gets:
   - Their icon in the extension
   - Credit in the README
   - Bragging rights

This ties your community into the project — they're not just watching, they're contributing. Also works as content for a non-coding stream if you need a break from implementation.

**Icon sizes needed:** 16x16, 32x32, 48x48, 128x128 (all PNG)

---

## 📋 Stream 1 Quick Reference (MVP Parts 1-2)

**Pre-Stream Checklist:**

- [x] Node.js installed
- [x] VS Code with Cloak extension
- [x] GitHub repo configured
- [x] Project folder ready for Claude Code
- [ ] Chrome Developer Mode enabled (chrome://extensions → toggle top-right)
- [ ] OBS visibility toggle hotkey ready

**Stream Flow:**

1. **Open** — Brief "why" (Hype Train psychology, friction concept)
2. **Show the doc** — Point to Phase 1 & 2, demonstrate planning before coding
3. **MVP Part 1** — Paste prompt into Claude Code, build foundation (~1.5-2 hrs)
4. **Test live** — Load extension, navigate to Twitch, click Subscribe
5. **If time/energy: MVP Part 2** — Options page, settings storage (~45-60 min)
6. **Wrap up** — Recap what was built, tease next stream

**Total estimated time:** 2-3 hours depending on pace and debugging

---

## MVP Part 3: The Math (Tax + Hours + Custom Comparisons)

**Complexity:** ⭐ Easy  
**Estimated Time:** 30-45 minutes  
**Dependencies:** MVP Part 2 (Options Page)  
**Goal:** Show the TRUE cost in dollars and hours of labor.

### Features

- [ ] Calculate price + sales tax
- [ ] Convert total to hours/minutes of work
- [ ] Display both in the overlay
- [ ] Add custom comparison items (configurable)
- [ ] Format numbers nicely (2 decimal places, etc.)

### The Display

```
┌─────────────────────────────────────────────────────────────────┐
│                     🛡️ SPENDING GUARDIAN                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  You're about to spend:           $24.99                        │
│  With Ohio sales tax (7.5%):      $26.86                        │
│                                                                 │
│  ══════════════════════════════════════════════════             │
│                                                                 │
│  💼 At your rate of $35.00/hour:                                │
│     This costs 46 MINUTES of your work                          │
│                                                                 │
│  📊 That's equivalent to:                                       │
│     • 7.7 gallons of gas                                        │
│     • 2.7 Chipotle burritos                                     │
│     • 53% of your daily Twitch budget                           │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│       [Cancel]                    [I Understand, Proceed]       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Prompt for Claude

```
I need to add the calculation logic to my Hype Control.
The overlay should show the TRUE cost of a purchase.

Create a calculations.ts module that:

1. Takes the raw price (e.g., "$24.99" or "24.99")
2. Applies sales tax based on user's configured rate
3. Converts to work time based on user's hourly rate
4. Generates comparison items

Implement these functions:

interface PurchaseAnalysis {
  rawPrice: number;
  withTax: number;
  taxAmount: number;
  workMinutes: number;
  workFormatted: string; // "46 minutes" or "1 hour 15 minutes"
  comparisons: Comparison[];
}

interface Comparison {
  icon: string;
  text: string;
  value: number;
}

function analyzePurchase(
  rawPrice: number,
  settings: UserSettings
): PurchaseAnalysis

The comparisons should include:
- Gallons of gas (assume $3.50/gallon, configurable)
- Chipotle burritos (assume $10/burrito, configurable)
- Percentage of daily Twitch budget (if user has set one)
- Custom items from user settings

Also update the overlay (interceptor.ts) to:
- Call analyzePurchase() with extracted price and loaded settings
- Display all the calculated information
- Format numbers appropriately (currency with $, percentages with %)

Make the work time formatting smart:
- Under 60 min: "X minutes"
- 60-90 min: "1 hour X minutes"
- Over 90 min: "X.X hours"
```

### Success Criteria

- [ ] Overlay shows price with tax added
- [ ] Work time is calculated correctly
- [ ] At least 2 comparison items display
- [ ] Numbers are formatted nicely
- [ ] Handles edge cases (free items, very expensive items)

---

## MVP Part 4: Multi-Step Confirmation with Escalating Friction

**Complexity:** ⭐⭐ Medium  
**Estimated Time:** 1-1.5 hours  
**Dependencies:** MVP Part 3 (Calculations)  
**Goal:** Add multiple confirmation steps based on friction level setting.

### Features

- [ ] Add friction level setting to options (Low/Medium/High/Extreme)
- [ ] Low: Single confirmation with cost display
- [ ] Medium: Two steps - cost display, then reason selection
- [ ] High: Three steps - cost, mandatory delay timer, type confirmation
- [ ] Extreme: Four steps - all above plus math problem
- [ ] Track which step user cancelled at (for analytics)

### The Steps (High Friction)

**Step 1: Cost Analysis**

```
┌─────────────────────────────────────────┐
│  [Cost breakdown as shown above]        │
│                                         │
│  [Cancel]           [Continue →]        │
└─────────────────────────────────────────┘
```

**Step 2: Cooling Off Period**

```
┌─────────────────────────────────────────┐
│  Take a breath.                         │
│  Do you still want this?                │
│                                         │
│  ████████████░░░░ 7 seconds remaining   │
│                                         │
│  [Cancel]    [Yes, I've thought about it]
│              (button disabled until 0)  │
└─────────────────────────────────────────┘
```

**Step 3: Type Confirmation**

```
┌─────────────────────────────────────────┐
│  Type "I WANT THIS" to proceed:         │
│                                         │
│  [____________________________]         │
│                                         │
│  [Cancel]              [Submit]         │
└─────────────────────────────────────────┘
```

### Prompt for Claude

```
I need to implement multi-step confirmation flows for my Hype Control.
The number of steps depends on the user's friction level setting.

Update the extension to:

1. Add to UserSettings interface:
   - frictionLevel: 'low' | 'medium' | 'high' | 'extreme'

2. Add friction level selector to options page (radio buttons)

3. Create a multi-step overlay system in interceptor.ts:

   type ConfirmationStep =
     | { type: 'cost-analysis', data: PurchaseAnalysis }
     | { type: 'reason-select', options: string[] }
     | { type: 'cooldown', seconds: number }
     | { type: 'type-confirm', phrase: string }
     | { type: 'math-problem', problem: string, answer: number }

   Steps by friction level:
   - Low: [cost-analysis] → proceed
   - Medium: [cost-analysis] → [reason-select] → proceed
   - High: [cost-analysis] → [cooldown(10)] → [type-confirm("I WANT THIS")] → proceed
   - Extreme: [cost-analysis] → [cooldown(30)] → [math-problem] → [type-confirm] → proceed

4. Track cancellation analytics:
   - Which step they cancelled at
   - Time spent on each step
   - Store this for later reporting

5. Reason selection options:
   - "To support the streamer"
   - "I genuinely want this reward/emotes"
   - "Caught up in the moment" ← If selected, show: "That's okay! Consider
     waiting and coming back if you still want it later." and auto-cancel

The cooldown timer should:
- Show a progress bar counting down
- Disable the proceed button until timer completes
- Allow cancel at any time

The type confirmation should:
- Be case-insensitive
- Trim whitespace
- Show error if incorrect and don't proceed
```

### Success Criteria

- [ ] All four friction levels work correctly
- [ ] Timer countdown is smooth and accurate
- [ ] Type confirmation validates correctly
- [ ] "Caught up in the moment" triggers helpful message
- [ ] Cancellation step is tracked
- [ ] Can change friction level in settings

---

## MVP Part 4b: Cancellation Analytics & Behavioral Insights

**Complexity:** ⭐⭐ Medium  
**Estimated Time:** 45-60 minutes  
**Dependencies:** MVP Part 4 (Multi-Step Confirmation)  
**Goal:** Track and display patterns in blocked purchases.

### Features

- [ ] Store every intercept event with metadata
- [ ] Track: timestamp, price, channel, step cancelled at, time spent
- [ ] Calculate insights: most common cancel step, peak spending times
- [ ] Display simple stats in popup

### Data Structure

```typescript
interface InterceptEvent {
  id: string;
  timestamp: Date;
  channel: string;
  priceRaw: number;
  priceWithTax: number;
  workMinutes: number;
  outcome: "cancelled" | "proceeded";
  cancelledAtStep?: number;
  totalSteps: number;
  timeSpentMs: number;
  frictionLevel: string;
  wasStreamingMode: boolean;
}
```

### Prompt for Claude

```
I want to add behavioral tracking to my Hype Control to help me
understand my spending patterns and where the friction is most effective.

Implement:

1. Create an analytics.ts module with:

   interface InterceptEvent {
     id: string;                    // UUID
     timestamp: string;             // ISO date
     channel: string;               // Twitch channel name
     priceRaw: number;
     priceWithTax: number;
     workMinutes: number;
     outcome: 'cancelled' | 'proceeded';
     cancelledAtStep?: number;      // 1, 2, 3, or 4
     totalSteps: number;
     timeSpentMs: number;
     frictionLevel: string;
     wasStreamingMode: boolean;
   }

   - recordIntercept(event: InterceptEvent): Promise<void>
   - getInterceptHistory(days?: number): Promise<InterceptEvent[]>
   - getInsights(): Promise<AnalyticsInsights>

2. AnalyticsInsights should calculate:
   - Total intercepts (all time, this week, today)
   - Cancel rate (% of intercepts that were cancelled)
   - Money "saved" (sum of cancelled purchase prices)
   - Most effective step (which step has highest cancel rate)
   - Peak hours (when do most intercepts happen)
   - Top channels (where do you spend most)

3. Update the multi-step flow to:
   - Start a timer when overlay appears
   - Record the event when user cancels or proceeds
   - Include all metadata

4. Create a simple popup (popup.html + popup.ts) that shows:
   - "Saved this week: $XX.XX"
   - "Blocked X impulse purchases"
   - "Most effective: Step 2 (cooling off)"
   - Link to full analytics (future add-on)

Store data in chrome.storage.local (larger quota than sync).
Keep last 90 days of data, auto-prune older entries.
```

### Success Criteria

- [ ] Every intercept is logged with full metadata
- [ ] Popup shows basic stats
- [ ] "Money saved" calculation is accurate
- [ ] Data persists across browser restarts
- [ ] Old data is automatically pruned

---

## MVP Part 5: Streaming Mode (Auto-Detect Live + Grace Period)

**Complexity:** ⭐⭐⭐ Medium-Hard  
**Estimated Time:** 1-1.5 hours  
**Dependencies:** MVP Parts 1-4  
**Goal:** Bypass friction when streaming so you can gift to your own community.

### Features

- [x] Add Twitch username to settings
- [x] Detect if user is on their own channel
- [x] Detect if channel is currently live
- [x] Bypass friction when both conditions are true (v1.0.4: also short-circuits on manual override regardless of channel)
- [x] Configurable grace period after stream ends
- [x] Still log purchases even when bypassed (outcome: 'streaming')
- [x] Persistent status badge replaces per-purchase toast; shows bypass reason (override / live / grace) and live countdown for manual override

### Detection Logic

```typescript
async function shouldBypassFriction(settings: UserSettings): Promise<{
  bypass: boolean;
  reason: "live" | "grace-period" | "manual" | null;
  gracePeriodRemaining?: number;
}> {
  const currentChannel = getCurrentChannel(); // from URL
  const isOwnChannel =
    currentChannel.toLowerCase() === settings.twitchUsername.toLowerCase();

  if (!isOwnChannel) {
    return { bypass: false, reason: null };
  }

  const isLive = await detectIfLive();

  if (isLive) {
    await storage.set("lastSeenLive", Date.now());
    return { bypass: true, reason: "live" };
  }

  // Check grace period
  const lastLive = await storage.get("lastSeenLive");
  const gracePeriodMs = settings.gracePeriodMinutes * 60 * 1000;
  const elapsed = Date.now() - lastLive;

  if (elapsed < gracePeriodMs) {
    return {
      bypass: true,
      reason: "grace-period",
      gracePeriodRemaining: Math.ceil((gracePeriodMs - elapsed) / 60000),
    };
  }

  return { bypass: false, reason: null };
}
```

### Prompt for Claude

```
I need to add Streaming Mode to my Hype Control so I can gift subs
to my own community while streaming without the friction overlay.

Implement:

1. Add to UserSettings:
   - twitchUsername: string
   - enableStreamingMode: boolean (default: true)
   - gracePeriodMinutes: number (default: 15)
   - logBypassedPurchases: boolean (default: true)

2. Add these fields to the options page

3. Create streamingMode.ts with:

   - getCurrentChannel(): string
     Extract channel name from window.location.pathname

   - detectIfLive(): Promise<boolean>
     Try multiple detection methods:
     a) Look for '[data-a-target="live-indicator"]' in DOM
     b) Look for '[data-a-target="player-state-live"]'
     c) Parse JSON-LD metadata for isLiveBroadcast
     Return true if ANY method indicates live

   - shouldBypassFriction(settings): Promise<BypassResult>
     Logic as described above

4. Update interceptor.ts to:
   - Check shouldBypassFriction() before showing overlay
   - If bypassing:
     - Show a small toast notification: "🎮 Streaming Mode - Purchase logged"
     - Still record the purchase in analytics (with wasStreamingMode: true)
     - Allow the purchase to proceed immediately
   - If in grace period, show: "🎮 Grace Period (X min remaining)"

5. Add manual override:
   - Button in popup to toggle streaming mode on/off manually
   - Manual mode should auto-expire after 4 hours (safety feature)
   - Show warning: "Manual mode expires in X hours"

The toast notification should:
- Appear in bottom-right corner
- Auto-dismiss after 3 seconds
- Not block the purchase flow
- Be visually distinct from the blocking overlay
```

### Success Criteria

- [x] Streaming mode activates only on user's own channel
- [x] Live detection works reliably
- [x] Grace period extends bypass after stream ends
- [x] Purchases are still logged when bypassed
- [x] Persistent status badge (not toast) shows bypass reason and live countdown — replaced per-purchase toast with a `hc-streaming-badge` covering all three bypass reasons (override / live / grace period)
- [x] Manual override works — fixed in v1.0.4: popup now writes `streamingOverride` to `chrome.storage.sync`; `shouldBypassFriction` reads from the correct location and short-circuits globally regardless of channel
- [x] Disabling streaming mode makes it always show friction

**Note (v1.0.4):** The original manual override implementation had a storage-location mismatch — popup wrote to `chrome.storage.sync` but `streamingMode.ts` was reading a never-written `manualOverrideUntil` key from `chrome.storage.local`. Fix (#32) corrects the read path, adds a 2-hour auto-expiry, and replaces the per-purchase toast with a persistent badge that polls every 30s.

### Validation Steps

1. Set your Twitch username in options
2. Go to your own channel while NOT live → Should show friction
3. Start a test stream (or have a friend verify on their live channel)
4. Gift a sub while live → Should show toast only, no friction
5. End stream → Grace period should activate
6. Wait for grace period to expire → Should show friction again
7. Test manual override → Should bypass for up to 4 hours

---

## MVP Part 6: Integration Testing & Polish

**Complexity:** ⭐⭐ Medium  
**Estimated Time:** 1 hour  
**Dependencies:** All MVP Parts  
**Goal:** Ensure everything works together, fix edge cases, polish UX.

### Testing Checklist

**Basic Flow:**

- [ ] Fresh install → Options page prompts for setup
- [ ] Settings save and load correctly
- [ ] Overlay appears on subscribe click
- [ ] Overlay appears on gift sub click
- [ ] Overlay appears on bits purchase
- [ ] All friction levels work correctly
- [ ] Cancel blocks the purchase
- [ ] Proceed allows the purchase

**Calculations:**

- [ ] Tax calculation is accurate
- [ ] Work hours calculation is accurate
- [ ] Comparisons display correctly
- [ ] Edge case: $0.00 price handled
- [ ] Edge case: Very large price handled

**Streaming Mode:**

- [x] Activates only on own channel
- [x] Live detection works
- [x] Grace period works
- [x] Persistent badge appears (replaced toast — badge covers override / live / grace reasons)
- [x] Purchases logged when bypassed (outcome: 'streaming')
- [x] Manual override works (v1.0.4 fix — storage-location mismatch resolved)
- [x] Auto-expiry works (2-hour manual override window)

**Analytics:**

- [ ] Events are recorded
- [ ] Popup shows accurate stats
- [ ] Data persists across restarts
- [ ] Old data is pruned

**Polish:**

- [ ] Overlay styling is clean
- [ ] Toast styling is clean
- [ ] Options page is intuitive
- [ ] Error states are handled gracefully
- [ ] Loading states shown where needed

### Known Edge Cases

1. **Price extraction fails** → Show overlay with "Unable to detect price, proceed with caution?"
2. **Settings not configured** → Redirect to options page
3. **Twitch DOM changes** → Log error, fail open (allow purchase with warning)
4. **Multiple rapid clicks** → Debounce, only show one overlay
5. **User navigates away during overlay** → Clean up overlay state

### Prompt for Claude

```
I've completed all MVP parts of my Hype Control. Now I need help
with integration testing and polish.

Please help me:

1. Create a testing checklist component that I can use during development:
   - A simple HTML page that lists all test cases
   - Checkboxes to mark as tested
   - Notes field for each test
   - Export results to JSON

2. Review the code for these edge cases and add handling:
   - What if price extraction returns null/undefined?
   - What if settings haven't been configured yet?
   - What if Twitch's DOM structure changes?
   - What if user clicks purchase button multiple times rapidly?
   - What if user navigates away while overlay is shown?

3. Add graceful error handling:
   - Try/catch around critical paths
   - Fallback behaviors when things fail
   - User-friendly error messages
   - Console logging for debugging

4. Polish the UX:
   - Add subtle animations to overlay appearance
   - Add focus management (trap focus in overlay)
   - Add keyboard support (Escape to cancel)
   - Ensure overlay is accessible (ARIA labels)

5. Add a "debug mode" setting that:
   - Logs detailed info to console
   - Shows detection events in real-time
   - Helps troubleshoot issues on stream
```

### Success Criteria

- [ ] All checklist items pass
- [ ] Edge cases handled gracefully
- [ ] No console errors in normal operation
- [ ] Extension feels polished and intentional

---

# 🎉 MVP COMPLETE

At this point, you have a **fully functional** Hype Control that:

✅ Detects purchase attempts on Twitch  
✅ Shows true cost (with tax, in work hours)  
✅ Requires multi-step confirmation based on friction level  
✅ Tracks spending patterns and blocked purchases  
✅ Bypasses when you're streaming to your own community  
✅ Is polished and handles edge cases

**The extension is now genuinely useful for spending discipline!**

Optional add-ons below enhance the experience but aren't required.

---

# Phase 4: Enhancements - Optional Add-ons

_"Once the core works, add features based on need and interest."_

These add-ons extend the MVP with additional features. They're ordered from easiest to hardest complexity.

**Rules for Add-ons:**

1. MVP must be 100% working before starting ANY add-on
2. Each add-on should be independently useful
3. Add-ons can depend on other add-ons (see dependencies)
4. Skip add-ons that don't interest you or your audience

---

## Add-on 1: Delay Timer (Standalone)

**Complexity:** ⭐ Easy  
**Estimated Time:** 30-45 minutes  
**Dependencies:** MVP complete  
**Goal:** Add a mandatory waiting period before ANY purchase can proceed.

### Features

- [ ] Configurable delay (5, 10, 30, 60 seconds)
- [ ] Visual countdown timer with progress bar
- [ ] Cannot proceed until timer completes
- [ ] Can cancel at any time

This is simpler than the multi-step cooldown - it's a single timer that applies regardless of friction level.

---

## Add-on 2: Spending Tracker (History View) — COMPLETE

**Complexity:** ⭐⭐ Medium
**Estimated Time:** 1-1.5 hours
**Dependencies:** MVP Part 4b (Analytics)
**Goal:** Show detailed spending history in a dedicated page.

### Features

- [x] Full-page view of all tracked purchases
- [x] Filter by: date range, channel, outcome
- [x] Sort by: date, amount, channel
- [x] Show totals: spent, blocked, saved
- [ ] Exportable to CSV

**Bug fix (v0.4.26):** Purchases that bypassed friction (cap-bypass, no-friction, whitelist-skip, whitelist-reduced) were not being recorded in spending history via `writeInterceptEvent()`. All bypass paths now correctly write intercept events so the history view is complete and accurate.

---

## Add-on 3: Spending Limits with Alerts

**Complexity:** ⭐⭐ Medium  
**Estimated Time:** 45-60 minutes  
**Dependencies:** Add-on 2 (Spending Tracker)  
**Goal:** Set daily/weekly/monthly limits and get warned when approaching.

### Features

- [ ] Configurable limits (daily, weekly, monthly)
- [ ] Progress bar in overlay: "You've spent $X of $Y today"
- [ ] Warning at 80%: "You're approaching your daily limit"
- [ ] Hard stop at 100%: "You've reached your limit. Come back tomorrow!"
- [ ] Option to override limit (with extra friction)

---

## Add-on 4: Custom Comparison Items

**Complexity:** ⭐⭐ Medium  
**Estimated Time:** 1 hour  
**Dependencies:** MVP Part 3 (Calculations)  
**Goal:** Let users define their own "this equals X" comparisons.

### Features

- [ ] Add custom items in options: name, icon, price
- [ ] Examples: "coffees", "lunch", "monthly subscriptions"
- [ ] Show in overlay alongside default comparisons
- [x] Reorder comparisons by preference

---

## Add-on 5: Streamer Whitelist

**Complexity:** ⭐⭐ Medium  
**Estimated Time:** 45-60 minutes  
**Dependencies:** MVP complete  
**Goal:** Different friction levels for different streamers.

### Features

- [ ] Maintain a list of streamers with custom settings
- [ ] "Always allow" list (no friction)
- [ ] "Extra friction" list (always extreme)
- [ ] Default friction for unlisted streamers
- [ ] Quick-add from overlay: "Remember this choice"

---

## Add-on 6: Export Data (CSV/JSON)

**Complexity:** ⭐⭐ Medium  
**Estimated Time:** 30-45 minutes  
**Dependencies:** Add-on 2 (Spending Tracker)  
**Goal:** Export spending data for external analysis.

### Features

- [ ] Export all data as JSON
- [ ] Export as CSV for spreadsheets
- [ ] Choose date range for export
- [ ] Include/exclude cancelled purchases

---

## Add-on 7: Accountability Partner

**Complexity:** ⭐⭐⭐ Medium-Hard  
**Estimated Time:** 1.5-2 hours  
**Dependencies:** MVP complete  
**Goal:** Share spending with a trusted person for accountability.

### Features

- [ ] Generate shareable link to view-only dashboard
- [ ] Partner sees: total spent, recent purchases, blocked count
- [ ] Optional: Partner can adjust your friction level remotely
- [ ] Weekly summary email to partner
- [ ] No personal Twitch login required for partner

---

## Add-on 8: Discord Shame Integration 😈

**Complexity:** ⭐⭐⭐ Medium-Hard  
**Estimated Time:** 1-1.5 hours  
**Dependencies:** MVP complete  
**Goal:** Post to Discord when you make a purchase (for accountability).

### Features

- [ ] Configure Discord webhook URL
- [ ] Choose what to post: all purchases, over $X, proceeded after blocking
- [ ] Customize message format
- [ ] Option for "shame" mode vs "celebration" mode
- [ ] Rate limiting to prevent spam

### Example Discord Message

```
🎮 Twitch Spending Alert

Josh just spent $26.86 on twitch.tv/ktulue
That's 46 minutes of work!

They made it through 3 friction steps before proceeding.
Monthly total: $127.50 / $150.00 budget (85%)
```

---

## Add-on 9: Weekly Email Summary

**Complexity:** ⭐⭐⭐ Medium-Hard  
**Estimated Time:** 1.5-2 hours  
**Dependencies:** Add-on 2 (Spending Tracker)  
**Goal:** Get a weekly email with your spending summary.

### Features

- [ ] Set up via Google Apps Script (no server needed)
- [ ] Weekly digest: spent, blocked, saved, top channels
- [ ] Trend: "You spent 20% less than last week!"
- [ ] Configurable day/time of delivery

---

## Add-on 10: Regret Scoring (24-Hour Check-in)

**Complexity:** ⭐⭐⭐⭐ Hard  
**Estimated Time:** 2-2.5 hours  
**Dependencies:** Add-on 2 (Spending Tracker)  
**Goal:** Rate purchases 24 hours later to build self-awareness.

### Features

- [ ] 24 hours after purchase, show notification: "How do you feel about this?"
- [ ] Rating scale: 😊 Glad I did it → 😐 Neutral → 😞 Regret it
- [ ] Track regret patterns over time
- [ ] Insight: "You regret 60% of purchases over $20"
- [ ] Use regret data to suggest optimal friction level

---

## Add-on 11: Monthly Budget & Rollover System

**Complexity:** ⭐⭐⭐⭐ Hard  
**Estimated Time:** 2-2.5 hours  
**Dependencies:** Add-on 3 (Spending Limits)  
**Goal:** Track blocked attempts as "savings" and reward discipline with rollover.

### The Concept

Every time you cancel/block a purchase, that's money you DIDN'T spend. Track these "saves" and:

1. Show cumulative "saved" amount for the month
2. Compare against your monthly Twitch budget
3. Reward staying under budget with rollover to next month

This gamifies discipline - you're not just avoiding spending, you're _earning_ future spending power.

### Features

- [ ] Monthly budget configuration
- [ ] Track blocked/cancelled purchase amounts
- [ ] Calculate "saved" vs "spent" each month
- [ ] Rollover unused budget to next month
- [ ] Rollover cap (max accumulation)
- [ ] Strict mode: block purchases that exceed remaining budget
- [ ] Celebration messages for staying under budget

### The Overlay Shows:

```
📊 BUDGET CHECK

Monthly budget: $50.00
Spent so far: $27.14
══════════════════════════░░░░░░░░░░  54%

This purchase: $26.86
Remaining after: -$4.00 ⚠️

💪 You've saved $89.50 this month (6 blocked attempts)
```

---

## Add-on 12: Reporting Dashboard + Google Sheets Integration

**Complexity:** ⭐⭐⭐⭐⭐ Very Hard  
**Estimated Time:** 3+ hours  
**Dependencies:** Add-ons 2, 3, 11  
**Goal:** Visual dashboard with historical tracking via Google Sheets.

### Features

- [ ] Full-page analytics dashboard with charts
- [ ] Monthly/yearly trend visualization
- [ ] Export to Google Sheets automatically
- [ ] Track multi-year spending patterns
- [ ] Compare month-over-month, year-over-year
- [ ] Insights: "Best month ever!", "Trending up 15%"

### Google Sheets Integration

- [ ] One-time setup via Google Apps Script
- [ ] Auto-sync daily/weekly
- [ ] Sheet structure: Date, Amount, Channel, Outcome, Notes
- [ ] Pivot tables for monthly/yearly summaries
- [ ] Pre-built charts in the sheet

---

# Stream Planning

## Suggested Stream Schedule

| Stream        | Focus               | Duration  | Content                                       |
| ------------- | ------------------- | --------- | --------------------------------------------- |
| **Stream 0**  | Planning & Research | 1.5-2 hrs | Walk through this document, explain the "why" |
| **Stream 1**  | MVP Parts 1-2       | 2-2.5 hrs | Foundation + Options Page                     |
| **Stream 2**  | MVP Parts 3-4       | 2-2.5 hrs | Calculations + Multi-Step Flow                |
| **Stream 3**  | MVP Parts 5-6       | 2-2.5 hrs | Streaming Mode + Polish                       |
| **Stream 4+** | Add-ons             | Varies    | Pick based on interest                        |

## Stream 0: "Planning & Research" (No Coding!)

**Goal:** Demonstrate that great software starts with research and design.

### Agenda

1. **The Problem** - Show a Twitch hype train, explain the psychology
2. **Personal Context** - Why you need this
3. **Research** - The Reddit inspiration, behavioral economics concepts
4. **Design Decisions** - Walk through architecture, UX flows
5. **The Document** - Show this planning doc as the deliverable

### Chat Engagement

- "Have you ever regretted a Twitch purchase?"
- "What friction level would YOU want?"
- "Any features you'd add?"

---

## Viewer Takeaways by Stream

| Stream | What Viewers Learn                                       |
| ------ | -------------------------------------------------------- |
| 0      | Planning > coding, behavioral economics, project scoping |
| 1      | Chrome extension basics, Manifest V3, TypeScript setup   |
| 2      | DOM manipulation, event interception, state management   |
| 3      | API detection, Chrome storage, UX polish                 |
| 4+     | Specific skills per add-on                               |

---

# Appendix

## Twitch DOM Selectors (May Change)

```typescript
// Subscribe button
'[data-a-target="subscribe-button"]';
'[data-a-target="subscribed-button"]'; // Already subscribed

// Gift sub modal
'[data-a-target="gift-button"]';
".gift-sub-modal";

// Bits
'[data-a-target="bits-button"]';
".bits-buy-modal";

// Price display
".tw-pd-x-1"; // Often contains price text
'[data-a-target="subscription-price"]';

// Live indicator
'[data-a-target="live-indicator"]';
'[data-a-target="player-state-live"]';

// Channel name from URL
window.location.pathname.split("/")[1];
```

**Note:** Twitch frequently updates their DOM. These selectors may need updating.

## Ohio Sales Tax Rates by ZIP (Sample)

```typescript
const ohioTaxRates: Record<string, number> = {
  "44124": 8.0, // Lyndhurst (Cuyahoga County)
  "44122": 8.0, // Beachwood
  "44106": 8.0, // Cleveland
  "43215": 7.5, // Columbus
  "45202": 7.0, // Cincinnati
  // ... etc
};
```

## Known Issues

- **Bits Combo module** — The animated Bits Combo (timer/counter) that Twitch displays during cheering cannot currently be intercepted. Hype Control can intercept the "Get Bits" button in the top navigation bar, but the Combo module uses a non-standard rendering path that doesn't expose a clickable element Hype Control can hook.

## Version History

### v0.4.12 — Round 2 Bug Fixes (2026-03-13)

Seven UX issues addressed from Round 2 feedback:

1. **Popup — duplicate Thresholds toggle removed** from Stats section (was duplicate of the one in Friction)
2. **Popup — scroll fixed** (`min-height: 0` added to `.hc-content` so overflow region activates correctly)
3. **Friction — Nudge Steps capped** at total comparison item count (prevents setting more steps than items)
4. **Settings Log — popup saves now logged** (`settingsLog` wired into popup save handler; `setVersion` called at startup)
5. **Logs page — content centered** (wrapped body content in `.log-wrapper` with `max-width: 900px`)
6. **Comparison subpanel — emoji picker hint restored** (keyboard shortcuts for Windows/Mac shown below emoji input)
7. **Whitelist friction overlay — copy corrected** ("This channel is on your whitelist" replaces placeholder dev text)

### v0.4.13 — Stat Card Tooltips (2026-03-13)

Enhancement 8: All 4 stat tiles (Saved, Blocked, Cancel Rate, Best Step) now show a ⓘ icon in the bottom-right corner. Hovering or focusing the tile reveals a tooltip explaining the stat. CSS-only implementation — no JS required.

### v0.4.26 — Bypass Recording Fix & Logs Copy All (2026-03-19)

1. **Spending history bypass-recording fix** — Purchases that bypassed friction (cap-bypass, no-friction, whitelist-skip, whitelist-reduced) were not calling `writeInterceptEvent()`, so they never appeared in spending history. All bypass paths now correctly record intercept events.
2. **Logs — Copy All button** — Added a "Copy All" button to the logs page that copies all visible log entries to the clipboard for easy sharing and debugging.

### v0.4.27 — Savings Calendar Feature (2026-03-19)

1. **Savings calendar in Limits section** — Interactive calendar widget in popup that visualizes spending patterns over 90 days with a toggle calendar icon for easy access/dismissal.
2. **Three-tier day classification** — Days displayed in three states: zero-spend (green), within-limits (blue), over-limits (red) for at-a-glance spending status.
3. **90 rotating motivational messages** — 30 unique messages per tier (zero/within/over) provide personalized encouragement based on daily performance.
4. **Date-seeded deterministic selection** — Each day receives the same motivational message on repeat visits using a date-based seed algorithm.
5. **Keyboard navigation support** — Arrow keys navigate dates, Enter/Space selects, Escape closes; full keyboard accessibility for power users.
6. **Session/Daily tracker reorder** — Reordered tracker rows in popup for improved information hierarchy and UX flow.
7. **90-day rolling window** — Calendar displays the last 90 days of data with automatic pruning of older entries.
8. **Empty state handling** — New users see helpful messaging when insufficient data exists for calendar display.

## Links & Resources

- **Chrome Extension Docs:** https://developer.chrome.com/docs/extensions/
- **Manifest V3 Migration:** https://developer.chrome.com/docs/extensions/mv3/
- **TypeScript:** https://www.typescriptlang.org/docs/
- **Webpack:** https://webpack.js.org/concepts/

---

**Document Version:** 1.4
**Last Updated:** 2026-03-19
**Ready for:** Software Saturdays Stream Series
