/**
 * Types for Hype Control extension
 */

/** Types of purchases we can detect on Twitch */
export type PurchaseType = string; // Now uses actual button text for specificity

/** Information about a detected purchase attempt */
export interface PurchaseAttempt {
  type: PurchaseType;
  rawPrice: string | null;
  priceValue: number | null;
  channel: string;
  timestamp: Date;
  element: HTMLElement;
  isDemoMode?: boolean;  // true when fired from triggerDemoOverlay() — skips storage writes
}

/** Result of the user's decision on the overlay */
export type OverlayDecision = 'cancel' | 'proceed';

/** Callback when user makes a decision on the overlay */
export type OverlayCallback = (decision: OverlayDecision) => void;

/** A single comparison item (preset or custom) */
export interface ComparisonItem {
  id: string;
  emoji: string;
  name: string;
  price: number;
  pluralLabel: string;
  enabled: boolean;
  isPreset: boolean;
  frictionScope: 'nudge' | 'full' | 'both';
}

/** Friction level applied at different spend amounts */
export type FrictionLevel = 'none' | 'nudge' | 'full' | 'cap-bypass';

/** User-selectable named friction intensity (how intense friction is when it triggers) */
export type FrictionIntensity = 'low' | 'medium' | 'high' | 'extreme';

/** Friction threshold tier configuration */
export interface FrictionThresholds {
  enabled: boolean;
  thresholdFloor: number;
  thresholdCeiling: number;
  softNudgeSteps: number;
}

/** Cooldown configuration */
export interface CooldownConfig {
  enabled: boolean;
  minutes: number;
}

/** Daily spending cap configuration */
export interface DailyCapConfig {
  enabled: boolean;
  amount: number;
}

/** Weekly spending cap configuration */
export interface WeeklyCapConfig {
  enabled: boolean;
  amount: number;
}

/** Monthly spending cap configuration */
export interface MonthlyCapConfig {
  enabled: boolean;
  amount: number;
}

/** Standalone delay timer shown as the final step before purchase fires */
export interface DelayTimerConfig {
  enabled: boolean;
  seconds: 5 | 10 | 30 | 60;
}

/** Whitelist behavior applied to a specific channel */
export type WhitelistBehavior = 'skip' | 'reduced' | 'full';

/** A single channel whitelist entry */
export interface WhitelistEntry {
  username: string;         // normalized lowercase, no URL prefix
  behavior: WhitelistBehavior;
}

/** Streaming mode configuration */
export interface StreamingModeConfig {
  enabled: boolean;           // default: false
  twitchUsername: string;     // default: ''
  gracePeriodMinutes: number; // default: 15
  logBypassed: boolean;       // default: true
}

/** Theme preference for overlay styling */
export type ThemePreference = 'auto' | 'light' | 'dark';

/** User settings stored in chrome.storage.sync */
export interface UserSettings {
  hourlyRate: number;
  taxRate: number;
  comparisonItems: ComparisonItem[];
  cooldown: CooldownConfig;
  dailyCap: DailyCapConfig;
  weeklyCap: WeeklyCapConfig;
  monthlyCap: MonthlyCapConfig;
  frictionThresholds: FrictionThresholds;
  frictionIntensity: FrictionIntensity;
  delayTimer: DelayTimerConfig;
  streamingMode: StreamingModeConfig;
  toastDurationSeconds: number;
  whitelistedChannels: WhitelistEntry[];
  theme: ThemePreference;
  weeklyResetDay: 'monday' | 'sunday';
  intensityLocked: boolean;
  streamingOverride?: { expiresAt: number };
}

/** Preset comparison items */
export const PRESET_COMPARISON_ITEMS: ComparisonItem[] = [
  {
    id: 'preset-chicken',
    emoji: '\u{1F357}',
    name: 'Costco Rotisserie Chicken',
    price: 4.99,
    pluralLabel: 'Costco chickens',
    enabled: true,
    isPreset: true,
    frictionScope: 'both',
  },
  {
    id: 'preset-hotdog',
    emoji: '\u{1F32D}',
    name: 'Costco Hot Dog',
    price: 1.50,
    pluralLabel: 'Costco glizzies',
    enabled: true,
    isPreset: true,
    frictionScope: 'both',
  },
  {
    id: 'preset-galleyboy',
    emoji: '\u{1F354}',
    name: "Swenson's Galley Boy",
    price: 4.99,
    pluralLabel: 'Galley Boys',
    enabled: true,
    isPreset: true,
    frictionScope: 'both',
  },
];

