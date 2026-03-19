# Savings Calendar — Design Spec

**Date:** 2026-03-19
**Version:** 0.4.26+
**Scope:** Inline popup calendar showing daily savings with rotating motivational messages

---

## Overview

A calendar view embedded in the popup's Limits section that shows how much the user saved (cancelled purchases) each day. Each day is color-coded into one of three tiers — $0 spent, within limits, or over limits — and clicking a day shows a randomly selected motivational message from a pool of 30 per tier (90 total).

The goal is positive reinforcement. Addiction is hard; this calendar should make every day feel like progress, even the rough ones.

---

## Location & Trigger

- A small calendar icon sits to the right of the tracker totals area in the Limits section of the popup.
- Clicking the icon toggles the calendar grid open/closed inline below the tracker totals.
- Clicking again (or clicking the icon a second time) collapses it.

---

## Session → Daily Reorder

Reorder the tracker display rows from the current order:

**Current:** Daily → Session → Weekly → Monthly
**New:** Session → Daily → Weekly → Monthly

Session is per-channel (most granular/immediate), then daily, then the longer periods. This is a natural escalation of scope.

**Note:** Session data is transient and resets on channel switch. It is NOT displayed in the calendar — the calendar only shows historical data from persisted `InterceptEvent` records.

---

## Calendar Grid

- Standard month grid layout: Su Mo Tu We Th Fr Sa column headers, day number cells.
- Left/right arrow buttons to navigate between months.
- Navigation capped at 90 days back from today (matches the `InterceptEvent` data retention window). The left arrow is disabled when the displayed month is entirely outside the 90-day window. Days within a visible month but outside the 90-day window render as neutral/empty (no data available).
- Current month shown by default. Right arrow disabled when viewing the current month.
- Future days and days with no data render as empty/neutral cells.
- Today's cell is visually distinct (border or subtle highlight) so the user knows where they are.
- **Empty state:** If there are zero `InterceptEvent` records, show a friendly message instead of the grid: "No spending data yet — HypeControl will start tracking here once it intercepts a purchase."

---

## Data Source

Reads from `InterceptEvent[]` via `readInterceptEvents()` — the same data the Spending History page uses. No new storage needed.

Per calendar day, compute:
- **Saved:** Sum of `savedAmount` from events where `outcome === 'cancelled'`. Treat `undefined` or `0` as `$0.00` saved — a cancellation with no detected price is still a cancellation and still counts toward Tier 1.
- **Spent:** Sum of `priceWithTax` from events where `outcome === 'proceeded'`

These two values determine the tier and are interpolated into messages.

**Cap comparison uses current settings.** Historical cap values are not stored, so the calendar always evaluates tiers against the user's current daily cap setting. This means changing the cap can retroactively shift days between Tier 2 and Tier 3. This is acceptable — the calendar reflects "how would today's rules judge that day," not "what were the rules at the time."

---

## Day Cell Tiers

Three tiers based on the day's activity:

### Tier 1: $0 Day (No Proceeded Purchases)

**Condition:** At least one `InterceptEvent` exists for this day AND no `proceeded` events exist. The user was tempted and resisted — that's worth celebrating. (Days with zero events of any kind are neutral/empty, not Tier 1.)

**Visual:** Strong green glow or highlight. This is the hero state — it should feel like an achievement. Consider a subtle sparkle or star icon in the cell.

**On click:** Shows a random message from the `$0 Pool` (30 messages).

### Tier 2: Within Limits

**Condition:** Has `proceeded` events, but the day's total spent did not exceed the user's daily cap. If no daily cap is set, all non-zero spending days fall here (Tier 3 is unreachable without a daily cap). Weekly/monthly caps are not used for tier classification — the calendar is a daily view and daily cap is the natural boundary.

**Visual:** Subtle green or calm neutral styling. Acknowledges spending without alarm.

**On click:** Shows a random message from the `Within Limits Pool` (30 messages). Message includes the actual amount spent, interpolated as `$X`.

### Tier 3: Over Limits

**Condition:** Day's total spent exceeded the user's daily cap.

