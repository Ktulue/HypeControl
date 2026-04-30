import { getCapColorClass, buildCapProgressBar } from '../../src/shared/capBar';

describe('getCapColorClass', () => {
  test('returns hc-cap-green when percentage is 0', () => {
    expect(getCapColorClass(0)).toBe('hc-cap-green');
  });

  test('returns hc-cap-green when percentage is 59', () => {
    expect(getCapColorClass(59)).toBe('hc-cap-green');
  });

  test('returns hc-cap-yellow at exactly 60', () => {
    expect(getCapColorClass(60)).toBe('hc-cap-yellow');
  });

  test('returns hc-cap-yellow when percentage is 79', () => {
    expect(getCapColorClass(79)).toBe('hc-cap-yellow');
  });

  test('returns hc-cap-orange at exactly 80', () => {
    expect(getCapColorClass(80)).toBe('hc-cap-orange');
  });

  test('returns hc-cap-orange when percentage is 99', () => {
    expect(getCapColorClass(99)).toBe('hc-cap-orange');
  });

  test('returns hc-cap-red at exactly 100', () => {
    expect(getCapColorClass(100)).toBe('hc-cap-red');
  });

  test('returns hc-cap-red when percentage exceeds 100', () => {
    expect(getCapColorClass(150)).toBe('hc-cap-red');
  });
});

describe('buildCapProgressBar', () => {
  test('returns empty string when capAmount is 0', () => {
    expect(buildCapProgressBar('Daily', 10, 0, 0)).toBe('');
  });

  test('returns empty string when capAmount is negative', () => {
    expect(buildCapProgressBar('Daily', 10, 0, -5)).toBe('');
  });

  test('renders a bar with 0% green when current and delta are 0', () => {
    const html = buildCapProgressBar('Daily', 0, 0, 100);
    expect(html).toContain('hc-cap-green');
    expect(html).toContain('Daily');
    expect(html).toContain('$0.00 / $100.00');
    expect(html).toContain('(0%)');
    expect(html).toContain('width: 0%');
  });

  test('renders 50% green bar when current is 50 of 100', () => {
    const html = buildCapProgressBar('Daily', 50, 0, 100);
    expect(html).toContain('hc-cap-green');
    expect(html).toContain('$50.00 / $100.00');
    expect(html).toContain('(50%)');
    expect(html).toContain('width: 50%');
  });

  test('renders 60% yellow bar at the green/yellow boundary', () => {
    const html = buildCapProgressBar('Weekly', 60, 0, 100);
    expect(html).toContain('hc-cap-yellow');
    expect(html).toContain('Weekly');
    expect(html).toContain('(60%)');
  });

  test('renders 85% orange bar', () => {
    const html = buildCapProgressBar('Monthly', 85, 0, 100);
    expect(html).toContain('hc-cap-orange');
    expect(html).toContain('Monthly');
    expect(html).toContain('(85%)');
  });

  test('renders 100% red bar at exactly the cap amount, with no OVER BUDGET label', () => {
    // Boundary: newTotal == capAmount is treated as 100% (red), not over-budget.
    const html = buildCapProgressBar('Daily', 100, 0, 100);
    expect(html).toContain('hc-cap-red');
    expect(html).toContain('(100%)');
    expect(html).not.toContain('OVER BUDGET');
  });

  test('renders OVER BUDGET when newTotal exceeds capAmount', () => {
    const html = buildCapProgressBar('Daily', 120, 0, 100);
    expect(html).toContain('hc-cap-red');
    expect(html).toContain('$120.00 / $100.00');
    expect(html).toContain('OVER BUDGET');
    expect(html).not.toContain('(120%)');
  });

  test('caps fill width at 100% when over budget', () => {
    const html = buildCapProgressBar('Daily', 200, 0, 100);
    expect(html).toContain('width: 100%');
    expect(html).not.toContain('width: 200%');
  });

  test('adds purchaseAmount to currentTotal for the bar value', () => {
    // Friction-overlay use case: current $40, in-flight $20, cap $100 → 60% yellow
    const html = buildCapProgressBar('Daily', 40, 20, 100);
    expect(html).toContain('hc-cap-yellow');
    expect(html).toContain('$60.00 / $100.00');
    expect(html).toContain('(60%)');
  });

  test('rounds the displayed total to 2 decimals', () => {
    const html = buildCapProgressBar('Daily', 10.005, 0, 100);
    // Math.round((10.005 + 0) * 100) / 100 = 10.01
    expect(html).toContain('$10.01');
  });

  test('emits all four required structural classes', () => {
    const html = buildCapProgressBar('Daily', 50, 0, 100);
    expect(html).toContain('class="hc-cap-bar hc-cap-green"');
    expect(html).toContain('class="hc-cap-bar__header"');
    expect(html).toContain('class="hc-cap-bar__label"');
    expect(html).toContain('class="hc-cap-bar__value"');
    expect(html).toContain('class="hc-cap-bar__track"');
    expect(html).toContain('class="hc-cap-bar__fill"');
  });
});
