import { computeTotalSteps } from '../../src/shared/frictionStepCount';

describe('computeTotalSteps', () => {
  test('low intensity, no price, no delay timer → 1 (main only)', () => {
    expect(computeTotalSteps(null, 0, 'low', false)).toBe(1);
  });

  test('low intensity, with price, 3 comparisons, no delay timer → 4', () => {
    expect(computeTotalSteps(5.99, 3, 'low', false)).toBe(4);
  });

  test('low intensity, no price, with delay timer → 2 (main + delay)', () => {
    expect(computeTotalSteps(null, 0, 'low', true)).toBe(2);
  });

  test('medium intensity, no price, no delay timer → 2 (main + reason)', () => {
    expect(computeTotalSteps(null, 0, 'medium', false)).toBe(2);
  });

  test('medium intensity, with price, 1 comparison, no delay timer → 3', () => {
    expect(computeTotalSteps(5.99, 1, 'medium', false)).toBe(3);
  });

  test('high intensity, no price, no delay timer → 4 (main + reason + cooldown + type)', () => {
    expect(computeTotalSteps(null, 0, 'high', false)).toBe(4);
  });

  test('high intensity, with price, 2 comparisons, with delay timer → 7', () => {
    // 1 main + 2 comparisons + 3 intensity (reason + cooldown + type) + 1 delay = 7
    expect(computeTotalSteps(5.99, 2, 'high', true)).toBe(7);
  });

  test('extreme intensity, with price, 3 comparisons, with delay timer → 9', () => {
    // 1 main + 3 comparisons + 1 reason + 1 cooldown + 1 math + 1 type + 1 delay = 9
    expect(computeTotalSteps(5.99, 3, 'extreme', true)).toBe(9);
  });

  test('extreme intensity, no price, no delay timer → 5 (main + reason + cooldown + math + type)', () => {
    expect(computeTotalSteps(null, 0, 'extreme', false)).toBe(5);
  });

  test('comparison count is ignored when price is null', () => {
    // Even with 5 items configured, no price means no comparison steps.
    expect(computeTotalSteps(null, 5, 'low', false)).toBe(1);
  });
});