/** Default settings for new users */
export const DEFAULT_SETTINGS: UserSettings = {
  hourlyRate: 35,
  taxRate: 7.5,
  comparisonItems: PRESET_COMPARISON_ITEMS,
  cooldown: {
    enabled: false,
    minutes: 5,
  },
  dailyCap: {
    enabled: false,
    amount: 50,
  },
  weeklyCap: {
    enabled: false,
    amount: 200,
  },
  monthlyCap: {
    enabled: false,
    amount: 800,
  },
  frictionThresholds: {
    enabled: false,
    thresholdFloor: 5,
    thresholdCeiling: 25,
    softNudgeSteps: 1,
  },
  frictionIntensity: 'low',
  delayTimer: {
    enabled: false,
    seconds: 10,
  },
  streamingMode: {
    enabled: false,
    twitchUsername: '',
    gracePeriodMinutes: 15,
    logBypassed: true,
  },
  toastDurationSeconds: 15,
  whitelistedChannels: [],
  theme: 'auto',
  weeklyResetDay: 'monday',
  intensityLocked: false,
};

/** Transient spending data — stored in chrome.storage.local */
export interface SpendingTracker {
  lastProceedTimestamp: number | null;
  dailyTotal: number;
  dailyDate: string;
  weeklyTotal: number;
  weeklyStartDate: string;   // ISO date of the day that starts the current week (Monday or Sunday, YYYY-MM-DD)
  monthlyTotal: number;
  monthlyMonth: string;      // YYYY-MM format
}

export const DEFAULT_SPENDING_TRACKER: SpendingTracker = {
  lastProceedTimestamp: null,
  dailyTotal: 0,
  dailyDate: '',
  weeklyTotal: 0,
  weeklyStartDate: '',
  monthlyTotal: 0,
  monthlyMonth: '',
};

/** A single structured intercept event — stored in chrome.storage.local */
export interface InterceptEvent {
  id: string;               // Date.now().toString() + Math.random().toString(36).slice(2)
  timestamp: number;        // unix ms
  channel: string;
  purchaseType: string;
  rawPrice: string | null;
  priceWithTax: number | null;
  outcome: 'cancelled' | 'proceeded';
  cancelledAtStep?: number; // which step the user cancelled at (1 = main modal, 2+ = subsequent)
  savedAmount?: number;     // set on cancelled entries = priceWithTax (or 0 if no price)
  purchaseReason?: string;  // set when reason-selection step is completed
}

/** Merge saved settings with defaults to handle upgrades */
export function migrateSettings(saved: Partial<UserSettings>): UserSettings {
  // Merge comparison items: if user has saved items, use those; otherwise use presets
  // Also ensure any new presets are added if missing
  let items = saved.comparisonItems;
  if (!items || items.length === 0) {
    items = PRESET_COMPARISON_ITEMS;
  } else {
    // Ensure all current presets exist (in case we add new ones)
    for (const preset of PRESET_COMPARISON_ITEMS) {
      if (!items.find(i => i.id === preset.id)) {
        items.push(preset);
      }
    }
  }

  // Remove retired presets from saved data
  items = items.filter(i => i.id !== 'preset-work-minutes');

  // Deduplicate by ID (first occurrence wins)
  const seen = new Set<string>();
  items = items.filter(i => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });

  // Backfill frictionScope for items saved before this field existed
  items = items.map(i => ({
    ...i,
    frictionScope: i.frictionScope ?? 'both',
  }));

  return sanitizeSettings({
    hourlyRate: saved.hourlyRate ?? DEFAULT_SETTINGS.hourlyRate,
    taxRate: saved.taxRate ?? DEFAULT_SETTINGS.taxRate,
    comparisonItems: items,
    cooldown: {
      ...DEFAULT_SETTINGS.cooldown,
      ...(saved.cooldown || {}),
    },
    dailyCap: {
      ...DEFAULT_SETTINGS.dailyCap,
      ...(saved.dailyCap || {}),
    },
    weeklyCap: {
      ...DEFAULT_SETTINGS.weeklyCap,
      ...(saved.weeklyCap || {}),
    },
    monthlyCap: {
      ...DEFAULT_SETTINGS.monthlyCap,
      ...(saved.monthlyCap || {}),
    },
    frictionThresholds: (() => {
      const s = (saved.frictionThresholds || {}) as any;
      return {
        enabled: s.enabled ?? DEFAULT_SETTINGS.frictionThresholds.enabled,
        // Migrate old threshold1/threshold2 keys to new names
        thresholdFloor: s.thresholdFloor ?? s.threshold1 ?? DEFAULT_SETTINGS.frictionThresholds.thresholdFloor,
        thresholdCeiling: s.thresholdCeiling ?? s.threshold2 ?? DEFAULT_SETTINGS.frictionThresholds.thresholdCeiling,
        softNudgeSteps: s.softNudgeSteps ?? DEFAULT_SETTINGS.frictionThresholds.softNudgeSteps,
      };
    })(),
    frictionIntensity: saved.frictionIntensity ?? DEFAULT_SETTINGS.frictionIntensity,
    delayTimer: {
      ...DEFAULT_SETTINGS.delayTimer,
      ...(saved.delayTimer || {}),
    },
    streamingMode: {
      ...DEFAULT_SETTINGS.streamingMode,
      ...(saved.streamingMode || {}),
    },
    toastDurationSeconds: saved.toastDurationSeconds ?? DEFAULT_SETTINGS.toastDurationSeconds,
    whitelistedChannels: (saved.whitelistedChannels ?? DEFAULT_SETTINGS.whitelistedChannels).map(e => ({
      ...e,
      behavior: (e.behavior as string) === 'track-only' ? 'full' as WhitelistBehavior : e.behavior,
    })),
    theme: saved.theme ?? DEFAULT_SETTINGS.theme,
    weeklyResetDay: saved.weeklyResetDay ?? DEFAULT_SETTINGS.weeklyResetDay,
    intensityLocked: saved.intensityLocked ?? DEFAULT_SETTINGS.intensityLocked,
  });
}

