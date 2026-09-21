import { Link, Slot, Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CompareProvider } from '@/hooks/useCompareSelection';
import { useTierAccess } from '@/hooks/useTierAccess';
import { useAuth } from '@/services/auth';
import { colors, spacing, typography } from '@/theme/tokens';
// MARKETPLACE: commented out for Outbound — preserved for future vendor/guide marketplace

type NavLink = {
  href: '/' | '/about' | '/plan' | '/settings' | '/docs/methodology' | '/login';
  label: string;
  variant?: 'default' | 'cta' | 'muted';
};

function TierBadge() {
  const { gatingEnabled, currentTier } = useTierAccess();

  if (!gatingEnabled) {
    return (
      <View style={[styles.badge, styles.badgeBeta]}>
        <Text style={styles.badgeText}>BETA</Text>
      </View>
    );
  }

  if (currentTier === 'pro') {
    return (
      <View style={[styles.badge, styles.badgePro]}>
        <Text style={[styles.badgeText, styles.badgeTextOnColor]}>PRO</Text>
      </View>
    );
  }

  if (currentTier === 'marketplace') {
    return (
      <View style={[styles.badge, styles.badgeMarketplace]}>
        <Text style={[styles.badgeText, styles.badgeTextOnColor]}>MARKETPLACE</Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, styles.badgeFree]}>
      <Text style={styles.badgeText}>FREE</Text>
    </View>
  );
}

function useShellNavLinks(): NavLink[] {
  return [
    { href: '/', label: 'Explorer' },
    { href: '/about', label: 'About' },
    { href: '/plan', label: 'Plan a Trip', variant: 'cta' },
  ];
}

