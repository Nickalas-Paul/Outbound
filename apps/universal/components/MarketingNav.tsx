import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/services/auth';
import { colors, spacing, typography } from '@/theme/tokens';

type Props = {
  theme?: 'light' | 'dark';
};

export function MarketingNav({ theme = 'light' }: Props) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const dark = theme === 'dark';

  return (
    <View style={[styles.nav, dark && styles.navDark]}>
      <Link href="/" asChild>
        <Pressable>
          <Text style={[styles.brand, dark && styles.brandDark]}>Outbound</Text>
        </Pressable>
      </Link>

      <View style={styles.links}>
        <Link href="/" asChild>
          <Pressable style={styles.link}>
            <Text style={[styles.linkText, dark && styles.linkTextDark]}>
              Explorer
            </Text>
          </Pressable>
        </Link>
        <Link href="/about" asChild>
          <Pressable style={styles.link}>
            <Text style={[styles.linkText, dark && styles.linkTextDark]}>
              About
            </Text>
          </Pressable>
        </Link>
        <Link href="/plan" asChild>
          <Pressable
            style={StyleSheet.flatten([styles.planCta, dark && styles.planCtaDark])}
            accessibilityRole="button"
            accessibilityLabel="Plan a Trip"
          >
            <Text style={styles.planCtaText}>Plan a Trip</Text>
          </Pressable>
        </Link>
        <Link href="/docs/methodology" asChild>
          <Pressable style={styles.link}>
            <Text style={[styles.linkTextMuted, dark && styles.linkTextDark]}>
              Methodology
            </Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.actions}>
        {!isLoading && isAuthenticated ? (
          <>
            <Text
              style={[styles.userLabel, dark && styles.userLabelDark]}
              numberOfLines={1}
            >
              {user?.email}
            </Text>
            <Link href="/settings" asChild>
              <Pressable>
                <Text style={[styles.linkTextMuted, dark && styles.linkTextDark]}>
                  Settings
                </Text>
              </Pressable>
            </Link>
          </>
        ) : (
          <>
            <Link href="/login" asChild>
              <Pressable>
                <Text style={[styles.linkTextMuted, dark && styles.linkTextDark]}>
                  Log in
                </Text>
              </Pressable>
            </Link>
            <Link href="/register" asChild>
              <Pressable
                style={StyleSheet.flatten([styles.registerCta, dark && styles.registerCtaDark])}
              >
                <Text style={styles.registerCtaText}>Start free</Text>
              </Pressable>
            </Link>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e2de',
    backgroundColor: '#ffffff',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  navDark: {
    backgroundColor: '#0e0e16',
    borderBottomColor: '#1c1c2a',
  },
  brand: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  brandDark: {
    color: '#ffffff',
  },
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  link: {
    paddingVertical: 4,
  },
  linkText: {
    fontSize: typography.fontSize.md,
    color: '#1a1a1a',
  },
  linkTextMuted: {
    fontSize: typography.fontSize.sm,
    color: '#1a1a1a',
    opacity: 0.65,
  },
  linkTextDark: {
    color: 'rgba(255,255,255,0.75)',
    opacity: 1,
  },
  planCta: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 6,
  },
  planCtaDark: {
    backgroundColor: colors.accent,
  },
  planCtaText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  userLabel: {
    fontSize: typography.fontSize.sm,
    opacity: 0.7,
    maxWidth: 180,
  },
  userLabelDark: {
    color: 'rgba(255,255,255,0.65)',
    opacity: 1,
  },
  registerCta: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  registerCtaDark: {
    backgroundColor: '#1a3a6e',
  },
  registerCtaText: {
    color: '#ffffff',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
});