/** Storage keys for onboarding state — all stored in chrome.storage.local */
export const ONBOARDING_KEYS = {
  wizardPending: 'hcOnboardingWizardPending',
  phase2Pending: 'hcOnboardingPhase2Pending',
  complete: 'hcOnboardingComplete',
} as const;

// ─── Input Sanitizers ────────────────────────────────────────────────────────

/** Clamp a number to [min, max], replacing NaN/Infinity with fallback */
function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  const n = typeof val === 'number' ? val : fallback;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** Round to 2 decimal places (currency) */
function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

/** Force a value to strict boolean (=== true) */
function strictBool(val: unknown, fallback: boolean = false): boolean {
  return val === true ? true : fallback;
}

/** Validate a value is one of the allowed options */
function validEnum<T>(val: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(val as T) ? (val as T) : fallback;
}

/** Strip HTML tags from a string */
function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

/** Sanitize a single comparison item. Returns null if the item is invalid and should be removed. */
function sanitizeComparisonItem(item: ComparisonItem): ComparisonItem | null {
  if (typeof item.id !== 'string' || item.id.trim() === '') return null;

  const name = stripHtml((typeof item.name === 'string' ? item.name : '').trim()).slice(0, 50);
  if (name === '') return null;

  const price = round2(clampNum(item.price, 0.01, 100000, 0));
  if (price <= 0) return null;

  const pluralLabel = stripHtml((typeof item.pluralLabel === 'string' ? item.pluralLabel : '').trim()).slice(0, 50);

  const emojiStr = typeof item.emoji === 'string' ? item.emoji : '';
  const emoji = [...emojiStr].slice(0, 2).join('');

  return {
    id: item.id,
    emoji,
    name,
    price,
    pluralLabel: pluralLabel || name,
    enabled: strictBool(item.enabled),
    isPreset: strictBool(item.isPreset),
    frictionScope: validEnum(item.frictionScope, ['nudge', 'full', 'both'] as const, 'both'),
  };
}

