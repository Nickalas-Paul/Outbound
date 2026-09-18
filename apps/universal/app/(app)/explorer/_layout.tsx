import { Stack } from 'expo-router';

export default function ExplorerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="compare" />
      <Stack.Screen name="[geographyId]" />
      {/* MARKETPLACE: commented out for Outbound — preserved for future vendor/guide marketplace */}
      {/* Route file kept as Coming Soon placeholder if deep-linked */}
      <Stack.Screen name="[geographyId]/agents" options={{ title: 'Agents' }} />
    </Stack>
  );
}
