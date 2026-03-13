import { extractTwitchSlug } from '../../../src/popup/sections/channels';

describe('extractTwitchSlug', () => {
  test('returns channel slug from standard twitch.tv URL', () => {
    expect(extractTwitchSlug('https://www.twitch.tv/somechannel')).toBe('somechannel');
  });

  test('returns channel slug from twitch.tv without www', () => {
    expect(extractTwitchSlug('https://twitch.tv/anotherchannel')).toBe('anotherchannel');
  });

  test('returns null for reserved path: directory', () => {
    expect(extractTwitchSlug('https://www.twitch.tv/directory')).toBeNull();
  });

  test('returns null for reserved path: search', () => {
    expect(extractTwitchSlug('https://www.twitch.tv/search')).toBeNull();
  });

  test('returns null for reserved path: clips', () => {
    expect(extractTwitchSlug('https://www.twitch.tv/clips/someclip')).toBeNull();
  });

  test('returns null for reserved path: settings', () => {
    expect(extractTwitchSlug('https://www.twitch.tv/settings/profile')).toBeNull();
  });

  test('returns null for non-twitch URL', () => {
    expect(extractTwitchSlug('https://www.youtube.com/watch?v=abc')).toBeNull();
  });

  test('returns null for lookalike domain (endsWith check would incorrectly match)', () => {
    // notwitch.tv ends with "twitch.tv" — implementation must use === or .endsWith('.twitch.tv')
    expect(extractTwitchSlug('https://notwitch.tv/channel')).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(extractTwitchSlug('')).toBeNull();
  });

  test('returns null for undefined/malformed URL', () => {
    expect(extractTwitchSlug('not-a-url')).toBeNull();
  });

  test('lowercases the slug', () => {
    expect(extractTwitchSlug('https://www.twitch.tv/SomeChannel')).toBe('somechannel');
  });

  test('returns null when only the root twitch.tv path', () => {
    expect(extractTwitchSlug('https://www.twitch.tv/')).toBeNull();
  });
});
