/** Default (web) — Metro swaps in `.native` on iOS/Android. */

export function configureNativeGoogleSignIn(): void {
  // no-op on web
}

export async function signInWithNativeGoogle(): Promise<string> {
  throw new Error('Native Google Sign-In is not available on web');
}
