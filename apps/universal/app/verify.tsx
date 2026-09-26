import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MarketingShell } from '@/components/MarketingShell';
import { ApiError } from '@/services/api';
import { peekVerifyToken, postVerifyToken } from '@/services/intake';

type UiState =
  | 'idle'
  | 'loading'
  | 'success'
  | 'already-verified'
  | 'expired'
  | 'invalid';

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default function VerifyScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = useMemo(() => firstParam(params.token).trim(), [params.token]);
  const [state, setState] = useState<UiState>(token ? 'idle' : 'invalid');
  const [message, setMessage] = useState<string | null>(null);

  // Non-mutating status only — never consume on mount.
  useEffect(() => {
    if (!token) {
      setState('invalid');
      return;
    }
    let cancelled = false;
    void peekVerifyToken(token)
      .then((status) => {
        if (cancelled) return;
        if (status.status === 'already_used') {
          setState('already-verified');
          setMessage('Your email is already verified. No further action needed.');
        } else if (status.status === 'expired') {
          setState('expired');
        } else if (status.status === 'invalid') {
          setState('invalid');
        } else {
          setState('idle');
        }
      })
      .catch(() => {
        // Keep idle so the user can still try Start planning.
        if (!cancelled) setState('idle');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onConfirm() {
    if (!token) {
      setState('invalid');
      return;
    }
    setState('loading');
    setMessage(null);
    try {
      const result = await postVerifyToken(token);
      if (result.alreadyVerified) {
        setState('already-verified');
        setMessage(result.message);
        return;
      }
      setState('success');
      setMessage(result.message);
    } catch (err) {
      const reason =
        err instanceof ApiError && 'reason' in err
          ? String((err as ApiError & { reason?: string }).reason ?? '')
          : '';
      if (reason === 'expired') {
        setState('expired');
      } else if (reason === 'already_used') {
        setState('already-verified');
      } else {
        setState('invalid');
      }
      setMessage(
        err instanceof ApiError ? err.message : 'Verification failed. Please try again.'
      );
    }
  }

  return (
    <MarketingShell>
      <View style={styles.card}>
        <Text style={styles.title}>Confirm your email</Text>

        {state === 'idle' ? (
          <>
            <Text style={styles.body}>
              Tap the button below to verify your email and let us start building
              your trip plan.
            </Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => void onConfirm()}
              accessibilityRole="button"
              accessibilityLabel="Start planning"
            >
              <Text style={styles.primaryBtnText}>Start planning</Text>
            </Pressable>
          </>
        ) : null}

        {state === 'loading' ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#1a1a1a" />
            <Text style={styles.body}>Verifying…</Text>
          </View>
        ) : null}

        {state === 'success' ? (
          <>
            <Text style={styles.body}>
              {message ??
                "Email verified. I'm putting together your trip plan now."}
            </Text>
            <Link href="/" asChild>
              <Pressable style={styles.primaryBtn} accessibilityRole="button">
                <Text style={styles.primaryBtnText}>Back to Explorer</Text>
              </Pressable>
            </Link>
          </>
        ) : null}

        {state === 'already-verified' ? (
          <>
            <Text style={styles.body}>
              {message ?? 'Your email is already verified. No further action needed.'}
            </Text>
            <Link href="/" asChild>
              <Pressable style={styles.primaryBtn} accessibilityRole="button">
                <Text style={styles.primaryBtnText}>Back to Explorer</Text>
              </Pressable>
            </Link>
          </>
        ) : null}

        {state === 'expired' ? (
          <>
            <Text style={styles.body}>
              {message ??
                'This verification link has expired. Please submit a new trip request.'}
            </Text>
            <Link href="/plan" asChild>
              <Pressable style={styles.primaryBtn} accessibilityRole="button">
                <Text style={styles.primaryBtnText}>Plan a trip</Text>
              </Pressable>
            </Link>
          </>
        ) : null}

        {state === 'invalid' ? (
          <>
            <Text style={styles.body}>
              {message ??
                'This verification link is invalid or incomplete. Check the link in your email, or submit a new trip request.'}
            </Text>
            <Link href="/plan" asChild>
              <Pressable style={styles.primaryBtn} accessibilityRole="button">
                <Text style={styles.primaryBtnText}>Plan a trip</Text>
              </Pressable>
            </Link>
          </>
        ) : null}
      </View>
    </MarketingShell>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.75,
  },
  center: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
});
