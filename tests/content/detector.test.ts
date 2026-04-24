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
});
