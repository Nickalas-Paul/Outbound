import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const WELCOME_SEEN_KEY = 'outbound_welcome_seen';

async function getItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') return null;
      return localStorage.getItem(key);
    }
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  } catch {
    // Private browsing / unavailable storage — show again next time.
  }
}

export async function hasSeenWelcome(): Promise<boolean> {
  const value = await getItem(WELCOME_SEEN_KEY);
  return value === 'true';
}

export async function markWelcomeSeen(): Promise<void> {
  await setItem(WELCOME_SEEN_KEY, 'true');
}
