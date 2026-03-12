import { DEFAULT_SETTINGS } from '../../src/shared/types';

describe('pendingState', () => {
  let mod: typeof import('../../src/popup/pendingState');

  beforeEach(async () => {
    jest.resetModules();
    mod = await import('../../src/popup/pendingState');
  });

  test('getPending throws before initPending', () => {
    expect(() => mod.getPending()).toThrow('pendingState not initialized');
  });

  test('getPending returns a copy of initialized settings', () => {
    mod.initPending({ ...DEFAULT_SETTINGS });
    const p = mod.getPending();
    expect(p.frictionIntensity).toBe('medium');
  });

  test('setPendingField updates the pending copy', () => {
    mod.initPending({ ...DEFAULT_SETTINGS });
    mod.setPendingField('frictionIntensity', 'high');
    expect(mod.getPending().frictionIntensity).toBe('high');
  });

  test('setPendingField does not mutate the original object', () => {
    const original = { ...DEFAULT_SETTINGS };
    mod.initPending(original);
    mod.setPendingField('hourlyRate', 99);
    expect(original.hourlyRate).toBe(35);
  });

  test('resetPending restores to new base', () => {
    mod.initPending({ ...DEFAULT_SETTINGS });
    mod.setPendingField('frictionIntensity', 'extreme');
    mod.resetPending({ ...DEFAULT_SETTINGS });
    expect(mod.getPending().frictionIntensity).toBe('medium');
  });

  test('isDirty returns false when nothing changed', () => {
    const base = { ...DEFAULT_SETTINGS, comparisonItems: [...DEFAULT_SETTINGS.comparisonItems] };
    mod.initPending(base);
    expect(mod.isDirty(base)).toBe(false);
  });

  test('isDirty returns true after a field change', () => {
    const base = { ...DEFAULT_SETTINGS, comparisonItems: [...DEFAULT_SETTINGS.comparisonItems] };
    mod.initPending(base);
    mod.setPendingField('hourlyRate', 99);
    expect(mod.isDirty(base)).toBe(true);
  });
});
