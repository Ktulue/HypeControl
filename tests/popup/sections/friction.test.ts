// tests/popup/sections/friction.test.ts
import { DEFAULT_SETTINGS, UserSettings } from '../../../src/shared/types';

function settingsWithItems(count: number): UserSettings {
  const items = Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    name: `Item ${i}`,
    price: 10,
    pluralLabel: `items ${i}`,
    emoji: '🛒',
    enabled: true,
    isPreset: false,
    frictionScope: 'both' as const,
  }));
  return { ...DEFAULT_SETTINGS, comparisonItems: items };
}

// This function mirrors the clamping logic used in friction.ts updateThresholds().
// If you change the implementation in friction.ts, update this function to match.
function clampNudgeSteps(rawValue: number, itemCount: number): number {
  return Math.min(rawValue || 1, itemCount || 1);
}

describe('nudge steps clamping algorithm', () => {
  test('returns the value unchanged when within range', () => {
    expect(clampNudgeSteps(3, 5)).toBe(3);
  });

  test('clamps to item count when steps exceed it', () => {
    expect(clampNudgeSteps(15, 5)).toBe(5);
  });

  test('returns 1 when item count is 0 (empty list)', () => {
    expect(clampNudgeSteps(5, 0)).toBe(1);
  });

  test('returns 1 when raw value is 0 or NaN', () => {
    expect(clampNudgeSteps(0, 5)).toBe(1);
    expect(clampNudgeSteps(NaN, 5)).toBe(1);
  });

  test('exactly at boundary is not clamped', () => {
    expect(clampNudgeSteps(5, 5)).toBe(5);
  });

  test('settingsWithItems helper produces correct count', () => {
    expect(settingsWithItems(4).comparisonItems).toHaveLength(4);
  });
});