**Visual:** Warm amber. NOT red — this is not punishment. The tone is compassionate.

**On click:** Shows a random message from the `Over Limits Pool` (30 messages). Message includes the actual amount spent, interpolated as `$X`.

### Edge Cases

- **Days with no events at all:** Render as neutral/empty. No tier, no click behavior.
- **Days with only cancelled events (no proceeded):** Tier 1 ($0 day). The user was tempted and resisted — that's worth celebrating.
- **No daily cap configured:** Tier 3 (over limits) is unreachable. All spending days are Tier 2. Weekly/monthly caps do not influence tier classification.
- **`savedAmount` is `undefined` or `0`:** Treat as `$0.00` saved. The cancellation still counts toward making the day Tier 1 if there are no proceeded events.

---

## Message Pools (30 per tier, 90 total)

Messages should be written in HypeControl's voice: sharp, cheeky, honest, but always kind. The over-limits pool is especially important — it must feel like a friend who's proud of you for trying, never a disappointed parent.

Messages with `$X` will have the actual spent amount interpolated at render time, always formatted to 2 decimal places (e.g., `$14.99`, `$0.00`).

### $0 Pool — Big Celebration Energy

1. "Zero. Zilch. Nada. Your wallet thanks you."
2. "Not a single dollar. That's discipline."
3. "Clean sheet. You didn't even flinch."
4. "The best purchase is the one you didn't make."
5. "Your bank account had a peaceful day."
6. "$0 spent. That hits different."
7. "Nothing. Zip. A perfect zero."
8. "Today you chose yourself over the hype."
9. "Twitch got $0 from you today. Legend."
10. "A whole day of content, and your wallet's untouched."
11. "You watched. You enjoyed. You kept your money."
12. "Zero dollars spent. Infinite self-control."
13. "The hype train left the station without your wallet."
14. "Absolutely nothing spent. You love to see it."
15. "Your card didn't even warm up today."
16. "Not today, impulse. Not today."
17. "The best number in finance: $0."
18. "You proved you don't need to spend to enjoy the stream."
19. "All entertainment, no regret. Perfect day."
20. "Hype came and went. Your money stayed."
21. "A masterclass in watching without spending."
22. "Your future self just high-fived you."
23. "Zero spent. The streak lives."
24. "You showed up, had fun, and spent nothing. That's a win."
25. "The emotes were free. The restraint was priceless."
26. "Another day, another $0. You're getting good at this."
27. "Chat was wild. Your spending was calm."
28. "Big streams, zero purchases. That's the goal."
29. "You rode the hype wave without opening your wallet."
30. "Look at you — all the fun, none of the bill."

### Within Limits Pool — Respectful Nod

1. "Spent $X — well within budget. That's control, not restriction."
2. "You set a line and stayed behind it. That's the whole game."
3. "$X today. You knew your limit and respected it."
4. "Under budget at $X. Conscious spending is still smart spending."
5. "Spent $X and stopped. That takes more strength than spending zero."
6. "$X out the door, but on your terms. That's what matters."
7. "You spent $X — and you decided it was worth it. That's the difference."
8. "Budget intact at $X. Controlled, intentional, yours."
9. "$X today. You're not avoiding spending — you're choosing it."
10. "Stayed in bounds at $X. The cap worked exactly as designed."
11. "Spent $X. No regret, no excess. That's the sweet spot."
12. "$X and done. You called the shot."
13. "Under the cap at $X. This is what mindful spending looks like."
14. "$X — spent with intention, not impulse."
15. "Your limit said stop, and at $X, you listened."
16. "Conscious spending: $X. Not too much, not guilty about it."
17. "$X today. The important thing? You chose it."
18. "Spent $X within your budget. That's a skill."
19. "$X and comfortable with it. That's progress."
20. "You treated yourself to $X and stayed in control. Both matter."
21. "$X — spent because you wanted to, not because hype told you to."
22. "Under budget at $X. You're building a habit here."
23. "$X today. Smart money, smart choices."
24. "Spent $X and it was your call. That's all we ask."
25. "$X — right where you planned to be."
26. "Budget check: $X out of your cap. Smooth sailing."
27. "$X today. You're proving you can enjoy Twitch on your terms."
28. "Spent $X. The cap held. You held."
29. "$X and within limits. Consistency is everything."
30. "You spent $X today and that's perfectly fine. Limits exist for the big days."

