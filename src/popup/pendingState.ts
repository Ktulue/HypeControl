import type { UserSettings } from '../shared/types';

let pending: UserSettings | null = null;

export function initPending(settings: UserSettings): void {
  pending = structuredClone(settings);
}

export function getPending(): UserSettings {
  if (!pending) throw new Error('pendingState not initialized');
  return pending;
}

export function setPendingField<K extends keyof UserSettings>(
  key: K,
  value: UserSettings[K]
): void {
  if (!pending) throw new Error('pendingState not initialized');
  pending = { ...pending, [key]: value };
}

export function resetPending(settings: UserSettings): void {
  initPending(settings);
}

export function isDirty(original: UserSettings): boolean {
  if (!pending) throw new Error('pendingState not initialized');
  return JSON.stringify(pending) !== JSON.stringify(original);
}
