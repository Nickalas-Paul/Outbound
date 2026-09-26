/** Web uses the API OAuth redirect flow — native Google SDK is not loaded. */

export function configureNativeGoogleSignIn(): void {
  // no-op on web
}

export async function signInWithNativeGoogle(): Promise<string> {
  throw new Error('Native Google Sign-In is not available on web');
}
