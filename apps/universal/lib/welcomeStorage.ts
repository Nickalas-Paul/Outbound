const WELCOME_SEEN_KEY = 'outbound_welcome_seen';

export function hasSeenWelcome(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(WELCOME_SEEN_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markWelcomeSeen(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(WELCOME_SEEN_KEY, 'true');
  } catch {
    // Private browsing / unavailable storage — show again next time.
  }
}
