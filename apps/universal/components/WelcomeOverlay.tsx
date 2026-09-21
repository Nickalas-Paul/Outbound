import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { markWelcomeSeen } from '@/lib/welcomeStorage';
import { colors, spacing, typography } from '@/theme/tokens';

type Props = {
  /** Called after fade-out completes — parent should unmount. */
  onDismissed: () => void;
};

const VALUE_PROPS: Array<{
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  text: string;
}> = [
  {
    icon: 'map-search-outline',
    text: 'Interactive scores for safety, cost, crowding, and access — backed by real indicators',
  },
  {
    icon: 'routes',
    text: 'Itineraries shaped to how you travel, not a one-size package',
  },
  {
    icon: 'handshake-outline',
    text: 'Full-service booking when you want it — or take the plan and go',
  },
];

export default function WelcomeOverlay({ onDismissed }: Props) {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const opacity = useRef(new Animated.Value(0)).current;
  const cardRef = useRef<View>(null);
  const compact = height < 700;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  // Lightweight focus trap on web while the dialog is open.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const root = cardRef.current as unknown as HTMLElement | null;
    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const focusFirst = () => {
      const el = root?.querySelector?.(focusableSelector) as HTMLElement | null;
      el?.focus?.();
    };
    const t = setTimeout(focusFirst, 50);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !root) return;
      const nodes = Array.from(
        root.querySelectorAll(focusableSelector)
      ) as HTMLElement[];
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const finishDismiss = () => {
    markWelcomeSeen();
    Animated.timing(opacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onDismissed();
    });
  };

  const onPlanTrip = () => {
    markWelcomeSeen();
    Animated.timing(opacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onDismissed();
        router.push('/plan');
      }
    });
  };

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        // Android back: do not dismiss — require intentional CTA.
      }}
    >
      <Animated.View
        style={[styles.root, { opacity }]}
        accessibilityViewIsModal
      >
        <View
          style={styles.backdrop}
          pointerEvents="auto"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          {...(Platform.OS === 'web'
            ? ({ 'aria-hidden': true } as object)
            : null)}
        />

        <View
          ref={cardRef}
          style={[styles.card, compact && styles.cardCompact]}
          accessibilityLabel="Welcome to Outbound"
          {...(Platform.OS === 'web'
            ? ({
                role: 'dialog',
                'aria-label': 'Welcome to Outbound',
                'aria-modal': true,
              } as object)
            : {
                accessibilityRole: 'summary' as const,
              })}
        >
          <Text
            style={[styles.headline, compact && styles.headlineCompact]}
            accessibilityRole="header"
          >
            See destinations as they are — then build the trip that fits.
          </Text>

          <View style={[styles.props, compact && styles.propsCompact]}>
            {VALUE_PROPS.map((item) => (
              <View key={item.icon} style={styles.propRow}>
                <MaterialCommunityIcons
                  name={item.icon}
                  size={20}
                  color={colors.accent}
                  style={styles.propIcon}
                />
                <Text style={styles.propText}>{item.text}</Text>
              </View>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.primaryBtnPressed,
            ]}
            onPress={finishDismiss}
            accessibilityRole="button"
            accessibilityLabel="Start Exploring"
          >
            <Text style={styles.primaryBtnText}>Start Exploring</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryBtn}
            onPress={onPlanTrip}
            accessibilityRole="button"
            accessibilityLabel="Plan a Trip"
          >
            <Text style={styles.secondaryBtnText}>Plan a Trip</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(11, 11, 18, 0.62)',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
    zIndex: 1,
    // Lift off the map
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  cardCompact: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  headline: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    lineHeight: Math.round(typography.fontSize.xl * typography.lineHeight.tight),
  },
  headlineCompact: {
    fontSize: typography.fontSize.lg,
    lineHeight: Math.round(typography.fontSize.lg * typography.lineHeight.tight),
  },
  props: {
    gap: spacing.sm,
  },
  propsCompact: {
    gap: spacing.xs,
  },
  propRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  propIcon: {
    marginTop: 2,
  },
  propText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    lineHeight: Math.round(
      typography.fontSize.sm * typography.lineHeight.normal
    ),
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  primaryBtnPressed: {
    backgroundColor: colors.accentHover,
  },
  primaryBtnText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  secondaryBtnText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    textDecorationLine: 'underline',
  },
});