function WebSidebarShell() {
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const links = useShellNavLinks();

  return (
    <View style={styles.shell}>
      <View style={styles.sidebar}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>Outbound</Text>
          {isAuthenticated ? <TierBadge /> : null}
        </View>
        {user ? <Text style={styles.userEmail}>{user.email}</Text> : null}

        {links.map((item) => (
          <Link key={item.href} href={item.href} asChild>
            <Pressable
              style={StyleSheet.flatten([
                styles.navItem,
                item.variant === 'cta' && styles.navItemCta,
              ])}
            >
              <Text
                style={StyleSheet.flatten([
                  styles.navText,
                  item.variant === 'cta' && styles.navTextCta,
                ])}
              >
                {item.label}
              </Text>
            </Pressable>
          </Link>
        ))}

        <View style={styles.sidebarSpacer} />

        <Link href="/docs/methodology" asChild>
          <Pressable style={styles.navItem}>
            <Text style={styles.navTextMuted}>Methodology</Text>
          </Pressable>
        </Link>

        {isAuthenticated ? (
          <Link href="/settings" asChild>
            <Pressable style={styles.navItem}>
              <Text style={styles.navTextMuted}>Settings</Text>
            </Pressable>
          </Link>
        ) : null}

        {!isLoading && !isAuthenticated ? (
          <Link href="/login" asChild>
            <Pressable style={styles.navItem}>
              <Text style={styles.navTextMuted}>Log in</Text>
            </Pressable>
          </Link>
        ) : null}

        {isAuthenticated ? (
          <Pressable
            style={styles.navItem}
            onPress={() => {
              void logout();
            }}
          >
            <Text style={styles.navTextMuted}>Log out</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.content}>
        <Slot />
      </View>
    </View>
  );
}

function NativeTabsShell() {
  const insets = useSafeAreaInsets();
  const { logout, isAuthenticated, isLoading } = useAuth();

  return (
    <View style={styles.nativeWrap}>
      <View
        style={StyleSheet.flatten([
          styles.nativeBadgeBar,
          { paddingTop: Math.max(insets.top, 8) },
        ])}
      >
        <View style={styles.nativeBrandRow}>
          <Text style={styles.nativeBrand}>Outbound</Text>
          {isAuthenticated ? <TierBadge /> : null}
        </View>
        <View style={styles.nativeActions}>
          {!isLoading && !isAuthenticated ? (
            <Link href="/login" asChild>
              <Pressable hitSlop={8}>
                <Text style={styles.navTextMuted}>Log in</Text>
              </Pressable>
            </Link>
          ) : null}
          {isAuthenticated ? (
            <>
              <Link href="/settings" asChild>
                <Pressable
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Settings"
                >
                  <MaterialCommunityIcons
                    name="cog-outline"
                    size={22}
                    color="#1a1a1a"
                  />
                </Pressable>
              </Link>
              <Pressable onPress={() => void logout()} hitSlop={8}>
                <Text style={styles.navTextMuted}>Log out</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#1a1a1a',
          tabBarInactiveTintColor: '#6b6b6b',
          tabBarIcon: () => null,
          tabBarStyle: {
            paddingBottom: Math.max(insets.bottom, 8),
            height: 52 + Math.max(insets.bottom, 8),
            backgroundColor: '#ffffff',
            borderTopColor: '#e2e2de',
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
            marginBottom: 8,
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Explorer' }} />
        <Tabs.Screen name="about" options={{ title: 'About' }} />
        <Tabs.Screen
          name="plan"
          options={{
            title: 'Plan a Trip',
            tabBarActiveTintColor: colors.accent,
          }}
        />
        {/* Settings via badge-bar gear — keep route registered, hide from tabs */}
        <Tabs.Screen
          name="settings"
          options={{ href: null, title: 'Settings' }}
        />
        {/* Nested explorer routes (compare, detail) — hidden from tab bar */}
        <Tabs.Screen
          name="explorer"
          options={{ href: null, title: 'Explorer' }}
        />
        {/* MARKETPLACE: commented out for Outbound — preserved for future vendor/guide marketplace */}
        <Tabs.Screen
          name="marketplace"
          options={{ href: null, title: 'Marketplace' }}
        />
        <Tabs.Screen
          name="engagements"
          options={{ href: null, title: 'Engagements' }}
        />
        <Tabs.Screen
          name="notifications"
          options={{ href: null, title: 'Notifications' }}
        />
      </Tabs>
    </View>
  );
}

export default function AppShellLayout() {
  const { width } = useWindowDimensions();
  const useSidebar = Platform.OS === 'web' && width >= 768;
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1a1a1a" />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  const shell = useSidebar ? <WebSidebarShell /> : <NativeTabsShell />;

  return <CompareProvider>{shell}</CompareProvider>;
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f7f7f5',
  },
  sidebar: {
    width: 220,
    padding: 20,
    gap: 8,
    borderRightWidth: 1,
    borderRightColor: '#e2e2de',
    backgroundColor: '#ffffff',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  brand: {
    fontSize: 18,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeBeta: {
    backgroundColor: '#e8eef8',
  },
  badgeFree: {
    backgroundColor: '#e5e5e5',
  },
  badgePro: {
    backgroundColor: '#3b82f6',
  },
  badgeMarketplace: {
    backgroundColor: '#10b981',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#1a1a1a',
  },
  badgeTextOnColor: {
    color: '#ffffff',
  },
  userEmail: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 8,
  },
  sidebarSpacer: {
    flex: 1,
    minHeight: spacing.md,
  },
  navItem: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  navItemCta: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  navText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: '#1a1a1a',
  },
  navTextCta: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
  },
  navTextMuted: {
    fontSize: typography.fontSize.sm,
    opacity: 0.6,
    color: '#1a1a1a',
  },
  content: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f7f7f5',
  },
  loadingText: {
    fontSize: 14,
    opacity: 0.65,
  },
  nativeWrap: {
    flex: 1,
  },
  nativeBadgeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e2de',
  },
  nativeBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nativeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nativeBrand: {
    fontSize: 16,
    fontWeight: '700',
  },
});
