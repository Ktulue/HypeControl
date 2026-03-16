import { migrateSettings, DEFAULT_SETTINGS, UserSettings } from '../../src/shared/types';

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
