import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import IntakeForm from '@/components/intake/IntakeForm';
import { colors } from '@/theme/tokens';

/** Trip intake wizard — replaces the Plan placeholder (Phase 2 Prompt 4b). */
export default function PlanScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.root}>
        <IntakeForm />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
