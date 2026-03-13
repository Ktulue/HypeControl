import { UserSettings, WhitelistBehavior, WhitelistEntry } from '../../shared/types';
import { getPending, setPendingField } from '../pendingState';

const RESERVED_TWITCH_PATHS = new Set([
  'directory', 'search', 'following', 'subscriptions', 'wallet',
  'settings', 'downloads', 'jobs', 'p', 'products', 'videos',
  'clips', 'schedule', 'about', 'moderator', 'login', 'signup',
  'friends', 'inbox', 'drops', 'prime',
]);

/**
 * Extracts a Twitch channel slug from a URL string.
 * Returns null if the URL is not a Twitch channel page.
 * Exported for unit testing.
 */
export function extractTwitchSlug(url: string): string | null {
  try {
    const parsed = new URL(url);
    const h = parsed.hostname;
    // Must be exactly twitch.tv or a subdomain (.twitch.tv)
    // NOT just .endsWith('twitch.tv') — that incorrectly matches notwitch.tv
    if (h !== 'twitch.tv' && !h.endsWith('.twitch.tv')) return null;
    const slug = parsed.pathname.split('/')[1]?.toLowerCase();
    if (!slug || RESERVED_TWITCH_PATHS.has(slug)) return null;
    return slug;
  } catch {
    return null;
  }
}

export interface ChannelsController {
  render(settings: UserSettings): void;
}

export function initChannels(el: HTMLElement): ChannelsController {
  const streamingEnabledEl = el.querySelector<HTMLInputElement>('#streaming-mode-enabled')!;
  const streamingDetailsEl = el.querySelector<HTMLElement>('#streaming-mode-details')!;
  const usernameEl = el.querySelector<HTMLInputElement>('#streaming-username')!;
  const graceEl = el.querySelector<HTMLInputElement>('#streaming-grace')!;
  const logBypassedEl = el.querySelector<HTMLInputElement>('#streaming-log-bypassed')!;
  const whitelistInputEl = el.querySelector<HTMLInputElement>('#whitelist-username-input')!;
  const addChannelBtnEl = el.querySelector<HTMLButtonElement>('#btn-add-channel')!;
  const whitelistListEl = el.querySelector<HTMLUListElement>('#whitelist-list')!;

  // Auto-detect current Twitch channel from active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length) return;
    const slug = extractTwitchSlug(tabs[0]?.url ?? '');
    if (slug) whitelistInputEl.value = slug;
  });

  function updateStreaming(): void {
    setPendingField('streamingMode', {
      enabled: streamingEnabledEl.checked,
      twitchUsername: usernameEl.value.trim(),
      gracePeriodMinutes: parseInt(graceEl.value, 10) || 0,
      logBypassed: logBypassedEl.checked,
    });
  }

  streamingEnabledEl.addEventListener('change', () => {
    streamingDetailsEl.hidden = !streamingEnabledEl.checked;
    updateStreaming();
  });
  usernameEl.addEventListener('input', updateStreaming);
  graceEl.addEventListener('input', updateStreaming);
  logBypassedEl.addEventListener('change', updateStreaming);

  function normalizeUsername(raw: string): string {
    return raw.trim().toLowerCase().replace(/^https?:\/\/(?:www\.)?twitch\.tv\//i, '');
  }

  function renderWhitelist(entries: WhitelistEntry[]): void {
    whitelistListEl.innerHTML = '';
    entries.forEach((entry, idx) => {
      const li = document.createElement('li');
      li.className = 'whitelist-row';

      // textContent is safe — no innerHTML for user data
      const nameSpan = document.createElement('span');
      nameSpan.className = 'whitelist-name';
      nameSpan.textContent = entry.username;

      const behaviorSelect = document.createElement('select');
      behaviorSelect.className = 'hc-select';
      (['skip', 'reduced', 'full'] as WhitelistBehavior[]).forEach(val => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = val.charAt(0).toUpperCase() + val.slice(1);
        opt.selected = entry.behavior === val;
        behaviorSelect.appendChild(opt);
      });
      behaviorSelect.addEventListener('change', () => {
        const behavior = behaviorSelect.value as WhitelistBehavior;
        const updated = getPending().whitelistedChannels.map((ch, i) =>
          i === idx ? { ...ch, behavior } : ch
        );
        setPendingField('whitelistedChannels', updated);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-icon';
      deleteBtn.title = 'Remove';
      deleteBtn.textContent = '×';
      deleteBtn.addEventListener('click', () => {
        const updated = getPending().whitelistedChannels.filter((_, i) => i !== idx);
        setPendingField('whitelistedChannels', updated);
        renderWhitelist(updated);
      });

      li.appendChild(nameSpan);
      li.appendChild(behaviorSelect);
      li.appendChild(deleteBtn);
      whitelistListEl.appendChild(li);
    });
  }

  addChannelBtnEl.addEventListener('click', () => {
    const raw = whitelistInputEl.value;
    const username = normalizeUsername(raw);
    if (!username) return;
    const exists = getPending().whitelistedChannels.some(ch => ch.username === username);
    if (exists) return;
    const updated: WhitelistEntry[] = [...getPending().whitelistedChannels, { username, behavior: 'full' }];
    setPendingField('whitelistedChannels', updated);
    whitelistInputEl.value = '';
    renderWhitelist(updated);
  });

  whitelistInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addChannelBtnEl.click();
  });

  function render(settings: UserSettings): void {
    streamingEnabledEl.checked = settings.streamingMode.enabled;
    streamingDetailsEl.hidden = !settings.streamingMode.enabled;
    usernameEl.value = settings.streamingMode.twitchUsername;
    graceEl.value = String(settings.streamingMode.gracePeriodMinutes);
    logBypassedEl.checked = settings.streamingMode.logBypassed;
    renderWhitelist(settings.whitelistedChannels);
  }

  return { render };
}
