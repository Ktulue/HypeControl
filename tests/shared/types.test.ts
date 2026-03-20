import { migrateSettings, DEFAULT_SETTINGS, UserSettings, sanitizeTracker, DEFAULT_SPENDING_TRACKER, SpendingTracker } from '../../src/shared/types';

describe('migrateSettings', () => {
  test('adds weeklyResetDay with default monday for existing users', () => {
    const saved: Partial<UserSettings> = { hourlyRate: 25 };
    const result = migrateSettings(saved);
    expect(result.weeklyResetDay).toBe('monday');
  });

  test('preserves existing weeklyResetDay value', () => {
    const saved: Partial<UserSettings> = { weeklyResetDay: 'sunday' } as any;
    const result = migrateSettings(saved);
    expect(result.weeklyResetDay).toBe('sunday');
  });

  test('adds intensityLocked with default false for existing users', () => {
    const saved: Partial<UserSettings> = { hourlyRate: 25 };
    const result = migrateSettings(saved);
    expect(result.intensityLocked).toBe(false);
  });

  test('preserves existing intensityLocked value', () => {
    const saved: Partial<UserSettings> = { intensityLocked: true } as any;
    const result = migrateSettings(saved);
    expect(result.intensityLocked).toBe(true);
  });

  test('DEFAULT_SETTINGS has frictionIntensity set to low', () => {
    expect(DEFAULT_SETTINGS.frictionIntensity).toBe('low');
  });

  test('does not overwrite existing frictionIntensity on migration', () => {
    const saved: Partial<UserSettings> = { frictionIntensity: 'high' };
    const result = migrateSettings(saved);
    expect(result.frictionIntensity).toBe('high');
  });
});

describe('sanitizeTracker', () => {
  test('returns valid tracker with correct defaults', () => {
    const result = sanitizeTracker({ ...DEFAULT_SPENDING_TRACKER });
    expect(result.dailyTotal).toBe(0);
    expect(result.weeklyTotal).toBe(0);
    expect(result.monthlyTotal).toBe(0);
    expect(result.lastProceedTimestamp).toBeNull();
    expect(result).not.toHaveProperty('sessionTotal');
    expect(result).not.toHaveProperty('sessionChannel');
  });

  test('strips legacy sessionTotal/sessionChannel from old storage', () => {
    const oldData = {
      ...DEFAULT_SPENDING_TRACKER,
      sessionTotal: 42.50,
      sessionChannel: 'xqc',
    } as any;
    const result = sanitizeTracker(oldData);
    expect(result).not.toHaveProperty('sessionTotal');
    expect(result).not.toHaveProperty('sessionChannel');
  });

  test('clamps negative totals to 0', () => {
    const bad = { ...DEFAULT_SPENDING_TRACKER, dailyTotal: -5 } as any;
    expect(sanitizeTracker(bad).dailyTotal).toBe(0);
  });

  test('rounds totals to 2 decimal places', () => {
    const t = { ...DEFAULT_SPENDING_TRACKER, dailyTotal: 1.999 } as any;
    expect(sanitizeTracker(t).dailyTotal).toBe(2.00);
  });
});
