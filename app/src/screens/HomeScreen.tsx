import { StyleSheet, Text } from 'react-native';

import { Screen } from '../components/Screen';
import { colors } from '../theme/theme';

export function HomeScreen() {
  return (
    <Screen>
      <Text style={styles.title}>Tableau de bord</Text>
      <Text style={styles.text}>Retrouvez ici les indicateurs clés de votre activité.</Text>
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
