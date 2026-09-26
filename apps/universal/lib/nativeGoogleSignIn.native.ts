import { GoogleSignin } from '@react-native-google-signin/google-signin';

const WEB_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '').trim();

export function configureNativeGoogleSignIn(): void {
  if (!WEB_CLIENT_ID) return;
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
}

export async function signInWithNativeGoogle(): Promise<string> {
  if (!WEB_CLIENT_ID) {
    throw new Error('Google Sign-In is not configured on this build');
  }

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (response.type === 'cancelled') {
    throw new Error('cancelled');
  }
  if (response.type !== 'success' || !response.data.idToken) {
    throw new Error('Google Sign-In did not return an ID token');
  }
  return response.data.idToken;
}
