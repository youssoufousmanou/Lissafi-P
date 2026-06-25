import { StyleSheet, Text } from 'react-native';

import { Screen } from '../../components/Screen';
import { colors } from '../../theme/theme';

export function OperationsScreen() {
  return (
    <Screen>
      <Text style={styles.title}>Opérations</Text>
      <Text style={styles.text}>Suivez les ventes, dépenses et encaissements.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  text: {
    color: colors.muted,
    fontSize: 16,
  },
});
