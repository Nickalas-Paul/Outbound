import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, palette, spacing, typography } from '@/theme/tokens';

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Body({ children }: { children: string }) {
  return <Text style={styles.body}>{children}</Text>;
}

const STEPS: Array<{ n: string; title: string; body: string }> = [
  {
    n: '1',
    title: 'Explore',
    body: 'Browse destinations with a clear view of safety, cost, crowding, accessibility, and infrastructure — filtered by how you actually travel.',
  },
  {
    n: '2',
    title: 'Plan',
    body: 'Share your trip details. Receive a researched itinerary tailored to your preferences — not a generic package.',
  },
  {
    n: '3',
    title: 'Travel',
    body: 'Book yourself with the links we provide, or choose full-service and let us handle flights, hotels, and experiences for you.',
  },
];

const DIFFERENTIATORS: string[] = [
  'Firsthand knowledge from years living and traveling across Korea, Spain, Argentina, and Mexico — not blog opinions or outdated guidebooks.',
  'Every recommendation is checked against what is actually open and bookable before it reaches you.',
  'A dedicated concierge relationship: thoughtful turnaround, careful fees, and judgment when a trip needs a human call.',
];

export default function AboutScreen() {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.pageTitle}>About Outbound</Text>
      <Text style={styles.pageLead}>
        A personal travel concierge — grounded in lived international experience.
      </Text>

      <Section title="What Outbound is">
        <Body>
          Outbound is a travel concierge service. We help you choose where to go
          with a clear-eyed view of each destination, then craft a workable
          itinerary designed around how you travel.
        </Body>
        <Body>
          You can take a researched plan and book it yourself, or hand the
          logistics to us end-to-end — flights, stays, and experiences included.
          Same care either way.
        </Body>
      </Section>

      <Section title="How it works">
        <View style={styles.steps}>
          {STEPS.map((step) => (
            <View key={step.n} style={styles.stepRow}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{step.n}</Text>
              </View>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepCopy}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </Section>

      <Section title="What makes it different">
        {DIFFERENTIATORS.map((line) => (
          <View key={line} style={styles.diffRow}>
            <Text style={styles.diffMark}>—</Text>
            <Text style={styles.diffText}>{line}</Text>
          </View>
        ))}
      </Section>

      <Section title="Who operates it">
        <Body>
          Outbound is run by someone who has lived and traveled extensively in
          Korea, Spain, Argentina, and Mexico — not a faceless aggregator. That
          experience shows up in the details: how culture actually works on the
          ground, which logistics trip people up, and where the quieter gems still
          are. When a trip needs judgment beyond the guidebook, you can talk to
          the person who planned it.
        </Body>
      </Section>

      <View style={styles.ctaBlock}>
        <Text style={styles.ctaHeading}>Ready to explore?</Text>
        <Link href="/" asChild>
          <Pressable
            style={({ pressed }) =>
              StyleSheet.flatten([
                styles.primaryBtn,
                pressed && styles.primaryBtnPressed,
              ])
            }
            accessibilityRole="button"
            accessibilityLabel="Explore destinations"
          >
            <Text style={styles.primaryBtnText}>Explore Destinations</Text>
          </Pressable>
        </Link>
        <Link href="/plan" asChild>
          <Pressable accessibilityRole="button" accessibilityLabel="Plan a Trip">
            <Text style={styles.secondaryLink}>Plan a Trip</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: palette.cream50,
  },
  content: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  pageTitle: {
    color: colors.textOnLight,
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
  },
  pageLead: {
    color: palette.ink900,
    opacity: 0.65,
    fontSize: typography.fontSize.lg,
    lineHeight: Math.round(typography.fontSize.lg * typography.lineHeight.normal),
    marginBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.xxl,
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.textOnLight,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  body: {
    color: colors.textOnLight,
    fontSize: typography.fontSize.md,
    lineHeight: Math.round(typography.fontSize.md * typography.lineHeight.relaxed),
    opacity: 0.88,
  },
  steps: {
    gap: spacing.lg,
  },
  stepRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  stepNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  stepBody: {
    flex: 1,
    gap: spacing.xs,
  },
  stepTitle: {
    color: colors.textOnLight,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  stepCopy: {
    color: colors.textOnLight,
    opacity: 0.75,
    fontSize: typography.fontSize.md,
    lineHeight: Math.round(typography.fontSize.md * typography.lineHeight.normal),
  },
  diffRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  diffMark: {
    color: colors.accent,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    marginTop: 1,
  },
  diffText: {
    flex: 1,
    color: colors.textOnLight,
    opacity: 0.85,
    fontSize: typography.fontSize.md,
    lineHeight: Math.round(typography.fontSize.md * typography.lineHeight.relaxed),
  },
  ctaBlock: {
    marginTop: spacing.lg,
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  ctaHeading: {
    color: colors.textOnLight,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    borderRadius: 8,
  },
  primaryBtnPressed: {
    backgroundColor: colors.accentHover,
  },
  primaryBtnText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  secondaryLink: {
    color: colors.accent,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    textDecorationLine: 'underline',
  },
});
