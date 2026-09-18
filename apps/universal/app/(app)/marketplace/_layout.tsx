import { Stack } from 'expo-router';

// MARKETPLACE: commented out for Outbound — preserved for future vendor/guide marketplace
// Original marketplace layout preserved below. Routes remain registered for deep links.

export default function MarketplaceLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboard" />
      <Stack.Screen name="[agentId]" />
    </Stack>
  );
}

/*
ORIGINAL IMPLEMENTATION (preserved):
import { Stack } from 'expo-router';

export default function MarketplaceLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboard" />
      <Stack.Screen name="[agentId]" />
    </Stack>
  );
}

*/