/** Sanitize a UserSettings object — clamps numerics, validates enums/booleans, filters arrays */
export function sanitizeSettings(s: UserSettings): UserSettings {
  const hourlyRate = round2(clampNum(s.hourlyRate, 0.01, 1000, DEFAULT_SETTINGS.hourlyRate));
  const taxRate = round2(clampNum(s.taxRate, 0, 25, DEFAULT_SETTINGS.taxRate));

  let thresholdFloor = round2(clampNum(s.frictionThresholds.thresholdFloor, 0, 999.99, DEFAULT_SETTINGS.frictionThresholds.thresholdFloor));
  let thresholdCeiling = round2(clampNum(s.frictionThresholds.thresholdCeiling, 0.01, 1000, DEFAULT_SETTINGS.frictionThresholds.thresholdCeiling));
  if (thresholdCeiling <= thresholdFloor) {
    thresholdCeiling = round2(thresholdFloor + 0.01);
  }

  const dailyCapAmount = round2(clampNum(s.dailyCap.amount, 0, 100000, DEFAULT_SETTINGS.dailyCap.amount));
  const weeklyCapAmount = round2(clampNum(s.weeklyCap.amount, 0, 100000, DEFAULT_SETTINGS.weeklyCap.amount));
  const monthlyCapAmount = round2(clampNum(s.monthlyCap.amount, 0, 100000, DEFAULT_SETTINGS.monthlyCap.amount));

  const cooldownMinutes = clampNum(s.cooldown.minutes, 0, 1440, DEFAULT_SETTINGS.cooldown.minutes);
  const gracePeriodMinutes = clampNum(s.streamingMode.gracePeriodMinutes, 0, 60, DEFAULT_SETTINGS.streamingMode.gracePeriodMinutes);
  const toastDurationSeconds = clampNum(s.toastDurationSeconds, 1, 30, DEFAULT_SETTINGS.toastDurationSeconds);
  const softNudgeSteps = clampNum(s.frictionThresholds.softNudgeSteps, 1, 10, DEFAULT_SETTINGS.frictionThresholds.softNudgeSteps);

  const frictionIntensity = validEnum(s.frictionIntensity, ['low', 'medium', 'high', 'extreme'] as const, DEFAULT_SETTINGS.frictionIntensity);
  const delaySeconds = validEnum(s.delayTimer.seconds, [5, 10, 30, 60] as const, DEFAULT_SETTINGS.delayTimer.seconds);
  const theme = validEnum(s.theme, ['auto', 'light', 'dark'] as const, DEFAULT_SETTINGS.theme);
  const weeklyResetDay = validEnum(s.weeklyResetDay, ['monday', 'sunday'] as const, DEFAULT_SETTINGS.weeklyResetDay);

  // Defensive array normalization for corrupted/partial storage
  const rawItems = Array.isArray(s.comparisonItems) ? s.comparisonItems : [];
  const rawChannels = Array.isArray(s.whitelistedChannels) ? s.whitelistedChannels : [];

  const seenIds = new Set<string>();
  const comparisonItems = rawItems
    .map(item => sanitizeComparisonItem(item))
    .filter((item): item is ComparisonItem => {
      if (item === null) return false;
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });

  const whitelistedChannels = rawChannels
    .filter(e => /^[a-z0-9_]{1,25}$/.test(e.username))
    .map(e => ({
      username: e.username,
      behavior: validEnum(e.behavior, ['skip', 'reduced', 'full'] as const, 'full' as WhitelistBehavior),
    }));

  const twitchUsername = /^[a-z0-9_]{0,25}$/.test(s.streamingMode.twitchUsername)
    ? s.streamingMode.twitchUsername
    : '';

  const streamingOverride = s.streamingOverride
    && typeof s.streamingOverride.expiresAt === 'number'
    && Number.isFinite(s.streamingOverride.expiresAt)
    && s.streamingOverride.expiresAt > 0
    ? { expiresAt: s.streamingOverride.expiresAt }
    : undefined;

  const result: UserSettings = {
    hourlyRate,
    taxRate,
    comparisonItems,
    cooldown: {
      enabled: strictBool(s.cooldown.enabled),
      minutes: cooldownMinutes,
    },
    dailyCap: {
      enabled: strictBool(s.dailyCap.enabled),
      amount: dailyCapAmount,
    },
    weeklyCap: {
      enabled: strictBool(s.weeklyCap.enabled),
      amount: weeklyCapAmount,
    },
    monthlyCap: {
      enabled: strictBool(s.monthlyCap.enabled),
      amount: monthlyCapAmount,
    },
    frictionThresholds: {
      enabled: strictBool(s.frictionThresholds.enabled),
      thresholdFloor,
      thresholdCeiling,
      softNudgeSteps,
    },
    frictionIntensity,
    delayTimer: {
      enabled: strictBool(s.delayTimer.enabled),
      seconds: delaySeconds,
    },
    streamingMode: {
      enabled: strictBool(s.streamingMode.enabled),
      twitchUsername,
      gracePeriodMinutes,
      logBypassed: strictBool(s.streamingMode.logBypassed, true),
    },
    toastDurationSeconds,
    whitelistedChannels,
    theme,
    weeklyResetDay,
    intensityLocked: strictBool(s.intensityLocked),
  };

  if (streamingOverride) {
    result.streamingOverride = streamingOverride;
  }

  return result;
}

/** Sanitize a SpendingTracker object — clamps totals, validates dates and timestamps */
export function sanitizeTracker(t: SpendingTracker): SpendingTracker {
  const sanitizeTotal = (val: unknown): number => {
    const n = typeof val === 'number' ? val : 0;
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 100) / 100;
  };

  const validDate = (val: unknown, pattern: RegExp): string => {
    if (typeof val !== 'string') return '';
    return pattern.test(val) ? val : '';
  };

  let lastProceedTimestamp: number | null = null;
  if (typeof t.lastProceedTimestamp === 'number'
    && Number.isFinite(t.lastProceedTimestamp)
    && t.lastProceedTimestamp > 0) {
    lastProceedTimestamp = t.lastProceedTimestamp;
  }

  return {
    lastProceedTimestamp,
    dailyTotal: sanitizeTotal(t.dailyTotal),
    dailyDate: validDate(t.dailyDate, /^\d{4}-\d{2}-\d{2}$/),
    weeklyTotal: sanitizeTotal(t.weeklyTotal),
    weeklyStartDate: validDate(t.weeklyStartDate, /^\d{4}-\d{2}-\d{2}$/),
    monthlyTotal: sanitizeTotal(t.monthlyTotal),
    monthlyMonth: validDate(t.monthlyMonth, /^\d{4}-\d{2}$/),
  };
}
