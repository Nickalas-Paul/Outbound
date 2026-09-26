import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import * as api from '@/services/api';
import { useAuth } from '@/services/auth';

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{
    code?: string | string[];
  }>();
  const { setSession, isAuthenticated } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const code = firstParam(params.code).trim();

    if (!code) {
      setError('Missing OAuth code in callback URL');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await api.exchangeAuthCode(code);
        if (cancelled) return;
        await setSession(result.accessToken, result.refreshToken);
        setDone(true);
      } catch {
        if (!cancelled) {
          setError('Failed to establish session from OAuth callback');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.code, setSession]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <Redirect href="/login" />
      </View>
    );
  }

  if (done || isAuthenticated) {
    return <Redirect href="/" />;
  }

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#1a1a1a" />
      <Text style={styles.copy}>Completing sign-in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f7f7f5',
    padding: 24,
  },
  copy: {
    fontSize: 15,
    opacity: 0.7,
  },
  error: {
    color: '#b42318',
    marginBottom: 12,
  },
});
