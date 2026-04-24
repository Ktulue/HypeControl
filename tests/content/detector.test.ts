/**
 * @jest-environment jsdom
 */
import { isPurchaseButton } from '../../src/content/detector';

describe('isPurchaseButton — chat-callout exclusion (#44)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('does not intercept a click inside a chat-private-callout container even when descendant text would otherwise match a keyword', () => {
    // Reproduces the bug report: a Twitch re-sub callout container holds
    // action buttons whose labels or aggregated text match purchase keywords.
    // The callout itself is a chat-message widget — never a purchase surface.
    const container = document.createElement('div');
    container.setAttribute('data-a-target', 'chat-private-callout');

    const inner = document.createElement('button');
    inner.setAttribute('data-a-target', 'chat-private-callout__primary-button');
    const label = document.createElement('span');
    label.setAttribute('data-a-target', 'tw-core-button-label-text');
    label.textContent = 'Gift 1 sub back';
    inner.appendChild(label);

    container.appendChild(inner);
    document.body.appendChild(container);

    expect(isPurchaseButton(inner)).toBe(false);
  });

  test('does not intercept a nested DIV whose ancestor is a chat-private-callout container', () => {
    const container = document.createElement('div');
    container.setAttribute('data-a-target', 'chat-private-callout');

    const inner = document.createElement('div');
    inner.textContent = 'Gift 1 sub';

    container.appendChild(inner);
    document.body.appendChild(container);

    expect(isPurchaseButton(inner)).toBe(false);
  });

  test('does not intercept a button inside a community-highlight-stack ancestor', () => {
    const container = document.createElement('div');
    container.setAttribute('data-a-target', 'community-highlight-stack');

    const inner = document.createElement('button');
    const label = document.createElement('span');
    label.setAttribute('data-a-target', 'tw-core-button-label-text');
    label.textContent = 'Gift a sub';
    inner.appendChild(label);

    container.appendChild(inner);
    document.body.appendChild(container);

    expect(isPurchaseButton(inner)).toBe(false);
  });

  test('does not intercept an element whose ancestor data-a-target matches the -callout suffix rule (e.g. hype-train-callout)', () => {
    const container = document.createElement('div');
    container.setAttribute('data-a-target', 'hype-train-callout');

    const inner = document.createElement('button');
    const label = document.createElement('span');
    label.setAttribute('data-a-target', 'tw-core-button-label-text');
    label.textContent = 'Gift a sub';
    inner.appendChild(label);

    container.appendChild(inner);
    document.body.appendChild(container);

    expect(isPurchaseButton(inner)).toBe(false);
  });

  test('still intercepts a real purchase button whose ancestor has "callout" mid-string but does not end in -callout', () => {
    // Verifies the suffix-anchoring: "callout-confirm-purchase" must NOT match.
    const container = document.createElement('div');
    container.setAttribute('data-a-target', 'callout-confirm-purchase');

    const inner = document.createElement('button');
    inner.setAttribute('data-a-target', 'gift-sub-button');

    container.appendChild(inner);
    document.body.appendChild(container);

    expect(isPurchaseButton(inner)).toBe(true);
  });
});

describe('isPurchaseButton — baseline behavior', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('intercepts the top-nav Get Bits button', () => {
    const button = document.createElement('button');
    button.setAttribute('data-a-target', 'top-nav-get-bits-button');
    document.body.appendChild(button);
    expect(isPurchaseButton(button)).toBe(true);
  });

  test('ignores the Cheer button (bits-button / aria-label="Cheer")', () => {
    const button = document.createElement('button');
    button.setAttribute('data-a-target', 'bits-button');
    button.setAttribute('aria-label', 'Cheer');
    document.body.appendChild(button);
    expect(isPurchaseButton(button)).toBe(false);
  });

  test('intercepts a Bits purchase button in the popover (bits-purchase-button-100)', () => {
    const button = document.createElement('button');
    button.setAttribute('data-a-target', 'bits-purchase-button-100');
    document.body.appendChild(button);
    expect(isPurchaseButton(button)).toBe(true);
  });

  test('intercepts any data-a-target containing "gift" (e.g. gift-sub-button)', () => {
    const button = document.createElement('button');
    button.setAttribute('data-a-target', 'gift-sub-button');
    document.body.appendChild(button);
    expect(isPurchaseButton(button)).toBe(true);
  });

  test('intercepts a button whose label matches the "gift N sub(s)" regex', () => {
    const button = document.createElement('button');
    const label = document.createElement('span');
    label.setAttribute('data-a-target', 'tw-core-button-label-text');
    label.textContent = 'Gift 1 sub';
    button.appendChild(label);
    document.body.appendChild(button);
    expect(isPurchaseButton(button)).toBe(true);
  });

  test('ignores a button labeled "Gifted Subscriptions" (past-tense — issue #36 regression guard)', () => {
    const button = document.createElement('button');
    const label = document.createElement('span');
    label.setAttribute('data-a-target', 'tw-core-button-label-text');
    label.textContent = 'Gifted Subscriptions';
    button.appendChild(label);
    document.body.appendChild(button);
    expect(isPurchaseButton(button)).toBe(false);
  });

  test.each(['Cancel', 'Close', 'Dismiss'])('ignores the %s button via IGNORE_LABELS', (labelText) => {
    const button = document.createElement('button');
    const label = document.createElement('span');
    label.setAttribute('data-a-target', 'tw-core-button-label-text');
    label.textContent = labelText;
    button.appendChild(label);
    document.body.appendChild(button);
    expect(isPurchaseButton(button)).toBe(false);
  });

  test('intercepts a combo button via aria-label ("Send Hearts Combo, 5 Bits")', () => {
    const button = document.createElement('button');
    button.setAttribute('aria-label', 'Send Hearts Combo, 5 Bits');
    document.body.appendChild(button);
    expect(isPurchaseButton(button)).toBe(true);
  });

  test('intercepts a dollar-amount button inside a [role="dialog"] (gift-sub quantity picker)', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');

    const button = document.createElement('button');
    button.textContent = '$4.99';

    dialog.appendChild(button);
    document.body.appendChild(dialog);
    expect(isPurchaseButton(button)).toBe(true);
  });

  test('returns false for a null element', () => {
    expect(isPurchaseButton(null)).toBe(false);
  });
});
