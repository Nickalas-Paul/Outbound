/**
 * Native Turnstile via WebView loading the API-hosted widget page.
 * Posts token back through onMessage — same props as the web widget.
 */
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { getApiUrl } from '@/services/api';
import { spacing } from '@/theme/tokens';

type Props = {
  siteKey: string;
  onToken: (token: string) => void;
  onExpire?: () => void;
};

type TurnstileMessage =
  | { type: 'token'; token: string }
  | { type: 'expire' }
  | { type: 'error' };

export default function TurnstileWidget({
  siteKey: _siteKey,
  onToken,
  onExpire,
}: Props) {
  const uri = useMemo(() => {
    const page = (process.env.EXPO_PUBLIC_TURNSTILE_PAGE_URL ?? '').trim();
    if (page) return page;
    return `${getApiUrl().replace(/\/$/, '')}/api/intake/turnstile`;
  }, []);

  function onMessage(event: WebViewMessageEvent) {
    try {
      const data = JSON.parse(event.nativeEvent.data) as TurnstileMessage;
      if (data.type === 'token' && typeof data.token === 'string') {
        onToken(data.token);
        return;
      }
      if (data.type === 'expire') {
        onToken('');
        onExpire?.();
        return;
      }
      if (data.type === 'error') {
        onToken('');
      }
    } catch {
      // Ignore malformed messages
    }
  }

  return (
    <View style={styles.wrap}>
      <WebView
        source={{ uri }}
        onMessage={onMessage}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        scrollEnabled={false}
        accessibilityLabel="Cloudflare Turnstile verification"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginVertical: spacing.sm,
    minHeight: 72,
    height: 72,
    overflow: 'hidden',
  },
  webview: {
    backgroundColor: 'transparent',
    flex: 1,
  },
});
