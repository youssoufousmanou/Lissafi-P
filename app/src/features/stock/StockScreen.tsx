import { StyleSheet, Text } from 'react-native';

import { Screen } from '../../components/Screen';
import { colors } from '../../theme/theme';

export function StockScreen() {
  return (
    <Screen>
      <Text style={styles.title}>Stock</Text>
      <Text style={styles.text}>Consultez les niveaux de stock et préparez les réapprovisionnements.</Text>
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
