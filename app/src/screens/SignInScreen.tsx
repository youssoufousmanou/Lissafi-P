import { Button, StyleSheet, Text, TextInput } from 'react-native';

import { Screen } from '../components/Screen';
import { colors } from '../theme/theme';

export function SignInScreen() {
  return (
    <Screen>
      <Text style={styles.title}>Connexion</Text>
      <Text style={styles.help}>Le parcours de connexion existant sera branché ici.</Text>
      <TextInput style={styles.input} placeholder="Téléphone" keyboardType="phone-pad" />
      <TextInput style={styles.input} placeholder="Code PIN" keyboardType="number-pad" secureTextEntry />
      <Button title="Se connecter" onPress={() => undefined} color={colors.primary} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  help: {
    color: colors.muted,
    fontSize: 16,
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
});
