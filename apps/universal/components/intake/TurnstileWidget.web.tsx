import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme/tokens';

type Props = {
  siteKey: string;
  onToken: (token: string) => void;
  onExpire?: () => void;
};

/**
 * Web-only Cloudflare Turnstile widget.
 * Cleans up via ref.remove() on unmount to avoid remount collisions in multi-step forms.
 */
export default function TurnstileWidget({ siteKey, onToken, onExpire }: Props) {
  const ref = useRef<TurnstileInstance | null>(null);

  useEffect(() => {
    return () => {
      try {
        ref.current?.remove();
      } catch {
        // Widget may already be gone
      }
    };
  }, []);

  return (
    <View style={styles.wrap}>
      <Turnstile
        ref={ref}
        siteKey={siteKey}
        options={{ theme: 'dark', size: 'flexible' }}
        onSuccess={(token) => onToken(token)}
        onExpire={() => {
          onToken('');
          onExpire?.();
        }}
        onError={() => onToken('')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginVertical: spacing.sm,
    minHeight: 65,
  },
});
