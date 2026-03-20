import {
  formatLocalDate,
  getCurrentWeekStart,
  getCurrentMonth,
} from '../../src/shared/spendingTracker';

describe('formatLocalDate', () => {
  test('formats date as YYYY-MM-DD', () => {
    const d = new Date(2026, 2, 20); // March 20, 2026
    expect(formatLocalDate(d)).toBe('2026-03-20');
  });

  test('zero-pads single-digit month and day', () => {
    const d = new Date(2026, 0, 5); // Jan 5
    expect(formatLocalDate(d)).toBe('2026-01-05');
  });
});

describe('getCurrentWeekStart', () => {
  test('returns Monday for monday reset on a Wednesday', () => {
    const wed = new Date(2026, 2, 18); // Wed Mar 18
    expect(getCurrentWeekStart(wed, 'monday')).toBe('2026-03-16');
  });

  test('returns Sunday for sunday reset on a Wednesday', () => {
    const wed = new Date(2026, 2, 18); // Wed Mar 18
    expect(getCurrentWeekStart(wed, 'sunday')).toBe('2026-03-15');
  });

  test('returns same day when date IS the reset day (Monday)', () => {
    const mon = new Date(2026, 2, 16); // Mon Mar 16
    expect(getCurrentWeekStart(mon, 'monday')).toBe('2026-03-16');
  });

  test('returns same day when date IS the reset day (Sunday)', () => {
    const sun = new Date(2026, 2, 15); // Sun Mar 15
    expect(getCurrentWeekStart(sun, 'sunday')).toBe('2026-03-15');
  });
});

describe('getCurrentMonth', () => {
  test('returns YYYY-MM format', () => {
    const d = new Date(2026, 2, 20);
    expect(getCurrentMonth(d)).toBe('2026-03');
  });

  test('zero-pads single-digit month', () => {
    const d = new Date(2026, 0, 1);
    expect(getCurrentMonth(d)).toBe('2026-01');
  });
});
