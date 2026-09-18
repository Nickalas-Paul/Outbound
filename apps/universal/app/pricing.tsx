import { StyleSheet, Text, View } from 'react-native';

import { MarketingShell } from '@/components/MarketingShell';

export default function PricingScreen() {
  return (
    <MarketingShell theme="dark">
      <View style={styles.page}>
        <Text style={styles.eyebrow}>PRICING</Text>
        <Text style={styles.title}>Coming soon</Text>
        <Text style={styles.subtitle}>
          Plans and pricing for Outbound will be announced here.
        </Text>
      </View>
    </MarketingShell>
  );
}

const styles = StyleSheet.create({
  page: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    gap: 12,
    paddingBottom: 48,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 480,
  },
});