### Over Limits Pool — Warm, No Shame

1. "Went over at $X. You're here, you're tracking — that's the hard part."
2. "Over budget today at $X. But you're looking at this, and that means you care."
3. "$X today — more than planned. Tomorrow's a fresh start."
4. "Rough day at $X. It happens. The fact that you're checking says everything."
5. "Over the cap at $X. One day doesn't define the pattern."
6. "$X today. The hype got you — but you're already reflecting on it."
7. "Spent $X, past the limit. Hey, awareness is the hardest step."
8. "Over at $X. You're not failing — you're learning your triggers."
9. "$X today. Some days are harder. You're still here, still trying."
10. "Past the cap at $X. Progress isn't a straight line."
11. "$X — more than you wanted. But wanting to do better? That's huge."
12. "Over budget at $X. You installed this extension for days like this. It's working."
13. "$X today. Not your best day, but you're building something bigger than one day."
14. "Went past the limit at $X. Forgive yourself and keep going."
15. "Over at $X. You know what? Most people don't even track this."
16. "$X today — yeah, that's over. But you're not hiding from it."
17. "Past the cap at $X. The fact that you noticed is the whole point."
18. "$X spent. The cap is a guide, not a judgment. Tomorrow's another day."
19. "Over at $X. You're in the arena. That counts for more than a perfect record."
20. "$X today. Some days the hype wins. What matters is you keep showing up."
21. "Spent $X, past your limit. Be kind to yourself — change takes time."
22. "Over budget at $X. But look at the other days on this calendar. See the pattern?"
23. "$X today. One bad day surrounded by good ones is still a good month."
24. "Past the cap at $X. You're not starting over — you're continuing."
25. "$X — the hype was real today. So is your commitment to doing better."
26. "Over at $X. Remember: the goal isn't perfection. It's intention."
27. "$X today, over the limit. You caught it. That's step one."
28. "Went over at $X. The old you wouldn't even have noticed."
29. "Over budget at $X. Every day you track is a day you're taking control."
30. "$X spent. More than planned, but less than if you didn't care at all."

---

## Interaction Details

- **Click a day cell** → A detail panel appears anchored below the calendar grid (not a floating tooltip — avoids popup clipping issues). Shows:
  - The saved amount (if any): "Saved $X.XX"
  - The spent amount (if any): "Spent $X.XX"
  - The random tier message
  - The clicked cell gets a visual highlight to indicate selection
- **Click another day** → Previous selection clears, new panel content loads
- **Click outside / click calendar icon** → Calendar collapses
- **Message selection:** Seeded by the date (deterministic per day) so the same day always shows the same message. Prevents slot-machine effect from repeated clicks.
- **Navigate months** → Left/right arrows, current month label in the header (e.g., "March 2026")

---

## Visual Notes

- Calendar cells should be compact — the popup is constrained. Think mini-calendar, not full-page.
- Green glow for $0 days should be noticeable but not blinding. Subtle pulse or soft glow.
- Amber for over-limits — warm, not aggressive. Think caution, not danger.
- The calendar icon near the totals should be small and unobtrusive until clicked.
- Dark theme by default, respects the user's theme preference (auto/light/dark).
- Typography: Space Grotesk for labels, monospace for dollar amounts (consistent with rest of extension).
- **Accessibility:** Calendar uses `role="grid"` with `role="gridcell"` for day cells. Arrow key navigation between cells, Enter to select. Each cell has an `aria-label` describing the date and tier (e.g., "March 15 — $0 spent, within limits").

---

## What This Doesn't Do

- No editing or resetting spending data from the calendar
- No weekly/monthly calendar views — month-at-a-time with navigation only
- No session data displayed (session is transient, not persisted)
- No animations beyond expand/collapse toggle
- No new storage — reads existing `InterceptEvent` data only
