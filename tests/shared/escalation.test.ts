import { computeEscalatedIntensity, computeMaxCapPercent } from '../../src/shared/escalation';
import { DEFAULT_SETTINGS, DEFAULT_SPENDING_TRACKER } from '../../src/shared/types';

describe('computeMaxCapPercent', () => {
  const baseSettings = { ...DEFAULT_SETTINGS };
  const baseTracker = { ...DEFAULT_SPENDING_TRACKER };

  test('returns 0 when no caps are enabled', () => {
    expect(computeMaxCapPercent(baseSettings, baseTracker)).toBe(0);
  });

  test('returns daily cap percentage when only daily cap enabled', () => {
    const settings = { ...baseSettings, dailyCap: { enabled: true, amount: 100 } };
    const tracker = { ...baseTracker, dailyTotal: 60 };
    expect(computeMaxCapPercent(settings, tracker)).toBe(60);
  });

  test('returns highest percentage across multiple caps', () => {
    const settings = {
      ...baseSettings,
      dailyCap: { enabled: true, amount: 100 },
      weeklyCap: { enabled: true, amount: 200 },
      monthlyCap: { enabled: true, amount: 1000 },
    };
    const tracker = { ...baseTracker, dailyTotal: 30, weeklyTotal: 180, monthlyTotal: 100 };
    expect(computeMaxCapPercent(settings, tracker)).toBe(90);
  });

  test('returns percentage above 100 when cap exceeded', () => {
    const settings = { ...baseSettings, dailyCap: { enabled: true, amount: 50 } };
    const tracker = { ...baseTracker, dailyTotal: 75 };
    expect(computeMaxCapPercent(settings, tracker)).toBe(150);
  });

  test('ignores disabled caps', () => {
    const settings = {
      ...baseSettings,
      dailyCap: { enabled: false, amount: 10 },
      weeklyCap: { enabled: true, amount: 200 },
    };
    const tracker = { ...baseTracker, dailyTotal: 100, weeklyTotal: 50 };
    expect(computeMaxCapPercent(settings, tracker)).toBe(25);
  });
});

describe('computeEscalatedIntensity', () => {
  test('returns base intensity when no caps enabled (maxPercent=0)', () => {
    expect(computeEscalatedIntensity('low', 0, false)).toBe('low');
  });

  test('returns base intensity when under 60%', () => {
    expect(computeEscalatedIntensity('low', 59, false)).toBe('low');
  });

  test('escalates to medium at 60%', () => {
    expect(computeEscalatedIntensity('low', 60, false)).toBe('medium');
  });

  test('escalates to high at 80%', () => {
    expect(computeEscalatedIntensity('low', 80, false)).toBe('high');
  });

  test('escalates to extreme at 100%', () => {
    expect(computeEscalatedIntensity('low', 100, false)).toBe('extreme');
  });

  test('escalates to extreme above 100%', () => {
    expect(computeEscalatedIntensity('low', 150, false)).toBe('extreme');
  });

  test('does not escalate below base intensity', () => {
    expect(computeEscalatedIntensity('high', 65, false)).toBe('high');
  });

  test('does not escalate when locked', () => {
    expect(computeEscalatedIntensity('low', 95, true)).toBe('low');
  });

  test('does not escalate when locked even at 100%+', () => {
    expect(computeEscalatedIntensity('low', 150, true)).toBe('low');
  });

  test('medium base at 80% escalates to high', () => {
    expect(computeEscalatedIntensity('medium', 80, false)).toBe('high');
  });

  test('medium base at 65% stays medium (already at that tier)', () => {
    expect(computeEscalatedIntensity('medium', 65, false)).toBe('medium');
  });
});
