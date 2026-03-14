import { ONBOARDING_KEYS } from '../shared/types';

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({
      [ONBOARDING_KEYS.wizardPending]: true,
      [ONBOARDING_KEYS.phase2Pending]: true,
      [ONBOARDING_KEYS.complete]: false,
    });
  }
});
